package ru.slivkiai.flowdetect.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.slivkiai.flowdetect.domain.external.*;
import ru.slivkiai.flowdetect.service.ModelingService;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/modeling")
@RequiredArgsConstructor
@Tag(name = "Моделирование транспорта", description = "API для работы с сервисом моделирования")
public class ModelingController {

    private final ModelingService modelingService;

    @GetMapping("/health")
    @Operation(summary = "Проверить доступность сервиса моделирования")
    public ResponseEntity<Map<String, Object>> checkServiceHealth() {
        boolean isAvailable = modelingService.isServiceAvailable();

        return ResponseEntity.ok(Map.of(
                "service", "modeling-service",
                "available", isAvailable,
                "timestamp", LocalDateTime.now()
        ));
    }

    @GetMapping("/city/{cityId}/data")
    @Operation(summary = "Получить данные города для моделирования")
    public ResponseEntity<Map<String, Object>> getCityData(
            @Parameter(description = "ID города", required = true)
            @PathVariable Long cityId) {

        try {
            Map<String, Object> data = modelingService.getCityData(cityId);
            return ResponseEntity.ok(data);
        } catch (Exception e) {
            log.error("Error getting city data: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of(
                            "error", "Failed to get city data",
                            "message", e.getMessage(),
                            "timestamp", LocalDateTime.now()
                    ));
        }
    }

    @PostMapping("/city/{cityId}/analyze")
    @Operation(summary = "Проанализировать данные города")
    public ResponseEntity<CityAnalysisResponse> analyzeCity(
            @Parameter(description = "ID города", required = true)
            @PathVariable Long cityId,
            @RequestBody CityAnalysisRequest request) {

        try {
            CityAnalysisResponse response = modelingService.analyzeCityData(
                    cityId, request.getStartDate(), request.getEndDate());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error analyzing city: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CityAnalysisResponse.builder()
                            .success(false)
                            .cityId(cityId)
                            .timestamp(LocalDateTime.now())
                            .build());
        }
    }

    @PostMapping("/city/{cityId}/predict")
    @Operation(summary = "Прогнозировать спрос на транспорте")
    public ResponseEntity<DemandPredictionResponse> predictDemand(
            @Parameter(description = "ID города", required = true)
            @PathVariable Long cityId,
            @RequestBody DemandPredictionRequest request) {

        try {
            DemandPredictionResponse response = modelingService.predictDemand(
                    cityId, request.getStartDate(), request.getEndDate());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error predicting demand: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(DemandPredictionResponse.builder()
                            .success(false)
                            .cityId(cityId)
                            .timestamp(LocalDateTime.now())
                            .build());
        }
    }

    @PostMapping("/simulation/run")
    @Operation(summary = "Запустить симуляцию транспорта")
    public ResponseEntity<ModelingResponse> runSimulation(
            @RequestBody ModelingRequest request) {

        try {
            ModelingResponse response = modelingService.runSimulation(
                    request.getCityId(),
                    request.getScenarioName(),
                    request.getParameters());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error running simulation: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ModelingResponse.builder()
                            .success(false)
                            .status("failed")
                            .message(e.getMessage())
                            .timestamp(LocalDateTime.now())
                            .build());
        }
    }

    @GetMapping("/simulation/{simulationId}/status")
    @Operation(summary = "Получить статус симуляции")
    public ResponseEntity<SimulationStatusResponse> getSimulationStatus(
            @Parameter(description = "ID симуляции", required = true)
            @PathVariable String simulationId) {

        try {
            SimulationStatusResponse response = modelingService.getSimulationStatus(simulationId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error getting simulation status: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(SimulationStatusResponse.builder()
                            .simulationId(simulationId)
                            .status("error")
                            .message(e.getMessage())
                            .timestamp(LocalDateTime.now())
                            .build());
        }
    }

    @PostMapping("/optimization/route")
    @Operation(summary = "Оптимизировать маршруты транспорта")
    public ResponseEntity<RouteOptimizationResponse> optimizeRoutes(
            @RequestBody RouteOptimizationRequest request) {

        try {
            RouteOptimizationResponse response = modelingService.optimizeRoutes(
                    request.getCityId(),
                    request.getOptimizationGoals(),
                    request.getConstraints());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error optimizing routes: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(RouteOptimizationResponse.builder()
                            .success(false)
                            .cityId(request.getCityId())
                            .timestamp(LocalDateTime.now())
                            .build());
        }
    }

    @PostMapping("/scenario/evaluate")
    @Operation(summary = "Оценить сценарий изменений")
    public ResponseEntity<ScenarioEvaluationResponse> evaluateScenario(
            @RequestBody ScenarioEvaluationRequest request) {

        try {
            ScenarioEvaluationResponse response = modelingService.evaluateScenario(
                    request.getCityId(),
                    request.getName(),
                    request.getChanges());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error evaluating scenario: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ScenarioEvaluationResponse.builder()
                            .success(false)
                            .scenarioName(request.getName())
                            .timestamp(LocalDateTime.now())
                            .build());
        }
    }

    @PostMapping("/visualization/generate")
    @Operation(summary = "Сгенерировать визуализации")
    public ResponseEntity<VisualizationResponse> generateVisualization(
            @RequestBody VisualizationRequest request) {

        try {
            VisualizationResponse response = modelingService.generateVisualization(
                    request.getCityId(),
                    request.getTypes(),
                    request.getParameters());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error generating visualization: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(VisualizationResponse.builder()
                            .success(false)
                            .timestamp(LocalDateTime.now())
                            .build());
        }
    }

    @PostMapping("/city/{cityId}/full-pipeline")
    @Operation(summary = "Запустить полный цикл моделирования")
    public ResponseEntity<Map<String, Object>> runFullModelingPipeline(
            @Parameter(description = "ID города", required = true)
            @PathVariable Long cityId) {

        try {
            Map<String, Object> result = modelingService.runFullModelingPipeline(cityId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error in full modeling pipeline: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "error", "Modeling pipeline failed",
                            "message", e.getMessage(),
                            "cityId", cityId,
                            "timestamp", LocalDateTime.now()
                    ));
        }
    }

    @PostMapping("/scenario/test")
    @Operation(summary = "Протестировать различные сценарии")
    public ResponseEntity<Map<String, Object>> testScenarios(
            @Parameter(description = "ID города", required = true)
            @RequestParam Long cityId) {

        try {
            log.info("Testing scenarios for city: {}", cityId);

            // Сценарий 1: Увеличение спроса в центре города
            Map<String, Object> scenario1 = Map.of(
                    "demand_changes", Map.of(
                            "stop_1", Map.of("scale", 1.5),  // Остановка в центре
                            "stop_2", Map.of("scale", 1.3)
                    ),
                    "description", "Increased demand in city center"
            );

            ScenarioEvaluationResponse scenario1Result = modelingService.evaluateScenario(
                    cityId, "center-demand-increase", scenario1);

            // Сценарий 2: Добавление нового маршрута
            Map<String, Object> scenario2 = Map.of(
                    "new_routes", List.of(
                            Map.of(
                                    "number", "999",
                                    "name", "Экспресс центр-аэропорт",
                                    "stops", List.of(1, 2, 3, 4),
                                    "interval_minutes", 10
                            )
                    ),
                    "description", "New express route to airport"
            );

            ScenarioEvaluationResponse scenario2Result = modelingService.evaluateScenario(
                    cityId, "new-express-route", scenario2);

            // Сценарий 3: Пиковый час + плохая погода
            Map<String, Object> scenario3 = Map.of(
                    "demand_changes", Map.of(
                            "all", Map.of("scale", 1.3)
                    ),
                    "weather_factor", 1.2,
                    "description", "Rush hour with bad weather"
            );

            ScenarioEvaluationResponse scenario3Result = modelingService.evaluateScenario(
                    cityId, "rush-hour-bad-weather", scenario3);

            // Собираем результаты
            Map<String, Object> results = Map.of(
                    "cityId", cityId,
                    "scenariosTested", 3,
                    "scenario1", scenario1Result,
                    "scenario2", scenario2Result,
                    "scenario3", scenario3Result,
                    "timestamp", LocalDateTime.now()
            );

            return ResponseEntity.ok(results);

        } catch (Exception e) {
            log.error("Error testing scenarios: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "error", "Scenario testing failed",
                            "message", e.getMessage(),
                            "cityId", cityId,
                            "timestamp", LocalDateTime.now()
                    ));
        }
    }
}
