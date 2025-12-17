// Интерфейс для города
export interface City {
  id: number;
  name: string;
  country: string;
  timezone: string;
  centerLat: number;
  centerLng: number;
  zoomLevel: number;
}
