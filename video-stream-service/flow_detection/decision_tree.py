from datetime import datetime
from typing import Optional
from loguru import logger
from flow_detection.season_time import get_season, get_time_of_day
from flow_detection.enums import map_weather_code, WeatherType
from flow_detection.ml_forest import MLModelSelector

class YoloDecisionTree:
    def __init__(self, enable_ml: bool = True):
        self.model_map = {
            # CLEAR
            ("clear", "day", "winter"): "models/winter/yolo_day_clear.pt",
            ("clear", "night", "winter"): "models/winter/yolo_night_clear.pt",
            ("clear", "day", "spring"): "models/spring/yolo_day_clear.pt",
            ("clear", "night", "spring"): "models/spring/yolo_night_clear.pt",
            ("clear", "day", "summer"): "models/summer/yolo_day_clear.pt",
            ("clear", "night", "summer"): "models/summer/yolo_night_clear.pt",
            ("clear", "day", "autumn"): "models/autumn/yolo_day_clear.pt",
            ("clear", "night", "autumn"): "models/autumn/yolo_night_clear.pt",

            # RAIN
            # ("rain", "day", "winter"): "models/winter/yolo_day_rain.pt",
            # ("rain", "night", "winter"): "models/winter/yolo_night_rain.pt",
            # ("rain", "day", "spring"): "models/spring/yolo_day_rain.pt",
            # ("rain", "night", "spring"): "models/spring/yolo_night_rain.pt",
            # ("rain", "day", "summer"): "models/summer/yolo_day_rain.pt",
            # ("rain", "night", "summer"): "models/summer/yolo_night_rain.pt",
            # ("rain", "day", "autumn"): "models/autumn/yolo_day_rain.pt",
            # ("rain", "night", "autumn"): "models/autumn/yolo_night_rain.pt",

            # FOG
            # ("fog", "day", "any"): "models/fog/yolo_fog.pt",
            # ("fog", "night", "any"): "models/fog/yolo_fog.pt",

            # # SNOW
            # ("snow", "day", "any"): "models/snow/yolo_snow.pt",
            # ("snow", "night", "any"): "models/snow/yolo_snow.pt",
        }

        self.extreme_model = "models/extreme/yolo_extreme.pt"
        self.fallback_model = "preprocessdetect.pt"

        # ====== ВОТ ЭТОГО НЕ ХВАТАЛО ======
        self.enable_ml = enable_ml
        self.decision_history = []

        self.ml_selector = MLModelSelector() if enable_ml else None

    def select_model(self, weather_code: int, precipitation: float, current_time: datetime) -> str:
        season = get_season(current_time)
        time_of_day = get_time_of_day(current_time)
        weather = map_weather_code(weather_code, precipitation)
        hour = current_time.hour

        # Логируем астрономическую информацию
        logger.debug(
            f"🌍 Астрономия: сезон={season.value}, "
            f"час={hour:02d}:00, "
            f"время_суток={time_of_day.value}"
        )

        # Экстремальные условия имеют приоритет
        if weather == WeatherType.EXTREME:
            logger.warning(f"ЭКСТРЕМАЛЬНЫЕ УСЛОВИЯ! Используем специальную модель")
            return self.extreme_model
        
        # Формируем ключ для поиска модели
        key = (weather.value, time_of_day.value, season.value)
        
        # Пытаемся найти точное совпадение
        if key in self.model_map:
            model_path = self.model_map[key]
            logger.info(
                f"✅ Выбрана модель: {model_path}\n"
                f" Условия: погода={weather.value}, время={time_of_day.value}, "
                f"сезон={season.value}"
            )

            self._record_decision(weather, time_of_day, season, hour, 
                                precipitation, model_path)

            return model_path
        
       # ML-предсказание
        if self.enable_ml and self.ml_selector:
            ml_prediction = self.ml_selector.predict(
                weather, time_of_day, season, hour, precipitation
            )
            if ml_prediction:
                logger.info(f"Используем ML-предсказание: {ml_prediction}")
                self._record_decision(weather, time_of_day, season, hour,
                                    precipitation, ml_prediction)
                return ml_prediction
        
        # Умный поиск похожей модели
        similar_model = self._find_similar_model(weather, time_of_day, season)
        if similar_model:
            self._record_decision(weather, time_of_day, season, hour,
                                precipitation, similar_model)
            return similar_model
        
        # Fallback
        logger.error(
            f"❌ Модель не найдена для ({weather}, {time_of_day}, {season})\n"
            f"   🔄 Используем fallback: {self.fallback_model}"
        )
        return self.fallback_model
    
    def _record_decision(self, weather: str, time_of_day: str, season: str,
                        hour: int, precipitation: float, model_path: str):
        """Записываем решение в историю для обучения ML"""
        if self.enable_ml:
            decision = (weather, time_of_day, season, hour, precipitation, model_path)
            self.decision_history.append(decision)
            
            # Периодически переобучаем модель (каждые 100 решений)
            if len(self.decision_history) >= 100:
                logger.info("📊 Обучаем ML-модель на накопленных данных...")
                self.ml_selector.train(self.decision_history)
                self.decision_history = []  # Очищаем историю
    
    def get_statistics(self) -> dict:
        """Статистика по доступным моделям"""
        stats = {
            "total_models": len(self.model_map),
            "by_weather": {},
            "by_season": {},
            "by_time": {},
            "ml_enabled": self.enable_ml,
            "decision_history_size": len(self.decision_history)
        }
        
        for (weather, time, season), _ in self.model_map.items():
            stats["by_weather"][weather] = stats["by_weather"].get(weather, 0) + 1
            stats["by_season"][season] = stats["by_season"].get(season, 0) + 1
            stats["by_time"][time] = stats["by_time"].get(time, 0) + 1
        
        return stats
    

    def _find_similar_model(self, weather: str, time_of_day: str, season: str) -> Optional[str]:     
        # weather + time_of_day совпадают
        for (w, t, s), model in self.model_map.items():
            if w == weather and t == time_of_day:
                logger.info(
                    f"🔍 Найдена похожая модель (совпадение погода+время): {model}\n"
                    f"   Искали: ({weather}, {time_of_day}, {season})\n"
                    f"   Нашли:  ({w}, {t}, {s})"
                )
                return model
        
        # weather + season совпадают
        for (w, t, s), model in self.model_map.items():
            if w == weather and s == season:
                logger.info(
                    f"Найдена похожая модель (совпадение погода+сезон): {model}\n"
                    f"   Искали: ({weather}, {time_of_day}, {season})\n"
                    f"   Нашли:  ({w}, {t}, {s})"
                )
                return model
        
        # time_of_day + season совпадают, предпочитаем clear
        best_match = None
        for (w, t, s), model in self.model_map.items():
            if t == time_of_day and s == season:
                if w == "clear":
                    logger.info(
                        f"Найдена похожая модель (время+сезон, clear): {model}\n"
                        f"   Искали: ({weather}, {time_of_day}, {season})\n"
                        f"   Нашли:  ({w}, {t}, {s})"
                    )
                    return model
                elif best_match is None:
                    best_match = model
        
        if best_match:
            logger.info(f"🔍 Найдена похожая модель (время+сезон): {best_match}")
            return best_match
        
        return None