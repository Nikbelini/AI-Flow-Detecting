from pydantic import BaseModel, Field, ConfigDict
from typing import Any, Dict, List, Optional
from datetime import datetime
from enum import Enum

"""Модели для машинного обучения"""
class ForecastRequest(BaseModel):
    city_id: int = Field(..., ge=1, alias="cityId", description="ID города")
    horizon: int = Field(..., ge=1, le=24, alias="horizon", description="Горизонт прогноза (1-24 шага)")
    
    # Разрешаем заполнение по алиасу
    model_config = ConfigDict(populate_by_name=True)

class TrainingRequest(BaseModel):
    city_id: int = Field(..., ge=1, description="ID города для обучения")
    horizon: Optional[int] = Field(None, ge=1, le=24, description="Опционально: горизонт для валидации")
    force_retrain: bool = Field(False, description="Принудительное переобучение, даже если модель есть")

class NodeDTO(BaseModel):
    id: int
    has_camera: bool
    historical_counts: List[int] = Field(default_factory=list)
    lat: float
    lng: float

class EdgeDTO(BaseModel):
    from_id: int
    to_id: int
    weight: float

class GraphForecastRequest(BaseModel):
    nodes: List[NodeDTO]
    edges: List[EdgeDTO]
    horizon: int = Field(..., ge=1, le=24)
    timestamp: datetime = Field(default_factory=datetime.now)

# ===== RESPONSES =====

class TrainingStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"

class TrainingJobResponse(BaseModel):
    job_id: str
    status: TrainingStatus
    city_id: int
    created_at: str
    updated_at: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class ForecastStop(BaseModel):
    address: str
    lat: float
    lng: float
    has_camera: bool
    forecast: List[float]
    uncertainty: Optional[Dict[str, List[float]]] = None  # {lower, upper}

class ForecastResponse(BaseModel):
    city_id: int
    horizon: int
    timestamp: str
    model_version: str
    stops: List[ForecastStop]
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ===== ===== ===== ===== ===== ===== ===== ===== ===== =====  
"""Модели для алгоритмического решения прогнозирования"""
class Stop(BaseModel):
    id: int
    name: str
    lat: float
    lng: float

class RouteInfo(BaseModel):
    route_id: int
    frequency: float

class PassengerFlowRequest(BaseModel):
    stop_id: int
    predicted_flow: float
    method: str
    neighbors_used: int
    debug: Optional[dict] = None