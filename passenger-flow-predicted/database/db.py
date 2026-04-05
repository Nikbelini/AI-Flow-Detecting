from sqlalchemy import create_engine, text
import pandas as pd
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

def load_stop_history(city_id: int, use_csv_fallback: bool = True) -> pd.DataFrame:
    """Загружает историю остановок с колонкой has_camera"""
    
    # Используем text() + %(param)s для надёжной работы с psycopg2
    query = text("""
        SELECT 
            sh.address, sh.count, sh.velocity, sh.load, sh.datetime,
            s.lat, s.lng,
            CASE 
                WHEN s.url IS NOT NULL AND TRIM(COALESCE(s.url, '')) != '' 
                THEN TRUE 
                ELSE FALSE 
            END AS has_camera
        FROM stops_history sh
        LEFT JOIN stops s ON s.address = sh.address AND s.city_id = sh.city_id
        WHERE sh.city_id = :city_id
        ORDER BY sh.datetime
    """)
    
    # Пробуем БД
    try:
        df = pd.read_sql(query, engine, params={"city_id": city_id})
        if not df.empty:
            logger.info(f"DB: loaded {len(df)} rows for city {city_id}")
            return _ensure_schema(df)
    except Exception as e:
        logger.warning(f"DB connection failed: {e}")
    
    # Фоллбэк на CSV
    if use_csv_fallback:
        df = _load_csv_fallback(city_id)
        if not df.empty:
            return df
    
    logger.warning(f"No data for city {city_id}")
    return _empty_df()

def _ensure_schema(df: pd.DataFrame) -> pd.DataFrame:
    """Гарантирует наличие всех нужных колонок"""
    if 'has_camera' not in df.columns:
        df['has_camera'] = df.get('url', pd.Series([True]*len(df))).notna()
    
    for col in ['lat', 'lng']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    for col in ['count', 'velocity', 'load']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    
    return df

def _empty_df() -> pd.DataFrame:
    """Пустой DataFrame с правильной схемой"""
    return pd.DataFrame(columns=[
        'address', 'count', 'velocity', 'load', 'datetime',
        'lat', 'lng', 'has_camera'
    ])

def _load_csv_fallback(city_id: int) -> pd.DataFrame:
    """Загрузка из CSV"""
    csv_path = str(CSV_FALLBACK_PATH).format(city_id=city_id)
    
    if not os.path.exists(csv_path):
        logger.warning(f"CSV not found: {csv_path}")
        return _empty_df()
    
    try:
        df = pd.read_csv(csv_path, parse_dates=['datetime'])
        
        if 'url' in df.columns:
            df['has_camera'] = df['url'].notna() & (df['url'].astype(str).str.strip() != '')
        elif 'has_camera' not in df.columns:
            df['has_camera'] = True
        
        logger.info(f"CSV: loaded {len(df)} rows from {csv_path}")
        return _ensure_schema(df)
        
    except Exception as e:
        logger.error(f"❌ CSV error: {e}")
        return _empty_df()

def save_to_csv_fallback(df: pd.DataFrame, city_id: int):
    """Утилита: сохранить в CSV"""
    csv_path = str(CSV_FALLBACK_PATH).format(city_id=city_id)
    os.makedirs(os.path.dirname(csv_path), exist_ok=True)
    df.to_csv(csv_path, index=False)
    logger.info(f"Saved to {csv_path}")