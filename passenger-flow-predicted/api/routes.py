from fastapi import APIRouter
import logging
from datetime import datetime, timezone, timedelta

from database.repository import PostgresRepository
from services.route_planner.route_service import RoutePlannerService
from domain.schemas import RoutePlanRequestDto, RoutePlanResponseDto, RouteSegmentDto

router = APIRouter(prefix="/routes", tags=["Routes"])

logger = logging.getLogger(__name__)

repository = PostgresRepository()
route_service = RoutePlannerService(repository)


# Смещение Самары: UTC+4
SAMARA_TZ = timezone(timedelta(hours=4))

def get_samara_now() -> str:
    return datetime.now(SAMARA_TZ).strftime("%Y-%m-%dT%H:%M:%S")

def normalize_dt(dt: str) -> str:
    if "T" not in dt:
        return dt + "T23:59:59"
    return dt

@router.post("/build", response_model=RoutePlanResponseDto)
async def build_route(request: RoutePlanRequestDto): 
    """
    Построение оптимального маршрута между двумя остановками.
    Принимает JSON body с camelCase или snake_case полями.
    """
    try:
        # Валидация
        if request.startStopId == request.goalStopId:
            raise ValueError("Стартовая и конечная остановки не могут совпадать")
        
        # Нормализация даты
        dt_str = normalize_dt(request.datetime)
        
        result = route_service.build_route(
            city_id=request.cityId,
            start_stop_id=request.startStopId,
            goal_stop_id=request.goalStopId,
            dt_str=dt_str,
            mode=request.mode.value   
        )
        
        # Формируем ответ
        return RoutePlanResponseDto(
            status="SUCCESS",
            mode=request.mode.value,
            total_cost_minutes=result.get("total_cost_minutes", 0),
            stops=[request.startStopId, request.goalStopId],
            routes=result.get("routes", [None, None]),
            segments=[
                RouteSegmentDto(**seg) if isinstance(seg, dict) else seg
                for seg in result.get("segments", [])
            ],
            error=None
        )
        
    except Exception as exception:
        #  ЛОВИМ ИМЕННО ОШИБКУ NUMPY 
        error_msg = str(exception)
        if "zero-size array" in error_msg or "reduction operation" in error_msg:
            logger.critical(f"NumPy zero-size error: {error_msg}", exc_info=True)
            return RoutePlanResponseDto(
                status="ERROR",
                mode=request.mode.value if request else "UNKNOWN",
                total_cost_minutes=0,
                stops=[],
                routes=[],
                segments=[],
                error="No valid route: insufficient data for prediction"
            )
        
        # Остальные ошибки
        logger.error(f"Critical error in build_route: {exception}", exc_info=True)
        return RoutePlanResponseDto(
            status="ERROR",
            mode=request.mode.value if request else "UNKNOWN",
            total_cost_minutes=0,
            stops=[],
            routes=[],
            segments=[],
            error=f"Internal server error: {str(exception)}"
        )