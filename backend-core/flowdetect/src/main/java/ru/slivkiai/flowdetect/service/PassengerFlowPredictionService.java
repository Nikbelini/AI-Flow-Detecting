package ru.slivkiai.flowdetect.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import ru.slivkiai.flowdetect.client.FlowPredictionClient;
import ru.slivkiai.flowdetect.domain.entity.StopEntity;
import ru.slivkiai.flowdetect.domain.entity.StopHistoryEntity;
import ru.slivkiai.flowdetect.dto.PredictionRequestDto;
import ru.slivkiai.flowdetect.dto.PredictionResponseDto;
import ru.slivkiai.flowdetect.dto.StopContextDto;
import ru.slivkiai.flowdetect.repository.EventRepository;
import ru.slivkiai.flowdetect.repository.StopHistoryRepository;
import ru.slivkiai.flowdetect.repository.StopRepository;
import ru.slivkiai.flowdetect.repository.WeatherDataRepository;

@Service
@RequiredArgsConstructor
public class PassengerFlowPredictionService {

    private final StopRepository stopRepository;

    private final StopHistoryRepository historyRepository;
    
    private final WeatherDataRepository weatherRepository;

    private final EventRepository eventRepository;
    
    private final FlowPredictionClient mlClient;

    public List<PredictionResponseDto> predict(Long cityId) {

        List<StopEntity> stops = stopRepository.getByCityId(cityId);

        List<StopContextDto> known = new ArrayList<>();
        List<StopContextDto> unknown = new ArrayList<>();

        for (StopEntity stop : stops) {
            List<StopHistoryEntity> history = historyRepository.findLast24HoursByAddress(stop.getAddress());

            StopContextDto dto = buildContext(stop, history);

            if (history.isEmpty()) {
                unknown.add(dto);
            } else {
                known.add(dto);
            }
        }

        PredictionRequestDto request = new PredictionRequestDto();
        request.setCityId(cityId);
        request.setKnownStops(known);
        request.setUnknownStops(unknown);

        return mlClient.predict(request);
    }

    private StopContextDto buildContext(StopEntity stop, List<StopHistoryEntity> history) {
        
        StopContextDto dto = new StopContextDto();
        
        dto.setStopId(stop.getId());
        dto.setLat(stop.getLat().doubleValue());
        dto.setLng(stop.getLng().doubleValue());
        dto.setFlowHistory(history.stream()
                .limit(24)
                .map(StopHistoryEntity::getCount)
                .toList());

        return dto;
    }
}
