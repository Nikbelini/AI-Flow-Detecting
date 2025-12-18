from sqlalchemy import create_engine
import pandas as pd
import os

DB_URL = os.getenv(
    "DB_URL",
    "postgresql://postgres:postgres@postgres:5432/stops"
)

engine = create_engine(DB_URL)

def load_stop_history(city_id: int):
    query = """
    SELECT sh.address, sh.count, sh.velocity, sh.load, sh.datetime,
           s.lat, s.lng
    FROM stops_history sh
    JOIN stops s ON s.address = sh.address
    WHERE sh.city_id = %s
    ORDER BY sh.datetime
    """
    return pd.read_sql(query, engine, params=[city_id])
