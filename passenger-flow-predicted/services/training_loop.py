import time
import logging
from datetime import datetime, timedelta
from typing import Dict

from database.db import load_stop_history
from .train_stgcn import train
from services.data_guard import has_enough_data

logger = logging.getLogger(__name__)

# Интервалы обучения
INITIAL_CHECK_INTERVAL = 5 * 60  # 5 минут (пока нет данных)
RETRAIN_INTERVAL = 60 * 60  # 1 час (после первого обучения)


def training_loop(city_id: int, status_dict: Dict):
    """
    Фоновый цикл обучения модели
    
    Args:
        city_id: ID города
        status_dict: словарь для обновления статуса (передаётся из main.py)
    """
    logger.info(f"🔄 Training loop started for city {city_id}")
    
    trained_once = False
    consecutive_errors = 0
    max_errors = 5
    
    while True:
        try:
            # Обновить статус
            status_dict['is_training'] = True
            
            # Загрузка данных
            logger.info(f"📥 Checking data for city {city_id}...")
            df = load_stop_history(city_id)
            
            if has_enough_data(df):
                logger.info(f"Enough data available ({df['datetime'].nunique()} timestamps)")
                logger.info(f"Starting training for city {city_id}...")
                
                # Обучение
                start_time = time.time()
                result = train(city_id)
                training_time = time.time() - start_time
                
                if result['status'] == 'SUCCESS':
                    logger.info(f"Training completed in {training_time:.1f}s")
                    logger.info(f"   Best val loss: {result['best_val_loss']:.4f}")
                    logger.info(f"   Epochs: {result['epochs_trained']}")
                    
                    # Обновить статус
                    status_dict['last_training'] = datetime.now().isoformat()
                    status_dict['epochs_completed'] = result['epochs_trained']
                    status_dict['best_loss'] = result['best_val_loss']
                    
                    trained_once = True
                    consecutive_errors = 0
                    
                else:
                    logger.error(f"❌ Training failed: {result.get('message', 'Unknown error')}")
                    consecutive_errors += 1
                    
            else:
                logger.warning(f"⏳ Not enough data yet (need 32+ timestamps)")
                logger.info(f"   Current: {df['datetime'].nunique() if not df.empty else 0} timestamps")
            
            # Рассчитать следующее время обучения
            if trained_once:
                sleep_time = RETRAIN_INTERVAL
                next_training_time = datetime.now() + timedelta(seconds=sleep_time)
                logger.info(f"Sleeping for {sleep_time/60:.0f} minutes")
                logger.info(f"   Next training: {next_training_time.strftime('%Y-%m-%d %H:%M:%S')}")
            else:
                sleep_time = INITIAL_CHECK_INTERVAL
                next_training_time = datetime.now() + timedelta(seconds=sleep_time)
                logger.info(f"Sleeping for {sleep_time/60:.0f} minutes (waiting for data)")
            
            status_dict['next_training'] = next_training_time.isoformat()
            status_dict['is_training'] = False
            
            # Проверка на слишком много ошибок
            if consecutive_errors >= max_errors:
                logger.error(f"❌ Too many consecutive errors ({consecutive_errors}). Stopping training loop.")
                status_dict['is_training'] = False
                break
            
            time.sleep(sleep_time)
            
        except Exception as e:
            logger.error(f"Error in training loop: {str(e)}", exc_info=True)
            consecutive_errors += 1
            status_dict['is_training'] = False
            
            # Экспоненциальный backoff при ошибках
            backoff_time = min(300, 30 * (2 ** consecutive_errors))  # Макс 5 минут
            logger.info(f"Backing off for {backoff_time}s after error")
            time.sleep(backoff_time)
            
            if consecutive_errors >= max_errors:
                logger.error(f"Too many errors. Stopping training loop.")
                break
    
    logger.info(f"Training loop stopped for city {city_id}")


def manual_train_once(city_id: int) -> Dict:
    """
    Ручной запуск одного цикла обучения (для тестирования)
    
    Args:
        city_id: ID города
        
    Returns:
        Результат обучения
    """
    logger.info(f"🔧 Manual training triggered for city {city_id}")
    
    df = load_stop_history(city_id)
    
    if not has_enough_data(df):
        return {
            'status': 'FAILED',
            'message': f'Not enough data (need 32+ timestamps, got {df["datetime"].nunique()})'
        }
    
    return train(city_id)