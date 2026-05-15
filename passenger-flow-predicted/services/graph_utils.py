import torch


def normalize_adj(adj: torch.Tensor) -> torch.Tensor:
    """
    adj: [N,N]
    return: normalized [N,N]
    """
    D = torch.sum(adj, dim=1)
    D_inv_sqrt = torch.pow(D, -0.5)
    D_inv_sqrt[torch.isinf(D_inv_sqrt)] = 0.0
    D_mat = torch.diag(D_inv_sqrt)
    return D_mat @ adj @ D_mat