from models.stgcn import STGCN
from models.lstm import TemporalLSTM
from models.hybrid import STGCN_LSTM

def build_model(num_nodes: int, in_channels: int = 5):
    return STGCN_LSTM(
        STGCN(num_nodes=num_nodes, in_channels=in_channels),
        TemporalLSTM(num_nodes)
    )
