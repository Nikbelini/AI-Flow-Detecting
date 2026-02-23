// src/pages/SimulationPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import './SimulationPage.css';
import MapComponent from './Map/Map';
import type { Stop } from '../api/types';
import { 
  Play, Save, RotateCcw, Download, Eye, EyeOff,
  Clock, Users, Bus, AlertTriangle, TrendingUp,
  Plus, Trash2, Settings
} from 'lucide-react';

// ========== Типы ==========

// Расширенный тип для остановки с данными из modeling-service
interface ExtendedStop extends Stop {
  avg_load?: number;
  avg_count?: number;
  avg_wait_time?: number;
  max_count?: number;
  cluster?: 'office' | 'shopping' | 'residential' | 'transport_hub' | 'educational' | 'unknown';
  peak_hours?: number[];
  avg_pattern?: number[];
  coordinates?: [number, number];
  color?: string;
}

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

interface Modification {
  id: string;
  type: 'close_stop' | 'add_stop' | 'change_interval' | 'change_capacity';
  targetId?: number;
  parameters: Record<string, any>;
  enabled: boolean;
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
  const [editMode, setEditMode] = useState<'view' | 'select'>('view');
  const [selectedHour, setSelectedHour] = useState(8);
  const [cityStops, setCityStops] = useState<ExtendedStop[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [serviceAvailable, setServiceAvailable] = useState(true);

  // ID города (можно брать из контекста/роута)
  const CITY_ID = 1;

  // ========== Загрузка данных ==========

  // Проверка доступности сервиса при загрузке
  useEffect(() => {
    const checkService = async () => {
      try {
        const response = await fetch('http://localhost:8084/health');
        const data = await response.json();
        setServiceAvailable(data.status === 'healthy');
        
        if (data.status === 'healthy') {
          loadCityStops();
        }
      } catch (error) {
        console.error('Сервис моделирования недоступен:', error);
        setServiceAvailable(false);
      }
    };
    
    checkService();
  }, []);

  // Загрузка остановок города
  const loadCityStops = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`http://localhost:8084/stops/${CITY_ID}`);
      const data = await response.json();
      
      // Преобразуем в формат для карты
      const stopsWithCoords: ExtendedStop[] = data.map((stop: any) => ({
        id: stop.id,
        address: stop.address,
        lat: stop.lat,
        lng: stop.lng,
        url: stop.url || '',
        count: stop.count || 0,
        velocity: stop.velocity || 0,
        load: stop.load || stop.avg_load || 3,
        cityId: CITY_ID,
        avg_load: stop.avg_load,
        avg_count: stop.avg_count,
        avg_wait_time: stop.avg_wait_time || 8.2,
        max_count: stop.max_count,
        cluster: stop.cluster,
        peak_hours: stop.peak_hours,
        avg_pattern: stop.avg_pattern,
        coordinates: [stop.lng, stop.lat] as [number, number]
      }));
      
