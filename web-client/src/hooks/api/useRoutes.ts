// src/hooks/api/useRoutes.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { routesApi } from '../../api/routesApi';
import type {
  RouteCreateRequest,
  RouteSearchRequest,
  RouteStopRequest,
  RouteUpdateRequest
} from '../../api/types';

// Ключи кэша
const ROUTES_QUERY_KEY = ['routes'] as const;

export const useRoutes = () => {
  const queryClient = useQueryClient();

  // ---- QUERIES (автоматическая загрузка!) ----
  const getAllRoutesQuery = useQuery({
    queryKey: ROUTES_QUERY_KEY,
    queryFn: () => routesApi.getAllRoutes(),
    staleTime: 1000 * 60 * 5,      // 5 минут свежести
    gcTime: 1000 * 60 * 10,        // 10 минут в кэше
    retry: 1,
  });

  // ---- MUTATIONS ----
  const createRouteMutation = useMutation({
    mutationFn: (request: RouteCreateRequest) => routesApi.createRoute(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTES_QUERY_KEY });
    },
  });

  const updateRouteMutation = useMutation({
    mutationFn: ({ id, request }: { id: number; request: RouteUpdateRequest }) =>
      routesApi.updateRoute(id, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTES_QUERY_KEY });
    },
  });

  const deleteRouteMutation = useMutation({
    mutationFn: (id: number) => routesApi.deleteRoute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTES_QUERY_KEY });
    },
  });

  const updateRouteStopsMutation = useMutation({
    mutationFn: ({ routeId, stops }: { routeId: number; stops: RouteStopRequest[] }) =>
      routesApi.updateRouteStops(routeId, stops),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTES_QUERY_KEY });
    },
  });

  const toggleRouteActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      routesApi.toggleRouteActive(id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTES_QUERY_KEY });
    },
  });

  // ---- УПРОЩЁННЫЙ API ----
  const getAllRoutes = async () => {
    return getAllRoutesQuery.data ?? [];
  };

  const getRouteById = async (id: number) => {
    const routes = getAllRoutesQuery.data ?? [];
    return routes.find(r => r.id === id);
  };

  const createRoute = async (request: RouteCreateRequest) => {
    return await createRouteMutation.mutateAsync(request);
  };

  const searchRoutes = async (request: RouteSearchRequest) => {
    const routes = getAllRoutesQuery.data ?? [];
    // Простой поиск по номеру
    return routes.filter(r => 
      r.number.toLowerCase().includes(request.query?.toLowerCase() || '')
    );
  };

  const updateRouteStops = async (routeId: number, stops: RouteStopRequest[]) => {
    return await updateRouteStopsMutation.mutateAsync({ routeId, stops });
  };

  const updateRoute = async (id: number, request: RouteUpdateRequest) => {
    return await updateRouteMutation.mutateAsync({ id, request });
  };

  const deleteRoute = async (id: number) => {
    await deleteRouteMutation.mutateAsync(id);
  };

  const toggleRouteActive = async (id: number, active: boolean) => {
    return await toggleRouteActiveMutation.mutateAsync({ id, active });
  };

  return {
    // Данные
    routes: getAllRoutesQuery.data ?? [],
    isLoading: getAllRoutesQuery.isLoading,
    isError: getAllRoutesQuery.isError,
    error: getAllRoutesQuery.error,
    
    // Функции
    getAllRoutes,
    getRouteById,
    createRoute,
    searchRoutes,
    updateRouteStops,
    updateRoute,
    deleteRoute,
    toggleRouteActive,
    
    // Для совместимости
    loading: getAllRoutesQuery.isLoading,
  };
};