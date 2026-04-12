import apiClient from '../client';
import type { Stop } from '../types';

export const getMarkers = async (cityId: number): Promise<Stop[]> => {
  try {
    const response = await apiClient.get<{ stops: Stop[] }>(`/stops?cityId=${cityId}`);
    
    return response.data.stops.map(stop => ({
      ...stop,
      id: Number(stop.id),
      lat: Number(stop.lat),
      lng: Number(stop.lng),
      cityId: cityId,
      coordinates: [stop.lng, stop.lat] as [number, number]
    }));
  } catch (error) {
    console.error('Error fetching markers:', error);
    throw error;
  }
};