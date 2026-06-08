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
  algorithmicCount: number;
  cityId: number;
  lat: number;
  lng: number;
  coordinates?: [number, number];
  
  name: string;
  passengerCount: number;
  createdAt: Date;
  updatedAt: Date;
  
  // === Алгоритмические данные (отдельно) ===
  algorithmicVelocity?: number | null;
  algorithmicLoad?: number | null;
  isMlFallback?: boolean;     // true = основные данные из ML
  hasAlgorithmicData?: boolean; // true = алгоритм дал прогноз
    
  // === Для маршрутов ===
  routes?: Route[]; // Опционально, можно грузить отдельно
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
  parameters: Record<string, unknown>;
  durationHours?: number;
}

export interface ModelingResponse {
  success: boolean;
  simulationId: string;
  status: string;
  message?: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface SimulationStatusResponse {
  simulationId: string;
  status: string;
  message?: string;
  timestamp: string;
  results?: Record<string, unknown>;
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
  analysis: Record<string, unknown>;
  correlationAnalysis: Record<string, unknown>;
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
  predictions: Record<string, unknown>;
  timestamp: string;
}

export interface RouteOptimizationRequest {
  cityId: number;
  optimizationGoals: string[];
  constraints?: Record<string, unknown>;
}

export interface RouteOptimizationResponse {
  success: boolean;
  cityId: number;
  currentAnalysis: Record<string, unknown>;
  recommendations: string[];
  optimizationGoals: string[];
  timestamp: string;
}

export interface ScenarioEvaluationRequest {
  cityId: number;
  name: string;
  changes: Record<string, unknown>;
  evaluationMetrics?: string[];
}

export interface ScenarioEvaluationResponse {
  success: boolean;
  scenarioName: string;
  comparison: Record<string, unknown>;
  estimatedImpact: Record<string, unknown>;
  timestamp: string;
}

export interface VisualizationRequest {
  cityId: number;
  types: string[];
  parameters?: Record<string, unknown>;
  formats?: string[];
}

export interface VisualizationResponse {
  success: boolean;
  visualizations: Record<string, unknown>;
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