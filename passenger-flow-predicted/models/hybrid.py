import torch.nn as nn

class STGCN_LSTM(nn.Module):
    def __init__(self, stgcn, lstm):
        super().__init__()
        self.stgcn = stgcn
        self.lstm = lstm

    def forward(self, x, adj):
        x = self.stgcn(x, adj)       # [B, C, T, N]
        x = x.mean(dim=1)            # [B, T, N]
        return self.lstm(x)