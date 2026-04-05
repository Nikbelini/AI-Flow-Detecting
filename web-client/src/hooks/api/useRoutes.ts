// src/hooks/api/useRoutes.ts
import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { routesApi } from '../../api/routesApi';
import type {
  RouteCreateRequest,
  RouteSearchRequest,
  RouteStopRequest
} from '../../api/types';

const ROUTES_QUERY_KEY = ['routes'];
const ROUTE_BY_ID_KEY = (id: number) => ['routes', id];

export const useRoutes = () => {
  const queryClient = useQueryClient();

  // ========== GET ALL ROUTES ==========
  const {
    data: routes,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ROUTES_QUERY_KEY,
    queryFn: () => routesApi.getAllRoutes(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // ========== GET ROUTE BY ID ==========
  const getRouteById = useCallback(async (id: number) => {
    return await queryClient.fetchQuery({
      queryKey: ROUTE_BY_ID_KEY(id),
      queryFn: () => routesApi.getRouteById(id),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);

  // ========== CREATE ROUTE (мутация) ==========
  const createRouteMutation = useMutation({
    mutationFn: (request: RouteCreateRequest) => routesApi.createRoute(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTES_QUERY_KEY });
    },
  });

  // ========== DELETE ROUTE (НОВАЯ МУТАЦИЯ) ==========
  const deleteRouteMutation = useMutation({
    mutationFn: (id: number) => routesApi.deleteRoute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTES_QUERY_KEY });
    },
  });

  // ========== UPDATE ROUTE STOPS ==========
  const updateRouteStopsMutation = useMutation({
    mutationFn: ({ routeId, stops }: { routeId: number; stops: RouteStopRequest[] }) =>
      routesApi.updateRouteStops(routeId, stops),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTES_QUERY_KEY });
    },
  });

  // Обёртки для сохранения API
  const getAllRoutes = useCallback(async () => {
    if (routes) return routes;
    return await refetch();
  }, [routes, refetch]);

  const createRoute = useCallback(async (request: RouteCreateRequest) => {
    return await createRouteMutation.mutateAsync(request);
  }, [createRouteMutation]);

  const deleteRoute = useCallback(async (id: number) => {
    return await deleteRouteMutation.mutateAsync(id);
  }, [deleteRouteMutation]);

  const updateRouteStops = useCallback(async (routeId: number, stops: RouteStopRequest[]) => {
    return await updateRouteStopsMutation.mutateAsync({ routeId, stops });
  }, [updateRouteStopsMutation]);

  const error = queryError instanceof Error ? queryError.message : (queryError as string) || null;

  return {
    loading,
    error,
    routes,
    getAllRoutes,
    getRouteById,
    createRoute,
    deleteRoute,        // ← НОВАЯ ФУНКЦИЯ
    searchRoutes: routesApi.searchRoutes,
    updateRouteStops,
  };
};