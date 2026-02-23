from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class ModificationType(str, Enum):
    CLOSE_STOP = "close_stop"
    ADD_STOP = "add_stop"
    CHANGE_INTERVAL = "change_interval"
    CHANGE_CAPACITY = "change_capacity"

class Modification(BaseModel):
    id: str
    type: ModificationType
    target_id: Optional[int] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True

class Metrics(BaseModel):
    avgWaitTime: float = Field(..., description="Среднее время ожидания (мин)")
    maxWaitTime: float = Field(..., description="Максимальное время ожидания (мин)")
    totalPassengers: int = Field(..., description="Всего пассажиров")
    avgLoad: float = Field(..., description="Средняя загрузка (0-10)")
    transportUtilization: float = Field(..., description="Использование транспорта (0-1)")

class HourlyData(BaseModel):
    hour: int
    basePassengers: float
    modifiedPassengers: float
    baseWaitTime: float
    modifiedWaitTime: float

class StopStatus(str, Enum):
    IMPROVED = "improved"
    WORSENED = "worsened"
    NEUTRAL = "neutral"

class AffectedStop(BaseModel):
    id: int
    address: str
    loadChange: float = Field(..., description="Изменение нагрузки в %")
    waitTimeChange: float = Field(..., description="Изменение времени ожидания (мин)")
    status: StopStatus

class SimulationResults(BaseModel):
    baseMetrics: Metrics
    modifiedMetrics: Metrics
    hourlyData: List[HourlyData]
    affectedStops: List[AffectedStop]

class SimulationState(BaseModel):
    # ✅ ИСПРАВЛЕНО: regex -> pattern
    status: str = Field(..., pattern="^(idle|running|completed|error)$")
    progress: int = Field(..., ge=0, le=100)
    currentHour: int = Field(..., ge=0, le=23)
    results: Optional[SimulationResults] = None

class SimulationRequest(BaseModel):
    city_id: int
    modifications: List[Modification]
    simulation_hours: int = 24

class SimulationResponse(BaseModel):
    task_id: Optional[str] = None
    results: Optional[SimulationResults] = None
    status: str

class StopInfo(BaseModel):
    id: int
    address: str
    lat: float
    lng: float
    load: Optional[int] = None
    avg_count: Optional[float] = None
    avg_load: Optional[float] = None
    avg_wait_time: Optional[float] = None
    cluster: Optional[str] = None