# app/services/statistical_model.py
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import logging
from scipy import stats
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
import joblib
import os

from app.models.data_models import Stop, StopHistory, WeatherData, Event

logger = logging.getLogger(__name__)

class StatisticalModel:
    def __init__(self):
        self.models = {}
        self.scaler = StandardScaler()
        self.model_dir = "models"
        
        if not os.path.exists(self.model_dir):
            os.makedirs(self.model_dir)
    
    async def load_models(self):
        """Загрузить предобученные модели"""
        try:
            # Попытка загрузить сохраненные модели
            for model_file in os.listdir(self.model_dir):
                if model_file.endswith('.pkl'):
                    model_name = model_file.replace('.pkl', '')
                    model_path = os.path.join(self.model_dir, model_file)
                    self.models[model_name] = joblib.load(model_path)
            logger.info(f"Loaded {len(self.models)} models")
        except Exception as e:
            logger.warning(f"Could not load models: {e}")
            self.models = {}
    
    def save_models(self):
        """Сохранить модели"""
        for name, model in self.models.items():
            model_path = os.path.join(self.model_dir, f"{name}.pkl")
            joblib.dump(model, model_path)
    
    def analyze_stop_patterns(self, stop: Stop) -> Dict:
        """Анализ паттернов остановки"""
        if not stop.historical_data:
            return {}
        
        # Преобразуем в DataFrame
        df = pd.DataFrame([hist.dict() for hist in stop.historical_data])
        df['datetime'] = pd.to_datetime(df['datetime'])
        
        # Извлекаем особенности времени
        df['hour'] = df['datetime'].dt.hour
        df['day_of_week'] = df['datetime'].dt.dayofweek
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        
        analysis = {
            'stop_id': stop.id,
            'total_records': len(df),
            'date_range': {
                'start': df['datetime'].min(),
                'end': df['datetime'].max()
            }
        }
        
        # Статистика по часам
        hourly_stats = df.groupby('hour').agg({
            'count': ['mean', 'std', 'min', 'max', 'count']
        }).round(2)
        
        analysis['hourly_pattern'] = hourly_stats.to_dict()
        
        # Статистика по дням недели
        daily_stats = df.groupby('day_of_week').agg({
            'count': ['mean', 'std']
        }).round(2)
        analysis['daily_pattern'] = daily_stats.to_dict()
        
        # Тренды
        df['date'] = df['datetime'].dt.date
        daily_trend = df.groupby('date')['count'].mean()
        
        # Линейный тренд
        if len(daily_trend) > 1:
            X = np.arange(len(daily_trend)).reshape(-1, 1)
            y = daily_trend.values
            lr = LinearRegression()
            lr.fit(X, y)
            analysis['trend'] = {
                'slope': float(lr.coef_[0]),
                'intercept': float(lr.intercept_),
                'r_squared': float(lr.score(X, y))
            }
        
        # Сезонность
        analysis['peak_hours'] = hourly_stats[('count', 'mean')].nlargest(3).index.tolist()
        analysis['low_hours'] = hourly_stats[('count', 'mean')].nsmallest(3).index.tolist()
        
        return analysis
    
    def predict_demand(self, stop_id: int, 
                      datetime_range: pd.DatetimeIndex,
                      weather_data: Optional[List[WeatherData]] = None,
                      events: Optional[List[Event]] = None) -> pd.DataFrame:
        """Прогнозирование спроса"""
        
        # Базовое предсказание на основе исторических паттернов
        predictions = []
        
        for dt in datetime_range:
            hour = dt.hour
            day_of_week = dt.dayofweek
            is_weekend = 1 if day_of_week in [5, 6] else 0
            
            # Базовая модель (можно заменить на обученную)
            base_demand = self._get_base_demand(stop_id, hour, day_of_week)
            
            # Корректировки
            adjustments = self._calculate_adjustments(
                dt, base_demand, weather_data, events
            )
            
            final_demand = base_demand * adjustments['total_factor']
            
            predictions.append({
                'datetime': dt,
                'stop_id': stop_id,
                'base_demand': base_demand,
                'final_demand': final_demand,
                'adjustments': adjustments
            })
        
        return pd.DataFrame(predictions)
    
    def _get_base_demand(self, stop_id: int, hour: int, day_of_week: int) -> float:
        """Получить базовый спрос"""
        # Здесь должна быть логика из исторических данных
        # Пока заглушка
        base_pattern = {
            0: {  # Понедельник
                7: 100, 8: 150, 9: 120, 17: 180, 18: 200
            }
        }
        
        hourly_pattern = base_pattern.get(day_of_week % 7, {})
        return hourly_pattern.get(hour, 50)
    
    def _calculate_adjustments(self, dt: datetime,
                              base_demand: float,
                              weather_data: Optional[List[WeatherData]] = None,
                              events: Optional[List[Event]] = None) -> Dict:
        """Рассчитать корректировки спроса"""
        adjustments = {
            'weather_factor': 1.0,
            'event_factor': 1.0,
            'time_factor': 1.0,
            'total_factor': 1.0
        }
        
        # Погодные корректировки
        if weather_data:
            weather = self._get_weather_for_datetime(dt, weather_data)
            if weather:
                adjustments['weather_factor'] = self._calculate_weather_factor(weather)
        
        # Корректировка событий
        if events:
            event = self._get_event_for_date(dt, events)
            if event:
                adjustments['event_factor'] = self._calculate_event_factor(event)
        
        # Временные корректировки
        adjustments['time_factor'] = self._calculate_time_factor(dt)
        
        # Общий фактор
        adjustments['total_factor'] = (
            adjustments['weather_factor'] *
            adjustments['event_factor'] *
            adjustments['time_factor']
        )
        
        return adjustments
    
    def _get_weather_for_datetime(self, dt: datetime, 
                                 weather_data: List[WeatherData]) -> Optional[WeatherData]:
        """Получить погоду для даты"""
        for weather in weather_data:
            if weather.datetime.date() == dt.date():
                return weather
        return None
    
    def _calculate_weather_factor(self, weather: WeatherData) -> float:
        """Рассчитать фактор погоды"""
        factor = 1.0
        
        if weather.precipitation:
            if weather.precipitation > 10:
                factor *= 1.2  # Дождь увеличивает спрос на транспорт
            elif weather.precipination > 5:
                factor *= 1.1
        
        if weather.temperature:
            if weather.temperature < -10:
                factor *= 1.15  # Сильный холод
            elif weather.temperature > 30:
                factor *= 1.1   # Сильная жара
        
        return factor
    
    def _get_event_for_date(self, dt: datetime, 
                           events: List[Event]) -> Optional[Event]:
        """Получить событие для даты"""
        for event in events:
            if event.event_date.date() == dt.date():
                return event
        return None
    
    def _calculate_event_factor(self, event: Event) -> float:
        """Рассчитать фактор события"""
        factor = 1.0
        
        if event.is_holiday:
            factor *= 0.7  # Выходные - меньше спроса на работу/учебу
        
        if event.has_special_event:
            if event.event_type == 'concert':
                factor *= 1.5
            elif event.event_type == 'sports':
                factor *= 1.8
            elif event.event_type == 'festival':
                factor *= 2.0
        
        return factor
    
    def _calculate_time_factor(self, dt: datetime) -> float:
        """Рассчитать временной фактор"""
        hour = dt.hour
        
        # Пиковые часы
        if 7 <= hour <= 9:  # Утро
            return 1.3
        elif 17 <= hour <= 19:  # Вечер
            return 1.4
        elif 22 <= hour or hour <= 5:  # Ночь
            return 0.3
        else:  # День
            return 0.8
    
    def calculate_correlation_matrix(self, stops: List[Stop]) -> pd.DataFrame:
        """Рассчитать корреляционную матрицу между остановками"""
        if not stops:
            return pd.DataFrame()
        
        # Создаем временные ряды для каждой остановки
        stop_series = {}
        
        for stop in stops:
            if stop.historical_data:
                df = pd.DataFrame([hist.dict() for hist in stop.historical_data])
                df['datetime'] = pd.to_datetime(df['datetime'])
                df.set_index('datetime', inplace=True)
                
                # Ресемплируем по часам
                hourly_series = df['count'].resample('H').mean()
                stop_series[stop.id] = hourly_series
        
        # Создаем DataFrame из всех временных рядов
        all_data = pd.DataFrame(stop_series)
        
        # Рассчитываем корреляцию
        correlation_matrix = all_data.corr()
        
        return correlation_matrix
    
    def identify_transfer_patterns(self, correlation_matrix: pd.DataFrame, 
                                  threshold: float = 0.7) -> List[Tuple[int, int]]:
        """Выявить паттерны пересадок между остановками"""
        patterns = []
        
        for i in range(len(correlation_matrix.columns)):
            for j in range(i + 1, len(correlation_matrix.columns)):
                corr = correlation_matrix.iloc[i, j]
                if corr > threshold:
                    stop1 = correlation_matrix.columns[i]
                    stop2 = correlation_matrix.columns[j]
                    patterns.append((stop1, stop2, corr))
        
        # Сортируем по силе корреляции
        patterns.sort(key=lambda x: x[2], reverse=True)
        
        return patterns