from __future__ import annotations

import logging
from dataclasses import replace
from typing import List, Dict, Any, Optional, Tuple

from services.route_planner.dijkstra import RouteResult, dijkstra_route
from services.route_planner.weight_function import RouteWeightsConfig
from services.route_planner.graph_loader import TransportGraph


logger = logging.getLogger(__name__)

_STRATEGIES: List[Tuple[str, str, Dict[str, Any]]] = [
    ("fastest",        "FASTEST",       {}),
    ("min_transfers",  "MIN_TRANSFERS", {}),
    ("less_crowded",   "LESS_CROWDED",  {}),
    ("fast_uncrowded", "FASTEST",       {"beta_crowd": 3.0, "alpha_wait": 2.0}),
    ("comfort",        "MIN_TRANSFERS", {"crowded_crowd_mult": 0.5, "transfer_fix": 15.0}),
]


def _route_signature(result: RouteResult) -> Tuple[int, ...]:
    """Уникальный ключ маршрута - последовательность route_id сегментов"""
    return tuple(seg.route_id for seg in result.segments)


def find_alternatives(
    graph: TransportGraph,
    start_stop: int,
    goal_stop: int,
    loads: Dict[int, float],
    mode: str,
    base_cfg: RouteWeightsConfig,
    max_alternatives: int = 5
) -> List[Dict[str, Any]]:
    
    """Строит пул альтернативных маршрутов. Всегда начинает с режима, запрошенного пользователем (primary).
    Далее перебирает остальные стратегии и добавляет уникальные."""
    results: List[Dict[str, Any]] = []
    seen: set[Tuple[int, ...]] = set()

    # выносим запрошенный режим вперёд, чтобы он стал primary
    strategies = _reorder_strategies(mode)

    for label, strategy_mode, cfg_patch in strategies:
        if len(results) >= max_alternatives:
            break

        # Патчим конфиг
        cfg = replace(base_cfg, **cfg_patch) if cfg_patch else base_cfg

        route: Optional[RouteResult] = dijkstra_route(
            graph=graph,
            start_stop=start_stop,
            goal_stop=goal_stop,
            loads=loads,
            mode=strategy_mode,
            cfg=cfg
        )

        if route is None:
            logger.debug("Strategy '%s' found no route", label)
            continue

        sig = _route_signature(route)

        # Дубликат пропускаем
        if sig in seen:
            logger.debug("Strategy '%s' is duplicate, skipping", label)
            continue

        seen.add(sig)
        
        route.label = label
        route.mode_used = strategy_mode
        results.append(route)

        logger.debug(
            "Strategy '%s' added: cost=%.2f, segments=%d",
            label, route.total_cost, len(route.segments),
        )

    return results


def _reorder_strategies(
    preferred_mode: str,
) -> List[Tuple[str, str, Dict[str, Any]]]:
    """
    Переставляет стратегии так, чтобы первой шла та,
    что соответствует запрошенному режиму (без патчей).
    """
    primary = [s for s in _STRATEGIES if s[1] == preferred_mode and not s[2]]
    rest = [s for s in _STRATEGIES if s not in primary]
    return primary + rest