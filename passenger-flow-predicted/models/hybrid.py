import torch.nn as nn

class STGCN_LSTM(nn.Module):
    """Делает прогноз сразу на horizon шагов за один forward"""
    def __init__(self, stgcn, num_nodes: int, hidden: int = 128, horizon: int = 12, dropout=0.2):
        super().__init__()
        self.stgcn = stgcn
        self.num_nodes = num_nodes
        self.horizon = horizon

        self.norm = nn.LayerNorm(num_nodes)
        self.dropout = nn.Dropout(dropout)

        self.lstm = nn.LSTM(
            input_size=num_nodes,
            hidden_size=hidden,
            batch_first=True
        )

        self.fc = nn.Linear(hidden, horizon * num_nodes)

    def forward(self, x, adj_norm):
        x = self.stgcn(x, adj_norm)  # [B,T,N]
        x = self.norm(x)
        x = self.dropout(x)

        out, _ = self.lstm(x)        # [B,T,hidden]
        last = out[:, -1, :]         # [B,hidden]

        pred = self.fc(last)         # [B,H*N]
        pred = pred.view(pred.size(0), self.horizon, self.num_nodes)  # [B,H,N]
        return pred