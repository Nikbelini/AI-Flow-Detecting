package ru.slivkiai.flowdetect.service;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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
import java.time.LocalDateTime;
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

        // Создаём две идентичные записи в истории (с текущим временем и минуту назад)
        createHistoryRecord(savedStop, request.getCount(), request.getVelocity(), request.getLoad());
        createHistoryRecord(savedStop, request.getCount(), request.getVelocity(), request.getLoad());

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
        List<StopHistoryEntity> lastRecords = stopHistoryRepository.findTop2ByAddressOrderByDatetimeDesc(stop.getAddress());

        if (lastRecords.size() < 2) {
            // Если записей недостаточно, создаём новые с текущими данными
            createHistoryRecord(stop, request.getCount(), 0, 0);
            createHistoryRecord(stop, request.getCount(), 0, 0);
            lastRecords = stopHistoryRepository.findTop2ByAddressOrderByDatetimeDesc(stop.getAddress());
        }

        StopHistoryEntity lastRecord = lastRecords.get(0);
        StopHistoryEntity previousRecord = lastRecords.get(1);

        // Расчёт новых показателей
        int newCount = request.getCount();
        int oldCount = previousRecord.getCount();
        long timeDiff = ChronoUnit.SECONDS.between(previousRecord.getDatetime(), lastRecord.getDatetime());

        double velocity = timeDiff > 0 ?
                ((newCount - oldCount) / (double) timeDiff) * 60 : 0;

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

        // Добавляем новую запись в историю
        createHistoryRecord(updatedStop, newCount, velocity, loadScore);

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
