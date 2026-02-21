import os
from fastapi import FastAPI
from pydantic import BaseModel
from domain.schemas import ForecastRequest
from inference.forecast import forecast_city
from typing import Dict

app = FastAPI(title="passenger-flow-predicted")

from threading import Thread
from services.training_loop import training_loop

status_dict: Dict = {}

@app.on_event("startup")
def startup():
    Thread(
        target=training_loop,
        args=(1, status_dict),  # city_id
        daemon=True
    ).start()

@app.get("/ml/status")
def ml_status():
    from database.db import load_stop_history
    df = load_stop_history(1)

    model_exists = os.path.exists("result/models/city_1.pt")

    return {
        "data_points": df['datetime'].nunique() if not df.empty else 0,
        "model_trained": model_exists
    }


@app.get("/health")
def health():
    return {"status": "UP"}

@app.post("/forecast")
def forecast(req: ForecastRequest):
    return forecast_city(req.city_id, req.horizon)

