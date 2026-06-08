import type { Route } from ".";

// Интерфейс для остановки (с сервера)
export interface StopFromServer {
  id: number;
  name: string;
  lat: number;
  lng: number;
  address: string;
  city_id: number;
  passenger_count: number;
  load: number;
  velocity: number;
  created_at: string;
  updated_at: string;
}

// Интерфейс для остановки (для внутреннего использования)
export interface Stop {
  id: number;
  name: string;
  url?: string;
  latitude: number;
  longitude: number;
  coordinates: [number, number]; // [lng, lat] для Mapbox
  address: string;
  cityId: number;
  passengerCount: number;
  load: number;
  velocity: number;
  createdAt: Date;
  updatedAt: Date;

    // === Алгоритмические данные (отдельно) ===
  algorithmicCount?: number | null;
  algorithmicVelocity?: number | null;
  algorithmicLoad?: number | null;
  isMlFallback?: boolean;     // true = основные данные из ML
  hasAlgorithmicData?: boolean; // true = алгоритм дал прогноз
  
  // === Для маршрутов ===
  routes?: Route[]; // Опционально, можно грузить отдельно
}
