from pydantic import BaseModel, Field, ConfigDict
from typing import Any, Dict, List, Literal, Optional
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
    augment: bool = Field(True, description="Включить аугментацию данных")
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



# ===== Построение маршрута
# ===== ENUM для режима =====
class RouteMode(str, Enum):
    FASTEST = "FASTEST"
    LESS_CROWDED = "LESS_CROWDED"
    MIN_TRANSFERS = "MIN_TRANSFERS"

# ===== DTO ЗАПРОСА (Pydantic модель для JSON body) =====
class RoutePlanRequestDto(BaseModel):
    cityId: int = Field(..., gt=0, alias="city_id")       
    datetime: str = Field(..., description="ISO 8601 datetime")
    startStopId: int = Field(..., alias="start_stop_id")   
    goalStopId: int = Field(..., alias="goal_stop_id") 
    mode: RouteMode = Field(default=RouteMode.FASTEST)

    class Config:
        populate_by_name = True  
        allow_population_by_field_name = True

# ===== DTO СЕГМЕНТА =====
class RouteSegmentDto(BaseModel):
    from_stop: int
    to_stop: int
    route_id: Optional[int] = None
    dist_km: float
    travel_time_min: float
    load_from: int
    load_to: int

# ===== DTO ОТВЕТА =====
class RoutePlanResponseDto(BaseModel):
    status: Literal["SUCCESS", "ERROR"] = "SUCCESS"
    mode: str
    total_cost_minutes: float
    stops: List[int]
    routes: List[Optional[int]]
    segments: List[RouteSegmentDto]
    error: Optional[str] = None
