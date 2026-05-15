import torch
import torch.nn.functional as F
from typing import Optional


def masked_loss(
    pred: torch.Tensor,
    target: torch.Tensor,
    mask: torch.Tensor,
    time_weights: Optional[torch.Tensor] = None,
    nonzero_weight: float = 3.0,
    zero_weight: float = 0.4,
    blind_weight: float = 0.3,
    zero_thresh: float = 0.05,
    peak_boost: float = 1.5,
) -> torch.Tensor:
    """
    Взвешенный Huber loss с учётом камер, слепых узлов, нулей и времени суток.

    Поддерживает два формата выхода модели:
        pred / target: [B, N]    — одношаговый прогноз
        pred / target: [B, H, N] — многошаговый прогноз (STGCN_LSTM)

    mask: [N]  (1.0 = камера, 0.0 = слепой узел)

    time_weights: [B] — Tt/1.7 для каждого примера в батче

    Веса:
        nonzero_weight — активные камерные узлы (count > 0).
                         Самый важный сигнал — не занижать.
        zero_weight    — нулевые камерные узлы (count == 0, ночь).
                         НЕ ставить 0: иначе модель галлюцинирует людей ночью.
        blind_weight   — слепые узлы (нет камеры).
                         ВАЖНО: без этого слепые узлы получают нулевой градиент
                         и модель предсказывает для них константу (~среднее).
                         Ставим меньше cam-весов — данные ненадёжные,
                         но сигнал нужен чтобы граф работал.
        peak_boost     — доп. множитель для часов пик (tw > 0.7).
    """
    device = pred.device
    target = target.to(device, non_blocking=True)
    mask   = mask.to(device, non_blocking=True)

    if time_weights is not None:
        time_weights = time_weights.to(device, non_blocking=True)

    # Приводим mask к форме тензора
    if pred.dim() == 2:
        cam = mask.view(1, -1)           # [1, N]
    elif pred.dim() == 3:
        cam = mask.view(1, 1, -1)        # [1, 1, N]
    else:
        raise ValueError(f"masked_loss: unsupported pred shape {pred.shape}")

    cam_bool   = cam.bool()
    blind_bool = ~cam_bool

    # Маски таргетов
    nonzero_mask = (target.abs() > zero_thresh) & cam_bool   # активные камеры
    zero_mask    = (target.abs() <= zero_thresh) & cam_bool  # нулевые камеры
    blind_mask   = blind_bool                                 # все слепые узлы

    # Базовый Huber loss (поэлементно)
    loss_all = F.huber_loss(pred, target, reduction="none", delta=1.0)

    # Взвешивание по типу узла и таргета
    weighted = (
        loss_all * nonzero_mask.float() * nonzero_weight
        + loss_all * zero_mask.float()  * zero_weight
        + loss_all * blind_mask.float() * blind_weight
    )

    # Peak boost
    if time_weights is not None:
        # time_weights: [B] -> расширяем до формы weighted
        if weighted.dim() == 2:
            tw = time_weights.view(-1, 1)       # [B, 1]
        else:
            tw = time_weights.view(-1, 1, 1)    # [B, 1, 1]

        is_peak = (tw > 0.7).float()
        peak_factor = 1.0 + (peak_boost - 1.0) * is_peak
        weighted = weighted * peak_factor

    # Нормировка
    # Считаем «активные» позиции — все три категории
    n_total = (nonzero_mask | zero_mask | blind_mask).float().sum()

    if n_total.item() < 1:
        return torch.zeros([], device=device, requires_grad=True)

    return weighted.sum() / n_total