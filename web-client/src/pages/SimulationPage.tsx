// src/pages/SimulationPage.tsx
import React, { useState, useEffect } from 'react';
import './SimulationPage.css';
import MapComponent from './Map/Map';

// Типы данных из сервиса моделирования
interface Scenario {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  status: 'draft' | 'ready' | 'running' | 'completed' | 'failed';
  modifications: Modification[];
  results?: SimulationResults;
}

interface Modification {
  id: string;
  type: 'add_stop' | 'remove_stop' | 'close_stop' | 'add_route' | 'change_interval' | 'change_capacity';
  targetId?: string;
  targetName?: string;
  parameters: Record<string, any>;
  hourCondition?: {
    start?: number;
    end?: number;
  };
}

interface SimulationResults {
  id: string;
  scenarioId: string;
  generatedAt: string;
  metrics: {
    avgWaitTime: number;
    maxWaitTime: number;
    totalPassengerKm: number;
    transportUtilization: number;
    maxLoad: number;
    efficiencyScore: number;
  };
  hourlyData: HourlyMetric[];
  comparison?: ComparisonData;
}

interface HourlyMetric {
  hour: number;
  waitTime: number;
  passengerCount: number;
  transportCount: number;
  load: number;
}

interface ComparisonData {
  baselineId: string;
  baselineName: string;
  differences: {
    avgWaitTime: number;
    maxWaitTime: number;
    totalPassengerKm: number;
    transportUtilization: number;
  };
}

