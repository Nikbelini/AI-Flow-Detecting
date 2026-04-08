from typing import List, Tuple
import pandas as pd
import torch
import numpy as np

def build_sequences(
    df: pd.DataFrame,
    nodes_order: List[str],
    time_steps: int = 12,
    feature: str = 'count'
) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    Строит последовательности [S, T, N_all] где:
    - N_all = все остановки города (граф)
    - Камерные остановки: реальные данные
    - Слепые остановки: нули (модель учится предсказывать через граф)
    """

    if df.empty:
        raise ValueError("Empty DataFrame")
    
    if not nodes_order:
        raise ValueError("nodes order is emplty")
    
    df = df.copy()
    df["datetime"] = pd.to_datetime(df["datetime"])
    df.sort_values("datetime", inplace=True)
    
    node_index = {int(node): i for i, node in enumerate(nodes_order)}

    times = sorted(df["datetime"].unique())
    T = len(times)
    N = len(nodes_order)

    if T <= time_steps:
        raise ValueError(f"Not enough timestamps: {T}, need > {time_steps}")

    # Полный тензор (создаём тензор [T, 1, N] — один признак (count))
    C = 5   # Каналы
    X_full = np.zeros((T, C, N), dtype=np.float32)
    
    grouped = df.groupby(["datetime", "stop_id"])[feature].mean().reset_index()

    time_index = {t: i for i, t in enumerate(times)}

    for _, row in grouped.iterrows():
        stop_id = int(row["stop_id"])
        if stop_id not in node_index:
            continue

        t = time_index[row["datetime"]]
        i = node_index[stop_id]
        X_full[t, 0, i] = float(row[feature]) if pd.notna(row[feature]) else 0.0

    # Time features (одинаковые для всех узлов в момент времени)
    for t, dt in enumerate(times):
        hour = dt.hour
        dow = dt.dayofweek  # 0..6

        hour_sin = np.sin(2 * np.pi * hour / 24)
        hour_cos = np.cos(2 * np.pi * hour / 24)

        dow_sin = np.sin(2 * np.pi * dow / 7)
        dow_cos = np.cos(2 * np.pi * dow / 7)

        X_full[t, 1, :] = hour_sin
        X_full[t, 2, :] = hour_cos
        X_full[t, 3, :] = dow_sin
        X_full[t, 4, :] = dow_cos

    sequences = []
    targets = []

    for start in range(T - time_steps):
        seq = X_full[start:start + time_steps]      # [T, C, N]
        target = X_full[start + time_steps, 0, :]   # [N] только count
        
        sequences.append(seq)
        targets.append(target)
    
    X = torch.tensor(np.array(sequences), dtype=torch.float32)  # [S, T, C, N]
    y = torch.tensor(np.array(targets), dtype=torch.float32)    # [S, N]
    
    return (
        X,
        y
    )