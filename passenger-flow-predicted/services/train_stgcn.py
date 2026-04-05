import logging
import os

import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader, random_split
from typing import Dict, Optional

from database.db import load_stop_history
from services.graph_builder import GraphBuilder
from database.dataset_builder import build_sequences
from services.model_io import save_model_atomic
from models.factory import build_model
from services.data_guard import has_enough_data, split_camera_blind
from services.data_preprocessor import DataPreprocessor


logger = logging.getLogger(__name__)

def train(city_id: int, force_retrain: bool = False) -> Dict:
    
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
        
        # ===== 2. Разделение: камеры / слепые зоны =====
        camera_df, blind_df = split_camera_blind(df)
        
        if camera_df.empty:
            return {
                'status': 'FAILED',
                'message': 'No stops with cameras found for training'
            }
        
        logger.info(f"Training: {camera_df['address'].nunique()} camera stops")
        logger.info(f"Predict: {blind_df['address'].nunique() if not blind_df.empty else 0} blind stops")
        
        # ===== 3. Нормализация =====
        camera_df_norm, scaler = DataPreprocessor.normalize(camera_df)
        
        # ===== 4. Последовательности =====
        X_seq, y_seq, nodes = build_sequences(camera_df_norm, time_steps=12)
        num_nodes = len(nodes)

        addr_to_coords = {}
        coords_source = camera_df[['address', 'lat', 'lng']].drop_duplicates(subset=['address'])
        
        for _, row in coords_source.iterrows():
            addr = row['address']
            lat, lng = row['lat'], row['lng']
            if pd.notna(lat) and pd.notna(lng):
                addr_to_coords[addr] = [float(lat), float(lng)]
            else:
                addr_to_coords[addr] = [0.0, 0.0]  # fallback
        
        # Строим coords_list СТРОГО в порядке nodes (из build_sequences)
        coords_list = []
        for node in nodes:
            coords = addr_to_coords.get(node)
            if coords is None:
                logger.warning(f"⚠️ Node '{node}' not found in coords, using [0,0]")
                coords_list.append([0.0, 0.0])
            else:
                coords_list.append(coords)
        
        # Валидация: размеры ДОЛЖНЫ совпадать
        assert len(coords_list) == num_nodes, \
            f"❌ Coords mismatch: {len(coords_list)} != {num_nodes}"
        
        # ===== 5. Граф (по ВСЕМ остановкам) =====
        adj = GraphBuilder(sigma=0.5).build_from_coordinates(coords_list)

        logger.info(f"Data shape: X={X_seq.shape}, y={y_seq.shape}")
        logger.info(f"Adj matrix shape: {adj.shape} (expected: [{num_nodes}, {num_nodes}])")
        
        # ===== 6. Split =====
        dataset = TensorDataset(X_seq, y_seq)
        total = len(dataset)

        if total < 10:
            return {'status': 'FAILED', 'message': 'Too few samples for train/val split'}
        
        train_size = int(0.7 * total)
        val_size = int(0.15 * total)
        test_size = total - train_size - val_size
        
        train_ds, val_ds, _ = random_split(
            dataset, [train_size, val_size, test_size],
            generator=torch.Generator().manual_seed(42)
        )
        
        train_loader = DataLoader(train_ds, batch_size=16, shuffle=True)
        val_loader = DataLoader(val_ds, batch_size=16)
        
        # ===== 7. Модель =====
        model = build_model(num_nodes)

        optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-5)
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)
        loss_fn = nn.MSELoss()
        
        # ===== 8. Training loop =====
        best_val_loss = float('inf')
        patience_counter = 0
        epochs = 100
        
        for epoch in range(epochs):
            # Train
            model.train()
            train_loss = 0.0

            for X_batch, y_batch in train_loader:
                optimizer.zero_grad()
                pred = model(X_batch, adj)
                loss = loss_fn(pred, y_batch)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
                train_loss += loss.item()
            
            # Validate
            model.eval()
            val_loss = 0
            with torch.no_grad():
                for X_batch, y_batch in val_loader:
                    pred = model(X_batch, adj)
                    val_loss += loss_fn(pred, y_batch).item()
            
            val_loss /= len(val_loader)
            scheduler.step(val_loss)
            
            logger.info(f"[{city_id}] ep={epoch+1} train={train_loss/len(train_loader):.4f} val={val_loss:.4f}")
            
            # Save best + early stop
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0
                save_model_atomic(model, model_path, metadata={
                    'city_id': city_id,
                    'best_val_loss': float(best_val_loss),
                    'epoch': epoch + 1,
                    'nodes': nodes,
                    'scaler': scaler,
                    'camera_stops': camera_df['address'].unique().tolist(),
                    'blind_stops': blind_df['address'].unique().tolist() if not blind_df.empty else [],
                    'config': {'time_steps': 12, 'hidden_channels': 64}
                })
            else:
                patience_counter += 1
                if patience_counter >= 10:
                    logger.info("Early stopping")
                    break
        
        return {
            'status': 'SUCCESS',
            'best_val_loss': float(best_val_loss),
            'epochs_trained': epoch + 1,
            'train_stops': len(camera_df['address'].unique()),
            'predict_stops': len(blind_df['address'].unique()) if not blind_df.empty else 0,
            'message': f'Training completed for city {city_id}'
        }
        
    except Exception as e:
        logger.exception(f"Training failed")
        return {'status': 'FAILED', 'message': str(e), 'error_type': type(e).__name__}