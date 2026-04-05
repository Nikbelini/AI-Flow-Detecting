import torch.nn as nn

class TemporalLSTM(nn.Module):
    def __init__(self, num_nodes, hidden=64):
        super().__init__()
        # input_size должен быть равен num_nodes, так как STGCN выдаёт [B, T, N]
        self.lstm = nn.LSTM(input_size=num_nodes, hidden_size=hidden, batch_first=True)
        self.fc = nn.Linear(hidden, num_nodes)

    def forward(self, x):
        # x: [B, T, N]
        out, _ = self.lstm(x)       # out: [B, T, hidden]
        return self.fc(out[:, -1])