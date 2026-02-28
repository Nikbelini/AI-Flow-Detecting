# transport-modeling-service/db.py
import asyncpg
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime, timedelta
import numpy as np
import math

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
        """
        # Получаем список остановок
        stops = await self.get_stops_by_city(city_id)
        
        for stop in stops:
            # Получаем историю по адресу
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
    
    async def get_routes_with_path(self, city_id: int) -> List[Dict]:
        """
        Получение маршрутов с остановками для построения path
        Исправлено под твою структуру БД
        """
        async with self.pool.acquire() as conn:
            # Получаем все маршруты города
            routes = await conn.fetch("""
                SELECT id, number, name, transport_type, 
                       interval_minutes, operating_hours, is_active,
                       direction_a_name, direction_b_name
                FROM routes 
                WHERE city_id = $1
            """, city_id)
            
            result = []
            for route in routes:
                route_dict = dict(route)
                
                # Получаем остановки маршрута с координатами через route_stops
                # Используем order_in_route для сортировки
                stops = await conn.fetch("""
                    SELECT s.id, s.lat, s.lng, rs.order_in_route, rs.direction
                    FROM route_stops rs
                    JOIN stops s ON s.id = rs.stop_id
                    WHERE rs.route_id = $1
                    ORDER BY rs.order_in_route
                """, route_dict['id'])
                
                # Формируем path для маршрута (список координат [lng, lat])
                path = []
                stop_ids = []
                
                for stop in stops:
                    # Безопасно конвертируем координаты
                    lng = stop['lng']
                    lat = stop['lat']
                    
                    if isinstance(lng, str):
                        try:
                            lng = float(lng.strip())
                        except (ValueError, TypeError):
                            lng = 0.0
                    
                    if isinstance(lat, str):
                        try:
                            lat = float(lat.strip())
                        except (ValueError, TypeError):
                            lat = 0.0
                    
                    path.append([float(lng), float(lat)])
                    stop_ids.append(stop['id'])
                
                route_dict['path'] = path
                route_dict['stops'] = stop_ids
                route_dict['stops_count'] = len(stop_ids)
                
                # Добавляем информацию о направлениях
                route_dict['directions'] = list(set([s['direction'] for s in stops if s['direction']]))
                
                result.append(route_dict)
            
            logger.info(f"📦 Загружено {len(result)} маршрутов")
            return result
    
    async def get_route_by_id(self, route_id: int) -> Optional[Dict]:
        """
        Получение конкретного маршрута по ID
        """
        async with self.pool.acquire() as conn:
            route = await conn.fetchrow(
                "SELECT id, number, name, transport_type, interval_minutes FROM routes WHERE id = $1",
                route_id
            )
            
            if not route:
                return None
            
            route_dict = dict(route)
            
            # Получаем остановки
            stops = await conn.fetch("""
                SELECT s.id, s.address, s.lat, s.lng, rs.order_in_route
                FROM route_stops rs
                JOIN stops s ON s.id = rs.stop_id
                WHERE rs.route_id = $1
                ORDER BY rs.order_in_route
            """, route_id)
            
            route_dict['stops'] = [dict(s) for s in stops]
            
            return route_dict