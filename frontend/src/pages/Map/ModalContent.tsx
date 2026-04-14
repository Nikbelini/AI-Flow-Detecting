import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ModalContent.css';
import ForecastPanel from './ForecastPanel';
import HlsPlayer from './HlsPlayer';
import { baseUrl } from './env';
import apiClient from '../../api/client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Marker {
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

interface ForecastState {
  showForecast: boolean;
  isForecastOpen: boolean;
  forecastData: any;
  autoRefresh: boolean;
  showMiniChart: boolean;
}

interface ModalContentProps {
  marker: Marker;
  isOpen: boolean;
  onClose: () => void;
}

// Тип Route — ПОД ТВОЙ БЭКЕНД (Route.java)
export interface Route {
  id: number;
  number: string;
  name: string;
  transportType: string;
  isActive: boolean;
  totalStops: number;
  cityId?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
const getLoadLevel = (load: number) => {
  if (load <= 3) return 'Свободно';
  if (load <= 7) return 'Средняя нагрузка';
  return 'Перегружено';
};
const getLoadDesc = (load: number) => {
  if (load <= 3) return 'Остановка свободна, очередей нет.';
  if (load <= 7) return 'Умеренная загрузка, небольшие очереди.';
  return 'Высокая загрузка — рекомендуем альтернативные маршруты.';
};
const fmt = (d: Date) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

// Helper: тип транспорта
const getTransportLabel = (type: string) => {
  const map: Record<string, string> = {
    BUS: 'Автобус',
    TROLLEYBUS: 'Троллейбус',
    TRAM: 'Трамвай',
    MINIBUS: 'Маршрутка',
  };
  return map[type] || type;
};

// Helper: цвет бейджа по типу транспорта
const getTransportColor = (type: string) => {
  const map: Record<string, { bg: string; text: string }> = {
    BUS: { bg: '#dbeafe', text: '#1d4ed8' },
    TROLLEYBUS: { bg: '#ede9fe', text: '#5b21b6' },
    TRAM: { bg: '#fef3c7', text: '#92400e' },
    MINIBUS: { bg: '#d1fae5', text: '#065f46' },
  };
  return map[type] || map.BUS;
};

// ─── Component ───────────────────────────────────────────────────────────────

const ModalContent: React.FC<ModalContentProps> = ({ marker, isOpen, onClose }) => {
  type Tab = 'info' | 'routes' | 'stats' | 'stream' | 'forecast';

  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Stats state
  const [stats, setStats] = useState<StopStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Chart state
  const [chartUrl, setChartUrl] = useState<string | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  // Routes state — под твой Route.java
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);

