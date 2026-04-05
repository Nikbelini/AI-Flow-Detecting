import torch
import torch.nn as nn
import torch.nn.functional as F

class TemporalConvBlock(nn.Module):
    """Temporal Convolutional Block with residual connection"""
    def __init__(self, in_channels, out_channels, kernel_size=3):
        super().__init__()
        self.conv = nn.Conv2d(
            in_channels, 
            out_channels, 
            kernel_size=(1, kernel_size),
            padding=(0, kernel_size // 2)
        )
        self.bn = nn.BatchNorm2d(out_channels)
        
    def forward(self, x):
        # x: [B, C, N, T]
        return F.relu(self.bn(self.conv(x)))


class SpatialGraphConv(nn.Module):
    """Graph Convolution Layer with Chebyshev approximation"""
    def __init__(self, in_channels, out_channels, k=3):
        super().__init__()
        self.k = k
        self.weight = nn.Parameter(torch.FloatTensor(k, in_channels, out_channels))
        self.bias = nn.Parameter(torch.FloatTensor(out_channels))
        self.reset_parameters()
        
    def reset_parameters(self):
        nn.init.xavier_uniform_(self.weight)
        nn.init.zeros_(self.bias)
        
    def forward(self, x, adj):
        # x: [B, C, N, T]
        # adj: [N, N]
        B, C, N, T = x.shape
        
        # Normalize adjacency matrix
        D = torch.sum(adj, dim=1)
        D_inv_sqrt = torch.pow(D, -0.5)
        D_inv_sqrt[torch.isinf(D_inv_sqrt)] = 0.0
        D_mat = torch.diag(D_inv_sqrt)
        adj_norm = D_mat @ adj @ D_mat
        
        # Compute Chebyshev polynomials
        cheb_polys = [x]  # T_0 = x
        if self.k > 1:
            cheb_polys.append(torch.einsum('bcnt,nm->bcmt', x, adj_norm))  # T_1
            
        for i in range(2, self.k):
            new_poly = 2 * torch.einsum('bcnt,nm->bcmt', cheb_polys[-1], adj_norm) - cheb_polys[-2]
            cheb_polys.append(new_poly)
        
        # Apply weights
        out = torch.zeros(B, self.weight.size(2), N, T, device=x.device)
        for i in range(self.k):
            # cheb_polys[i]: [B, C, N, T]
            # weight[i]: [C, out_C]
            out += torch.einsum('bcnt,co->bont', cheb_polys[i], self.weight[i])
        
        return out + self.bias.view(1, -1, 1, 1)


class STConvBlock(nn.Module):
    """Spatio-Temporal Convolutional Block"""
    def __init__(self, in_channels, spatial_channels, out_channels, num_nodes):
        super().__init__()
        self.temporal1 = TemporalConvBlock(in_channels, spatial_channels)
        self.spatial = SpatialGraphConv(spatial_channels, spatial_channels, k=3)
        self.temporal2 = TemporalConvBlock(spatial_channels, out_channels)
        self.bn = nn.BatchNorm2d(out_channels)
        
        # Residual connection
        self.residual = nn.Conv2d(in_channels, out_channels, kernel_size=1) if in_channels != out_channels else None
        
    def forward(self, x, adj):
        # x: [B, C, N, T]
        residual = x
        
        x = self.temporal1(x)  # [B, spatial_channels, N, T]
        x = self.spatial(x, adj)  # [B, spatial_channels, N, T]
        x = self.temporal2(x)  # [B, out_channels, N, T]
        x = self.bn(x)
        
        if self.residual is not None:
            residual = self.residual(residual)
            
        return F.relu(x + residual)


class STGCN(nn.Module):
    """Spatio-Temporal Graph Convolutional Network"""
    def __init__(self, num_nodes, in_channels=1, hidden_channels=64, num_layers=2):
        super().__init__()
        self.num_nodes = num_nodes
        
        self.blocks = nn.ModuleList()
        channels = [in_channels] + [hidden_channels] * num_layers
        
        for i in range(num_layers):
            self.blocks.append(
                STConvBlock(
                    channels[i], 
                    hidden_channels, 
                    hidden_channels,
                    num_nodes
                )
            )
        
        self.dropout = nn.Dropout(0.3)
        self.final_projection = nn.Linear(hidden_channels * num_nodes, num_nodes)
        
    def forward(self, x, adj):
        # x: [B,T,N] or [B,T,C,N]
        if x.dim() == 3:
            # [B,T,N] -> [B,1,N,T]
            x = x.transpose(1, 2).unsqueeze(1) # -> [B, 1, N, T]
        
        elif x.dim() == 4:
            # [B,T,C,N] -> [B,C,N,T]
            x = x.permute(0, 2, 3, 1)

        else:
            raise ValueError(f"Invalid input shape: {x.shape}")
        
        for block in self.blocks:
            x = block(x, adj)
            x = self.dropout(x)
            
        # x: [B, C, N, T]
        B, C, N, T = x.shape
        # Reshape to [B, T, C*N]
        x = x.permute(0, 3, 1, 2).reshape(B, T, C * N)
        # Project to [B, T, N]
        x = self.final_projection(x)
        
        return x