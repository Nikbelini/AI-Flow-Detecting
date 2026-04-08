import os
import torch
import numpy as np
import logging
from typing import Dict
from datetime import datetime

from database.db import load_stop_history, get_all_stops_in_city
from services.graph_builder import GraphBuilder
from database.dataset_builder import build_sequences
from models.factory import build_model
from services.data_guard import has_enough_data
from services.data_preprocessor import DataPreprocessor
from services.model_io import load_model_with_metadata
from services.locks import MODEL_LOCK

logger = logging.getLogger(__name__)

# ===========================
# POST-PROCESSING FORMULAS
# ===========================

def compute_load(count: float, max_people: int = 50) -> int:
    """
    Load: 1..10
    10 достигается при 50+ людях.
    """
    if count is None:
        return None
    load = 1 + 9 * (count / max_people)
    return int(round(min(10, max(1, load))))


def compute_velocity(count: float, base_speed: float = 40.0) -> float:
    """
    Velocity падает при росте количества людей.
    """
    if count is None:
        return None
    factor = 1.0 / (1.0 + (count / 30.0))
    return round(base_speed * factor, 2)


def compute_surge_index(forecast: list[int]) -> float:
    """
    Surge = средний рост count между шагами.
    10 человек прироста за шаг = surge 1.0
    """
    if not forecast or len(forecast) < 2:
        return 0.0
    diffs = [forecast[i] - forecast[i - 1] for i in range(1, len(forecast))]
    avg_growth = sum(diffs) / len(diffs)
    surge = avg_growth / 10.0
    return round(max(0.0, surge), 2)


def forecast_city_blind_stops(city_id: int, horizon: int) -> Dict:
    """
    Прогноз ТОЛЬКО для остановок БЕЗ камер.
    Возвращает целые числа (passengers count).
    """
    result = _forecast_internal(city_id, horizon, blind_only=True)
    
    if result.get("status") != "success":
        return result
    
    predictions_list = []
    for stop in result.get("stops", []):
        forecast = stop.get("forecast", [])

        full_forecast = [int(round(v)) for v in forecast]
        predicted_count = int(round(forecast[0])) if forecast else None
        predicted_load = compute_load(predicted_count) if predicted_count is not None else None
        predicted_velocity = compute_velocity(predicted_count) if predicted_count is not None else None

        surge_index = compute_surge_index(full_forecast)
        full_forecast = [int(round(v)) for v in forecast]
        
        predictions_list.append({
            "stop_id": stop["stop_id"],
            "address": stop["address"],
            "lat": stop["lat"],
            "lng": stop["lng"],
            "has_camera": False,
            "predicted_count": predicted_count,
            "predicted_velocity": predicted_velocity,
            "predicted_load": predicted_load,
            "surge_index": surge_index,
            "forecast_horizon": len(full_forecast),
            "full_forecast": full_forecast
        })
    
    return {
        "city_id": city_id,
        "timestamp": datetime.now().isoformat(),
        "predictions": predictions_list,
        "meta": result.get("metadata", {})
    }

