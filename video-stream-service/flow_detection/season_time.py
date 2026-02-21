from datetime import datetime
from enum import Enum
from flow_detection.enums import TimeOfDay

class Season(Enum):
    WINTER = "winter"
    SPRING = "spring"
    SUMMER = "summer"
    AUTUMN = "autumn"

def get_season(dt: datetime) -> Season:
    month = dt.month
    if month in [12, 1, 2]:
        return Season.WINTER
    elif month in [3, 4, 5]:
        return Season.SPRING
    elif month in [6, 7, 8]:
        return Season.SUMMER
    else:
        return Season.AUTUMN

def get_time_of_day(dt: datetime) -> TimeOfDay:
    """Определение времени суток с учётом астрономических сезонных изменений.
      Учитывает, что зимой темнеет раньше, а летом позже."""
    hour = dt.hour
    season = get_season(dt)
    
    # Определяем границы светового дня в зависимости от сезона
    daylight_ranges = {
        Season.WINTER: (8, 17),   # Зима: светло с 8:00 до 17:00 (темнеет рано!)
        Season.SPRING: (6, 20),   # Весна: светло с 6:00 до 20:00 (день растёт)
        Season.SUMMER: (5, 22),   # Лето: светло с 5:00 до 22:00 (белые ночи!)
        Season.AUTUMN: (7, 19)    # Осень: светло с 7:00 до 19:00 (день убывает)
    }
    
    start_hour, end_hour = daylight_ranges[season]
    
    if start_hour <= hour < end_hour:
        return TimeOfDay.DAY
    else:
        return TimeOfDay.NIGHT