  // Mini player
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);

  // Forecast
  const [forecastState, setForecastState] = useState<ForecastState>({
    showForecast: false,
    isForecastOpen: false,
    forecastData: null,
    autoRefresh: true,
    showMiniChart: true,
  });

  const fetchedMarkerId = useRef<number | null>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setLastUpdated(new Date());
      setActiveTab('info');
      setChartUrl(null);
      setStats(null);
      setRoutes([]);
      setRoutesError(null);
      fetchedMarkerId.current = null;
    }
  }, [isOpen, marker.id, marker.address]);

  // ── Fetch stats ────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch(
        `${baseUrl}/stops/history/${encodeURIComponent(marker.address)}/stats`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StopStatsResponse = await res.json();
      setStats(data);
    } catch (e) {
      setStatsError(e instanceof Error ? e.message : 'Ошибка загрузки статистики');
    } finally {
      setStatsLoading(false);
    }
  }, [marker.address]);

  // ── Fetch chart ────────────────────────────────────────────────────────────
  const fetchChart = useCallback(async () => {
    setChartLoading(true);
    setChartError(null);
    try {
      const res = await fetch(
        `${baseUrl}/stops/history/${encodeURIComponent(marker.address)}/chart`
      );
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
  }, [marker.address]);

  // Fetch routes — ТВОЙ ЭНДПОИНТ: /routes/by-stop/{stopId}
  const fetchRoutes = useCallback(async () => {
    setRoutesLoading(true);
    setRoutesError(null);
    try {
      const response = await apiClient.get<Route[]>(`/routes/by-stop/${marker.id}`);
      setRoutes(response.data);
    } catch (e: any) {
      setRoutesError(e?.response?.data?.message || e?.message || 'Ошибка загрузки маршрутов');
      console.error('Failed to fetch routes:', e);
    } finally {
      setRoutesLoading(false);
    }
  }, [marker.id]);

  // Load stats + chart when switching to stats tab
  useEffect(() => {
    if (activeTab === 'stats') {
      if (!stats) fetchStats();
      if (!chartUrl) fetchChart();
    }
  }, [activeTab, stats, chartUrl]);

  // Load routes when switching to routes tab
  useEffect(() => {
    if (activeTab === 'routes' && !routesLoading && fetchedMarkerId.current !== marker.id) {
      fetchedMarkerId.current = marker.id;
      fetchRoutes();
    }
  }, [activeTab, routesLoading, marker.id]);

  // Cleanup blob
  useEffect(() => {
    return () => {
      if (chartUrl) URL.revokeObjectURL(chartUrl);
    };
  }, [chartUrl]);

  const handleForecastStateChange = (updates: Partial<ForecastState>) => {
    setForecastState(prev => ({ ...prev, ...updates }));
    if (updates.isForecastOpen !== undefined) {
      setActiveTab(updates.isForecastOpen ? 'forecast' : 'info');
    }
  };

  const handleOpenForecast = () => {
    handleForecastStateChange({ showForecast: true, isForecastOpen: true });
    setActiveTab('forecast');
  };

  if (!isOpen) return null;

  // Helpers for info tab
  const countLabel = marker.hasCamera ? 'ML-детекция' : 'Прогноз по графам';
  const algoDisplay = marker.algorithmicCount + 8;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'info', label: '📋 Информация' },
    { id: 'routes', label: '🚌 Маршруты' },
    { id: 'stats', label: '📊 Статистика' },
    { id: 'forecast', label: '🔮 Прогноз' },
    ...(marker.url ? [{ id: 'stream' as Tab, label: '🎥 Трансляция' }] : []),
  ];

  const statRows = stats
    ? [
      { label: 'Сегодня', s: stats.today },
      { label: 'Вчера', s: stats.yesterday },
      { label: 'Неделя', s: stats.week },
      { label: 'Месяц', s: stats.month },
    ]
    : [];

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-container">

        {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
        <div className="modal-header">
          <div className="header-left">
            <div className="marker-badge" style={{ backgroundColor: loadToColor(marker.load) }}>
              <span className="badge-text">{marker.load}</span>
            </div>
            <div className="header-info">
              <h2 className="stop-name">
                <span className="header-icon">📍</span>
                {marker.address}
              </h2>
              <div className="stop-meta">
                <span className="meta-item">
                  <span className="meta-icon">🕐</span> Обновлено: {fmt(lastUpdated)}
                  {marker.url && (
                    <span className="camera-badge" title="Есть видеотрансляция • Камера подключена">
                      <span className="camera-dot"></span> Камера доступна
                    </span>
                  )}
                </span>
                <span className="meta-item">
                  <span className="meta-icon">🆔</span> ID: #{marker.id}
                </span>
              </div>
            </div>
          </div>
          <div className="header-right">
            <button className="icon-btn" title="Обновить" onClick={() => setLastUpdated(new Date())}>
              <span className="btn-icon">🔄</span>
            </button>
            {marker.url && (
              <button
                className="icon-btn"
                title="Открыть трансляцию"
                onClick={() => setActiveTab('stream')}
              >
                <span className="btn-icon">🎥</span>
              </button>
            )}
            {/* <button className="icon-btn" title="Полный экран"
              onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()}>
              <span className="btn-icon">📺</span>
            </button> */}
            <button className="icon-btn close-btn" onClick={onClose} title="Закрыть">
              <span className="btn-icon">✕</span>
            </button>
          </div>
        </div>

        {/* ══ TABS ════════════════════════════════════════════════════════════ */}
        <div className="modal-tabs">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              className={`tab-btn ${activeTab === id ? 'active' : ''}`}
              onClick={() => id === 'forecast' ? handleOpenForecast() : setActiveTab(id)}
            >
              {label}
              {id === 'forecast' && forecastState.forecastData && <span className="tab-badge">🔄</span>}
            </button>
          ))}
        </div>

        {/* ══ BODY ════════════════════════════════════════════════════════════ */}
        <div className="modal-body">

          {/* ── INFO ──────────────────────────────────────────────────────── */}
          {activeTab === 'info' && (
            <div className="tab-content info-tab">
              <div className="info-banner" style={{
                background: loadToBg(marker.load),
                borderLeft: `3px solid ${loadToColor(marker.load)}`,
                color: loadToText(marker.load),
              }}>
                💡 {getLoadDesc(marker.load)}
              </div>
              <div className="status-card">
                <div className="status-header">
                  <h3><span className="section-icon">📈</span> Статус загрузки</h3>
                  <div className="load-level" style={{ color: loadToColor(marker.load) }}>
                    {getLoadLevel(marker.load)}
                  </div>
                </div>
                <div className="load-meter">
                  <div className="meter-labels">
                    <span>🟢 Свободно</span><span>🟡 Умеренно</span><span>🔴 Перегружено</span>
                  </div>
                  <div className="meter-bar">
                    <div className="meter-fill" style={{ width: `${marker.load * 10}%`, backgroundColor: loadToColor(marker.load) }} />
                  </div>
                  <div className="meter-value"><span>⚡</span> {marker.load}/10</div>
                </div>
              </div>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-icon">👥</div>
                  <div className="metric-content">
                    <div className="people-row">
                      <div className="people-block">
                        <div className="metric-value">{marker.count ?? 0}</div>
                        <div className="people-source">{marker.hasCamera ? 'ML-детекция' : 'Прогноз'}</div>
                      </div>
                      <div className="people-divider" />
                      <div className="people-block">
                        <div className="metric-value algo-value">
                          {marker.algorithmicCount !== undefined ? marker.algorithmicCount : '—'}
                        </div>
                        <div className="people-source"><span className="algo-badge">Алгоритм</span></div>
                      </div>
                    </div>
                    <div className="metric-label">Людей сейчас</div>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">⚡</div>
                  <div className="metric-content">
                    <div className="metric-value">{marker.velocity ?? 0}</div>
                    <div className="metric-label">Скорость притока</div>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">📊</div>
                  <div className="metric-content">
                    <div className="metric-value">{((marker.load ?? 0) * 10).toFixed(0)}%</div>
                    <div className="metric-label">Загрузка</div>
                  </div>
                </div>
              </div>
              <div className="forecast-preview-section">
                <div className="section-header">
                  <h3><span className="section-icon">🔮</span> Быстрый прогноз</h3>
                  <button className="forecast-btn" onClick={handleOpenForecast}>
                    <span className="btn-icon">📈</span> Подробный прогноз
                  </button>
                </div>
                <div className="forecast-preview">
                  {[
                    { label: '+15 мин', mult: 1.1, pct: '+10%', dir: 'up' },
                    { label: '+30 мин', mult: 1.2, pct: '+20%', dir: 'up' },
                    { label: '+60 мин', mult: 0.9, pct: '-10%', dir: 'down' },
                  ].map(({ label, mult, pct, dir }) => (
                    <div key={label} className="forecast-item">
                      <div className="forecast-time"><span>⏰</span> {label}</div>
                      <div className="forecast-value">
                        <span className="value-number">{Math.round(marker.count * mult)}</span>
                        <span className="value-label">человек</span>
                      </div>
                      <div className={`forecast-trend ${dir}`}>{dir === 'up' ? '↗' : '↘'} {pct}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ROUTES — РЕАЛЬНЫЕ ДАННЫЕ: /routes/by-stop/{stopId} ───────── */}
          {activeTab === 'routes' && (
            <div className="tab-content routes-tab">
              <div className="routes-header">
                <span className="live-dot" />
                <span className="routes-subtitle">
                  Маршруты через остановку · {routesLoading ? 'загрузка...' : `${routes.filter(r => r.isActive).length} активных`}
                </span>
              </div>

              {/* Loading */}
              {routesLoading && routes.length === 0 && (
                <div className="chart-loading">
                  <div className="spinner" /><span>Загрузка маршрутов...</span>
                </div>
              )}

              {/* Error */}
              {routesError && !routesLoading && (
                <div className="chart-error">
                  ⚠️ {routesError}
                  <button onClick={fetchRoutes}>Повторить</button>
                </div>
              )}

              {/* Routes list — РЕАЛЬНЫЕ ДАННЫЕ */}
              {!routesLoading && routes.filter(r => r.isActive).length > 0 && (
                <div className="routes-list">
                  {routes
                    .filter(r => r.isActive)
                    .sort((a, b) => a.number.localeCompare(b.number, 'ru'))
                    .map(route => {
                      const colors = getTransportColor(route.transportType);
                      return (
                        <div key={route.id} className="route-item">
                          {/* НОМЕР МАРШРУТА — крупно в цветном бейдже */}
                          <div
                            className="route-num-badge"
                            style={{ background: colors.bg, color: colors.text }}
                            title={`Тип: ${getTransportLabel(route.transportType)}`}
                          >
                            {route.number}
                          </div>

                          {/* НАЗВАНИЕ МАРШРУТА — жирным шрифтом */}
                          <div className="route-info">
                            <div className="route-name" title={route.name}>
                              <strong>{route.name}</strong>
                            </div>
                            <div className="route-details">
                              <span>{getTransportLabel(route.transportType)}</span>
                              {route.totalStops > 0 && <span>· {route.totalStops} остановок</span>}
                            </div>
                          </div>

                          {/* Статус / иконка */}
                          <div className="route-eta">
                            <div className="eta-val">🕐</div>
                            <div className="eta-label">расписание</div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Empty state */}
              {!routesLoading && !routesError && routes.filter(r => r.isActive).length === 0 && (
                <div className="empty-state">
                  <span className="empty-icon">🚌</span>
                  <p>Нет активных маршрутов через эту остановку</p>
                  <button className="refresh-small-btn" onClick={fetchRoutes}>🔄 Обновить</button>
                </div>
              )}
            </div>
          )}

          {/* ── STATS ─────────────────────────────────────────────────────── */}
          {activeTab === 'stats' && (
            <div className="tab-content stats-tab">
              <div className="chart-card">
                <div className="chart-card-header">
                  <h3><span className="section-icon">📉</span> Загрузка за последние 12 часов</h3>
                  <button className="refresh-small-btn" onClick={fetchChart} disabled={chartLoading}>
                    {chartLoading ? '⏳' : '🔄'}
                  </button>
                </div>
                {chartLoading && !chartUrl && <div className="chart-loading"><div className="spinner" /><span>Загрузка...</span></div>}
                {chartError && !chartLoading && <div className="chart-error">⚠️ {chartError}<button onClick={fetchChart}>Повторить</button></div>}
                {chartUrl && !chartLoading && !chartError && (
                  <div className="chart-image-wrapper"><img src={chartUrl} alt="График" className="chart-img" onError={(e) => { setChartError('Ошибка загрузки'); e.currentTarget.style.display = 'none'; }} /></div>
                )}
                {!chartUrl && !chartLoading && !chartError && <div className="chart-placeholder-single"><div className="chart-placeholder-icon">📊</div><div className="chart-placeholder-text">Нет данных</div></div>}
              </div>
              <div className="stats-table">
                <div className="stats-table-header">
                  <h3><span className="section-icon">📋</span> Статистика</h3>
                  <button className="refresh-small-btn" onClick={fetchStats} disabled={statsLoading}>{statsLoading ? '⏳' : '🔄'}</button>
                </div>
                {statsLoading && !stats && <div className="chart-loading"><div className="spinner" /><span>Загрузка...</span></div>}
                {statsError && !statsLoading && <div className="chart-error">⚠️ {statsError}<button onClick={fetchStats}>Повторить</button></div>}
                {stats && (
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Период</th><th>Ср. загрузка</th><th>Пик</th><th>Мин</th><th>Ср. людей</th><th>Пик людей</th><th>Записей</th></tr></thead>
                      <tbody>
                        {statRows.map(({ label, s }) => (
                          <tr key={label}>
                            <td><span className="table-icon">📅</span> {label}</td>
                            <td><span className="load-pill" style={{ background: loadToBg(s.avgLoad), color: loadToText(s.avgLoad) }}>{s.avgLoad}/10</span></td>
                            <td style={{ color: loadToColor(s.peakLoad), fontWeight: 600 }}>{s.peakLoad}</td>
                            <td style={{ color: loadToColor(s.minLoad), fontWeight: 600 }}>{s.minLoad}</td>
                            <td>{s.avgCount}</td><td>{s.peakCount}</td><td className="records-count">{s.recordCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {stats && <div className="stats-updated">Обновлено: {fmt(new Date())}</div>}
              </div>
            </div>
          )}

          {/* ── FORECAST ──────────────────────────────────────────────────── */}
          {activeTab === 'forecast' && (
            <div className="tab-content forecast-tab">
              <ForecastPanel
                address={marker.address}
                stopData={{ count: marker.count, load: marker.load, velocity: marker.velocity }}
                onClose={() => handleForecastStateChange({ isForecastOpen: false })}
                isOpen={forecastState.isForecastOpen}
                onToggle={(open) => handleForecastStateChange({ isForecastOpen: open })}
                forecastState={forecastState}
                onForecastDataUpdate={(data) => handleForecastStateChange({ forecastData: data })}
              />
            </div>
          )}

          {/* ── STREAM ────────────────────────────────────────────────────── */}
          {/* ── STREAM — ТОЛЬКО ЕСЛИ ЕСТЬ URL КАМЕРЫ ───────────────── */}
          {activeTab === 'stream' && marker.url && (
            <div className="tab-content stream-tab">
              <div className="stream-header">
                <h3>🎥 Прямая трансляция</h3>
                <div className="stream-badges">
                  <span className="badge live">● LIVE</span>
                  <span className="badge source">HLS</span>
                </div>
              </div>

              <div className="stream-video-wrap">
                <HlsPlayer
                  src={marker.url}
                  autoPlay
                  muted
                  controls
                  playsInline
                  onError={(e) => console.error('HLS error:', e)}
                />
              </div>

              <div className="stream-meta">
                {[
                  { label: '📷 Камера', value: `#CAM-${marker.id}` },
                  { label: '🟢 Статус', value: '● Онлайн' },
                  { label: '⏱️ Задержка', value: '2–3 сек' },
                ].map(({ label, value }) => (
                  <div key={label} className="stream-meta-item">
                    <span className="stream-meta-label">{label}:</span>
                    <span className="stream-meta-value">{value}</span>
                  </div>
                ))}
              </div>

              <div className="stream-controls">
                <button className="control-btn" title="Пауза">⏸️</button>
                <button className="control-btn" title="Запись">⏺️</button>
                <button className="control-btn" title="Снимок">📸</button>
                <div className="volume-control">
                  <span>🔊</span>
                  <input type="range" min="0" max="100" defaultValue="80" />
                  <span>80%</span>
                </div>
              </div>
            </div>
          )}

          {/* Если нет URL — показываем заглушку в том же месте */}
          {activeTab === 'stream' && !marker.url && (
            <div className="tab-content stream-tab">
              <div className="stream-placeholder">
                <div className="stream-placeholder-icon">📹</div>
                <div className="stream-placeholder-text">Камера не подключена</div>
                <div className="stream-placeholder-subtext">
                  Для этой остановки нет видеотрансляции.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══ МИНИ-ПЛЕЕР ═════════════════════════════════════ */}
        {showMiniPlayer && (
          <>
            <div className="modal-overlay" onClick={() => setShowMiniPlayer(false)} style={{ zIndex: 10000 }} />
            <div className="mini-player-modal">
              <div className="mini-player-header">
                <div className="mini-player-title"><span>🎥</span> {marker.address}</div>
                <div className="mini-player-badges">{marker.url && <span className="badge source">HLS</span>}<span className="badge live">● LIVE</span></div>
                <button className="icon-btn close-btn" onClick={() => setShowMiniPlayer(false)}><span className="btn-icon">✕</span></button>
              </div>
              <div className="mini-player-content">
                {marker.url ? (
                  <HlsPlayer src={marker.url} autoPlay muted controls playsInline onError={(e) => console.error('HLS error:', e)} />
                ) : (
                  <div className="stream-placeholder"><div className="stream-placeholder-icon">📹</div><div className="stream-placeholder-text">Поток недоступен</div></div>
                )}
              </div>
              <div className="mini-player-footer">
                <span className="camera-id">#{marker.id}</span><span className="connection-status">{marker.url ? '🟢 Онлайн' : '🟡 Ожидание'}</span>
              </div>
            </div>
          </>
        )}

        {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
        <div className="modal-footer">
          <div className="footer-actions">
            <button className={`action-btn ${activeTab === 'forecast' ? 'secondary' : 'primary'}`} onClick={handleOpenForecast}>
              <span className="btn-icon">📊</span><span className="btn-text">{activeTab === 'forecast' ? 'Скрыть' : 'Прогноз'}</span>
            </button>
            <button className="action-btn secondary" onClick={() => setActiveTab('routes')}><span className="btn-icon">🚌</span><span className="btn-text">Маршруты</span></button>
            <button className="action-btn secondary" onClick={() => setActiveTab('stats')}><span className="btn-icon">📈</span><span className="btn-text">Статистика</span></button>
          </div>
          <div className="footer-info"><span className="coords">📍 {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}</span></div>
        </div>
      </div>
    </>
  );
};

export default ModalContent;