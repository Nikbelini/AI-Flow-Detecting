package ru.slivkiai.flowdetect.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import ru.slivkiai.flowdetect.config.FeignConfig;
import ru.slivkiai.flowdetect.domain.external.*;

import java.util.Map;

@FeignClient(
        name = "modeling-service",
        url = "${modeling.service.url:http://localhost:8001}",
        configuration = FeignConfig.class
)
public interface ModelingClient {

    // Проверка здоровья сервиса
    @GetMapping("/health")
    Map<String, Object> healthCheck();

    // Получение полных данных города
    @GetMapping("/api/v1/city/{cityId}/data")
    Map<String, Object> getCityData(@PathVariable("cityId") Long cityId);

    // Анализ данных города
    @PostMapping(value = "/api/v1/city/{cityId}/analyze",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    CityAnalysisResponse analyzeCityData(@PathVariable("cityId") Long cityId,
                                         @RequestBody CityAnalysisRequest request);

    // Прогнозирование спроса
    @PostMapping(value = "/api/v1/city/{cityId}/predict",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    DemandPredictionResponse predictDemand(@PathVariable("cityId") Long cityId,
                                           @RequestBody DemandPredictionRequest request);

    // Запуск симуляции
    @PostMapping(value = "/api/v1/simulation/run",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    ModelingResponse runSimulation(@RequestBody ModelingRequest request);

    // Получение статуса симуляции
    @GetMapping("/api/v1/simulation/{simulationId}/status")
    SimulationStatusResponse getSimulationStatus(@PathVariable("simulationId") String simulationId);

    // Оптимизация маршрутов
    @PostMapping(value = "/api/v1/optimization/route",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    RouteOptimizationResponse optimizeRoutes(@RequestBody RouteOptimizationRequest request);

    // Оценка сценария
    @PostMapping(value = "/api/v1/scenario/evaluate",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    ScenarioEvaluationResponse evaluateScenario(@RequestBody ScenarioEvaluationRequest request);

    // Генерация визуализаций
    @PostMapping(value = "/api/v1/visualization/generate",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    VisualizationResponse generateVisualization(@RequestBody VisualizationRequest request);
}
