from enum import Enum

class TimeOfDay(Enum):
    DAY = "day"
    NIGHT = "night"

class WeatherType(Enum):
    CLEAR = "clear"
    RAIN = "rain"
    SNOW = "snow"
    FOG = "fog"
    EXTREME = "extreme"


def map_weather_code(weather_code: int, precipitation: float) -> WeatherType:
    if weather_code in {95, 96, 99}:
        return WeatherType.EXTREME
    if weather_code in {45, 48}:
        return WeatherType.FOG
    if weather_code in {71, 73, 75, 77, 85, 86}:
        return WeatherType.SNOW
    if precipitation > 0.2:
        return WeatherType.RAIN
    return WeatherType.CLEAR