const SimulationPage: React.FC = () => {
  // Состояния
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'parameters' | 'results' | 'comparison'>('parameters');
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [forecastDepth, setForecastDepth] = useState(24);

  // Загрузка сценариев при монтировании
  useEffect(() => {
    fetchScenarios();
  }, []);

  // Имитация прогресса симуляции
  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        setSimulationProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsRunning(false);
            return 100;
          }
          return prev + 5;
        });
      }, 300);
      return () => clearInterval(interval);
    }
  }, [isRunning]);

  const fetchScenarios = async () => {
    // TODO: GET /scenarios
    const mockScenarios: Scenario[] = [
      {
        id: '1',
        name: 'Закрытие остановки "Центральная"',
        description: 'Моделирование последствий закрытия главной остановки на 2 недели',
        createdAt: '2024-01-15T10:30:00',
        status: 'completed',
        modifications: [
          { id: 'm1', type: 'close_stop', targetId: '15', targetName: 'Центральная', parameters: {} }
        ],
        results: {
          id: 'r1',
          scenarioId: '1',
          generatedAt: '2024-01-15T10:31:00',
          metrics: {
            avgWaitTime: 11.4,
            maxWaitTime: 23.5,
            totalPassengerKm: 12450,
            transportUtilization: 0.78,
            maxLoad: 8.2,
            efficiencyScore: 0.64
          },
          hourlyData: Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            waitTime: 8 + Math.sin(i / 3) * 5 + Math.random() * 3,
            passengerCount: 200 + Math.sin(i / 6) * 150 + Math.random() * 50,
            transportCount: 12 + Math.floor(Math.random() * 4),
            load: 3 + Math.sin(i / 4) * 3 + Math.random() * 2
          }))
        }
      },
      {
        id: '2',
        name: 'Добавление маршрута №15А',
        description: 'Новый маршрут через спальный район',
        createdAt: '2024-01-16T14:20:00',
        status: 'ready',
        modifications: [
          { id: 'm2', type: 'add_route', parameters: { interval: 15, stops: ['18', '22', '31'] } }
        ]
      },
      {
        id: '3',
        name: 'Увеличение интервала на маршруте №7',
        description: 'С 10 до 15 минут в часы пик',
        createdAt: '2024-01-16T09:15:00',
        status: 'draft',
        modifications: [
          { 
            id: 'm3', 
            type: 'change_interval', 
            targetId: '7', 
            targetName: 'Маршрут №7',
            parameters: { oldInterval: 10, newInterval: 15 },
            hourCondition: { start: 7, end: 10 }
          }
        ]
      }
    ];
    setScenarios(mockScenarios);
  };

  const runSimulation = async () => {
    if (!selectedScenario) return;
    
    setIsRunning(true);
    setSimulationProgress(0);
    setActiveTab('results');
    
    // TODO: POST /simulations
    // Тело запроса: { scenarioId: selectedScenario.id, forecastHours: forecastDepth }
    
    // Имитация завершения
    setTimeout(() => {
      setIsRunning(false);
      setSimulationProgress(100);
    }, 6000);
  };

  const saveScenario = async () => {
    // TODO: POST /scenarios
    console.log('Сохранение сценария');
  };

  const deleteScenario = async (id: string) => {
    // TODO: DELETE /scenarios/{id}
    setScenarios(prev => prev.filter(s => s.id !== id));
    if (selectedScenario?.id === id) {
      setSelectedScenario(null);
    }
  };

  const cloneScenario = async (scenario: Scenario) => {
    // TODO: POST /scenarios/clone
    const newScenario = {
      ...scenario,
      id: Date.now().toString(),
      name: `${scenario.name} (копия)`,
      createdAt: new Date().toISOString(),
      status: 'draft' as const,
      results: undefined
    };
    setScenarios(prev => [...prev, newScenario]);
  };

  // Получение цвета для статуса
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return '#10b981';
      case 'running': return '#f59e0b';
      case 'failed': return '#ef4444';
      case 'ready': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'completed': return 'Завершён';
      case 'running': return 'Выполняется';
      case 'failed': return 'Ошибка';
      case 'ready': return 'Готов';
      case 'draft': return 'Черновик';
      default: return status;
    }
  };

  return (
    <div className="simulation-page">
      {/* Заголовок */}
      <div className="simulation-header">
        <div className="header-left">
          <h1 className="page-title">🎮 Лаборатория моделирования</h1>
          <p className="page-subtitle">Создавайте сценарии "что если" и оценивайте их последствия</p>
        </div>
        
        <div className="header-right">
          <button 
            className="create-scenario-btn"
            onClick={() => setIsCreating(true)}
          >
            + Новый сценарий
          </button>
          <button 
            className="refresh-btn"
            onClick={fetchScenarios}
          >
            🔄
          </button>
        </div>
      </div>

      {/* Основная сетка */}
      <div className="simulation-grid">
        {/* Левая колонка — список сценариев */}
        <div className="scenarios-panel">
          <div className="panel-header">
            <h3>📋 Мои сценарии</h3>
            <span className="scenarios-count">{scenarios.length}</span>
          </div>
          
          <div className="scenarios-list">
            {scenarios.map(scenario => (
              <div 
                key={scenario.id} 
                className={`scenario-item ${selectedScenario?.id === scenario.id ? 'selected' : ''}`}
                onClick={() => setSelectedScenario(scenario)}
              >
                <div className="scenario-header">
                  <div className="scenario-name">{scenario.name}</div>
                  <div 
                    className="scenario-status"
                    style={{ 
                      backgroundColor: getStatusColor(scenario.status),
                      color: 'white'
                    }}
                  >
                    {getStatusText(scenario.status)}
                  </div>
                </div>
                
                <div className="scenario-description">
                  {scenario.description}
                </div>
                
                <div className="scenario-meta">
                  <span className="scenario-date">
                    {new Date(scenario.createdAt).toLocaleDateString('ru-RU')}
                  </span>
                  <span className="scenario-modifications">
                    {scenario.modifications.length} изменений
                  </span>
                </div>
                
                {scenario.results && (
                  <div className="scenario-preview">
                    <div className="preview-metric">
                      <span className="metric-label">Ожидание</span>
                      <span className="metric-value">{scenario.results.metrics.avgWaitTime.toFixed(1)} мин</span>
                    </div>
                    <div className="preview-metric">
                      <span className="metric-label">Загрузка</span>
                      <span className="metric-value">{scenario.results.metrics.maxLoad.toFixed(1)}/10</span>
                    </div>
                  </div>
                )}
                
                <div className="scenario-actions">
                  <button 
                    className="action-btn clone"
                    onClick={(e) => {
                      e.stopPropagation();
                      cloneScenario(scenario);
                    }}
                    title="Клонировать"
                  >
                    📋
                  </button>
                  <button 
                    className="action-btn delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteScenario(scenario.id);
                    }}
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Центральная часть — редактор сценария */}
        <div className="editor-panel">
          {selectedScenario ? (
            <>
              {/* Вкладки */}
              <div className="editor-tabs">
                <button 
                  className={`tab ${activeTab === 'parameters' ? 'active' : ''}`}
                  onClick={() => setActiveTab('parameters')}
                >
                  ⚙️ Параметры
                </button>
                <button 
                  className={`tab ${activeTab === 'results' ? 'active' : ''}`}
                  onClick={() => setActiveTab('results')}
                  disabled={!selectedScenario.results && !isRunning}
                >
                  📊 Результаты
                </button>
                <button 
                  className={`tab ${activeTab === 'comparison' ? 'active' : ''}`}
                  onClick={() => setActiveTab('comparison')}
                  disabled={!selectedScenario.results}
                >
                  🔍 Сравнение
                </button>
              </div>

              {/* Панель параметров */}
              {activeTab === 'parameters' && (
                <div className="parameters-panel">
                  <div className="scenario-info">
                    <input 
                      type="text" 
                      className="scenario-name-input"
                      value={selectedScenario.name}
                      onChange={(e) => setSelectedScenario({
                        ...selectedScenario,
                        name: e.target.value
                      })}
                    />
                    <textarea 
                      className="scenario-description-input"
                      value={selectedScenario.description}
                      onChange={(e) => setSelectedScenario({
                        ...selectedScenario,
                        description: e.target.value
                      })}
                      rows={3}
                    />
                  </div>

                  <div className="modifications-list">
                    <h4>Изменения сети</h4>
                    {selectedScenario.modifications.map(mod => (
                      <div key={mod.id} className="modification-item">
                        <div className="modification-type">
                          {mod.type === 'close_stop' && '🚫 Закрытие остановки'}
                          {mod.type === 'add_route' && '➕ Новый маршрут'}
                          {mod.type === 'change_interval' && '⏱️ Изменение интервала'}
                          {mod.type === 'add_stop' && '📍 Новая остановка'}
                        </div>
                        <div className="modification-details">
                          {mod.targetName && <span className="target">{mod.targetName}</span>}
                          {mod.hourCondition && (
                            <span className="hour-condition">
                              {mod.hourCondition.start}:00 - {mod.hourCondition.end}:00
                            </span>
                          )}
                        </div>
                        <button className="remove-modification">✕</button>
                      </div>
                    ))}
                    
                    <button className="add-modification-btn">
                      + Добавить изменение
                    </button>
                  </div>

                  <div className="simulation-params">
                    <h4>Параметры симуляции</h4>
                    
                    <div className="param-row">
                      <label>Глубина прогноза</label>
                      <div className="param-control">
                        <input 
                          type="range" 
                          min="1" 
                          max="72" 
                          value={forecastDepth}
                          onChange={(e) => setForecastDepth(parseInt(e.target.value))}
                        />
                        <span className="param-value">{forecastDepth} ч</span>
                      </div>
                    </div>
                    
                    <div className="param-row">
                      <label>Показывать тепловую карту</label>
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          checked={showHeatmap}
                          onChange={(e) => setShowHeatmap(e.target.checked)}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="editor-actions">
                    <button 
                      className="save-btn"
                      onClick={saveScenario}
                    >
                      💾 Сохранить
                    </button>
                    <button 
                      className={`run-btn ${isRunning ? 'running' : ''}`}
                      onClick={runSimulation}
                      disabled={isRunning || selectedScenario.status === 'running'}
                    >
                      {isRunning ? (
                        <>⏳ Выполняется... {simulationProgress}%</>
                      ) : (
                        <>▶️ Запустить симуляцию</>
                      )}
                    </button>
                  </div>

                  {isRunning && (
                    <div className="simulation-progress">
                      <div 
                        className="progress-bar"
                        style={{ width: `${simulationProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              )}

              {/* Панель результатов */}
              {activeTab === 'results' && selectedScenario.results && (
                <div className="results-panel">
                  <div className="metrics-grid">
                    <div className="metric-card">
                      <div className="metric-icon">⏱️</div>
                      <div className="metric-content">
                        <div className="metric-label">Среднее ожидание</div>
                        <div className="metric-value">{selectedScenario.results.metrics.avgWaitTime.toFixed(1)} мин</div>
                      </div>
                    </div>
                    
                    <div className="metric-card">
                      <div className="metric-icon">⚠️</div>
                      <div className="metric-content">
                        <div className="metric-label">Макс. ожидание</div>
                        <div className="metric-value">{selectedScenario.results.metrics.maxWaitTime.toFixed(1)} мин</div>
                      </div>
                    </div>
                    
                    <div className="metric-card">
                      <div className="metric-icon">🚌</div>
                      <div className="metric-content">
                        <div className="metric-label">Использование транспорта</div>
                        <div className="metric-value">{(selectedScenario.results.metrics.transportUtilization * 100).toFixed(0)}%</div>
                      </div>
                    </div>
                    
                    <div className="metric-card">
                      <div className="metric-icon">📊</div>
                      <div className="metric-content">
                        <div className="metric-label">Макс. нагрузка</div>
                        <div className="metric-value">{selectedScenario.results.metrics.maxLoad.toFixed(1)}/10</div>
                      </div>
                    </div>
                  </div>

                  {/* График по часам */}
                  <div className="hourly-chart">
                    <h4>Динамика по часам</h4>
                    <div className="chart-controls">
                      <select className="chart-metric-select">
                        <option>Время ожидания</option>
                        <option>Пассажиропоток</option>
                        <option>Количество транспорта</option>
                        <option>Нагрузка</option>
                      </select>
                    </div>
                    
                    <div className="chart-container">
                      <div className="chart-bars">
                        {selectedScenario.results.hourlyData.map((data, i) => (
                          <div 
                            key={i} 
                            className="chart-bar-wrapper"
                            onMouseEnter={() => setSelectedHour(i)}
                            onMouseLeave={() => setSelectedHour(null)}
                          >
                            <div 
                              className="chart-bar"
                              style={{ 
                                height: `${(data.waitTime / 25) * 100}%`,
                                backgroundColor: selectedHour === i ? '#3b82f6' : '#60a5fa'
                              }}
                            >
                              {selectedHour === i && (
                                <div className="chart-tooltip">
                                  <div>{data.waitTime.toFixed(1)} мин</div>
                                  <div>{data.passengerCount} чел</div>
                                </div>
                              )}
                            </div>
                            <div className="chart-label">{i}:00</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="result-actions">
                    <button className="export-btn">📥 Экспорт результатов</button>
                    <button className="compare-btn" onClick={() => setActiveTab('comparison')}>
                      🔍 Сравнить с базовым сценарием
                    </button>
                  </div>
                </div>
              )}

              {/* Панель сравнения */}
              {activeTab === 'comparison' && selectedScenario.results && (
                <div className="comparison-panel">
                  <h4>Сравнение с базовым сценарием</h4>
                  
                  <div className="comparison-table">
                    <div className="comparison-row header">
                      <div className="metric-name">Метрика</div>
                      <div className="baseline-value">Базовый</div>
                      <div className="simulated-value">Симуляция</div>
                      <div className="difference">Изменение</div>
                    </div>
                    
                    <div className="comparison-row">
                      <div className="metric-name">Среднее время ожидания</div>
                      <div className="baseline-value">8.2 мин</div>
                      <div className="simulated-value">{selectedScenario.results.metrics.avgWaitTime.toFixed(1)} мин</div>
                      <div className="difference positive">+3.2 мин (39%)</div>
                    </div>
                    
                    <div className="comparison-row">
                      <div className="metric-name">Максимальное ожидание</div>
                      <div className="baseline-value">18.5 мин</div>
                      <div className="simulated-value">{selectedScenario.results.metrics.maxWaitTime.toFixed(1)} мин</div>
                      <div className="difference negative">+5.0 мин (27%)</div>
                    </div>
                    
                    <div className="comparison-row">
                      <div className="metric-name">Пассажиро-километры</div>
                      <div className="baseline-value">13,200</div>
                      <div className="simulated-value">{selectedScenario.results.metrics.totalPassengerKm}</div>
                      <div className="difference negative">-750 (5.7%)</div>
                    </div>
                    
                    <div className="comparison-row">
                      <div className="metric-name">Использование транспорта</div>
                      <div className="baseline-value">72%</div>
                      <div className="simulated-value">{(selectedScenario.results.metrics.transportUtilization * 100).toFixed(0)}%</div>
                      <div className="difference positive">+6%</div>
                    </div>
                  </div>

                  <div className="comparison-chart">
                    <h5>Динамика времени ожидания</h5>
                    <div className="dual-line-chart">
                      {selectedScenario.results.hourlyData.map((data, i) => (
                        <div key={i} className="chart-hour">
                          <div 
                            className="baseline-line"
                            style={{ height: `${(8 / 25) * 100}%` }}
                          ></div>
                          <div 
                            className="simulated-line"
                            style={{ height: `${(data.waitTime / 25) * 100}%` }}
                          ></div>
                          <div className="hour-label">{i}:00</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="no-scenario">
              <div className="no-scenario-icon">🎯</div>
              <h3>Выберите сценарий для моделирования</h3>
              <p>Или создайте новый, чтобы начать анализ "что если"</p>
              <button 
                className="create-first-scenario"
                onClick={() => setIsCreating(true)}
              >
                + Создать первый сценарий
              </button>
            </div>
          )}
        </div>

        {/* Правая колонка — карта */}
        <div className="map-panel">
          <div className="map-header">
            <h3>🗺️ Визуализация</h3>
            <div className="map-controls">
              <button 
                className={`map-control-btn ${showHeatmap ? 'active' : ''}`}
                onClick={() => setShowHeatmap(!showHeatmap)}
                title="Тепловая карта"
              >
                🔥
              </button>
              <button 
                className="map-control-btn"
                title="Центрировать"
              >
                🎯
              </button>
            </div>
          </div>
          
          <div className="map-container">
            <MapComponent />
            
            {selectedHour !== null && selectedScenario?.results && (
              <div className="hour-indicator">
                <div className="hour-badge">
                  ⏱️ Час {selectedHour}:00
                </div>
              </div>
            )}
            
            {isRunning && (
              <div className="simulation-overlay">
                <div className="simulation-spinner"></div>
                <p>Симуляция... {simulationProgress}%</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно создания сценария */}
      {isCreating && (
        <div className="modal-overlay">
          <div className="modal-content create-scenario-modal">
            <div className="modal-header">
              <h2>➕ Новый сценарий моделирования</h2>
              <button className="close-modal" onClick={() => setIsCreating(false)}>✕</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Название сценария</label>
                <input type="text" placeholder="Например: Закрытие остановки Центральная" />
              </div>
              
              <div className="form-group">
                <label>Описание</label>
                <textarea 
                  placeholder="Что вы хотите проверить?" 
                  rows={3}
                ></textarea>
              </div>
              
              <div className="form-group">
                <label>Базовый сценарий (опционально)</label>
                <select>
                  <option value="">Пустой сценарий</option>
                  {scenarios.filter(s => s.status === 'completed').map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setIsCreating(false)}>Отмена</button>
              <button className="create-btn" onClick={() => setIsCreating(false)}>
                Создать и перейти к редактированию
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationPage;