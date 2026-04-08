import numpy as np
import torch
from typing import Dict, List, Union

def calculate_metrics(
    predictions: Union[np.ndarray, torch.Tensor],
    targets: Union[np.ndarray, torch.Tensor],
    scaler=None
) -> Dict[str, float]:
    """
    Рассчитывает метрики качества прогноза.
    
    Если передан scaler — денормализует значения перед расчётом.
    """
    # Конвертируем в numpy и денормализуем если нужно
    if torch.is_tensor(predictions):
        predictions = predictions.detach().cpu().numpy()
    if torch.is_tensor(targets):
        targets = targets.detach().cpu().numpy()
    
    predictions = np.asarray(predictions).ravel()
    targets = np.asarray(targets).ravel()

    if scaler is not None:
        # Денормализация через dummy-массив
        n_total = predictions.size  # ⚡ Общее число элементов (не len()!)
        n_features = scaler.n_features_in_
        
        # Создаём dummy-массивы правильной формы
        pred_dummy = np.zeros((n_total, n_features))
        target_dummy = np.zeros((n_total, n_features))
        
        # Записываем в первый признак (count)
        pred_dummy[:, 0] = predictions  # predictions уже плоский
        target_dummy[:, 0] = targets
        
        # Инвертируем и берём только count
        predictions = scaler.inverse_transform(pred_dummy)[:, 0]
        targets = scaler.inverse_transform(target_dummy)[:, 0]
    
    # Считаем метрики
    mask = targets != 0
    
    mae = np.mean(np.abs(predictions - targets))
    rmse = np.sqrt(np.mean((predictions - targets) ** 2))
    mape = np.mean(np.abs((targets[mask] - predictions[mask]) / targets[mask])) * 100 if mask.any() else 0.0
    mbe = np.mean(predictions - targets)
    
    # Защита от деления на ноль в R²
    ss_tot = np.sum((targets - np.mean(targets)) ** 2)
    ss_res = np.sum((targets - predictions) ** 2)
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
    
    return {
        'mae': round(float(mae), 3),
        'rmse': round(float(rmse), 3),
        'mape_percent': round(float(mape), 2),
        'mbe': round(float(mbe), 3),
        'r2': round(float(r2), 4),
        'samples': len(predictions)
    }