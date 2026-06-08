import { useState, useCallback } from "react";
import { routesApi } from "../../api/endpoints/routesApi";
import type { Route, RouteCreateRequest, RouteSearchRequest, RouteStopRequest } from "../../api/types";

type RouteUpdateRequest = Partial<Omit<Route, "id">>;

interface RoutesApiExtended {
  getAllRoutes: () => Promise<Route[]>;
  getRouteById: (id: number) => Promise<Route>;
  createRoute: (request: RouteCreateRequest) => Promise<Route>;
  searchRoutes: (request: RouteSearchRequest) => Promise<Route[]>;
  updateRouteStops: (routeId: number, stops: RouteStopRequest[]) => Promise<Route>;
  updateRoute?: (id: number, request: RouteUpdateRequest) => Promise<Route>;
  deleteRoute?: (id: number) => Promise<void>;
}

const api = routesApi as RoutesApiExtended;

export const useRoutes = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);

  const getAllRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await routesApi.getAllRoutes();
      setRoutes(data);
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch routes";
      setError(message);
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch route";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createRoute = useCallback(async (request: RouteCreateRequest) => {
    setLoading(true);
    setError(null);
    try {
      const created = await routesApi.createRoute(request);
      setRoutes((prev) => [...prev, created]);
      return created;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create route";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchRoutes = useCallback(async (request: RouteSearchRequest) => {
    setLoading(true);
    setError(null);
    try {
      const data = await routesApi.searchRoutes(request);
      setRoutes(data);
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to search routes";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateRouteStops = useCallback(async (routeId: number, stops: RouteStopRequest[]) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await routesApi.updateRouteStops(routeId, stops);
      setRoutes((prev) =>
        prev.map((r) => (Number(r.id) === Number(routeId) ? updated : r))
      );
      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update route stops";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateRoute = useCallback(async (routeId: number, request: RouteUpdateRequest) => {
    setLoading(true);
    setError(null);
    try {
      let updated: Route;
      if (api.updateRoute) {
        updated = await api.updateRoute(routeId, request);
      } else {
        const existing = routes.find((r) => Number(r.id) === Number(routeId));
        if (!existing) throw new Error("Route not found");
        updated = { ...existing, ...request };
      }
      setRoutes((prev) =>
        prev.map((r) => (Number(r.id) === Number(routeId) ? updated : r))
      );
      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update route";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [routes]);

  const deleteRoute = useCallback(async (routeId: number) => {
    setLoading(true);
    setError(null);
    try {
      if (api.deleteRoute) {
        await api.deleteRoute(routeId);
      }
      setRoutes((prev) => prev.filter((r) => Number(r.id) !== Number(routeId)));
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete route";
      setError(message);
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
    routes,
    isLoading: loading,
    updateRoute,
    deleteRoute,
    setRoutes,
  };
};