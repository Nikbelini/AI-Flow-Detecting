from __future__ import annotations

from fastapi import APIRouter
from typing import List
import logging
from datetime import datetime, timezone, timedelta

from database.repository import PostgresRepository
from services.route_planner.route_service import RoutePlannerService
from domain.schemas import RouteAlternativeDto, RoutePlanRequestDto, RoutePlanResponseDto, RouteSegmentDto

router = APIRouter(prefix="/routes", tags=["Routes"])

logger = logging.getLogger(__name__)

repository = PostgresRepository()
route_service = RoutePlannerService(repository)


# Смещение Самары: UTC+4
SAMARA_TZ = timezone(timedelta(hours=4))

def get_samara_now() -> str:
    return datetime.now(SAMARA_TZ).strftime("%Y-%m-%dT%H:%M:%S")

def _resolve_dt(request: RoutePlanRequestDto) -> str:
    """datetime определяем для построения маршрута"""
    if request.scheduledFor:
        return request.scheduledFor
    
    if request.datetime:
        # Нормализуем (если нет T)
        dt = request.datetime
        if "T" not in dt:
            dt = dt + "00:00:00"

        return dt
    
    return get_samara_now()

@router.post("/build", response_model=RoutePlanResponseDto)
async def build_route(request: RoutePlanRequestDto) -> RoutePlanResponseDto:
    """
    Построение оптимального маршрута между двумя остановками.
    Принимает JSON body с camelCase или snake_case полями.
    """
    try:
        # Валидация
        if request.startStopId == request.goalStopId:
            raise ValueError("Стартовая и конечная остановки не могут совпадать")
        
        # Нормализация даты
        dt_str = _resolve_dt(request)
        
        result = route_service.build_route(
            city_id=request.cityId,
            start_stop_id=request.startStopId,
            goal_stop_id=request.goalStopId,
            dt_str=dt_str,
            mode=request.mode   
        )

        status = result.get("status")

        if status == "FAILED":
            return _error_response(request, result.get("message", "Маршрут не найден"))

        # Конвертируем сегменты
        segments = _parse_segments(result.get("segments", []))
        alternatives = _parse_alternatives(result.get("alternatives", []))

        return RoutePlanResponseDto(
            status="SUCCESS",
            mode=result.get("mode", request.mode),
            total_cost_minutes=round(result.get("total_cost_minutes", 0.0), 1),
            routing_score=result.get("routing_score"),
            stops=result.get("stops", []),
            routes=result.get("routes", []),
            segments=segments,
            is_scheduled=result.get("is_scheduled", False),
            scheduled_message=result.get("scheduled_message"),
            effective_datetime=result.get("effective_datetime"),
            alternatives=alternatives,
            error=None,
        )
        
    except Exception as exc:
        error_msg = str(exc)
        logger.error("build_route failed: %s", error_msg, exc_info=True)

        # NumPy zero-size — специфичная ошибка предикта нагрузки
        if "zero-size array" in error_msg or "reduction operation" in error_msg:
            return _error_response(
                request,
                "Недостаточно данных для прогноза нагрузки. Попробуйте другую остановку.",
            )

        return _error_response(request, f"Внутренняя ошибка: {error_msg}")
            

def _parse_segments(raw: list) -> List[RouteSegmentDto]:
    result = []
    for seg in raw:
        if isinstance(seg, dict):
            try:
                result.append(RouteSegmentDto(**seg))
            except Exception as e:
                logger.warning("Cannot parse segment %s: %s", seg, e)
        elif isinstance(seg, RouteSegmentDto):
            result.append(seg)
    return result


def _parse_alternatives(raw: list) -> List[RouteAlternativeDto]:
    result = []
    for alt in raw:
        try:
            result.append(
                RouteAlternativeDto(
                    label=alt["label"],
                    mode_used=alt["mode_used"],
                    total_cost_minutes=round(alt["total_cost_minutes"], 1),
                    routing_score=alt.get("routing_score"),
                    stops=alt.get("stops", []),
                    routes=alt.get("routes", []),
                    segments=_parse_segments(alt.get("segments", [])),
                )
            )
        except Exception as e:
            logger.warning("Cannot parse alternative %s: %s", alt, e)
    return result


def _error_response(request: RoutePlanRequestDto, message: str) -> RoutePlanResponseDto:
    return RoutePlanResponseDto(
        status="ERROR",
        mode=request.mode,
        total_cost_minutes=0.0,
        stops=[],
        routes=[],
        segments=[],
        alternatives=[],
        error=message,
    )