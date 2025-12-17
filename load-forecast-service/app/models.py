from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime

class ForecastRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    historical_data: List[Dict[str, Any]]
    forecast_horizon: int = 6
    include_plots: bool = True

class ForecastResponse(BaseModel):
    predictions: List[Dict[str, Any]]
    metrics: Dict[str, float]
    plot_html: Optional[str] = None
    timestamp: datetime

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_info: Dict[str, Any]

class BatchForecastRequest(BaseModel):
    requests: List[ForecastRequest]