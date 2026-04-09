from fastapi import APIRouter, Query
from datetime import datetime

from database.repository import PostgresRepository
from services.route_planner.route_service import RoutePlannerService

router = APIRouter(prefix="/routes", tags=["Routes"])

repository = PostgresRepository()


@router.get("/build")
def build_route(
    city_id: int = Query(...),
    start_stop_id: int = Query(...),
    goal_stop_id: int = Query(...),
    dt_str: str = Query(default_factory=lambda: datetime.now().isoformat()),
    mode: str = Query("FASTEST", description="FASTEST | LESS_CROWDED | MIN_TRANSFERS")
):
    
    service = RoutePlannerService(repository)

    return service.build_route(
        city_id=city_id,
        start_stop_id=start_stop_id,
        goal_stop_id=goal_stop_id,
        dt_str=dt_str,
        mode=mode
    )