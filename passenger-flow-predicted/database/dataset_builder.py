from typing import List
from sqlalchemy import Tuple
import pandas as pd
import torch
import numpy as np

def build_sequences(
    df: pd.DataFrame, 
    time_steps: int = 12,
    target_feature: str = 'count'
) -> Tuple[torch.Tensor, torch.Tensor, List[str]]:
    
    if df.empty:
        raise ValueError("Empty DataFrame")
    
    nodes = df['address'].unique().tolist()
    node_index = {n: i for i, n in enumerate(nodes)}

    times = sorted(df['datetime'].unique())
    T = len(times)
    N = len(nodes)

    # Создаём тензор [T, 1, N] — один признак (count)
    X_full = np.zeros((T, 1, N), dtype=np.float32)
    
    for t, time in enumerate(times):
        slice_df = df[df['datetime'] == time]
        for _, row in slice_df.iterrows():
            if row['address'] in node_index:
                i = node_index[row['address']]
                X_full[t, 0, i] = row.get(target_feature, 0) or 0
    
    # Формируем последовательности (sliding window)
    sequences = []
    targets = []
    
    for i in range(len(X_full) - time_steps):
        seq = X_full[i:i+time_steps]  # [time_steps, 1, N]
        target = X_full[i+time_steps]  # [1, N]
        
        sequences.append(seq.squeeze(1))  # [time_steps, N]
        targets.append(target.squeeze(0))  # [N]
    
    if not sequences:
        raise ValueError(f"Not enough data for sequences: need {time_steps+1} timestamps, got {T}")
    
    return (
        torch.tensor(np.array(sequences), dtype=torch.float32),  # [S, T, N]
        torch.tensor(np.array(targets), dtype=torch.float32),    # [S, N]
        nodes
    )