import React, { useState, useEffect, useCallback } from 'react';
import './StopDashboardPage.css';
import { stopsApi } from '../api/endpoints/stopsApi';
import { baseUrl } from '../api/env';
import apiClient from '../api/client';

// Типы
interface Stop {
  id: number;
  address: string;
  url?: string;
  count: number;
  algorithmicCount: number;
  velocity: number;
  load: number;
  lat: number;
  lng: number;
  hasCamera?: boolean;
}

interface PeriodStats {
  avgLoad: number;
  peakLoad: number;
  minLoad: number;
  avgCount: number;
  peakCount: number;
  avgVelocity: number;
  recordCount: number;
}

interface StopStatsResponse {
  today: PeriodStats;
  yesterday: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
}

interface Route {
  id: number;
  number: string;
  name: string;
  transportType: string;
  isActive: boolean;
  totalStops: number;
  cityId?: number;
}

// Helper функции
const loadToColor = (load: number) => {
  if (load <= 3) return '#10b981';
  if (load <= 7) return '#f59e0b';
  return '#ef4444';
};

const loadToBg = (load: number) => {
  if (load <= 3) return '#d1fae5';
  if (load <= 7) return '#fef3c7';
  return '#fee2e2';
};

const loadToText = (load: number) => {
  if (load <= 3) return '#065f46';
  if (load <= 7) return '#92400e';
  return '#991b1b';
};

const getTransportLabel = (type: string) => {
  const map: Record<string, string> = {
    BUS: 'Автобус',
    TROLLEYBUS: 'Троллейбус',
    TRAM: 'Трамвай',
    MINIBUS: 'Маршрутка',
  };
  return map[type] || type;
};

const getTransportColor = (type: string) => {
  const map: Record<string, { bg: string; text: string }> = {
    BUS: { bg: '#dbeafe', text: '#1d4ed8' },
    TROLLEYBUS: { bg: '#ede9fe', text: '#5b21b6' },
    TRAM: { bg: '#fef3c7', text: '#92400e' },
    MINIBUS: { bg: '#d1fae5', text: '#065f46' },
  };
  return map[type] || map.BUS;
};

const fmt = (d: Date) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

