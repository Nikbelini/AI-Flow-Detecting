from __future__ import annotations

import math
import logging
from dataclasses import dataclass
from typing import List, Dict, Tuple


logger = logging.getLogger(__name__)

# Зарезервированный route_id для пешеходных рёбер
WALK_ROUTE_ID: int = -1

# Скорость пешехода, км/ч
WALK_SPEED_KMH: float = 4.0

# Максимальная дистанция для автоматической пешеходной пересадки
DEFAULT_MAX_WALK_DIST_M: float = 500.0


@dataclass(frozen=True)
class StopCoord:
    stop_id: int
    latitude: float
    longitude: float


def haversine_m(latitude1: float, longitude1: float, latitude2: float, longitude2: float) -> float:
    """
    Расстояние между двумя точками по формуле Гаверсинуса, в метрах.
    Точность достаточна для 400-600 м
    """
    R = 6_371_000.0     # Радиус Земли в метрах
    phi1 = math.radians(latitude1)
    phi2 = math.radians(latitude2)
    dphi = math.radians(latitude2 - latitude1)
    dlam = math.radians(longitude2 - longitude1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def walk_time_min(dist_m: float) -> float:
    """Время пешей прогулки в минутах."""
    return (dist_m / 1000.0) / WALK_SPEED_KMH * 60.0


def build_walking_edges(
    stops: List[StopCoord],
    max_dist_m: float = DEFAULT_MAX_WALK_DIST_M
) -> List[Tuple[int, int, float, float]]:
    """
    Возвращает список пешеходных рёбер между остановками в радиусе max_dism_m
    Рёбра двунаправленные - добавляем оба направления.
    """

    edges: List[tuple[int, int, float, float]] = []
    n = len(stops)

    for i in range(n):
        for j in range(i + 1 , n):
            a = stops[i]
            b = stops[j]

            dist_m = haversine_m(a.latitude, a.longitude, b.latitude, b.longitude)
            if dist_m > max_dist_m:
                continue

            dist_km = dist_m / 1000.0
            t_min = walk_time_min(dist_m)

            # Оба направления
            edges.append((a.stop_id, b.stop_id, dist_km, t_min))
            edges.append((b.stop_id, a.stop_id, dist_km, t_min))

            logger.debug(
                "Walk edge: %d <-> %d, dist=%.0fm, time=%.1fmin",
                a.stop_id, b.stop_id, dist_m, t_min,
            )

    logger.info(
        "Walking edges built: %d pairs → %d directed edges (max_dist=%.0fm)",
        len(edges) // 2, len(edges), max_dist_m,
    )

    return edges
