// src/pages/Map/types.ts
export type MapMode = 'realtime' | 'simulation' | 'comparison';
export type SimulationStatus = 'idle' | 'ready' | 'running' | 'completed' | 'error';

export interface Scenario {
  id: string;
  name: string;
  description: string;
  created: Date;
  changes: ScenarioChange[];
  results?: SimulationResults;
}

export interface ScenarioChange {
  type: 'add_stop' | 'remove_stop' | 'add_route' | 'close_stop' | 'change_interval';
  parameters: Record<string, any>;
}

export interface SimulationResults {
  averageWaitTime: number;
  passengerKilometers: number;
  transportUtilization: number;
  maxLoad: number;
  timestamp: Date;
  hourlyData: HourlyMetric[];
}

export interface HourlyMetric {
  hour: number;
  waitTime: number;
  passengerCount: number;
  transportCount: number;
}

export interface StopData {
  id: string;
  name: string;
  passengers: number;
  capacity: number;
  prediction: number;
  coordinates: [number, number];
  status: 'normal' | 'overloaded' | 'closed';
}