const StopDashboardPage: React.FC = () => {
  // Список всех остановок для выбора
  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [loadingStops, setLoadingStops] = useState(false);

  // Данные для дашборда
  const [stats, setStats] = useState<StopStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [chartUrl, setChartUrl] = useState<string | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  const [routes, setRoutes] = useState<Route[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);

  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Загрузка списка остановок
  useEffect(() => {
    const fetchAllStops = async () => {
      setLoadingStops(true);
      try {
        const stops = await stopsApi.getStopsByCity(1);
        setAllStops(stops);
        if (stops.length) {
          setSelectedStop(stops[0]);
        }
      } catch (err) {
        console.error('Failed to load stops list', err);
      } finally {
        setLoadingStops(false);
      }
    };
    fetchAllStops();
  }, []);

  // Функции загрузки данных
  const fetchStats = useCallback(async (address: string) => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch(`${baseUrl}/stops/history/${encodeURIComponent(address)}/stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StopStatsResponse = await res.json();
      setStats(data);
    } catch (e) {
      setStatsError(e instanceof Error ? e.message : 'Ошибка загрузки статистики');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchChart = useCallback(async (address: string) => {
    setChartLoading(true);
    setChartError(null);
    try {
      const res = await fetch(`${baseUrl}/stops/history/${encodeURIComponent(address)}/chart`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setChartUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e) {
      setChartError(e instanceof Error ? e.message : 'Ошибка загрузки графика');
    } finally {
      setChartLoading(false);
    }
  }, []);

  const fetchRoutes = useCallback(async (stopId: number) => {
    setRoutesLoading(true);
    setRoutesError(null);
    try {
      const response = await apiClient.get<Route[]>(`/routes/by-stop/${stopId}`);
      setRoutes(response.data);
    } catch (err: unknown) {
    let errorMsg = 'Ошибка загрузки маршрутов';
    if (err instanceof Error) errorMsg = err.message;
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      errorMsg = axiosErr.response?.data?.message || errorMsg;
    }
    setRoutesError(errorMsg);
    } finally {
      setRoutesLoading(false);
    }
  }, []);

  // При смене остановки загружаем всё
  useEffect(() => {
    if (!selectedStop) return;
    setLastUpdated(new Date());
    fetchStats(selectedStop.address);
    fetchChart(selectedStop.address);
    fetchRoutes(selectedStop.id);
    return () => {
      if (chartUrl) URL.revokeObjectURL(chartUrl);
    };
  }, [selectedStop, fetchStats, fetchChart, fetchRoutes]);

  const handleStopChange = (stop: Stop) => {
    setSelectedStop(stop);
    setStats(null);
    setChartUrl(null);
    setRoutes([]);
  };

  const statRows = stats
    ? [
        { label: 'Сегодня', s: stats.today },
        { label: 'Вчера', s: stats.yesterday },
        { label: 'Неделя', s: stats.week },
        { label: 'Месяц', s: stats.month },
      ]
    : [];

  if (loadingStops && !selectedStop) {
    return <div className="dashboard-loading">Загрузка списка остановок...</div>;
  }

  if (!selectedStop) {
    return <div className="dashboard-error">Нет доступных остановок</div>;
  }

  return (
    <div className="stop-dashboard">
      {/* Верхняя панель с выбором остановки */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>📊 Дашборд остановки</h1>
          <div className="stop-selector">
            <label>Выберите остановку:</label>
            <select
              value={selectedStop.id}
              onChange={(e) => {
                const stop = allStops.find(s => s.id === Number(e.target.value));
                if (stop) handleStopChange(stop);
              }}
            >
              {allStops.map(stop => (
                <option key={stop.id} value={stop.id}>
                  {stop.address} (ID: {stop.id})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="header-right">
          <span className="update-time">Обновлено: {fmt(lastUpdated)}</span>
          <button
            className="refresh-all"
            onClick={() => {
              if (selectedStop) {
                fetchStats(selectedStop.address);
                fetchChart(selectedStop.address);
                fetchRoutes(selectedStop.id);
                setLastUpdated(new Date());
              }
            }}
          >
            🔄 Обновить всё
          </button>
        </div>
      </div>

      {/* Информационная карточка остановки */}
      <div className="stop-info-card">
        <div className="stop-address">
          <span className="icon">📍</span> {selectedStop.address}
          <span className="stop-id">ID: {selectedStop.id}</span>
        </div>
        <div className="stop-metrics">
          <div className="metric" style={{ borderLeftColor: loadToColor(selectedStop.load) }}>
            <span className="metric-label">Текущая загрузка</span>
            <span className="metric-value" style={{ color: loadToColor(selectedStop.load) }}>
              {selectedStop.load}/10
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Людей сейчас</span>
            <span className="metric-value">{selectedStop.count}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Скорость притока</span>
            <span className="metric-value">{selectedStop.velocity}</span>
          </div>
          {selectedStop.hasCamera && (
            <div className="metric">
              <span className="metric-label">Камера</span>
              <span className="metric-value">🎥 есть</span>
            </div>
          )}
        </div>
      </div>

      {/* Две колонки: график + статистика */}
      <div className="dashboard-two-columns">
        {/* Левая колонка: график загрузки */}
        <div className="chart-card">
          <div className="card-header">
            <h3>📉 Загрузка за неделю</h3>
            <button className="refresh-btn" onClick={() => fetchChart(selectedStop.address)} disabled={chartLoading}>
              {chartLoading ? '⏳' : '🔄'}
            </button>
          </div>
          <div className="card-body">
            {chartLoading && !chartUrl && (
              <div className="loading-placeholder"><div className="spinner" /> Загрузка графика...</div>
            )}
            {chartError && !chartLoading && (
              <div className="error-placeholder">
                ⚠️ {chartError}
                <button onClick={() => fetchChart(selectedStop.address)}>Повторить</button>
              </div>
            )}
            {chartUrl && !chartLoading && !chartError && (
              <img src={chartUrl} alt="График загрузки" className="chart-image" />
            )}
            {!chartUrl && !chartLoading && !chartError && (
              <div className="no-data-placeholder">Нет данных графика</div>
            )}
          </div>
        </div>

        {/* Правая колонка: таблица статистики */}
        <div className="stats-card">
          <div className="card-header">
            <h3>📋 Статистика по периодам</h3>
            <button className="refresh-btn" onClick={() => fetchStats(selectedStop.address)} disabled={statsLoading}>
              {statsLoading ? '⏳' : '🔄'}
            </button>
          </div>
          <div className="card-body">
            {statsLoading && !stats && <div className="loading-placeholder"><div className="spinner" /> Загрузка статистики...</div>}
            {statsError && !statsLoading && (
              <div className="error-placeholder">
                ⚠️ {statsError}
                <button onClick={() => fetchStats(selectedStop.address)}>Повторить</button>
              </div>
            )}
            {stats && (
              <div className="table-wrapper">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>Период</th>
                      <th>Ср. загрузка</th>
                      <th>Пик</th>
                      <th>Мин</th>
                      <th>Ср. людей</th>
                      <th>Пик людей</th>
                      <th>Записей</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statRows.map(({ label, s }) => (
                      <tr key={label}>
                        <td>{label}</td>
                        <td>
                          <span
                            className="load-pill"
                            style={{ background: loadToBg(s.avgLoad), color: loadToText(s.avgLoad) }}
                          >
                            {s.avgLoad}/10
                          </span>
                        </td>
                        <td style={{ color: loadToColor(s.peakLoad), fontWeight: 600 }}>{s.peakLoad}</td>
                        <td style={{ color: loadToColor(s.minLoad), fontWeight: 600 }}>{s.minLoad}</td>
                        <td>{s.avgCount}</td>
                        <td>{s.peakCount}</td>
                        <td className="records-count">{s.recordCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Третья строка: маршруты */}
      <div className="dashboard-two-columns">
        <div className="routes-card">
          <div className="card-header">
            <h3>🚌 Маршруты через остановку</h3>
            <button className="refresh-btn" onClick={() => fetchRoutes(selectedStop.id)} disabled={routesLoading}>
              {routesLoading ? '⏳' : '🔄'}
            </button>
          </div>
          <div className="card-body">
            {routesLoading && routes.length === 0 && <div className="loading-placeholder"><div className="spinner" /> Загрузка маршрутов...</div>}
            {routesError && !routesLoading && (
              <div className="error-placeholder">
                ⚠️ {routesError}
                <button onClick={() => fetchRoutes(selectedStop.id)}>Повторить</button>
              </div>
            )}
            {!routesLoading && routes.filter(r => r.isActive).length === 0 && (
              <div className="no-data-placeholder">Нет активных маршрутов через эту остановку</div>
            )}
            {!routesLoading && routes.filter(r => r.isActive).length > 0 && (
              <div className="routes-list">
                {routes
                  .filter(r => r.isActive)
                  .sort((a, b) => a.number.localeCompare(b.number, 'ru'))
                  .map(route => {
                    const colors = getTransportColor(route.transportType);
                    return (
                      <div key={route.id} className="route-item">
                        <div className="route-num-badge" style={{ background: colors.bg, color: colors.text }}>
                          {route.number}
                        </div>
                        <div className="route-info">
                          <div className="route-name">{route.name}</div>
                          <div className="route-details">
                            {getTransportLabel(route.transportType)} · {route.totalStops} остановок
                          </div>
                        </div>
                        <div className="route-eta">🕐 расписание</div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StopDashboardPage;