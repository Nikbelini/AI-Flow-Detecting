package ru.slivkiai.flowdetect.service;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.slivkiai.flowdetect.domain.StopHistoryRequest;
import ru.slivkiai.flowdetect.domain.StopHistoryResponse;
import ru.slivkiai.flowdetect.domain.entity.StopHistoryEntity;
import ru.slivkiai.flowdetect.repository.CityRepository;
import ru.slivkiai.flowdetect.repository.StopHistoryRepository;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class StopHistoryServiceImpl implements StopHistoryService {

    private final StopHistoryRepository stopHistoryRepository;
    private final CityRepository cityRepository;
    private final WeatherService weatherService;

    @Override
    @Transactional
    public StopHistoryResponse createHistoryRecord(StopHistoryRequest request) {
        log.info("📝 Creating history record with request: {}", request);

        // Получаем город
        var city = cityRepository.findById(request.getCityId())
                .orElseThrow(EntityNotFoundException::new);

        log.info("🏙️ Found city: {} (ID: {})", city.getName(), city.getId());

        // Сохраняем историческую запись
        StopHistoryEntity history = StopHistoryEntity.builder()
                .datetime(LocalDateTime.now())
                .count(request.getCount())
                .velocity(request.getVelocity())
                .load(request.getLoad())
                .address(request.getAddress())
                .city(city)
                .build();

        StopHistoryEntity savedHistory = stopHistoryRepository.save(history);
        log.info("💾 Successfully saved history record. ID: {}", savedHistory.getId());

        // Асинхронно получаем и сохраняем погодные данные
        try {
            log.info("🌤️ Starting weather data fetch for city: {}", city.getName());
            weatherService.fetchAndSaveCurrentWeather(city);
            log.info("✅ Weather data fetch initiated");
        } catch (Exception e) {
            log.error("❌ Failed to fetch weather data, but history record was saved", e);
        }

        // Формируем ответ
        return StopHistoryResponse.builder()
                .id(savedHistory.getId())
                .datetime(savedHistory.getDatetime())
                .load(savedHistory.getLoad())
                .velocity(savedHistory.getVelocity())
                .count(savedHistory.getCount())
                .cityId(savedHistory.getCity().getId())
                .build();
    }
}
