// src/hooks/api/useStops.ts
import { useState, useCallback } from 'react';
import { stopsApi, type StopResponse, type StopStatsUpdateRequest } from '../../api/stopsApi';

export const useStops = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getStops = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stops = await stopsApi.getStops();
      return stops;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch stops');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getStopsByCity = useCallback(async (cityId: number) => {
    setLoading(true);
    setError(null);
    try {
      const stops = await stopsApi.getStopsByCity(cityId);
      return stops;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch stops for city');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createStop = useCallback(async (request: Parameters<typeof stopsApi.createStop>[0]) => {
    setLoading(true);
    setError(null);
    try {
      const stop = await stopsApi.createStop(request);
      return stop;
    } catch (err: any) {
      setError(err.message || 'Failed to create stop');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStopStats = useCallback(async (id: number, request: StopStatsUpdateRequest) => {
    setLoading(true);
    setError(null);
    try {
      const stop = await stopsApi.updateStopStats(id, request);
      return stop;
    } catch (err: any) {
      setError(err.message || 'Failed to update stop stats');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStop = useCallback(async (id: number, request: any) => {
    setLoading(true);
    setError(null);
    try {
      const stop = await stopsApi.updateStop(id, request);
      return stop;
    } catch (err: any) {
      setError(err.message || 'Failed to update stop');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteStop = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await stopsApi.deleteStop(id);
    } catch (err: any) {
      setError(err.message || 'Failed to delete stop');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getStops,
    getStopsByCity,
    createStop,
    updateStopStats,
    updateStop,
    deleteStop,
  };
};