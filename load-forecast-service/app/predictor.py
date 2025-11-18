import pandas as pd
import numpy as np
import pickle
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import LSTM, Dense, Input, Concatenate, Dropout
from datetime import datetime
import logging
from typing import List, Dict, Any, Optional
import os

logger = logging.getLogger(__name__)

class PassengerFlowPredictor:
    def __init__(self, model_weights_path: str, preprocessor_path: str):
        self.model_weights_path = model_weights_path
        self.preprocessor_path = preprocessor_path
        self.model = None
        self.preprocessor_data = None
        self.is_loaded = False
        
    def load_model(self):
        """Загрузка модели и препроцессора"""
        try:
            # Проверяем существование файлов
            if not os.path.exists(self.preprocessor_path):
                logger.error(f"❌ Файл препроцессора не найден: {self.preprocessor_path}")
                return False
                
            if not os.path.exists(self.model_weights_path):
                logger.error(f"❌ Файл весов модели не найден: {self.model_weights_path}")
                return False
            
            # Загрузка препроцессора
            logger.info(f"📁 Загрузка препроцессора из {self.preprocessor_path}")
            with open(self.preprocessor_path, 'rb') as f:
                self.preprocessor_data = pickle.load(f)
            logger.info("✅ Препроцессор загружен")
            
            # Создание архитектуры модели
            logger.info("🏗️ Создание архитектуры модели...")
            self.model = self._create_model_architecture()
            
            # Загрузка весов
            logger.info(f"📁 Загрузка весов из {self.model_weights_path}")
            self.model.load_weights(self.model_weights_path)
            logger.info("✅ Веса модели загружены")
            
            self.is_loaded = True
            logger.info("🎉 Модель успешно инициализирована")
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка загрузки модели: {e}")
            import traceback
            logger.error(traceback.format_exc())
            self.is_loaded = False
            return False
    
    def _create_model_architecture(self):
        """Создание ТОЧНОЙ архитектуры модели как при обучении"""
        print("🏗️ Создание точной архитектуры модели...")
        
        # ТОЧНАЯ архитектура из обучения
        nn_input = Input(shape=(24, 10), name='temporal_input')  # 10 временных признаков
        
        # Глубокая LSTM архитектура (как в обучении)
        x = LSTM(256, return_sequences=True, dropout=0.2, recurrent_dropout=0.1)(nn_input)
        x = tf.keras.layers.BatchNormalization()(x)
        
        x = LSTM(128, return_sequences=True, dropout=0.2, recurrent_dropout=0.1)(x)
        x = tf.keras.layers.BatchNormalization()(x)
        
        x = LSTM(64, return_sequences=True, dropout=0.1)(x)
        x = tf.keras.layers.BatchNormalization()(x)
        
        x = LSTM(32, dropout=0.1)(x)
        x = tf.keras.layers.BatchNormalization()(x)
        
        nn_output = Dense(64, activation='relu')(x)
        nn_output = Dropout(0.2)(nn_output)
        
        # МОЩНЫЙ НЕЧЕТКИЙ КОМПОНЕНТ (как в обучении)
        fuzzy_input = Input(shape=(6,), name='fuzzy_input')  # 6 нечетких признаков
        y = Dense(128, activation='relu')(fuzzy_input)
        y = tf.keras.layers.BatchNormalization()(y)
        y = Dropout(0.3)(y)
        
        y = Dense(64, activation='relu')(y)
        y = tf.keras.layers.BatchNormalization()(y)
        y = Dropout(0.2)(y)
        
        y = Dense(32, activation='relu')(y)
        fuzzy_output = Dropout(0.1)(y)
        
        # ГЛУБОКОЕ ОБЪЕДИНЕНИЕ (как в обучении)
        combined = Concatenate()([nn_output, fuzzy_output])
        
        # Многослойная сеть после объединения
        z = Dense(128, activation='relu')(combined)
        z = tf.keras.layers.BatchNormalization()(z)
        z = Dropout(0.3)(z)
        
        z = Dense(64, activation='relu')(z)
        z = tf.keras.layers.BatchNormalization()(z)
        z = Dropout(0.2)(z)
        
        z = Dense(32, activation='relu')(z)
        z = Dropout(0.1)(z)
        
        # РАЗДЕЛЬНЫЕ ВЕТКИ (как в обучении)
        passenger_branch = Dense(16, activation='relu')(z)
        load_branch = Dense(16, activation='relu')(z)
        
        # ВЫХОДНЫЕ СЛОИ
        passenger_output = Dense(1, activation='linear', name='passenger_count')(passenger_branch)
        load_output = Dense(1, activation='linear', name='load')(load_branch)
        
        model = Model(
            inputs=[nn_input, fuzzy_input],
            outputs=[passenger_output, load_output]
        )
        
        # Компиляция такая же как при обучении
        optimizer = tf.keras.optimizers.Adam(learning_rate=0.001)
        
        model.compile(
            optimizer=optimizer,
            loss={
                'passenger_count': 'mse',
                'load': 'mse'
            },
            loss_weights={
                'passenger_count': 0.7,
                'load': 0.3
            },
            metrics={
                'passenger_count': ['mae'],
                'load': ['mae']
            }
        )
        
        print("✅ Точная архитектура модели создана")
        return model
    
    def preprocess_data(self, data: List[Dict]) -> pd.DataFrame:
        """Предобработка входных данных"""
        try:
            df = pd.DataFrame(data)
            logger.info(f"📊 Загружено {len(df)} записей для предобработки")
            
            # Конвертация времени
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            
            # Создание временных признаков
            df['hour_of_day'] = df['timestamp'].dt.hour
            df['day_of_week'] = df['timestamp'].dt.dayofweek
            df['month'] = df['timestamp'].dt.month
            
            # Тригонометрические признаки
            df['hour_sin'] = np.sin(2 * np.pi * df['hour_of_day']/24)
            df['hour_cos'] = np.cos(2 * np.pi * df['hour_of_day']/24)
            df['day_sin'] = np.sin(2 * np.pi * df['day_of_week']/7)
            df['day_cos'] = np.cos(2 * np.pi * df['day_of_week']/7)
            df['month_sin'] = np.sin(2 * np.pi * df['month']/12)
            df['month_cos'] = np.cos(2 * np.pi * df['month']/12)
            
            # Дополнительные временные признаки
            df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
            df['is_morning'] = ((df['hour_of_day'] >= 7) & (df['hour_of_day'] <= 10)).astype(int)
            df['is_evening'] = ((df['hour_of_day'] >= 17) & (df['hour_of_day'] <= 20)).astype(int)
            df['is_night'] = ((df['hour_of_day'] >= 22) | (df['hour_of_day'] <= 5)).astype(int)
            
            # Заполнение пропущенных значений по умолчанию
            default_values = {
                'temperature': 20.0,
                'precipitation': 0.0,
                'velocity': 0.0,
                'weather_code': 1,
                'day_type': 'normal_day',
                'event_type': 'NO_EVENTS'
            }
            
            for feature, default in default_values.items():
                if feature in df.columns:
                    df[feature] = df[feature].fillna(default)
                else:
                    df[feature] = default
            
            # Нормализация числовых признаков (если есть скейлеры)
            if self.preprocessor_data and 'scalers' in self.preprocessor_data:
                numerical_features = ['temperature', 'precipitation', 'velocity']
                for feature in numerical_features:
                    if feature in df.columns and feature in self.preprocessor_data['scalers']:
                        scaler = self.preprocessor_data['scalers'][feature]
                        df[feature] = scaler.transform(df[[feature]])
            
            # Кодирование категориальных признаков (если есть энкодеры)
            if self.preprocessor_data and 'label_encoders' in self.preprocessor_data:
                categorical_features = ['day_type', 'event_type', 'weather_code']
                for feature in categorical_features:
                    if feature in df.columns and feature in self.preprocessor_data['label_encoders']:
                        encoder = self.preprocessor_data['label_encoders'][feature]
                        # Обрабатываем новые значения
                        unique_vals = df[feature].unique()
                        for val in unique_vals:
                            if val not in encoder.classes_:
                                # Для новых значений используем кодировку по умолчанию
                                df[feature] = df[feature].replace(val, encoder.classes_[0])
                        df[feature] = encoder.transform(df[feature])
            
            logger.info("✅ Данные успешно предобработаны")
            return df
            
        except Exception as e:
            logger.error(f"❌ Ошибка предобработки данных: {e}")
            raise
    
    def prepare_sequences(self, processed_data: pd.DataFrame, sequence_length: int = 24):
        """Подготовка последовательностей для прогнозирования"""
        # ТОЧНО ТЕ ЖЕ ПРИЗНАКИ что и при обучении
        temporal_features = ['hour_sin', 'hour_cos', 'day_sin', 'day_cos', 
                            'month_sin', 'month_cos', 'is_weekend', 'is_morning', 
                            'is_evening', 'is_night']  # 10 признаков
        
        fuzzy_features = ['temperature', 'precipitation', 'weather_code', 
                        'day_type', 'event_type', 'velocity']  # 6 признаков
        
        available_temporal = [f for f in temporal_features if f in processed_data.columns]
        available_fuzzy = [f for f in fuzzy_features if f in processed_data.columns]
        
        print(f"📊 Используется {len(available_temporal)} временных и {len(available_fuzzy)} нечетких признаков")
        
        if len(processed_data) < sequence_length:
            raise ValueError(f"Недостаточно данных. Нужно минимум {sequence_length} записей")
        
        # Берем последнюю последовательность
        last_sequence = processed_data.tail(sequence_length)
        
        X_nn = last_sequence[available_temporal].values.reshape(1, sequence_length, -1)
        X_fuzzy = last_sequence[available_fuzzy].iloc[-1:].values
        
        timestamps = processed_data['timestamp'].tolist()
        
        print(f"✅ Подготовлены данные: X_nn {X_nn.shape}, X_fuzzy {X_fuzzy.shape}")
        
        return X_nn, X_fuzzy, timestamps
    
    def forecast(self, historical_data: List[Dict], forecast_hours: int = 6):
        """Прогнозирование на несколько часов вперед"""
        if not self.is_loaded:
            raise ValueError("Модель не загружена")
        
        try:
            # Предобработка данных
            processed_data = self.preprocess_data(historical_data)
            
            # Подготовка последовательностей
            X_nn, X_fuzzy, timestamps = self.prepare_sequences(processed_data)
            
            # Прогнозирование
            predictions = []
            last_timestamp = pd.to_datetime(timestamps[-1])
            
            for i in range(forecast_hours):
                # Предсказание
                pred_passenger, pred_load = self.model.predict([X_nn, X_fuzzy], verbose=0)
                
                forecast_time = last_timestamp + pd.Timedelta(hours=i+1)
                
                predictions.append({
                    'timestamp': forecast_time.isoformat(),
                    'predicted_passenger_count': max(0, float(pred_passenger[0][0])),  # Не отрицательные значения
                    'predicted_load': max(0, min(10, float(pred_load[0][0]))),  # Ограничение 0-10
                    'forecast_hour': i + 1
                })
            
            logger.info(f"📈 Создано {len(predictions)} прогнозов")
            return predictions
            
        except Exception as e:
            logger.error(f"❌ Ошибка прогнозирования: {e}")
            raise