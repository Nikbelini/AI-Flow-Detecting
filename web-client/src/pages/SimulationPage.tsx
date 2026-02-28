// src/pages/SimulationPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import './SimulationPage.css';
import SimulationMap, { type MapRoute } from './Map/SimulationMap'; // Импортируем тип
import { useStops } from '../hooks/api/useStops';
import { useRoutes } from '../hooks/api/useRoutes';
import type { Stop, Route as ApiRoute } from '../api/types';
import {
  Play, Save, RotateCcw, Download, Eye, EyeOff,
  Clock, Users, Bus, AlertTriangle, TrendingUp,
  Plus, Trash2, Settings, Route as RouteIcon
} from 'lucide-react';

// ========== Типы ==========

// Расширенный тип для остановки
interface ExtendedStop extends Stop {
  avg_load?: number;
  avg_count?: number;
  avg_wait_time?: number;
  max_count?: number;
  cluster?: 'office' | 'shopping' | 'residential' | 'transport_hub' | 'educational' | 'unknown';
  peak_hours?: number[];
  avg_pattern?: number[];
  color?: string;
}

// НЕ создаём отдельный ExtendedRoute - используем MapRoute из SimulationMap

interface SimulationState {
  status: 'idle' | 'running' | 'completed' | 'error';
  progress: number;
  currentHour: number;
  results: SimulationResults | null;
  simulationId?: string;
  errorMessage?: string;
}

interface SimulationResults {
  baseMetrics: Metrics;
  modifiedMetrics: Metrics;
  hourlyData: HourlyData[];
  affectedStops: AffectedStop[];
}

interface Metrics {
  avgWaitTime: number;
  maxWaitTime: number;
  totalPassengers: number;
  avgLoad: number;
  transportUtilization: number;
}

interface HourlyData {
  hour: number;
  basePassengers: number;
  modifiedPassengers: number;
  baseWaitTime: number;
  modifiedWaitTime: number;
}

interface AffectedStop {
  id: number;
  address: string;
  loadChange: number;
  waitTimeChange: number;
  status: 'improved' | 'worsened' | 'neutral';
}

type ModificationType = 'close_stop' | 'add_stop' | 'change_interval' | 'change_capacity';

interface Modification {
  id: string;
  type: ModificationType;
  targetType: 'stop' | 'route';
  targetId: number;
  parameters: Record<string, any>;
  enabled: boolean;
  label?: string;
}

// ========== Компонент ==========

