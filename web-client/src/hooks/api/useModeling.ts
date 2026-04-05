// src/hooks/api/useModeling.ts
import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { modelingApi } from '../../api/modelingApi';
import type {
    ModelingRequest,
    CityAnalysisRequest,
    DemandPredictionRequest,
    RouteOptimizationRequest,
    ScenarioEvaluationRequest,
    VisualizationRequest
} from '../../api/types';

const HEALTH_QUERY_KEY = ['modeling', 'health'];
const SIMULATION_RESULT_KEY = (cityId: number) => ['modeling', 'simulation', cityId];

export const useModeling = () => {
  const queryClient = useQueryClient();

  // ========== HEALTH CHECK ==========
  const {
    data: healthStatus,
    isLoading: healthLoading,
    error: healthError,
    refetch: checkHealth,
  } = useQuery({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: () => modelingApi.checkHealth(),
    staleTime: 30 * 1000, // 30 секунд
    retry: 2,
  });

  // ========== RUN SIMULATION (мутация с кэшированием результата) ==========
  const runSimulationMutation = useMutation({
    mutationFn: (request: ModelingRequest) => modelingApi.runSimulation(request),
    onSuccess: (data, variables) => {
      // Кэшируем результат симуляции для города
      if (variables.city_id) {
        queryClient.setQueryData(SIMULATION_RESULT_KEY(variables.city_id), data);
      }
    },
  });

  // ========== ANALYZE CITY ==========
  const analyzeCityMutation = useMutation({
    mutationFn: (request: CityAnalysisRequest) => modelingApi.analyzeCity(request),
  });

  // ========== PREDICT DEMAND ==========
  const predictDemandMutation = useMutation({
    mutationFn: (request: DemandPredictionRequest) => modelingApi.predictDemand(request),
  });

  // ========== OPTIMIZE ROUTES ==========
  const optimizeRoutesMutation = useMutation({
    mutationFn: (request: RouteOptimizationRequest) => modelingApi.optimizeRoutes(request),
  });

  // ========== EVALUATE SCENARIO ==========
  const evaluateScenarioMutation = useMutation({
    mutationFn: (request: ScenarioEvaluationRequest) => modelingApi.evaluateScenario(request),
  });

  // ========== RUN FULL PIPELINE ==========
  const runFullPipelineMutation = useMutation({
    mutationFn: (cityId: number) => modelingApi.runFullPipeline(cityId),
  });

  // ========== MONITOR SIMULATION ==========
  const monitorSimulation = useCallback(async (
    simulationId: string,
    interval?: number,
    onUpdate?: (status: any) => void,
    onComplete?: (result: any) => void,
    onError?: (error: any) => void
  ) => {
    // Для мониторинга оставляем прямой вызов (не кэшируется)
    return await modelingApi.monitorSimulation(
      simulationId,
      interval,
      onUpdate,
      onComplete,
      onError
    );
  }, []);

  // Получаем результат симуляции из кэша
  const getSimulationResult = useCallback((cityId: number) => {
    return queryClient.getQueryData(SIMULATION_RESULT_KEY(cityId));
  }, [queryClient]);

  const error = healthError instanceof Error ? healthError.message : (healthError as string) || null;

  return {
    loading: healthLoading,
    error,
    healthStatus,
    checkHealth,
    runSimulation: runSimulationMutation.mutateAsync,
    analyzeCity: analyzeCityMutation.mutateAsync,
    predictDemand: predictDemandMutation.mutateAsync,
    optimizeRoutes: optimizeRoutesMutation.mutateAsync,
    evaluateScenario: evaluateScenarioMutation.mutateAsync,
    runFullPipeline: runFullPipelineMutation.mutateAsync,
    monitorSimulation,
    getSimulationResult,
    // Для доступа к состоянию мутаций (если нужно)
    isSimulating: runSimulationMutation.isPending,
    simulationError: runSimulationMutation.error,
  };
};