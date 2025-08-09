package ru.slivkiai.flowdetect.service;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
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

    @Override
    public StopHistoryResponse createHistoryRecord(StopHistoryRequest request) {

        log.debug("Creating history record with request: {}", request);

        StopHistoryEntity history = new StopHistoryEntity();

        //TODO map
        history.setDatetime(LocalDateTime.now());
        history.setCount(request.getCount());
        history.setVelocity(request.getVelocity());
        history.setLoad(request.getLoad());
        history.setAddress(request.getAddress());

        var city = cityRepository.findById(request.getCityId());

        history.setCity(city.orElseThrow(EntityNotFoundException::new));

        StopHistoryEntity savedHistory = stopHistoryRepository.save(history);

        StopHistoryResponse historyResponse = new StopHistoryResponse();

        //TODO map
        historyResponse.setId(savedHistory.getId());
        historyResponse.setDatetime(savedHistory.getDatetime());
        historyResponse.setLoad(savedHistory.getLoad());
        historyResponse.setVelocity(savedHistory.getVelocity());
        historyResponse.setCount(savedHistory.getCount());
        historyResponse.setCityId(savedHistory.getCity().getId());

        return historyResponse;
    }
}