const SimulationPage: React.FC = () => {
  const [simState, setSimState] = useState<SimulationState>({
    status: 'idle',
    progress: 0,
    currentHour: 8,
    results: null
  });

  const [modifications, setModifications] = useState<Modification[]>([]);
  const [selectedStop, setSelectedStop] = useState<ExtendedStop | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<MapRoute | null>(null); // Используем MapRoute
  const [editMode, setEditMode] = useState<'view' | 'select_stop' | 'select_route'>('view');
  const [selectedHour, setSelectedHour] = useState(8);
  const [cityStops, setCityStops] = useState<ExtendedStop[]>([]);
  const [cityRoutes, setCityRoutes] = useState<MapRoute[]>([]); // Тип MapRoute[]
  const [isLoading, setIsLoading] = useState(false);
  const [serviceAvailable, setServiceAvailable] = useState(true);

  const CITY_ID = 1;

  const { getStops } = useStops();
  const { getAllRoutes } = useRoutes();

  // ========== Загрузка данных ==========

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        
        const healthResponse = await fetch('http://localhost:8084/health');
        const healthData = await healthResponse.json();
        setServiceAvailable(healthData.status === 'healthy');

        const [stopsData, routesData] = await Promise.all([
          getStops(),
          getAllRoutes()
        ]);

        // Преобразуем остановки
        const stopsWithCoords: ExtendedStop[] = stopsData.map((stop: any) => ({
          id: Number(stop.id),
          address: stop.address || `Остановка ${stop.id}`,
          lat: stop.lat,
          lng: stop.lng,
          url: stop.url || '',
          count: stop.count || 0,
          velocity: stop.velocity || 0,
          load: stop.load || 3,
          cityId: CITY_ID,
          avg_load: stop.avg_load,
          avg_count: stop.avg_count,
          avg_wait_time: stop.avg_wait_time || 8.2,
          max_count: stop.max_count,
          cluster: stop.cluster,
          peak_hours: stop.peak_hours,
          avg_pattern: stop.avg_pattern,
          color: getStopColor(stop.id)
        }));

        // Преобразуем маршруты в формат MapRoute
        const routesForMap: MapRoute[] = routesData.map((route: any) => {
          // Генерируем путь из остановок
          const path = generateRoutePath(route.stops || [], stopsWithCoords);
          
          return {
            id: route.id,
            number: route.number || String(route.id),
            name: route.name,
            path: path,
            color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
            stops: route.stops?.map((s: any) => s.stopId || s.id) || [],
            intervalMinutes: route.intervalMinutes || 15,
            transportType: route.transportType || 'BUS',
            // Добавляем поля, которые могут понадобиться
            isActive: route.isActive,
            cityId: route.cityId
          };
        });

        setCityStops(stopsWithCoords);
        setCityRoutes(routesForMap); // ✅ Теперь типы совпадают
        
        console.log('✅ Загружено:', {
          stops: stopsWithCoords.length,
          routes: routesForMap.length
        });
      } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
        setServiceAvailable(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Функция для генерации пути маршрута из остановок
  const generateRoutePath = (stops: any[], allStops: ExtendedStop[]): [number, number][] => {
    if (!stops || stops.length === 0) return [];
    
    return stops
      .map((stop: any) => {
        const stopId = stop.stopId || stop.id;
        const foundStop = allStops.find(s => s.id === stopId);
        return foundStop ? [foundStop.lng, foundStop.lat] as [number, number] : null;
      })
      .filter(Boolean) as [number, number][];
  };

  // ========== Валидация и симуляция ==========

  const validateModifications = useCallback(async (mods: Modification[]) => {
    try {
      console.log('🔍 Отправка на валидацию:', JSON.stringify(mods, null, 2));
      
      const response = await fetch('http://localhost:8084/modifications/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mods)
      });

      const result = await response.json();
      console.log('📊 Результат валидации:', result);
      return result;
    } catch (error) {
      console.error('❌ Ошибка валидации:', error);
      return { valid: false, errors: [] };
    }
  }, []);

  const runSimulation = useCallback(async () => {
    if (!serviceAvailable) {
      alert('❌ Сервис моделирования недоступен');
      return;
    }

    if (modifications.length === 0) {
      alert('⚠️ Добавьте хотя бы одно изменение');
      return;
    }

    setSimState({
      status: 'running',
      progress: 0,
      currentHour: 8,
      results: null
    });

    try {
      console.log('🚀 Запуск симуляции с изменениями:', modifications);
      
      const response = await fetch('http://localhost:8084/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          city_id: CITY_ID,
          modifications: modifications.filter(m => m.enabled),
          simulation_hours: 24
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      let progress = 0;
      const interval = setInterval(() => {
        progress += 20;
        setSimState(prev => ({ ...prev, progress }));

        if (progress >= 100) {
          clearInterval(interval);
          setSimState(prev => ({
            ...prev,
            status: 'completed',
            progress: 100,
            results: data.results || data
          }));
        }
      }, 300);

    } catch (error) {
      console.error('❌ Ошибка симуляции:', error);
      setSimState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Неизвестная ошибка'
      }));
    }
  }, [modifications, serviceAvailable, CITY_ID]);

  // ========== Управление модификациями ==========

  const addStopModification = async (type: ModificationType) => {
    if (!selectedStop) {
      alert('⚠️ Сначала выберите остановку на карте');
      return;
    }

    if (!selectedStop.id) {
      console.error('❌ У выбранной остановки нет ID:', selectedStop);
      alert('❌ Ошибка: не удалось получить ID остановки');
      return;
    }

    const newMod: Modification = {
      id: Date.now().toString(),
      type,
      targetType: 'stop',
      targetId: selectedStop.id,
      parameters: type === 'close_stop' ? { hours: [7, 8, 9, 17, 18, 19] } :
                  type === 'change_interval' ? { interval: 15 } :
                  type === 'change_capacity' ? { capacity: 50 } : {},
      enabled: true,
      label: `${type === 'close_stop' ? '🚫' : type === 'change_interval' ? '⏱️' : '📦'} ${selectedStop.address}`
    };

    console.log('➕ Добавление модификации остановки:', newMod);

    const validation = await validateModifications([newMod]);
    if (!validation.valid) {
      console.error('❌ Валидация не пройдена:', validation.errors);
      alert('❌ Изменение не прошло валидацию: ' + 
            (validation.errors?.[0]?.error || 'Неизвестная ошибка'));
      return;
    }

    setModifications(prev => [...prev, newMod]);
  };

  const addRouteModification = async () => {
    if (!selectedRoute) {
      alert('⚠️ Сначала выберите маршрут на карте');
      return;
    }

    if (!selectedRoute.id) {
      console.error('❌ У выбранного маршрута нет ID:', selectedRoute);
      alert('❌ Ошибка: не удалось получить ID маршрута');
      return;
    }

    const newInterval = prompt('Введите новый интервал (в минутах):', String(selectedRoute.intervalMinutes || 15));
    if (!newInterval) return;

    const interval = parseInt(newInterval);
    if (isNaN(interval) || interval < 1 || interval > 60) {
      alert('❌ Интервал должен быть от 1 до 60 минут');
      return;
    }

    const newMod: Modification = {
      id: Date.now().toString(),
      type: 'change_interval',
      targetType: 'route',
      targetId: selectedRoute.id,
      parameters: { interval },
      enabled: true,
      label: `⏱️ Маршрут ${selectedRoute.number} (${interval} мин)`
    };

    console.log('➕ Добавление модификации маршрута:', newMod);

    const validation = await validateModifications([newMod]);
    if (!validation.valid) {
      console.error('❌ Валидация не пройдена:', validation.errors);
      alert('❌ Изменение не прошло валидацию');
      return;
    }

    setModifications(prev => [...prev, newMod]);
  };

  const removeModification = (id: string) => {
    setModifications(prev => prev.filter(m => m.id !== id));
  };

  const toggleModification = (id: string) => {
    setModifications(prev => prev.map(m =>
      m.id === id ? { ...m, enabled: !m.enabled } : m
    ));
  };

  const resetSimulation = () => {
    setSimState({
      status: 'idle',
      progress: 0,
      currentHour: 8,
      results: null
    });
    setModifications([]);
    setSelectedStop(null);
    setSelectedRoute(null);
  };

  // ========== Обработчики карты ==========

  const handleMarkerClick = (marker: any) => {
    console.log('📍 Marker clicked:', marker);
    
    if (editMode === 'select_stop') {
      if (!marker || !marker.id) {
        console.error('❌ Маркер без ID:', marker);
        return;
      }
      
      const fullStop = cityStops.find(s => s.id === marker.id);
      
      if (fullStop) {
        console.log('✅ Найдены полные данные остановки:', fullStop);
        setSelectedStop(fullStop);
        setSelectedRoute(null);
      } else {
        console.warn('⚠️ Полные данные не найдены');
        alert('❌ Ошибка: данные остановки не найдены');
      }
    } else if (editMode === 'select_route') {
      alert('⚠️ Сейчас режим выбора маршрута. Переключитесь на "Выбор остановки"');
    }
  };

  const handleRouteClick = (route: MapRoute) => {
    console.log('🛤️ Route clicked:', route);
    
    if (editMode === 'select_route') {
      if (!route || !route.id) {
        console.error('❌ Маршрут без ID:', route);
        return;
      }
      
      setSelectedRoute(route);
      setSelectedStop(null);
      
      console.log('✅ Выбран маршрут:', route.number);
    } else if (editMode === 'select_stop') {
      alert('⚠️ Сейчас режим выбора остановки. Переключитесь на "Выбор маршрута"');
    }
  };

  const getStopColor = (stopId: number): string => {
    if (!simState.results) return '#10b981';

    const affected = simState.results.affectedStops.find(a => a.id === stopId);
    if (!affected) return '#10b981';

    if (affected.loadChange > 30) return '#ef4444';
    if (affected.loadChange > 10) return '#f59e0b';
    return '#10b981';
  };

  const exportResults = () => {
    if (!simState.results) return;

    const dataStr = JSON.stringify(simState.results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = `simulation_results_${new Date().toISOString()}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="simulation-page">
      {/* Заголовок */}
      <div className="simulation-header">
        <div className="header-left">
          <h1 className="page-title">🎮 Моделирование "Что если"</h1>
          <p className="page-subtitle">
            Безопасно изменяйте транспортную сеть и мгновенно оценивайте последствия
          </p>
        </div>

        <div className="header-right">
          {!serviceAvailable && (
            <div className="service-warning">
              ⚠️ Сервис моделирования недоступен
            </div>
          )}

          <div className="simulation-status">
            <div className={`status-badge ${simState.status}`}>
              {simState.status === 'idle' && '⚪ Готов к запуску'}
              {simState.status === 'running' && '🟡 Выполняется...'}
              {simState.status === 'completed' && '🟢 Симуляция завершена'}
              {simState.status === 'error' && '🔴 Ошибка'}
            </div>

            {simState.status === 'running' && (
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${simState.progress}%` }}></div>
              </div>
            )}

            {simState.errorMessage && (
              <div className="error-message">{simState.errorMessage}</div>
            )}
          </div>

          <div className="header-actions">
            <button
              className="action-btn primary"
              onClick={runSimulation}
              disabled={simState.status === 'running' || modifications.length === 0 || !serviceAvailable}
            >
              <Play size={18} />
              Запустить симуляцию
            </button>

            <button
              className="action-btn secondary"
              onClick={resetSimulation}
            >
              <RotateCcw size={18} />
              Сбросить
            </button>
          </div>
        </div>
      </div>

      {/* Основная сетка */}
      <div className="simulation-grid">
        {/* Левая панель - инструменты моделирования */}
        <div className="left-panel">
          <div className="panel-section">
            <h3 className="panel-title">
              <Settings size={18} />
              Режим редактирования
            </h3>

            <div className="edit-mode-tabs">
              <button
                className={`mode-tab ${editMode === 'view' ? 'active' : ''}`}
                onClick={() => setEditMode('view')}
              >
                <Eye size={16} />
                Просмотр
              </button>
              <button
                className={`mode-tab ${editMode === 'select_stop' ? 'active' : ''}`}
                onClick={() => {
                  setEditMode('select_stop');
                  setSelectedStop(null);
                  setSelectedRoute(null);
                }}
              >
                <Plus size={16} />
                Выбор остановки
              </button>
              <button
                className={`mode-tab ${editMode === 'select_route' ? 'active' : ''}`}
                onClick={() => {
                  setEditMode('select_route');
                  setSelectedStop(null);
                  setSelectedRoute(null);
                }}
              >
                <RouteIcon size={16} />
                Выбор маршрута
              </button>
            </div>

            {editMode === 'select_stop' && (
              <div className="selection-hint">
                <div className="hint-dot"></div>
                <span>Кликните на остановку на карте</span>
              </div>
            )}
            {editMode === 'select_route' && (
              <div className="selection-hint">
                <div className="hint-dot" style={{ backgroundColor: '#3b82f6' }}></div>
                <span>Кликните на маршрут на карте</span>
              </div>
            )}
          </div>

          {/* Выбранная остановка */}
          {selectedStop && (
            <div className="panel-section selected-stop">
              <h3 className="panel-title">
                <Bus size={18} />
                Выбранная остановка
              </h3>

              <div className="stop-info">
                <div className="stop-address">{selectedStop.address}</div>
                <div className="stop-metrics">
                  <div className="stop-metric">
                    <Users size={14} />
                    <span>Загрузка: {selectedStop.load || selectedStop.avg_load || 0}/10</span>
                  </div>
                  <div className="stop-metric">
                    <Clock size={14} />
                    <span>Ср. ожидание: {(selectedStop.avg_wait_time || 8.2).toFixed(1)} мин</span>
                  </div>
                  {selectedStop.cluster && (
                    <div className="stop-metric">
                      <span className="cluster-badge">
                        {selectedStop.cluster === 'office' && '🏢 Офис'}
                        {selectedStop.cluster === 'shopping' && '🛍️ ТЦ'}
                        {selectedStop.cluster === 'residential' && '🏘️ Жилой'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {selectedStop.peak_hours && selectedStop.peak_hours.length > 0 && (
                <div className="stop-peak-hours">
                  <small>Пиковые часы: {selectedStop.peak_hours.map(h => `${h}:00`).join(', ')}</small>
                </div>
              )}

              <div className="quick-actions">
                <button
                  className="quick-action-btn"
                  onClick={() => addStopModification('close_stop')}
                >
                  🚫 Закрыть
                </button>
                <button
                  className="quick-action-btn"
                  onClick={() => addStopModification('change_interval')}
                >
                  ⏱️ Интервал
                </button>
                <button
                  className="quick-action-btn"
                  onClick={() => addStopModification('change_capacity')}
                >
                  📦 Вместимость
                </button>
              </div>
            </div>
          )}

          {/* Выбранный маршрут */}
          {selectedRoute && (
            <div className="panel-section selected-route">
              <h3 className="panel-title">
                <RouteIcon size={18} />
                Выбранный маршрут
              </h3>

              <div className="route-info">
                <div className="route-number">
                  {selectedRoute.transportType === 'BUS' && '🚌'}
                  {selectedRoute.transportType === 'TROLLEYBUS' && '🚎'}
                  {selectedRoute.transportType === 'TRAM' && '🚊'}
                  {selectedRoute.transportType === 'MINIBUS' && '🚐'}
                  {' '}{selectedRoute.number}
                </div>
                {selectedRoute.name && (
                  <div className="route-name">{selectedRoute.name}</div>
                )}
                <div className="route-metrics">
                  <div className="route-metric">
                    <Clock size={14} />
                    <span>Интервал: {selectedRoute.intervalMinutes} мин</span>
                  </div>
                  <div className="route-metric">
                    <span>Остановок: {selectedRoute.stops?.length || 0}</span>
                  </div>
                </div>
              </div>

              <div className="quick-actions">
                <button
                  className="quick-action-btn primary"
                  onClick={addRouteModification}
                >
                  ⏱️ Изменить интервал
                </button>
              </div>
            </div>
          )}

          {/* Активные изменения */}
          <div className="panel-section">
            <h3 className="panel-title">
              <Plus size={18} />
              Активные изменения ({modifications.length})
            </h3>

            {modifications.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">⚡</div>
                <p>Нет активных изменений</p>
                <p className="empty-hint">
                  Выберите остановку или маршрут и добавьте изменение
                </p>
              </div>
            ) : (
              <div className="modifications-list">
                {modifications.map(mod => (
                  <div key={mod.id} className={`modification-item ${!mod.enabled ? 'disabled' : ''}`}>
                    <div className="modification-header">
                      <div className="modification-type">
                        {mod.label || `${mod.type} #${mod.targetId}`}
                      </div>
                      <div className="modification-actions">
                        <button
                          className="mod-action"
                          onClick={() => toggleModification(mod.id)}
                          title={mod.enabled ? 'Отключить' : 'Включить'}
                        >
                          {mod.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                          className="mod-action delete"
                          onClick={() => removeModification(mod.id)}
                          title="Удалить"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="modification-details">
                      {mod.targetType === 'stop' && (
                        <span className="mod-target">Остановка #{mod.targetId}</span>
                      )}
                      {mod.targetType === 'route' && (
                        <span className="mod-target">Маршрут #{mod.targetId}</span>
                      )}
                      {mod.type === 'close_stop' && mod.parameters.hours && (
                        <span className="mod-params">
                          Часы: {mod.parameters.hours.join(', ')}
                        </span>
                      )}
                      {mod.type === 'change_interval' && mod.parameters.interval && (
                        <span className="mod-params">
                          Новый интервал: {mod.parameters.interval} мин
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Центральная область - карта */}
        <div className="map-area">
          {isLoading ? (
            <div className="loading-overlay">Загрузка остановок и маршрутов...</div>
          ) : (
            <SimulationMap
              markers={cityStops.map(stop => ({
                ...stop,
                color: getStopColor(stop.id)
              }))}
              routes={cityRoutes} // ✅ Теперь cityRoutes имеет тип MapRoute[]
              onMarkerClick={handleMarkerClick}
              onRouteClick={handleRouteClick}
              selectionMode={editMode !== 'view'}
              selectedStopId={selectedStop?.id}
              selectedRouteId={selectedRoute?.id}
            />
          )}

          {(editMode === 'select_stop' || editMode === 'select_route') && (
            <div className="map-overlay-hint">
              <div className="hint-box">
                <div className="hint-arrow">👆</div>
                <p>
                  {editMode === 'select_stop' 
                    ? 'Кликните на остановку на карте' 
                    : 'Кликните на маршрут на карте'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Правая панель - результаты */}
        <div className="right-panel">
          {simState.results ? (
            <>
              <div className="panel-section">
                <h3 className="panel-title">
                  <TrendingUp size={18} />
                  Ключевые метрики
                </h3>

                <div className="metrics-comparison">
                  <div className="metric-row header">
                    <div className="metric-name">Метрика</div>
                    <div className="metric-base">Было</div>
                    <div className="metric-modified">Стало</div>
                    <div className="metric-change">Δ</div>
                  </div>

                  <div className="metric-row">
                    <div className="metric-name">Ср. время ожидания</div>
                    <div className="metric-base">{simState.results.baseMetrics.avgWaitTime.toFixed(1)} мин</div>
                    <div className="metric-modified">{simState.results.modifiedMetrics.avgWaitTime.toFixed(1)} мин</div>
                    <div className={`metric-change ${simState.results.modifiedMetrics.avgWaitTime > simState.results.baseMetrics.avgWaitTime ? 'negative' : 'positive'}`}>
                      {((simState.results.modifiedMetrics.avgWaitTime / simState.results.baseMetrics.avgWaitTime - 1) * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div className="metric-row">
                    <div className="metric-name">Макс. время ожидания</div>
                    <div className="metric-base">{simState.results.baseMetrics.maxWaitTime.toFixed(1)} мин</div>
                    <div className="metric-modified">{simState.results.modifiedMetrics.maxWaitTime.toFixed(1)} мин</div>
                    <div className={`metric-change ${simState.results.modifiedMetrics.maxWaitTime > simState.results.baseMetrics.maxWaitTime ? 'negative' : 'positive'}`}>
                      {((simState.results.modifiedMetrics.maxWaitTime / simState.results.baseMetrics.maxWaitTime - 1) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel-section">
                <h3 className="panel-title">
                  <Clock size={18} />
                  Почасовая динамика
                </h3>

                <div className="hourly-chart">
                  <div className="chart-bars">
                    {simState.results.hourlyData.map((data, idx) => {
                      const maxPassengers = Math.max(
                        ...simState.results!.hourlyData.map(d => Math.max(d.basePassengers, d.modifiedPassengers))
                      );

                      return (
                        <div key={idx} className="chart-bar-group">
                          <div className="bar-container base">
                            <div
                              className="bar-fill base"
                              style={{
                                height: `${(data.basePassengers / maxPassengers) * 100}%`,
                                opacity: selectedHour === data.hour ? 1 : 0.6
                              }}
                              title={`Базовый: ${Math.round(data.basePassengers)} пасс.`}
                            ></div>
                          </div>
                          <div className="bar-container modified">
                            <div
                              className="bar-fill modified"
                              style={{
                                height: `${(data.modifiedPassengers / maxPassengers) * 100}%`,
                                opacity: selectedHour === data.hour ? 1 : 0.6
                              }}
                              title={`С изменениями: ${Math.round(data.modifiedPassengers)} пасс.`}
                            ></div>
                          </div>
                          <div
                            className={`hour-label ${selectedHour === data.hour ? 'active' : ''}`}
                            onClick={() => setSelectedHour(data.hour)}
                          >
                            {data.hour}:00
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="chart-legend">
                    <div className="legend-item">
                      <div className="legend-color base"></div>
                      <span>Базовый сценарий</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-color modified"></div>
                      <span>С изменениями</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel-section">
                <h3 className="panel-title">
                  <AlertTriangle size={18} />
                  Наиболее затронутые остановки
                </h3>

                <div className="affected-stops-list">
                  {simState.results.affectedStops.map(stop => (
                    <div
                      key={stop.id}
                      className={`affected-stop-item ${stop.status}`}
                      onClick={() => {
                        const stopData = cityStops.find(s => s.id === stop.id);
                        if (stopData) setSelectedStop(stopData);
                      }}
                    >
                      <div className="stop-address">{stop.address}</div>
                      <div className="stop-changes">
                        <div className="change-badge load">
                          <span className="change-label">Нагрузка</span>
                          <span className={`change-value ${stop.loadChange > 0 ? 'up' : 'down'}`}>
                            {stop.loadChange > 0 ? '↑' : '↓'} {Math.abs(stop.loadChange)}%
                          </span>
                        </div>
                        <div className="change-badge wait">
                          <span className="change-label">Ожидание</span>
                          <span className={`change-value ${stop.waitTimeChange > 0 ? 'up' : 'down'}`}>
                            {stop.waitTimeChange > 0 ? '↑' : '↓'} {Math.abs(stop.waitTimeChange)} мин
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel-section">
                <button
                  className="export-btn full-width"
                  onClick={exportResults}
                >
                  <Download size={18} />
                  Экспортировать результаты
                </button>
              </div>
            </>
          ) : (
            <div className="empty-results">
              <div className="empty-icon">📊</div>
              <h3>Нет результатов</h3>
              <p>Добавьте изменения и запустите симуляцию</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimulationPage;