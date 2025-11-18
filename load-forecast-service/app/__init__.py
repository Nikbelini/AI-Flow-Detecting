"""
Passenger Flow Forecast API
FastAPI service for predicting passenger traffic at bus stops
"""

__version__ = "1.0.0"
__author__ = "Egor Petrushin"
__description__ = "Hybrid Neuro-Fuzzy LSTM model for passenger flow forecasting"

# Импорты для удобного доступа к основным компонентам
from .main import app
from .predictor import PassengerFlowPredictor
from .models import ForecastRequest, ForecastResponse, HealthResponse

# Определяем что импортировать при from app import *
__all__ = [
    "app",
    "PassengerFlowPredictor", 
    "ForecastRequest",
    "ForecastResponse", 
    "HealthResponse"
]