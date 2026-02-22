# map_cache_service.py
from fastapi import FastAPI, HTTPException
import redis
import pandas as pd
import json
from datetime import datetime, timedelta
from sqlalchemy import create_engine
import numpy as np

app = FastAPI()
redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
pg_engine = create_engine('postgresql://user:pass@localhost/flowdetect')

# Конфигурация
CACHE_TTL_DAYS = 30  # 30 дней жизни кэша
CITIES = {1: "Ульяновск"}

@app.get("/city/{city_id}/map")
async def get_city_map(city_id: int):
    """
    Получение карты города с данными остановок
    """
    cache_key = f"city:{city_id}:map"
    
    # 1. Проверяем Redis
    cached = redis_client.get(cache_key)
    
    if cached:
        cache_data = json.loads(cached)
        cache_age = datetime.now() - datetime.fromisoformat(cache_data['cached_at'])
        
        # 2. Если кэш свежий (< 30 дней) — отдаём
        if cache_age.days < CACHE_TTL_DAYS:
            return {
                "city": CITIES.get(city_id),
                "data": cache_data['stops'],
                "cached": True,
                "age_days": cache_age.days,
                "expires_in_days": CACHE_TTL_DAYS - cache_age.days
            }
        else:
            print(f"⚠️ Кэш города {city_id} устарел ({cache_age.days} дней)")
            # Продолжаем — пересчитаем
    
    # 3. Кэша нет или устарел — запускаем сублимацию
    print(f"🔄 Запуск сублимации для города {city_id}...")
    map_data = await sublimate_city_data(city_id)
    
    # 4. Сохраняем в Redis
    cache_entry = {
        'stops': map_data,
        'cached_at': datetime.now().isoformat(),
        'city_id': city_id
    }
    
    redis_client.setex(
        cache_key, 
        timedelta(days=CACHE_TTL_DAYS + 1),  # +1 день запаса
        json.dumps(cache_entry, default=str)
    )
    
    return {
        "city": CITIES.get(city_id),
        "data": map_data,
        "cached": False,
        "generated": datetime.now().isoformat()
    }

async def sublimate_city_data(city_id: int):
    """
    Сублимация данных для конкретного города
    """
    # 1. Получаем все остановки города
    stops_query = f"SELECT id, address, lat, lng FROM stops WHERE city_id = {city_id}"
    stops_df = pd.read_sql(stops_query, pg_engine)
    
    result = []
    
    # 2. Для каждой остановки собираем сублимат
    for _, stop in stops_df.iterrows():
        stop_id = stop['id']
        
        # Загружаем историю за последние 3 месяца
        history_query = f"""
            SELECT 
                EXTRACT(DOW FROM datetime) as dow,
                EXTRACT(HOUR FROM datetime) as hour,
                count, velocity, load
            FROM stops_history 
            WHERE stop_id = {stop_id}
            AND datetime >= NOW() - INTERVAL '90 days'
        """
        
        history_df = pd.read_sql(history_query, pg_engine)
        
        if history_df.empty:
            # Нет истории — базовые значения
            stop_data = {
                'id': stop_id,
                'address': stop['address'],
                'lat': float(stop['lat']),
                'lng': float(stop['lng']),
                'avg_pattern': [5] * 24,  # Заглушка
                'cluster': 'unknown',
                'peak_hours': []
            }
        else:
            # Считаем паттерн по часам
            pattern = []
            for hour in range(24):
                hour_data = history_df[history_df['hour'] == hour]
                if not hour_data.empty:
                    avg = hour_data['count'].mean()
                    pattern.append(round(avg, 1))
                else:
                    pattern.append(0)
            
            # Определяем пиковые часы
            peak_hours = []
            for h in range(24):
                if pattern[h] > np.mean(pattern) * 1.5:
                    peak_hours.append(h)
            
            # Кластеризация (упрощённо)
            if 7 in peak_hours and 18 in peak_hours:
                cluster = 'office'
            elif 12 in peak_hours and 19 in peak_hours:
                cluster = 'shopping'
            elif 8 in peak_hours and 14 in peak_hours:
                cluster = 'educational'
            else:
                cluster = 'residential'
            
            stop_data = {
                'id': stop_id,
                'address': stop['address'],
                'lat': float(stop['lat']),
                'lng': float(stop['lng']),
                'avg_pattern': pattern,
                'cluster': cluster,
                'peak_hours': peak_hours,
                'max_count': int(history_df['count'].max()),
                'avg_load': round(history_df['load'].mean(), 1)
            }
        
        result.append(stop_data)
    
    return result

@app.get("/city/{city_id}/refresh")
async def refresh_city_cache(city_id: int):
    """Принудительное обновление кэша города"""
    cache_key = f"city:{city_id}:map"
    
    # Удаляем старый кэш
    redis_client.delete(cache_key)
    
    # Генерируем новый
    map_data = await sublimate_city_data(city_id)
    
    cache_entry = {
        'stops': map_data,
        'cached_at': datetime.now().isoformat(),
        'city_id': city_id
    }
    
    redis_client.setex(
        cache_key,
        timedelta(days=CACHE_TTL_DAYS + 1),
        json.dumps(cache_entry, default=str)
    )
    
    return {"status": "refreshed", "city_id": city_id}

@app.get("/admin/cache/stats")
async def cache_stats():
    """Статистика кэша"""
    stats = {}
    for city_id in CITIES.keys():
        key = f"city:{city_id}:map"
        cached = redis_client.get(key)
        if cached:
            data = json.loads(cached)
            age = datetime.now() - datetime.fromisoformat(data['cached_at'])
            stats[city_id] = {
                'city': CITIES[city_id],
                'cached': True,
                'age_days': age.days,
                'stops_count': len(data['stops'])
            }
        else:
            stats[city_id] = {
                'city': CITIES[city_id],
                'cached': False
            }
    return stats