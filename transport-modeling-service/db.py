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
                "SELECT id, address, lat, lng FROM stops WHERE city_id = $1",
                city_id
            )
            return [dict(row) for row in rows]
    
    async def get_stop_by_id(self, stop_id: int) -> Optional[Dict]:
        """Получение остановки по ID"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, address, lat, lng FROM stops WHERE id = $1",
                stop_id
            )
            return dict(row) if row else None
    
    async def get_stop_history(self, stop_id: int, days: int = 90) -> List[Dict]:
        """Получение исторических данных остановки"""
        async with self.pool.acquire() as conn:
            cutoff = datetime.now() - timedelta(days=days)
            
            rows = await conn.fetch("""
                SELECT 
                    EXTRACT(HOUR FROM datetime) as hour,
                    EXTRACT(DOW FROM datetime) as dow,
                    count,
                    velocity,
                    load
                FROM stops_history 
                WHERE stop_id = $1 AND datetime >= $2
                ORDER BY datetime
            """, stop_id, cutoff)
            
            return [dict(row) for row in rows]
    
    async def get_stops_with_history(self, city_id: int, days: int = 90) -> List[Dict]:
        """
        Получение всех остановок города с их историческими паттернами
        """
        # Получаем список остановок
        stops = await self.get_stops_by_city(city_id)
        
        for stop in stops:
            # Получаем историю
            history = await self.get_stop_history(stop["id"], days)
            
            if history:
                # Считаем паттерн по часам
                pattern = []
                for hour in range(24):
                    hour_data = [h for h in history if h["hour"] == hour]
                    if hour_data:
                        avg = np.mean([h["count"] for h in hour_data])
                        pattern.append(round(float(avg), 1))
                    else:
                        pattern.append(0)
                
                stop["avg_pattern"] = pattern
                stop["avg_count"] = float(np.mean([h["count"] for h in history]))
                stop["avg_load"] = float(np.mean([h["load"] for h in history]))
                stop["max_count"] = int(np.max([h["count"] for h in history]))
                
                # Определяем кластер
                morning = np.max(pattern[6:10])
                day = np.mean(pattern[10:16])
                evening = np.max(pattern[16:20])
                
                if morning > day * 1.5 and evening > day * 1.5:
                    stop["cluster"] = "office"
                    stop["peak_hours"] = [7, 8, 9, 17, 18, 19]
                elif day > morning * 1.3 and evening > day:
                    stop["cluster"] = "shopping"
                    stop["peak_hours"] = [12, 13, 14, 18, 19]
                else:
                    stop["cluster"] = "residential"
                    stop["peak_hours"] = [8, 9, 18, 19]
            else:
                # Нет истории - значения по умолчанию
                stop["avg_pattern"] = [5] * 24
                stop["avg_count"] = 5
                stop["avg_load"] = 3
                stop["cluster"] = "unknown"
                stop["peak_hours"] = []
        
        return stops