// src/api/types/index.ts

// Общие типы
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface City {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

export interface Stop {
  id: number;
  address: string;
  url?: string;
  count: number;
  velocity: number;
  load: number;
  cityId: number;
  lat: number;
  lng: number;
  coordinates?: [number, number];
}

// Типы для маршрутов
export type TransportType = 
  | 'BUS'
  | 'TROLLEYBUS'
  | 'TRAM'
  | 'MINIBUS'
  | 'METRO'
  | 'TRAIN';

export interface RouteStop {
  stopId: number;
  address: string;
  orderInRoute: number;
  direction: string;
  travelTimeToNext?: number;
  lat: number;
  lng: number;
  count: number;
  velocity: number;
  load: number;
}

export interface Route {
  id: number;
  number: string;
  name?: string;
  transportType: TransportType;
  isActive: boolean;
  cityId: number;
  cityName?: string;
  stops: RouteStop[];
  directionAName?: string;
  directionBName?: string;
  intervalMinutes?: number;
  operatingHours?: string;
}

export interface RouteCreateRequest {
  number: string;
  name?: string;
  transportType: TransportType;
  cityId: number;
  directionAName?: string;
  directionBName?: string;
  intervalMinutes?: number;
  operatingHours?: string;
  stops: RouteStopRequest[];
}

export interface RouteStopRequest {
  stopId: number;
  order: number;
  direction: string;
  travelTimeToNext?: number;
}

export interface RouteUpdateRequest {
  number?: string;
  name?: string;
  transportType?: TransportType;
  isActive?: boolean;
  directionAName?: string;
  directionBName?: string;
  intervalMinutes?: number;
  operatingHours?: string;
}

export interface RouteSearchRequest {
  cityId?: number;
  transportType?: TransportType;
  isActive?: boolean;
  search?: string;
}

// Типы для моделирования
export interface ModelingRequest {
  cityId: number;
  scenarioName: string;
  description?: string;
  parameters: Record<string, any>;
  durationHours?: number;
}

export interface ModelingResponse {
  success: boolean;
  simulationId: string;
  status: string;
  message?: string;
  timestamp: string;
  data?: Record<string, any>;
}

export interface SimulationStatusResponse {
  simulationId: string;
  status: string;
  message?: string;
  timestamp: string;
  results?: Record<string, any>;
}

export interface CityAnalysisRequest {
  cityId: number;
  startDate: string;
  endDate: string;
  includeWeather?: boolean;
  includeEvents?: boolean;
}

export interface CityAnalysisResponse {
  success: boolean;
  cityId: number;
  analysis: Record<string, any>;
  correlationAnalysis: Record<string, any>;
  timestamp: string;
}

export interface DemandPredictionRequest {
  cityId: number;
  startDate: string;
  endDate: string;
  includeWeather?: boolean;
  includeEvents?: boolean;
}

export interface DemandPredictionResponse {
  success: boolean;
  cityId: number;
  predictionRange: {
    start: string;
    end: string;
  };
  predictions: Record<string, any>;
  timestamp: string;
}

export interface RouteOptimizationRequest {
  cityId: number;
  optimizationGoals: string[];
  constraints?: Record<string, any>;
}

export interface RouteOptimizationResponse {
  success: boolean;
  cityId: number;
  currentAnalysis: Record<string, any>;
  recommendations: string[];
  optimizationGoals: string[];
  timestamp: string;
}

export interface ScenarioEvaluationRequest {
  cityId: number;
  name: string;
  changes: Record<string, any>;
  evaluationMetrics?: string[];
}

export interface ScenarioEvaluationResponse {
  success: boolean;
  scenarioName: string;
  comparison: Record<string, any>;
  estimatedImpact: Record<string, any>;
  timestamp: string;
}

export interface VisualizationRequest {
  cityId: number;
  types: string[];
  parameters?: Record<string, any>;
  formats?: string[];
}

export interface VisualizationResponse {
  success: boolean;
  visualizations: Record<string, any>;
  formats: string[];
  timestamp: string;
}

// Дополнительные типы
export interface RouteDirectionsResponse {
  routeId: number;
  routeNumber: string;
  routeName: string;
  directionAName: string;
  directionBName: string;
  directionA: RouteStop[];
  directionB: RouteStop[];
}