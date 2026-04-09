from dataclasses import dataclass

@dataclass
class RouteWeightsConfig:
    speed_kmh: float = 22.0        # средняя скорость транспорта
    alpha_wait: float = 1.0        # чувствительность к ожиданию
    beta_crowd: float = 1.0        # чувствительность к толпе
    w_max: float = 8.0             # максимум штрафа ожидания (мин)
    c_max: float = 6.0             # максимум штрафа толпы (мин)
    transfer_fix: float = 10.0     # фиксированный штраф пересадки (мин)

    # усиления режимов
    crowded_wait_mult: float = 2.0
    crowded_crowd_mult: float = 3.0
    transfers_mult: float = 4.0


def compute_edge_weight(
    dist_km: float,
    load_u: float,
    load_v: float,
    is_transfer: bool,
    mode: str,
    cfg: RouteWeightsConfig,
    travel_time_min: float | None = None
) -> float:
    # базовое время
    t_base = (dist_km / cfg.speed_kmh) * 60.0

    # Ожидание на остановке
    t_wait = cfg.alpha_wait * load_u * cfg.w_max

    # Переполненность транспорта (берём нагрузку на следующей остановке)
    t_crowd = cfg.beta_crowd * load_v * cfg.c_max

    # пересадка 
    t_transfer = cfg.transfer_fix if is_transfer else 0.0

    # Режимы приоритета
    if mode == "FASTEST":
        return t_base + t_wait + t_crowd + t_transfer
    
    if mode == "LESS_CROWDED":
        # усиливаем влияние crowd и wait
        return t_base + cfg.crowded_wait_mult * t_wait + cfg.crowded_crowd_mult * t_crowd + t_transfer
    
    if mode == "MIN_TRANSFERS":
        # штраф за пересадку сильно увеличиваем
        return t_base + t_wait + t_crowd + (t_transfer * cfg.transfers_mult)
    
    # default
    return t_base + t_wait + t_crowd + t_transfer