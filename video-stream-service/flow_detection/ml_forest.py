from datetime import datetime
from typing import Optional, Tuple
import numpy as np
from loguru import logger
from sklearn.ensemble import RandomForestClassifier
import joblib
import os

from flow_detection.season_time import get_season, get_time_of_day
from flow_detection.enums import map_weather_code, WeatherType, TimeOfDay


class MLModelSelector:
    """ML-модель для интеллектуального выбора YOLO модели, когда точное совпадение не найдено"""
    
    def __init__(self, model_path: str = "models/ml_selector.pkl"):
        self.model_path = model_path
        self.model: Optional[RandomForestClassifier] = None
        self.label_encoder = {}
        self.inverse_label_encoder = {}
        
        # Попытка загрузить обученную модель
        if os.path.exists(model_path):
            try:
                self.model = joblib.load(model_path)
                logger.info(f"ML-модель загружена из {model_path}")
            except Exception as e:
                logger.warning(f"Не удалось загрузить ML-модель: {e}")
                self._init_new_model()
        else:
            logger.info("🆕 Создаём новую ML-модель")
            self._init_new_model()
    
    def _init_new_model(self):
        """Инициализация новой ML-модели"""
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            class_weight='balanced'
        )
    
    def _encode_features(self, weather: str, time_of_day: str, 
                        season: str, hour: int, precipitation: float) -> np.ndarray:
        """ Кодирование признаков для ML-модели """
        
        # One-hot encoding для weather
        weather_features = [
            1 if weather == "clear" else 0,
            1 if weather == "rain" else 0,
            1 if weather == "snow" else 0,
            1 if weather == "fog" else 0
        ]
        
        # Binary encoding для времени суток
        time_features = [1 if time_of_day == "day" else 0]
        
        # One-hot encoding для сезона
        season_features = [
            1 if season == "winter" else 0,
            1 if season == "spring" else 0,
            1 if season == "summer" else 0,
            1 if season == "autumn" else 0
        ]
        
        # Numeric features
        numeric_features = [hour, precipitation]
        
        features = weather_features + time_features + season_features + numeric_features
        return np.array(features).reshape(1, -1)
    
    def predict(self, weather: str, time_of_day: str, season: str, 
                hour: int, precipitation: float) -> Optional[str]:
        """ Предсказание лучшей модели через ML """
        if self.model is None or not hasattr(self.model, 'classes_'):
            logger.warning("ML-модель не обучена, пропускаем предсказание")
            return None
        
        try:
            features = self._encode_features(weather, time_of_day, season, hour, precipitation)
            prediction = self.model.predict(features)[0]
            confidence = self.model.predict_proba(features).max()
            
            logger.info(
                f"ML-предсказание: {prediction} "
                f"(уверенность: {confidence:.2%})"
            )
            
            return prediction if confidence > 0.5 else None
            
        except Exception as e:
            logger.exception(f"❌ Ошибка ML-предсказания: {e}")
            return None
    
    def train(self, training_data: list):
        """Обучение модели на данных"""
        if not training_data:
            logger.warning("Нет данных для обучения")
            return
        
        X_list = []
        y_list = []
        
        for weather, time_of_day, season, hour, precipitation, model_path in training_data:
            features = self._encode_features(weather, time_of_day, season, hour, precipitation)
            X_list.append(features[0])
            y_list.append(model_path)
        
        X = np.array(X_list)
        y = np.array(y_list)
        
        self.model.fit(X, y)
        
        # Сохраняем модель
        try:
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            joblib.dump(self.model, self.model_path)
            logger.info(f"ML-модель сохранена в {self.model_path}")
        except Exception as e:
            logger.error(f"Не удалось сохранить модель: {e}")