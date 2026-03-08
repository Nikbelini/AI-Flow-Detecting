// src/api/modelingApi.ts
import { modelingUrl } from '../pages/Map/env';
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

const MODELING_URL = modelingUrl;

export const modelingApi = {
  // Проверить доступность сервиса
  checkHealth: async (): Promise<{ available: boolean; service: string }> => {
    try {
      const response = await fetch(`${MODELING_URL}/health`);
      if (!response.ok) {
        return { available: false, service: 'modeling-service' };
      }
      const data = await response.json();
      return {
        available: data.status === 'healthy',
        service: data.service
      };
    } catch (error) {
      console.error('Error checking modeling service health:', error);
      return { available: false, service: 'modeling-service' };
    }
  },

  // Получить данные города
  getCityData: async (cityId: number): Promise<Record<string, any>> => {
    try {
      const response = await fetch(`${MODELING_URL}/city/${cityId}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error getting city data for ${cityId}:`, error);
      throw error;
    }
  },

  // Получить остановки города
  getCityStops: async (cityId: number): Promise<any[]> => {
    try {
      const response = await fetch(`${MODELING_URL}/stops/${cityId}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error getting stops for city ${cityId}:`, error);
      throw error;
    }
  },

  // Получить информацию об остановке
  getStopInfo: async (stopId: number): Promise<any> => {
    try {
      const response = await fetch(`${MODELING_URL}/stop/${stopId}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error getting stop info for ${stopId}:`, error);
      throw error;
    }
  },

  // Получить историю остановки
  getStopHistory: async (stopId: number, days: number = 90): Promise<any[]> => {
    try {
      const response = await fetch(`${MODELING_URL}/stop/${stopId}/history?days=${days}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error getting stop history for ${stopId}:`, error);
      throw error;
    }
  },

  // Проанализировать город
  analyzeCity: async (request: CityAnalysisRequest): Promise<CityAnalysisResponse> => {
    try {
      const response = await fetch(`${MODELING_URL}/city/${request.cityId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error analyzing city:', error);
      throw error;
    }
  },

  // Прогнозировать спрос
  predictDemand: async (request: DemandPredictionRequest): Promise<DemandPredictionResponse> => {
    try {
      const response = await fetch(`${MODELING_URL}/city/${request.cityId}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error predicting demand:', error);
      throw error;
    }
  },

  // Запустить симуляцию (синхронно)
  runSimulation: async (request: ModelingRequest): Promise<ModelingResponse> => {
    try {
      const response = await fetch(`${MODELING_URL}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city_id: request.cityId,
          modifications: request.parameters?.modifications || [],
          simulation_hours: request.durationHours || 24
        })
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error running simulation:', error);
      throw error;
    }
  },

  // Запустить асинхронную симуляцию
  runAsyncSimulation: async (request: ModelingRequest): Promise<{ task_id: string }> => {
    try {
      const response = await fetch(`${MODELING_URL}/simulate/async`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city_id: request.cityId,
          modifications: request.parameters?.modifications || [],
          simulation_hours: request.durationHours || 24
        })
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error starting async simulation:', error);
      throw error;
    }
  },

  // Получить статус симуляции
  getSimulationStatus: async (taskId: string): Promise<SimulationStatusResponse> => {
    try {
      const response = await fetch(`${MODELING_URL}/simulate/status/${taskId}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error getting simulation status ${taskId}:`, error);
      throw error;
    }
  },

  // Валидировать изменения
  validateModifications: async (modifications: any[]): Promise<any> => {
    try {
      const response = await fetch(`${MODELING_URL}/modifications/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modifications)
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error validating modifications:', error);
      throw error;
    }
  },

  // Получить текущие метрики города
  getCityMetrics: async (cityId: number): Promise<any> => {
    try {
      const response = await fetch(`${MODELING_URL}/metrics/${cityId}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error getting metrics for city ${cityId}:`, error);
      throw error;
    }
  },

  // Обновить кэш города
  refreshCityCache: async (cityId: number): Promise<any> => {
    try {
      const response = await fetch(`${MODELING_URL}/cache/refresh/${cityId}`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Error refreshing cache for city ${cityId}:`, error);
      throw error;
    }
  },

  // Оценить сценарий
  evaluateScenario: async (request: ScenarioEvaluationRequest): Promise<ScenarioEvaluationResponse> => {
    try {
      const response = await fetch(`${MODELING_URL}/scenario/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error evaluating scenario:', error);
      throw error;
    }
  },

  // Сгенерировать визуализации
  generateVisualization: async (request: VisualizationRequest): Promise<VisualizationResponse> => {
    try {
      const response = await fetch(`${MODELING_URL}/visualization/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error generating visualization:', error);
      throw error;
    }
  },

  // Мониторинг симуляции (поллинг)
  monitorSimulation: async (
    taskId: string,
    interval: number = 1000,
    onUpdate?: (status: any) => void,
    onComplete?: (result: any) => void,
    onError?: (error: any) => void
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const status = await modelingApi.getSimulationStatus(taskId);
          
          if (onUpdate) {
            onUpdate(status);
          }
          
          if (status.status === 'completed') {
            if (onComplete) onComplete(status);
            resolve(status);
            return;
          }
          
          if (status.status === 'error') {
            const error = new Error('Simulation failed');
            if (onError) onError(error);
            reject(error);
            return;
          }
          
          // Если ещё не завершена, продолжаем мониторинг
          setTimeout(checkStatus, interval);
          
        } catch (error) {
          if (onError) onError(error);
          reject(error);
        }
      };
      
      checkStatus();
    });
  }
};