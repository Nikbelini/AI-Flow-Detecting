import torch

def masked_loss(pred: torch.Tensor, target: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
    """
    pred:   [B, N]
    target: [B, N]
    mask:   [N] (1 camera, 0 blind)
    """
    mask = mask.to(pred.device, non_blocking=False)
    
    loss = (pred - target) ** 2
    masked_loss = loss * mask.unsqueeze(0) if mask.dim() == 1 else loss * mask
    
    # Избегаем деления на ноль
    n = mask.sum().clamp(min=1.0)
    return masked_loss.sum() / n