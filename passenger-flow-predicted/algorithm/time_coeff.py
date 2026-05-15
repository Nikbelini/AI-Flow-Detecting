from datetime import datetime
from zoneinfo import ZoneInfo


class TimeCorfficientService:

    """Суточный профиль пассажиропотока. Коэффициент мультипликативный.
    Инициализация с адаптивным определением timezone"""
    def __init__(
        self,
        timezone: str | None = None,
        lat: float | None = None,
        lng: float | None = None,
        city_name: str | None = None,
    ):
        # Импортируем тут, чтобы измежать циклических зависимостей
        from algorithm.timezone_resolver import resolve_timezone

        if timezone:
            tz_name = timezone
        else:
            tz_name = resolve_timezone(lat=lat, lng=lng, city_name=city_name)
        
        self.tz_name = tz_name
        self.tz = ZoneInfo(tz_name)
        
        # Коэффициенты по часу
        self.hour_coeff = {
            # ночь
            0: 0.05, 1: 0.04, 2: 0.025, 3: 0.02, 4: 0.03, 5: 0.35,
            # утро
            6: 0.7, 7: 1.2, 8: 1.5, 9: 1.3,
            # день
            10: 1.0, 11: 1.0, 12: 1.1, 13: 1.0, 14: 1.0, 15: 1.1,
            # вечер
            16: 1.3, 17: 1.6, 18: 1.7, 19: 1.4,
            # поздний вечер
            20: 1.05, 21: 0.75, 22: 0.45, 23: 0.22
        }

        # Коэффициенты по дню недели
        self.day_coeff = {
            0: 1.1,  # Monday
            1: 1.0,
            2: 1.1,
            3: 1.0,
            4: 1.1,  # Friday
            5: 0.8,  # Saturday
            6: 0.7   # Sunday
        }

        # Сезонные коэффициенты
        self.season_coeff = {
            12: 0.9, 1: 0.9, 2: 0.95,   # winter
            3: 1.0, 4: 1.05, 5: 1.1,    # spring
            6: 1.2, 7: 1.25, 8: 1.2,    # summer
            9: 1.1, 10: 1.05, 11: 1.0   # autumn
        }

        # В выходные дни пики утром/вечером сглаживаются
        self.weekend_hour_override: dict[int, float] = {
            0:  0.25, 
            1:  0.20, 
            2:  0.15, 
            3:  0.12, 
            4:  0.12,
            5:  0.15,
            6:  0.25,
            7:  0.35,   # нет утреннего пика на работу
            8:  0.35,
            9:  0.50,   # люди просыпаются позже
            10: 0.80,
            17: 1.00,   # нет вечернего "с работы"
            18: 1.15,   # но есть развлечения/торговые центры
            19: 1.10,
            20: 1.10, 
            21: 1.15, 
            22: 0.45, 
            23: 0.32
        }


    def parse_dt(self, dt_str: str | None) -> datetime:
        """
        Парсит строку в datetime с учётом точки/дефиса.
        Если не удалось — возвращает текущий момент с tz.
        """
        if not dt_str:
            return datetime.now(self.tz)

        try:
            # меняем точки на дефисы
            dt_str = dt_str.replace('.', '-')
            dt = datetime.fromisoformat(dt_str)

            if dt.tzinfo is None:
                # привязываем к нужному часовому поясу
                return dt.replace(tzinfo=self.tz)
            
            # Конвертируем в нужный timezone, если пришёл другой
            return dt.astimezone(self.tz)
        except Exception:
            return datetime.now(self.tz)


    def get_hour_coeff(self, hour: int, weekday: int) -> float:
        """Коэффициент часа с поправкой на выходной день"""
        is_weekend = weekday >= 5  # для выходных
        if is_weekend and hour in self.weekend_hour_override:
            return self.weekend_hour_override[hour]
        return self.hour_coeff.get(hour, 1.0)


    def get_T(self, dt_str: str | None = None) -> float:
        """Итоговый мультипликативный коэффициент времени
        Tt = hour_coeff * day_coeff * season_coeff"""
        dt = self.parse_dt(dt_str)

        khour = self.get_hour_coeff(dt.hour, dt.weekday())
        kday = self.day_coeff.get(dt.weekday(), 1.0)
        kseason = self.season_coeff.get(dt.month, 1.0)

        Tt = khour * kday * kseason
        return Tt
    
    def is_peak_hour(self, dt_str: str | None = None) -> bool:
        """True если сейчас час пик (утро или вечер)"""
        dt = self.parse_dt(dt_str)
        is_weekend = dt.weekday() >= 5
        if is_weekend:
            return False
        return dt.hour in {7, 8, 9, 17, 18, 19}
    
    def is_night(self, dt_str: str | None = None) -> bool:
        """True, если глубокая ночь (12-05)"""
        dt = self.parse_dt(dt_str)
        return dt.hour in {0, 1, 2, 3, 4}
    
    def get_profile_label(self, dt_str: str | None = None) -> str:
        """Человекочитаемая метка периода для логов/отладки."""
        dt = self.parse_dt(dt_str)
        h = dt.hour
        is_weekend = dt.weekday() >= 5
        if h in {1, 2, 3, 4}:
            return "deep_night"
        if h in {0, 23}:
            return "late_night"
        if h in {5, 6}:
            return "early_morning"
        if h in {7, 8, 9} and not is_weekend:
            return "morning_peak"
        if h in {10, 11, 13, 14}:
            return "daytime"
        if h == 12:
            return "lunch"
        if h in {15, 16}:
            return "pre_evening_peak"
        if h in {17, 18, 19} and not is_weekend:
            return "evening_peak"
        if h in {20, 21}:
            return "evening"
        if h == 22:
            return "late_evening"
        return "off_peak"