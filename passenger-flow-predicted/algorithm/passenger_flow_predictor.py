from typing import Dict, List, Tuple
from database.repository import PostgresRepository, StopDTO
from algorithm.geo import haversine
from algorithm.time_coeff import TimeCorfficientService


class PassengerFlowGraphPredictor:

    def __init__(
        self,
        repository: PostgresRepository,
        alpha: float = 1.0,
        beta: float = 25.0,
        gamma: float = 0.8,
        delta: float = 15.0,
        transfer_coeff: float = 10.0
    ):
        self.repository = repository
        self.alpha = alpha
        self.beta = beta
        self.gamma = gamma
        self.delta = delta

        # коэффициент "пересадочного узла"
        self.transfer_coeff = transfer_coeff

        self.time_service = TimeCorfficientService()

    def calc_Ci(self, stop: StopDTO, city_center: Tuple[float, float]) -> float:
        Di = haversine(stop.lat, stop.lng, city_center[0], city_center[1])
        return 1 / (Di + 1)
    
    def calc_Ri(self, stop_id: int) -> float:
        routes = self.repository.get_routes_by_stop(stop_id)
        return sum(r.frequency for r in routes)
    
    def calc_transfer_Hi(self, stop_id: int) -> float:
        """
        Узловой коэффициент пересадки. Чем больше маршрутов проходит через остановку.
        """
        routes = self.repository.get_routes_by_stop(stop_id)
        return len(routes)
    
    def calc_Wij(self, stop_i: StopDTO, stop_j: StopDTO) -> float:
        dij = haversine(stop_i.lat, stop_i.lng, stop_j.lat, stop_j.lng)

        Mij = self.repository.count_common_routes(stop_i.id, stop_j.id)
        Kij = 1 + 0.5 * Mij

        Wij = Kij / (dij + 1)
        return Wij
    
    def predict(self, city_id: int, stop_id: int, dt_str: str, graph: Dict[int, List[int]],
        stops_map: Dict[int, StopDTO], last_known_flow: Dict[str, float], neighbors_limit: int = 10
    ) -> tuple[float, dict]:
        
        if stop_id not in stops_map:
            raise ValueError("Stop not found")
        
        target = stops_map[stop_id]

        city_center = self.repository.get_city_center(city_id)

        Ci = self.calc_Ci(target, city_center)
        Ri = self. calc_Ri(stop_id)
        Hi = self.calc_transfer_Hi(stop_id)
        Tt = self.time_service.get_T(dt_str)

        neighbors = graph.get(stop_id, [])
        
        # считаем Wij для всех соседей
        neighbor_data = []
        for nid in neighbors:
            neighbor_stop = stops_map.get(nid)
            if neighbor_stop is None:
                continue

            Wij = self.calc_Wij(target, neighbor_stop)
            neighbor_data.append((nid, neighbor_stop, Wij))  # ← Исправлено: кортеж из 3 элементов

        # берём топ K по Wij
        neighbor_data.sort(key=lambda x: x[2], reverse=True)
        neighbor_data = neighbor_data[:neighbors_limit]
        
        # берём топ K по Wij
        neighbor_data.sort(key=lambda x: x[2], reverse=True)
        neighbor_data = neighbor_data[:neighbors_limit]

        weighted_sum = 0.0
        weight_total = 0.0
        used = 0

        debug_neighbors = []

        for nid, neighbor_stop, Wij in neighbor_data:
            Pj = last_known_flow.get(neighbor_stop.address)
            if Pj is None:
                continue

            weighted_sum += Wij * Pj
            weight_total += Wij
            used += 1

            debug_neighbors.append({
                "neighbor_id": nid,
                "neighbor_address": neighbor_stop.address,
                "Pj (last)": Pj,
                "Wij": Wij
            })

        # нормализованный вклад соседей
        if used > 0 and weight_total > 0:
            neighbors_part = weighted_sum / weight_total
        else:
            neighbors_part = 0.0

        # fallback если соседей с данными нет
        if used == 0:
            predicted = self.beta * Ci + self.gamma * Ri + self.delta * Tt + self.transfer_coeff * Hi
            
            return predicted, {
                "fallback": True,
                "Ci": Ci,
                "Ri": Ri,
                "Hi": Hi,
                "T(t)": Tt 
            }
        
        # Итоговая формула
        predicted = self.alpha * neighbors_part + self.beta * Ci + self.gamma * Ri + self.delta * Tt + self.transfer_coeff * Hi

        return predicted, {
            "fallback": False,
            "neighbors_used": used,
            "neighbors_total": len(neighbor_data),
            "Ci": Ci,
            "Ri": Ri,
            "Hi": Hi,
            "T(t)": Tt,
            "neighbors_part": neighbors_part,
            "neighbors": debug_neighbors
        }
