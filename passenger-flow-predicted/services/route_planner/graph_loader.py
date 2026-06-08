from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

from services.route_planner.walking_edges import WALK_ROUTE_ID

@dataclass(frozen=True)
class Edge:
    to_stop: int
    dist_km: float
    route_id: int
    travel_time_min: Optional[float] = None

    @property
    def is_walk(self) -> bool:
        return self.route_id == WALK_ROUTE_ID


class TransportGraph:
    def __init__(self):
        self.adj: Dict[int, List[Edge]] = {}

    def add_edge(self, from_stop: int, to_stop: int, dist_km: float,
            route_id: int, travel_time_min: float | None = None):
        if dist_km < 0:
            raise ValueError(f"dist_km must be >= 0, got {dist_km}")
        self.adj.setdefault(from_stop, []).append(
            Edge(
                to_stop=to_stop, 
                dist_km=dist_km,
                route_id=route_id, 
                travel_time_min=travel_time_min
            )
        )
    
    def add_walking_edges_bulk(
        self,
        edges: list,
    ) -> int:
        """Массово добавляет пешеходные рёбра"""
        count = 0
        for from_stop, to_stop, dist_km, t_min in edges:
            self.add_edge(
                from_stop=from_stop,
                to_stop=to_stop,
                dist_km=dist_km,
                route_id=WALK_ROUTE_ID,
                travel_time_min=t_min,
            )
            count += 1
            
        return count

    def neighbors(self, stop_id: int) -> List[Edge]:
        return self.adj.get(stop_id, [])

    def __len__(self) -> int:
        return len(self.adj)
