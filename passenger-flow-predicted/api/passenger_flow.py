from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone, timedelta

from database.repository import PostgresRepository
from algorithm.transport_graph_builder import TransportGrapthBuilder
from algorithm.passenger_flow_predictor import PassengerFlowGraphPredictor


router = APIRouter(prefix="/passenger-flow", tags=["Passenger Flow Algorithm"])


# Смещение Самары: UTC+4
SAMARA_TZ = timezone(timedelta(hours=4))

def get_samara_now() -> str:
    return datetime.now(SAMARA_TZ).strftime("%Y-%m-%dT%H:%M:%S")

def normalize_dt(dt: str) -> str:
    if "T" not in dt:
        return dt + "T23:59:59"
    return dt

@router.get("/predict/all")
def predict_all(city_id: int, dt: str = None, neighbors_limit: int = 15):

    try:
        # Авто-подстановка даты по Самаре, если не передана
        if dt is None:
            dt = get_samara_now()
            print(dt)
        else:
            dt = normalize_dt(dt)
        
        repository = PostgresRepository()

        stops = repository.get_all_stops(city_id)
        if not stops:
            raise HTTPException(404, "No stops found")
        
        stops_map = {s.id: s for s in stops}

        # route_edges надо добавить в репозиторий
        route_edges = repository.get_route_edges(city_id)

        graph_builder = TransportGrapthBuilder(max_distance_km=1.0)
        graph = graph_builder.build_graph(stops, route_edges)

        predictor = PassengerFlowGraphPredictor(repository)

        # Все последние значения count по городу
        last_known_flow = repository.get_last_passenger_flows_before_dt(city_id, dt)

        predictions_list = []

        for stop in stops:
            # если есть реальный поток (камера / известные данные)
            if stop.address in last_known_flow:
                predictions_list.append({
                    "stop_id": stop.id,
                    "address": stop.address,
                    "lat": stop.lat,
                    "lng": stop.lng,
                    "predicted_count": float(last_known_flow[stop.address]),
                    "neighbors_used": 0,
                })
                continue

            # иначе прогнозируем
            predicted, debug = predictor.predict(
                city_id=city_id,
                stop_id=stop.id,
                dt_str=dt,
                graph=graph,
                stops_map=stops_map,
                last_known_flow=last_known_flow,
                neighbors_limit=neighbors_limit
            )

            predictions_list.append({
                "stop_id": stop.id,
                "address": stop.address,
                "lat": stop.lat,
                "lng": stop.lng,
                "predicted_count": round(predicted, 3),
                "method": "graph-predicted",
                "neighbors_used": debug.get("neighbors_used", 0),
                "debug": debug
            })

        return {
            "city_id": city_id,
            "datetime": dt,
            "stops_total": len(stops),
            "results": predictions_list
        }

    except Exception as exception:
        raise HTTPException(status_code=500, detail=str(exception))