import { useState, useCallback } from "react";
import { routesApi } from "../../api/endpoints/routesApi";
import type {
  Route,
  RouteCreateRequest,
  RouteSearchRequest,
  RouteStopRequest
} from "../../api/types";

export const useRoutes = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // добавили локальное состояние routes
  const [routes, setRoutes] = useState<Route[]>([]);

  const getAllRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await routesApi.getAllRoutes();
      setRoutes(data);
      return data;
    } catch (err: any) {
      setError(err.message || "Failed to fetch routes");
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
      setError(err.message || "Failed to fetch route");
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

      // добавляем в список
      setRoutes((prev) => [...prev, created]);

      return created;
    } catch (err: any) {
      setError(err.message || "Failed to create route");
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
    } catch (err: any) {
      setError(err.message || "Failed to search routes");
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

      // обновляем список
      setRoutes((prev) =>
        prev.map((r) => (Number(r.id) === Number(routeId) ? updated : r))
      );

      return updated;
    } catch (err: any) {
      setError(err.message || "Failed to update route stops");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // updateRoute - если ручки нет, просто обновим локально
  const updateRoute = useCallback(async (routeId: number, request: any) => {
    setLoading(true);
    setError(null);

    try {
      const apiAny: any = routesApi;

      let updated: Route;

      if (typeof apiAny.updateRoute === "function") {
        updated = await apiAny.updateRoute(routeId, request);
      } else {
        // fallback: обновляем локально (чтобы UI не ломался)
        const existing = routes.find((r) => Number(r.id) === Number(routeId));
        updated = { ...(existing as any), ...request };
      }

      setRoutes((prev) =>
        prev.map((r) => (Number(r.id) === Number(routeId) ? updated : r))
      );

      return updated;
    } catch (err: any) {
      setError(err.message || "Failed to update route");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [routes]);

  // deleteRoute - если ручки нет, просто удаляем локально
  const deleteRoute = useCallback(async (routeId: number) => {
    setLoading(true);
    setError(null);

    try {
      const apiAny: any = routesApi;

      if (typeof apiAny.deleteRoute === "function") {
        await apiAny.deleteRoute(routeId);
      }

      setRoutes((prev) => prev.filter((r) => Number(r.id) !== Number(routeId)));

      return true;
    } catch (err: any) {
      setError(err.message || "Failed to delete route");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // старое
    loading,
    error,
    getAllRoutes,
    getRouteById,
    createRoute,
    searchRoutes,
    updateRouteStops,

    // новое для AnalyticsPage
    routes,
    isLoading: loading,
    updateRoute,
    deleteRoute,
    setRoutes,
  };
};