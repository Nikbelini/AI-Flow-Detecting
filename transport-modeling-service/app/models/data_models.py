# app/models/data_models.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, time
from enum import Enum

class TransportType(str, Enum):
    BUS = "BUS"
    TROLLEYBUS = "TROLLEYBUS"
    TRAM = "TRAM"
    MINIBUS = "MINIBUS"
    METRO = "METRO"
    TRAIN = "TRAIN"

class City(BaseModel):
    id: int
    name: str
    lat: float
    lng: float

class Stop(BaseModel):
    id: int
    address: str
    lat: float
    lng: float
    city_id: int
    count: int = 0  # текущее количество людей
    velocity: int = 0
    load: int = 0
    historical_data: Optional[List["StopHistory"]] = None

class StopHistory(BaseModel):
    id: int
    address: str
    count: int
    velocity: int
    load: int
    datetime: datetime

class RouteStop(BaseModel):
    stop_id: int
    order_in_route: int
    direction: str
    travel_time_to_next: Optional[int] = None

class Route(BaseModel):
    id: int
    number: str
    name: Optional[str] = None
    transport_type: TransportType
    city_id: int
    direction_a_name: Optional[str] = None
    direction_b_name: Optional[str] = None
    interval_minutes: Optional[int] = None
    operating_hours: Optional[str] = None
    stops: List[RouteStop]

class WeatherData(BaseModel):
    datetime: datetime
    temperature: Optional[float] = None
    precipitation: Optional[float] = None
    weather_code: Optional[int] = None

class Event(BaseModel):
    event_date: datetime
    is_holiday: bool = False
    has_special_event: bool = False
    event_type: Optional[str] = None

class SimulationScenario(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any] = Field(default_factory=dict)

class PassengerDemand(BaseModel):
    stop_id: int
    hour: int
    base_demand: float  # базовая потребность
    current_demand: float  # текущая потребность с учетом факторов
    factors: Dict[str, float] = Field(default_factory=dict)  # влияющие факторы

class Agent(BaseModel):
    id: int
    current_stop_id: int
    destination_stop_id: int
    departure_time: datetime
    arrival_time: Optional[datetime] = None
    route_preferences: List[TransportType] = Field(default_factory=list)
    patience_level: float = 1.0  # терпение ожидания
    walking_distance_limit: float = 500.0  # метров

class SimulationResult(BaseModel):
    simulation_id: str
    timestamp: datetime
    scenario_name: str
    metrics: Dict[str, float]
    stop_loads: Dict[int, Dict[str, float]]  # нагрузка по остановкам
    route_performance: Dict[int, Dict[str, float]]  # производительность маршрутов
    agent_statistics: Dict[str, float]
    recommendations: List[str]