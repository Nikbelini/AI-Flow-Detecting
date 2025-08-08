package ru.slivkiai.flowdetect.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.slivkiai.flowdetect.domain.StopResponse;
import ru.slivkiai.flowdetect.domain.entity.StopEntity;
import ru.slivkiai.flowdetect.repository.StopRepository;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StopService {
    private final StopRepository stopRepository;

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
}
