// src/api/markersApi.ts
import apiClient from './client';
import type { Stop } from './types';

export const getMarkers = async (): Promise<Stop[]> => {
  try {
    const response = await apiClient.get<{ stops: Stop[] }>('/stops');
    return response.data.stops.map(stop => ({
      ...stop,
      coordinates: [stop.lng, stop.lat]
    }));
  } catch (error) {
    console.error('Error fetching markers:', error);
    throw error;
  }
};