import torch
import torch.nn as nn
import torch.nn.functional as F


class TemporalConvBlock(nn.Module):
    """Temporal Convolutional Block."""
    def __init__(self, in_channels: int, out_channels: int, kernel_size: int = 3):
        super().__init__()
        self.conv = nn.Conv2d(
            in_channels,
            out_channels,
            kernel_size=(1, kernel_size),
            padding=(0, kernel_size // 2),
        )
        self.bn = nn.BatchNorm2d(out_channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [B, C, N, T]
        return F.relu(self.bn(self.conv(x)))


class SpatialGraphConv(nn.Module):
    """Graph Convolution with Chebyshev approximation (order k)."""
    def __init__(self, in_channels: int, out_channels: int, k: int = 3):
        super().__init__()
        self.k = k
        self.weight = nn.Parameter(torch.FloatTensor(k, in_channels, out_channels))
        self.bias   = nn.Parameter(torch.FloatTensor(out_channels))
        self.reset_parameters()

    def reset_parameters(self):
        nn.init.xavier_uniform_(self.weight)
        nn.init.zeros_(self.bias)

    def forward(self, x: torch.Tensor, adj: torch.Tensor) -> torch.Tensor:
        # x:   [B, C, N, T]
        # adj: [N, N]
        B, C, N, T = x.shape

        # Симметричная нормировка
        D = adj.sum(dim=1)
        D_inv_sqrt = D.pow(-0.5)
        D_inv_sqrt[D_inv_sqrt.isinf()] = 0.0
        D_mat = torch.diag(D_inv_sqrt)
        adj_norm = D_mat @ adj @ D_mat

        # Полиномы Чебышёва
        cheb = [x]
        if self.k > 1:
            cheb.append(torch.einsum("bcnt,nm->bcmt", x, adj_norm))
        for _ in range(2, self.k):
            nxt = 2.0 * torch.einsum("bcnt,nm->bcmt", cheb[-1], adj_norm) - cheb[-2]
            cheb.append(nxt)

        out = torch.zeros(B, self.weight.size(2), N, T, device=x.device)
        for i in range(self.k):
            out = out + torch.einsum("bcnt,co->bont", cheb[i], self.weight[i])

        return out + self.bias.view(1, -1, 1, 1)


class STConvBlock(nn.Module):
    """Spatio-Temporal Convolutional Block: Temporal → Spatial → Temporal."""
    def __init__(self, in_channels: int, spatial_channels: int, out_channels: int):
        super().__init__()
        self.temporal1 = TemporalConvBlock(in_channels, spatial_channels)
        self.spatial   = SpatialGraphConv(spatial_channels, spatial_channels, k=3)
        self.temporal2 = TemporalConvBlock(spatial_channels, out_channels)
        self.bn        = nn.BatchNorm2d(out_channels)
        self.residual  = (
            nn.Conv2d(in_channels, out_channels, kernel_size=1)
            if in_channels != out_channels
            else None
        )

    def forward(self, x: torch.Tensor, adj: torch.Tensor) -> torch.Tensor:
        # x: [B, C, N, T]
        res = x
        x = self.temporal1(x)
        x = self.spatial(x, adj)
        x = self.temporal2(x)
        x = self.bn(x)
        if self.residual is not None:
            res = self.residual(res)
        return F.relu(x + res)


class STGCN(nn.Module):
    """
    Spatio-Temporal Graph Convolutional Network.

    Принимает:
        x:   [B, T, C, N]  (из build_sequences / build_last_window)
        adj: [N, N]

    Возвращает:
        [B, T, N]

    Изменения vs. исходника:
    - final_projection: Linear(hidden*N, N) → Conv2d(hidden, 1, 1)
      Было 54М параметров при N=905 → стало ~64.
      Старый Linear переобучался и схлопывался к константе на инференсе.
    """

    def __init__(
        self,
        num_nodes: int,
        in_channels: int = 7,
        hidden_channels: int = 64,
        num_layers: int = 2,
    ):
        super().__init__()
        self.num_nodes       = num_nodes
        self.hidden_channels = hidden_channels

        channels = [in_channels] + [hidden_channels] * num_layers
        self.blocks = nn.ModuleList(
            STConvBlock(channels[i], hidden_channels, hidden_channels)
            for i in range(num_layers)
        )

        self.dropout = nn.Dropout(0.3)

        # поканальная проекция вместо гигантского Linear
        # Linear(hidden * N, N) при N=905, hidden=64 → 54М параметров.
        # Conv2d(hidden, 1, 1) → 64 параметра. Без переобучения, с обобщением.
        self.final_projection = nn.Conv2d(hidden_channels, 1, kernel_size=1)

    def forward(self, x: torch.Tensor, adj: torch.Tensor) -> torch.Tensor:
        # Приводим вход к [B, C, N, T]
        if x.dim() == 3:
            # [B, T, N] -> [B, 1, N, T]
            x = x.permute(0, 2, 1).unsqueeze(1)
        elif x.dim() == 4:
            # [B, T, C, N] -> [B, C, N, T]
            x = x.permute(0, 2, 3, 1)
        else:
            raise ValueError(f"STGCN: unsupported input shape {x.shape}")

        # ST-блоки
        for block in self.blocks:
            x = block(x, adj)
            x = self.dropout(x)

        # x: [B, C, N, T]
        x = self.final_projection(x)   # [B, 1, N, T]
        x = x.squeeze(1)               # [B, N, T]
        x = x.permute(0, 2, 1)        # [B, T, N]

        return x