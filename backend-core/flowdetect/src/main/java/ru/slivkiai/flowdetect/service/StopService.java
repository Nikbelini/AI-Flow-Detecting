package ru.slivkiai.flowdetect.service;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.slivkiai.flowdetect.domain.StopRequest;
import ru.slivkiai.flowdetect.domain.StopResponse;
import ru.slivkiai.flowdetect.domain.StopResponseUrl;
import ru.slivkiai.flowdetect.domain.StopStatsUpdateRequest;
import ru.slivkiai.flowdetect.domain.entity.CityEntity;
import ru.slivkiai.flowdetect.domain.entity.StopEntity;
import ru.slivkiai.flowdetect.repository.CityRepository;
import ru.slivkiai.flowdetect.repository.StopRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StopService {
    private final StopRepository stopRepository;
    private final CityRepository cityRepository;

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

    public void deleteStop(Long id) {
        stopRepository.deleteById(id);
    }

    public StopResponse updateStopStats(Long id, StopStatsUpdateRequest request) {
        StopEntity stop = stopRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Stop not found"));

        stop.setCount(request.getCount());
        stop.setVelocity(request.getVelocity());
        stop.setLoad(request.getLoad());

        StopEntity updatedStop = stopRepository.save(stop);
        //TODO map
        StopResponse stopResponse = new StopResponse();
        stopResponse.setUrl(updatedStop.getUrl());
        stopResponse.setAddress(updatedStop.getAddress());
        stopResponse.setCount(updatedStop.getCount());
        stopResponse.setVelocity(updatedStop.getVelocity());
        stopResponse.setLoad(updatedStop.getLoad());
        stopResponse.setLat(updatedStop.getLat().doubleValue());
        stopResponse.setLng(updatedStop.getLng().doubleValue());
        return stopResponse;
    }

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
