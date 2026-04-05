import os
import torch
import numpy as np
import logging
from typing import Dict, List
from datetime import datetime

from database.db import load_stop_history
from services.graph_builder import GraphBuilder
from database.dataset_builder import build_sequences
from models.factory import build_model
from services.data_guard import has_enough_data, split_camera_blind
from services.data_preprocessor import DataPreprocessor
from services.model_io import load_model_with_metadata
from services.locks import MODEL_LOCK

logger = logging.getLogger(__name__)

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
        raw_forecast = stop.get("forecast", [])
        if raw_forecast and raw_forecast[0] is not None:

            predicted_count = int(round(raw_forecast[0]))
            full_forecast = [int(round(v)) for v in raw_forecast]
        else:
            predicted_count = None
            full_forecast = []
        
        predictions_list.append({
            "address": stop["address"],
            "lat": stop["lat"],
            "lng": stop["lng"],
            "has_camera": False,
            "predicted_count": predicted_count,
            "predicted_velocity": None,
            "predicted_load": None,
            "forecast_horizon": len(full_forecast),
            "full_forecast": full_forecast
        })
    
    return {
        "city_id": city_id,
        "timestamp": datetime.now().isoformat(),
        "predictions": predictions_list,  # ← Этот список возвращаем в /forecast
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
    nodes = metadata.get('nodes', [])
    
    if not scaler or not nodes:
        return {"status": "ERROR", "message": "Model metadata corrupted"}
    
    # Нормализация + последовательности
    df_norm, _ = DataPreprocessor.normalize(df, scaler=scaler)
    X_seq, _, all_nodes = build_sequences(df_norm, time_steps=12)
    
    # Граф
    coords = df[['lat', 'lng']].drop_duplicates().values
    adj = GraphBuilder(sigma=0.5).build_from_coordinates(coords)
    
    # Модель
    model = build_model(len(nodes))
    with MODEL_LOCK:
        model.load_state_dict(loaded['state_dict'])
        model.eval()
    
    # Прогноз
    input_seq = X_seq[-1:].clone()
    predictions = []
    
    with torch.no_grad():
        for _ in range(horizon):
            pred = model(input_seq, adj)
            predictions.append(pred.squeeze(0).cpu().numpy())
            input_seq = torch.cat([input_seq[:, 1:], pred.unsqueeze(1)], dim=1)
    
    # Формирование ответа
    node_info = df[['address', 'lat', 'lng', 'has_camera']].drop_duplicates().set_index('address')
    
    # сколько всего узлов и сколько из них слепых
    total_nodes = len(all_nodes)
    blind_nodes = 0
    
    stops_result = []
    for i, node in enumerate(all_nodes):
        if i >= len(predictions[0]):
            continue
            
        raw_preds = [pred[i] for pred in predictions]
        denorm_preds = DataPreprocessor.denormalize_count(np.array(raw_preds), scaler).tolist()
        
        info = node_info.loc[node] if node in node_info.index else None
        has_cam = bool(info['has_camera']) if info is not None and 'has_camera' in info else False
        
        if not has_cam:
            blind_nodes += 1
            
        # если blind_only=True — пропускаем камеры
        if blind_only and has_cam:
            logger.debug(f"Skipping camera stop: {node}")
            continue
        
        stops_result.append({
            'address': node,
            'lat': float(info['lat']) if info is not None else 0.0,
            'lng': float(info['lng']) if info is not None else 0.0,
            'has_camera': has_cam,
            'forecast': [round(p, 2) for p in denorm_preds]
        })
    
    logger.info(f"Processed {total_nodes} nodes: {blind_nodes} blind, {total_nodes - blind_nodes} with cameras")
    logger.info(f"Returning {len(stops_result)} stops (blind_only={blind_only})")
    
    return {
        "status": "success",
        "city_id": city_id,
        "horizon": horizon,
        "timestamp": datetime.now().isoformat(),
        "stops": stops_result,
        "metadata": {
            "total_returned": len(stops_result),
            "blind_only": blind_only,
            "total_nodes": total_nodes,
            "blind_nodes": blind_nodes
        }
    }