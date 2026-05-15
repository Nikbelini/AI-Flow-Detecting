import random
from datetime import datetime, timedelta, timezone
from city_timezones import CITY_UTC_OFFSETS


_WORKDAY_PROFILE = {
    0:  0.02,
    1:  0.01,
    2:  0.01,
    3:  0.01,
    4:  0.02,
    5:  0.15,
    6:  0.55,
    7:  1.40,   # утренний пик
    8:  1.80,
    9:  1.50,
    10: 1.10,
    11: 1.00,
    12: 1.15,   # обед
    13: 1.05,
    14: 1.00,
    15: 1.10,
    16: 1.35,
    17: 1.85,   # вечерний пик
    18: 2.00,   # максимум
    19: 1.60,
    20: 1.10,
    21: 0.70,
    22: 0.35,
    23: 0.15,
}

_WEEKEND_PROFILE = {
    0:  0.05,
    1:  0.03,
    2:  0.02,
    3:  0.01,
    4:  0.02,
    5:  0.05,
    6:  0.10,
    7:  0.20,
    8:  0.30,
    9:  0.45,
    10: 0.75,
    11: 0.95,
    12: 1.10,
    13: 1.15,
    14: 1.20,   # дневной пик выходного
    15: 1.25,
    16: 1.20,
    17: 1.10,
    18: 1.00,
    19: 0.85,
    20: 0.75,
    21: 0.55,
    22: 0.30,
    23: 0.15,
}


def get_city_tz(city_name: str) -> timezone:
    """Возвращает timezone для города по имени."""
    offset_hours = CITY_UTC_OFFSETS.get(city_name)
    if offset_hours is None:
        raise ValueError(
            f"Неизвестный город: '{city_name}'. "
            f"Добавьте его в city_timezones.py -> CITY_UTC_OFFSETS. "
            f"Известные города: {list(CITY_UTC_OFFSETS.keys())}"
        )
    return timezone(timedelta(hours=offset_hours))


def get_hour_factor(hour: int, is_weekend: bool) -> float:
    profile = _WEEKEND_PROFILE if is_weekend else _WORKDAY_PROFILE
    return profile.get(hour % 24, 0.1)


def generate_stop_history(
    node_id: str,
    stop_db_id: int,
    address: str,
    node_lat: float,
    node_lon: float,
    city_id: int,
    city_name: str,
    history_days: int = 2,
    start_hour: int = 3,
    end_hour: int = 26,
    base_count_min: int = 5,
    base_count_max: int = 20,
) -> list[dict]:
    """
    Генерирует реалистичные записи истории для одной камерной остановки.

    Ключевой принцип: datetime строится точно как (сегодня - N дней) + конкретный час.
    count всегда соответствует тому часу, который записан в datetime — рассинхрона нет.
    """
    city_tz = get_city_tz(city_name)

    # Полночь сегодняшнего дня в локальном времени города
    today_local = datetime.now(tz=city_tz).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    base_count = random.randint(base_count_min, base_count_max)
    stop_noise_factor = random.uniform(0.85, 1.15)

    records = []

    # Идём от самого старого дня к новому
    for day_offset in range(history_days, 0, -1):
        # Полночь нужного дня в локальном времени города
        day_start = today_local - timedelta(days=day_offset)

        day_of_week = day_start.weekday()  # 0=пн, 6=вс
        is_weekend = day_of_week >= 5

        for hour in range(start_hour, end_hour):
            hour_of_day = hour % 24      # реальный час суток для профиля
            day_add = hour // 24         # если end_hour > 24, переходим на следующий день

            # Точный datetime: дата + час (локальное время города)
            local_dt = day_start + timedelta(days=day_add, hours=hour_of_day)

            # count генерируется строго по тому же hour_of_day — рассинхрона нет!
            factor = get_hour_factor(hour_of_day, is_weekend)
            noise_amplitude = max(0.05, factor * 0.25)
            noise = random.uniform(1.0 - noise_amplitude, 1.0 + noise_amplitude)
            raw_count = base_count * factor * stop_noise_factor * noise

            if hour_of_day <= 4:
                # Глубокая ночь — почти никого
                count = random.choices([0, 1], weights=[0.85, 0.15])[0]
            elif hour_of_day == 5:
                count = max(0, int(raw_count * 0.5))
            else:
                count = max(0, int(round(raw_count)))

            velocity = random.randint(-3, 3)
            load = min(10, max(1, count // 5 + 1))

            # Конвертируем в UTC, сохраняем как naive для PostgreSQL TIMESTAMP WITHOUT TIME ZONE
            dt = local_dt.replace(tzinfo=None)

            records.append({
                "city_id":  city_id,
                "stop_id":  stop_db_id,
                "address":  address,
                "lat":      node_lat,
                "lng":      node_lon,
                "count":    count,
                "velocity": velocity,
                "load":     load,
                "datetime": dt,
            })

    return records