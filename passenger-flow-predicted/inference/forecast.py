import os
import torch
import numpy as np
import pandas as pd
import logging
from typing import Dict
from datetime import datetime, timedelta
from pathlib import Path

from database.db import get_all_stops_in_city, load_stop_history_last_window
from database.dataset_builder import build_last_window 
from services.graph_builder import GraphBuilder
from models.factory import build_model
from services.data_guard import has_enough_data
from services.data_preprocessor import DataPreprocessor
from services.model_io import load_model_with_metadata
from services.locks import MODEL_LOCK
from algorithm.timezone_resolver import resolve_timezone
from algorithm.time_coeff import TimeCorfficientService
from algorithm.geo import haversine


logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "result" / "models"


# ===========================
# POST-PROCESSING FORMULAS
# ===========================

def compute_load(count: float, max_people: int = 50) -> int:
    if count is None:
        return None
    load = 1 + 9 * (count / max_people)
    return int(round(min(10, max(1, load))))


def compute_velocity(count: float, base_speed: float = 40.0) -> float:
    if count is None:
        return None
    factor = 1.0 / (1.0 + (count / 30.0))
    return round(base_speed * factor, 2)


def compute_surge_index(forecast: list[int]) -> float:
    if not forecast or len(forecast) < 2:
        return 0.0
    diffs = [forecast[i] - forecast[i - 1] for i in range(1, len(forecast))]
    avg_growth = sum(diffs) / len(diffs)
    surge = avg_growth / 10.0
    return round(max(0.0, surge), 2)


# ===========================
# Time Mask
# ===========================

def _apply_time_mask(
    forecast: list[int],
    stop_lat: float,
    stop_lng: float,
    city_center: tuple[float, float],
    base_timestamp: datetime,
    time_svc: TimeCorfficientService,
    step_minutes: int = 60,
) -> list[int]:

    dist_km = haversine(stop_lat, stop_lng, city_center[0], city_center[1])
    is_peripheral = dist_km > 3.0

    result = []
    for step_idx, count in enumerate(forecast):
        step_dt = base_timestamp + timedelta(minutes=step_minutes * step_idx)
        step_dt_str = step_dt.isoformat()

        Tt      = time_svc.get_T(step_dt_str)
        is_nite = time_svc.is_night(step_dt_str)
        is_peak = time_svc.is_peak_hour(step_dt_str)

        if is_nite and is_peripheral:
            result.append(0)
        elif is_nite and not is_peripheral:
            result.append(min(count, 3))
        elif Tt < 0.20 and is_peripheral:
            result.append(min(count, 2))
        elif is_peak and dist_km < 5.0:
            result.append(max(count, 1))
        else:
            result.append(count)

    return result


# ======================
# CUDA diagnostic
# ======================

def _get_device() -> torch.device:
    if not torch.cuda.is_available():
        vis         = os.environ.get("NVIDIA_VISIBLE_DEVICES", "")
        cuda_visible = os.environ.get("CUDA_VISIBLE_DEVICES", "")
        logger.warning(
            f"CUDA not available in inference! "
            f"NVIDIA_VISIBLE_DEVICES={vis!r}, CUDA_VISIBLE_DEVICES={cuda_visible!r}. "
            f"Using CPU."
        )
        return torch.device("cpu")

    device = torch.device("cuda:0")
    props  = torch.cuda.get_device_properties(0)
    logger.info(
        f"CUDA available: {props.name}, {props.total_memory // 1024 ** 2} MB "
        f"compute {props.major}.{props.minor}"
    )
    return device


# ===========================
# Public API
# ===========================

def forecast_city_blind_stops(city_id: int, horizon: int) -> Dict:
    result = _forecast_internal(city_id, horizon, blind_only=True)
    return _format_result(result, city_id)


def forecast_city_all_stops(city_id: int, horizon: int) -> Dict:
    result = _forecast_internal(city_id, horizon, blind_only=False)
    return _format_result(result, city_id)


