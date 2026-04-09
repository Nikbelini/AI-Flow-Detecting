import apiClient from '../client';
import type { RoutePlanRequest, RoutePlanResponse } from '../types/routes';

export const routeApi = {
  buildOptimalRoute: async (request: RoutePlanRequest): Promise<RoutePlanResponse> => {
    try {
      const response = await apiClient.post<RoutePlanResponse>('/routes/build', request);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error building route:', error);
      throw new Error(
        error.response?.data?.error || 
        error.response?.data?.message || 
        error.message || 
        'Ошибка при построении маршрута'
      );
    }
  },
};


export const buildOptimalRoute = routeApi.buildOptimalRoute;