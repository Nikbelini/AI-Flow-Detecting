import os
import torch

from database.db import load_stop_history
from services.graph_builder import GraphBuilder
from database.dataset_builder import build_sequences
from models.stgcn import STGCN
from models.lstm import TemporalLSTM
from models.hybrid import STGCN_LSTM
from services.data_guard import has_enough_data

from services.locks import MODEL_LOCK

def forecast_city(city_id: int, horizon: int):
    df = load_stop_history(city_id)

    if not has_enough_data(df):
        return {
            "status": "NOT_READY",
            "message": "Not enough data yet"
        }

    X, _, nodes = build_sequences(df)

    coords = df[['lat', 'lng']].drop_duplicates().values
    adj = GraphBuilder().build_from_coordinates(coords)

    num_nodes = len(nodes)

    model = STGCN_LSTM(
        STGCN(num_nodes),
        TemporalLSTM(num_nodes)
    )

    model_path = f"result/models/city_{city_id}.pt"
    if not os.path.exists(model_path):
        return {
            "status": "NOT_TRAINED",
            "message": "Model not trained yet"
        }

    with MODEL_LOCK:
        model.load_state_dict(
            torch.load(f"result/models/city_{city_id}.pt", map_location="cpu")
        )
        model.eval()

    seq = X[-1:].clone()
    seq = seq.unsqueeze(1)

    preds = []
    for _ in range(horizon):
        with torch.no_grad():
            out = model(seq, adj)

        preds.append(out.tolist())
        seq = torch.cat([seq[:,1:], out.unsqueeze(1)], dim=1)

    return {"city_id": city_id, "forecast": preds}
