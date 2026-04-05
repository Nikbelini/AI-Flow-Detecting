import os
from fastapi import FastAPI, HTTPException, Depends, Header, BackgroundTasks
from typing import Dict, Optional
from datetime import datetime

from domain.schemas import ForecastRequest, TrainingRequest, TrainingJobResponse
from inference.forecast import forecast_city_blind_stops
from services.train_stgcn import train
from services.data_guard import has_enough_data
from database.db import load_stop_history

from services.metrics import calculate_metrics
from services.data_preprocessor import DataPreprocessor
import torch
import numpy as np
import pandas as pd
from torch.utils.data import TensorDataset, DataLoader


app = FastAPI(
    title="passenger-flow-predicted",
    description="Microservice for predicting passenger flow at stops WITHOUT cameras",
    version="1.0.0",
)

# In-memory хранилище задач (простое, без singleton)
training_jobs: Dict[str, Dict] = {}


# ===== ENDPOINTS =====

@app.get("/health")
def health():
    return {"status": "UP", "service": "passenger-flow-predicted"}

@app.get("/ml/status")
def ml_status(city_id: int = 1):
    """Проверка: есть ли данные и обученная модель"""
    df = load_stop_history(city_id)
    camera_count = df[df['has_camera'] == True]['address'].nunique()
    blind_count = df[df['has_camera'] == False]['address'].nunique()
    
    return {
        "city_id": city_id,
        "data_points": df['datetime'].nunique() if not df.empty else 0,
        "stops_with_cameras": int(camera_count),
        "stops_without_cameras": int(blind_count),
        "has_enough_data": has_enough_data(df),
        "model_trained": os.path.exists(f"result/models/city_{city_id}.pt"),
        "model_path": f"result/models/city_{city_id}.pt"
    }

@app.post("/ml/train", status_code=202)
def train_manual(req: TrainingRequest, background_tasks: BackgroundTasks):
    """
    РУЧНОЙ ЗАПУСК ОБУЧЕНИЯ
    Выполняется асинхронно, возвращает job_id для отслеживания.
    """
    if req.city_id <= 0:
        raise HTTPException(400, "city_id must be positive")
    
    job_id = f"{req.city_id}_{datetime.now().timestamp()}"
    training_jobs[job_id] = {
        "job_id": job_id,
        "city_id": req.city_id,
        "status": "queued",
        "created_at": datetime.now().isoformat()
    }
    
    # Запускаем обучение в фоне (не блокируем ответ)
    background_tasks.add_task(_run_training_task, req.city_id, job_id, req.force_retrain)
    
    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Training started in background",
        "city_id": req.city_id
    }

def _run_training_task(city_id: int, job_id: str, force_retrain: bool):
    """Внутренняя задача обучения"""
    import sys
    print(f"!!! [TASK START] job={job_id}, city={city_id} !!!", flush=True, file=sys.stderr)

    try:
        training_jobs[job_id]["status"] = "running"
        training_jobs[job_id]["updated_at"] = datetime.now().isoformat()
        
        result = train(city_id, force_retrain=force_retrain)
        
        training_jobs[job_id].update({
            "status": "success" if result["status"] == "SUCCESS" else "failed",
            "result": result,
            "updated_at": datetime.now().isoformat()
        })
    except Exception as e:
        training_jobs[job_id].update({
            "status": "failed",
            "error": str(e),
            "updated_at": datetime.now().isoformat()
        })

