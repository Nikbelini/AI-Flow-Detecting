from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

# Ночное окно
NIGHT_START: int = 1
NIGHT_END: int = 5

# Паттерн для зачистки timezone-суффикса перед парсингом
_TZ_SUFFIX_RE = re.compile(r"([+-]\d{2}:\d{2}|Z)$")


def parse_dt(dt_str: str) -> datetime:
    """
    Парсит строку даты/времени в naive datetime (local-time семантика).
    Timezone-суффикс отбрасывается — предполагается, что клиент
    уже передаёт локальное время сервера (Самара UTC+4).
    """

    # Зачищаем timezone-суффикс
    clean = _TZ_SUFFIX_RE.sub("", dt_str.strip())

    # Добавлен формат с миллисекундами (%f) — именно он нужен для .696
    for fmt in (
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(clean, fmt)
        except ValueError:
            continue
    raise ValueError(f"Cannot parse datetime: {dt_str}")


def is_night_hours(dt: datetime) -> bool:
    """Возвращает True если транспорт не ходит (01:00–05:00)"""
    return NIGHT_START <= dt.hour < NIGHT_END


def next_service_start(dt: datetime) -> datetime:
    """Возвращает время начала следующего движения транспорта"""
    candidate = dt.replace(hour=NIGHT_END, minute=0, second=0, microsecond=0)
 
    # Если 05:00 уже прошло сегодня — переносим на завтра
    if candidate <= dt:
        candidate += timedelta(days=1)
 
    return candidate


@dataclass
class TimeGuardResult:
    """Результат проверки времени запроса."""

    effective_dt: datetime

    """Фактическое время, по которому строится маршрут."""
    is_scheduled: bool

    """True - маршрут перенесён на первый утренний рейс."""
    user_message: Optional[str]

def evaluate_request_time(dt_str: str) -> TimeGuardResult:
    """Алгоритм модуля time (парсинг времени, ночное -> в 5:00 идём). Иначе - исходное время"""
    dt = parse_dt(dt_str)

    if is_night_hours(dt):
        first_ride = next_service_start(dt)
        msg = (
            f"Транспорт не ходит с 01:00 до 05:00."
            f"Маршрут построен на первый рейс — {first_ride.strftime('%H:%M')} "
            f"{first_ride.strftime('%d.%m.%Y')}."
        )

        return TimeGuardResult(
            effective_dt=first_ride,
            is_scheduled=True,
            user_message=msg
        )
    
    return TimeGuardResult(
        effective_dt=dt,
        is_scheduled=False,
        user_message=None
    )