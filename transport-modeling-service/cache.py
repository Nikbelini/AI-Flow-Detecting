# transport-modeling-service/cache.py
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
        self.scenario_ttl = timedelta(days=90)
        self.task_ttl = timedelta(hours=1)
    
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

    # ========== НОВЫЕ МЕТОДЫ ДЛЯ СЦЕНАРИЕВ ==========
    
    async def save_scenario(self, city_id: int, scenario_id: str, scenario_data: Dict) -> bool:
        """
        Сохранение сценария изменений
        Ключ: scenario:{city_id}:{scenario_id}
        """
        key = f"scenario:{city_id}:{scenario_id}"
        try:
            # Добавляем метаданные
            scenario_data['updated_at'] = scenario_data.get('updated_at', 
                                                           __import__('datetime').datetime.now().isoformat())
            scenario_data['version'] = scenario_data.get('version', 1)
            
            self.redis.setex(
                key,
                self.scenario_ttl,
                json.dumps(scenario_data, default=str)
            )
            logger.info(f"💾 Сохранён сценарий: {key}")
            return True
        except Exception as e:
            logger.error(f"❌ Ошибка сохранения сценария {key}: {e}")
            return False
    
    async def get_scenario(self, city_id: int, scenario_id: str) -> Optional[Dict]:
        """
        Получение сценария по ID
        """
        key = f"scenario:{city_id}:{scenario_id}"
        try:
            data = self.redis.get(key)
            if data:
                logger.info(f"✅ Сценарий найден: {key}")
                return json.loads(data)
            logger.info(f"❌ Сценарий не найден: {key}")
        except Exception as e:
            logger.error(f"❌ Ошибка чтения сценария {key}: {e}")
        return None
    
    async def list_scenarios(self, city_id: int) -> List[Dict]:
        """
        Получение списка всех сценариев для города
        """
        pattern = f"scenario:{city_id}:*"
        scenarios = []
        
        try:
            # Получаем все ключи по паттерну
            keys = self.redis.keys(pattern)
            
            for key in keys:
                data = self.redis.get(key)
                if data:
                    scenario = json.loads(data)
                    # Извлекаем ID из ключа
                    scenario_id = key.split(':')[-1]
                    scenario['id'] = scenario_id
                    scenarios.append(scenario)
            
            logger.info(f"📋 Найдено {len(scenarios)} сценариев для города {city_id}")
            return scenarios
        except Exception as e:
            logger.error(f"❌ Ошибка получения списка сценариев: {e}")
            return []
    
    async def delete_scenario(self, city_id: int, scenario_id: str) -> bool:
        """
        Удаление сценария
        """
        key = f"scenario:{city_id}:{scenario_id}"
        try:
            result = self.redis.delete(key)
            if result:
                logger.info(f"🗑️ Удалён сценарий: {key}")
                return True
            logger.warning(f"⚠️ Сценарий не найден для удаления: {key}")
            return False
        except Exception as e:
            logger.error(f"❌ Ошибка удаления сценария {key}: {e}")
            return False
    
    async def update_scenario(self, city_id: int, scenario_id: str, updates: Dict) -> bool:
        """
        Обновление существующего сценария
        """
        key = f"scenario:{city_id}:{scenario_id}"
        try:
            # Получаем существующий сценарий
            existing = await self.get_scenario(city_id, scenario_id)
            if not existing:
                logger.warning(f"⚠️ Сценарий не найден для обновления: {key}")
                return False
            
            # Обновляем данные
            existing.update(updates)
            existing['updated_at'] = __import__('datetime').datetime.now().isoformat()
            existing['version'] = existing.get('version', 0) + 1
            
            # Сохраняем обратно
            self.redis.setex(key, self.scenario_ttl, json.dumps(existing, default=str))
            logger.info(f"🔄 Обновлён сценарий: {key} (v{existing['version']})")
            return True
        except Exception as e:
            logger.error(f"❌ Ошибка обновления сценария {key}: {e}")
            return False
    
    async def get_scenario_by_name(self, city_id: int, name: str) -> Optional[Dict]:
        """
        Поиск сценария по имени
        """
        scenarios = await self.list_scenarios(city_id)
        for scenario in scenarios:
            if scenario.get('name', '').lower() == name.lower():
                return scenario
        return None
    
    async def duplicate_scenario(self, city_id: int, source_id: str, new_name: str) -> Optional[str]:
        """
        Копирование существующего сценария
        """
        source = await self.get_scenario(city_id, source_id)
        if not source:
            logger.warning(f"⚠️ Исходный сценарий не найден: {source_id}")
            return None
        
        # Генерируем новый ID
        import uuid
        new_id = str(uuid.uuid4())[:8]
        
        # Создаём копию
        new_scenario = {
            'name': new_name,
            'description': f"Копия сценария {source.get('name', source_id)}",
            'modifications': source.get('modifications', []),
            'created_at': __import__('datetime').datetime.now().isoformat(),
            'source_scenario': source_id
        }
        
        saved = await self.save_scenario(city_id, new_id, new_scenario)
        if saved:
            logger.info(f"📋 Создана копия сценария: {source_id} -> {new_id}")
            return new_id
        
        return None
    
    # ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========
    
    async def get_or_compute(
        self, 
        key: str, 
        compute_func: Callable[[], Awaitable[Any]], 
        ttl: Optional[timedelta] = None
    ) -> Any:
        """
        Получить из кэша или вычислить и сохранить
        """
        try:
            data = self.redis.get(key)
            if data:
                logger.info(f"✅ Кэш HIT: {key}")
                return json.loads(data)
        except Exception as e:
            logger.warning(f"⚠️ Ошибка чтения кэша {key}: {e}")
        
        logger.info(f"🔄 Вычисление {key}...")
        result = await compute_func()
        
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
    
    async def get_stats(self) -> Dict:
        """
        Получение статистики кэша
        """
        try:
            # Считаем ключи по типам
            scenario_keys = self.redis.keys("scenario:*")
            task_keys = self.redis.keys("task:*")
            city_keys = self.redis.keys("city:*")
            stop_keys = self.redis.keys("stop:*")
            
            return {
                "scenarios": len(scenario_keys),
                "tasks": len(task_keys),
                "city_caches": len(city_keys),
                "stop_caches": len(stop_keys),
                "total_keys": len(scenario_keys) + len(task_keys) + len(city_keys) + len(stop_keys)
            }
        except Exception as e:
            logger.error(f"❌ Ошибка получения статистики: {e}")
            return {}