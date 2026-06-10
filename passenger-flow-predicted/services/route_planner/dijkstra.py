from __future__ import annotations

import heapq
import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from services.route_planner.graph_loader import Edge, TransportGraph
from services.route_planner.weight_function import WALK_ROUTE_ID, WALK_SPEED_KMH, compute_edge_weight, RouteWeightsConfig

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

State = Tuple[int, Optional[int]]  # (stop_id, route_id)


@dataclass
class RouteSegmentData:
    from_stop: int
    to_stop: int
    route_id: int
    dist_km: float
    travel_time_min: Optional[float]
    load_from: float
    load_to: float
    route_name: str = ""
    route_number: str = ""

    @property
    def is_walk(self) -> bool:
        from services.route_planner.walking_edges import WALK_ROUTE_ID
        return self.route_id == WALK_ROUTE_ID


@dataclass
class RouteResult:
    total_cost: float
    actual_time_minutes: float
    stops: List[int]
    routes: List[Optional[int]]
    segments: List[RouteSegmentData]
    label: str = ""
    mode_used: str = "" 

    def to_dict(self) -> dict:
        return {
            "total_cost": self.total_cost,
            "stops": self.stops,
            "routes": self.routes,
            "segments": [
                {
                    "from_stop": s.from_stop,
                    "to_stop": s.to_stop,
                    "route_id": s.route_id,
                    "dist_km": s.dist_km,
                    "travel_time_min": s.travel_time_min,
                    "load_from": s.load_from,
                    "load_to": s.load_to,
                    "route_name": s.route_name,
                    "route_number": s.route_number,
                }
                for s in self.segments
            ],
        }
    

def dijkstra_route(
    graph: TransportGraph,
    start_stop: int,
    goal_stop: int,
    loads: Dict[int, float],
    mode: str,
    cfg: RouteWeightsConfig
) -> Optional[RouteResult]:
    """Запускает Дейкстру"""    
    logger.debug(f"Dijkstra init: start={start_stop}, goal={goal_stop}, loads_count={len(loads)}")

    if start_stop == goal_stop:
        logger.warning("start_stop == goal_stop, trivial route")
        return RouteResult(total_cost=0.0, stops=[start_stop], routes=[None], segments=[])

    start_state: State = (start_stop, None)

    dist: Dict[State, float] = {start_state: 0.0}
    parent: Dict[State, Tuple[State, Edge]] = {}
    visited: set[State] = set()
    pq: list[tuple[float, State]] = []

    heapq.heappush(pq, (0.0, start_state))
    
    expanded = 0

    while pq:
        current_cost, state = heapq.heappop(pq)
        u, current_route = state

        if state in visited:
            continue
        visited.add(state)

        if u == goal_stop:
            logger.debug(
                "Goal %s reached: cost=%.2f, expanded=%d, visited=%d",
                goal_stop, current_cost, expanded, len(visited),
            )

            return _reconstruct(state, start_state, parent, loads, current_cost, cfg)
        
        if current_cost > dist.get(state, float("inf")):
            continue

        # Получаем соседей
        neighbors = graph.neighbors(u)
        if not neighbors:
            logger.debug(f"Node {u} has no outgoing edges")
            continue
            
        expanded += 1

        for edge in neighbors:
            v = edge.to_stop
            next_route = edge.route_id

            is_entry = current_route is None

            # Пересадка = смена маршрута (включая случай когда шли пешком)
            is_transfer = (
                not is_entry 
                and next_route != current_route
                and next_route != WALK_ROUTE_ID
            )

            # Если текущий маршрут был пешеходным надо ждать транспорт
            is_entry_after_walk = (
                current_route == WALK_ROUTE_ID
                and next_route != WALK_ROUTE_ID                
            )

            load_u = loads.get(u, 0.0)
            load_v = loads.get(v, 0.0)

            w = compute_edge_weight(
                dist_km=edge.dist_km,
                travel_time_min=edge.travel_time_min,
                load_u=load_u,
                load_v=load_v,
                is_transfer=is_transfer,
                is_entry=is_entry,
                is_entry_after_walk=is_entry_after_walk,
                mode=mode,
                cfg=cfg,
                route_id=edge.route_id,
            )

            # === защита от NaN/inf ===
            if not (0.0 <= w < float('inf')):
                logger.warning(f"Invalid edge weight {w} for {u}→{v} (route {next_route})")
                continue

            next_state: State = (v, next_route)
            new_cost = current_cost + w

            if new_cost < dist.get(next_state, float("inf")):
                dist[next_state] = new_cost
                parent[next_state] = (state, edge)
                heapq.heappush(pq, (new_cost, next_state))

    logger.warning(f"Dijkstra finished: goal {goal_stop} not reached. Visited={visited}, Expanded={expanded}")
    return None


def _reconstruct(
    goal_state: State,
    start_state: State,
    parent: Dict[State, Tuple[State, Edge]],
    loads: Dict[int, float],
    total_cost: float,
    cfg: RouteWeightsConfig,
) -> RouteResult:
    """Восстанавливает путь из таблицы parent."""
    states_path: list[State] = []
    edges_path: list[Edge] = []

    current = goal_state
    while current != start_state:
        states_path.append(current)
        prev_state, edge = parent[current]
        edges_path.append(edge)
        current = prev_state

    states_path.append(start_state)
    states_path.reverse()
    edges_path.reverse()

    stops = [s[0] for s in states_path]
    routes = [s[1] for s in states_path]

    segments: List[RouteSegmentData] = []
    for i, edge in enumerate(edges_path):
        segments.append(
            RouteSegmentData(
                from_stop=stops[i],
                to_stop=stops[i + 1],
                route_id=edge.route_id,
                dist_km=edge.dist_km,
                travel_time_min=edge.travel_time_min,
                load_from=loads.get(stops[i], 0.0),
                load_to=loads.get(stops[i + 1], 0.0)
            )
        )

    actual_time = _compute_actual_time(segments, loads, cfg)

    return RouteResult(
        total_cost=total_cost,
        actual_time_minutes=actual_time,
        stops=stops,
        routes=routes,
        segments=segments
    )


def _compute_actual_time(
    segments: List[RouteSegmentData],
    loads: Dict[int, float],
    cfg: RouteWeightsConfig,
) -> float:
    """
    Считает реальное время маршрута в минутах. Без штрафных множителей режимов — только физика.
      (время движения по каждому сегменту, ожидание на пересадках, пешеходные переходы)
    """
    total = 0.0
    prev_route_id: Optional[int] = None

    for seg in segments:
        is_walk = seg.route_id == WALK_ROUTE_ID

        # Физическое время движения/ходьбы
        if seg.travel_time_min is not None and seg.travel_time_min > 0:
            t_move = seg.travel_time_min
        elif seg.dist_km > 0:
            speed = WALK_SPEED_KMH if is_walk else cfg.speed_kmh
            t_move = (seg.dist_km / speed) * 60.0
        else:
            t_move = 0.0

        total += t_move

        # Ожидание при пересадке (не при входе на первый маршрут)
        if prev_route_id is not None:
            is_transfer = seg.route_id != prev_route_id and not is_walk
            is_entry_after_walk = prev_route_id == WALK_ROUTE_ID and not is_walk

            if is_transfer or is_entry_after_walk:
                # Реальное ожидание = базовый интервал * нагрузка
                load = loads.get(seg.from_stop, 0.0)
                wait = cfg.transfer_fix * (0.5 + 0.5 * load)  # от 50% до 100% интервала
                total += wait

        prev_route_id = seg.route_id

    return round(total, 1)