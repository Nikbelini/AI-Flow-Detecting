from fastapi import FastAPI

from api.ml import router as ml_router
from api.passenger_flow import router as passenger_flow_router
from api.routes import router as build_route


app = FastAPI(
    title="passenger-flow-predicted",
    description="Microservice for predicting passenger flow at stops WITHOUT cameras",
    version="1.0.0",
)

app.include_router(ml_router)
app.include_router(passenger_flow_router)
app.include_router(build_route)


# ===== ENDPOINTS =====

@app.get("/health")
def health():
    return {"status": "UP", "service": "passenger-flow-predicted"}

