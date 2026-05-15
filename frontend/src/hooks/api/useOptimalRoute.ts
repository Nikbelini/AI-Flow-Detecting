import { useState, useCallback } from "react";
import type {
  RoutePlanRequest,
  RoutePlanResponse,
  RouteSegment,
  RouteMode,
} from "../../api/types/routes";
import type { Stop } from "../../api/types";
import { routeApi } from "../../api/endpoints/routePlannerApi";

export interface OptimalRouteResult {
  response: RoutePlanResponse;
  segments: RouteSegment[];
  startStop: Stop | null;
  goalStop: Stop | null;
  totalCostMinutes: number;
  mode: RouteMode;
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
  clearResult: () => void;

  buildRoute: (
    cityId: number,
    mode: RouteMode,
    allStops: Stop[]
  ) => Promise<void>;

  isReadyToBuild: boolean;
}

type RawSegment = {
  from_stop?: number;
  fromStop?: number;

  to_stop?: number;
  toStop?: number;

  route_id?: number;
  routeId?: number;

  dist_km?: number;
  distKm?: number;

  travel_time_min?: number;
  travelTimeMin?: number;

  load_from?: number;
  loadFrom?: number;

  load_to?: number;
  loadTo?: number;

  route_name?: string;
  routeName?: string;

  route_number?: string;
  routeNumber?: string;
};

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

  const isReadyToBuild =
    startStopId !== null &&
    goalStopId !== null &&
    startStopId !== goalStopId;

  const buildRoute = useCallback(
    async (cityId: number, mode: RouteMode, allStops: Stop[]): Promise<void> => {
      if (!isReadyToBuild || startStopId === null || goalStopId === null) {
        setError("Выберите стартовую и конечную остановки");
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

        const response: RoutePlanResponse = await routeApi.buildOptimalRoute(
          request
        );

        if (response.status === "ERROR") {
          throw new Error(response.error || "Ошибка при построении маршрута");
        }

        const rawSegments: RawSegment[] = Array.isArray(response.segments)
          ? (response.segments as unknown as RawSegment[])
          : [];

        const parsedSegments: RouteSegment[] = rawSegments
          .map((seg) => {
            const from = seg.from_stop ?? seg.fromStop;
            const to = seg.to_stop ?? seg.toStop;
            const routeId = seg.route_id ?? seg.routeId;
            const dist = seg.dist_km ?? seg.distKm;

            if (
              typeof from !== "number" ||
              typeof to !== "number" ||
              typeof routeId !== "number" ||
              typeof dist !== "number"
            ) {
              return null;
            }

            const routeName = seg.route_name ?? seg.routeName ?? "";
            const routeNumber = seg.route_number ?? seg.routeNumber ?? "";

            return {
              from_stop: from,
              to_stop: to,
              route_id: routeId,
              dist_km: dist,
              travel_time_min: seg.travel_time_min ?? seg.travelTimeMin,
              load_from: seg.load_from ?? seg.loadFrom,
              load_to: seg.load_to ?? seg.loadTo,
              route_name: routeName,
              route_number: routeNumber,
            };
          })
          .filter((x): x is RouteSegment => x !== null);

        const startStop = allStops.find((s) => s.id === startStopId) || null;
        const goalStop = allStops.find((s) => s.id === goalStopId) || null;

        setResult({
          response,
          segments: parsedSegments,
          startStop,
          goalStop,
          totalCostMinutes: response.total_cost_minutes ?? 0,
          mode: response.mode,
        });
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Не удалось построить маршрут");
        }
      } finally {
        setLoading(false);
      }
    },
    [startStopId, goalStopId, isReadyToBuild]
  );

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