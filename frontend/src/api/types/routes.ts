import type { Stop } from "./stop";

export type RouteMode = "FASTEST" | "LESS_CROWDED" | "MIN_TRANSFERS";

export interface RoutePlanRequest {
  cityId: number;
  datetime: string;
  startStopId: number;
  goalStopId: number;
  mode: RouteMode;
  scheduledFor?: string;
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

// Сырой ответ от сервера для альтернативы
export interface RouteAlternativeRaw {
  label: string;
  mode_used: RouteMode;
  total_cost_minutes: number;
  stops: number[];
  routes: Array<number | null>;
  segments: RouteSegment[];
}

export interface RoutePlanResponse {
  status: "SUCCESS" | "ERROR";
  mode: RouteMode;
  total_cost_minutes: number;
  stops: number[];
  routes: Array<number | null>;
  segments: RouteSegment[];
  alternatives?: RouteAlternativeRaw[];
  is_scheduled?: boolean;
  scheduled_message?: string | null;
  effective_datetime?: string | null;
  error?: string | null;
}

export interface AlternativeResult {
  label: string;
  modeUsed: RouteMode;
  totalCostMinutes: number;
  stops: number[];
  routes: (number | null)[];
  segments: RouteSegment[];
}

export interface OptimalRouteResult {
  response: RoutePlanResponse;
  segments: RouteSegment[];
  startStop: Stop | null;
  goalStop: Stop | null;
  totalCostMinutes: number;
  mode: RouteMode;
  isScheduled: boolean;
  scheduledMessage: string | null;
  effectiveDatetime: string | null;
  alternatives: AlternativeResult[];
}