from sqlalchemy import create_engine, text
import os
import pandas as pd
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class StopDTO:
    id: int
    address: str
    lat: float
    lng: float


@dataclass
class RouteInfoDTO:
    route_id: int
    frequency: float


class PostgresRepository:
    def __init__(self):
        self.db_url = os.getenv(
            "DB_URL",
            "postgresql://postgres:postgres@postgres:5432/stops"
        )
        self.engine = create_engine(self.db_url, pool_pre_ping=True)

    # -------------------------
    # Остановки
    # -------------------------

    def get_all_stops(self, city_id: int) -> List[StopDTO]:
        query = text("""
            SELECT id, address, lat, lng
            FROM stops
            WHERE city_id = :city_id
              AND lat IS NOT NULL AND lng IS NOT NULL
            ORDER BY id
        """)

        df = pd.read_sql(query, self.engine, params={"city_id": city_id})

        result: List[StopDTO] = []
        for _, row in df.iterrows():
            result.append(
                StopDTO(
                    id=int(row["id"]),
                    address=str(row["address"]),
                    lat=float(row["lat"]),
                    lng=float(row["lng"])
                )
            )

        return result

    def get_city_center(self, city_id: int) -> Tuple[float, float]:
        """
        Центр города можно взять как среднее значение координат остановок.
        Это удобно и не требует отдельной таблицы.
        """
        query = text("""
            SELECT AVG(lat) AS center_lat, AVG(lng) AS center_lng
            FROM stops
            WHERE city_id = :city_id
              AND lat IS NOT NULL AND lng IS NOT NULL
        """)

        df = pd.read_sql(query, self.engine, params={"city_id": city_id})

        if df.empty or df.iloc[0]["center_lat"] is None:
            return (0.0, 0.0)

        return float(df.iloc[0]["center_lat"]), float(df.iloc[0]["center_lng"])

    # -------------------------
    # Реальное "последнее значение до dt"
    # -------------------------
    def get_last_passenger_flows_before_dt(self, city_id: int, dt: str) -> Dict[str, float]:
        query = text("""
            SELECT DISTINCT ON (sh.address)
                sh.address,
                sh.count,
                sh.datetime
            FROM stops_history sh
            WHERE sh.city_id = :city_id
            AND sh.datetime <= :dt
            ORDER BY sh.address, sh.datetime DESC
        """)

        df = pd.read_sql(query, self.engine, params={
            "city_id": city_id,
            "dt": dt
        })

        result: Dict[str, float] = {}
        for _, row in df.iterrows():
            result[str(row["address"])] = float(row["count"])

        return result

    # -------------------------
    # Маршруты остановки
    # -------------------------
    def get_routes_by_stop(self, stop_id: int) -> List[RouteInfoDTO]:
        query = text("""
            SELECT r.id AS route_id,
                   r.interval_minutes
            FROM routes r
            JOIN route_stops rs ON rs.route_id = r.id
            WHERE rs.stop_id = :stop_id
              AND r.is_active = true
              AND rs.is_active = true
        """)

        df = pd.read_sql(query, self.engine, params={"stop_id": stop_id})

        result: List[RouteInfoDTO] = []

        for _, row in df.iterrows():
            interval = row["interval_minutes"]

            if interval is None or interval == 0:
                freq = 1.0
            else:
                freq = 60.0 / float(interval)

            result.append(RouteInfoDTO(route_id=int(row["route_id"]), frequency=freq))

        return result

    # -------------------------
    # Общие маршруты двух остановок
    # -------------------------
    def count_common_routes(self, stop_i: int, stop_j: int) -> int:
        query = text("""
            SELECT COUNT(DISTINCT r.id) AS common_routes
            FROM routes r
            JOIN route_stops rs1 ON rs1.route_id = r.id
            JOIN route_stops rs2 ON rs2.route_id = r.id
            WHERE rs1.stop_id = :stop_i
              AND rs2.stop_id = :stop_j
              AND r.is_active = true
              AND rs1.is_active = true
              AND rs2.is_active = true
        """)

        df = pd.read_sql(query, self.engine, params={"stop_i": stop_i, "stop_j": stop_j})

        if df.empty:
            return 0

        return int(df.iloc[0]["common_routes"])

    # -------------------------
    # Рёбра графа по order_in_route
    # -------------------------
    def get_route_edges(self, city_id: int) -> List[tuple[int, int]]:
        query = text("""
            SELECT rs1.stop_id AS from_stop,
                   rs2.stop_id AS to_stop
            FROM route_stops rs1
            JOIN route_stops rs2
                ON rs1.route_id = rs2.route_id
                AND rs1.direction = rs2.direction
                AND rs2.order_in_route = rs1.order_in_route + 1
            JOIN routes r ON r.id = rs1.route_id
            JOIN stops s ON s.id = rs1.stop_id
            WHERE r.is_active = true
              AND rs1.is_active = true
              AND rs2.is_active = true
              AND s.city_id = :city_id
        """)

        df = pd.read_sql(query, self.engine, params={"city_id": city_id})

        edges: List[tuple[int, int]] = []
        for _, row in df.iterrows():
            edges.append((int(row["from_stop"]), int(row["to_stop"])))

        return edges
    

    def get_transport_edges(self, city_id: int) -> list[dict]:
        """
        Возвращает рёбра графа для построения маршрута.
        Каждый элемент словаря:
        {
            "from_stop_id": int,
            "to_stop_id": int,
            "route_id": int,
            "dist_km": float,           # расстояние между остановками, пример 1.0
            "travel_time_min": float     # примерное время движения
        }
        """
        query = text("""
            SELECT rs1.stop_id AS from_stop_id,
                   rs2.stop_id AS to_stop_id,
                   r.id AS route_id
            FROM route_stops rs1
            JOIN route_stops rs2
              ON rs1.route_id = rs2.route_id
             AND rs1.direction = rs2.direction
             AND rs2.order_in_route = rs1.order_in_route + 1
            JOIN routes r ON r.id = rs1.route_id
            JOIN stops s ON s.id = rs1.stop_id
            WHERE r.is_active = true
              AND rs1.is_active = true
              AND rs2.is_active = true
              AND s.city_id = :city_id
        """)

        df = pd.read_sql(query, self.engine, params={"city_id": city_id})

        edges: list[dict] = []
        for _, row in df.iterrows():
            edges.append({
                "from_stop_id": int(row["from_stop_id"]),
                "to_stop_id": int(row["to_stop_id"]),
                "route_id": int(row["route_id"]),
                "dist_km": 1.0,          # можно позже заменить реальным расстоянием
                "travel_time_min": 1.0   # можно заменить на реальное время по маршруту
            })

        return edges