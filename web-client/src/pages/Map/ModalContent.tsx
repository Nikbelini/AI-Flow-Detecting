import React, { useState, useEffect } from 'react';
import './ModalContent.css';
import ForecastPanel from './ForecastPanel';
import HlsPlayer from './HlsPlayer';
import { useStops } from '../../hooks/api/useStops';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, Area, ComposedChart
} from 'recharts';
import { useQueryClient } from '@tanstack/react-query';

interface Marker {
  id: number;
  address: string;
  url?: string;
  count: number;
  velocity: number;
  load: number;
  lat: number;
  lng: number;
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
  onStopDeleted?: (stopId: number) => void;
}

const ModalContent: React.FC<ModalContentProps> = ({
  marker,
  isOpen,
  onClose,
  onStopDeleted
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'stats' | 'stream' | 'forecast'>('info');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [forecastState, setForecastState] = useState<ForecastState>({
    showForecast: false,
    isForecastOpen: false,
    forecastData: null,
    autoRefresh: true,
    showMiniChart: true
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const { deleteStop } = useStops();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOpen) {
      setLastUpdated(new Date());
    }
  }, [isOpen]);

  const loadToColor = (load: number): string => {
    if (load <= 3) return "#10b981";
    if (load <= 7) return "#f59e0b";
    return "#ef4444";
  };

  const getLoadLevel = (load: number): string => {
    if (load <= 3) return "Низкая";
    if (load <= 7) return "Средняя";
    return "Высокая";
  };

  const getLoadDescription = (load: number): string => {
    if (load <= 3) return "Остановка свободна, нет очередей";
    if (load <= 7) return "Умеренная загрузка, небольшие очереди";
    return "Высокая загрузка, рекомендуем альтернативные маршруты";
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleForecastStateChange = (updates: Partial<ForecastState>) => {
    setForecastState(prev => ({ ...prev, ...updates }));
    if (updates.isForecastOpen !== undefined) {
      setActiveTab(updates.isForecastOpen ? 'forecast' : 'info');
    }
  };

  const handleOpenForecast = () => {
    handleForecastStateChange({
      showForecast: true,
      isForecastOpen: true
    });
    setActiveTab('forecast');
  };

  // Удаление остановки
  const handleDeleteStop = async () => {
    if (!marker.id) {
      console.error('No stop ID');
      return;
    }

    if (!window.confirm(`Удалить остановку "${marker.address}"? Это действие нельзя отменить.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteStop(marker.id);
      
      // Принудительно инвалидируем кэш остановок
      queryClient.invalidateQueries({ queryKey: ['stops'] });
      queryClient.invalidateQueries({ queryKey: ['stops', 'city', marker.cityId] });
      
      // Уведомляем родителя
      onStopDeleted?.(marker.id);
      
      // Закрываем модалку
      onClose();
    } catch (error) {
      console.error('Stop delete error:', error);
      alert('Ошибка при удалении остановки');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="modal-overlay" onClick={onClose} />

      {/* Modal Container */}
      <div className="modal-container">
        {/* Modal Header */}
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
                  <span className="meta-icon">🕐</span>
                  Обновлено: {formatTime(lastUpdated)}
                </span>
                <span className="meta-item">
                  <span className="meta-icon">🆔</span>
                  ID: #{marker.id}
                </span>
              </div>
            </div>
          </div>

          <div className="header-right">
            <button
              className="icon-btn"
              title="Обновить данные"
              onClick={() => setLastUpdated(new Date())}
            >
              <span className="btn-icon">🔄</span>
            </button>
            <button
              className="icon-btn"
              title="Развернуть на весь экран"
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen();
                } else {
                  document.documentElement.requestFullscreen();
                }
              }}
            >
              <span className="btn-icon">📺</span>
            </button>
            <button
              className="icon-btn delete-stop-btn"
              title="Удалить остановку"
              onClick={handleDeleteStop}
              disabled={isDeleting}
            >
              <span className="btn-icon">{isDeleting ? '⏳' : '🗑️'}</span>
            </button>
            <button
              className="icon-btn close-btn"
              onClick={onClose}
              title="Закрыть"
            >
              <span className="btn-icon">✕</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            <span className="tab-icon">📋</span>
            <span className="tab-text">Информация</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <span className="tab-icon">📊</span>
            <span className="tab-text">Статистика</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'forecast' ? 'active' : ''}`}
            onClick={handleOpenForecast}
          >
            <span className="tab-icon">🔮</span>
            <span className="tab-text">Прогноз</span>
            {forecastState.forecastData && (
              <span className="tab-badge">🔄</span>
            )}
          </button>
          {marker.url && (
            <button
              className={`tab-btn ${activeTab === 'stream' ? 'active' : ''}`}
              onClick={() => setActiveTab('stream')}
            >
              <span className="tab-icon">🎥</span>
              <span className="tab-text">Трансляция</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Информационная вкладка */}
          {activeTab === 'info' && (
            <div className="tab-content info-tab">
              {/* Статус загрузки */}
              <div className="status-card">
                <div className="status-header">
                  <h3>
                    <span className="section-icon">📈</span>
                    Статус загрузки
                  </h3>
                  <div className="load-level" style={{ color: loadToColor(marker.load) }}>
                    {getLoadLevel(marker.load)}
                  </div>
                </div>
                <p className="load-description">
                  <span className="description-icon">💡</span>
                  {getLoadDescription(marker.load)}
                </p>

                <div className="load-meter">
                  <div className="meter-labels">
                    <span className="meter-label">🟢 Свободно</span>
                    <span className="meter-label">🟡 Умеренно</span>
                    <span className="meter-label">🔴 Перегружено</span>
                  </div>
                  <div className="meter-bar">
                    <div
                      className="meter-fill"
                      style={{
                        width: `${marker.load * 10}%`,
                        backgroundColor: loadToColor(marker.load)
                      }}
                    />
                    <div className="meter-pointer" style={{ left: `${marker.load * 10}%` }} />
                  </div>
                  <div className="meter-value">
                    <span className="value-icon">⚡</span>
                    {marker.load}/10
                  </div>
                </div>
              </div>

              {/* Ключевые метрики */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-icon">👥</div>
                  <div className="metric-content">
                    <div className="metric-value">{marker.count}</div>
                    <div className="metric-label">Людей сейчас</div>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">⚡</div>
                  <div className="metric-content">
                    <div className="metric-value">{marker.velocity}</div>
                    <div className="metric-label">Скорость притока</div>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">📊</div>
                  <div className="metric-content">
                    <div className="metric-value">{(marker.load * 10).toFixed(0)}%</div>
                    <div className="metric-label">Загрузка остановки</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Статистика */}
          {activeTab === 'stats' && (
            <div className="tab-content stats-tab">
              {/* Дополнительные графики */}
              <div className="charts-grid">
                <div className="chart-card">
                  <h3>
                    <span className="section-icon">📉</span>
                    Динамика загрузки
                  </h3>
                  <div className="chart-placeholder">
                    <div className="chart-bars">
                      {[5, 7, 8, 6, 9, 8, 7, 6, 5, 4, 6, 7].map((value, index) => (
                        <div key={index} className="chart-bar" style={{ height: `${value * 10}%` }}>
                          <div className="bar-label">{index + 1}ч</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="chart-card">
                  <h3>
                    <span className="section-icon">🥧</span>
                    Распределение по дням
                  </h3>
                  <div className="chart-placeholder">
                    <div className="pie-chart">
                      <div className="pie-segment" style={{ '--segment-size': '40%' } as React.CSSProperties}>
                        <span>8-12ч</span>
                      </div>
                      <div className="pie-segment" style={{ '--segment-size': '30%' } as React.CSSProperties}>
                        <span>13-17ч</span>
                      </div>
                      <div className="pie-segment" style={{ '--segment-size': '20%' } as React.CSSProperties}>
                        <span>18-22ч</span>
                      </div>
                      <div className="pie-segment" style={{ '--segment-size': '10%' } as React.CSSProperties}>
                        <span>23-7ч</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="stats-table">
                <h3>
                  <span className="section-icon">📋</span>
                  Историческая статистика
                </h3>
                <table>
                  <thead>
                    <tr>
                      <th>Период</th>
                      <th>Средняя загрузка</th>
                      <th>Пиковая нагрузка</th>
                      <th>Среднее время ожидания</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="table-icon">📅</span> Сегодня</td>
                      <td>6.8/10</td>
                      <td>9/10</td>
                      <td>4.2 мин</td>
                    </tr>
                    <tr>
                      <td><span className="table-icon">📅</span> Вчера</td>
                      <td>5.4/10</td>
                      <td>8/10</td>
                      <td>3.8 мин</td>
                    </tr>
                    <tr>
                      <td><span className="table-icon">📅</span> За неделю</td>
                      <td>5.9/10</td>
                      <td>9/10</td>
                      <td>4.0 мин</td>
                    </tr>
                    <tr>
                      <td><span className="table-icon">📅</span> За месяц</td>
                      <td>5.2/10</td>
                      <td>8/10</td>
                      <td>3.5 мин</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Прогноз */}
          {activeTab === 'forecast' && (
            <div className="tab-content forecast-tab">
              <ForecastPanel
                address={marker.address}
                stopData={{
                  count: marker.count,
                  load: marker.load,
                  velocity: marker.velocity
                }}
                onClose={() => handleForecastStateChange({ isForecastOpen: false })}
                isOpen={forecastState.isForecastOpen}
                onToggle={(isOpen) => handleForecastStateChange({ isForecastOpen: isOpen })}
                forecastState={forecastState}
                onForecastDataUpdate={(data) => handleForecastStateChange({ forecastData: data })}
              />
            </div>
          )}

          {/* Прямая трансляция */}
          {activeTab === 'stream' && marker.url && (
            <div className="tab-content stream-tab">
              <div className="stream-header">
                <div className="stream-header">
                  <h3>🎥 Прямая трансляция с остановки</h3>
                </div>

                <div className="stream-container" style={{ width: '100%', height: '480px' }}>
                  <HlsPlayer
                    src={marker.url}
                    autoPlay
                    muted
                    controls
                    playsInline
                    style={{ width: '100%', height: '100%', backgroundColor: 'black' }}
                    onError={(e) => console.error('HLS error:', e)}
                  />
                </div>
              </div>

              <div className="stream-container">
                <div className="video-placeholder">
                  <div className="video-overlay">
                    <div className="live-badge">📹 LIVE</div>
                    <div className="video-info">
                      <div className="info-item">
                        <span className="info-label">📷 Камера:</span>
                        <span className="info-value">#CAM-{marker.id}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">🟢 Статус:</span>
                        <span className="info-value online">● Онлайн</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">⏱️ Задержка:</span>
                        <span className="info-value">2.3 сек</span>
                      </div>
                    </div>
                  </div>
                  <div className="video-fallback">
                    <div className="fallback-icon">📹</div>
                    <div className="fallback-text">
                      <p>Прямая трансляция с остановки</p>
                      <small>Используется RTSP поток для наблюдения</small>
                    </div>
                  </div>
                </div>
              </div>

              <div className="stream-controls">
                <button className="control-btn">
                  ⏸️ Пауза
                </button>
                <button className="control-btn">
                  ⏺️ Запись
                </button>
                <button className="control-btn">
                  📸 Снимок
                </button>
                <div className="volume-control">
                  <span className="volume-icon">🔊</span>
                  <input type="range" min="0" max="100" defaultValue="80" />
                  <span className="volume-value">80%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ModalContent;