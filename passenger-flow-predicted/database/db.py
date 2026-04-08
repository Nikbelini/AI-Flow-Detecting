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


def load_stop_history(city_id: int, min_rows: int = 40, max_rows: int = 50, use_csv_fallback: bool = True) -> pd.DataFrame:
    """Загружает историю остановок с колонкой has_camera, сэмплируя по 1-4 записи на остановку"""
    
    query = text("""
        SELECT 
            sh.address, 
            sh.count, sh.velocity, sh.load, sh.datetime,
            s.id as stop_id,
            s.lat, s.lng
        FROM stops_history sh
        LEFT JOIN stops s 
            ON s.address = sh.address 
            AND s.city_id = sh.city_id
        WHERE sh.city_id = :city_id
        ORDER BY sh.id, sh.datetime DESC
    """)
    
    # Пробуем БД
    try:
        df = pd.read_sql(query, engine, params={"city_id": city_id})
        if not df.empty:
            # Логирование: сколько записей "размножилось" из-за дублей адресов
            original_count = df['address'].nunique()
            expanded_count = len(df)
            if expanded_count > original_count:
                logger.info(f"Expanded {original_count} addresses → {expanded_count} rows (ambiguous addresses resolved by duplication)")
            
            # Сэмплируем по stop_id (физическая остановка), а не по address!
            sampled_dfs = []
            for stop_id, group in df.groupby("stop_id"):
                n_samples = random.randint(min_rows, max_rows)
                # Берём последние (свежие) записи для этой остановки
                sampled_dfs.append(group.head(n_samples))
            
            df_sampled = pd.concat(sampled_dfs, ignore_index=True)
            logger.info(f"DB: loaded {len(df_sampled)} rows (sampled {min_rows}-{max_rows}/stop_id) for city {city_id}")
            logger.info(f"   - Unique addresses: {df_sampled['address'].nunique()}")
            logger.info(f"   - Unique stop_id: {df_sampled['stop_id'].nunique()}")
            logger.info(f"   - stop_id range: {df_sampled['stop_id'].min()} – {df_sampled['stop_id'].max()}")
            return _ensure_schema(df_sampled)
            
    except Exception as exception:
        logger.warning(f"DB connection failed: {exception}")
    
    # Фоллбэк на CSV (с тем же сэмплированием)
    if use_csv_fallback:
        df = _load_csv_fallback(city_id)
        if not df.empty:
            # Для CSV та же логика: если есть stop_id — группируем по нему
            group_col = "stop_id" if "stop_id" in df.columns else "address"
            sampled_dfs = []
            for group_key, group in df.groupby(group_col):
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
