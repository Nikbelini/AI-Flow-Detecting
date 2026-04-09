from typing import Dict, List
from inference.forecast import forecast_city_blind_stops
from database.repository import PostgresRepository, StopDTO
from algorithm.passenger_flow_predictor import PassengerFlowGraphPredictor


class LoadsBuilderService:
    def __init__(self, repository: PostgresRepository):
        self.repo = repository
        self.graph_predictor = PassengerFlowGraphPredictor(repository)

    def build_loads_for_routing(self, city_id: int, dt_str: str) -> Dict[int, float]:
        """
        Возвращает словарь stop_id -> load(0..1) для маршрутизации.
        Использует актуальные данные из get_all_stops и прогноз:
          - из камер, если есть
          - алгоритмический предикт, если камеры нет
        """

        # 1) Получаем все остановки
        stops_dto: List[StopDTO] = self.repo.get_all_stops(city_id)
        stops_map = {s.id: s for s in stops_dto}
        stops = [{"id": s.id, "address": s.address, "lat": s.lat, "lng": s.lng, "url": getattr(s, "url", None)}
                 for s in stops_dto]

        # 2) Получаем прогноз от "blind stops" модели
        forecast_result = forecast_city_blind_stops(city_id, horizon=1)
        blind_forecast_map: Dict[int, float] = {}
        if forecast_result.get("predictions"):
            for item in forecast_result["predictions"]:
                blind_forecast_map[int(item["stop_id"])] = float(item["predicted_load"]) / 10.0

        # 3) Строим граф соседей для алгоритмического предикта
        edges = self.repo.get_transport_edges(city_id)
        graph: Dict[int, List[int]] = {}
        for e in edges:
            graph.setdefault(e["from_stop_id"], []).append(e["to_stop_id"])

        # 4) Собираем итоговые нагрузки
        loads: Dict[int, float] = {}
        for stop in stops:
            stop_id = stop["id"]
            has_camera = stop.get("url") is not None and str(stop.get("url")).strip() != ""

            if has_camera:
                # Если камера есть — берем актуальный load
                loads[stop_id] = normalize_load(getattr(stop, "load", 0.0))
            else:
                # Если камеры нет — используем алгоритмический предикт
                predicted, _debug_info = self.graph_predictor.predict(
                    city_id=city_id,
                    stop_id=stop_id,
                    dt_str=dt_str,
                    graph=graph,
                    stops_map=stops_map,
                    last_known_flow={}  # можно передавать реальные соседние данные при желании
                )
                # приводим к диапазону 0..1
                loads[stop_id] = max(0.0, min(1.0, predicted / 10.0))

        return loads


def normalize_load(load_value: float | None) -> float:
    """Нормализует значение load в диапазон 0..1"""
    if load_value is None:
        return 0.0
    if load_value > 1.0:
        return max(0.0, min(1.0, load_value / 10.0))
    return max(0.0, min(1.0, load_value))