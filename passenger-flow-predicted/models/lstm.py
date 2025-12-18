import torch.nn as nn

class TemporalLSTM(nn.Module):
    def __init__(self, num_nodes, hidden=64):
        super().__init__()
        self.lstm = nn.LSTM(num_nodes, hidden, batch_first=True)
        self.fc = nn.Linear(hidden, num_nodes)

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.fc(out[:, -1])