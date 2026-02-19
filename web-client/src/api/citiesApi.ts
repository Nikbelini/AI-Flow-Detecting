// src/api/citiesApi.ts
import apiClient from './client';
import type { City } from './types';

export interface CityRequest {
  name: string;
  lat: number;
  lng: number;
}

export interface CityResponse extends City {}

export const citiesApi = {
  // Получить все города
  getAllCities: async (): Promise<CityResponse[]> => {
    try {
      const response = await apiClient.get<CityResponse[]>('/cities');
      return response.data;
    } catch (error) {
      console.error('Error fetching cities:', error);
      throw error;
    }
  },

  // Создать город
  createCity: async (request: CityRequest): Promise<CityResponse> => {
    try {
      const response = await apiClient.post<CityResponse>('/cities', request);
      return response.data;
    } catch (error) {
      console.error('Error creating city:', error);
      throw error;
    }
  },

  // Получить город по ID
  getCityById: async (id: number): Promise<CityResponse> => {
    try {
      const response = await apiClient.get<CityResponse>(`/cities/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching city ${id}:`, error);
      throw error;
    }
  },
};