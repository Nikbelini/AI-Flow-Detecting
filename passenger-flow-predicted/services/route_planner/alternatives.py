from __future__ import annotations

import logging
from dataclasses import replace
from typing import List, Dict, Any, Optional, Tuple

from services.route_planner.dijkstra import RouteResult, dijkstra_route
from services.route_planner.weight_function import RouteWeightsConfig
from services.route_planner.graph_loader import TransportGraph


logger = logging.getLogger(__name__)

# Стратегии: (label, mode, cfg_patch)
# Порядок не важен — _reorder_strategies всегда ставит нужный mode первым.
# Чем больше стратегий — тем больше шансов найти разные физические маршруты.
_STRATEGIES: List[Tuple[str, str, Dict[str, Any]]] = [
    # --- базовые режимы ---
    ("fastest",           "FASTEST",       {}),
    ("min_transfers",     "MIN_TRANSFERS", {}),
    ("less_crowded",      "LESS_CROWDED",  {}),
    # --- вариации FASTEST ---
    ("fast_uncrowded",    "FASTEST",       {"beta_crowd": 3.0, "alpha_wait": 2.0}),
    ("fast_raw",          "FASTEST",       {"alpha_wait": 0.0, "beta_crowd": 0.0}),
    # --- вариации MIN_TRANSFERS ---
    ("comfort",           "MIN_TRANSFERS", {"crowded_crowd_mult": 0.5, "transfer_fix": 15.0}),
    ("strict_transfers",  "MIN_TRANSFERS", {"transfers_mult": 8.0}),
    # --- вариации LESS_CROWDED ---
    ("very_uncrowded",    "LESS_CROWDED",  {"crowded_crowd_mult": 5.0, "crowded_wait_mult": 4.0}),
]


def _route_signature(result: RouteResult) -> Tuple[int, ...]:
    """
    Уникальный ключ маршрута — точная последовательность остановок.
    Два маршрута с одинаковым набором stops — дубликаты, даже если
    разные веса привели к ним разными путями.
    Только stops, без route_id: один и тот же физический путь с пересадкой
    на другом перегоне НЕ должен считаться дубликатом.
    """
    return tuple(result.stops)


def find_alternatives(
    graph: TransportGraph,
    start_stop: int,
    goal_stop: int,
    loads: Dict[int, float],
    mode: str,
    base_cfg: RouteWeightsConfig,
    max_alternatives: int = 5,
) -> List[RouteResult]:
    """
    Строит пул альтернативных маршрутов.
    max_alternatives — общее количество результатов включая primary.
    Если primary не найден — возвращает пустой список.
    """
    seen_signatures: set[Tuple[int, ...]] = set()
    primary: Optional[RouteResult] = None
    alternatives: List[RouteResult] = []

    strategies = _reorder_strategies(mode)

    for label, strategy_mode, cfg_patch in strategies:
        # Набрали достаточно (primary + alternatives)
        total_found = (1 if primary else 0) + len(alternatives)
        if total_found >= max_alternatives:
            break

        cfg = replace(base_cfg, **cfg_patch) if cfg_patch else base_cfg

        route: Optional[RouteResult] = dijkstra_route(
            graph=graph,
            start_stop=start_stop,
            goal_stop=goal_stop,
            loads=loads,
            mode=strategy_mode,
            cfg=cfg,
        )

        if route is None:
            logger.debug("Strategy '%s' found no route", label)
            continue

        sig = _route_signature(route)
        if sig in seen_signatures:
            logger.debug("Strategy '%s' is duplicate (same stop sequence), skipping", label)
            continue

        seen_signatures.add(sig)
        route.label = label
        route.mode_used = strategy_mode

        if primary is None:
            primary = route
            logger.debug(
                "Primary route set via strategy '%s': time=%.1f min, segments=%d",
                label, route.actual_time_minutes, len(route.segments),
            )
        else:
            alternatives.append(route)
            logger.debug(
                "Alternative '%s' added: time=%.1f min, segments=%d",
                label, route.actual_time_minutes, len(route.segments),
            )

    if primary is None:
        logger.warning(
            "No route found at all: start=%d, goal=%d, mode=%s",
            start_stop, goal_stop, mode,
        )
        return []

    # Альтернативы сортируем по времени, primary не трогаем
    alternatives.sort(key=lambda r: r.actual_time_minutes)

    logger.info(
        "find_alternatives done: primary='%s' (%.1f min), %d alternatives",
        primary.label, primary.actual_time_minutes, len(alternatives),
    )

    return [primary] + alternatives


def _reorder_strategies(
    preferred_mode: str,
) -> List[Tuple[str, str, Dict[str, Any]]]:
    """
    Ставит первой стратегию без патчей для запрошенного режима.
    Остальные идут в исходном порядке.
    """
    primary_strats = [s for s in _STRATEGIES if s[1] == preferred_mode and not s[2]]
    rest = [s for s in _STRATEGIES if s not in primary_strats]
    return primary_strats + rest