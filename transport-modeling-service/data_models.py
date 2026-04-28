# transport-modeling-service/data_models.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class ModificationType(str, Enum):
    CLOSE_STOP = "close_stop"
    ADD_STOP = "add_stop"
    ADD_ROUTE = "add_route"
    DELETE_ROUTE = "delete_route"
    CHANGE_INTERVAL = "change_interval"
    CHANGE_CAPACITY = "change_capacity"

class ModificationTarget(str, Enum):
    STOP = "stop"
    ROUTE = "route"

class Modification(BaseModel):
    id: str
    type: ModificationType
    targetType: ModificationTarget = ModificationTarget.STOP
    targetId: int
    parameters: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True
    label: Optional[str] = None

class Metrics(BaseModel):
    avgWaitTime: float
    maxWaitTime: float
    totalPassengers: int
    avgLoad: float
    transportUtilization: float
    avgTravelTime: float = 0.0
    maxTravelTime: float = 0.0

class HourlyData(BaseModel):
    hour: int
    basePassengers: float
    modifiedPassengers: float
    baseWaitTime: float
    modifiedWaitTime: float

class AffectedStopStatus(str, Enum):
    IMPROVED = "improved"
    WORSENED = "worsened"
    NEUTRAL = "neutral"

class AffectedStop(BaseModel):
    id: int
    address: str
    loadChange: float
    waitTimeChange: float
    status: AffectedStopStatus

# ========== НОВЫЕ МОДЕЛИ (ИСПРАВЛЕНО) ==========

class HourlyThroughput(BaseModel):
    """Почасовая пропускная способность"""
    hour: int
    passengers_arrived: int
    passengers_departed: int
    passengers_waiting: int

class StopThroughput(BaseModel):
    """Пропускная способность конкретной остановки"""
    theoretical: float
    estimated_actual: float

class PassengerThroughput(BaseModel):
    """Пропускная способность системы"""
    hourly_throughput: List[HourlyThroughput]
    peak_hour: int
    peak_hour_passengers: int
    theoretical_capacity: int
    utilization_rate: float
    stop_throughput: Dict[int, StopThroughput]

class WaitTimeDistribution(BaseModel):
    """Распределение времени ожидания"""
    buckets: List[int]
    counts: List[int]
    percentiles: Dict[str, float]
    average: float
    median: float
    p95: float
    p99: float

class StopHourlyMetric(BaseModel):
    """Почасовые метрики для конкретной остановки"""
    hour: int
    passengers: int
    departed: int
    waiting: int
    avg_wait: Optional[float] = None

class StopMetricsDetail(BaseModel):  # ← Переименовано с StopMetrics на StopMetricsDetail
    """Детальные метрики по остановке"""
    id: int
    address: str
    hourly: List[StopHourlyMetric]
    total_passengers: int
    total_departed: int
    avg_departure_rate: float
    avg_wait_time: float
    theoretical_capacity: float
    peak_hour: int
    peak_passengers: int
    utilization: float

# ========== ОСНОВНЫЕ МОДЕЛИ ==========

class SimulationResults(BaseModel):
    """Результаты симуляции с расширенными метриками"""
    baseMetrics: Metrics
    modifiedMetrics: Metrics
    hourlyData: List[HourlyData]
    affectedStops: List[AffectedStop]
    
    # Новые метрики (опциональные)
    baseThroughput: Optional[PassengerThroughput] = None
    modifiedThroughput: Optional[PassengerThroughput] = None
    baseWaitDistribution: Optional[WaitTimeDistribution] = None
    modifiedWaitDistribution: Optional[WaitTimeDistribution] = None
    baseStopMetrics: Optional[Dict[int, StopMetricsDetail]] = None
    modifiedStopMetrics: Optional[Dict[int, StopMetricsDetail]] = None

class RegionBounds(BaseModel):
    minLng: float
    maxLng: float
    minLat: float
    maxLat: float

class SimulationRequest(BaseModel):
    city_id: int
    modifications: List[Modification]
    simulation_hours: int = 24
    region: Optional[RegionBounds] = None

class SimulationResponse(BaseModel):
    task_id: Optional[str] = None
    results: Optional[SimulationResults] = None
    status: str