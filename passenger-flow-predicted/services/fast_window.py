import numpy as np
import pandas as pd
import torch

from database.dataset_builder import _get_time_coeff, _is_peak, _MAX_COEFF


def build_last_window(
    df: pd.DataFrame,
    nodes_order: list[int],
    time_steps: int,
    feature: str = "count"
) -> torch.Tensor:
    """
    Строит только последнее окно [1, T, C, N]
    Без генерации всех последовательностей.

    df должен содержать: datetime, stop_id, count (уже нормализованный count).
    """
    if df.empty:
        raise ValueError("Empty DataFrame")

    df = df.copy()
    df["datetime"] = pd.to_datetime(df["datetime"])
    df.sort_values("datetime", inplace=True)

    times = sorted(df["datetime"].unique())
    if len(times) < time_steps:
        raise ValueError(f"Not enough timestamps: {len(times)} < {time_steps}")

    times = times[-time_steps:]

    node_index = {int(n): i for i, n in enumerate(nodes_order)}
    N = len(nodes_order)
    C = 7

    X = np.zeros((time_steps, C, N), dtype=np.float32)

    df_last = df[df["datetime"].isin(times) & df["stop_id"].notna()]

    grouped = (
        df_last.groupby(["datetime", "stop_id"])[feature]
        .mean()
        .reset_index()
    )

    time_index = {t: i for i, t in enumerate(times)}

    # channel 0 = count
    for _, row in grouped.iterrows():
        sid = int(row["stop_id"])
        if sid not in node_index:
            continue

        t_idx = time_index.get(row["datetime"])
        if t_idx is None:
            continue

        i = node_index[sid]
        val = row[feature]
        X[t_idx, 0, i] = float(val) if pd.notna(val) else 0.0

    # time features
    for t, dt in enumerate(times):
        hour = dt.hour
        dow = dt.dayofweek

        hour_sin = np.sin(2 * np.pi * hour / 24)
        hour_cos = np.cos(2 * np.pi * hour / 24)

        dow_sin = np.sin(2 * np.pi * dow / 7)
        dow_cos = np.cos(2 * np.pi * dow / 7)

        tw = _get_time_coeff(hour, dow) / _MAX_COEFF
        peak = _is_peak(hour, dow)

        X[t, 1, :] = hour_sin
        X[t, 2, :] = hour_cos
        X[t, 3, :] = dow_sin
        X[t, 4, :] = dow_cos
        X[t, 5, :] = tw
        X[t, 6, :] = peak

    return torch.tensor(X, dtype=torch.float32).unsqueeze(0)  # [1,T,C,N]