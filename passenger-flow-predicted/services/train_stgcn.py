import torch
import torch.nn as nn
from typing import Dict

from database.db import load_stop_history
from services.graph_builder import GraphBuilder
from database.dataset_builder import build_sequences
from services.model_io import save_model_atomic
from models.factory import build_model

# ===== TRAINING =====
def train(city_id: int) -> Dict:  # ← добавить -> Dict
    """ Обучение модели для города  """
    try:
        df = load_stop_history(city_id)

        X, y, nodes = build_sequences(df)
        coords = df[['lat','lng']].drop_duplicates().values
        adj = GraphBuilder().build_from_coordinates(coords)

        model = build_model(len(nodes))

        optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
        loss_fn = nn.MSELoss()

        best_loss = float('inf')
        epochs = 50

        for epoch in range(epochs):
            pred = model(X, adj)
            loss = loss_fn(pred, y.squeeze(1))

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            current_loss = loss.item()
            if current_loss < best_loss:
                best_loss = current_loss

            print(f"[city {city_id}] epoch={epoch} loss={current_loss:.4f}")

        save_model_atomic(model, f"result/models/city_{city_id}.pt")
        
        return {
            'status': 'SUCCESS',
            'best_val_loss': best_loss,
            'epochs_trained': epochs,
            'message': f'Training completed for city {city_id}'
        }
        
    except Exception as e:
        return {
            'status': 'FAILED',
            'best_val_loss': None,
            'epochs_trained': 0,
            'message': str(e)
        }