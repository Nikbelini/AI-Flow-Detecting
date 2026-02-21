package ru.slivkiai.flowdetect.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import ru.slivkiai.flowdetect.domain.WeatherResponseDto;

@RestController
@RequestMapping("/weather")
@Tag(name = "Weather", description = "API for weather data")
public interface WeatherController {
    @GetMapping("/latest/{stopId}")
    @Operation(summary = "Get latest weather for stop")
    @ApiResponse(responseCode = "200", description = "Weather found")
    @ApiResponse(responseCode = "204", description = "No weather data")
    ResponseEntity<WeatherResponseDto> getLatestWeather(
            @PathVariable Long stopId); 
}
