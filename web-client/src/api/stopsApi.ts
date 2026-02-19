// src/api/stopsApi.ts
import apiClient from './client';
import type { Stop } from './types';

export interface StopRequest {
  url: string;
  address: string;
  count: number;
  velocity: number;
  load: number;
  cityId: number;
  lat: number;
  lng: number;
}

export interface StopResponse extends Stop {
  url?: string;
}

export interface StopStatsUpdateRequest {
  count: number;
  velocity: number;
  load: number;
}

export const stopsApi = {
  // Получить все остановки (для карты)
  getStops: async (): Promise<StopResponse[]> => {
    try {
      const response = await apiClient.get<{ stops: StopResponse[] }>('/stops');
      const stops = response.data.stops;
      
      return stops.map(stop => ({
        ...stop,
        coordinates: [stop.lng, stop.lat] as [number, number]
      }));
    } catch (error) {
      console.error('Error fetching stops:', error);
      throw error;
    }
  },

  // Получить остановки с URL (для Python)
  getStopsUrl: async (): Promise<StopResponse[]> => {
    try {
      const response = await apiClient.get<{ stops: StopResponse[] }>('/stops/url');
      return response.data.stops;
    } catch (error) {
      console.error('Error fetching stops with URL:', error);
      throw error;
    }
  },

  // Получить остановки по городу
  getStopsByCity: async (cityId: number): Promise<StopResponse[]> => {
    try {
      const response = await apiClient.get<{ stops: StopResponse[] }>(`/stops/${cityId}`);
      const stops = response.data.stops;
      
      return stops.map(stop => ({
        ...stop,
        coordinates: [stop.lng, stop.lat] as [number, number]
      }));
    } catch (error) {
      console.error(`Error fetching stops for city ${cityId}:`, error);
      throw error;
    }
  },

  // Создать остановку
  createStop: async (request: StopRequest): Promise<StopResponse> => {
    try {
      const response = await apiClient.post<StopResponse>('/stops', request);
      return response.data;
    } catch (error) {
      console.error('Error creating stop:', error);
      throw error;
    }
  },

  // Удалить остановку
  deleteStop: async (id: number): Promise<void> => {
    try {
      await apiClient.delete(`/stops/${id}`);
    } catch (error) {
      console.error(`Error deleting stop ${id}:`, error);
      throw error;
    }
  },

  // Обновить статистику остановки
  updateStopStats: async (
    id: number, 
    request: StopStatsUpdateRequest
  ): Promise<StopResponse> => {
    try {
      const response = await apiClient.patch<StopResponse>(`/stops/${id}`, request);
      return response.data;
    } catch (error) {
      console.error(`Error updating stop stats ${id}:`, error);
      throw error;
    }
  },
};