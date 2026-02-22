# transport-modeling-service/config.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Сервис
    SERVICE_NAME: str = "transport-modeling-service"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8084
    METRICS_PORT: int = 8085
    
    # База данных
    DB_HOST: str = "postgres"
    DB_PORT: int = 5432
    DB_NAME: str = "stops"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    
    # Redis
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None
    
    # Кэширование
    CACHE_TTL_DAYS: int = 30
    HISTORY_DAYS: int = 90
    
    # URL других сервисов
    FLOWDETECT_URL: str = "http://flowdetect-app:8080"
    FORECAST_SERVICE_URL: str = "http://load-forecast-service:8082"
    
    # Параметры моделирования
    MAX_SIMULATION_HOURS: int = 24
    DEFAULT_FORECAST_HOURS: int = 6
    
    class Config:
        env_file = ".env"

settings = Settings()