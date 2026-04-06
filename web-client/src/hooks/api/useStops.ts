// src/hooks/api/useStops.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stopsApi, type StopResponse, type StopStatsUpdateRequest } from '../../api/stopsApi';

// Ключи кэша
const STOPS_QUERY_KEY = ['stops'] as const;
const STOPS_BY_CITY_QUERY_KEY = (cityId: number) => ['stops', 'city', cityId] as const;

export const useStops = () => {
  const queryClient = useQueryClient();

  // ---- QUERIES (автоматическая загрузка!) ----
  const getStopsQuery = useQuery({
    queryKey: STOPS_QUERY_KEY,
    queryFn: () => stopsApi.getStops(),
    staleTime: 1000 * 60 * 5,      // 5 минут свежести
    gcTime: 1000 * 60 * 10,        // 10 минут в кэше
    retry: 1,
  });

  const getStopsByCity = (cityId: number) => {
    return useQuery({
      queryKey: STOPS_BY_CITY_QUERY_KEY(cityId),
      queryFn: () => stopsApi.getStopsByCity(cityId),
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      enabled: !!cityId,
    });
  };

  // ---- MUTATIONS ----
  const createStopMutation = useMutation({
    mutationFn: (request: Parameters<typeof stopsApi.createStop>[0]) => stopsApi.createStop(request),
    onSuccess: () => {
      // Инвалидируем кэш после успешного создания
      queryClient.invalidateQueries({ queryKey: STOPS_QUERY_KEY });
    },
  });

  const updateStopStatsMutation = useMutation({
    mutationFn: ({ id, request }: { id: number; request: StopStatsUpdateRequest }) =>
      stopsApi.updateStopStats(id, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOPS_QUERY_KEY });
    },
  });

  const updateStopMutation = useMutation({
    mutationFn: ({ id, request }: { id: number; request: any }) =>
      stopsApi.updateStop(id, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOPS_QUERY_KEY });
    },
  });

  const deleteStopMutation = useMutation({
    mutationFn: (id: number) => stopsApi.deleteStop(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STOPS_QUERY_KEY });
    },
  });

  // ---- УПРОЩЁННЫЙ API (для обратной совместимости) ----
  const getStops = async () => {
    // Просто возвращаем данные из кэша или ждём загрузки
    return getStopsQuery.data ?? [];
  };

  const createStop = async (request: Parameters<typeof stopsApi.createStop>[0]) => {
    return await createStopMutation.mutateAsync(request);
  };

  const updateStopStats = async (id: number, request: StopStatsUpdateRequest) => {
    return await updateStopStatsMutation.mutateAsync({ id, request });
  };

  const updateStop = async (id: number, request: any) => {
    return await updateStopMutation.mutateAsync({ id, request });
  };

  const deleteStop = async (id: number) => {
    await deleteStopMutation.mutateAsync(id);
  };

  return {
    // Данные
    stops: getStopsQuery.data ?? [],
    isLoading: getStopsQuery.isLoading,
    isError: getStopsQuery.isError,
    error: getStopsQuery.error,
    
    // Функции (совместимые со старым API)
    getStops,
    getStopsByCity,
    createStop,
    updateStopStats,
    updateStop,
    deleteStop,
    
    // Для совместимости со старым API (loading, error)
    loading: getStopsQuery.isLoading,
  };
};