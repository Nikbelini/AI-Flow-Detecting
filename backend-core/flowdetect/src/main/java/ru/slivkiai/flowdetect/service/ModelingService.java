package ru.slivkiai.flowdetect.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ru.slivkiai.flowdetect.client.ModelingClient;
import ru.slivkiai.flowdetect.domain.external.*;
import ru.slivkiai.flowdetect.exception.ModelingServiceException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ModelingService {

    private final ModelingClient modelingClient;

    /**
     * Проверить доступность сервиса моделирования
     */
    public boolean isServiceAvailable() {
        try {
            Map<String, Object> response = modelingClient.healthCheck();
            return response != null && "healthy".equals(response.get("status"));
        } catch (Exception e) {
            log.warn("Modeling service is unavailable: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Получить полные данные города для моделирования
     */
    public Map<String, Object> getCityData(Long cityId) {
        try {
            log.info("Fetching city data for modeling: cityId={}", cityId);
            Map<String, Object> response = modelingClient.getCityData(cityId);

            if (response == null || !Boolean.TRUE.equals(response.get("success"))) {
                throw new ModelingServiceException("Failed to fetch city data from modeling service");
            }

            return response;
        } catch (Exception e) {
            log.error("Error fetching city data from modeling service: {}", e.getMessage(), e);
            throw new ModelingServiceException("Failed to fetch city data: " + e.getMessage(), e);
        }
    }

    /**
     * Проанализировать данные города
     */
    public CityAnalysisResponse analyzeCityData(Long cityId, LocalDateTime startDate, LocalDateTime endDate) {
        try {
            log.info("Analyzing city data: cityId={}, startDate={}, endDate={}",
                    cityId, startDate, endDate);

            CityAnalysisRequest request = CityAnalysisRequest.builder()
                    .cityId(cityId)
                    .startDate(startDate)
                    .endDate(endDate)
                    .includeWeather(true)
                    .includeEvents(true)
                    .build();

            CityAnalysisResponse response = modelingClient.analyzeCityData(cityId, request);

            if (response == null || !Boolean.TRUE.equals(response.getSuccess())) {
                throw new ModelingServiceException("Failed to analyze city data");
            }

            return response;
        } catch (Exception e) {
            log.error("Error analyzing city data: {}", e.getMessage(), e);
            throw new ModelingServiceException("Failed to analyze city data: " + e.getMessage(), e);
        }
    }

    /**
     * Прогнозировать спрос на транспорте
     */
    public DemandPredictionResponse predictDemand(Long cityId,
                                                  LocalDateTime startDate,
                                                  LocalDateTime endDate) {
        try {
            log.info("Predicting demand: cityId={}, startDate={}, endDate={}",
                    cityId, startDate, endDate);

            DemandPredictionRequest request = DemandPredictionRequest.builder()
                    .cityId(cityId)
                    .startDate(startDate)
                    .endDate(endDate)
                    .includeWeather(true)
                    .includeEvents(true)
                    .build();

            DemandPredictionResponse response = modelingClient.predictDemand(cityId, request);

            if (response == null || !Boolean.TRUE.equals(response.getSuccess())) {
                throw new ModelingServiceException("Failed to predict demand");
            }

            return response;
        } catch (Exception e) {
            log.error("Error predicting demand: {}", e.getMessage(), e);
            throw new ModelingServiceException("Failed to predict demand: " + e.getMessage(), e);
        }
    }

    /**
     * Запустить симуляцию
     */
    public ModelingResponse runSimulation(Long cityId,
                                          String scenarioName,
                                          Map<String, Object> parameters) {
        try {
            log.info("Running simulation: cityId={}, scenario={}", cityId, scenarioName);

            ModelingRequest request = ModelingRequest.builder()
                    .cityId(cityId)
                    .scenarioName(scenarioName)
                    .description("Simulation requested from Java service")
                    .parameters(parameters != null ? parameters : Map.of())
                    .durationHours(12) // 12 часов симуляции по умолчанию
                    .build();

            ModelingResponse response = modelingClient.runSimulation(request);

            if (response == null || !Boolean.TRUE.equals(response.getSuccess())) {
                throw new ModelingServiceException("Failed to start simulation");
            }

            log.info("Simulation started: simulationId={}", response.getSimulationId());
            return response;
        } catch (Exception e) {
            log.error("Error running simulation: {}", e.getMessage(), e);
            throw new ModelingServiceException("Failed to run simulation: " + e.getMessage(), e);
        }
    }

    /**
     * Получить статус симуляции
     */
    public SimulationStatusResponse getSimulationStatus(String simulationId) {
        try {
            log.debug("Checking simulation status: simulationId={}", simulationId);

            SimulationStatusResponse response = modelingClient.getSimulationStatus(simulationId);

            if (response == null) {
                throw new ModelingServiceException("Failed to get simulation status");
            }

            return response;
        } catch (Exception e) {
            log.error("Error getting simulation status: {}", e.getMessage(), e);
            throw new ModelingServiceException("Failed to get simulation status: " + e.getMessage(), e);
        }
    }

    /**
     * Оптимизировать маршруты
     */
    public RouteOptimizationResponse optimizeRoutes(Long cityId,
                                                    List<String> optimizationGoals,
                                                    Map<String, Object> constraints) {
        try {
            log.info("Optimizing routes: cityId={}, goals={}", cityId, optimizationGoals);

            RouteOptimizationRequest request = RouteOptimizationRequest.builder()
                    .cityId(cityId)
                    .optimizationGoals(optimizationGoals != null ? optimizationGoals :
                            List.of("efficiency", "coverage", "cost"))
                    .constraints(constraints)
                    .build();

            RouteOptimizationResponse response = modelingClient.optimizeRoutes(request);

            if (response == null || !Boolean.TRUE.equals(response.getSuccess())) {
                throw new ModelingServiceException("Failed to optimize routes");
            }

            return response;
        } catch (Exception e) {
            log.error("Error optimizing routes: {}", e.getMessage(), e);
            throw new ModelingServiceException("Failed to optimize routes: " + e.getMessage(), e);
        }
    }

    /**
     * Оценить сценарий изменений
     */
    public ScenarioEvaluationResponse evaluateScenario(Long cityId,
                                                       String scenarioName,
                                                       Map<String, Object> changes) {
        try {
            log.info("Evaluating scenario: cityId={}, scenario={}", cityId, scenarioName);

            ScenarioEvaluationRequest request = ScenarioEvaluationRequest.builder()
                    .cityId(cityId)
                    .name(scenarioName)
                    .changes(changes != null ? changes : Map.of())
                    .evaluationMetrics(List.of("demand", "coverage", "efficiency"))
                    .build();

            ScenarioEvaluationResponse response = modelingClient.evaluateScenario(request);

            if (response == null || !Boolean.TRUE.equals(response.getSuccess())) {
                throw new ModelingServiceException("Failed to evaluate scenario");
            }

            return response;
        } catch (Exception e) {
            log.error("Error evaluating scenario: {}", e.getMessage(), e);
            throw new ModelingServiceException("Failed to evaluate scenario: " + e.getMessage(), e);
        }
    }

    /**
     * Сгенерировать визуализации
     */
    public VisualizationResponse generateVisualization(Long cityId,
                                                       List<String> types,
                                                       Map<String, Object> parameters) {
        try {
            log.info("Generating visualizations: cityId={}, types={}", cityId, types);

            VisualizationRequest request = VisualizationRequest.builder()
                    .cityId(cityId)
                    .types(types != null ? types : List.of("heatmap", "network"))
                    .parameters(parameters)
                    .formats(List.of("json"))
                    .build();

            VisualizationResponse response = modelingClient.generateVisualization(request);

            if (response == null || !Boolean.TRUE.equals(response.getSuccess())) {
                throw new ModelingServiceException("Failed to generate visualizations");
            }

            return response;
        } catch (Exception e) {
            log.error("Error generating visualizations: {}", e.getMessage(), e);
            throw new ModelingServiceException("Failed to generate visualizations: " + e.getMessage(), e);
        }
    }

    /**
     * Запустить полный цикл моделирования
     */
    public Map<String, Object> runFullModelingPipeline(Long cityId) {
        try {
            log.info("Starting full modeling pipeline for city: {}", cityId);

            // 1. Получаем данные
            Map<String, Object> cityData = getCityData(cityId);

            // 2. Анализируем
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime monthAgo = now.minusDays(30);

            CityAnalysisResponse analysis = analyzeCityData(cityId, monthAgo, now);

            // 3. Прогнозируем спрос на завтра
            LocalDateTime tomorrow = now.plusDays(1);
            DemandPredictionResponse prediction = predictDemand(cityId, now, tomorrow);

            // 4. Оптимизируем маршруты
            RouteOptimizationResponse optimization = optimizeRoutes(cityId,
                    List.of("efficiency", "coverage"), Map.of());

            // 5. Собираем результаты
            return Map.of(
                    "cityData", cityData,
                    "analysis", analysis,
                    "prediction", prediction,
                    "optimization", optimization,
                    "pipelineCompleted", true,
                    "timestamp", LocalDateTime.now()
            );

        } catch (Exception e) {
            log.error("Error in full modeling pipeline: {}", e.getMessage(), e);
            throw new ModelingServiceException("Modeling pipeline failed: " + e.getMessage(), e);
        }
    }
}