      setCityStops(stopsWithCoords);
    } catch (error) {
      console.error('Ошибка загрузки остановок:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Получение деталей остановки
  const getStopDetails = useCallback(async (stopId: number) => {
    try {
      const response = await fetch(`http://localhost:8084/stop/${stopId}`);
      return await response.json();
    } catch (error) {
      console.error('Ошибка загрузки деталей остановки:', error);
      return null;
    }
  }, []);

  // ========== Симуляция ==========

  // Валидация изменений
  const validateModifications = useCallback(async (mods: Modification[]) => {
    try {
      const response = await fetch('http://localhost:8084/modifications/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mods.filter(m => m.enabled))
      });
      
      const result = await response.json();
      if (!result.valid) {
        console.warn('Ошибки валидации:', result.errors);
      }
      return result;
    } catch (error) {
      console.error('Ошибка валидации:', error);
      return { valid: false, errors: [] };
    }
  }, []);

  // Запуск симуляции
  const runSimulation = useCallback(async () => {
    if (!serviceAvailable) {
      alert('Сервис моделирования недоступен');
      return;
    }

    if (modifications.length === 0) {
      alert('Добавьте хотя бы одно изменение');
      return;
    }

    setSimState({
      status: 'running',
      progress: 0,
      currentHour: 8,
      results: null
    });

    try {
      // Отправляем запрос на симуляцию
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
      
      // Симулируем прогресс (так как у нас синхронный запрос)
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
      console.error('Ошибка симуляции:', error);
      setSimState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Неизвестная ошибка'
      }));
    }
  }, [modifications, serviceAvailable, CITY_ID]);

  // ========== Управление модификациями ==========

  // Добавление модификации
  const addModification = async (type: Modification['type']) => {
    if (!selectedStop && type !== 'add_stop') {
      alert('Сначала выберите остановку на карте');
      return;
    }

    const newMod: Modification = {
      id: Date.now().toString(),
      type,
      targetId: selectedStop?.id,
      parameters: type === 'close_stop' ? { hours: [7, 8, 9, 17, 18, 19] } :
                   type === 'change_interval' ? { interval: 15 } :
                   type === 'change_capacity' ? { capacity: 50 } : {},
      enabled: true
    };

    // Валидируем перед добавлением
    const validation = await validateModifications([newMod]);
    if (!validation.valid) {
      alert('Изменение не прошло валидацию');
      return;
    }

    setModifications(prev => [...prev, newMod]);
  };

  // Удаление модификации
  const removeModification = (id: string) => {
    setModifications(prev => prev.filter(m => m.id !== id));
  };

  // Переключение модификации
  const toggleModification = (id: string) => {
    setModifications(prev => prev.map(m => 
      m.id === id ? { ...m, enabled: !m.enabled } : m
    ));
  };

  // Сброс симуляции
  const resetSimulation = () => {
    setSimState({
      status: 'idle',
      progress: 0,
      currentHour: 8,
      results: null
    });
    setModifications([]);
    setSelectedStop(null);
  };

  // ========== Вспомогательные функции ==========

  // Получение цвета для остановки (на основе результатов)
  const getStopColor = (stopId: number): string => {
    if (!simState.results) return '#10b981';
    
    const affected = simState.results.affectedStops.find(a => a.id === stopId);
    if (!affected) return '#10b981';
    
    if (affected.loadChange > 30) return '#ef4444';
    if (affected.loadChange > 10) return '#f59e0b';
    return '#10b981';
  };

  // Обработчик клика на маркер
  const handleMarkerClick = (marker: any) => {
    console.log('Marker clicked:', marker);
    if (editMode === 'select') {
      // Ищем полные данные остановки
      const fullStop = cityStops.find(s => s.id === marker.id);
      setSelectedStop(fullStop || marker);
    }
  };

  // Экспорт результатов
  const exportResults = () => {
    if (!simState.results) return;
    
    const dataStr = JSON.stringify(simState.results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `simulation_results_${new Date().toISOString()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // ========== Render ==========

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
          {/* Индикатор доступности сервиса */}
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
                className={`mode-tab ${editMode === 'select' ? 'active' : ''}`}
                onClick={() => setEditMode('select')}
              >
                <Plus size={16} />
                Выбор остановки
              </button>
            </div>
            
            {editMode === 'select' && (
              <div className="selection-hint">
                <div className="hint-dot"></div>
                <span>Кликните на остановку на карте</span>
              </div>
            )}
          </div>

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
                    <span>
                      Текущая загрузка: {
                        selectedStop.load || 
                        selectedStop.avg_load || 
                        0
                      }/10
                    </span>
                  </div>
                  <div className="stop-metric">
                    <Clock size={14} />
                    <span>
                      Ср. ожидание: {
                        (selectedStop.avg_wait_time || 8.2).toFixed(1)
                      } мин
                    </span>
                  </div>
                  {selectedStop.cluster && (
                    <div className="stop-metric">
                      <span className="cluster-badge">
                        {selectedStop.cluster === 'office' && '🏢 Офис'}
                        {selectedStop.cluster === 'shopping' && '🛍️ ТЦ'}
                        {selectedStop.cluster === 'residential' && '🏘️ Жилой'}
                        {selectedStop.cluster === 'transport_hub' && '🚉 Транспортный узел'}
                        {selectedStop.cluster === 'educational' && '📚 Образовательный'}
                        {selectedStop.cluster === 'unknown' && '❓ Неизвестно'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Пиковые часы (если есть) */}
              {selectedStop.peak_hours && selectedStop.peak_hours.length > 0 && (
                <div className="stop-peak-hours">
                  <small>Пиковые часы: {selectedStop.peak_hours.map(h => `${h}:00`).join(', ')}</small>
                </div>
              )}
              
              <div className="quick-actions">
                <button 
                  className="quick-action-btn"
                  onClick={() => addModification('close_stop')}
                >
                  🚫 Закрыть
                </button>
                <button 
                  className="quick-action-btn"
                  onClick={() => addModification('change_interval')}
                >
                  ⏱️ Интервал
                </button>
                <button 
                  className="quick-action-btn"
                  onClick={() => addModification('change_capacity')}
                >
                  📦 Вместимость
                </button>
              </div>
            </div>
          )}

          <div className="panel-section">
            <h3 className="panel-title">
              <Plus size={18} />
              Активные изменения
            </h3>
            
            {modifications.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">⚡</div>
                <p>Нет активных изменений</p>
                <p className="empty-hint">
                  Выберите остановку на карте и добавьте изменение
                </p>
              </div>
            ) : (
              <div className="modifications-list">
                {modifications.map(mod => (
                  <div key={mod.id} className={`modification-item ${!mod.enabled ? 'disabled' : ''}`}>
                    <div className="modification-header">
                      <div className="modification-type">
                        {mod.type === 'close_stop' && '🚫 Закрытие остановки'}
                        {mod.type === 'add_stop' && '➕ Новая остановка'}
                        {mod.type === 'change_interval' && '⏱️ Изменение интервала'}
                        {mod.type === 'change_capacity' && '📦 Изменение вместимости'}
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
                      {mod.targetId && (
                        <span>Остановка #{mod.targetId}</span>
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
                      {mod.type === 'change_capacity' && mod.parameters.capacity && (
                        <span className="mod-params">
                          Вместимость: {mod.parameters.capacity}
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
            <div className="loading-overlay">Загрузка остановок...</div>
          ) : (
            <MapComponent 
              markers={cityStops.map(stop => ({
                ...stop,
                color: getStopColor(stop.id)
              }))}
              routes={[]}
              onMarkerClick={handleMarkerClick}
            />
          )}
          
          {editMode === 'select' && (
            <div className="map-overlay-hint">
              <div className="hint-box">
                <div className="hint-arrow">👆</div>
                <p>Кликните на остановку на карте</p>
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
                  
                  <div className="metric-row">
                    <div className="metric-name">Всего пассажиров</div>
                    <div className="metric-base">{simState.results.baseMetrics.totalPassengers.toLocaleString()}</div>
                    <div className="metric-modified">{simState.results.modifiedMetrics.totalPassengers.toLocaleString()}</div>
                    <div className={`metric-change ${simState.results.modifiedMetrics.totalPassengers < simState.results.baseMetrics.totalPassengers ? 'negative' : 'positive'}`}>
                      {((simState.results.modifiedMetrics.totalPassengers / simState.results.baseMetrics.totalPassengers - 1) * 100).toFixed(1)}%
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