def _format_result(result: Dict, city_id: int) -> Dict:
    if result.get("status") != "success":
        return result

    predictions_list = []
    for stop in result.get("stops", []):
        forecast      = stop.get("forecast", [])
        full_forecast = [int(round(v)) for v in forecast]

        predicted_count    = full_forecast[0] if full_forecast else None
        predicted_load     = compute_load(predicted_count)     if predicted_count is not None else None
        predicted_velocity = compute_velocity(predicted_count) if predicted_count is not None else None
        surge_index        = compute_surge_index(full_forecast)

        predictions_list.append({
            "stop_id":           stop["stop_id"],
            "address":           stop["address"],
            "lat":               stop["lat"],
            "lng":               stop["lng"],
            "has_camera":        stop["has_camera"],
            "predicted_count":   predicted_count,
            "predicted_velocity": predicted_velocity,
            "predicted_load":    predicted_load,
            "surge_index":       surge_index,
            "forecast_horizon":  len(full_forecast),
            "full_forecast":     full_forecast,
        })

    return {
        "city_id":    city_id,
        "timestamp":  datetime.now().isoformat(),
        "timezone":   result.get("timezone", "unknown"),
        "predictions": predictions_list,
        "meta":       result.get("metadata", {}),
    }


def _forecast_internal(city_id: int, horizon: int, blind_only: bool = True) -> Dict:
    logger.info(f"Forecast: city={city_id}, horizon={horizon}, blind_only={blind_only}")

    model_path = MODEL_DIR / f"city_{city_id}.pt"
    if not model_path.exists():
        return {"status": "NOT_TRAINED", "message": "Model not trained"}

    loaded = load_model_with_metadata(str(model_path))
    if not loaded or "state_dict" not in loaded:
        return {"status": "ERROR", "message": "Failed to load model"}

    metadata   = loaded.get("metadata", {})
    scaler     = metadata.get("scaler")
    nodes_order = metadata.get("nodes_order")
    time_steps = int(metadata.get("time_steps", 12))
    sigma      = float(metadata.get("sigma", 0.5))
    tz_name    = metadata.get("timezone")

    if scaler is None or not nodes_order:
        return {"status": "ERROR", "message": "Model metadata corrupted"}

    nodes_order = [int(x) for x in nodes_order]
    num_nodes   = len(nodes_order)

    # Загружаем сырые данные из БД (через load_stop_history_last_window)
    df_raw = load_stop_history_last_window(city_id, time_steps + 2)

    if not has_enough_data(df_raw, min_steps=time_steps + 1):
        n = df_raw["datetime"].nunique() if not df_raw.empty else 0
        return {"status": "NOT_READY", "message": f"Not enough data: {n}/{time_steps + 1}"}

    # Остановки
    all_stops = get_all_stops_in_city(city_id)
    if all_stops.empty:
        return {"status": "ERROR", "message": "Stops not found"}

    all_stops["stop_id"] = all_stops["stop_id"].astype(int)

    stops_lookup: dict[int, dict] = {}
    for _, row in all_stops.drop_duplicates(subset=["stop_id"], keep="first").iterrows():
        sid = int(row["stop_id"])
        stops_lookup[sid] = {
            "address": row.get("address", f"Unknown_{sid}"),
            "lat":  float(row.get("lat", 0.0)) if pd.notna(row.get("lat")) else 0.0,
            "lng":  float(row.get("lng", 0.0)) if pd.notna(row.get("lng")) else 0.0,
            "url":  row.get("url", "") or "",
        }

    coords = np.array(
        [[stops_lookup.get(sid, {"lat": 0.0, "lng": 0.0})["lat"],
          stops_lookup.get(sid, {"lat": 0.0, "lng": 0.0})["lng"]]
         for sid in nodes_order],
        dtype=np.float32,
    )

    # Timezone
    if not tz_name:
        center_lat = float(np.mean(coords[:, 0]))
        center_lng = float(np.mean(coords[:, 1]))
        tz_name    = resolve_timezone(lat=center_lat, lng=center_lng)

    time_svc = TimeCorfficientService(timezone=tz_name)
    device   = _get_device()

    # Граф
    adj = GraphBuilder(sigma=sigma).build_from_coordinates(coords, device=device)

    # Нормализация
    df_norm, _ = DataPreprocessor.normalize(df_raw, scaler=scaler, fit=False)

    # Входной тензор [1, T, C, N] — из dataset_builder, все 7 каналов
    input_seq = build_last_window(df_norm, nodes_order, time_steps=time_steps).to(device)

    logger.info(
        f"input_seq: shape={input_seq.shape}, "
        f"count={input_seq[0,:,0,:].mean():.3f}, "
        f"tw={input_seq[0,:,5,:].mean():.3f}, "
        f"peak={input_seq[0,:,6,:].mean():.3f}"
    )

    # Модель 
    model = build_model(num_nodes=num_nodes, horizon=horizon).to(device)
    with MODEL_LOCK:
        model.load_state_dict(loaded["state_dict"])
        model.eval()

    # Инференс  
    t_start = datetime.now()

    with torch.inference_mode():
        pred = model(input_seq, adj)   # [1, H, N]

    if device.type == "cuda":
        torch.cuda.synchronize()

    elapsed = (datetime.now() - t_start).total_seconds()
    logger.info(f"Inference done in {elapsed:.4f}s on {device}, pred shape={pred.shape}")

    pred        = pred.detach().cpu()
    preds_steps = pred.squeeze(0).numpy()   # [H, N]

    # Камеры по наличию url
    camera_stop_ids = {
        int(sid)
        for sid in nodes_order
        if isinstance(stops_lookup.get(int(sid), {}).get("url", ""), str)
        and stops_lookup[int(sid)]["url"].strip()
    }

    city_center = (float(np.mean(coords[:, 0])), float(np.mean(coords[:, 1])))
    base_ts     = datetime.now()

    stops_result = []
    blind_nodes  = 0
    camera_nodes = 0

    for idx, sid in enumerate(nodes_order):
        sid_int = int(sid)
        has_cam = sid_int in camera_stop_ids

        if has_cam:
            camera_nodes += 1
        else:
            blind_nodes += 1

        if blind_only and has_cam:
            continue

        stop_info = stops_lookup.get(sid_int, {
            "address": f"Unknown_{sid_int}",
            "lat": float(coords[idx][0]),
            "lng": float(coords[idx][1]),
        })

        # preds_steps: [H, N] → берём все горизонты для узла idx
        forecast_norm = preds_steps[:, idx]                                   # [H]
        forecast_raw  = DataPreprocessor.denormalize_count(forecast_norm, scaler)
        forecast_raw  = [int(round(max(0, v))) for v in forecast_raw]

        forecast = _apply_time_mask(
            forecast_raw,
            stop_lat=float(coords[idx][0]),
            stop_lng=float(coords[idx][1]),
            city_center=city_center,
            base_timestamp=base_ts,
            time_svc=time_svc,
        )

        stops_result.append({
            "stop_id":  sid_int,
            "address":  stop_info["address"],
            "lat":      float(coords[idx][0]),
            "lng":      float(coords[idx][1]),
            "has_camera": has_cam,
            "forecast": forecast,
        })

    return {
        "status":   "success",
        "city_id":  city_id,
        "horizon":  horizon,
        "timestamp": datetime.now().isoformat(),
        "timezone": tz_name,
        "stops":    stops_result,
        "metadata": {
            "total_nodes":        len(nodes_order),
            "blind_nodes":        blind_nodes,
            "camera_nodes":       camera_nodes,
            "returned":           len(stops_result),
            "blind_only":         blind_only,
            "timezone":           tz_name,
            "inference_seconds":  round(elapsed, 4),
            "device":             str(device),
        },
    }