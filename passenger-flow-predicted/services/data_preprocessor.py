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
        features: Optional[List[str]] = None) -> Tuple[pd.DataFrame, StandardScaler]:
        """Нормализует числовые признаки"""
        df_norm = df.copy()
        
        if scaler is None:
            scaler = StandardScaler()

        target_features = features if features is not None else DataPreprocessor.FEATURES
        valid_features = [f for f in target_features if f in df_norm.columns]
        
        if not valid_features:
            logger.warning("None of the target features found in DataFrame")
            return df_norm, scaler or StandardScaler()
        

        for col in valid_features:
            df_norm[col] = pd.to_numeric(df_norm[col], errors='coerce').astype(float)
        
        # Fit только на непустых значениях
        mask = df_norm[DataPreprocessor.FEATURES].notna().all(axis=1)
        if mask.sum() > 0:
            df_norm.loc[mask, DataPreprocessor.FEATURES] = scaler.fit_transform(
                df_norm.loc[mask, DataPreprocessor.FEATURES]
            )
        else:
            mask = df_norm[DataPreprocessor.FEATURES].notna().all(axis=1)
            if mask.sum() > 0:
                df_norm.loc[mask, DataPreprocessor.FEATURES] = scaler.transform(
                    df_norm.loc[mask, DataPreprocessor.FEATURES]
                )
        
        return df_norm, scaler
    
    @staticmethod
    def denormalize_count(values: np.ndarray, scaler: StandardScaler) -> np.ndarray:
        """Денормализует ТОЛЬКО count (первый признак)"""
        # Создаём "шаблон" для inverse_transform
        dummy = np.zeros((len(values), len(DataPreprocessor.FEATURES)))
        dummy[:, 0] = values  # count — первый в FEATURES
        
        try:
            denorm = scaler.inverse_transform(dummy)
            return denorm[:, 0]  # возвращаем только count
        except:
            # Fallback: если scaler не fit'нут, возвращаем как есть
            logger.warning("Scaler not fitted, returning raw values")
            return values
    
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