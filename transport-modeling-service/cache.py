import json
import redis
from typing import Optional, List, Dict, Any, Callable, Awaitable
import logging
from datetime import timedelta
import asyncio

logger = logging.getLogger(__name__)

class CacheService:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.default_ttl = timedelta(days=30)
    
    async def get_city_stops(self, city_id: int) -> Optional[List[Dict]]:
        """Получение всех остановок города из кэша"""
        key = f"city:{city_id}:stops"
        try:
            data = self.redis.get(key)
            if data:
                logger.info(f"✅ Кэш HIT: {key}")
                return json.loads(data)
            logger.info(f"❌ Кэш MISS: {key}")
        except Exception as e:
            logger.error(f"❌ Ошибка чтения кэша {key}: {e}")
        return None
    
    async def save_city_stops(self, city_id: int, stops: List[Dict]):
        """Сохранение остановок города в кэш"""
        key = f"city:{city_id}:stops"
        try:
            self.redis.setex(
                key,
                self.default_ttl,
                json.dumps(stops, default=str)
            )
            logger.info(f"💾 Сохранено в кэш: {key} ({len(stops)} остановок)")
        except Exception as e:
            logger.error(f"❌ Ошибка сохранения кэша {key}: {e}")
    
    async def delete_city_stops(self, city_id: int):
        """Удаление кэша города"""
        key = f"city:{city_id}:stops"
        try:
            self.redis.delete(key)
            logger.info(f"🗑️ Удалён кэш: {key}")
        except Exception as e:
            logger.error(f"❌ Ошибка удаления кэша {key}: {e}")
    
    async def get_stop(self, stop_id: int) -> Optional[Dict]:
        """Получение конкретной остановки из кэша"""
        key = f"stop:{stop_id}"
        try:
            data = self.redis.get(key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.error(f"❌ Ошибка чтения кэша {key}: {e}")
        return None
    
    async def save_stop(self, stop_id: int, stop_data: Dict):
        """Сохранение остановки в кэш"""
        key = f"stop:{stop_id}"
        try:
            self.redis.setex(key, self.default_ttl, json.dumps(stop_data, default=str))
        except Exception as e:
            logger.error(f"❌ Ошибка сохранения кэша {key}: {e}")
    
    async def save_task(self, task_id: str, task_data: Dict):
        """Сохранение задачи асинхронной симуляции"""
        key = f"task:{task_id}"
        try:
            self.redis.setex(key, timedelta(hours=1), json.dumps(task_data, default=str))
        except Exception as e:
            logger.error(f"❌ Ошибка сохранения задачи {key}: {e}")
    
    async def get_task(self, task_id: str) -> Optional[Dict]:
        """Получение задачи"""
        key = f"task:{task_id}"
        try:
            data = self.redis.get(key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.error(f"❌ Ошибка чтения задачи {key}: {e}")
        return None
    
    async def update_task(self, task_id: str, updates: Dict):
        """Обновление задачи"""
        key = f"task:{task_id}"
        try:
            task = await self.get_task(task_id)
            if task:
                task.update(updates)
                self.redis.setex(key, timedelta(hours=1), json.dumps(task, default=str))
        except Exception as e:
            logger.error(f"❌ Ошибка обновления задачи {key}: {e}")
    
    # Полезный метод для паттерна "кэш или вычисление"
    async def get_or_compute(
        self, 
        key: str, 
        compute_func: Callable[[], Awaitable[Any]], 
        ttl: Optional[timedelta] = None
    ) -> Any:
        """
        Получить из кэша или вычислить и сохранить
        """
        # Пробуем из кэша
        try:
            data = self.redis.get(key)
            if data:
                logger.info(f"✅ Кэш HIT: {key}")
                return json.loads(data)
        except Exception as e:
            logger.warning(f"⚠️ Ошибка чтения кэша {key}: {e}")
        
        # Вычисляем
        logger.info(f"🔄 Вычисление {key}...")
        result = await compute_func()
        
        # Сохраняем
        if result is not None:
            try:
                self.redis.setex(
                    key, 
                    ttl or self.default_ttl, 
                    json.dumps(result, default=str)
                )
                logger.info(f"💾 Сохранено в кэш: {key}")
            except Exception as e:
                logger.warning(f"⚠️ Ошибка сохранения кэша {key}: {e}")
        
        return result