def _forecast_internal(city_id: int, horizon: int, blind_only: bool = True) -> Dict:
    """Внутренняя функция прогноза"""
    logger.info(f"Forecast: city={city_id}, horizon={horizon}, blind_only={blind_only}")
    
    df = load_stop_history(city_id)
    
    if not has_enough_data(df):
        logger.warning(f"Not enough data: {df['datetime'].nunique() if not df.empty else 0}/32")
        return {"status": "NOT_READY", "message": "Not enough data"}
    
    model_path = f"result/models/city_{city_id}.pt"

    if not os.path.exists(model_path):
        logger.warning(f"Model not found: {model_path}")
        return {"status": "NOT_TRAINED", "message": "Model not trained"}
    
    loaded = load_model_with_metadata(model_path)
    if not loaded or 'state_dict' not in loaded:
        return {"status": "ERROR", "message": "Failed to load model"}
    
    metadata = loaded.get('metadata', {})
    scaler = metadata.get('scaler')
    nodes_order = metadata.get("nodes_order")
    time_steps = metadata.get("time_steps", 12)
    sigma = metadata.get("sigma", 0.5)
    
    if scaler is None or not nodes_order:
        return {"status": "ERROR", "message": "Model metadata corrupted"}
    
    # === ВСЕ остановки города (для координат) ===
    all_stops = get_all_stops_in_city(city_id)
    if all_stops.empty:
        # Fallback: берём из истории, но с stop_id если есть
        cols = ["stop_id", "address", "lat", "lng"] if "stop_id" in df.columns else ["address", "lat", "lng"]
        all_stops = df[cols].drop_duplicates(subset=["stop_id"] if "stop_id" in df.columns else ["address"])

    stops_lookup = (
        all_stops
        .drop_duplicates(subset=["stop_id"], keep="first")
        .set_index("stop_id")[["address", "lat", "lng"]]
        .to_dict("index")
    )

    coords = []
    for stop_id in nodes_order:
        info = stops_lookup.get(int(stop_id), {"lat": 0.0, "lng": 0.0})
        coords.append([info["lat"], info["lng"]])
    coords = np.array(coords, dtype=np.float32)

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    logger.info(f"Inference device: {device}")

    # Вычисление на устройстве
    adj = GraphBuilder(sigma=sigma).build_from_coordinates(coords, device=device)

    # === нормализация ===
    df_norm, _ = DataPreprocessor.normalize(df, scaler=scaler, fit=False)

    # === последовательности на ВСЕХ nodes_order ===
    X_seq, _ = build_sequences(df_norm, nodes_order, time_steps=time_steps)
    input_seq = X_seq[-1:].clone().to(device)  # [1, T, N]

    # === модель ===
    model = build_model(len(nodes_order)).to(device)
    with MODEL_LOCK:
        model.load_state_dict(loaded["state_dict"])
        model.eval()

    # === autoregressive прогноз ===
    preds_steps = []
    with torch.no_grad():
        for _ in range(horizon):
            pred = model(input_seq, adj)  # [1, N]
            preds_steps.append(pred.squeeze(0).cpu().numpy())

            # input_seq: [B, T, C, N]
            # pred_step: [B, 1, C, N]
            pred_step = torch.zeros(
                (input_seq.size(0), 1, input_seq.size(2), input_seq.size(3)),
                device=device
            )

            # count в канал 0
            pred_step[:, 0, 0, :] = pred

            # остальные каналы (time embeddings) копируем из последнего timestep
            pred_step[:, 0, 1:, :] = input_seq[:, -1, 1:, :]

            # sliding window
            input_seq = torch.cat([input_seq[:, 1:], pred_step], dim=1)

    preds_steps = np.stack(preds_steps, axis=0)  # [H, N]

    # === определяем камеры по данным (правильнее чем has_camera) ===
    camera_set = set(df[df["count"] > 0]["stop_id"].dropna().unique().tolist())

    stops_result = []
    blind_nodes = 0

    for idx, stop_id in enumerate(nodes_order):
        stop_id_int = int(stop_id)
        has_cam = stop_id_int in camera_set

        if not has_cam:
            blind_nodes += 1

        if blind_only and has_cam:
            continue

        # Получаем инфо об остановке
        stop_info = stops_lookup.get(stop_id_int, {
            "address": f"Unknown_{stop_id_int}",
            "lat": coords[idx][0],
            "lng": coords[idx][1]
        })

        forecast_norm = preds_steps[:, idx]
        forecast = DataPreprocessor.denormalize_count(forecast_norm, scaler)

        # защита от отрицательных значений
        forecast = [int(round(max(0, v))) for v in forecast]

        stops_result.append({
            "stop_id": stop_id_int,
            "address": stop_info["address"],
            "lat": float(coords[idx][0]),
            "lng": float(coords[idx][1]),
            "has_camera": has_cam,
            "forecast": forecast
        })

    return {
        "status": "success",
        "city_id": city_id,
        "horizon": horizon,
        "timestamp": datetime.now().isoformat(),
        "stops": stops_result,
        "metadata": {
            "total_nodes": len(nodes_order),
            "blind_nodes": blind_nodes,
            "camera_nodes": len(nodes_order) - blind_nodes,
            "returned": len(stops_result),
            "blind_only": blind_only
        }
    }