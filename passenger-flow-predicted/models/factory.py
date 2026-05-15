from models.stgcn import STGCN
from models.lstm import TemporalLSTM
from models.hybrid import STGCN_LSTM

def build_model(num_nodes: int, in_channels: int = 7, horizon: int = 12):
    """
    Собирает гибридную модель STGCN + LSTM
    """
    return STGCN_LSTM(
        STGCN(num_nodes=num_nodes, in_channels=in_channels),
        num_nodes=num_nodes,
        hidden=128,
        horizon=horizon
    )
