import { useState, useCallback, useMemo } from "react";
import type { Stop } from "../../api/types/stop";
import type { RoutePlanRequest, RoutePlanResponse, RouteSegment,
  RouteMode, OptimalRouteResult, AlternativeResult } from "../../api/types/routes";
import { routeApi } from "../../api/endpoints/routePlannerApi";
import dayjs from "dayjs";

export interface UseOptimalRouteReturn {
  loading: boolean;
  error: string | null;
  result: OptimalRouteResult | null;
  startStopId: number | null;
  goalStopId: number | null;
  selectedAlternativeIndex: number;
  activeSegments: RouteSegment[];
  setStartStop: (stopId: number | null) => void;
  setGoalStop: (stopId: number | null) => void;
  selectAlternative: (index: number) => void;
  clearSelection: () => void;
  clearResult: () => void;
  buildRoute: (
    cityId: number,
    mode: RouteMode,
    allStops: Stop[],
    scheduledFor?: string | null
  ) => Promise<void>;
  isReadyToBuild: boolean;
}

type RawSegment = Record<string, unknown>;

function parseSegments(raw: RawSegment[]): RouteSegment[] {
  return (raw ?? [])
    .map((seg): RouteSegment | null => {
      const from = (seg.from_stop ?? seg.fromStop) as number | undefined;
      const to = (seg.to_stop ?? seg.toStop) as number | undefined;
      const routeId = (seg.route_id ?? seg.routeId) as number | undefined;
      const dist = (seg.dist_km ?? seg.distKm) as number | undefined;

      if (
        typeof from !== "number" ||
        typeof to !== "number" ||
        typeof routeId !== "number" ||
        typeof dist !== "number"
      ) {
        return null;
      }

      return {
        from_stop: from,
        to_stop: to,
        route_id: routeId,
        dist_km: dist,
        travel_time_min: (seg.travel_time_min ?? seg.travelTimeMin) as number | undefined,
        load_from: (seg.load_from ?? seg.loadFrom) as number | undefined,
        load_to: (seg.load_to ?? seg.loadTo) as number | undefined,
        route_name: String(seg.route_name ?? seg.routeName ?? ""),
        route_number: String(seg.route_number ?? seg.routeNumber ?? ""),
      };
    })
    .filter((x): x is RouteSegment => x !== null);
}

function parseAlternatives(raw: unknown[]): AlternativeResult[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((alt: unknown) => {
    const a = alt as Record<string, unknown>;
    return {
      label: String(a.label ?? ""),
      modeUsed: String(a.mode_used ?? a.modeUsed ?? "FASTEST") as RouteMode,
      totalCostMinutes: Number(a.total_cost_minutes ?? a.totalCostMinutes ?? 0),
      stops: (a.stops as number[]) ?? [],
      routes: (a.routes as (number | null)[]) ?? [],
      segments: parseSegments(((a.segments as RawSegment[]) ?? []) as RawSegment[]),
    };
  });
}


export const useOptimalRoute = (): UseOptimalRouteReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimalRouteResult | null>(null);
  const [startStopId, setStartStopId] = useState<number | null>(null);
  const [goalStopId, setGoalStopId] = useState<number | null>(null);
  const [selectedAlternativeIndex, setSelectedAlternativeIndex] = useState<number>(0);

  const clearSelection = useCallback(() => {
    setStartStopId(null);
    setGoalStopId(null);
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
    setSelectedAlternativeIndex(0);
  }, []);

  const selectAlternative = useCallback((index: number) => {
    setSelectedAlternativeIndex(index);
  }, []);

  const isReadyToBuild =
    startStopId !== null && goalStopId !== null && startStopId !== goalStopId;

  const activeSegments: RouteSegment[] = useMemo(() => {
    if (!result) return [];
    if (result.alternatives && result.alternatives[selectedAlternativeIndex]) {
      return result.alternatives[selectedAlternativeIndex].segments;
    }
    return result.segments;
  }, [result, selectedAlternativeIndex]);

  const buildRoute = useCallback(
    async (
      cityId: number,
      mode: RouteMode,
      allStops: Stop[],
      scheduledFor?: string | null
    ): Promise<void> => {
      if (!isReadyToBuild || startStopId === null || goalStopId === null) {
        setError("Выберите стартовую и конечную остановки");
        return;
      }

      setLoading(true);
      setError(null);
      setResult(null);
      setSelectedAlternativeIndex(0);

      try {
        // 1. Текущее время для параметра datetime (когда мы запрашиваем маршрут)
        // Отправляем в формате ISO, но без Z, чтобы бэкенд считал это локальным временем сервера/города
        const nowLocal = dayjs().format("YYYY-MM-DDTHH:mm:ss");

        // 2. Время отправления (если выбрано)
        let scheduledForFormatted: string | undefined = undefined;
        if (scheduledFor) {
          // Если пользователь выбрал время, отправляем его точно в таком же формате
          // Важно: dayjs(scheduledFor) уже содержит правильный часовой пояс из DatePicker
          scheduledForFormatted = dayjs(scheduledFor).format("YYYY-MM-DDTHH:mm:ss");
        }

        const request: RoutePlanRequest = {
          cityId,
          datetime: nowLocal, 
          startStopId,
          goalStopId,
          mode,
          ...(scheduledForFormatted ? { scheduledFor: scheduledForFormatted } : {}),
        };

        console.log("[Route] Request:", request);

        const response: RoutePlanResponse = await routeApi.buildOptimalRoute(request);

        console.log("[Route] Response:", response);

        if (response.status === "ERROR") {
          throw new Error(response.error || "Ошибка при построении маршрута");
        }

        const parsedSegments = parseSegments(
          (response.segments as unknown as RawSegment[]) ?? []
        );

        const rawAlternatives =
            ((response as unknown as Record<string, unknown>)["alternatives"] as unknown[]) ?? [];

        const parsedAlternatives = parseAlternatives(rawAlternatives);

        console.log("[Route] Segments:", parsedSegments.length, "Alternatives:", parsedAlternatives.length);

        const startStop = allStops.find((s) => s.id === startStopId) ?? null;
        const goalStop = allStops.find((s) => s.id === goalStopId) ?? null;

        const finalResult: OptimalRouteResult = {
          response,
          segments: parsedSegments,
          startStop,
          goalStop,
          totalCostMinutes: response.total_cost_minutes ?? 0,
          mode: response.mode,
          isScheduled: response.is_scheduled ?? false,
          scheduledMessage: response.scheduled_message ?? null,
          effectiveDatetime: response.effective_datetime ?? null,
          alternatives: parsedAlternatives,
        };

        setResult(finalResult);
      } catch (err: unknown) {
        console.error("[Route] Error:", err);
        setError(
          err instanceof Error ? err.message : "Не удалось построить маршрут"
        );
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
    selectedAlternativeIndex,
    activeSegments,
    setStartStop: setStartStopId,
    setGoalStop: setGoalStopId,
    selectAlternative,
    clearSelection,
    buildRoute,
    clearResult,
    isReadyToBuild,
  };
};