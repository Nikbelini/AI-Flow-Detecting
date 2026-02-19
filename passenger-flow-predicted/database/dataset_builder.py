import torch
import numpy as np

def build_sequences(df, time_steps=12):
    nodes = df['address'].unique()
    node_index = {n: i for i, n in enumerate(nodes)}

    T = len(df['datetime'].unique())
    N = len(nodes)

    X = np.zeros((T, 1, N))
    times = sorted(df['datetime'].unique())

    for t, time in enumerate(times):
        slice = df[df['datetime'] == time]
        for _, row in slice.iterrows():
            i = node_index[row['address']]
            X[t, 0, i] = row['count']

    sequences = []
    targets = []

    for i in range(len(X) - time_steps):
        sequences.append(X[i:i+time_steps])
        targets.append(X[i+time_steps])

    return (
        torch.tensor(sequences, dtype=torch.float32),
        torch.tensor(targets, dtype=torch.float32),
        nodes
    )
