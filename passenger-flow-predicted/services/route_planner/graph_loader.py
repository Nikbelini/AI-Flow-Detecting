from dataclasses import dataclass
from typing import Dict, List, Optional

@dataclass(frozen=True)
class Edge:
    to_stop: int
    dist_km: float
    route_id: int
    travel_time_min: Optional[float] = None


class TransportGraph:
    def __init__(self):
        self.adj: Dict[str, List[Edge]] = {}

    def add_edge(self, from_stop: int, to_stop: int, dist_km: float, 
        route_id: int, travel_time_min: Optional[float] = None):
        self.adj.setdefault(from_stop, []).append(
            Edge(to_stop=to_stop, dist_km=dist_km, route_id=route_id, travel_time_min=travel_time_min))

    def neighbors(self, stop_id: int) -> List[Edge]:
        return self.adj.get(stop_id, [])
