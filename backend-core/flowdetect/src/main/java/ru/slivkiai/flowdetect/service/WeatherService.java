package ru.slivkiai.flowdetect.service;

import ru.slivkiai.flowdetect.domain.entity.CityEntity;

public interface WeatherService {
    void fetchAndSaveCurrentWeather(CityEntity city);
}
