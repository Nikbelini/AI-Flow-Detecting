package ru.slivkiai.flowdetect.service;

import java.util.Optional;

import ru.slivkiai.flowdetect.domain.WeatherResponseDto;
import ru.slivkiai.flowdetect.domain.entity.CityEntity;

public interface WeatherService {
    void fetchAndSaveCurrentWeather(CityEntity city);

    Optional<WeatherResponseDto> getLatestWeatherByStop(Long stopId);
}
