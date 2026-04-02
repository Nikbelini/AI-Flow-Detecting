import type { Stop } from '../../api/types/stop';
import { baseUrl } from './env';

export const getMarkers = async (cityId?: number): Promise<Stop[]> => {
  try {
    const url = cityId 
      ? `${baseUrl}/stops?cityId=${cityId}` 
      : `${baseUrl}/stops`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    const rawData = result.stops || result || [];
    
    return rawData.map((item: any) => {
      let lat = Number(item.lat ?? item.latitude);
      let lng = Number(item.lng ?? item.longitude);
      
      if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
        console.warn('⚠️ Coords swapped in API response, auto-fixing:', { lat, lng });
        [lat, lng] = [lng, lat];
      }
      
      return {
        ...item,
        id: Number(item.id),
        lat,
        lng,
        cityId: item.cityId,
      };
    });
  } catch (error) {
    console.error('❌ Error fetching markers:', error);
    return [];
  }
};