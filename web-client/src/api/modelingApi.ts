// src/api/modelingApi.ts
import apiClient from './client';
import type {
    ModelingRequest,
    ModelingResponse,
    SimulationStatusResponse,
    CityAnalysisRequest,
    CityAnalysisResponse,
    DemandPredictionRequest,
    DemandPredictionResponse,
    RouteOptimizationRequest,
    RouteOptimizationResponse,
    ScenarioEvaluationRequest,
    ScenarioEvaluationResponse,
    VisualizationRequest,
    VisualizationResponse
} from './types';

export const modelingApi = {
  // Проверить доступность сервиса
  checkHealth: async (): Promise<{ available: boolean; service: string }> => {
    try {
      const response = await apiClient.get<{
        service: string;
        available: boolean;
        timestamp: string;
      }>('/modeling/health');
      return {
        available: response.data.available,
        service: response.data.service
      };
    } catch (error) {
      console.error('Error checking modeling service health:', error);
      return { available: false, service: 'modeling-service' };
    }
  },

  // Получить данные города
  getCityData: async (cityId: number): Promise<Record<string, any>> => {
    try {
      const response = await apiClient.get<Record<string, any>>(
        `/modeling/city/${cityId}/data`
      );
      return response.data;
    } catch (error) {
      console.error(`Error getting city data for ${cityId}:`, error);
      throw error;
    }
  },

  // Проанализировать город
  analyzeCity: async (request: CityAnalysisRequest): Promise<CityAnalysisResponse> => {
    try {
      const response = await apiClient.post<CityAnalysisResponse>(
        `/modeling/city/${request.cityId}/analyze`,
        request
      );
      return response.data;
    } catch (error) {
      console.error('Error analyzing city:', error);
      throw error;
    }
  },

  // Прогнозировать спрос
  predictDemand: async (request: DemandPredictionRequest): Promise<DemandPredictionResponse> => {
    try {
      const response = await apiClient.post<DemandPredictionResponse>(
        `/modeling/city/${request.cityId}/predict`,
        request
      );
      return response.data;
    } catch (error) {
      console.error('Error predicting demand:', error);
      throw error;
    }
  },

  // Запустить симуляцию
  runSimulation: async (request: ModelingRequest): Promise<ModelingResponse> => {
    try {
      const response = await apiClient.post<ModelingResponse>(
        '/modeling/simulation/run',
        request
      );
      return response.data;
    } catch (error) {
      console.error('Error running simulation:', error);
      throw error;
    }
  },

  // Получить статус симуляции
  getSimulationStatus: async (simulationId: string): Promise<SimulationStatusResponse> => {
    try {
      const response = await apiClient.get<SimulationStatusResponse>(
        `/modeling/simulation/${simulationId}/status`
      );
      return response.data;
    } catch (error) {
      console.error(`Error getting simulation status ${simulationId}:`, error);
      throw error;
    }
  },

  // Оптимизировать маршруты
  optimizeRoutes: async (request: RouteOptimizationRequest): Promise<RouteOptimizationResponse> => {
    try {
      const response = await apiClient.post<RouteOptimizationResponse>(
        '/modeling/optimization/route',
        request
      );
      return response.data;
    } catch (error) {
      console.error('Error optimizing routes:', error);
      throw error;
    }
  },

  // Оценить сценарий
  evaluateScenario: async (request: ScenarioEvaluationRequest): Promise<ScenarioEvaluationResponse> => {
    try {
      const response = await apiClient.post<ScenarioEvaluationResponse>(
        '/modeling/scenario/evaluate',
        request
      );
      return response.data;
    } catch (error) {
      console.error('Error evaluating scenario:', error);
      throw error;
    }
  },

  // Сгенерировать визуализации
  generateVisualization: async (request: VisualizationRequest): Promise<VisualizationResponse> => {
    try {
      const response = await apiClient.post<VisualizationResponse>(
        '/modeling/visualization/generate',
        request
      );
      return response.data;
    } catch (error) {
      console.error('Error generating visualization:', error);
      throw error;
    }
  },

  // Запустить полный цикл моделирования
  runFullPipeline: async (cityId: number): Promise<Record<string, any>> => {
    try {
      const response = await apiClient.post<Record<string, any>>(
        `/modeling/city/${cityId}/full-pipeline`
      );
      return response.data;
    } catch (error) {
      console.error(`Error running full pipeline for city ${cityId}:`, error);
      throw error;
    }
  },

  // Протестировать сценарии
  testScenarios: async (cityId: number): Promise<Record<string, any>> => {
    try {
      const response = await apiClient.post<Record<string, any>>(
        '/modeling/scenario/test',
        null,
        { params: { cityId } }
      );
      return response.data;
    } catch (error) {
      console.error(`Error testing scenarios for city ${cityId}:`, error);
      throw error;
    }
  },

  // Мониторинг симуляции (поллинг)
  monitorSimulation: async (
    simulationId: string, 
    interval: number = 5000,
    onUpdate?: (status: SimulationStatusResponse) => void,
    onComplete?: (result: SimulationStatusResponse) => void,
    onError?: (error: any) => void
  ): Promise<SimulationStatusResponse> => {
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const status = await modelingApi.getSimulationStatus(simulationId);
          
          if (onUpdate) {
            onUpdate(status);
          }
          
          if (status.status === 'completed') {
            if (onComplete) onComplete(status);
            resolve(status);
            return;
          }
          
          if (status.status === 'failed') {
            if (onError) onError(new Error(status.message || 'Simulation failed'));
            reject(new Error(status.message || 'Simulation failed'));
            return;
          }
          
          // Если еще не завершена, продолжаем мониторинг
          setTimeout(checkStatus, interval);
          
        } catch (error) {
          if (onError) onError(error);
          reject(error);
        }
      };
      
      checkStatus();
    });
  },
};