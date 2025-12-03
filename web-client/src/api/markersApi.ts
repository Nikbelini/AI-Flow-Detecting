// src/api/markersApi.ts
import apiClient from './client';

// Экспортируем интерфейс
export type Marker = {
  id: number;
  address: string;
  url?: string;
  count: number;
  velocity: number;
  load: number;
  lat: number;
  lng: number;
  coordinates?: [number, number];
};

export interface MarkersResponse {
  stops: Marker[];
}

export const getMarkers = async (): Promise<Marker[]> => {
  try {
    const response = await apiClient.get<MarkersResponse>('/stops');
    const markers = response.data.stops;
    
    return markers.map(marker => ({
      ...marker,
      coordinates: [marker.lng, marker.lat] as [number, number]
    }));
    
  } catch (error) {
    console.error('Error fetching markers:', error);
    throw error;
  }
};