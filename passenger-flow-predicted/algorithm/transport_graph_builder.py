from typing import Dict, List
from database.repository import StopDTO
from algorithm.geo import haversine

class TransportGrapthBuilder:

    def __init__(self, max_distance_km: float = 1.0):
        self.max_distance_km = max_distance_km

    def build_graph(
            self,
            stops: List[StopDTO],
            route_edges: List[tuple[int, int]]
    ) -> Dict[int, List[int]]:
        """
        Итоговый граф:
            - рёбра из маршрутов (основные)
            - + доп рёбра по расстоянию (чтобы сеть была плотнее)
        """

        graph: Dict[int, List[int]] = {s.id: [] for s in stops}

        # Связи по маршрутам (важнейшее)
        for a, b in route_edges:
            if a in graph and b in graph:
                graph[a].append(b)
                graph[b].append(a)

        # Доп связи по расстоянию (чтобы учитывать соседние остановки)
        stop_list = list(stops)

        for i in range(len(stop_list)):
            for j in range(i + 1, len(stop_list)):
                si = stop_list[i]
                sj = stop_list[j]

                dist = haversine(si.lat, si.lng, sj.lat, sj.lng)
                if dist <= self.max_distance_km:
                    graph[si.id].append(sj.id)
                    graph[sj.id].append(si.id)

        # Удаляем дубликаты
        for k in graph.keys():
            graph[k] = list(set(graph[k]))

        return graph