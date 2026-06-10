from pydantic import BaseModel, Field, ConfigDict, field_validator
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
    startStopId: int = Field(..., alias="start_stop_id")   
    goalStopId: int = Field(..., alias="goal_stop_id") 
    mode: RouteMode = Field(default=RouteMode.FASTEST)

    datetime: Optional[str] = Field(
        default=None,
        description="ISO-8601 datetime для текущего момента. Если не передан — берём now() по Самаре.",
    )

    # Запланированное время отправления
    scheduledFor: Optional[str] = Field(
        default=None,
        description=(
            "Запланировать маршрут на конкретное время отправления (ISO-8601). "
            "Имеет приоритет над полем datetime."
        ),
    )

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        allowed = {"FASTEST", "LESS_CROWDED", "MIN_TRANSFERS"}
        upper = v.upper()
        if upper not in allowed:
            raise ValueError(f"mode must be one of {allowed}, got {v!r}")
        return upper

    @field_validator("cityId", "startStopId", "goalStopId")
    @classmethod
    def validate_positive_int(cls, v: int) -> int:
        if v <= 0:
            raise ValueError(f"Must be positive integer, got {v}")
        return v

    class Config:
        populate_by_name = True  
        allow_population_by_field_name = True


# ===== DTO СЕГМЕНТА =====
class RouteSegmentDto(BaseModel):
    from_stop: int
    to_stop: int
    route_id: Optional[int] = None
    dist_km: float
    travel_time_min: Optional[float] = None
    load_from: float
    load_to: float
    route_name: str = ""
    route_number: str = ""


class RouteAlternativeDto(BaseModel):
    label: str
    mode_used: str
    total_cost_minutes: float
    routing_score: Optional[float] = None
    stops: List[int]
    routes: List[Optional[int]]
    segments: List[RouteSegmentDto]


# ===== DTO ОТВЕТА =====
class RoutePlanResponseDto(BaseModel):
    status: Literal["SUCCESS", "ERROR"] = "SUCCESS"
    mode: str
    total_cost_minutes: float
    stops: List[int]
    routes: List[Optional[int]]
    segments: List[RouteSegmentDto]
    error: Optional[str] = None

    # Ночной/плановый режим
    is_scheduled: bool = False
    scheduled_message: Optional[str] = None
    effective_datetime: Optional[str] = None

    # Альтернативы
    alternatives: List[RouteAlternativeDto] = []
