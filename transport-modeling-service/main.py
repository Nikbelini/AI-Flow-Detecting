import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import redis
import asyncpg
from datetime import datetime
from contextlib import asynccontextmanager
import json
import logging
import numpy as np

from data_models import (
    SimulationRequest, SimulationResponse,
    Modification, Metrics, HourlyData, AffectedStop
)
from simulation_engine import SimulationEngine
from modifications import ModificationApplier
from cache import CacheService
from db import DatabaseService

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Глобальные сервисы
redis_client = None
pg_pool = None
cache_service = None
db_service = None
simulation_engine = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global redis_client, pg_pool, cache_service, db_service, simulation_engine
    
    logger.info("🚀 Запуск transport-modeling-service...")
    
    try:
        # Подключение к Redis
        # redis_client = redis.Redis(
        #     host="redis",
        #     port=6379,
        #     db=0,
        #     decode_responses=True,
        #     socket_connect_timeout=2
        # )
        # redis_client.ping()
        logger.info("✅ Redis подключен")
        
        # Подключение к PostgreSQL
        pg_pool = await asyncpg.create_pool(
            host="postgres",
            port=5432,
            database="stops",
            user="postgres",
            password="postgres",
            min_size=1,
            max_size=5,
            command_timeout=5
        )
        logger.info("✅ PostgreSQL подключен")
        
        # Импорт OSM данных (только при первом запуске)
        # from import_osm_data import run_import_if_needed
        # await run_import_if_needed(pg_pool)
        from import_osm_data_ul import run_import_if_needed_ul
        await run_import_if_needed_ul(pg_pool)
        from import_osm_data_kop import run_import_if_needed_kop
        await run_import_if_needed_kop(pg_pool)
        from import_osm_data_ekb import run_import_if_needed_ekb
        await run_import_if_needed_ekb(pg_pool)
        # =========================================

        # Инициализация сервисов
        # cache_service = CacheService(redis_client)
        db_service = DatabaseService(pg_pool)
        simulation_engine = SimulationEngine(cache_service, db_service)
        
        logger.info("✅ Сервис готов")
        
    except Exception as e:
        logger.error(f"❌ Ошибка подключения: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("🛑 Остановка сервиса...")
    if pg_pool:
        await pg_pool.close()
    if redis_client:
        redis_client.close()

# Создание приложения
app = FastAPI(
    title="Transport Modeling Service",
    description="Сервис моделирования транспортных потоков",
    version="1.0.0",
    lifespan=lifespan
)

# CORS для фронта
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://frontend:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== Эндпоинты ==========

@app.get("/health")
async def health():
    """Проверка здоровья"""
    redis_ok = False
    pg_ok = False
    
    try:
        redis_ok = redis_client.ping() if redis_client else False
    except:
        pass
    
    try:
        async with pg_pool.acquire() as conn:
            await conn.execute("SELECT 1")
            pg_ok = True
    except:
        pass
    
    return {
        "status": "healthy" if redis_ok and pg_ok else "degraded",
        "service": "transport-modeling-service",
        "timestamp": datetime.now().isoformat(),
        "connections": {
            "redis": redis_ok,
            "postgres": pg_ok
        }
    }

@app.post("/simulate")
async def run_simulation(request: SimulationRequest):
    """
    Запуск симуляции с изменениями
    """
    logger.info(f"📊 Запрос симуляции с {len(request.modifications)} изменениями")
    
    try:
        # Получаем базовые данные города
        city_data = await db_service.get_city_data(request.city_id)
        if not city_data:
            raise HTTPException(status_code=404, detail="Город не найден")
        
        # Получаем сублимированные данные остановок
        stops_data = await cache_service.get_city_stops(request.city_id)
        if not stops_data:
            # Если нет в кэше - грузим из БД
            stops_data = await db_service.get_stops_with_history(request.city_id)
            if stops_data:
                await cache_service.save_city_stops(request.city_id, stops_data)
        
        if not stops_data:
            raise HTTPException(status_code=404, detail="Нет данных об остановках")
        
        # Запускаем симуляцию
        results = await simulation_engine.run(
            city_id=request.city_id,
            modifications=request.modifications,
            stops_data=stops_data
        )
        
        logger.info("✅ Симуляция завершена")
        return results.dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка симуляции: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/simulate/async")
async def run_simulation_async(background_tasks: BackgroundTasks, request: SimulationRequest):
    """
    Асинхронный запуск симуляции
    """
    task_id = f"sim_{int(datetime.now().timestamp())}"
    
    # Сохраняем задачу в Redis
    await cache_service.save_task(task_id, {
        "status": "pending",
        "request": request.dict(),
        "created_at": datetime.now().isoformat()
    })
    
    # Запускаем в фоне
    background_tasks.add_task(
        run_simulation_background,
        task_id=task_id,
        request=request
    )
    
    return {"task_id": task_id, "status": "pending"}

@app.get("/simulate/status/{task_id}")
async def get_simulation_status(task_id: str):
    """
    Получение статуса асинхронной симуляции
    """
    task = await cache_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    
    return task

@app.get("/stops/{city_id}")
async def get_city_stops(city_id: int):
    """
    Получение списка остановок города
    """
    # Пытаемся из кэша
    stops = await cache_service.get_city_stops(city_id)
    if stops:
        logger.info(f"✅ Кэш HIT: {len(stops)} остановок")
        return stops
    
    logger.info(f"🔄 Загрузка остановок города {city_id} из БД")
    
    # Если нет в кэше - из БД
    stops = await db_service.get_stops_with_history(city_id)
    
    if stops:
        # Сохраняем в кэш
        await cache_service.save_city_stops(city_id, stops)
        return stops
    
    return []

@app.get("/stop/{stop_id}")
async def get_stop_info(stop_id: int):
    """
    Получение информации о конкретной остановке
    """
    # Пытаемся из кэша
    stop = await cache_service.get_stop(stop_id)
    if stop:
        return stop
    
    # Если нет - из БД
    stop = await db_service.get_stop_by_id(stop_id)
    if not stop:
        raise HTTPException(status_code=404, detail="Остановка не найдена")
    
    # Добавляем исторические паттерны
    history = await db_service.get_stop_history(stop_id)
    if history:
        stop["pattern"] = history
    
    # Сохраняем в кэш
    await cache_service.save_stop(stop_id, stop)
    
    return stop

@app.get("/stop/{stop_id}/history")
async def get_stop_history(stop_id: int, days: int = 90):
    """
    Получение исторических данных остановки
    """
    history = await db_service.get_stop_history(stop_id, days)
    return history

@app.post("/modifications/validate")
async def validate_modifications(modifications: list[Modification]):
    """
    Валидация изменений перед симуляцией
    """
    applier = ModificationApplier()
    errors = []
    
    for mod in modifications:
        valid, error = applier.validate(mod)
        if not valid:
            errors.append({
                "modification": mod.dict(),
                "error": error
            })
    
    return {
        "valid": len(errors) == 0,
        "errors": errors
    }

@app.get("/metrics/{city_id}")
async def get_city_metrics(city_id: int):
    """
    Получение текущих метрик города
    """
    # Получаем данные из кэша
    stops = await cache_service.get_city_stops(city_id)
    
    if not stops:
        stops = await db_service.get_stops_with_history(city_id)
    
    if not stops:
        raise HTTPException(status_code=404, detail="Данные не найдены")
    
    # Считаем метрики
    metrics = {
        "avgWaitTime": float(np.mean([s.get("avg_wait_time", 8) for s in stops])),
        "maxWaitTime": float(np.max([s.get("max_wait_time", 15) for s in stops])),
        "totalPassengers": int(sum(s.get("avg_count", 100) for s in stops)),
        "avgLoad": float(np.mean([s.get("avg_load", 4) for s in stops])),
        "transportUtilization": float(np.mean([s.get("utilization", 0.6) for s in stops]))
    }
    
    return metrics

@app.post("/cache/refresh/{city_id}")
async def refresh_city_cache(city_id: int):
    """
    Принудительное обновление кэша города
    """
    # Удаляем старый кэш
    await cache_service.delete_city_stops(city_id)
    
    # Генерируем новый
    stops = await db_service.get_stops_with_history(city_id)
    if stops:
        await cache_service.save_city_stops(city_id, stops)
    
    return {"status": "refreshed", "city_id": city_id, "stops_count": len(stops)}

@app.get("/routes/{city_id}")
async def get_city_routes(city_id: int):
    """
    Получение маршрутов города с путями для отрисовки на карте
    """
    routes = await db_service.get_routes_with_path(city_id)
    return routes

# Фоновая задача для асинхронной симуляции
async def run_simulation_background(task_id: str, request: SimulationRequest):
    try:
        # Обновляем статус
        await cache_service.update_task(task_id, {"status": "running"})
        
        # Запускаем симуляцию
        city_data = await db_service.get_city_data(request.city_id)
        stops_data = await cache_service.get_city_stops(request.city_id)
        
        if not stops_data:
            stops_data = await db_service.get_stops_with_history(request.city_id)
        
        if not city_data or not stops_data:
            await cache_service.update_task(task_id, {
                "status": "error",
                "error": "Не удалось загрузить данные"
            })
            return
        
        results = await simulation_engine.run(
            city_id=request.city_id,
            modifications=request.modifications,
            stops_data=stops_data
        )
        
        # Сохраняем результаты
        await cache_service.update_task(task_id, {
            "status": "completed",
            "results": results.dict(),
            "completed_at": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"❌ Ошибка в фоновой задаче: {e}", exc_info=True)
        await cache_service.update_task(task_id, {
            "status": "error",
            "error": str(e)
        })