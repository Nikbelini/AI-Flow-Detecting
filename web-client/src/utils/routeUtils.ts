// src/utils/routeUtils.ts

// Функция для преобразования маршрута в GeoJSON LineString
export const routeToGeoJSON = (stops: any[]): any => {
  const coordinates = stops
    .sort((a, b) => a.orderInRoute - b.orderInRoute)
    .map(stop => [stop.lng, stop.lat]);

  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates
    },
    properties: {
      stopsCount: stops.length
    }
  };
};

// Функция для расчета расстояния между остановками
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1000; // Возвращаем в метрах
};

// Функция для форматирования времени в пути
export const formatTravelTime = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} мин`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours} ч ${mins} мин` : `${hours} ч`;
};