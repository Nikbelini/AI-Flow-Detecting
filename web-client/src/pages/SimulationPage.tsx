// src/pages/SimulationPage.tsx
import React, { useState, useEffect } from 'react';
import './SimulationPage.css';

interface Node {
  id: number;
  name: string;
  x: number;
  y: number;
  type: 'stop' | 'hub' | 'terminal';
  passengerFlow: number;
  affected?: boolean;
}

interface Edge {
  from: number;
  to: number;
  route: number;
  travelTime: number;
  affected?: boolean;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  icon: string;
  duration: number;
  intensity: 'low' | 'medium' | 'high';
  params: string[];
}

const SimulationPage: React.FC = () => {
  const [simulationStatus, setSimulationStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [activeScenario, setActiveScenario] = useState<string>('close_stop');
  const [duration, setDuration] = useState(4);
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [currentTime, setCurrentTime] = useState(8);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  
  const [nodes, setNodes] = useState<Node[]>([
    { id: 1, name: 'Центральная', x: 50, y: 30, type: 'hub', passengerFlow: 450, affected: true },
    { id: 2, name: 'Вокзал', x: 20, y: 50, type: 'terminal', passengerFlow: 320 },
    { id: 3, name: 'Университет', x: 80, y: 50, type: 'stop', passengerFlow: 280 },
    { id: 4, name: 'ТЦ "Северный"', x: 40, y: 70, type: 'stop', passengerFlow: 190 },
    { id: 5, name: 'Спорткомплекс', x: 60, y: 70, type: 'stop', passengerFlow: 150 },
    { id: 6, name: 'Парк Победы', x: 30, y: 10, type: 'stop', passengerFlow: 120 },
    { id: 7, name: 'Заводская', x: 70, y: 10, type: 'stop', passengerFlow: 100 },
    { id: 8, name: 'Южная', x: 50, y: 90, type: 'terminal', passengerFlow: 310 },
  ]);

  const [edges, setEdges] = useState<Edge[]>([
    { from: 1, to: 2, route: 101, travelTime: 8 },
    { from: 1, to: 3, route: 101, travelTime: 6 },
    { from: 1, to: 4, route: 102, travelTime: 5 },
    { from: 1, to: 5, route: 102, travelTime: 7 },
    { from: 1, to: 6, route: 103, travelTime: 4 },
    { from: 1, to: 7, route: 103, travelTime: 9 },
    { from: 1, to: 8, route: 104, travelTime: 12 },
    { from: 2, to: 4, route: 105, travelTime: 10 },
    { from: 3, to: 5, route: 106, travelTime: 8 },
    { from: 6, to: 7, route: 107, travelTime: 15 },
  ]);

  const scenarios: Record<string, Scenario> = {
    close_stop: {
      id: 'close_stop',
      name: '🚧 Закрытие остановки',
      description: 'Временное закрытие центральной остановки на ремонт',
      icon: '🚧',
      duration: 4,
      intensity: 'high',
      params: ['stop_id', 'duration_hours']
    },
    add_route: {
      id: 'add_route',
      name: '🆕 Новый маршрут',
      description: 'Введение нового маршрута транспорта через спальный район',
      icon: '🆕',
      duration: 8,
      intensity: 'medium',
      params: ['route_number', 'interval', 'stops_count']
    },
    increase_fleet: {
      id: 'increase_fleet',
      name: '🚍 Увеличение парка',
      description: 'Добавление транспортных единиц на существующие маршруты',
      icon: '🚍',
      duration: 24,
      intensity: 'low',
      params: ['vehicle_count', 'routes']
    },
    event: {
      id: 'event',
      name: '🎪 Массовое мероприятие',
      description: 'Рост пассажиропотока на 50% возле стадиона',
      icon: '🎪',
      duration: 6,
      intensity: 'high',
      params: ['location', 'duration', 'intensity']
    }
  };

  const quickScenarios = [
    { name: '🕐 Час пик', action: '+200% потока', time: '8-10, 17-19', icon: '🕐', scenario: 'event' },
    { name: '🚧 Ремонт дороги', action: 'Закрытие 2 улиц', time: '7 дней', icon: '🚧', scenario: 'close_stop' },
    { name: '🎵 Концерт', action: '+300% у стадиона', time: '20:00-23:00', icon: '🎵', scenario: 'event' },
    { name: '🎄 Праздник', action: 'Изменение маршрутов', time: 'Весь день', icon: '🎄', scenario: 'add_route' },
    { name: '🌧️ Погодные условия', action: 'Снижение скорости 30%', time: 'На сутки', icon: '🌧️', scenario: 'increase_fleet' }
  ];

  const getRouteColor = (route: number) => {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];
    return colors[route % colors.length];
  };

  const handleRunSimulation = () => {
    if (simulationStatus === 'running') return;
    
    setSimulationStatus('running');
    setSimulationProgress(0);
    
    // Анимируем прогресс
    const interval = setInterval(() => {
      setSimulationProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setSimulationStatus('completed');
          applyScenarioEffects();
          return 100;
        }
        return prev + 5;
      });
    }, 100);
  };

  const applyScenarioEffects = () => {
    const updatedNodes = nodes.map(node => {
      if (node.id === 1 && activeScenario === 'close_stop') {
        return { ...node, affected: true, passengerFlow: node.passengerFlow * 0.1 };
      }
      if (node.type === 'stop' && activeScenario === 'event') {
        return { ...node, passengerFlow: Math.floor(node.passengerFlow * 1.5) };
      }
      return node;
    });

    const updatedEdges = edges.map(edge => {
      if (edge.from === 1 || edge.to === 1) {
        return { ...edge, affected: true, travelTime: Math.floor(edge.travelTime * 1.3) };
      }
      return edge;
    });

    setNodes(updatedNodes);
    setEdges(updatedEdges);
  };

  const handleTimeChange = (newTime: number) => {
    setCurrentTime(newTime);
    // Обновляем интенсивность потока в зависимости от времени
    const hourFactor = newTime >= 8 && newTime <= 10 ? 1.5 : 
                      newTime >= 17 && newTime <= 19 ? 1.8 : 1.0;
    
    setNodes(prev => prev.map(node => ({
      ...node,
      passengerFlow: Math.floor(node.passengerFlow * hourFactor)
    })));
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && simulationStatus === 'completed') {
      timer = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= 23) {
            setIsPlaying(false);
            return 8;
          }
          handleTimeChange(prev + 1);
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, simulationStatus]);

  const getNodeSize = (flow: number) => {
    const baseSize = 40;
    const maxFlow = 500;
    return baseSize + (flow / maxFlow) * 30;
  };

  return (
    <div className="simulation-page">
      {/* Заголовок */}
      <div className="simulation-header">
        <div className="header-left">
          <h1 className="page-title">🎮 Симулятор "Что если?"</h1>
          <p className="page-subtitle">Моделирование изменений транспортной сети в реальном времени</p>
        </div>
        
        <div className="header-right">
          <div className="simulation-status">
            <div className={`status-indicator ${simulationStatus}`}>
              <span className="status-dot"></span>
              <span className="status-text">
                {simulationStatus === 'idle' && 'Готов к симуляции'}
                {simulationStatus === 'running' && 'Идет расчет...'}
                {simulationStatus === 'completed' && 'Симуляция завершена'}
              </span>
            </div>
          </div>
          
          <button 
            className="help-btn"
            onClick={() => {/* Открыть справку */}}
          >
            ❓ Помощь
          </button>
        </div>
      </div>

      {/* Основная сетка */}
      <div className="simulation-grid">
        {/* Граф транспортной сети */}
        <div className="graph-container">
          <div className="graph-header">
            <h3>🗺️ Граф транспортной сети</h3>
            <div className="graph-controls">
              <div className="time-display">
                <span className="time-label">Время: </span>
                <span className="time-value">{currentTime.toString().padStart(2, '0')}:00</span>
              </div>
              <div className="playback-controls">
                <button 
                  className="control-btn"
                  onClick={() => handleTimeChange(Math.max(0, currentTime - 1))}
                  disabled={simulationStatus !== 'completed'}
                >
                  ⏪
                </button>
                <button 
                  className={`play-btn ${isPlaying ? 'playing' : ''}`}
                  onClick={() => setIsPlaying(!isPlaying)}
                  disabled={simulationStatus !== 'completed'}
                >
                  {isPlaying ? '⏸️' : '▶️'}
                </button>
                <button 
                  className="control-btn"
                  onClick={() => handleTimeChange(Math.min(23, currentTime + 1))}
                  disabled={simulationStatus !== 'completed'}
                >
                  ⏩
                </button>
              </div>
            </div>
          </div>
          
          <div className="graph-wrapper">
            {/* Визуализация графа */}
            <div className="graph-visualization">
              {/* Отрисовка связей */}
              <svg className="edges-layer" width="100%" height="100%">
                {edges.map((edge, idx) => {
                  const fromNode = nodes.find(n => n.id === edge.from);
                  const toNode = nodes.find(n => n.id === edge.to);
                  if (!fromNode || !toNode) return null;
                  
                  return (
                    <line
                      key={idx}
                      x1={`${fromNode.x}%`}
                      y1={`${fromNode.y}%`}
                      x2={`${toNode.x}%`}
                      y2={`${toNode.y}%`}
                      stroke={getRouteColor(edge.route)}
                      strokeWidth={edge.affected ? 4 : 2}
                      strokeDasharray={edge.affected ? "5,5" : "none"}
                      opacity={edge.affected ? 0.8 : 0.6}
                      className="graph-edge"
                    />
                  );
                })}
              </svg>
              
              {/* Отрисовка узлов */}
              <div className="nodes-layer">
                {nodes.map(node => {
                  const size = getNodeSize(node.passengerFlow);
                  const typeColors = {
                    hub: '#ef4444',
                    terminal: '#3b82f6',
                    stop: '#10b981'
                  };
                  
                  return (
                    <div
                      key={node.id}
                      className={`graph-node ${node.type} ${node.affected ? 'affected' : ''}`}
                      style={{
                        left: `${node.x}%`,
                        top: `${node.y}%`,
                        width: `${size}px`,
                        height: `${size}px`,
                        transform: `translate(-${size/2}px, -${size/2}px)`,
                        backgroundColor: typeColors[node.type]
                      }}
                    >
                      <div className="node-info">
                        <div className="node-name">{node.name}</div>
                        <div className="node-flow">📊 {node.passengerFlow} чел/час</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Легенда */}
            <div className="graph-legend">
              <div className="legend-title">Легенда</div>
              <div className="legend-items">
                <div className="legend-item">
                  <div className="legend-color hub"></div>
                  <span>Хаб</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color terminal"></div>
                  <span>Терминал</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color stop"></div>
                  <span>Остановка</span>
                </div>
                <div className="legend-item">
                  <div className="legend-dash"></div>
                  <span>Затронуто</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Панель управления */}
        <div className="control-panel">
          <div className="control-header">
            <h3>⚙️ Конфигурация симуляции</h3>
          </div>
          
          <div className="control-body">
            {/* Выбор сценария */}
            <div className="scenario-selection">
              <h4>Тип сценария</h4>
              <div className="scenario-cards">
                {Object.values(scenarios).map(scenario => (
                  <div
                    key={scenario.id}
                    className={`scenario-card ${activeScenario === scenario.id ? 'active' : ''}`}
                    onClick={() => setActiveScenario(scenario.id)}
                  >
                    <div className="scenario-icon">{scenario.icon}</div>
                    <div className="scenario-info">
                      <div className="scenario-name">{scenario.name}</div>
                      <div className="scenario-desc">{scenario.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Настройки */}
            <div className="simulation-settings">
              <h4>Настройки параметров</h4>
              
              <div className="setting-group">
                <label className="setting-label">
                  Длительность: <span className="value-display">{duration} ч</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="24"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="range-slider"
                  disabled={simulationStatus === 'running'}
                />
                <div className="slider-labels">
                  <span>1ч</span>
                  <span>12ч</span>
                  <span>24ч</span>
                </div>
              </div>
              
              <div className="setting-group">
                <label className="setting-label">Интенсивность</label>
                <div className="intensity-buttons">
                  <button
                    className={`intensity-btn ${intensity === 'low' ? 'active' : ''}`}
                    onClick={() => setIntensity('low')}
                    disabled={simulationStatus === 'running'}
                  >
                    Слабая
                  </button>
                  <button
                    className={`intensity-btn ${intensity === 'medium' ? 'active' : ''}`}
                    onClick={() => setIntensity('medium')}
                    disabled={simulationStatus === 'running'}
                  >
                    Средняя
                  </button>
                  <button
                    className={`intensity-btn ${intensity === 'high' ? 'active' : ''}`}
                    onClick={() => setIntensity('high')}
                    disabled={simulationStatus === 'running'}
                  >
                    Сильная
                  </button>
                </div>
              </div>
              
              {/* Прогресс симуляции */}
              {simulationStatus === 'running' && (
                <div className="simulation-progress">
                  <div className="progress-header">
                    <span>Расчет симуляции</span>
                    <span className="progress-percent">{simulationProgress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${simulationProgress}%` }}
                    ></div>
                  </div>
                  <div className="progress-hint">
                    <span className="hint-icon">⏳</span>
                    Моделирование изменений...
                  </div>
                </div>
              )}
              
              {/* Результаты */}
              {simulationStatus === 'completed' && (
                <div className="simulation-results">
                  <h4>📊 Результаты симуляции</h4>
                  <div className="results-grid">
                    <div className="result-item negative">
                      <div className="result-label">Время ожидания</div>
                      <div className="result-value">+47%</div>
                    </div>
                    <div className="result-item positive">
                      <div className="result-label">Альтернативная загрузка</div>
                      <div className="result-value">+65%</div>
                    </div>
                    <div className="result-item negative">
                      <div className="result-label">Удовлетворение</div>
                      <div className="result-value">-18%</div>
                    </div>
                    <div className="result-item positive">
                      <div className="result-label">Общая эффективность</div>
                      <div className="result-value">-12%</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Кнопки управления */}
          <div className="control-actions">
            <button
              className={`run-btn ${simulationStatus === 'running' ? 'running' : ''}`}
              onClick={handleRunSimulation}
              disabled={simulationStatus === 'running'}
            >
              {simulationStatus === 'running' ? (
                <>
                  <span className="spinner"></span>
                  Идет расчет...
                </>
              ) : (
                '🚀 Запустить симуляцию'
              )}
            </button>
            
            <div className="secondary-actions">
              <button className="action-btn">
                💾 Сохранить сценарий
              </button>
              <button className="action-btn">
                📊 Экспорт результатов
              </button>
              <button className="action-btn">
                📋 Создать отчет
              </button>
            </div>
          </div>
        </div>

        {/* Быстрые сценарии */}
        <div className="quick-scenarios">
          <div className="scenarios-header">
            <h3>🚀 Быстрые сценарии</h3>
            <span className="scenarios-count">{quickScenarios.length} вариантов</span>
          </div>
          
          <div className="scenarios-list">
            {quickScenarios.map((scenario, idx) => (
              <div
                key={idx}
                className="quick-scenario-card"
                onClick={() => {
                  setActiveScenario(scenario.scenario);
                  setDuration(scenario.time.includes('день') ? 12 : 3);
                  setIntensity('high');
                }}
              >
                <div className="scenario-icon">{scenario.icon}</div>
                <div className="scenario-content">
                  <div className="scenario-name">{scenario.name}</div>
                  <div className="scenario-action">{scenario.action}</div>
                  <div className="scenario-meta">
                    <span className="scenario-time">⏱️ {scenario.time}</span>
                  </div>
                </div>
                <button className="apply-btn">Применить</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationPage;