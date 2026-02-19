// src/hooks/api/useModeling.ts
import { useState, useCallback } from 'react';
import { modelingApi } from '../../api/modelingApi';
import type {
    ModelingRequest,
    CityAnalysisRequest,
    DemandPredictionRequest,
    RouteOptimizationRequest,
    ScenarioEvaluationRequest,
    VisualizationRequest
} from '../../api/types';

export const useModeling = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      return await modelingApi.checkHealth();
    } catch (err: any) {
      setError(err.message || 'Failed to check modeling service health');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const runSimulation = useCallback(async (request: ModelingRequest) => {
    setLoading(true);
    setError(null);
    try {
      return await modelingApi.runSimulation(request);
    } catch (err: any) {
      setError(err.message || 'Failed to run simulation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzeCity = useCallback(async (request: CityAnalysisRequest) => {
    setLoading(true);
    setError(null);
    try {
      return await modelingApi.analyzeCity(request);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze city');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const predictDemand = useCallback(async (request: DemandPredictionRequest) => {
    setLoading(true);
    setError(null);
    try {
      return await modelingApi.predictDemand(request);
    } catch (err: any) {
      setError(err.message || 'Failed to predict demand');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const optimizeRoutes = useCallback(async (request: RouteOptimizationRequest) => {
    setLoading(true);
    setError(null);
    try {
      return await modelingApi.optimizeRoutes(request);
    } catch (err: any) {
      setError(err.message || 'Failed to optimize routes');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const evaluateScenario = useCallback(async (request: ScenarioEvaluationRequest) => {
    setLoading(true);
    setError(null);
    try {
      return await modelingApi.evaluateScenario(request);
    } catch (err: any) {
      setError(err.message || 'Failed to evaluate scenario');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const runFullPipeline = useCallback(async (cityId: number) => {
    setLoading(true);
    setError(null);
    try {
      return await modelingApi.runFullPipeline(cityId);
    } catch (err: any) {
      setError(err.message || 'Failed to run full pipeline');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const monitorSimulation = useCallback(async (
    simulationId: string,
    interval?: number,
    onUpdate?: (status: any) => void,
    onComplete?: (result: any) => void,
    onError?: (error: any) => void
  ) => {
    setLoading(true);
    setError(null);
    try {
      return await modelingApi.monitorSimulation(
        simulationId,
        interval,
        onUpdate,
        onComplete,
        onError
      );
    } catch (err: any) {
      setError(err.message || 'Failed to monitor simulation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    checkHealth,
    runSimulation,
    analyzeCity,
    predictDemand,
    optimizeRoutes,
    evaluateScenario,
    runFullPipeline,
    monitorSimulation,
  };
};