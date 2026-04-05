import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from typing import List, Tuple, Optional, Dict
import pickle
import logging

logger = logging.getLogger(__name__)

class DataPreprocessor:
    """
    Нормализация/денормализация данных + сохранение scaler.
    Критично: обучаем на нормализованных данных, прогнозируем, затем денормализуем.
    """
    
    FEATURES = ['count', 'velocity', 'load']
    
    @staticmethod
    def normalize(df: pd.DataFrame, scaler: Optional[StandardScaler] = None, 
        fit: bool = True) -> Tuple[pd.DataFrame, StandardScaler]:
        """Нормализует числовые признаки"""
        df_norm = df.copy()
        
        if "count" not in df_norm.columns:
            df_norm["count"] = 0.0

        df_norm["count"] = pd.to_numeric(df_norm["count"], errors="coerce").fillna(0.0)

        if scaler is None:
            scaler = StandardScaler()

        X = df_norm[["count"]].values.astype(float)

        if fit:
            scaler.fit(X)

        df_norm[["count"]] = scaler.transform(X)
        return df_norm, scaler
    
    
    @staticmethod
    def denormalize_count(values: np.ndarray, scaler: StandardScaler) -> np.ndarray:
        """Денормализует ТОЛЬКО count (первый признак)"""
        values = np.asarray(values, dtype=np.float32).reshape(-1, 1)
        return scaler.inverse_transform(values).reshape(-1)
    
    @staticmethod
    def save_scaler(scaler: StandardScaler, path: str):
        """Сохраняет scaler для последующего использования при inference"""
        import os
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            pickle.dump(scaler, f)
    
    @staticmethod
    def load_scaler(path: str) -> Optional[StandardScaler]:
        """Загружает сохранённый scaler"""
        try:
            with open(path, 'rb') as f:
                return pickle.load(f)
        except FileNotFoundError:
            return None