from sqlalchemy import create_engine, text
import pandas as pd
import random
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# БД: localhost, порт 5432
DB_URL = os.getenv(
    "DB_URL", 
    "postgresql://postgres:postgres@postgres:5432/stops"
)

# CSV: путь относительно корня проекта
BASE_DIR = Path(__file__).resolve().parent.parent
CSV_FALLBACK_PATH = BASE_DIR / "data" / "fallback_{city_id}.csv"

engine = create_engine(DB_URL, pool_pre_ping=True)


def load_stop_history(city_id: int, min_rows: int = 3990, max_rows: int = 4000, use_csv_fallback: bool = True) -> pd.DataFrame:
    """Загружает историю остановок, сэмплируя по УНИКАЛЬНОМУ источнику (камере/остановке)"""
    
    query = text("""
        SELECT 
            sh.id, -- Важно для уникальности, если stop_id NULL
            sh.address, 
            sh.count, sh.velocity, sh.load, sh.datetime,
            sh.stop_id,
            COALESCE(sh.lat, s.lat) as lat,
            COALESCE(sh.lng, s.lng) as lng
        FROM stops_history sh
        LEFT JOIN stops s ON s.id = sh.stop_id
        WHERE sh.city_id = :city_id
        ORDER BY sh.stop_id NULLS LAST, sh.datetime DESC
    """)
    
    try:
        df = pd.read_sql(query, engine, params={"city_id": city_id})
        
        if df.empty:
            logger.warning(f"DB returned empty dataframe for city {city_id}")
        else:
            original_count = len(df)
            logger.info(f"DB raw load: {original_count} rows for city {city_id}")
            
            sampled_dfs = []
            
            df_with_stop = df[df["stop_id"].notna()]
            if not df_with_stop.empty:
                for stop_id, group in df_with_stop.groupby("stop_id"):
                    n_samples = random.randint(min_rows, max_rows)
                    sampled_dfs.append(group.sort_values("datetime", ascending=False).head(n_samples))
            
            df_without_stop = df[df["stop_id"].isna()]
            
            if not df_without_stop.empty:
                if 'id' in df_without_stop.columns:
                    unique_source_col = 'id'
                    logger.info("Using 'id' column to separate distinct sources without stop_id")
                else:
                    unique_source_col = ['address', 'lat', 'lng']
                    logger.warning("No unique ID for stops without stop_id. Grouping by address/coords (RISKY)")

                for source_key, group in df_without_stop.groupby(unique_source_col, dropna=False):
                    n_samples = random.randint(min_rows, max_rows)
                    sampled_dfs.append(group.sort_values("datetime", ascending=False).head(n_samples))
            
            if sampled_dfs:
                df_sampled = pd.concat(sampled_dfs, ignore_index=True)
                logger.info(f"DB: Sampled {len(df_sampled)} rows total for city {city_id}")
                logger.info(f"   - Unique stop_ids: {df_sampled['stop_id'].nunique()}")
                logger.info(f"   - Unique addresses: {df_sampled['address'].nunique()}")
                return _ensure_schema(df_sampled)
            else:
                logger.warning(f"No valid groups found for sampling in city {city_id}")
            
    except Exception as exception:
        logger.exception(f"DB connection/processing failed: {exception}")
    
    # Фоллбэк на CSV (аналогичная логика)
    if use_csv_fallback:
        df = _load_csv_fallback(city_id)
        if not df.empty:
            if 'id' in df.columns:
                 group_col = 'id'
            elif "stop_id" in df.columns and df["stop_id"].notna().any():
                 group_col = "stop_id"
            else:
                 group_col = ["address", "lat", "lng"]
                 
            sampled_dfs = []
            for key, group in df.groupby(group_col if isinstance(group_col, list) else group_col, dropna=False):
                n_samples = random.randint(min_rows, max_rows)
                sampled_dfs.append(group.head(n_samples))
            
            if sampled_dfs:
                df_sampled = pd.concat(sampled_dfs, ignore_index=True)
                logger.info(f"CSV: loaded {len(df_sampled)} rows (sampled) for city {city_id}")
                return _ensure_schema(df_sampled)
    
    logger.warning(f"No data for city {city_id}")
    return _empty_df()


def load_stop_history_last_window(city_id: int, window_steps: int) -> pd.DataFrame:
    """Загружает только последние window_steps timestamp."""
    query = text("""
        WITH last_times AS (
            SELECT DISTINCT datetime
            FROM stops_history
            WHERE city_id = :city_id
            ORDER BY datetime DESC
            LIMIT :limit
        )
        SELECT sh.stop_id, sh.address, sh.count, sh.datetime, sh.lat, sh.lng
        FROM stops_history sh
        JOIN last_times lt ON sh.datetime = lt.datetime
        WHERE sh.city_id = :city_id
        ORDER BY sh.datetime ASC
    """)

    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"city_id": city_id, "limit": window_steps})

    return df


def get_all_stops_in_city(city_id: int) -> pd.DataFrame:
    """
    Получает ВСЕ остановки города для построения графа.
    """
    query = text("""
        SELECT id as stop_id, address, lat, lng 
        FROM stops 
        WHERE city_id = :city_id AND lat IS NOT NULL AND lng IS NOT NULL
        ORDER BY stop_id
    """)

    try:
        df = pd.read_sql(query, engine, params={"city_id": city_id})
        # Добавляем адреса из истории, если их нет в stops
        return df
    except Exception as exception:
        logger.warning(f"Failed to load stops: {exception}")
        return pd.DataFrame(columns=['stop_id', 'address', 'lat', 'lng'])


def _ensure_schema(df: pd.DataFrame) -> pd.DataFrame:
    """Гарантирует наличие всех нужных колонок"""
    result = df.copy()
    
    for col in ['lat', 'lng', 'count', 'velocity', 'load']:
        if col in result.columns:
            result[col] = pd.to_numeric(result[col], errors='coerce').fillna(0)
    
    # stop_id должен быть int (или nullable Int64)
    if 'stop_id' in result.columns:
        result['stop_id'] = pd.to_numeric(result['stop_id'], errors='coerce').astype('Int64')

    return result

def _empty_df() -> pd.DataFrame:
    """Пустой DataFrame с правильной схемой"""
    return pd.DataFrame(columns=[
        'address', 'count', 'velocity', 'load', 'datetime',
        'lat', 'lng', 'stop_id'
    ])

def _load_csv_fallback(city_id: int) -> pd.DataFrame:
    """Загрузка из CSV"""
    csv_path = str(CSV_FALLBACK_PATH).format(city_id=city_id)
    
    if not os.path.exists(csv_path):
        logger.warning(f"CSV not found: {csv_path}")
        return _empty_df()
    
    try:
        df = pd.read_csv(csv_path, parse_dates=['datetime'])

        # Если в CSV есть stop_id — отлично, если нет — оставляем null
        if 'stop_id' not in df.columns:
            df['stop_id'] = None
        
        logger.info(f"CSV: loaded {len(df)} rows from {csv_path}")
        return _ensure_schema(df)
        
    except Exception as exception:
        logger.error(f"CSV error: {exception}")
        return _empty_df()
