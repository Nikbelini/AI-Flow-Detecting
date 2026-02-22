# transport-modeling-service/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import redis
import asyncpg
import logging
from datetime import datetime
from contextlib import asynccontextmanager
import json

from config import settings
from api import router
from sublimation import SublimationService
from simulation import SimulationEngine

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Глобальные сервисы
redis_client = None
pg_pool = None
sublimation_service = None
simulation_engine = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global redis_client, pg_pool, sublimation_service, simulation_engine
    
    logger.info("🚀 Запуск transport-modeling-service...")
    
    # Подключение к Redis
    redis_client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        password=settings.REDIS_PASSWORD,
        decode_responses=True
    )
    
    # Подключение к PostgreSQL
    pg_pool = await asyncpg.create_pool(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        database=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD
    )
    
    # Инициализация сервисов
    sublimation_service = SublimationService(redis_client, pg_pool)
    simulation_engine = SimulationEngine(redis_client, pg_pool)
    
    logger.info("✅ Сервис готов")
    
    yield
    
    # Shutdown
    logger.info("🛑 Остановка сервиса...")
    await pg_pool.close()
    redis_client.close()

# Создание приложения
app = FastAPI(
    title="Transport Modeling Service",
    description="Сервис статического моделирования транспортных потоков",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутов
app.include_router(router, prefix="/")

@app.get("/health")
async def health():
    """Проверка здоровья сервиса"""
    return {
        "status": "healthy",
        "service": settings.SERVICE_NAME,
        "timestamp": datetime.now().isoformat(),
        "connections": {
            "redis": redis_client.ping() if redis_client else False,
            "postgres": True  # тут нужна реальная проверка
        }
    }

@app.get("/metrics")
async def metrics():
    """Метрики для Prometheus"""
    return {
        "cache_hits": 0,  # TODO: добавить счётчики
        "simulations_run": 0,
        "active_simulations": 0
    }