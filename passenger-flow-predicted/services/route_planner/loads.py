import logging
from typing import Dict, List

from inference.forecast import forecast_city_blind_stops
from database.repository import PostgresRepository, StopDTO
from algorithm.passenger_flow_predictor import PassengerFlowGraphPredictor

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,  # или DEBUG для детальных логов
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

class LoadsBuilderService:
    def __init__(self, repository: PostgresRepository):
        self.repo = repository
        self.graph_predictor = PassengerFlowGraphPredictor(repository)

    def build_loads_for_routing(self, city_id: int, dt_str: str) -> Dict[int, float]:
        logger.info(f"build_loads_for_routing START: city={city_id}, dt={dt_str}")

        # 1) Получаем все остановки
        logger.debug(f"Loading stops for city {city_id}...")
        stops_dto: List[StopDTO] = self.repo.get_all_stops(city_id)
        logger.info(f"Loaded {len(stops_dto)} stops for city {city_id}")
        
        if not stops_dto:
            logger.error(f"No stops found for city {city_id}")
            return {}

        stops_map = {s.id: s for s in stops_dto}
        stops = [
            {"id": s.id, "address": s.address, "lat": s.lat, "lng": s.lng, "url": getattr(s, "url", None)}
            for s in stops_dto
        ]

        # 2) Получаем прогноз от "blind stops" модели
        logger.debug(f"Fetching blind forecast for city {city_id}...")
        forecast_result = forecast_city_blind_stops(city_id, horizon=1)
        blind_forecast_map: Dict[int, float] = {}
        
        if forecast_result.get("predictions"):
            for item in forecast_result["predictions"]:
                blind_forecast_map[int(item["stop_id"])] = float(item["predicted_load"]) / 10.0
            logger.info(f"Blind forecast: {len(blind_forecast_map)} stops with predictions")
        else:
            logger.warning(f"No predictions in forecast_result: {forecast_result.get('status')}")

        # 3) Строим граф соседей для алгоритмического предикта
        logger.debug(f"🕸️  Building neighbor graph...")
        edges = self.repo.get_transport_edges(city_id)
        graph: Dict[int, List[int]] = {}
        for e in edges:
            graph.setdefault(e["from_stop_id"], []).append(e["to_stop_id"])
        logger.info(f"Neighbor graph: {len(graph)} nodes with outgoing edges")

        # 4) Собираем итоговые нагрузки
        logger.debug(f"Computing final loads...")
        loads: Dict[int, float] = {}
        camera_count = 0
        predicted_count = 0
        
        for stop in stops:
            stop_id = stop["id"]
            has_camera = stop.get("url") is not None and str(stop.get("url")).strip() != ""

            if has_camera:
                # Если камера есть — берем актуальный load
                raw_load = getattr(stop, "load", 0.0)
                loads[stop_id] = normalize_load(raw_load)
                camera_count += 1
            else:
                # Если камеры нет — используем алгоритмический предикт
                try:
                    predicted, _debug_info = self.graph_predictor.predict(
                        city_id=city_id,
                        stop_id=stop_id,
                        dt_str=dt_str,
                        graph=graph,
                        stops_map=stops_map,
                        last_known_flow={}
                    )
                    loads[stop_id] = max(0.0, min(1.0, predicted / 10.0))
                    predicted_count += 1
                except Exception as e:
                    logger.warning(f"Prediction failed for stop {stop_id}: {e}")
                    loads[stop_id] = 0.0  # fallback

        logger.info(f"Loads built: total={len(loads)}, from_camera={camera_count}, predicted={predicted_count}")
        
        # === ФИНАЛЬНАЯ ПРОВЕРКА ===
        if not loads:
            logger.error(f"Final loads dictionary is EMPTY — routing will fail")
        
        return loads


def normalize_load(load_value: float | None) -> float:
    """Нормализует значение load в диапазон 0..1"""
    if load_value is None:
        return 0.0
    if load_value > 1.0:
        return max(0.0, min(1.0, load_value / 10.0))
    return max(0.0, min(1.0, load_value))