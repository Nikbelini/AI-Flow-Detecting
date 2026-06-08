import apiClient from '../client';
import type { RoutePlanRequest, RoutePlanResponse } from '../types/routes';
import type { AxiosResponse } from 'axios';

export const routeApi = {
  buildOptimalRoute: async (request: RoutePlanRequest): Promise<RoutePlanResponse> => {
    try {
      const response: AxiosResponse = await apiClient.post('/routes/build', request);
      
      // Явно копируем ВСЕ данные через spread
      const rawData = response.data;
      
      console.log("RAW DATA KEYS:", Object.keys(rawData));
      console.log("RAW DATA alternatives:", rawData.alternatives);
      
      // Создаем новый объект с явным указанием всех полей
      const data: RoutePlanResponse = {
        status: rawData.status,
        mode: rawData.mode,
        total_cost_minutes: rawData.total_cost_minutes,
        stops: rawData.stops,
        routes: rawData.routes,
        segments: rawData.segments,
        alternatives: rawData.alternatives,
        is_scheduled: rawData.is_scheduled,
        scheduled_message: rawData.scheduled_message,
        effective_datetime: rawData.effective_datetime,
        error: rawData.error,
      };
      
      console.log("COPIED DATA alternatives:", data.alternatives);
      
      if (!data.alternatives) {
         console.warn("alternatives missing after copy!", data);
      }

      return data;
    } catch (error: unknown) {
      console.error('Error building route:', error);
      
      const axiosError = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
      
      throw new Error(
        axiosError.response?.data?.error || 
        axiosError.response?.data?.message || 
        axiosError.message || 
        'Ошибка при построении маршрута'
      );
    }
  },
};

export const buildOptimalRoute = routeApi.buildOptimalRoute;