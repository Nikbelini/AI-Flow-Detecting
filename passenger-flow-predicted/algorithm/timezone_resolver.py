import logging
from functools import lru_cache
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

logger = logging.getLogger(__name__)

# bbox городов - timezone
_BBOX_TZ_TABLE = [
    # Россия - основные зоны
    (51.0, 55.0, 82.0, 87.0, "Asia/Novosibirsk"),       # Новосибирск
    (55.5, 56.1, 37.0, 38.0, "Europe/Moscow"),           # Москва
    (59.8, 60.2, 30.0, 30.8, "Europe/Moscow"),           # Санкт-Петербург
    (56.5, 57.5, 60.0, 61.5, "Asia/Yekaterinburg"),     # Ульяновск — НЕТ, это Екб зона
    # Ульяновск реально в Europe/Ulyanovsk (UTC+4)
    (54.0, 54.5, 48.2, 48.6, "Europe/Ulyanovsk"),       # Ульяновск точнее
    (53.0, 55.0, 48.0, 51.0, "Europe/Samara"),          # Самара

    (54.0, 57.0, 59.0, 62.0, "Asia/Yekaterinburg"),   # Екатеринбург, Челябинск, Копейск
    (54.5, 57.0, 52.0, 57.0, "Asia/Yekaterinburg"),     # Пермь
    (51.5, 52.0, 55.8, 56.5, "Asia/Yekaterinburg"),     # Оренбург
    (56.8, 57.2, 60.4, 61.2, "Asia/Yekaterinburg"),     # Екатеринбург точнее
    (55.0, 55.6, 61.2, 61.7, "Asia/Yekaterinburg"),     # Челябинск точнее
    (55.0, 55.3, 61.3, 61.6, "Asia/Yekaterinburg"),     # Копейск точнее
]

# Явный маппинг город
_CITY_NAME_TZ: dict[str, str] = {
    "екатеринбург":  "Asia/Yekaterinburg",
    "yekaterinburg": "Asia/Yekaterinburg",
    "челябинск":     "Asia/Yekaterinburg",
    "chelyabinsk":   "Asia/Yekaterinburg",
    "копейск":       "Asia/Yekaterinburg",
    "kopeysk":       "Asia/Yekaterinburg",
    "самара":        "Europe/Samara",
    "samara":        "Europe/Samara",
    "ульяновск":     "Europe/Ulyanovsk",
    "ulyanovsk":     "Europe/Ulyanovsk",
    "москва":        "Europe/Moscow",
    "moscow":        "Europe/Moscow",
    "санкт-петербург": "Europe/Moscow",
    "новосибирск":   "Asia/Novosibirsk",
    "novosibirsk":   "Asia/Novosibirsk",
    "казань":        "Europe/Moscow",
    "kazan":         "Europe/Moscow",
    "пермь":         "Asia/Yekaterinburg",
    "perm":          "Asia/Yekaterinburg",
    "омск":          "Asia/Omsk",
    "omsk":          "Asia/Omsk",
    "красноярск":    "Asia/Krasnoyarsk",
    "krasnoyarsk":   "Asia/Krasnoyarsk",
    "иркутск":       "Asia/Irkutsk",
    "irkutsk":       "Asia/Irkutsk",
    "владивосток":   "Asia/Vladivostok",
    "vladivostok":   "Asia/Vladivostok",
}

DEFAULT_TZ = "Europe/Moscow"


@lru_cache(maxsize=256)
def resolve_timezone_by_coords(lat: float, lng: float) -> str:
    """
    Определяет timezone по координатам (приоритет по timezonefinder по полигонам, bbox-таблицы)
    """
    try:
        from timezonefinder import TimezoneFinder
        tf = _get_tf_instance()
        tz_name = tf.timezone_at(lat=lat, lng=lng)

        if tz_name:
            _validate_tz(tz_name)
            logger.debug(f"TimezoneFinder: ({lat}, ({lng}) - {tz_name})")
            return tz_name
    except ImportError:
        logger.debug("timezonefinder not installed, using bbox fallback")
    except Exception as exception:
        logger.warning(f"TimezoneFinder error: {exception}")

    
    for lat_min, lat_max, lng_min, lng_max, tz_name in _BBOX_TZ_TABLE:
        if lat_min <= lat <= lat_max and lng_min <= lng <= lng_max:
            logger.debug(f"Bbox match: ({lat}, {lng}) - {tz_name}")
            return tz_name
        
    logger.warning(f"No timezone found for ({lat}, {lng}), using {DEFAULT_TZ}")
    return DEFAULT_TZ


@lru_cache(maxsize=256)
def resolve_timezone_by_city_name(city_name: str) -> str | None:
    """
    Опеределяет timezone по названию города (нечувствительно к регистру).
    Возвращает None, если не найдено
    """
    key = city_name.strip().lower()
    return _CITY_NAME_TZ.get(key)


def resolve_timezone(
    lat: float | None = None,
    lng: float | None = None,
    city_name: str | None = None,
) -> str:
    """
    Главная точка входа. Определяет timezone с каскадом (по имени города, по координатам)
    """
    if city_name:
        tz = resolve_timezone_by_city_name(city_name)
        if tz:
            return tz
        
    if lat is not None and lng is not None:
        return resolve_timezone_by_coords(lat, lng)
    
    return DEFAULT_TZ


def get_zoneinfo(
    lat: float | None = None,
    lng: float | None = None,
    city_name: str | None = None,
) -> ZoneInfo:
    """Удобная обёртка для ZoneInfo"""
    tz_name = resolve_timezone(lat=lat, lng=lng, city_name=city_name)
    return ZoneInfo(tz_name)


# Внутренние утилиты
@lru_cache(maxsize=1)
def _get_tf_instance():
    """Singleton TimezoneFinder"""
    from timezonefinder import TimezoneFinder
    return TimezoneFinder()

def _validate_tz(tz_name: str) -> None:
    """Бросает исключение, если timezone невалидна"""
    try:
        ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        raise ValueError(f"Invalid timezone: {tz_name}")