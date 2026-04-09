import torch
import torch.nn.functional as F

def masked_loss(pred: torch.Tensor, target: torch.Tensor, 
                mask: torch.Tensor, nonzero_weight: float = 3.0,
                zero_thresh: float = 0.05) -> torch.Tensor:
    """
    pred:   [B, N]
    target: [B, N]
    mask:   [N] (1 camera, 0 blind)
    nonzero_weight: множитель для ненулевых таргетов,
                    чтобы модель не коллапсировала в предсказание нуля
    """
    mask = mask.to(pred.device, non_blocking=False)
    
    # 1. Маска ненулевых таргетов
    nonzero_target = (target.abs() > zero_thresh)
    
    # 2. Общая маска: камера И ненулевой таргет
    if mask.dim() == 1:
        cam = mask.unsqueeze(0)
        if pred.dim() == 3:
            cam = cam.unsqueeze(1)  # [1, 1, N] для [B, T, N]
    
    valid_mask = (nonzero_target & cam.bool()).float()
    
    # 3. Если валидных элементов нет -> возвращаем 0 (чтобы не ломать backward)
    n_valid = valid_mask.sum()
    if n_valid < 1:
        return torch.tensor(0.0, device=pred.device, requires_grad=True)
    
    # 4. Huber loss только на валидных
    loss = F.huber_loss(pred, target, reduction="none", delta=1.0)
    weighted_loss = loss * valid_mask * nonzero_weight
    
    return weighted_loss.sum() / n_valid