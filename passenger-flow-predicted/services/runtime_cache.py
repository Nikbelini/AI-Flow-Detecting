import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Any

import numpy as np
import pandas as pd
import torch

from services.graph_builder import GraphBuilder
from services.graph_utils import normalize_adj
from services.model_io import load_model_with_metadata
from models.factory import build_model
from database.db import get_all_stops_in_city
from algorithm.timezone_resolver import resolve_timezone


MODEL_LOCK = threading.Lock()


@dataclass
class CityRuntime:
    city_id: int
    model: torch.nn.Module
    adj_norm: torch.Tensor
    scaler: Any
    nodes_order: list[int]
    coords: np.ndarray
    stops_lookup: dict[int, dict]
    camera_stop_ids: set[int]
    timezone: str
    time_steps: int
    sigma: float
    horizon: int
    device: torch.device
    model_mtime: float


class CityRuntimeCache:
    def __init__(self, model_dir: Path):
        self.model_dir = model_dir
        self._cache: Dict[int, CityRuntime] = {}
        self._lock = threading.Lock()

    def _get_device(self) -> torch.device:
        return torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

    def get(self, city_id: int, horizon: int) -> CityRuntime:
        model_path = self.model_dir / f"city_{city_id}.pt"
        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {model_path}")

        mtime = os.path.getmtime(model_path)

        with self._lock:
            rt = self._cache.get(city_id)
            if rt is not None:
                if rt.model_mtime == mtime and rt.horizon == horizon:
                    return rt

            rt = self._build_runtime(city_id, model_path, horizon, mtime)
            self._cache[city_id] = rt
            return rt

    def _build_runtime(self, city_id: int, model_path: Path, horizon: int, mtime: float) -> CityRuntime:
        loaded = load_model_with_metadata(str(model_path))
        if not loaded or "state_dict" not in loaded:
            raise RuntimeError("Failed to load model checkpoint")

        metadata = loaded.get("metadata", {})
        scaler = metadata.get("scaler")
        nodes_order = metadata.get("nodes_order")
        time_steps = int(metadata.get("time_steps", 12))
        sigma = float(metadata.get("sigma", 0.5))
        tz_name = metadata.get("timezone")

        if scaler is None or not nodes_order:
            raise RuntimeError("Corrupted model metadata (missing scaler/nodes_order)")

        nodes_order = [int(x) for x in nodes_order]

        device = self._get_device()

        # Stops table
        all_stops = get_all_stops_in_city(city_id)
        if all_stops.empty:
            raise RuntimeError("Stops table is empty")

        all_stops["stop_id"] = all_stops["stop_id"].astype(int)

        stops_lookup: dict[int, dict] = {}
        for _, row in all_stops.drop_duplicates(subset=["stop_id"]).iterrows():
            sid = int(row["stop_id"])
            stops_lookup[sid] = {
                "address": row.get("address", f"Unknown_{sid}"),
                "lat": float(row.get("lat", 0.0)) if pd.notna(row.get("lat")) else 0.0,
                "lng": float(row.get("lng", 0.0)) if pd.notna(row.get("lng")) else 0.0,
                "url": row.get("url", "") or ""
            }

        coords = []
        for sid in nodes_order:
            info = stops_lookup.get(sid, {"lat": 0.0, "lng": 0.0})
            coords.append([info["lat"], info["lng"]])
        coords = np.array(coords, dtype=np.float32)

        # timezone
        if not tz_name:
            center_lat = float(np.mean(coords[:, 0]))
            center_lng = float(np.mean(coords[:, 1]))
            tz_name = resolve_timezone(lat=center_lat, lng=center_lng)

        # cameras by url
        camera_stop_ids = set()
        for sid in nodes_order:
            url = stops_lookup.get(sid, {}).get("url", "")
            if isinstance(url, str) and url.strip():
                camera_stop_ids.add(sid)

        # graph + normalize once
        adj = GraphBuilder(sigma=sigma).build_from_coordinates(coords, device=device)
        adj_norm = normalize_adj(adj)

        # model
        model = build_model(num_nodes=len(nodes_order), in_channels=7, horizon=horizon).to(device)

        with MODEL_LOCK:
            model.load_state_dict(loaded["state_dict"])
            model.eval()

        # warmup once
        if device.type == "cuda":
            with torch.inference_mode():
                dummy = torch.zeros(1, time_steps, 7, len(nodes_order), device=device)
                _ = model(dummy, adj_norm)
            torch.cuda.synchronize()

        return CityRuntime(
            city_id=city_id,
            model=model,
            adj_norm=adj_norm,
            scaler=scaler,
            nodes_order=nodes_order,
            coords=coords,
            stops_lookup=stops_lookup,
            camera_stop_ids=camera_stop_ids,
            timezone=tz_name,
            time_steps=time_steps,
            sigma=sigma,
            horizon=horizon,
            device=device,
            model_mtime=mtime
        )