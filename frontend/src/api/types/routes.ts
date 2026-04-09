export interface RoutePlanRequest {
  cityId: number;
  datetime: string;
  startStopId: number;
  goalStopId: number;
  mode?: 'FASTEST' | 'LESS_CROWDED' | 'MIN_TRANSFERS';
}

// Сегмент: разрешаем ОБА формата (snake_case от бэкенда + camelCase для TS)
export interface RouteSegment {
  from_stop?: number;
  fromStop?: number;
  to_stop?: number;
  toStop?: number;
  route_id?: number | null;
  routeId?: number | null;
  dist_km?: number;
  distKm?: number;
  travel_time_min?: number;
  travelTimeMin?: number;
  load_from?: number;
  loadFrom?: number;
  load_to?: number;
  loadTo?: number;
}

export interface RoutePlanResponse {
  status: 'SUCCESS' | 'ERROR';
  mode: string;
  total_cost_minutes?: number;
  totalCostMinutes?: number;
  stops: number[];
  routes: (number | null)[];
  segments: RouteSegment[];
  error?: string;
}