from pydantic import BaseModel
from typing import List
from datetime import datetime

class ForecastRequest(BaseModel):
    city_id: int
    horizon: int

class NodeDTO(BaseModel):
    id: int
    has_camera: bool
    historical_counts: List[int]  # пусто, если камеры нет
    lat: float
    lng: float

class EdgeDTO(BaseModel):
    from_id: int
    to_id: int
    weight: float

class GraphForecastRequest(BaseModel):
    nodes: List[NodeDTO]
    edges: List[EdgeDTO]
    horizon: int
    timestamp: datetime