import logging
import os
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader, random_split

import pandas as pd
import numpy as np
from tqdm import tqdm
from typing import Dict, Optional

from database.db import load_stop_history, get_all_stops_in_city
from database.dataset_builder import build_sequences
from services.model_io import save_model_atomic
from models.factory import build_model
from services.graph_builder import GraphBuilder
from services.data_guard import has_enough_data
from services.data_preprocessor import DataPreprocessor
from services.masked_loss import masked_loss
from services.metrics import calculate_metrics
from services.augment import augment_batch, augment_graph


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "result" / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)  # Создаём папку, если нет


def train(city_id: int, force_retrain: bool = False,
        augment: bool = True,  # ← флаг аугментации
        augment_config: Optional[Dict] = None) -> Dict:
    """
    Обучение: граф по всем остановкам, обучение на тех, где есть данные.
    """
    model_path = MODEL_DIR / f"city_{city_id}.pt"
    
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
        # если stops пуст ИЛИ нет колонки stop_id
        if all_stops.empty or "stop_id" not in all_stops.columns:
            if "stop_id" in df.columns and df["stop_id"].notna().any():
                all_stops = df[["stop_id", "address", "lat", "lng"]].drop_duplicates(subset=["stop_id"], keep="first")
            else:
                all_stops = df[["address", "lat", "lng"]].drop_duplicates(subset=["address", "lat", "lng"], keep="first")
                logger.warning("No stop_id available, using (address, lat, lng) as fallback")

        # nodes_order по stop_id
        if "stop_id" in all_stops.columns and all_stops["stop_id"].notna().any():
            nodes_order = sorted(all_stops["stop_id"].dropna().unique().tolist())
        else:
            # Крайний fallback: фейковые ID
            all_stops = all_stops.reset_index().rename(columns={"index": "stop_id"})
            nodes_order = sorted(all_stops["stop_id"].dropna().unique().tolist())
            logger.warning(f"Using fallback nodes_order with {len(nodes_order)} nodes")

        num_nodes = len(nodes_order)

        if num_nodes < 2:
            return {"status": "FAILED", "message": "Not enough stops for graph"}

        coords = (
            all_stops.drop_duplicates(subset=["stop_id"])  # убираем дубликаты
                .set_index("stop_id")
                .reindex(nodes_order)[["lat", "lng"]]
                .fillna(0.0)
                .values
             )

        device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        logger.info(f"Using device: {device}")

        sigma = 0.5
        adj = GraphBuilder(sigma=None, k_neighbors=7).build_from_coordinates(coords, device=device)

        # камеры = есть реальные записи count > 0
        camera_mask_raw = df[(df["count"] > 0) & (df["stop_id"].notna())]

        if not camera_mask_raw.empty:
            # Приводим к int для надёжного сравнения
            camera_stop_ids = set(camera_mask_raw["stop_id"].astype(int).unique().tolist())
        else:
            #  Фоллбэк: если нет данных с count>0, используем все узлы
            logger.warning("No camera data found (count>0), using all stops for scaler fit")
            camera_stop_ids = set(nodes_order)

         # camera mask по nodes_order
        camera_mask = torch.tensor(
            [1.0 if int(sid) in camera_stop_ids else 0.0 for sid in nodes_order],
            dtype=torch.float32,
            device=device
        )

        logger.info(f"camera_mask: total={len(camera_mask)}, cameras={camera_mask.sum().item()}, "
                   f"blind={(1-camera_mask).sum().item()}, %cam={camera_mask.sum()/len(camera_mask)*100:.1f}%")

        # scaler fit только на камерах
        df_fit = df[
            df["stop_id"].astype("Int64").isin(
                pd.Series(list(camera_stop_ids), dtype="Int64")
            )
        ].copy()

        if df_fit.empty:
            logger.warning("df_fit is empty after filtering, using full df for scaler fit")
            df_fit = df.copy()

        df_fit_norm, scaler = DataPreprocessor.normalize(df_fit, fit=True)

        # transform на всем df
        df_norm, _ = DataPreprocessor.normalize(df, scaler=scaler, fit=False)

        if 'count' in df_fit_norm.columns:
            logger.info(f"DEBUG: Normalized count stats:")
            logger.info(f"   fit data: min={df_fit_norm['count'].min():.4f}, max={df_fit_norm['count'].max():.4f}, std={df_fit_norm['count'].std():.4f}")

        if 'count' in df_norm.columns:
            logger.info(f"full data: min={df_norm['count'].min():.4f}, max={df_norm['count'].max():.4f}, std={df_norm['count'].std():.4f}")

        time_steps = 12
        X_seq, y_seq = build_sequences(df_norm, nodes_order, time_steps=time_steps)

        logger.info(f"DEBUG: Sequences stats:")
        logger.info(f"   X_seq: shape={X_seq.shape}, count_channel: min={X_seq[..., 0, :].min():.4f}, max={X_seq[..., 0, :].max():.4f}, std={X_seq[..., 0, :].std():.4f}")
        logger.info(f"   y_seq: shape={y_seq.shape}, min={y_seq.min():.4f}, max={y_seq.max():.4f}, std={y_seq.std():.4f}")

        if 'stop_id' in df.columns and df['stop_id'].notna().any():
            # Грубая эвристика: взять первые 100 последовательностей и посчитать std только по ненулевым
            nonzero_mask = y_seq != 0
            if nonzero_mask.any():
                nonzero_std = y_seq[nonzero_mask].std().item()
                nonzero_count = nonzero_mask.sum().item()
                logger.info(f"DEBUG: y_seq nonzero stats: std={nonzero_std:.4f}, count={nonzero_count}/{y_seq.numel()}")
            else:
                logger.warning("DEBUG: y_seq is ALL zeros!")

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

        use_pin_memory = torch.cuda.is_available() and os.name != "nt" 

        train_loader = DataLoader(
            train_ds, 
            batch_size=32, 
            shuffle=True, 
            num_workers=0 if os.name == "nt" else 2,
            pin_memory=use_pin_memory
        )

        val_loader = DataLoader(
            val_ds, 
            batch_size=32,
            num_workers=0 if os.name == "nt" else 2,
            pin_memory=use_pin_memory
        )

        # Модель
        model = build_model(num_nodes).to(device)

        # ===== Training loop =====
        best_val_loss = float('inf')
        best_val_mae = float('inf') 
        patience_counter = 0
        max_patience = 15
        epochs = 100

        # Принудительная синхронизация весов
        for p in model.parameters():
            p.data = p.data.to(device, non_blocking=False).contiguous()

        optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-5)
        
        # Проактивен (рису застрять на низких колебаниях для больших моделей и долгого обучения)
        # если модель "задумалась" на 2-3 эпохи, LR резко падает, и обучение может застрять в локальном минимуме.
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)

        # Реактивная (для маленьких датасетов, быстрой сходимости, резкие падения и ждёт ухудшения)
        # scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)
    
        # ===== Аугментация: конфиг =====
        aug_cfg = augment_config or {
            "noise_std": 0.02,
            "mixup_prob": 0.3,
            "mixup_alpha": 0.2,
            "time_shift_prob": 0.2,
            "max_shift": 2,
            "graph_drop_prob": 0.03,
            "graph_apply_prob": 0.3
        }

        test_X, test_y = next(iter(train_loader))
        test_X = test_X.to(device, non_blocking=False)
        logger.info(f"[DEBUG] Batch device: {test_X.device}, Model device: {next(model.parameters()).device}")
        
        for epoch in range(epochs):
            # Train
            model.train()
            train_loss = 0.0

            for i, (X_batch, y_batch) in enumerate(tqdm(train_loader, desc=f"City {city_id} Epoch {epoch+1}"), 1):
                # Батчи на GPU с асинхронной передачей
                X_batch = _safe_to_device(X_batch, device)
                y_batch = _safe_to_device(y_batch, device)

                # Проверка (можно убрать потом)
                if X_batch.device.type != 'cuda' and device.type == 'cuda':
                     raise RuntimeError(f"X_batch failed to move to GPU! Device: {X_batch.device}")

                # === АУГМЕНТАЦИЯ (только тренировка) ===
                if augment and model.training:
                    # Определяем формат автоматически по размерам
                    # [B, F, N, T] — если F <= 10 и T >= 10
                    # [B, T, N, F] — иначе
                    if X_batch.dim() == 4:
                        if X_batch.shape[1] <= 10 and X_batch.shape[3] >= 10:
                            fmt = "BFNT"  # ST-GCN формат
                        elif X_batch.shape[1] >= 10 and X_batch.shape[3] <= 10:
                            fmt = "BTNF"  # Альтернативный формат
                        else:
                            fmt = "auto"  # Пусть функция сама разберётся
                    else:
                        fmt = "auto"
                    
                    # Применяем аугментацию
                    X_batch, y_batch = augment_batch(
                        X_batch, y_batch,
                        input_format=fmt,
                        **{k: v for k, v in aug_cfg.items() 
                        if k in ["noise_std", "mixup_prob", "mixup_alpha", "time_shift_prob", "max_shift"]}
                    )
                    
                    # Опционально: аугментация графа
                    if torch.rand(1).item() < aug_cfg.get("graph_apply_prob", 0.3):
                        adj_aug = augment_graph(
                            adj, 
                            drop_prob=aug_cfg.get("graph_drop_prob", 0.03),
                            apply_prob=1.0  # уже проверили выше
                        )
                    else:
                        adj_aug = adj
                else:
                    # Без аугментации — используем оригинальный граф
                    adj_aug = adj

                optimizer.zero_grad()
                
                # Forward
                try:
                    pred = model(X_batch, adj_aug)
                except Exception as exception:
                    logger.error(f"Forward pass failed at batch {i}. X_dev: {X_batch.device}, Adj_dev: {adj.device}")
                    raise exception
                
                loss = masked_loss(pred, y_batch, camera_mask)

                loss.backward()

                if i % 20 == 0:
                    max_grad = 0.0
                    min_grad = float('inf')
                    for p in model.parameters():
                        if p.grad is not None:
                            g = p.grad.abs().max().item()
                            max_grad = max(max_grad, g)
                            min_grad = min(min_grad, g)
                    logger.info(f"[{city_id}] Grad range: min={min_grad:.2e}, max={max_grad:.2e}")

                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
                train_loss += loss.item()
            
                # лог каждые 10 батчей
                if i % 10 == 0 or i == len(train_loader):
                    logger.info(f"[{city_id}] Epoch {epoch+1} Batch {i}/{len(train_loader)} loss={loss.item():.4f}")

            # Validate
            train_loss /= len(train_loader)
            model.eval()

            val_losses = []
            val_metrics_list = [] # для агрегации метрик

            with torch.no_grad():
                for X_batch, y_batch in val_loader:

                    X_batch = _safe_to_device(X_batch, device)
                    y_batch = _safe_to_device(y_batch, device)

                    pred = model(X_batch, adj)

                    # Loss
                    val_losses.append(masked_loss(pred, y_batch, camera_mask).item())

                    metrics = calculate_metrics(
                        predictions=pred.cpu(), 
                        targets=y_batch.cpu(), 
                        scaler=scaler
                    )
                    val_metrics_list.append(metrics)
            
            # Агрегация
            val_loss = np.mean(val_losses)

            # Усредняем метрики по всем батчам
            val_mae = np.mean([m['mae'] for m in val_metrics_list])
            val_rmse = np.mean([m['rmse'] for m in val_metrics_list])
            val_mape = np.mean([m['mape_percent'] for m in val_metrics_list])

            if isinstance(scheduler, torch.optim.lr_scheduler.ReduceLROnPlateau):
                scheduler.step(val_loss)  # Нужна метрика
            else:
                scheduler.step()
            
            logger.info(f"[{city_id}] ep={epoch+1} "
                f"train={train_loss:.4f} val_loss={val_loss:.4f} "
                f"val_mae={val_mae:.3f} val_rmse={val_rmse:.3f} val_mape={val_mape:.2f}%"
            )

            # ===== EARLY STOPPING ПО НЕСКОЛЬКИМ МЕТРИКАМ =====
            # Пороги: игнорируем мелкий шум
            loss_improved = val_loss < best_val_loss - 1e-4
            mae_improved = val_mae < best_val_mae - 1e-2  # MAE в исходных единицах

            if loss_improved or mae_improved:
                best_val_loss = val_loss
                best_val_mae = val_mae
                patience_counter = 0

                model_cpu = model.cpu()
                save_model_atomic(model_cpu, model_path, metadata={
                    "city_id": city_id,
                    "epoch": epoch + 1,
                    "best_val_loss": float(best_val_loss),
                    "best_val_mae": float(best_val_mae),
                    "best_val_rmse": float(val_rmse),
                    "best_val_mape": float(val_mape),
                    "nodes_order": nodes_order,
                    "camera_mask": camera_mask.cpu().tolist(),  # На CPU для сериализации
                    "scaler": scaler,
                    "time_steps": time_steps,
                    "augment_used": augment,
                    "augment_config": aug_cfg if augment else None
                })
                logger.info(f"New best model saved at epoch {epoch+1}")

                # Возвращаем модель на GPU если нужно продолжать обучение
                model = model.to(device)

            else:
                patience_counter += 1
                if patience_counter >= max_patience:
                    logger.info(f"Early stopping: no improvement in {max_patience} epochs")
                    logger.info(f"   Best: loss={best_val_loss:.4f}, mae={best_val_mae:.3f}")
                    break
        
         # ===== ГАРАНТИРОВАННОЕ СОХРАНЕНИЕ В КОНЦЕ =====
        # Если early stopping сработал до первого сохранения или модель не сохранилась
        if not os.path.exists(str(model_path)):
            logger.warning("Model file not found after training. Saving final state...")
            model_cpu = model.cpu()
            save_model_atomic(model_cpu, model_path, metadata={
                "city_id": city_id,
                "epoch": epoch + 1,
                "best_val_loss": float(best_val_loss),
                "best_val_mae": float(best_val_mae),
                "nodes_order": nodes_order,
                "camera_mask": camera_mask.cpu().tolist(),
                "scaler": scaler,
                "time_steps": time_steps,
                "sigma": sigma,
                "augment_used": augment, "augment_config": aug_cfg if augment else None
            })

        return {
            "status": 'SUCCESS',
            "best_val_loss": float(best_val_loss),
            "best_val_mae": float(best_val_mae),
            "epochs_trained": epoch + 1,
            "num_nodes": num_nodes,
            "model_path": model_path,
            "augment_used": augment,
            "message": f'Training completed for city {city_id}'
        }
        
    except Exception as exception:
        logger.exception(f"Training failed")
        return {'status': 'FAILED', 'message': str(exception), 'error_type': type(exception).__name__}
    

def _safe_to_device(tensor, device):
    """Гарантированный перенос тензора на устройство"""
    if tensor.device != device:
        return tensor.to(device, non_blocking=False).contiguous()
    return tensor.contiguous()