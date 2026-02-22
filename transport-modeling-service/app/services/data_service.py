# app/services/data_service.py
import asyncio
import aiohttp
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
import logging
from app.config import settings
from app.models.data_models import (
    City, Stop, Route, StopHistory, WeatherData, Event
)

logger = logging.getLogger(__name__)

class DataService:
    def __init__(self):
        self.base_url = settings.JAVA_API_URL
        self.session = None
        self.cache = {}  # Простой кэш
        self.cache_ttl = 300  # 5 минут
        
    async def get_session(self):
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session
    
    async def fetch_from_java_api(self, endpoint: str, params: Optional[Dict] = None) -> Any:
        """Запрос данных из Java API"""
        session = await self.get_session()
        url = f"{self.base_url}{endpoint}"
        
        try:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    logger.error(f"Error fetching {url}: {response.status}")
                    return None
        except Exception as e:
            logger.error(f"Exception fetching {url}: {e}")
            return None
    
    async def get_city_data(self, city_id: int) -> Optional[City]:
        """Получить данные города"""
        cache_key = f"city_{city_id}"
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if datetime.now() - timestamp < timedelta(seconds=self.cache_ttl):
                return City(**cached_data)
        
        data = await self.fetch_from_java_api(f"/api/cities/{city_id}")
        if data:
            self.cache[cache_key] = (data, datetime.now())
            return City(**data)
        return None
    
    async def get_city_routes(self, city_id: int) -> List[Route]:
        """Получить все маршруты города"""
        cache_key = f"routes_{city_id}"
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if datetime.now() - timestamp < timedelta(seconds=self.cache_ttl):
                return [Route(**route) for route in cached_data]
        
        data = await self.fetch_from_java_api("/api/routes/search", {
            "cityId": city_id
        })
        
        if data:
            routes = [Route(**route) for route in data]
            self.cache[cache_key] = ([route.dict() for route in routes], datetime.now())
            return routes
        return []
    
    async def get_city_stops(self, city_id: int) -> List[Stop]:
        """Получить все остановки города с историей"""
        cache_key = f"stops_{city_id}"
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if datetime.now() - timestamp < timedelta(seconds=self.cache_ttl):
                return [Stop(**stop) for stop in cached_data]
        
        # Получаем остановки
        stops_data = await self.fetch_from_java_api("/api/stops/city", {
            "cityId": city_id
        })
        
        if not stops_data:
            return []
        
        stops = []
        for stop_data in stops_data:
            # Получаем исторические данные для каждой остановки
            history_data = await self.fetch_from_java_api(
                f"/api/stops/{stop_data['id']}/history"
            )
            
            stop_history = []
            if history_data:
                stop_history = [StopHistory(**hist) for hist in history_data]
            
            stop = Stop(
                **stop_data,
                historical_data=stop_history
            )
            stops.append(stop)
        
        self.cache[cache_key] = ([stop.dict() for stop in stops], datetime.now())
        return stops
    
    async def get_weather_data(self, city_id: int, 
                              start_date: datetime,
                              end_date: datetime) -> List[WeatherData]:
        """Получить данные о погоде"""
        params = {
            "cityId": city_id,
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat()
        }
        
        data = await self.fetch_from_java_api("/api/weather", params)
        if data:
            return [WeatherData(**item) for item in data]
        return []
    
    async def get_events(self, city_id: int,
                        start_date: datetime,
                        end_date: datetime) -> List[Event]:
        """Получить события"""
        params = {
            "cityId": city_id,
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat()
        }
        
        data = await self.fetch_from_java_api("/api/events", params)
        if data:
            return [Event(**item) for item in data]
        return []
    
    async def get_city_full_data(self, city_id: int) -> Dict[str, Any]:
        """Получить все данные города для моделирования"""
        logger.info(f"Fetching full data for city {city_id}")
        
        # Параллельные запросы
        city_task = asyncio.create_task(self.get_city_data(city_id))
        routes_task = asyncio.create_task(self.get_city_routes(city_id))
        stops_task = asyncio.create_task(self.get_city_stops(city_id))
        
        # Получаем данные за последние 30 дней для анализа
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        
        weather_task = asyncio.create_task(
            self.get_weather_data(city_id, start_date, end_date)
        )
        events_task = asyncio.create_task(
            self.get_events(city_id, start_date, end_date)
        )
        
        # Ждем завершения всех задач
        city, routes, stops, weather, events = await asyncio.gather(
            city_task, routes_task, stops_task, weather_task, events_task
        )
        
        return {
            "city": city,
            "routes": routes,
            "stops": stops,
            "weather": weather,
            "events": events,
            "timestamp": datetime.now()
        }
    
    async def update_route(self, route_data: Dict) -> bool:
        """Обновить маршрут в Java API"""
        session = await self.get_session()
        url = f"{self.base_url}/api/routes"
        
        try:
            async with session.post(url, json=route_data) as response:
                return response.status == 200 or response.status == 201
        except Exception as e:
            logger.error(f"Error updating route: {e}")
            return False
    
    async def update_stop(self, stop_data: Dict) -> bool:
        """Обновить остановку в Java API"""
        session = await self.get_session()
        url = f"{self.base_url}/api/stops"
        
        try:
            async with session.post(url, json=stop_data) as response:
                return response.status == 200 or response.status == 201
        except Exception as e:
            logger.error(f"Error updating stop: {e}")
            return False
    
    async def delete_route(self, route_id: int) -> bool:
        """Удалить маршрут"""
        session = await self.get_session()
        url = f"{self.base_url}/api/routes/{route_id}"
        
        try:
            async with session.delete(url) as response:
                return response.status == 204
        except Exception as e:
            logger.error(f"Error deleting route: {e}")
            return False
    
    def clear_cache(self):
        """Очистить кэш"""
        self.cache.clear()
        logger.info("Cache cleared")