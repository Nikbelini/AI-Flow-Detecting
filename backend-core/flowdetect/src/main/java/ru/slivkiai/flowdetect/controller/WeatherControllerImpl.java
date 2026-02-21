package ru.slivkiai.flowdetect.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import ru.slivkiai.flowdetect.domain.WeatherResponseDto;
import ru.slivkiai.flowdetect.service.WeatherService;

@RestController
@RequiredArgsConstructor
public class WeatherControllerImpl implements WeatherController {

    private final WeatherService weatherServiceImpl;

    @Override
    public ResponseEntity<WeatherResponseDto> getLatestWeather(Long stopId) {
        return weatherServiceImpl.getLatestWeatherByStop(stopId)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.noContent().build());
    }
}