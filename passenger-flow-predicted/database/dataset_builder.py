from typing import List, Tuple
import pandas as pd
import torch
import numpy as np


# Суточные профили
_WORKDAY_HOUR_COEFF = np.array([
    # ночь
    0.05, 0.04, 0.03, 0.02, 0.03, 0.35,
    # утро
    0.7, 1.2, 1.5, 1.3,
    # день
    1.0, 1.0, 1.1, 1.0, 1.0, 1.1,
    # вечер
    1.3, 1.6, 1.7, 1.4,
    # поздний вечер
    1.05, 0.75, 0.45, 0.22,
], dtype=np.float32)

# Выходной день — пики утра/вечера сглажены
_WEEKEND_HOUR_COEFF = np.array([
    0.25, 0.20, 0.15, 0.12, 0.12, 0.15,  # 0-5
    0.25, 0.35, 0.35, 0.50,               # 6-9
    0.80, 1.00, 1.15, 1.10,               # 10-13
    1.10, 1.15, 0.65, 0.65,               # 14-17
    1.30, 1.60, 1.70, 1.40,               # 18-21
    1.00, 0.37,                            # 22-23
], dtype=np.float32)

# Защитные проверки — упадут при импорте если профили битые
assert len(_WORKDAY_HOUR_COEFF) == 24, f"WORKDAY profile broken: got {len(_WORKDAY_HOUR_COEFF)} elements"
assert len(_WEEKEND_HOUR_COEFF) == 24, f"WEEKEND profile broken: got {len(_WEEKEND_HOUR_COEFF)} elements"

_PEAK_HOURS_WORKDAY = frozenset({7, 8, 9, 17, 18, 19})
_MAX_COEFF = 1.70  # нормировочная константа


def _get_time_coeff(hour: int, weekday: int) -> float:
    """Коэффициент для канала time_weight в датасете."""
    if weekday >= 5:
        return float(_WEEKEND_HOUR_COEFF[hour])
    return float(_WORKDAY_HOUR_COEFF[hour])


def _is_peak(hour: int, weekday: int) -> float:
    """1.0 если рабочий час пик, иначе 0.0"""
    return 1.0 if (weekday < 5 and hour in _PEAK_HOURS_WORKDAY) else 0.0


def build_time_features(times, N: int) -> np.ndarray:
    """
    Строит матрицу временных признаков [T, 6, N].
    Каналы: hour_sin, hour_cos, dow_sin, dow_cos, time_weight, peak.
    Выделено в отдельную функцию чтобы переиспользовать в build_last_window.
    """
    T = len(times)
    feats = np.zeros((T, 6, N), dtype=np.float32)

    for t, dt in enumerate(times):
        hour = dt.hour
        dow = dt.dayofweek  # 0..6

        hour_sin = np.sin(2 * np.pi * hour / 24)
        hour_cos = np.cos(2 * np.pi * hour / 24)
        dow_sin  = np.sin(2 * np.pi * dow / 7)
        dow_cos  = np.cos(2 * np.pi * dow / 7)
        tw       = _get_time_coeff(hour, dow) / _MAX_COEFF
        peak     = _is_peak(hour, dow)

        feats[t, 0, :] = hour_sin
        feats[t, 1, :] = hour_cos
        feats[t, 2, :] = dow_sin
        feats[t, 3, :] = dow_cos
        feats[t, 4, :] = tw
        feats[t, 5, :] = peak

    return feats


