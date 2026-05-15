import heapq
import logging
from typing import Dict, Tuple, Optional, Any

from services.route_planner.graph_loader import Edge, TransportGraph
from services.route_planner.weight_function import compute_edge_weight, RouteWeightsConfig

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,  # или DEBUG для детальных логов
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

State = Tuple[int, Optional[int]]  # (stop_id, route_id)

def dijkstra_route(
    graph: TransportGraph,
    start_stop: int,
    goal_stop: int,
    loads: Dict[int, float],
    mode: str,
    cfg: RouteWeightsConfig
) -> Optional[Dict[str, Any]]:
    
    logger.debug(f"Dijkstra init: start={start_stop}, goal={goal_stop}, loads_count={len(loads)}")

    start_state: State = (start_stop, None)

    dist: Dict[State, float] = {start_state: 0.0}
    parent: Dict[State, Tuple[State, Edge]] = {}
    visited: set[State] = set()

    pq: list[tuple[float, State]] = []
    heapq.heappush(pq, (0.0, start_state))
    
    visits_count = 0
    expanded = 0

    while pq:
        current_cost, state = heapq.heappop(pq)
        u, current_route = state

        if state in visited:
            continue
        visited.add(state)

        visits_count += 1

        if current_cost > dist.get((u, current_route), float("inf")):
            continue

        if u == goal_stop:
            logger.info(f"Goal reached after {visited} visits, {expanded} expansions")
            goal_state = (u, current_route)

            # Восстановление пути
            states_path: list[State] = []
            edges_path: list[Edge] = []

            cur = goal_state
            while cur != start_state:
                states_path.append(cur)
                prev_state, prev_edge = parent[cur]
                edges_path.append(prev_edge)
                cur = prev_state

            states_path.append(start_state)
            states_path.reverse()
            edges_path.reverse()

            stops_path = [s[0] for s in states_path]
            routes_path = [s[1] for s in states_path]

            segments = []
            for i, edge in enumerate(edges_path):
                segments.append({
                    "from_stop": stops_path[i],
                    "to_stop": stops_path[i + 1],
                    "route_id": edge.route_id,
                    "dist_km": edge.dist_km,
                    "travel_time_min": edge.travel_time_min,
                    "load_from": loads.get(stops_path[i], 0.0),
                    "load_to": loads.get(stops_path[i + 1], 0.0),
                })

            return {
                "total_cost": current_cost,
                "stops": stops_path,
                "routes": routes_path,
                "segments": segments
            }

        # Получаем соседей
        neighbors = list(graph.neighbors(u))
        if not neighbors:
            logger.debug(f"Node {u} has no outgoing edges")
            continue
            
        expanded += 1

        for edge in neighbors:
            v = edge.to_stop
            next_route = edge.route_id

            is_transfer = (current_route is not None and next_route != current_route)

            load_u = loads.get(u, 0.0)
            load_v = loads.get(v, 0.0)

            # === ЛОГ: проверяем веса перед вычислением ===
            if load_u is None or load_v is None:
                logger.warning(f"Null load for edge {u}→{v}: load_u={load_u}, load_v={load_v}")

            w = compute_edge_weight(
                dist_km=edge.dist_km,
                travel_time_min=edge.travel_time_min,
                load_u=load_u,
                load_v=load_v,
                is_transfer=is_transfer,
                mode=mode,
                cfg=cfg
            )

            # === ЛОГ: защита от NaN/inf ===
            if not (0 <= w < float('inf')):
                logger.warning(f"Invalid edge weight {w} for {u}→{v} (route {next_route})")
                continue

            next_state: State = (v, next_route)
            new_cost = current_cost + w

            if new_cost < dist.get(next_state, float("inf")):
                dist[next_state] = new_cost
                parent[next_state] = ((u, current_route), edge)
                heapq.heappush(pq, (new_cost, next_state))

    logger.warning(f"Dijkstra finished: goal {goal_stop} not reached. Visited={visited}, Expanded={expanded}")
    return None