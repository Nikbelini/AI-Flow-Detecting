import apiClient from '../client';
import type {
    Route,
    RouteStop,
    RouteCreateRequest,
    RouteUpdateRequest,
    RouteSearchRequest,
    RouteStopRequest,
    RouteDirectionsResponse
} from '../types';

export const routesApi = {
  // Получить все маршруты
  getAllRoutes: async (): Promise<Route[]> => {
    try {
      const response = await apiClient.get<Route[]>('/routes');
      return response.data;
    } catch (error) {
      console.error('Error fetching routes:', error);
      throw error;
    }
  },

  // Получить маршрут по ID
  getRouteById: async (id: number): Promise<Route> => {
    try {
      const response = await apiClient.get<Route>(`/routes/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching route ${id}:`, error);
      throw error;
    }
  },

  // Создать маршрут
  createRoute: async (request: RouteCreateRequest): Promise<Route> => {
    try {
      const response = await apiClient.post<Route>('/routes', request);
      return response.data;
    } catch (error) {
      console.error('Error creating route:', error);
      throw error;
    }
  },

  // Обновить маршрут
  updateRoute: async (id: number, request: RouteUpdateRequest): Promise<Route> => {
    try {
      const response = await apiClient.put<Route>(`/routes/${id}`, request);
      return response.data;
    } catch (error) {
      console.error(`Error updating route ${id}:`, error);
      throw error;
    }
  },

  // Удалить маршрут
  deleteRoute: async (id: number): Promise<void> => {
    try {
      await apiClient.delete(`/routes/${id}`);
    } catch (error) {
      console.error(`Error deleting route ${id}:`, error);
      throw error;
    }
  },

  // Поиск маршрутов
  searchRoutes: async (request: RouteSearchRequest): Promise<Route[]> => {
    try {
      const response = await apiClient.post<Route[]>('/routes/search', request);
      return response.data;
    } catch (error) {
      console.error('Error searching routes:', error);
      throw error;
    }
  },

  // Получить маршруты по остановке
  getRoutesByStop: async (stopId: number): Promise<Route[]> => {
    try {
      const response = await apiClient.get<Route[]>(`/routes/by-stop/${stopId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching routes for stop ${stopId}:`, error);
      throw error;
    }
  },

  // Получить остановки маршрута
  getRouteStops: async (routeId: number, direction?: string): Promise<RouteStop[]> => {
    try {
      const url = direction 
        ? `/routes/${routeId}/stops?direction=${direction}`
        : `/routes/${routeId}/stops`;
      
      const response = await apiClient.get<RouteStop[]>(url);
      return response.data;
    } catch (error) {
      console.error(`Error fetching stops for route ${routeId}:`, error);
      throw error;
    }
  },

  // Получить информацию об остановке в маршрутах
  getStopRoutes: async (stopId: number): Promise<RouteStop[]> => {
    try {
      const response = await apiClient.get<RouteStop[]>(`/routes/stops/${stopId}/routes-info`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching route info for stop ${stopId}:`, error);
      throw error;
    }
  },

  // Обновить остановки маршрута
  updateRouteStops: async (routeId: number, stops: RouteStopRequest[]): Promise<Route> => {
    try {
      const response = await apiClient.put<Route>(`/routes/${routeId}/stops`, stops);
      return response.data;
    } catch (error) {
      console.error(`Error updating stops for route ${routeId}:`, error);
      throw error;
    }
  },

  // Изменить активность маршрута
  toggleRouteActive: async (routeId: number, active: boolean): Promise<Route> => {
    try {
      const response = await apiClient.patch<Route>(
        `/routes/${routeId}/activate?active=${active}`
      );
      return response.data;
    } catch (error) {
      console.error(`Error toggling route ${routeId} active status:`, error);
      throw error;
    }
  },

  // Получить маршруты по городу
  getRoutesByCity: async (
    cityId: number, 
    transportType?: string, 
    activeOnly?: boolean
  ): Promise<Route[]> => {
    try {
      let url = `/routes/city/${cityId}`;
      const params = new URLSearchParams();
      
      if (transportType) params.append('transportType', transportType);
      if (activeOnly !== undefined) params.append('activeOnly', activeOnly.toString());
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await apiClient.get<Route[]>(url);
      return response.data;
    } catch (error) {
      console.error(`Error fetching routes for city ${cityId}:`, error);
      throw error;
    }
  },

  // Получить направления маршрута
  getRouteDirections: async (routeId: number): Promise<RouteDirectionsResponse> => {
    try {
      const response = await apiClient.get<RouteDirectionsResponse>(
        `/routes/${routeId}/directions`
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching directions for route ${routeId}:`, error);
      throw error;
    }
  },
};