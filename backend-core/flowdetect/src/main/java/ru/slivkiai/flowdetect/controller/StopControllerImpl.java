package ru.slivkiai.flowdetect.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;
import ru.slivkiai.flowdetect.domain.StopRequest;
import ru.slivkiai.flowdetect.domain.StopResponse;
import ru.slivkiai.flowdetect.domain.StopResponseUrl;
import ru.slivkiai.flowdetect.domain.StopStatsUpdateRequest;
import ru.slivkiai.flowdetect.service.StopService;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class StopControllerImpl implements StopController {
    private final StopService stopServiceImpl;

    @Override
    public Map<String, List<StopResponse>> getStops() {
        return Map.of("stops", stopServiceImpl.getAllStops());
    }

    @Override
    public Map<String, List<StopResponseUrl>> getStopsUrl() {
        return Map.of("stops", stopServiceImpl.getAllStopsUrl());
    }

    @Override
    public Map<String, List<StopResponse>> getStopsByCityId(Long cityId) {
        return Map.of("stops", stopServiceImpl.getAllStopsByCityId(cityId));
    }

    @Override
    public StopResponse createStop( StopRequest request) {
        return stopServiceImpl.createStop(request);
    }

    @Override
    public void deleteStop( Long id) {
        stopServiceImpl.deleteStop(id);
    }

    @Override
    public StopResponse updateStopStats(
            Long id,
            StopStatsUpdateRequest request) {
        return stopServiceImpl.updateStopStats(id, request);
    }
}
