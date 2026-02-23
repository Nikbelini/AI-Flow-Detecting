# transport-modeling-service/db.py
import asyncpg
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime, timedelta
import numpy as np

logger = logging.getLogger(__name__)

class DatabaseService:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool
    
    async def get_city_data(self, city_id: int) -> Optional[Dict]:
        """Получение информации о городе"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, name, lat, lng FROM cities WHERE id = $1",
                city_id
            )
            if row:
                return dict(row)
            return None
    
    async def get_stops_by_city(self, city_id: int) -> List[Dict]:
        """Получение всех остановок города"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, address, lat, lng, count as current_count, 
                          velocity as current_velocity, load as current_load
                   FROM stops 
                   WHERE city_id = $1""",
                city_id
            )
            return [dict(row) for row in rows]
    
    async def get_stop_by_id(self, stop_id: int) -> Optional[Dict]:
        """Получение остановки по ID"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT id, address, lat, lng, count as current_count,
                          velocity as current_velocity, load as current_load
                   FROM stops 
                   WHERE id = $1""",
                stop_id
            )
            return dict(row) if row else None
    
    async def get_stop_history_by_address(self, city_id: int, address: str, days: int = 90) -> List[Dict]:
        """
        Получение исторических данных по адресу остановки
        (исправлено: используем city_id + address вместо stop_id)
        """
        async with self.pool.acquire() as conn:
            cutoff = datetime.now() - timedelta(days=days)
            
            rows = await conn.fetch("""
                SELECT 
                    EXTRACT(HOUR FROM datetime) as hour,
                    EXTRACT(DOW FROM datetime) as dow,
                    count,
                    velocity,
                    load,
                    datetime
                FROM stops_history 
                WHERE city_id = $1 AND address = $2 AND datetime >= $3
                ORDER BY datetime
            """, city_id, address, cutoff)
            
            return [dict(row) for row in rows]
    
    async def get_stops_with_history(self, city_id: int, days: int = 90) -> List[Dict]:
        """
        Получение всех остановок города с их историческими паттернами
        (исправлено: история ищется по адресу, а не по stop_id)
        """
        # Получаем список остановок
        stops = await self.get_stops_by_city(city_id)
        
        for stop in stops:
            # Получаем историю по адресу (не по ID!)
            history = await self.get_stop_history_by_address(
                city_id, 
                stop["address"], 
                days
            )
            
            if history and len(history) > 0:
                # Считаем паттерн по часам
                pattern = []
                for hour in range(24):
                    hour_data = [h for h in history if h["hour"] == hour]
                    if hour_data:
                        avg = np.mean([h["count"] for h in hour_data])
                        pattern.append(round(float(avg), 1))
                    else:
                        # Интерполяция соседних часов
                        prev_hour = (hour - 1) % 24
                        next_hour = (hour + 1) % 24
                        prev_data = [h for h in history if h["hour"] == prev_hour]
                        next_data = [h for h in history if h["hour"] == next_hour]
                        
                        if prev_data and next_data:
                            avg = (np.mean([h["count"] for h in prev_data]) + 
                                   np.mean([h["count"] for h in next_data])) / 2
                            pattern.append(round(float(avg), 1))
                        else:
                            pattern.append(0)
                
                stop["avg_pattern"] = pattern
                stop["avg_count"] = float(np.mean([h["count"] for h in history]))
                stop["avg_load"] = float(np.mean([h["load"] for h in history]))
                stop["max_count"] = int(np.max([h["count"] for h in history]))
                stop["history_points"] = len(history)
                
                # Определяем кластер на основе паттерна
                pattern_array = np.array(pattern)
                morning_peak = np.mean(pattern_array[7:10])  # 7-9 утра
                day_avg = np.mean(pattern_array[10:16])      # 10-15 день
                evening_peak = np.mean(pattern_array[17:20]) # 17-19 вечер
                
                if morning_peak > day_avg * 1.8 and evening_peak > day_avg * 1.8:
                    stop["cluster"] = "office"
                    stop["peak_hours"] = [7, 8, 9, 17, 18, 19]
                elif day_avg > morning_peak * 1.3 and evening_peak > day_avg:
                    stop["cluster"] = "shopping"
                    stop["peak_hours"] = [12, 13, 14, 18, 19]
                elif morning_peak > evening_peak:
                    stop["cluster"] = "educational"
                    stop["peak_hours"] = [8, 9, 10]
                else:
                    stop["cluster"] = "residential"
                    stop["peak_hours"] = [8, 9, 18, 19]
            else:
                # Нет истории - значения по умолчанию
                stop["avg_pattern"] = [5] * 24
                stop["avg_count"] = stop.get("current_count", 5)
                stop["avg_load"] = stop.get("current_load", 3)
                stop["cluster"] = "unknown"
                stop["peak_hours"] = []
                stop["history_points"] = 0
        
        return stops
    
    async def get_stop_analytics(self, stop_id: int, days: int = 30) -> Optional[Dict]:
        """
        Получение аналитики по конкретной остановке
        """
        # Сначала получаем остановку
        stop = await self.get_stop_by_id(stop_id)
        if not stop:
            return None
        
        # Получаем историю по адресу
        history = await self.get_stop_history_by_address(
            stop["city_id"] if "city_id" in stop else 1,
            stop["address"],
            days
        )
        
        if not history:
            return stop
        
        # Агрегируем по дням недели
        daily_pattern = {}
        for record in history:
            dow = record["dow"]
            hour = record["hour"]
            if dow not in daily_pattern:
                daily_pattern[dow] = {}
            if hour not in daily_pattern[dow]:
                daily_pattern[dow][hour] = []
            daily_pattern[dow][hour].append(record["count"])
        
        # Усредняем
        for dow in daily_pattern:
            for hour in daily_pattern[dow]:
                daily_pattern[dow][hour] = float(np.mean(daily_pattern[dow][hour]))
        
        stop["daily_pattern"] = daily_pattern
        stop["avg_daily"] = float(np.mean([h["count"] for h in history]))
        stop["trend"] = self._calculate_trend(history)
        
        return stop
    
    def _calculate_trend(self, history: List[Dict]) -> str:
        """Определение тренда"""
        if len(history) < 7:
            return "insufficient_data"
        
        # Группируем по дням
        by_day = {}
        for record in history:
            date = record["datetime"].date()
            if date not in by_day:
                by_day[date] = []
            by_day[date].append(record["count"])
        
        # Средние по дням
        daily_avgs = [float(np.mean(v)) for v in by_day.values()]
        
        if len(daily_avgs) < 3:
            return "stable"
        
        # Простой линейный тренд
        first_week = np.mean(daily_avgs[:min(7, len(daily_avgs))])
        last_week = np.mean(daily_avgs[-min(7, len(daily_avgs)):])
        
        if last_week > first_week * 1.2:
            return "growing"
        elif last_week < first_week * 0.8:
            return "declining"
        else:
            return "stable"