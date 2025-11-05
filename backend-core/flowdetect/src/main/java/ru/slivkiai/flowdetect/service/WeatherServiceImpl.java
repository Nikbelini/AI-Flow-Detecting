package ru.slivkiai.flowdetect.service;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import ru.slivkiai.flowdetect.domain.entity.CityEntity;
import ru.slivkiai.flowdetect.domain.entity.WeatherDataEntity;
import ru.slivkiai.flowdetect.repository.WeatherDataRepository;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class WeatherServiceImpl implements WeatherService {

    private final WeatherDataRepository weatherDataRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    private static final String OPEN_METEO_URL =
            "https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=temperature_2m,precipitation,weather_code";

    @Override
    public void fetchAndSaveCurrentWeather(CityEntity city) {
        try {
            log.debug("Fetching weather data for city: {}", city.getName());

            String url = OPEN_METEO_URL
                    .replace("{lat}", city.getLat().toString())
                    .replace("{lng}", city.getLng().toString());

            OpenMeteoResponse response = restTemplate.getForObject(url, OpenMeteoResponse.class);

            if (response != null && response.getCurrent() != null) {
                saveWeatherData(city, response.getCurrent());
                log.info("Successfully saved weather data for city: {}", city.getName());
            }

        } catch (Exception e) {
            log.error("Error fetching weather data for city: {}", city.getName(), e);
        }
    }

    private void saveWeatherData(CityEntity city, CurrentWeather current) {
        WeatherDataEntity weather = WeatherDataEntity.builder()
                .city(city)
                .datetime(LocalDateTime.now())
                .temperature(BigDecimal.valueOf(current.getTemperature_2m()))
                .precipitation(BigDecimal.valueOf(current.getPrecipitation()))
                .weatherCode(current.getWeather_code())
                .build();

        weatherDataRepository.save(weather);
    }

    // DTO классы для Open-Meteo API
    @Data
    private static class OpenMeteoResponse {
        private CurrentWeather current;
    }

    @Data
    private static class CurrentWeather {
        private double temperature_2m;
        private double precipitation;
        private int weather_code;
        private String time;
    }
}
