import torch.nn as nn

class STGCN_LSTM(nn.Module):
    def __init__(self, stgcn, lstm, dropout=0.2):
        super().__init__()
        self.stgcn = stgcn
        self.lstm = lstm
        self.dropout = nn.Dropout(dropout)

        self.norm = nn.LayerNorm(stgcn.out_channels if hasattr(stgcn, 'out_channels') else lstm.lstm.input_size)

    def forward(self, x, adj):
        x = self.stgcn(x, adj)       # [B, T, N]
        x = self.norm(x) if x.dim() == 3 else x
        x = self.dropout(x)
        return self.lstm(x)