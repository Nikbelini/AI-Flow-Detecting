import logging
import os

import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader, random_split
from typing import Dict, Optional

from database.db import load_stop_history, get_all_stops_in_city
from services.graph_builder import GraphBuilder
from database.dataset_builder import build_sequences
from services.model_io import save_model_atomic
from models.factory import build_model
from services.data_guard import has_enough_data, split_training_data
from services.data_preprocessor import DataPreprocessor
from services.masked_loss import masked_loss


logger = logging.getLogger(__name__)

def train(city_id: int, force_retrain: bool = False) -> Dict:
    """
    Обучение: граф по всем остановкам, обучение на тех, где есть данные.
    """
    model_path = f"result/models/city_{city_id}.pt"
    
    # Если модель уже есть и не форсим — можно пропустить
    if os.path.exists(model_path) and not force_retrain:
        return {
            'status': 'SKIPPED',
            'message': 'Model already trained (use force_retrain=true to override)',
            'model_path': model_path
        }

    """ Обучение модели для города  """
    try:
        df = load_stop_history(city_id)

        if not has_enough_data(df, min_steps=32):
            return {
                'status': 'FAILED',
                'message': f'Not enough data: {df["datetime"].nunique() if not df.empty else 0}/32 timestamps'
            }
        
        # ===== Все остановки города для графа =====
        all_stops = get_all_stops_in_city(city_id)
        if all_stops.empty:
            # Fallback берём адреса из истории
            all_stops = df[['address', 'lat', 'lng']].drop_duplicates(subset=['address'])
        
        nodes_order = sorted(all_stops['address'].dropna().unique().tolist())
        num_nodes = len(nodes_order)

        if num_nodes < 2:
            return {"status": "FAILED", "message": "Not enough stops for graph"}

        coords = (
            all_stops.drop_duplicates(subset=["address"])  # убираем дубликаты
                .set_index("address")
                .reindex(nodes_order)[["lat", "lng"]]
                .fillna(0.0)
                .values
             )

        sigma = 0.5
        adj = GraphBuilder(sigma=sigma).build_from_coordinates(coords)

        # камеры = есть реальные записи count > 0
        camera_addresses = set(df[df["count"] > 0]["address"].unique().tolist())

        if len(camera_addresses) == 0:
            return {"status": "FAILED", "message": "No camera stops found"}

         # camera mask по nodes_order
        camera_mask = torch.tensor(
            [1.0 if addr in camera_addresses else 0.0 for addr in nodes_order],
            dtype=torch.float32
        )

        # scaler fit только на камерах
        df_fit = df[df["address"].isin(camera_addresses)].copy()
        df_fit_norm, scaler = DataPreprocessor.normalize(df_fit, fit=True)

        # transform на всем df
        df_norm, _ = DataPreprocessor.normalize(df, scaler=scaler, fit=False)

        time_steps = 12
        X_seq, y_seq = build_sequences(df_norm, nodes_order, time_steps=time_steps)

        dataset = TensorDataset(X_seq, y_seq)
        total = len(dataset)

        if total < 20:
            return {"status": "FAILED", "message": "Too few sequences"}

        train_size = int(0.7 * total)
        val_size = int(0.15 * total)
        test_size = total - train_size - val_size

        train_ds, val_ds, _ = random_split(
            dataset,
            [train_size, val_size, test_size],
            generator=torch.Generator().manual_seed(42)
        )

        train_loader = DataLoader(train_ds, batch_size=32, shuffle=True)
        val_loader = DataLoader(val_ds, batch_size=32)

        # Модель
        model = build_model(num_nodes)

        optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-5)
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)
        
        # ===== 8. Training loop =====
        best_val_loss = float('inf')
        patience_counter = 0
        max_patience = 10
        epochs = 1
        
        for epoch in range(epochs):
            # Train
            model.train()
            train_loss = 0.0

            for X_batch, y_batch in train_loader:
                optimizer.zero_grad()
                pred = model(X_batch, adj)
                
                loss = masked_loss(pred, y_batch, camera_mask)

                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
                train_loss += loss.item()
            
            # Validate
            train_loss /= len(train_loader)
            
            model.eval()
            val_loss = 0
            with torch.no_grad():
                for X_batch, y_batch in val_loader:
                    pred = model(X_batch, adj)
                    val_loss += masked_loss(pred, y_batch, camera_mask).item()
            
            val_loss /= len(val_loader)
            scheduler.step(val_loss)
            
            logger.info(f"[{city_id}] ep={epoch+1} train={train_loss:.4f} val={val_loss:.4f}")
            # Save best + early stop
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0

                save_model_atomic(model, model_path, metadata={
                    "city_id": city_id,
                    "epoch": epoch + 1,
                    "best_val_loss": float(best_val_loss),
                    "nodes_order": nodes_order,
                    "camera_mask": camera_mask.tolist(),
                    "scaler": scaler,
                    "time_steps": time_steps,
                    "sigma": sigma
                })

            else:
                patience_counter += 1
                if patience_counter >= max_patience:
                    logger.info("Early stopping")
                    break
        
        return {
            "status": 'SUCCESS',
            "best_val_loss": float(best_val_loss),
            "epochs_trained": epoch + 1,
            "epochs_trained": epoch + 1,
            "best_val_loss": float(best_val_loss),
            "num_nodes": num_nodes,
            "model_path": model_path,
            "message": f'Training completed for city {city_id}'
        }
        
    except Exception as exception:
        logger.exception(f"Training failed")
        return {'status': 'FAILED', 'message': str(exception), 'error_type': type(exception).__name__}