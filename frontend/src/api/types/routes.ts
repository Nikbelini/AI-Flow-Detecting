export type RouteMode = "FASTEST" | "LESS_CROWDED" | "MIN_TRANSFERS";

export interface RoutePlanRequest {
  cityId: number;
  datetime: string;
  startStopId: number;
  goalStopId: number;
  mode: RouteMode;
}

export interface RouteSegment {
  from_stop: number;
  to_stop: number;
  route_id: number;

  dist_km: number;
  travel_time_min?: number;

  load_from?: number;
  load_to?: number;

  route_name?: string;
  route_number?: string;
}

export interface RoutePlanResponse {
  status: "SUCCESS" | "ERROR";
  mode: RouteMode;
  total_cost_minutes: number;

  stops: number[];
  routes: Array<number | null>;
  segments: RouteSegment[];

  error?: string;
}