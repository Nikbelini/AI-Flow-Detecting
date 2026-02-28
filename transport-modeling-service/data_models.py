from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class ModificationType(str, Enum):
    CLOSE_STOP = "close_stop"
    ADD_STOP = "add_stop"
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

class SimulationResults(BaseModel):
    baseMetrics: Metrics
    modifiedMetrics: Metrics
    hourlyData: List[HourlyData]
    affectedStops: List[AffectedStop]

class SimulationRequest(BaseModel):
    city_id: int
    modifications: List[Modification]
    simulation_hours: int = 24

class SimulationResponse(BaseModel):
    task_id: Optional[str] = None
    results: Optional[SimulationResults] = None
    status: str