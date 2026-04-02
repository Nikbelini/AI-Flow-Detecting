// Интерфейс для прогноза с сервера (snake_case)
export interface ForecastDataFromServer {
  timestamp: string;
  predicted_passenger_count: number;
  predicted_load: number;
  forecast_hour: number;
}

// Интерфейс для прогноза (camelCase)
export interface ForecastData {
  timestamp: string;
  predictedPassengerCount: number;
  predictedLoad: number;
  forecastHour: number;
}

// Интерфейс для ответа прогноза
export interface ForecastResponse {
  address: string;
  generatedAt: string;
  forecasts: ForecastData[];
  metrics?: {
    passenger_mae?: number;
    passenger_rmse?: number;
    load_mae?: number;
    load_rmse?: number;
  };
  plotHtml?: string;
}

// Пропсы для компонента ForecastPanel
export interface ForecastPanelProps {
  address: string;
  onClose: () => void;
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  forecastState: ForecastState;
  onForecastDataUpdate: (data: ForecastResponse | null) => void;
}

// Состояние прогноза
export interface ForecastState {
  forecastData: ForecastResponse | null;
  autoRefresh: boolean;
  showMiniChart: boolean;
}