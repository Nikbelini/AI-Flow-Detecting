package ru.slivkiai.flowdetect.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
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

    private static final String OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

    @Override
    public void fetchAndSaveCurrentWeather(CityEntity city) {
        try {
            log.info("🌤️ Fetching weather data for city: {} (lat: {}, lng: {})",
                    city.getName(), city.getLat(), city.getLng());

            // Строим URL с параметрами
            String url = UriComponentsBuilder.fromHttpUrl(OPEN_METEO_URL)
                    .queryParam("latitude", city.getLat())
                    .queryParam("longitude", city.getLng())
                    .queryParam("current", "temperature_2m,precipitation,weather_code")
                    .queryParam("timezone", "auto")
                    .toUriString();

            log.debug("🌐 Weather API URL: {}", url);

            // Делаем запрос
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.error("❌ Bad response from weather API. Status: {}", response.getStatusCode());
                return;
            }

            String responseBody = response.getBody();
            log.debug("📨 Raw weather response: {}", responseBody);

            // Парсим JSON
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode root = mapper.readTree(responseBody);
            com.fasterxml.jackson.databind.JsonNode current = root.path("current");

            if (current.isMissingNode()) {
                log.warn("⚠️ No 'current' data in weather response");
                return;
            }

            // Извлекаем значения
            double temperature = current.path("temperature_2m").asDouble();
            double precipitation = current.path("precipitation").asDouble();
            int weatherCode = current.path("weather_code").asInt();
            String time = current.path("time").asText();

            log.info("📊 Parsed weather data - Temp: {}°C, Precip: {}mm, Code: {}, Time: {}",
                    temperature, precipitation, weatherCode, time);

            // Сохраняем в базу
            saveWeatherData(city, temperature, precipitation, weatherCode);

        } catch (Exception e) {
            log.error("❌ Error fetching weather data for city: {}", city.getName(), e);
        }
    }

    private void saveWeatherData(CityEntity city, double temperature, double precipitation, int weatherCode) {
        try {
            WeatherDataEntity weather = WeatherDataEntity.builder()
                    .city(city)
                    .datetime(LocalDateTime.now())
                    .temperature(BigDecimal.valueOf(temperature))
                    .precipitation(BigDecimal.valueOf(precipitation))
                    .weatherCode(weatherCode)
                    .build();

            WeatherDataEntity saved = weatherDataRepository.save(weather);

            log.info("💾 Successfully saved weather data. ID: {}, Temp: {}°C, Precip: {}mm, Code: {}",
                    saved.getId(), temperature, precipitation, weatherCode);

        } catch (Exception e) {
            log.error("❌ Error saving weather data to database", e);
        }
    }
}