def build_sequences(
    df: pd.DataFrame,
    nodes_order: List[int],
    time_steps: int = 12,
    horizon: int = 12,
    feature: str = 'count'
) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    Строит последовательности [S, T, C, N_all] где:
    - N_all = все остановки города (граф)
    - Камерные остановки: реальные данные
    - Слепые остановки: нули (модель учится предсказывать через граф)
    - C=7 каналов:
        0: count (реальные данные с камер)
        1: hour_sin
        2: hour_cos
        3: dow_sin
        4: dow_cos
        5: time_weight (нормированный коэффициент активности)
        6: peak (бинарный, часы пик рабочих дней)
    """
    if df.empty:
        raise ValueError("Empty DataFrame")

    if not nodes_order:
        raise ValueError("nodes_order is empty")

    df = df.copy()
    df["datetime"] = pd.to_datetime(df["datetime"])
    df.sort_values("datetime", inplace=True)

    node_index = {int(node): i for i, node in enumerate(nodes_order)}

    times = sorted(df["datetime"].unique())
    T = len(times)
    N = len(nodes_order)

    if T <= time_steps:
        raise ValueError(f"Not enough timestamps: {T}, need > {time_steps}")

    C = 7
    X_full = np.zeros((T, C, N), dtype=np.float32)

    # Канал 0: count — реальные данные с камер
    if "stop_id" in df.columns and df["stop_id"].notna().any():
        grouped = (
            df[df["stop_id"].notna()]
            .groupby(["datetime", "stop_id"])[feature]
            .mean()
            .reset_index()
        )
        time_index = {t: i for i, t in enumerate(times)}
        for _, row in grouped.iterrows():
            sid = int(row["stop_id"])
            if sid not in node_index:
                continue
            t = time_index.get(row["datetime"])
            if t is None:
                continue
            i = node_index[sid]
            val = row[feature]
            X_full[t, 0, i] = float(val) if pd.notna(val) else 0.0

    # Каналы 1–6: временные признаки (одинаковые для всех узлов)
    time_feats = build_time_features(times, N)  # [T, 6, N]
    X_full[:, 1:, :] = time_feats

    sequences = []
    targets = []

    for start in range(T - time_steps - horizon + 1):
        seq    = X_full[start : start + time_steps]                              # [T, C, N]
        target = X_full[start + time_steps : start + time_steps + horizon, 0, :]  # [H, N]

        if target.shape != (horizon, N):
            continue

        sequences.append(seq)
        targets.append(target)

    X = torch.tensor(np.array(sequences), dtype=torch.float32)                          # [S, T, C, N]
    y = torch.stack([torch.tensor(t, dtype=torch.float32) for t in targets])            # [S, H, N]

    return X, y


def build_last_window(
    df: pd.DataFrame,
    nodes_order: List[int],
    time_steps: int = 12,
    feature: str = 'count'
) -> torch.Tensor:
    """
    Строит ОДНО последнее окно [1, T, C, N] для инференса.
    Полностью идентична логике build_sequences — те же 7 каналов.
    Используется в forecast вместо build_sequences чтобы не грузить всю историю.
    """
    if df.empty:
        raise ValueError("Empty DataFrame for last window")

    if not nodes_order:
        raise ValueError("nodes_order is empty")

    df = df.copy()
    df["datetime"] = pd.to_datetime(df["datetime"])
    df.sort_values("datetime", inplace=True)

    node_index = {int(node): i for i, node in enumerate(nodes_order)}

    times = sorted(df["datetime"].unique())
    T = len(times)
    N = len(nodes_order)

    if T < time_steps:
        raise ValueError(f"Not enough timestamps for last window: {T} < {time_steps}")

    # Берём последние time_steps временных меток
    times = times[-time_steps:]

    C = 7
    X_window = np.zeros((time_steps, C, N), dtype=np.float32)

    # Канал 0: count
    if "stop_id" in df.columns and df["stop_id"].notna().any():
        window_start = times[0]
        df_window = df[df["datetime"] >= window_start]

        grouped = (
            df_window[df_window["stop_id"].notna()]
            .groupby(["datetime", "stop_id"])[feature]
            .mean()
            .reset_index()
        )
        time_index = {t: i for i, t in enumerate(times)}
        for _, row in grouped.iterrows():
            sid = int(row["stop_id"])
            if sid not in node_index:
                continue
            t = time_index.get(row["datetime"])
            if t is None:
                continue
            i = node_index[sid]
            val = row[feature]
            X_window[t, 0, i] = float(val) if pd.notna(val) else 0.0

    # Каналы 1–6: временные признаки
    time_feats = build_time_features(times, N)  # [T, 6, N]
    X_window[:, 1:, :] = time_feats

    # [T, C, N] -> [1, T, C, N]
    return torch.tensor(X_window[np.newaxis], dtype=torch.float32)


def get_target_time_weights(
    df: pd.DataFrame,
    nodes_order: List[int],
    time_steps: int = 12,
    horizon: int = 12,
) -> torch.Tensor:
    """
    Возвращает тензор time_weight для каждого таргета в датасете.
    Используется в masked_loss для динамического взвешивания:
        - в часы пик ошибка важнее (больше людей, точность критичнее)
        - ночью ошибка менее критична
    Shape: [S] — по одному значению на каждую последовательность.
    """
    df = df.copy()
    df["datetime"] = pd.to_datetime(df["datetime"])
    df.sort_values("datetime", inplace=True)

    times = sorted(df["datetime"].unique())
    T = len(times)

    if T <= time_steps:
        return torch.ones(max(0, T - time_steps), dtype=torch.float32)

    weights = []
    for start in range(T - time_steps - horizon + 1):
        target_dt = times[start + time_steps]
        tw = _get_time_coeff(target_dt.hour, target_dt.dayofweek) / _MAX_COEFF
        weights.append(float(tw))

    return torch.tensor(weights, dtype=torch.float32)