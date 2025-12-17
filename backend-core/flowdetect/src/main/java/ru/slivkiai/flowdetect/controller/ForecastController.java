package ru.slivkiai.flowdetect.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.slivkiai.flowdetect.domain.external.ForecastRequest;
import ru.slivkiai.flowdetect.domain.external.ForecastResponse;
import ru.slivkiai.flowdetect.service.ForecastService;

import java.util.Map;

@RestController
@RequestMapping("/forecast")
@RequiredArgsConstructor
@Tag(name = "Forecast", description = "API для прогнозирования пассажиропотока")
public class ForecastController {

    private final ForecastService forecastService;

    @PostMapping
    @Operation(summary = "Получить прогноз пассажиропотока")
    @ApiResponse(responseCode = "200", description = "Прогноз успешно получен")
    @ApiResponse(responseCode = "400", description = "Неверные параметры запроса")
    @ApiResponse(responseCode = "500", description = "Ошибка сервиса прогнозирования")
    public ResponseEntity<ForecastResponse> getForecast(@RequestBody ForecastRequest request) {
        try {
            ForecastResponse response = forecastService.getForecast(
                    request.getAddress(),
                    request.getForecastHours()
            );
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/health")
    @Operation(summary = "Проверка здоровья сервиса прогнозирования")
    public ResponseEntity<Map<String, String>> healthCheck() {
        String status = forecastService.checkHealth();
        return ResponseEntity.ok(Map.of("status", status));
    }

    @GetMapping("/model/info")
    @Operation(summary = "Информация о модели прогнозирования")
    public ResponseEntity<Map<String, Object>> getModelInfo() {
        return ResponseEntity.ok(Map.of(
                "model_type", "Hybrid Neuro-Fuzzy LSTM",
                "service", "load-forecast-service",
                "status", "operational"
        ));
    }
}