@app.post("/debug/train")
def debug_train(city_id: int = 1, force: bool = False):
    """
    🔧 Синхронное обучение для отладки.
    Блокирует запрос, но показывает ВСЕ ошибки.
    """
    import sys
    print(f"!!! [DEBUG TRAIN] Starting sync train for city {city_id} !!!", flush=True, file=sys.stderr)
    
    try:
        from services.train_stgcn import train
        result = train(city_id, force_retrain=force)
        
        print(f"!!! [DEBUG TRAIN] Result: {result} !!!", flush=True, file=sys.stderr)
        return result
        
    except Exception as e:
        import traceback
        print(f"!!! [DEBUG TRAIN] CRASH: {e} !!!", flush=True, file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return {"error": str(e), "traceback": traceback.format_exc()}

@app.get("/ml/train/{job_id}")
def get_training_status(job_id: str):
    """Получить статус задачи обучения"""
    job = training_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job

@app.post("/forecast")
def forecast(req: ForecastRequest):
    """
    Возвращает прогноз для ВСЕХ остановок, 
    чтобы проверить работу модели.
    """
    result = forecast_city_blind_stops(req.city_id, req.horizon)
    
    if result.get("status") in ["NOT_READY", "NOT_TRAINED", "ERROR"]:
        status_code = 409 if result["status"] == "NOT_READY" else 503
        raise HTTPException(status_code=status_code, detail=result.get("message"))
    
    return result.get("predictions", [])

@app.post("/ml/test")
def test_model(city_id: int = 1, batch_size: int = 16):
    """
    Запускает модель на тестовых данных и возвращает метрики.
    
    Возвращает MAE, RMSE, MAPE для оценки качества прогноза.
    """
    from database.db import load_stop_history
    from services.data_guard import has_enough_data, split_camera_blind
    from database.dataset_builder import build_sequences
    from services.graph_builder import GraphBuilder
    from models.factory import build_model
    from services.model_io import load_model_with_metadata
    from services.locks import MODEL_LOCK
    
    # Загрузка данных
    df = load_stop_history(city_id)
    if not has_enough_data(df):
        raise HTTPException(400, "Not enough data for testing")
    
    camera_df, _ = split_camera_blind(df)
    if camera_df.empty:
        raise HTTPException(400, "No camera stops for testing")
    
    # Нормализация
    camera_df_norm, scaler = DataPreprocessor.normalize(camera_df)
    
    # Последовательности
    X_seq, y_seq, nodes = build_sequences(camera_df_norm, time_steps=12)
    num_nodes = len(nodes)
    
    # Граф
    coords_df = camera_df_norm[['address', 'lat', 'lng']].drop_duplicates(subset=['address'])
    coords_list = []
    for node in nodes:
        row = coords_df[coords_df['address'] == node]
        if not row.empty and pd.notna(row.iloc[0]['lat']) and pd.notna(row.iloc[0]['lng']):
            coords_list.append([float(row.iloc[0]['lat']), float(row.iloc[0]['lng'])])
        else:
            coords_list.append([0.0, 0.0])
    
    adj = GraphBuilder(sigma=0.5).build_from_coordinates(coords_list)
    
    # Загрузка модели
    model_path = f"result/models/city_{city_id}.pt"
    if not os.path.exists(model_path):
        raise HTTPException(404, "Model not trained yet")
    
    loaded = load_model_with_metadata(model_path)
    if not loaded:
        raise HTTPException(500, "Failed to load model")
    
    model = build_model(num_nodes)
    with MODEL_LOCK:
        model.load_state_dict(loaded['state_dict'])
        model.eval()
    
    # Тестовый прогон (используем все данные как "тест" для простоты)
    dataset = TensorDataset(X_seq, y_seq)
    test_loader = DataLoader(dataset, batch_size=batch_size, shuffle=False)
    
    all_preds = []
    all_targets = []
    
    with torch.no_grad():
        for X_batch, y_batch in test_loader:
            pred = model(X_batch, adj)  # [B, N]
            all_preds.append(pred)
            all_targets.append(y_batch)
    
    predictions = torch.cat(all_preds, dim=0).numpy()  # [S, N]
    targets = torch.cat(all_targets, dim=0).numpy()    # [S, N]
    
    # Метрики по каждому узлу и в среднем
    node_metrics = {}
    all_maes = []
    
    for i, node in enumerate(nodes):
        node_preds = predictions[:, i]
        node_targets = targets[:, i]
        
        metrics = calculate_metrics(node_preds, node_targets, scaler)
        node_metrics[node] = metrics
        all_maes.append(metrics['mae'])
    
    # Агрегированные метрики
    avg_metrics = calculate_metrics(predictions.flatten(), targets.flatten(), scaler)
    
    return {
        "city_id": city_id,
        "nodes_tested": len(nodes),
        "samples": avg_metrics['samples'],
        "average_metrics": avg_metrics,
        "per_node_metrics": {
            "best_node": min(node_metrics.items(), key=lambda x: x[1]['mae']),
            "worst_node": max(node_metrics.items(), key=lambda x: x[1]['mae']),
            "median_mae": round(np.median(all_maes), 3)
        },
        "model_info": {
            "path": model_path,
            "best_val_loss": loaded.get('metadata', {}).get('best_val_loss'),
            "epochs": loaded.get('metadata', {}).get('epoch')
        }
    }