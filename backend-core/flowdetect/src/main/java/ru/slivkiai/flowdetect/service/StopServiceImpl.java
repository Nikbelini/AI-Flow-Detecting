package ru.slivkiai.flowdetect.service;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ru.slivkiai.flowdetect.domain.StopHistoryRequest;
import ru.slivkiai.flowdetect.domain.StopRequest;
import ru.slivkiai.flowdetect.domain.StopResponse;
import ru.slivkiai.flowdetect.domain.StopResponseUrl;
import ru.slivkiai.flowdetect.domain.StopStatsUpdateRequest;
import ru.slivkiai.flowdetect.domain.entity.CityEntity;
import ru.slivkiai.flowdetect.domain.entity.StopEntity;
import ru.slivkiai.flowdetect.domain.entity.StopHistoryEntity;
import ru.slivkiai.flowdetect.repository.CityRepository;
import ru.slivkiai.flowdetect.repository.StopHistoryRepository;
import ru.slivkiai.flowdetect.repository.StopRepository;

import java.math.BigDecimal;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class StopServiceImpl implements StopService {
    private final StopRepository stopRepository;
    private final CityRepository cityRepository;
    private final StopHistoryRepository stopHistoryRepository;

    @Override
    public List<StopResponse> getAllStops() {
        return stopRepository.findAll().stream()
                .map(stop -> new StopResponse(
                        stop.getUrl(),
                        stop.getAddress(),
                        stop.getCount(),
                        stop.getVelocity(),
                        stop.getLoad(),
                        stop.getLat().doubleValue(),
                        stop.getLng().doubleValue()
                ))
                .collect(Collectors.toList());
    }

    public List<StopResponseUrl> getAllStopsUrl() {
        return stopRepository.findAll().stream()
                .map(stop -> new StopResponseUrl(
                        stop.getId(),
                        stop.getUrl()
                ))
                .collect(Collectors.toList());
    }

    @Override
    public StopResponse createStop(StopRequest request) {
        CityEntity city = cityRepository.findById(request.getCityId())
                .orElseThrow(() -> new EntityNotFoundException("City not found"));

        //TODO Map
        StopEntity stop = new StopEntity();
        stop.setUrl(request.getUrl());
        stop.setAddress(request.getAddress());
        stop.setCount(request.getCount());
        stop.setVelocity(request.getVelocity());
        stop.setLoad(request.getLoad());
        stop.setLat(BigDecimal.valueOf(request.getLat()));
        stop.setLng(BigDecimal.valueOf(request.getLng()));
        stop.setCity(city);

        StopEntity savedStop = stopRepository.save(stop);

        //TODO Map
        StopResponse stopResponse = new StopResponse();
        stopResponse.setUrl(savedStop.getUrl());
        stopResponse.setAddress(savedStop.getAddress());
        stopResponse.setCount(savedStop.getCount());
        stopResponse.setVelocity(savedStop.getVelocity());
        stopResponse.setLoad(savedStop.getLoad());
        stopResponse.setLat(savedStop.getLat().doubleValue());
        stopResponse.setLng(savedStop.getLng().doubleValue());

        return stopResponse;
    }

    @Override
    public void deleteStop(Long id) {
        stopRepository.deleteById(id);
    }

    @Override
    public StopResponse updateStopStats(Long id, StopStatsUpdateRequest request) {
        StopEntity stop = stopRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Stop not found"));

        // Добавьте логирование для проверки
        log.info("Ищем историю для адреса: '{}'", stop.getAddress());
        List<StopHistoryEntity> records = stopHistoryRepository.findTop2ByAddressOrderByDatetimeDesc(stop.getAddress());
        log.info("Найдено записей: {}", records.size());

        List<StopHistoryEntity> lastRecords = stopHistoryRepository.findTop2ByAddressOrderByDatetimeDesc(stop.getAddress());

        if (lastRecords.size() < 2) {
            throw new IllegalStateException("Недостаточно данных для расчёта (нужно минимум 2 записи)");
        }

        StopHistoryEntity currentRecord = lastRecords.get(0);
        StopHistoryEntity previousRecord = lastRecords.get(1);

        // Расчёт показателей
        int currentPeople = currentRecord.getCount();
        int previousPeople = previousRecord.getCount();
        long timeDeltaSec = ChronoUnit.SECONDS.between(
                previousRecord.getDatetime(),
                currentRecord.getDatetime()
        );

        // 1. Загруженность (load_score)
        int maxCapacity = 50; // Можно брать из настроек остановки
        double loadScore = Math.min((currentPeople / (double) maxCapacity) * 10, 10);

        // 2. Скорость изменения (velocity)
        double velocity = 0;
        if (timeDeltaSec > 0) {
            velocity = ((currentPeople - previousPeople) / (double) timeDeltaSec) * 60;
        }

        // Игнорируем шум (колебания менее 5 человек)
        if (Math.abs(currentPeople - previousPeople) < 5) {
            velocity = 0;
        }

        // Обновляем остановку
        stop.setCount(currentPeople);
        stop.setVelocity((int) velocity);
        stop.setLoad((int) loadScore);

        StopEntity updatedStop = stopRepository.save(stop);

        // TODO map
        return StopResponse.builder()
                .url(updatedStop.getUrl())
                .address(updatedStop.getAddress())
                .count(updatedStop.getCount())
                .velocity(updatedStop.getVelocity())
                .load(updatedStop.getLoad())
                .lat(updatedStop.getLat().doubleValue())
                .lng(updatedStop.getLng().doubleValue())
                .build();
    }

    @Override
    public List<StopResponse> getAllStopsByCityId(Long cityId) {
        return stopRepository.getByCityId(cityId).stream()
                .map(stop -> new StopResponse(
                        stop.getUrl(),
                        stop.getAddress(),
                        stop.getCount(),
                        stop.getVelocity(),
                        stop.getLoad(),
                        stop.getLat().doubleValue(),
                        stop.getLng().doubleValue()
                ))
                .collect(Collectors.toList());
    }
}
