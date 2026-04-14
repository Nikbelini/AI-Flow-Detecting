import { useState, useCallback } from "react";
import { stopsApi, type StopStatsUpdateRequest } from "../../api/endpoints/stopsApi";
import type { Stop } from "../../api/types";

export const useStops = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // добавили локальное состояние stops
  const [stops, setStops] = useState<Stop[]>([]);

  const getStops = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await stopsApi.getStops();
      setStops(data);
      return data;
    } catch (err: any) {
      setError(err.message || "Failed to fetch stops");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getStopsByCity = useCallback(async (cityId: number) => {
    setLoading(true);
    setError(null);

    try {
      const data = await stopsApi.getStopsByCity(cityId);
      setStops(data);
      return data;
    } catch (err: any) {
      setError(err.message || "Failed to fetch stops for city");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createStop = useCallback(async (request: Parameters<typeof stopsApi.createStop>[0]) => {
    setLoading(true);
    setError(null);

    try {
      const created = await stopsApi.createStop(request);

      // добавляем в список
      setStops((prev) => [...prev, created]);

      return created;
    } catch (err: any) {
      setError(err.message || "Failed to create stop");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // updateStop - аккуратно, если ручки нет -> fallback на updateStopStats
  const updateStop = useCallback(async (id: number, request: any) => {
    setLoading(true);
    setError(null);

    try {
      // если существует ручка updateStop — используем
      const apiAny: any = stopsApi;

      let updated: Stop;

      if (typeof apiAny.updateStop === "function") {
        updated = await apiAny.updateStop(id, request);
      } else {
        // fallback (если нет updateStop) — обновляем stats
        updated = await stopsApi.updateStopStats(id, request as StopStatsUpdateRequest);
      }

      setStops((prev) =>
        prev.map((s) => (Number(s.id) === Number(id) ? updated : s))
      );

      return updated;
    } catch (err: any) {
      setError(err.message || "Failed to update stop");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // deleteStop - если ручки нет -> просто удаляем локально (иначе запрос)
  const deleteStop = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);

    try {
      const apiAny: any = stopsApi;

      if (typeof apiAny.deleteStop === "function") {
        await apiAny.deleteStop(id);
      }

      setStops((prev) => prev.filter((s) => Number(s.id) !== Number(id)));

      return true;
    } catch (err: any) {
      setError(err.message || "Failed to delete stop");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStopStats = useCallback(async (id: number, request: StopStatsUpdateRequest) => {
    setLoading(true);
    setError(null);

    try {
      const updated = await stopsApi.updateStopStats(id, request);

      // синхронизируем stops
      setStops((prev) =>
        prev.map((s) => (Number(s.id) === Number(id) ? updated : s))
      );

      return updated;
    } catch (err: any) {
      setError(err.message || "Failed to update stop stats");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // старое
    loading,
    error,
    getStops,
    getStopsByCity,
    createStop,
    updateStopStats,

    //  добавили новое (для AnalyticsPage)
    stops,
    isLoading: loading,
    updateStop,
    deleteStop,
    setStops, // иногда полезно
  };
};