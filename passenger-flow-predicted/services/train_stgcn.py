import torch
import torch.nn as nn

from database.db import load_stop_history
from services.graph_builder import GraphBuilder
from database.dataset_builder import build_sequences
from services.model_io import save_model_atomic
from models.factory import build_model

# ============================
# TRAINING
# ============================
def train(city_id: int):
    df = load_stop_history(city_id)

    X, y, nodes = build_sequences(df)
    coords = df[['lat','lng']].drop_duplicates().values
    adj = GraphBuilder().build_from_coordinates(coords)

    model = build_model(len(nodes))

    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    loss_fn = nn.MSELoss()

    for epoch in range(50):
        pred = model(X, adj)
        loss = loss_fn(pred, y.squeeze(1))

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        print(f"[city {city_id}] epoch={epoch} loss={loss.item():.4f}")

    save_model_atomic(model, f"result/models/city_{city_id}.pt")