from typing import Dict, List, Tuple
from database.repository import PostgresRepository, StopDTO
from algorithm.geo import haversine
from algorithm.time_coeff import TimeCorfficientService
import math


class PassengerFlowGraphPredictor:

    """Алгоритмический предиктор пассажиропотока на основе графа остановок
    Формула:
        predicted = (alpha * neighbors_part + beta * Ci + gamma * Ri + transfer_coeff * Hi) * Tt
        Мультипликативный временной коэффициент умножается на весь прогноз, а не прибавляется как 
        слагаемое, что даёт корректный результат.
        Ночью прогноз стремится к 0, а в часы пик усиливается пропорционально.
        Timezone определяется автоматически по координатам/названию города.
    """
    def __init__(
        self,
        repository: PostgresRepository,
        alpha: float = 1.0,
        beta: float = 8.0,
        gamma: float = 0.3,
        transfer_coeff: float = 1.5,

        timezone: str | None = None,
        lat: float | None = None,
        lng: float | None = None,
        city_name: str | None = None,
    ):
        self.repository = repository
        self.alpha = alpha
        self.beta = beta
        self.gamma = gamma

        # коэффициент "пересадочного узла"
        self.transfer_coeff = transfer_coeff

        self.time_service = TimeCorfficientService(
            timezone=timezone,
            lat=lat,
            lng=lng,
            city_name=city_name
        )

        self._wij_cache: dict[tuple[int, int], float] = {}
        self._ri_cache: dict[int, float] = {}
        self._hi_cache: dict[int, float] = {}

    # фабричный метод (предиктор для конкретного города)
    @classmethod
    def for_city(
        cls,
        repository: PostgresRepository,
        city_id: int,
        **kwargs,
    ) -> "PassengerFlowGraphPredictor":
        """
        Создаёт предиктор с автоматическим определением timezone по city_id.
        """
        city_info = repository.get_city_info(city_id)
        return cls(
            repository=repository,
            lat=city_info.get("center_lat"),
            lng=city_info.get("center_lng"),
            city_name=city_info.get("city_name"),
            **kwargs,
        )

    def calc_Ci(self, stop: StopDTO, city_center: Tuple[float, float]) -> float:
        """Центральность (чем ближе к центру, тем выше)"""
        Di = haversine(stop.lat, stop.lng, city_center[0], city_center[1])
        return 1.0 / (Di + 1.0)
    
    def calc_Ri(self, stop_id: int) -> float:
        """Маршрутная насыщенность (суммарная частота маршрутов)"""
        if stop_id not in self._ri_cache:
            routes = self.repository.get_routes_by_stop(stop_id)
            raw = sum(r.frequency for r in routes)
            self._ri_cache[stop_id] = math.log1p(raw)  # log(1 + x)
        return self._ri_cache[stop_id]
    
    def calc_transfer_Hi(self, stop_id: int) -> float:
        """
        Узловой коэффициент пересадки. Чем больше маршрутов проходит через остановку.
        """
        if stop_id not in self._hi_cache:
            routes = self.repository.get_routes_by_stop(stop_id)
            self._hi_cache[stop_id] = math.log1p(len(routes))
        return self._hi_cache[stop_id]
    
    def calc_Wij(self, stop_i: StopDTO, stop_j: StopDTO) -> float:
        """Вес ребра (близость + общие маршруты)"""
        key = (min(stop_i.id, stop_j.id), max(stop_i.id, stop_j.id))
        if key not in self._wij_cache:
            dij = haversine(stop_i.lat, stop_i.lng, stop_j.lat, stop_j.lng)

            Mij = self.repository.count_common_routes(stop_i.id, stop_j.id)
            self._wij_cache[key] = (1.0 + 0.5 * Mij) / (dij + 1.0)

        return self._wij_cache[key]
    
    
    # Ночной zero-порог
    def _night_zero_check(
        self, Tt: float, Ci: float, dt_str: str
    ) -> tuple[bool, dict]:
        """Для периферийных остановок в глубокуб ночь сразу возвращаем 0.
        Центральные узлы получают небольшой ненулевой прогноз даже ночью"""
        if not self.time_service.is_night(dt_str):
            return False, {}
        
        is_peripheral = Ci < 0.15
        if is_peripheral:
            return True, {
                "night_zero": True,
                "Tt": Tt,
                "Ci": Ci,
                "reason": "deep_night + peripheral - 0",
            }
        return False, {}


    def predict(self, city_id: int, stop_id: int, dt_str: str, graph: Dict[int, List[int]],
        stops_map: Dict[int, StopDTO], last_known_flow: Dict[str, float], neighbors_limit: int = 10
    ) -> tuple[float, dict]:
        """Прогнозируем пассажиропоток для одной остановки."""
        MAX_PREDICTED_FLOW = 67.0
        
        if stop_id not in stops_map:
            raise ValueError(f"Stop {stop_id} not found in stops_map")
        
        target = stops_map[stop_id]

        city_center = self.repository.get_city_center(city_id)

        Ci = self.calc_Ci(target, city_center)
        Ri = self.calc_Ri(stop_id)
        Hi = self.calc_transfer_Hi(stop_id)
        Tt = self.time_service.get_T(dt_str)
        profile = self.time_service.get_profile_label(dt_str)
        is_peak = self.time_service.is_peak_hour(dt_str)

        # Ночной zero-порог для периферии
        should_zero, zero_debug = self._night_zero_check(Tt, Ci, dt_str)
        if should_zero:
            return 0.0, {**zero_debug, "profile": profile, "is_peak": is_peak}
        
        # Собираем данные соседей
        neighbors = graph.get(stop_id, [])
        
        # считаем Wij для всех соседей
        neighbor_data: list[tuple[int, StopDTO, float]] = []
        for nid in neighbors:
            neighbor_stop = stops_map.get(nid)
            if neighbor_stop is None:
                continue

            Wij = self.calc_Wij(target, neighbor_stop)
            neighbor_data.append((nid, neighbor_stop, Wij))

        # берём топ-K соседей по весу (по Wij)
        neighbor_data.sort(key=lambda x: x[2], reverse=True)
        neighbor_data = neighbor_data[:neighbors_limit]
        
        # Взвешенное среднее по соседям
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
                "Wij": round(Wij, 4),
            })

        # нормализованный вклад соседей
        if used > 0 and weight_total > 0:
            neighbors_part = weighted_sum / weight_total
        else:
            neighbors_part = 0.0

        # fallback если соседей с данными нет
        if used == 0:
            base = self.beta * Ci + self.gamma * Ri + self.transfer_coeff * Hi
            predicted = max(0.0, min(MAX_PREDICTED_FLOW, base * Tt))
            
            return predicted, {
                "fallback": True,
                "predicted": round(predicted, 2),
                "base": round(base, 2),
                "Tt": round(Tt, 5),
                "Ci": round(Ci, 5),
                "Ri": round(Ri, 5),
                "Hi": Hi,
                "profile": profile,
                "is_peak": is_peak,
                "formula": "base * Tt (no neighbors)",
            }
        
        # Итоговая формула
        base = self.alpha * neighbors_part + self.beta * Ci + self.gamma * Ri + self.transfer_coeff * Hi
        
        predicted = max(0.0, base * Tt)

        return predicted, {
            "fallback": False,
            "predicted": round(predicted, 2),
            "base": round(base, 2),
            "T(t)": round(Tt, 5),
            "Ci": round(Ci, 5),
            "Ri": round(Ri, 5),
            "Hi": Hi,
            "neighbors_used": used,
            "neighbors_total": len(neighbor_data),
            "neighbors_part": round(neighbors_part, 2),
            "profile": profile,
            "is_peak": is_peak,
            "neighbors": debug_neighbors,
            "formula": "base * Tt",
        }
