# transport-modeling-service/generate_fake_history.py
"""
Скрипт для генерации СВЕЖИХ исторических данных для тестирования прогнозирования
ДОБАВЛЯЕТ новые записи (не удаляет старые) за последние N часов
"""

import asyncpg
import random
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# ========== КОНФИГУРАЦИЯ ==========
HISTORY_HOURS_BACK = 24  # За сколько последних часов генерировать данные
RECORDS_PER_HOUR = 1    # Количество записей в час на остановку


def generate_pattern_by_hour(hour: int) -> int:
    """
    Генерация количества пассажиров в зависимости от часа (без кластера)
    Упрощённая модель для тестирования
    """
    # Утренний пик (7-9)
    if 7 <= hour <= 9:
        return random.randint(15, 35)
    # Дневная активность (10-16)
    elif 10 <= hour <= 16:
        return random.randint(10, 25)
    # Вечерний пик (17-20)
    elif 17 <= hour <= 20:
        return random.randint(20, 40)
    # Ночь (22-5)
    elif 22 <= hour or hour <= 5:
        return random.randint(1, 5)
    # Остальное
    else:
        return random.randint(5, 15)


async def generate_fresh_history(pool: asyncpg.Pool, city_id: int, hours_back: int = HISTORY_HOURS_BACK):
    """
    Генерация СВЕЖИХ исторических данных за последние N часов
    НЕ УДАЛЯЕТ старые данные, только ДОБАВЛЯЕТ новые
    """
    logger.info("=" * 60)
    logger.info("📊 ГЕНЕРАЦИЯ СВЕЖИХ ИСТОРИЧЕСКИХ ДАННЫХ")
    logger.info("=" * 60)
    
    async with pool.acquire() as conn:
        # 1. Получаем все остановки города (только нужные колонки)
        stops = await conn.fetch("""
            SELECT id, address
            FROM stops 
            WHERE city_id = $1
        """, city_id)
        
        if not stops:
            logger.warning("⚠️ Нет остановок для генерации истории")
            return
        
        logger.info(f"🚏 Найдено {len(stops)} остановок")
        
        # 2. Генерируем СВЕЖИЕ исторические данные
        current_time = datetime.now()
        total_records = 0
        
        for hour_offset in range(hours_back):
            # Время записи: текущее время минус hour_offset часов
            record_time = current_time - timedelta(hours=hour_offset)
            # Округляем до ближайших 15 минут
            record_time = record_time.replace(minute=(record_time.minute // 15) * 15, second=0, microsecond=0)
            
            logger.info(f"🕐 Генерация данных за {record_time.strftime('%Y-%m-%d %H:%M')}...")
            
            for stop in stops:
                stop_id = stop["id"]
                address = stop["address"]
                hour = record_time.hour
                
                # Генерируем количество пассажиров для этого часа
                base_count = generate_pattern_by_hour(hour)
                
                # Добавляем случайный шум
                noise = random.uniform(0.8, 1.2)
                count = max(0, int(base_count * noise))
                
                # Скорость изменения (тренд)
                velocity = random.randint(-3, 3)
                
                # Нагрузка (0-10)
                load = min(10, max(0, count // 5))
                
                # Для каждой записи делаем несколько "измерений" в течение часа
                for measurement in range(RECORDS_PER_HOUR):
                    # Сдвиг внутри часа (0, 15, 30, 45 минут)
                    minute_offset = measurement * 15
                    dt = record_time + timedelta(minutes=minute_offset)
                    
                    # Небольшая вариация в течение часа
                    intra_hour_noise = random.uniform(0.9, 1.1)
                    final_count = max(0, int(count * intra_hour_noise))
                    final_load = min(10, max(0, final_count // 5))
                    
                    try:
                        await conn.execute("""
                            INSERT INTO stops_history (city_id, address, count, velocity, load, datetime)
                            VALUES ($1, $2, $3, $4, $5, $6)
                        """, city_id, address, final_count, velocity, final_load, dt)
                        total_records += 1
                    except Exception as e:
                        logger.warning(f"⚠️ Ошибка вставки для {address}: {e}")
            
            # Логируем прогресс
            stops_per_hour = len(stops) * RECORDS_PER_HOUR
            logger.info(f"   ✅ Сгенерировано ~{stops_per_hour} записей за час")
        
        logger.info(f"   ✅ Всего добавлено {total_records} свежих записей истории")
        
        # 3. Итоговая статистика
        history_count = await conn.fetchval(
            "SELECT COUNT(*) FROM stops_history WHERE city_id = $1",
            city_id
        )
        
        logger.info("\n" + "=" * 60)
        logger.info("📊 ИТОГОВАЯ СТАТИСТИКА")
        logger.info("=" * 60)
        logger.info(f"   🏙️ Город ID: {city_id}")
        logger.info(f"   🚏 Остановок: {len(stops)}")
        logger.info(f"   📊 Всего исторических записей: {history_count}")
        logger.info(f"   🆕 Добавлено свежих записей: {total_records}")
        logger.info(f"   🕐 За последние {hours_back} часов")
        logger.info("=" * 60)
        logger.info("✅ ГЕНЕРАЦИЯ СВЕЖИХ ИСТОРИЧЕСКИХ ДАННЫХ ЗАВЕРШЕНА!")


async def generate_history_for_last_hours(pool: asyncpg.Pool, city_id: int, hours: int = HISTORY_HOURS_BACK):
    """
    Генерирует свежие исторические данные за последние N часов
    """
    async with pool.acquire() as conn:
        # Проверяем, есть ли остановки
        stops_count = await conn.fetchval("SELECT COUNT(*) FROM stops WHERE city_id = $1", city_id)
        
        if stops_count == 0:
            logger.info("📭 Нет остановок, пропускаем генерацию истории")
            return
        
        logger.info(f"🔄 Генерация свежих данных за последние {hours} часа...")
        await generate_fresh_history(pool, city_id, hours_back=hours)


# ========== ФУНКЦИЯ ДЛЯ ВЫЗОВА ИЗ main.py ==========
async def ensure_recent_history_data(pool: asyncpg.Pool, city_id: int, hours: int = 3):
    """
    Проверяет, есть ли свежие данные за последние N часов
    Если нет - генерирует
    """
    async with pool.acquire() as conn:
        # Проверяем, есть ли хотя бы одна остановка
        stops_count = await conn.fetchval("SELECT COUNT(*) FROM stops WHERE city_id = $1", city_id)
        
        if stops_count == 0:
            logger.info("📭 Нет остановок, пропускаем генерацию истории")
            return
        
        # Проверяем, есть ли свежие данные за последние N часов
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        recent_count = await conn.fetchval("""
            SELECT COUNT(*) FROM stops_history 
            WHERE city_id = $1 AND datetime >= $2
        """, city_id, cutoff_time)
        
        expected_count = stops_count * hours * RECORDS_PER_HOUR
        expected_count = max(expected_count, stops_count * 3)  # Минимум 3 записи на остановку
        
        if recent_count < expected_count // 2:
            logger.info(f"📭 Свежих данных мало ({recent_count} записей), запускаем генерацию...")
            await generate_fresh_history(pool, city_id, hours_back=hours)
        else:
            logger.info(f"✅ Свежие данные есть ({recent_count} записей за последние {hours} часа)")


# ========== ФУНКЦИЯ ДЛЯ ПРИНУДИТЕЛЬНОЙ ГЕНЕРАЦИИ ==========
async def force_generate_fresh_history(pool: asyncpg.Pool, city_id: int, hours: int = 3):
    """
    Принудительная генерация свежих данных (даже если уже есть)
    """
    logger.info(f"🔧 Принудительная генерация свежих данных за последние {hours} часа...")
    await generate_fresh_history(pool, city_id, hours_back=hours)


# ========== ДЛЯ ТЕСТИРОВАНИЯ НЕЗАВИСИМО ==========
async def main():
    """Тестовый запуск"""
    import asyncio
    import sys
    import os
    
    # Настройка логирования
    logging.basicConfig(level=logging.INFO)
    
    # Подключение к БД
    pool = await asyncpg.create_pool(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME", "stops"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres")
    )
    
    try:
        # Получаем город
        async with pool.acquire() as conn:
            city = await conn.fetchrow("SELECT id FROM cities LIMIT 1")
            if not city:
                logger.error("❌ Нет городов в БД")
                return
            city_id = city["id"]
        
        # Проверяем аргументы командной строки
        force = "--force" in sys.argv
        hours = 3
        
        for arg in sys.argv:
            if arg.startswith("--hours="):
                hours = int(arg.split("=")[1])
        
        if force:
            await force_generate_fresh_history(pool, city_id, hours)
        else:
            await ensure_recent_history_data(pool, city_id, hours)
        
    finally:
        await pool.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())