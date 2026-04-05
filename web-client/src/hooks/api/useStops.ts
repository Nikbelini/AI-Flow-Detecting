// src/hooks/api/useStops.ts
import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stopsApi, type StopResponse, type StopStatsUpdateRequest } from '../../api/stopsApi';

// Ключи для кэша
const STOPS_QUERY_KEY = ['stops'];
const STOPS_BY_CITY_KEY = (cityId: number) => ['stops', 'city', cityId];

export const useStops = () => {
  const queryClient = useQueryClient();

  // ========== GET ALL STOPS ==========
  const {
    data: stops,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: STOPS_QUERY_KEY,
    queryFn: () => stopsApi.getStops(),
    staleTime: 5 * 60 * 1000, // 5 минут
    gcTime: 10 * 60 * 1000,    // 10 минут
  });

  // ========== GET STOPS BY CITY ==========
  const getStopsByCity = useCallback(async (cityId: number) => {
    // Для единичных запросов используем fetchQuery
    return await queryClient.fetchQuery({
      queryKey: STOPS_BY_CITY_KEY(cityId),
      queryFn: () => stopsApi.getStopsByCity(cityId),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);

  // ========== CREATE STOP (мутация) ==========
  const createStopMutation = useMutation({
    mutationFn: (request: Parameters<typeof stopsApi.createStop>[0]) => 
      stopsApi.createStop(request),
    onSuccess: () => {
      // Инвалидируем кэш, чтобы данные обновились
      queryClient.invalidateQueries({ queryKey: STOPS_QUERY_KEY });
    },
  });

  // ========== UPDATE STOP STATS (мутация) ==========
  const updateStopStatsMutation = useMutation({
    mutationFn: ({ id, request }: { id: number; request: StopStatsUpdateRequest }) =>
      stopsApi.updateStopStats(id, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOPS_QUERY_KEY });
    },
  });

  // Обёртки для сохранения API (как было раньше)
  const getStops = useCallback(async () => {
    if (stops) return stops;
    return await refetch();
  }, [stops, refetch]);

  const createStop = useCallback(async (request: Parameters<typeof stopsApi.createStop>[0]) => {
    return await createStopMutation.mutateAsync(request);
  }, [createStopMutation]);

  const updateStopStats = useCallback(async (id: number, request: StopStatsUpdateRequest) => {
    return await updateStopStatsMutation.mutateAsync({ id, request });
  }, [updateStopStatsMutation]);

  // Формируем error в нужном формате
  const error = queryError instanceof Error ? queryError.message : (queryError as string) || null;

  return {
    loading,
    error,
    stops,
    getStops,
    getStopsByCity,
    createStop,
    updateStopStats,
  };
};