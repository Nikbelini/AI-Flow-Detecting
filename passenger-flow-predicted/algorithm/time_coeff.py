from datetime import datetime
from zoneinfo import ZoneInfo

class TimeCorfficientService:

    def __init__(self):
        self.tz = ZoneInfo("Europe/Samara")
        
        self.hour_coeff = {
            # ночь
            0: 0.3, 1: 0.3, 2: 0.3, 3: 0.3, 4: 0.4, 5: 0.5,
            # утро
            6: 0.8, 7: 1.2, 8: 1.5, 9: 1.3,
            # день
            10: 1.0, 11: 1.0, 12: 1.1, 13: 1.0, 14: 1.0, 15: 1.1,
            # вечер
            16: 1.3, 17: 1.6, 18: 1.7, 19: 1.4,
            # поздний вечер
            20: 1.1, 21: 0.9, 22: 0.7, 23: 0.5
        }

        self.day_coeff = {
            0: 1.0,  # Monday
            1: 1.0,
            2: 1.0,
            3: 1.0,
            4: 1.1,  # Friday
            5: 0.8,  # Saturday
            6: 0.7   # Sunday
        }

        self.season_coeff = {
            12: 0.9, 1: 0.9, 2: 0.95,   # winter
            3: 1.0, 4: 1.05, 5: 1.1,    # spring
            6: 1.2, 7: 1.25, 8: 1.2,    # summer
            9: 1.1, 10: 1.05, 11: 1.0   # autumn
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
            # привязываем к нужному часовому поясу
            return dt.replace(tzinfo=self.tz)
        except Exception:
            return datetime.now(self.tz)

    def get_T(self, dt_str: str | None = None) -> float:
        dt = self.parse_dt(dt_str)

        khour = self.hour_coeff.get(dt.hour, 1.0)
        kday = self.day_coeff.get(dt.weekday(), 1.0)
        kseason = self.season_coeff.get(dt.month, 1.0)