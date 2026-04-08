import logging
import os

import pandas as pd
from tqdm import tqdm
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader, random_split
from typing import Dict

from database.db import load_stop_history, get_all_stops_in_city
from database.dataset_builder import build_sequences
from services.model_io import save_model_atomic
from models.factory import build_model
from services.graph_builder import GraphBuilder
from services.data_guard import has_enough_data
from services.data_preprocessor import DataPreprocessor
from services.masked_loss import masked_loss


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

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

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Using device: {device}")

        sigma = 0.5
        adj_np = GraphBuilder(sigma=sigma).build_from_coordinates(coords)
        adj = adj_np.to(device)

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

        train_loader = DataLoader(
            train_ds, 
            batch_size=32, 
            shuffle=True, 
            num_workers=2,  # Параллельная загрузка
            pin_memory=torch.cuda.is_available() 
        )

        val_loader = DataLoader(
            val_ds, 
            batch_size=32,
            num_workers=2,
            pin_memory=torch.cuda.is_available()
        )

        # Модель
        model = build_model(num_nodes)

        optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-5)
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)
        
        # ===== 8. Training loop =====
        best_val_loss = float('inf')
        patience_counter = 0
        max_patience = 10
        epochs = 100
        
        for epoch in range(epochs):
            # Train
            model.train()
            train_loss = 0.0

            for i, (X_batch, y_batch) in enumerate(tqdm(train_loader, desc=f"City {city_id} Epoch {epoch+1}"), 1):
                # Батчи на GPU с асинхронной передачей
                X_batch = X_batch.to(device, non_blocking=True)
                y_batch = y_batch.to(device, non_blocking=True)

                optimizer.zero_grad()
                pred = model(X_batch, adj)
                
                loss = masked_loss(pred, y_batch, camera_mask)

                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
                train_loss += loss.item()
            
                # лог каждые 10 батчей
                if i % 10 == 0 or i == len(train_loader):
                    logger.info(f"[{city_id}] Epoch {epoch+1} Batch {i}/{len(train_loader)} loss={loss.item():.4f}")

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

                model_cpu = model.cpu()
                save_model_atomic(model_cpu, model_path, metadata={
                    "city_id": city_id,
                    "epoch": epoch + 1,
                    "best_val_loss": float(best_val_loss),
                    "nodes_order": nodes_order,
                    "camera_mask": camera_mask.cpu().tolist(),  # На CPU для сериализации
                    "scaler": scaler,
                    "time_steps": time_steps,
                    "sigma": sigma
                })

                # Возвращаем модель на GPU если нужно продолжать обучение
                model = model.to(device)

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