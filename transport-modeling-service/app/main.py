# app/main.py
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from typing import Dict

from app.config import settings
from app.api.endpoints import router as api_router
from app.services.data_service import DataService
from app.services.statistical_model import StatisticalModel
from app.services.agent_model import AgentModel
from app.utils.data_processor import DataProcessor

# Настройка логгирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Глобальные сервисы
data_service = None
statistical_model = None
agent_model = None
data_processor = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global data_service, statistical_model, agent_model, data_processor
    
    logger.info("Initializing services...")
    
    data_service = DataService()
    data_processor = DataProcessor()
    statistical_model = StatisticalModel()
    agent_model = AgentModel()
    
    # Загружаем модели ML если нужно
    await statistical_model.load_models()
    
    logger.info("Services initialized successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down services...")
    # Очистка ресурсов

app = FastAPI(
    title="Transport Modeling Service",
    description="Сервис статистического и агентного моделирования транспорта",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В production ограничить
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Роутер
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {
        "service": "Transport Modeling Service",
        "version": "1.0.0",
        "endpoints": {
            "data": "/api/v1/data",
            "simulation": "/api/v1/simulation",
            "optimization": "/api/v1/optimization"
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "services": {
            "data_service": data_service is not None,
            "statistical_model": statistical_model is not None,
            "agent_model": agent_model is not None
        }
    }

# Экспортируем сервисы для использования в эндпоинтах
def get_data_service() -> DataService:
    if data_service is None:
        raise HTTPException(status_code=500, detail="Data service not initialized")
    return data_service

def get_statistical_model() -> StatisticalModel:
    if statistical_model is None:
        raise HTTPException(status_code=500, detail="Statistical model not initialized")
    return statistical_model

def get_agent_model() -> AgentModel:
    if agent_model is None:
        raise HTTPException(status_code=500, detail="Agent model not initialized")
    return agent_model

def get_data_processor() -> DataProcessor:
    if data_processor is None:
        raise HTTPException(status_code=500, detail="Data processor not initialized")
    return data_processor