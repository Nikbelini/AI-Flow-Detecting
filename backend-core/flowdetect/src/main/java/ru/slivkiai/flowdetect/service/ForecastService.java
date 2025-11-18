package ru.slivkiai.flowdetect.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ru.slivkiai.flowdetect.client.MlForecastClient;
import ru.slivkiai.flowdetect.domain.entity.StopHistoryEntity;
import ru.slivkiai.flowdetect.domain.entity.WeatherDataEntity;
import ru.slivkiai.flowdetect.domain.external.ForecastData;
import ru.slivkiai.flowdetect.domain.external.ForecastResponse;
import ru.slivkiai.flowdetect.domain.external.MlForecastRequest;
import ru.slivkiai.flowdetect.domain.external.MlForecastResponse;
import ru.slivkiai.flowdetect.repository.StopHistoryRepository;
import ru.slivkiai.flowdetect.repository.WeatherDataRepository;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ForecastService {

    private final MlForecastClient mlForecastClient;
    private final StopHistoryRepository stopHistoryRepository;
    private final WeatherDataRepository weatherDataRepository;

    // Новый метод с адресом вместо stopId
    public ForecastResponse getForecast(String address, Integer forecastHours) {
        try {
            log.info("🚀 Starting forecast for address: {}, hours: {}", address, forecastHours);

            // 1. Получаем исторические данные остановки по адресу
            List<StopHistoryEntity> historyData = stopHistoryRepository.findLast24HoursByAddress(address);

            if (historyData.isEmpty()) {
                throw new IllegalArgumentException(
                        String.format("Исторические данные для остановки '%s' не найдены", address)
                );
            }

            if (historyData.size() < 24) {
                throw new IllegalArgumentException(
                        String.format("Недостаточно исторических данных для прогноза. Найдено: %d/24", historyData.size())
                );
            }

            // 2. Получаем погодные данные для каждого временного периода
            Map<LocalDateTime, WeatherDataEntity> weatherDataMap = getWeatherDataForHistory(historyData);

            // 3. Подготавливаем данные для ML сервиса
            MlForecastRequest forecastRequest = prepareForecastRequest(historyData, weatherDataMap, forecastHours);

            // 4. Отправляем запрос в ML сервис через Feign
            log.info("📡 Sending request to ML service for {} history records", historyData.size());
            MlForecastResponse mlResponse = mlForecastClient.getForecast(forecastRequest);

            // 5. Обрабатываем ответ
            return processForecastResponse(mlResponse, address);

        } catch (Exception e) {
            log.error("❌ Error getting forecast for address {}: {}", address, e.getMessage());
            throw new RuntimeException("Ошибка сервиса прогнозирования: " + e.getMessage(), e);
        }
    }

    private Map<LocalDateTime, WeatherDataEntity> getWeatherDataForHistory(List<StopHistoryEntity> historyData) {
        return historyData.stream()
                .map(record -> {
                    LocalDateTime recordTime = record.getDatetime();
                    Optional<WeatherDataEntity> weatherOpt = weatherDataRepository.findByDateTime(recordTime);

                    if (weatherOpt.isPresent()) {
                        return Map.entry(recordTime, weatherOpt.get());
                    } else {
                        log.warn("⚠️ Weather data not found for timestamp: {}", recordTime);
                        WeatherDataEntity defaultWeather = createDefaultWeather(recordTime, record.getCity().getId());
                        return Map.entry(recordTime, defaultWeather);
                    }
                })
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        Map.Entry::getValue,
                        (existing, replacement) -> existing
                ));
    }

    private WeatherDataEntity createDefaultWeather(LocalDateTime datetime, Long cityId) {
        Optional<WeatherDataEntity> latestWeather = weatherDataRepository.findLatestByCityId(cityId);

        if (latestWeather.isPresent()) {
            WeatherDataEntity lastWeather = latestWeather.get();
            return WeatherDataEntity.builder()
                    .datetime(datetime)
                    .city(lastWeather.getCity())
                    .temperature(lastWeather.getTemperature())
                    .precipitation(lastWeather.getPrecipitation())
                    .weatherCode(lastWeather.getWeatherCode())
                    .build();
        } else {
            return WeatherDataEntity.builder()
                    .datetime(datetime)
                    .temperature(java.math.BigDecimal.valueOf(15.0))
                    .precipitation(java.math.BigDecimal.valueOf(0.0))
                    .weatherCode(1)
                    .build();
        }
    }

    private MlForecastRequest prepareForecastRequest(List<StopHistoryEntity> historyData,
                                                     Map<LocalDateTime, WeatherDataEntity> weatherDataMap,
                                                     Integer forecastHours) {

        List<Map<String, Object>> historicalData = historyData.stream()
                .sorted(Comparator.comparing(StopHistoryEntity::getDatetime))
                .map(record -> createDataPoint(record, weatherDataMap.get(record.getDatetime())))
                .collect(Collectors.toList());

        return MlForecastRequest.builder()
                .historicalData(historicalData)
                .forecastHorizon(forecastHours != null ? forecastHours : 6)
                .includePlots(true)
                .build();
    }

    private Map<String, Object> createDataPoint(StopHistoryEntity record, WeatherDataEntity weather) {
        Map<String, Object> dataPoint = new HashMap<>();

        // Основные данные остановки
        dataPoint.put("timestamp", record.getDatetime().toString());
        dataPoint.put("passenger_count", record.getCount());
        dataPoint.put("load", record.getLoad());
        dataPoint.put("velocity", record.getVelocity());

        // Погодные данные
        if (weather != null) {
            dataPoint.put("temperature", weather.getTemperature().doubleValue());
            dataPoint.put("precipitation", weather.getPrecipitation().doubleValue());
            dataPoint.put("weather_code", weather.getWeatherCode());
        } else {
            dataPoint.put("temperature", 15.0);
            dataPoint.put("precipitation", 0.0);
            dataPoint.put("weather_code", 1);
        }

        // Данные о событиях и времени
        dataPoint.put("day_type", isHoliday(record.getDatetime()) ? "holiday" : "weekday");
        dataPoint.put("event_type", "NO_EVENTS");

        return dataPoint;
    }

    // Обновленный метод для работы с адресом
    private ForecastResponse processForecastResponse(MlForecastResponse mlResponse, String address) {
        ForecastResponse forecastResponse = ForecastResponse.builder()
                .address(address) // Используем адрес вместо stopId
                .generatedAt(LocalDateTime.now())
                .build();

        // Парсим прогнозы
        List<ForecastData> forecastData = mlResponse.getPredictions().stream()
                .map(this::mapToForecastData)
                .collect(Collectors.toList());

        forecastResponse.setForecasts(forecastData);
        forecastResponse.setMetrics(mlResponse.getMetrics());
        forecastResponse.setPlotHtml(mlResponse.getPlotHtml());

        log.info("✅ Forecast generated successfully for address: {}. Predictions: {}", address, forecastData.size());
        return forecastResponse;
    }

    private ForecastData mapToForecastData(Map<String, Object> prediction) {
        return ForecastData.builder()
                .timestamp(LocalDateTime.parse((String) prediction.get("timestamp")))
                .predictedPassengerCount(((Number) prediction.get("predicted_passenger_count")).intValue())
                .predictedLoad(((Number) prediction.get("predicted_load")).intValue())
                .forecastHour(((Number) prediction.get("forecast_hour")).intValue())
                .build();
    }

    private boolean isHoliday(LocalDateTime dateTime) {
        return dateTime.getDayOfWeek().getValue() >= 6;
    }

    public String checkHealth() {
        try {
            return mlForecastClient.healthCheck();
        } catch (Exception e) {
            log.error("Health check failed: {}", e.getMessage());
            return "ML service unavailable";
        }
    }
}