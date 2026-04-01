import { useState, useCallback } from 'react';
import { routesApi } from '../../api/endpoints/routesApi';
import type {
  RouteCreateRequest,
  RouteSearchRequest,
  RouteStopRequest
} from '../../api/types';

export const useRoutes = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAllRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      return await routesApi.getAllRoutes();
    } catch (err: any) {
      setError(err.message || 'Failed to fetch routes');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getRouteById = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      return await routesApi.getRouteById(id);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch route');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createRoute = useCallback(async (request: RouteCreateRequest) => {
    setLoading(true);
    setError(null);
    try {
      return await routesApi.createRoute(request);
    } catch (err: any) {
      setError(err.message || 'Failed to create route');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchRoutes = useCallback(async (request: RouteSearchRequest) => {
    setLoading(true);
    setError(null);
    try {
      return await routesApi.searchRoutes(request);
    } catch (err: any) {
      setError(err.message || 'Failed to search routes');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateRouteStops = useCallback(async (routeId: number, stops: RouteStopRequest[]) => {
    setLoading(true);
    setError(null);
    try {
      return await routesApi.updateRouteStops(routeId, stops);
    } catch (err: any) {
      setError(err.message || 'Failed to update route stops');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getAllRoutes,
    getRouteById,
    createRoute,
    searchRoutes,
    updateRouteStops,
  };
};