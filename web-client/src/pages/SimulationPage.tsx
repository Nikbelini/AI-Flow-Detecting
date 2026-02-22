// src/pages/SimulationPage.tsx
import React, { useState, useEffect } from 'react';
import './SimulationPage.css';
import MapComponent from './Map/Map';
import { 
  Play, Save, RotateCcw, Download, Eye, EyeOff,
  Clock, Users, Bus, AlertTriangle, TrendingUp,
  Plus, Trash2, Settings
} from 'lucide-react';

interface SimulationState {
  status: 'idle' | 'running' | 'completed' | 'error';
  progress: number;
  currentHour: number;
  results: SimulationResults | null;
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

const SimulationPage: React.FC = () => {
  const [simState, setSimState] = useState<SimulationState>({
    status: 'idle',
    progress: 0,
    currentHour: 8,
    results: null
  });

  const [modifications, setModifications] = useState<Modification[]>([
    {
      id: '1',
      type: 'close_stop',
      targetId: 15,
      parameters: { hours: [7, 8, 9, 17, 18, 19] },
      enabled: true
    }
  ]);

  const [selectedStop, setSelectedStop] = useState<any>(null);
  const [editMode, setEditMode] = useState<'view' | 'select'>('view');
  const [showComparison, setShowComparison] = useState(true);
  const [selectedHour, setSelectedHour] = useState(8);

  // Симулированные результаты (для демонстрации)
  useEffect(() => {
    if (simState.status === 'completed' && !simState.results) {
      const mockResults: SimulationResults = {
        baseMetrics: {
          avgWaitTime: 8.2,
          maxWaitTime: 15.4,
          totalPassengers: 12450,
          avgLoad: 4.3,
          transportUtilization: 0.68
        },
        modifiedMetrics: {
          avgWaitTime: 11.4,
          maxWaitTime: 22.1,
          totalPassengers: 11870,
          avgLoad: 5.8,
          transportUtilization: 0.74
        },
        hourlyData: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          basePassengers: 400 + Math.sin(hour / 3) * 200 + 300,
          modifiedPassengers: 380 + Math.sin(hour / 3) * 220 + 280,
          baseWaitTime: 5 + Math.sin(hour / 4) * 3 + 2,
          modifiedWaitTime: 7 + Math.sin(hour / 4) * 4 + 3
        })),
        affectedStops: [
          { id: 16, address: 'ул. Ленина, 16', loadChange: 47, waitTimeChange: 3.2, status: 'worsened' },
          { id: 23, address: 'пр. Мира, 23', loadChange: 28, waitTimeChange: 2.1, status: 'worsened' },
          { id: 8, address: 'ул. Советская, 8', loadChange: -15, waitTimeChange: -1.8, status: 'improved' },
          { id: 42, address: 'пл. Победы', loadChange: 12, waitTimeChange: 0.9, status: 'worsened' }
        ]
      };
      
      setSimState(prev => ({ ...prev, results: mockResults }));
    }
  }, [simState.status]);

  // Запуск симуляции
  const runSimulation = () => {
    setSimState({
      status: 'running',
      progress: 0,
      currentHour: 8,
      results: null
    });

    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setSimState(prev => ({ ...prev, progress }));
      
      if (progress >= 100) {
        clearInterval(interval);
        setSimState(prev => ({ ...prev, status: 'completed', progress: 100 }));
      }
    }, 200);
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

  // Добавление модификации
  const addModification = (type: Modification['type']) => {
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

  // Получение цвета для остановки
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
    console.log('Marker clicked in simulation page:', marker);
    if (editMode === 'select') {
      setSelectedStop(marker);
    }
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
          </div>
          
          <div className="header-actions">
            <button 
              className="action-btn primary"
              onClick={runSimulation}
              disabled={simState.status === 'running' || modifications.length === 0}
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
                    <span>Текущая загрузка: {selectedStop.load || 0}/10</span>
                  </div>
                  <div className="stop-metric">
                    <Clock size={14} />
                    <span>Ср. ожидание: 8.2 мин</span>
                  </div>
                </div>
              </div>
              
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
                      {mod.targetId && <span>Остановка #{mod.targetId}</span>}
                      {mod.type === 'close_stop' && (
                        <span className="mod-params">
                          Часы: {mod.parameters.hours?.join(', ')}
                        </span>
                      )}
                      {mod.type === 'change_interval' && (
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
          <MapComponent 
            markers={[]}
            routes={[]}
            onMarkerClick={handleMarkerClick}
          />
          
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
                    <div className="metric-base">{simState.results.baseMetrics.avgWaitTime} мин</div>
                    <div className="metric-modified">{simState.results.modifiedMetrics.avgWaitTime} мин</div>
                    <div className="metric-change negative">
                      +{((simState.results.modifiedMetrics.avgWaitTime / simState.results.baseMetrics.avgWaitTime - 1) * 100).toFixed(1)}%
                    </div>
                  </div>
                  
                  <div className="metric-row">
                    <div className="metric-name">Макс. время ожидания</div>
                    <div className="metric-base">{simState.results.baseMetrics.maxWaitTime} мин</div>
                    <div className="metric-modified">{simState.results.modifiedMetrics.maxWaitTime} мин</div>
                    <div className="metric-change negative">
                      +{((simState.results.modifiedMetrics.maxWaitTime / simState.results.baseMetrics.maxWaitTime - 1) * 100).toFixed(1)}%
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
                    {simState.results.hourlyData.map((data, idx) => (
                      <div key={idx} className="chart-bar-group">
                        <div className="bar-container base">
                          <div 
                            className="bar-fill base"
                            style={{ 
                              height: `${(data.basePassengers / 1500) * 100}%`,
                              opacity: selectedHour === data.hour ? 1 : 0.6
                            }}
                          ></div>
                        </div>
                        <div className="bar-container modified">
                          <div 
                            className="bar-fill modified"
                            style={{ 
                              height: `${(data.modifiedPassengers / 1500) * 100}%`,
                              opacity: selectedHour === data.hour ? 1 : 0.6
                            }}
                          ></div>
                        </div>
                        <div 
                          className="hour-label"
                          onClick={() => setSelectedHour(data.hour)}
                        >
                          {data.hour}:00
                        </div>
                      </div>
                    ))}
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
                    <div key={stop.id} className={`affected-stop-item ${stop.status}`}>
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
                <button className="export-btn full-width">
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