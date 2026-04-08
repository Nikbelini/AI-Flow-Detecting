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
    "postgresql://postgres:postgres@localhost:5432/stops"
)

# CSV: путь относительно корня проекта
BASE_DIR = Path(__file__).resolve().parent.parent
CSV_FALLBACK_PATH = BASE_DIR / "data" / "fallback_{city_id}.csv"

engine = create_engine(DB_URL, pool_pre_ping=True)


def load_stop_history(city_id: int, min_rows: int = 1, max_rows: int = 4, use_csv_fallback: bool = True) -> pd.DataFrame:
    """Загружает историю остановок с колонкой has_camera, сэмплируя по 1-4 записи на остановку"""
    
    query = text("""
        SELECT 
            sh.address, sh.count, sh.velocity, sh.load, sh.datetime,
            s.lat, s.lng
        FROM stops_history sh
        LEFT JOIN stops s ON s.address = sh.address AND s.city_id = sh.city_id
        WHERE sh.city_id = :city_id
        ORDER BY sh.address, sh.datetime DESC
    """)
    
    # Пробуем БД
    try:
        df = pd.read_sql(query, engine, params={"city_id": city_id})
        if not df.empty:
            # Сэмплируем ДО возврата: по min_rows..max_rows записей на адрес
            sampled_dfs = []
            for address, group in df.groupby("address"):
                n_samples = random.randint(min_rows, max_rows)
                # Берём последние (свежие) записи
                sampled_dfs.append(group.head(n_samples))
            
            df_sampled = pd.concat(sampled_dfs, ignore_index=True)
            logger.info(f"DB: loaded {len(df_sampled)} rows (sampled {min_rows}-{max_rows}/stop) for city {city_id}")
            return _ensure_schema(df_sampled)
            
    except Exception as exception:
        logger.warning(f"DB connection failed: {exception}")
    
    # Фоллбэк на CSV (с тем же сэмплированием)
    if use_csv_fallback:
        df = _load_csv_fallback(city_id)
        if not df.empty:
            sampled_dfs = []
            for address, group in df.groupby("address"):
                n_samples = random.randint(min_rows, max_rows)
                sampled_dfs.append(group.head(n_samples))
            df_sampled = pd.concat(sampled_dfs, ignore_index=True)
            logger.info(f"CSV: loaded {len(df_sampled)} rows (sampled) for city {city_id}")
            return _ensure_schema(df_sampled)
    
    logger.warning(f"No data for city {city_id}")
    return _empty_df()


def get_all_stops_in_city(city_id: int) -> pd.DataFrame:
    """
    Получает ВСЕ остановки города для построения графа.
    """
    query = text("""
        SELECT DISTINCT address, lat, lng 
        FROM stops 
        WHERE city_id = :city_id AND lat IS NOT NULL AND lng IS NOT NULL
        ORDER BY address
    """)
    try:
        df = pd.read_sql(query, engine, params={"city_id": city_id})
        # Добавляем адреса из истории, если их нет в stops
        return df
    except:
        return pd.DataFrame(columns=['address', 'lat', 'lng'])


def _ensure_schema(df: pd.DataFrame) -> pd.DataFrame:
    """Гарантирует наличие всех нужных колонок"""
    result = df.copy()
    
    for col in ['lat', 'lng', 'count', 'velocity', 'load']:
        if col in result.columns:
            result[col] = pd.to_numeric(result[col], errors='coerce').fillna(0)
    
    return result

def _empty_df() -> pd.DataFrame:
    """Пустой DataFrame с правильной схемой"""
    return pd.DataFrame(columns=[
        'address', 'count', 'velocity', 'load', 'datetime',
        'lat', 'lng'
    ])

def _load_csv_fallback(city_id: int) -> pd.DataFrame:
    """Загрузка из CSV"""
    csv_path = str(CSV_FALLBACK_PATH).format(city_id=city_id)
    
    if not os.path.exists(csv_path):
        logger.warning(f"CSV not found: {csv_path}")
        return _empty_df()
    
    try:
        df = pd.read_csv(csv_path, parse_dates=['datetime'])
        
        logger.info(f"CSV: loaded {len(df)} rows from {csv_path}")
        return _ensure_schema(df)
        
    except Exception as exception:
        logger.error(f"CSV error: {exception}")
        return _empty_df()
