import torch
import torch.nn as nn

class STGCN(nn.Module):
    def __init__(self, num_nodes, in_channels=1, hidden=64):
        super().__init__()

        self.temporal1 = nn.Conv2d(in_channels, hidden, (1,3), padding=(0,1))
        self.temporal2 = nn.Conv2d(hidden, hidden, (1,3), padding=(0,1))
        self.relu = nn.ReLU()

    def forward(self, x, adj):
        # x: [B, C, T, N]
        x = self.relu(self.temporal1(x))
        x = torch.einsum("bctn,nm->bctm", x, adj)
        x = self.relu(self.temporal2(x))
        return x