from __future__ import annotations

import logging
from datetime import datetime
from typing import Dict, Any, List

from services.route_planner.dijkstra import dijkstra_route, RouteSegmentData
from services.route_planner.weight_function import RouteWeightsConfig
from services.route_planner.graph_loader import TransportGraph
from services.route_planner.loads import LoadsBuilderService
from services.route_planner.time_guard import TimeGuardResult, evaluate_request_time
from services.route_planner.alternatives import find_alternatives

logger = logging.getLogger(__name__)


class RoutePlannerService:
    def __init__(self, repository):
        self.repo = repository
        self.cfg = RouteWeightsConfig()
        self.loads_builder = LoadsBuilderService(repository)

    def build_route(
        self,
        city_id: int,
        start_stop_id: int,
        goal_stop_id: int,
        dt_str: str,
        mode: str = "FASTEST"
    ) -> Dict:
        time_guard: TimeGuardResult = evaluate_request_time(dt_str)
        effective_dt: datetime = time_guard.effective_dt
        effective_dt_str: str = effective_dt.strftime("%Y-%m-%dT%H:%M:%S")

        logger.info(
            "build_route: city=%d, %d→%d, mode=%s, dt=%s → effective=%s, scheduled=%s",
            city_id, start_stop_id, goal_stop_id, mode,
            dt_str, effective_dt_str, time_guard.is_scheduled,
        )

        graph, route_meta = self._build_graph(city_id)

        if len(graph) == 0:
            logger.error("Transport graph is empty for city %d", city_id)
            return {"status": "FAILED", "message": "Граф транспорта пуст — нет данных о маршрутах"}

        loads: Dict[int, float] = self.loads_builder.build_loads_for_routing(city_id, effective_dt_str)

        alternatives = find_alternatives(
            graph=graph,
            start_stop=start_stop_id,
            goal_stop=goal_stop_id,
            loads=loads,
            mode=mode,
            base_cfg=self.cfg,
            max_alternatives=5
        )

        if not alternatives:
            logger.warning("No route found: city=%d, %d→%d", city_id, start_stop_id, goal_stop_id)
            return {"status": "FAILED", "message": "Маршрут не найден"}

        # Обогащаем сегменты мета-данными
        for alt in alternatives:
            _enrich_segments(alt.segments, route_meta)

        primary = alternatives[0]

        response: Dict[str, Any] = {
            "status": "SUCCESS",
            "mode": mode,
            "is_scheduled": time_guard.is_scheduled,
            "scheduled_message": time_guard.user_message,
            "effective_datetime": effective_dt_str,
            "total_cost_minutes": primary.total_cost,
            "stops": primary.stops,
            "routes": primary.routes,
            "segments": [_segment_to_dict(s) for s in primary.segments],
            "alternatives": [
                {
                    "label": getattr(a, "label", None) or f"Маршрут {i + 1}",
                    "mode_used": getattr(a, "mode_used", mode),
                    "total_cost_minutes": a.total_cost,
                    "stops": a.stops,
                    "routes": a.routes,
                    "segments": [_segment_to_dict(s) for s in a.segments],
                }
                for i, a in enumerate(alternatives)
            ],
        }

        logger.info(
            "Route built: primary_cost=%.1f min, segments=%d, alternatives=%d",
            primary.total_cost, len(primary.segments), len(alternatives),
        )

        return response

    def _build_graph(self, city_id: int):
        edges = self.repo.get_transport_edges(city_id)
        route_meta: Dict[int, dict] = {
            r["id"]: r for r in self.repo.get_routes_info(city_id)
        }

        graph = TransportGraph()
        for edge in edges:
            try:
                graph.add_edge(
                    from_stop=int(edge["from_stop_id"]),
                    to_stop=int(edge["to_stop_id"]),
                    dist_km=float(edge["dist_km"]),
                    route_id=int(edge["route_id"]),
                    travel_time_min=(
                        float(edge["travel_time_min"]) if edge.get("travel_time_min") else None
                    ),
                )
            except (ValueError, KeyError) as exception:
                logger.warning("Skipping malformed edge %s: %s", edge, exception)

        logger.debug("Graph built: %d nodes, %d routes", len(graph), len(route_meta))
        return graph, route_meta


def _segment_to_dict(s: RouteSegmentData) -> Dict[str, Any]:
    """Сериализует RouteSegmentData в dict для JSON-ответа."""
    return {
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


def _enrich_segments(
    segments: List[RouteSegmentData],
    route_meta: Dict[int, dict],
) -> None:
    """Добавляет route_name и route_number к каждому сегменту in-place."""
    for segment in segments:
        rid = segment.route_id
        meta = route_meta.get(rid, {}) if rid is not None else {}
        segment.route_name = meta.get("name", "")
        segment.route_number = meta.get("number", "")