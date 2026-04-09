// src/hooks/api/useOptimalRoute.ts
import { useState, useCallback } from 'react';
import type { RoutePlanRequest, RoutePlanResponse, RouteSegment } from '../../api/types/routes';
import type { Stop } from '../../api/types';
import { routeApi } from '../../api/endpoints/routePlannerApi';

export interface OptimalRouteResult {
  response: RoutePlanResponse;
  segments: RouteSegment[];
  startStop: Stop | null;
  goalStop: Stop | null;
  totalCostMinutes: number;
  mode: string;
}

export interface UseOptimalRouteReturn {
  loading: boolean;
  error: string | null;
  result: OptimalRouteResult | null;
  startStopId: number | null;
  goalStopId: number | null;
  setStartStop: (stopId: number | null) => void;
  setGoalStop: (stopId: number | null) => void;
  clearSelection: () => void;
  buildRoute: (cityId: number, mode: 'FASTEST' | 'LESS_CROWDED' | 'MIN_TRANSFERS', allStops: Stop[]) => Promise<void>;
  clearResult: () => void;
  isReadyToBuild: boolean;
}

export const useOptimalRoute = (): UseOptimalRouteReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimalRouteResult | null>(null);
  const [startStopId, setStartStopId] = useState<number | null>(null);
  const [goalStopId, setGoalStopId] = useState<number | null>(null);

  const clearSelection = useCallback(() => {
    setStartStopId(null);
    setGoalStopId(null);
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const isReadyToBuild = startStopId !== null && goalStopId !== null && startStopId !== goalStopId;

  const buildRoute = useCallback(async (
    cityId: number,
    mode: 'FASTEST' | 'LESS_CROWDED' | 'MIN_TRANSFERS',
    allStops: Stop[]
  ): Promise<void> => {
    if (!isReadyToBuild || startStopId === null || goalStopId === null) {
      setError('Выберите стартовую и конечную остановки');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const request: RoutePlanRequest = {
        cityId,
        datetime: new Date().toISOString(),
        startStopId,
        goalStopId,
        mode,
      };

      const response = await routeApi.buildOptimalRoute(request);

      if (response.status === 'ERROR') {
        throw new Error(response.error || 'Ошибка при построении маршрута');
      }

      // 🔥 ПАРСИМ СЕГМЕНТЫ: поддерживаем snake_case и camelCase
      const parsedSegments: RouteSegment[] = (response.segments || []).map((seg: any) => ({
        from_stop: seg.from_stop ?? seg.fromStop,
        to_stop: seg.to_stop ?? seg.toStop,
        route_id: seg.route_id ?? seg.routeId,
        dist_km: seg.dist_km ?? seg.distKm,
        travel_time_min: seg.travel_time_min ?? seg.travelTimeMin,
        load_from: seg.load_from ?? seg.loadFrom,
        load_to: seg.load_to ?? seg.loadTo,
      }));

      const startStop = allStops.find(s => s.id === startStopId) || null;
      const goalStop = allStops.find(s => s.id === goalStopId) || null;

      const routeResult: OptimalRouteResult = {
        response,
        segments: parsedSegments,
        startStop,
        goalStop,
        totalCostMinutes: response.total_cost_minutes ?? response.totalCostMinutes ?? 0,
        mode: response.mode,
      };

      // 🔍 Отладка
      console.log('✅ Route built:', {
        segmentsCount: routeResult.segments.length,
        firstSeg: routeResult.segments[0],
        stops: routeResult.response.stops,
      });

      setResult(routeResult);
    } catch (err: any) {
      setError(err.message || 'Не удалось построить маршрут');
      console.error('🔥 Route error:', err);
    } finally {
      setLoading(false);
    }
  }, [startStopId, goalStopId, isReadyToBuild]);

  return {
    loading,
    error,
    result,
    startStopId,
    goalStopId,
    setStartStop: setStartStopId,
    setGoalStop: setGoalStopId,
    clearSelection,
    buildRoute,
    clearResult,
    isReadyToBuild,
  };
};