package ru.slivkiai.flowdetect.service;

import ru.slivkiai.flowdetect.domain.StopRequest;
import ru.slivkiai.flowdetect.domain.StopResponse;
import ru.slivkiai.flowdetect.domain.StopResponseUrl;
import ru.slivkiai.flowdetect.domain.StopStatsUpdateRequest;

import java.util.List;

public interface StopService {
    List<StopResponse> getAllStops();

    StopResponse createStop(StopRequest request);

    void deleteStop(Long id);

    StopResponse updateStopStats(Long id, StopStatsUpdateRequest request);

    List<StopResponse> getAllStopsByCityId(Long cityId);

    List<StopResponseUrl> getAllStopsUrl();
}
