from models.stgcn import STGCN
from models.lstm import TemporalLSTM
from models.hybrid import STGCN_LSTM

def build_model(num_nodes: int):
    return STGCN_LSTM(
        STGCN(num_nodes),
        TemporalLSTM(num_nodes)
    )
