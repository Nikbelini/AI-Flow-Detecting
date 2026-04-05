import pandas as pd

def has_enough_data(df: pd.DataFrame, min_steps: int = 32) -> bool:
    if df.empty:
        return False
    return df['datetime'].nunique() >= min_steps

def count_camera_vs_blind(df: pd.DataFrame) -> tuple[int, int]:
    """Считает остановки с камерами и без по колонке has_camera"""
    if df.empty or 'has_camera' not in df.columns:
        return 0, 0
    
    camera = int(df[df['has_camera'] == True]['address'].nunique())
    blind = int(df[df['has_camera'] == False]['address'].nunique())
    return camera, blind

def split_camera_blind(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Разделяет по колонке has_camera:
    - camera_df: где has_camera == True (для обучения)
    - blind_df: где has_camera == False (для прогноза)
    """
    if df.empty or 'has_camera' not in df.columns:
        return df.copy(), pd.DataFrame(columns=df.columns)
    
    camera_df = df[df['has_camera'] == True].copy()
    blind_df = df[df['has_camera'] == False].copy()
    
    return camera_df, blind_df