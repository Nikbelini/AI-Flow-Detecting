import torch

def masked_loss(pred: torch.Tensor, target: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
    """
    pred:   [B, N]
    target: [B, N]
    mask:   [N] (1 camera, 0 blind)
    """
    mask = mask.to(pred.device).unsqueeze(0) # [1, N]
    loss = ((pred - target) ** 2) * mask
    return loss.sum() / (mask.sum() + 1e-6)