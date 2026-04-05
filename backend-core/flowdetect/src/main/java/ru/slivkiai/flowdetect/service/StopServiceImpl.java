package ru.slivkiai.flowdetect.service;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ru.slivkiai.flowdetect.client.FlowPredictionClient;
import ru.slivkiai.flowdetect.domain.StopHistoryRequest;
import ru.slivkiai.flowdetect.domain.StopRequest;
import ru.slivkiai.flowdetect.domain.StopResponse;
import ru.slivkiai.flowdetect.domain.StopResponseUrl;
import ru.slivkiai.flowdetect.domain.StopStatsUpdateRequest;
import ru.slivkiai.flowdetect.domain.entity.CityEntity;
import ru.slivkiai.flowdetect.domain.entity.StopEntity;
import ru.slivkiai.flowdetect.domain.entity.StopHistoryEntity;
import ru.slivkiai.flowdetect.dto.PredictionRequestDto;
import ru.slivkiai.flowdetect.dto.PredictionResponseDto;
import ru.slivkiai.flowdetect.repository.CityRepository;
import ru.slivkiai.flowdetect.repository.StopHistoryRepository;
import ru.slivkiai.flowdetect.repository.StopRepository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class StopServiceImpl implements StopService {
        private final StopRepository stopRepository;
        private final CityRepository cityRepository;
        private final StopHistoryRepository stopHistoryRepository;
        private final StopHistoryService stopHistoryService;

        private final FlowPredictionClient flowPredictionClient;

        @Override
    public List<StopResponse> getAllStops() {
        // 1. Получаем ВСЕ остановки из БД
        List<StopEntity> allStops = stopRepository.findAll();

        // 2. 🔥 Фильтруем слепые зоны: url == null ИЛИ пустая строка
        List<StopEntity> blindStops = allStops.stream()
                .filter(stop -> stop.getUrl() == null || stop.getUrl().isBlank())
                .collect(Collectors.toList());
        
        // 3. Запрашиваем прогнозы
        Map<String, PredictionResponseDto> predictionsMap = fetchPredictionsForAddresses(blindStops);

        // 4. 🔥 Формируем ответ: реальные данные ИЛИ прогнозы
        return allStops.stream()
                .map(stop -> {
                    boolean hasCamera = stop.getUrl() != null && !stop.getUrl().isBlank();

                    // Значения по умолчанию (из БД)
                    Integer count = stop.getCount();
                    Integer velocity = stop.getVelocity();
                    Integer load = stop.getLoad();

                    // 🔥 Если нет камеры — подставляем прогноз
                    if (!hasCamera) {
                        // 🔥 КЛЮЧЕВОЙ ФИКС: .trim() для надёжного поиска
                        String lookupKey = stop.getAddress() != null ? stop.getAddress().trim() : null;
                        
                        log.debug("🔍 Lookup: stop='{}' (hasCamera={}), key='{}'", 
                                stop.getAddress(), hasCamera, lookupKey);
                        
                        PredictionResponseDto prediction = predictionsMap.get(lookupKey);
                        
                        if (prediction != null && prediction.getPredictedCount() != null) {
                            log.debug("✅ Found prediction for '{}': count={}", lookupKey, prediction.getPredictedCount());
                            count = prediction.getPredictedCount();
                            velocity = prediction.getPredictedVelocity();
                            load = prediction.getPredictedLoad();
                        } else {
                            log.debug("❌ Prediction NOT found for '{}'. Available keys: {}", 
                                    lookupKey, predictionsMap.keySet());
                            // 🔥 Не ставим null — оставляем значения из БД или 0
                            if (count == null) count = 0;
                            if (velocity == null) velocity = 0;
                            if (load == null) load = 0;
                        }
                    }

                    return new StopResponse(
                            stop.getId(),
                            stop.getUrl(),
                            stop.getAddress(),
                            count,
                            velocity,
                            load,
                            stop.getLat().doubleValue(),
                            stop.getLng().doubleValue(),
                            hasCamera
                    );
                })
                .collect(Collectors.toList());
    }

    // 🔥 ОТДЕЛЬНЫЙ МЕТОД (не внутри getAllStops!)
    private Map<String, PredictionResponseDto> fetchPredictionsForAddresses(List<StopEntity> blindStops) {
        if (blindStops.isEmpty()) {
            return Map.of();
        }
        
        // Группируем по city_id
        Map<Long, List<String>> cityToAddresses = blindStops.stream()
                .collect(Collectors.groupingBy(
                        stop -> stop.getCity().getId(),
                        Collectors.mapping(StopEntity::getAddress, Collectors.toList())));
        
        Map<String, PredictionResponseDto> allPredictions = new HashMap<>();
        
        for (Map.Entry<Long, List<String>> entry : cityToAddresses.entrySet()) {
            try {
                PredictionRequestDto request = PredictionRequestDto.builder()
                        .cityId(entry.getKey().intValue())
                        .horizon(1)
                        .build();
                
                List<PredictionResponseDto> predictions = flowPredictionClient.predict(request);
                
                log.debug("📥 Received {} predictions for city {}", predictions.size(), entry.getKey());
                
                predictions.stream()
                        .filter(p -> p.getAddress() != null)
                        .forEach(p -> {
                            String key = p.getAddress().trim();
                            log.debug("Mapped: '{}' -> count={}", key, p.getPredictedCount());
                            allPredictions.put(key, p);
                        });
                        
            } catch (Exception e) {
                log.warn("⚠️ Failed to fetch predictions for city {}: {}", entry.getKey(), e.getMessage());
            }
        }
        
        return allPredictions;
    }

        public List<StopResponseUrl> getAllStopsUrl() {
                return stopRepository.findAll().stream()
                                .map(stop -> new StopResponseUrl(
                                                stop.getId(),
                                                stop.getUrl()))
                                .collect(Collectors.toList());
        }

        @Override
        @Transactional
        public StopResponse createStop(StopRequest request) {
                CityEntity city = cityRepository.findById(request.getCityId())
                                .orElseThrow(() -> new EntityNotFoundException("City not found"));

                StopEntity stop = StopEntity.builder()
                                .url(request.getUrl())
                                .address(request.getAddress())
                                .count(request.getCount())
                                .velocity(request.getVelocity())
                                .load(request.getLoad())
                                .lat(BigDecimal.valueOf(request.getLat()))
                                .lng(BigDecimal.valueOf(request.getLng()))
                                .city(city)
                                .build();

                StopEntity savedStop = stopRepository.save(stop);

                // Используем сервис истории вместо приватного метода
                createHistoryRecordViaService(savedStop, request.getCount(), request.getVelocity(), request.getLoad());
                createHistoryRecordViaService(savedStop, request.getCount(), request.getVelocity(), request.getLoad());

                return mapToResponse(savedStop);
        }

        @Override
        public void deleteStop(Long id) {
                stopRepository.deleteById(id);
        }

        @Override
        @Transactional
        public StopResponse updateStopStats(Long id, StopStatsUpdateRequest request) {
                StopEntity stop = stopRepository.findById(id)
                                .orElseThrow(() -> new EntityNotFoundException("Stop not found"));

                // Получаем последние 2 записи в истории
                List<StopHistoryEntity> lastRecords = stopHistoryRepository
                                .findTop2ByAddressOrderByDatetimeDesc(stop.getAddress());

                if (lastRecords.size() < 2) {
                        // Если записей недостаточно, создаём новые с текущими данными
                        createHistoryRecordViaService(stop, request.getCount(), 0, 0);
                        createHistoryRecordViaService(stop, request.getCount(), 0, 0);
                        lastRecords = stopHistoryRepository.findTop2ByAddressOrderByDatetimeDesc(stop.getAddress());
                }

                StopHistoryEntity lastRecord = lastRecords.get(0);
                StopHistoryEntity previousRecord = lastRecords.get(1);

                // Расчёт новых показателей
                int newCount = request.getCount();
                int oldCount = previousRecord.getCount();
                long timeDiff = ChronoUnit.SECONDS.between(previousRecord.getDatetime(), lastRecord.getDatetime());

                double velocity = timeDiff > 0 ? ((newCount - oldCount) / (double) timeDiff) * 60 : 0;

                int maxCapacity = 50; // Можно вынести в конфиг или в сущность Stop
                double loadScore = Math.min((newCount / (double) maxCapacity) * 10, 10);

                // Игнорируем незначительные колебания
                if (Math.abs(newCount - oldCount) < 5) {
                        velocity = 0;
                }

                // Обновляем остановку
                stop.setCount(newCount);
                stop.setVelocity((int) velocity);
                stop.setLoad((int) loadScore);
                StopEntity updatedStop = stopRepository.save(stop);

                // Добавляем новую запись в историю ЧЕРЕЗ СЕРВИС (чтобы сохранилась погода)
                createHistoryRecordViaService(updatedStop, newCount, velocity, loadScore);

                log.info("🔄 Updated stop stats - ID: {}, Count: {}, Velocity: {}, Load: {}",
                                id, newCount, velocity, loadScore);

                return mapToResponse(updatedStop);
        }

        private StopResponse mapToResponse(StopEntity stop) {
                return StopResponse.builder()
                                .url(stop.getUrl())
                                .address(stop.getAddress())
                                .count(stop.getCount())
                                .velocity(stop.getVelocity())
                                .load(stop.getLoad())
                                .lat(stop.getLat().doubleValue())
                                .lng(stop.getLng().doubleValue())
                                .build();
        }

        /**
         * Используем сервис истории вместо прямого сохранения
         * Это гарантирует, что погодные данные также будут сохранены
         */
        private void createHistoryRecordViaService(StopEntity stop, double count, double velocity, double load) {
                StopHistoryRequest historyRequest = StopHistoryRequest.builder()
                                .cityId(stop.getCity().getId())
                                .address(stop.getAddress())
                                .count((int) count)
                                .velocity((int) velocity)
                                .load((int) load)
                                .build();

                stopHistoryService.createHistoryRecord(historyRequest);
        }

        // Старый метод оставляем для обратной совместимости, но не используем для
        // обновлений
        private void createHistoryRecord(StopEntity stop, int count, double velocity, double load) {
                StopHistoryEntity history = StopHistoryEntity.builder()
                                .city(stop.getCity())
                                .address(stop.getAddress())
                                .count(count)
                                .velocity((int) velocity)
                                .load((int) load)
                                .datetime(LocalDateTime.now())
                                .build();

                stopHistoryRepository.save(history);
        }

        @Override
        public List<StopResponse> getAllStopsByCityId(Long cityId) {
                return stopRepository.getByCityId(cityId).stream()
                                .map(stop -> new StopResponse(
                                                stop.getId(),
                                                stop.getUrl(),
                                                stop.getAddress(),
                                                stop.getCount(),
                                                stop.getVelocity(),
                                                stop.getLoad(),
                                                stop.getLat().doubleValue(),
                                                stop.getLng().doubleValue(),
                                                false))
                                .collect(Collectors.toList());
        }
}