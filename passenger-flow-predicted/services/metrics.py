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
    
    if scaler is not None:
        # Денормализация через dummy-массив
        pred_dummy = np.zeros((len(predictions), scaler.n_features_in_))
        target_dummy = np.zeros((len(targets), scaler.n_features_in_))
        pred_dummy[:, 0] = predictions.flatten()
        target_dummy[:, 0] = targets.flatten()
        
        predictions = scaler.inverse_transform(pred_dummy)[:, 0]
        targets = scaler.inverse_transform(target_dummy)[:, 0]
    
    # Основные метрики
    predictions = np.array(predictions).flatten()
    targets = np.array(targets).flatten()
    
    # Убираем нулевые таргеты для MAPE
    mask = targets != 0
    
    mae = np.mean(np.abs(predictions - targets))
    rmse = np.sqrt(np.mean((predictions - targets) ** 2))
    mape = np.mean(np.abs((targets[mask] - predictions[mask]) / targets[mask])) * 100 if mask.any() else 0.0
    
    # Дополнительно
    mbe = np.mean(predictions - targets)  # Mean Bias Error
    r2 = 1 - np.sum((targets - predictions) ** 2) / np.sum((targets - np.mean(targets)) ** 2)
    
    return {
        'mae': round(float(mae), 3),
        'rmse': round(float(rmse), 3),
        'mape_percent': round(float(mape), 2),
        'mbe': round(float(mbe), 3),
        'r2': round(float(r2), 4),
        'samples': len(predictions)
    }