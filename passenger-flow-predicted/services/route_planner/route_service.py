from typing import Dict, Any

from services.route_planner.dijkstra import dijkstra_route
from services.route_planner.weight_function import RouteWeightsConfig
from services.route_planner.graph_loader import TransportGraph
from services.route_planner.loads import LoadsBuilderService


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

        # 1) строим граф транспорта
        edges = self.repo.get_transport_edges(city_id)
        # edges: from_stop_id, to_stop_id, dist_km, route_id, travel_time_min(optional)

        graph = TransportGraph()
        for e in edges:
            graph.add_edge(
                from_stop=int(e["from_stop_id"]),
                to_stop=int(e["to_stop_id"]),
                dist_km=float(e["dist_km"]),
                route_id=int(e["route_id"]),
                travel_time_min=float(e["travel_time_min"]) if e.get("travel_time_min") else None
            )

        # 2) loads собираем по твоей схеме (камеры/прогноз)
        loads = self.loads_builder.build_loads_for_routing(city_id, dt_str)

        # 3) Дейкстра
        result = dijkstra_route(
            graph=graph,
            start_stop=start_stop_id,
            goal_stop=goal_stop_id,
            loads=loads,
            mode=mode,
            cfg=self.cfg
        )

        if result is None:
            return {"status": "FAILED", "message": "Route not found"}

        return {
            "status": "SUCCESS",
            "mode": mode,
            "total_cost_minutes": result["total_cost"],
            "stops": result["stops"],
            "routes": result["routes"],
            "segments": result["segments"]
        }