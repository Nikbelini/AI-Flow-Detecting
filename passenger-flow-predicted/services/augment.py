import torch
import numpy as np
from typing import Tuple, Optional, Union


def augment_batch(
    X: torch.Tensor, 
    y: torch.Tensor, 
    noise_std: float = 0.02,
    mixup_prob: float = 0.3,
    mixup_alpha: float = 0.2,
    time_shift_prob: float = 0.2,
    max_shift: int = 2,
    feature_dropout_prob: float = 0.05,
    input_format: str = "BFNT"  # "BFNT"=[B,F,N,T] или "BTNF"=[B,T,N,F]
) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    Универсальная аугментация для spatio-temporal данных.
    
    Форматы:
    - "BFNT": [Batch, Features, Nodes, Time] — для ST-GCN с Conv2d
    - "BTNF": [Batch, Time, Nodes, Features] — для PyTorch Geometric / DGL
    
    Args:
        X: входной тензор
        y: целевой тензор
        noise_std: стандартное отклонение гауссова шума
        mixup_prob: вероятность применения mixup
        mixup_alpha: параметр бета-распределения для mixup
        time_shift_prob: вероятность временного сдвига
        max_shift: максимальный сдвиг по времени (в шагах)
        feature_dropout_prob: вероятность отключения признака
        input_format: формат входного тензора
    
    Returns:
        X_aug, y_aug — аугментированные тензоры в том же формате
    """
    if X.dim() != 4:
        # Для 3D тензоров [B, N, T] или [B, T, N] — только шум и сдвиг
        return _augment_simple(X, y, noise_std, time_shift_prob, max_shift)
    
    device = X.device
    B = X.shape[0]
    
    # Определяем индекс временного измерения
    if input_format == "BFNT":
        # [B, F, N, T] — время на последнем месте
        time_dim = 3
        feature_dim = 1
    elif input_format == "BTNF":
        # [B, T, N, F] — время на втором месте
        time_dim = 1
        feature_dim = 3
    else:
        # Пытаемся угадать по размерам: время обычно 12-24, фичи 1-10
        if X.shape[1] <= 10 and X.shape[3] >= 10:
            input_format = "BFNT"
            time_dim = 3
            feature_dim = 1
        else:
            input_format = "BTNF"
            time_dim = 1
            feature_dim = 3
    
    # === 1. Гауссов шум (только на ненулевых) ===
    mask_nonzero = X.abs() > 1e-6
    noise = torch.randn_like(X) * noise_std
    X_aug = X + noise * mask_nonzero.float()
    
    # === 2. Временной сдвиг (roll по time_dim) ===
    if torch.rand(1).item() < time_shift_prob and max_shift > 0:
        shift = np.random.randint(-max_shift, max_shift + 1)
        if shift != 0:
            X_aug = torch.roll(X_aug, shifts=shift, dims=time_dim)
            # y сдвигаем, если у него есть временное измерение той же длины
            if y.dim() >= 2 and y.shape[-1] == X.shape[time_dim]:
                y = torch.roll(y, shifts=shift, dims=-1)
    
    # === 3. Mixup (интерполяция между парами) ===
    if torch.rand(1).item() < mixup_prob and mixup_alpha > 0:
        lam = np.random.beta(mixup_alpha, mixup_alpha)
        index = torch.randperm(B, device=device)
        X_aug = lam * X_aug + (1 - lam) * X_aug[index]
        if y.dim() >= 2:
            y = lam * y + (1 - lam) * y[index]
    
    # === 4. Feature dropout (отключаем целые признаки) ===
    if torch.rand(1).item() < 0.15 and feature_dropout_prob > 0:
        # Создаём маску [B, F, 1, 1] или [B, 1, 1, F]
        if input_format == "BFNT":
            mask = torch.rand(B, X.shape[feature_dim], 1, 1, device=device) > feature_dropout_prob
        else:
            mask = torch.rand(B, 1, 1, X.shape[feature_dim], device=device) > feature_dropout_prob
        X_aug = X_aug * mask.float()
    
    return X_aug, y


def _augment_simple(
    X: torch.Tensor, 
    y: torch.Tensor,
    noise_std: float = 0.02,
    time_shift_prob: float = 0.2,
    max_shift: int = 2
) -> Tuple[torch.Tensor, torch.Tensor]:
    """Упрощённая аугментация для 3D тензоров [B, N, T]"""
    if X.dim() != 3:
        return X, y
    
    device = X.device
    B, N, T = X.shape
    
    # Шум
    mask = X.abs() > 1e-6
    X_aug = X + torch.randn_like(X) * noise_std * mask.float()
    
    # Сдвиг по времени (последнее измерение)
    if torch.rand(1).item() < time_shift_prob and max_shift > 0:
        shift = np.random.randint(-max_shift, max_shift + 1)
        if shift != 0:
            X_aug = torch.roll(X_aug, shifts=shift, dims=-1)
            if y.dim() == 3 and y.shape[-1] == T:
                y = torch.roll(y, shifts=shift, dims=-1)
    
    return X_aug, y


def augment_graph(
    adj: torch.Tensor, 
    drop_prob: float = 0.03, 
    apply_prob: float = 0.3,
    preserve_diagonal: bool = True
) -> torch.Tensor:
    """
    Аугментация графа: случайное ослабление слабых рёбер.
    Работает с любой размерностью [N, N] или [B, N, N].
    """
    if torch.rand(1).item() > apply_prob:
        return adj
    
    # Сохраняем исходную форму
    original_shape = adj.shape
    adj_flat = adj.reshape(-1, original_shape[-2], original_shape[-1]) if adj.dim() > 2 else adj.unsqueeze(0)
    
    results = []
    for a in adj_flat:
        # Не трогаем диагональ и сильные связи
        mask = torch.rand_like(a) > drop_prob
        if preserve_diagonal:
            mask = mask | torch.eye(a.size(0), device=a.device, dtype=torch.bool)
        mask = mask | (a > 0.5)
        a_aug = a * mask.float()
        results.append(a_aug)
    
    result = torch.stack(results) if len(results) > 1 else results[0].unsqueeze(0)
    return result.reshape(original_shape) if len(original_shape) > 2 else result.squeeze(0)