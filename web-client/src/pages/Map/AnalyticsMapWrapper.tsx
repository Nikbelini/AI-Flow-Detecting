// src/pages/Map/AnalyticsMapWrapper.tsx
import React, { useState } from 'react';
import { Card, Row, Col, Button, Form, Dropdown, ProgressBar, Alert, Badge } from 'react-bootstrap';
import MapComponent from './MapComponent';
import './AnalyticsMapWrapper.css';

// Типы
type MapMode = 'realtime' | 'simulation' | 'comparison';
type SimulationStatus = 'idle' | 'ready' | 'running' | 'completed';

interface Scenario {
  id: string;
  name: string;
  description: string;
  changes: any[];
}

interface Metric {
  name: string;
  current: number;
  simulated: number;
  unit: string;
  isPositive: boolean;
}

const AnalyticsMapWrapper: React.FC = () => {
  // Состояния для аналитики
  const [mapMode, setMapMode] = useState<MapMode>('realtime');
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus>('idle');
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [predictionDepth, setPredictionDepth] = useState(24);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);

  // Демо-данные
  const demoMarkers = [
    { id: 1, address: "Остановка 1", count: 15, load: 2, lat: 48.2412, lng: 54.1851 },
    { id: 2, address: "Остановка 2", count: 45, load: 7, lat: 48.2512, lng: 54.1951 },
    { id: 3, address: "Остановка 3", count: 32, load: 4, lat: 48.2312, lng: 54.1751 },
  ];

  const demoScenarios: Scenario[] = [
    { id: '1', name: 'Закрытие центральной остановки', description: 'Временное закрытие на 4 часа', changes: [] },
    { id: '2', name: 'Новый маршрут №45', description: 'Добавление маршрута через спальный район', changes: [] },
    { id: '3', name: '+30% пассажиропотока', description: 'Моделирование часа пик', changes: [] },
  ];

  const demoMetrics: Metric[] = [
    { name: 'Среднее время ожидания', current: 8.2, simulated: 12.1, unit: 'мин', isPositive: false },
    { name: 'Пассажиро-километры', current: 12500, simulated: 11800, unit: '', isPositive: true },
    { name: 'Использование транспорта', current: 0.67, simulated: 0.72, unit: '', isPositive: true },
    { name: 'Максимальная нагрузка', current: 145, simulated: 210, unit: 'чел', isPositive: false },
  ];

  // Обработчики
  const handleModeChange = (mode: MapMode) => {
    setMapMode(mode);
    setSimulationStatus(mode === 'simulation' ? 'ready' : 'idle');
  };

  const handleRunSimulation = () => {
    setSimulationStatus('running');
    setTimeout(() => {
      setSimulationStatus('completed');
    }, 3000);
  };

  const handleScenarioSelect = (scenario: Scenario) => {
    setActiveScenario(scenario);
  };

  // Компонент метрики
  const MetricCard = ({ metric }: { metric: Metric }) => {
    const diff = ((metric.simulated - metric.current) / metric.current * 100).toFixed(1);
    
    return (
      <Card className="h-100 metric-card">
        <Card.Body className="p-2">
          <div className="metric-title">{metric.name}</div>
          <div className="d-flex align-items-center">
            <span className="metric-value">
              {metric.simulated}{metric.unit}
            </span>
            {mapMode === 'comparison' && (
              <span className={`metric-diff ${parseFloat(diff) >= 0 ? 'negative' : 'positive'}`}>
                {diff}%
              </span>
            )}
          </div>
          {mapMode === 'comparison' && (
            <div className="metric-old">Было: {metric.current}{metric.unit}</div>
          )}
        </Card.Body>
      </Card>
    );
  };

  return (
    <div className="analytics-wrapper">
      {/* Верхняя панель управления */}
      <Card className="mb-3 control-panel">
        <Card.Body className="p-2">
          <Row className="align-items-center">
            {/* Режимы карты */}
            <Col md={3}>
              <div className="mode-selector">
                <Button
                  size="sm"
                  variant={mapMode === 'realtime' ? 'primary' : 'outline-primary'}
                  onClick={() => handleModeChange('realtime')}
                  className="me-1 mb-1"
                >
                  📍 Реальное время
                </Button>
                <Button
                  size="sm"
                  variant={mapMode === 'simulation' ? 'primary' : 'outline-primary'}
                  onClick={() => handleModeChange('simulation')}
                  className="me-1 mb-1"
                >
                  🎮 Симуляция
                </Button>
                <Button
                  size="sm"
                  variant={mapMode === 'comparison' ? 'primary' : 'outline-primary'}
                  onClick={() => handleModeChange('comparison')}
                  className="mb-1"
                >
                  📊 Сравнение
                </Button>
              </div>
            </Col>

            {/* Управление симуляцией */}
            <Col md={6}>
              {mapMode === 'simulation' && (
                <div className="d-flex align-items-center simulation-controls">
                  <Form.Group className="me-3 mb-0" style={{ minWidth: '200px' }}>
                    <Form.Label className="mb-0 small">Глубина: {predictionDepth}ч</Form.Label>
                    <Form.Range
                      min="1"
                      max="72"
                      value={predictionDepth}
                      onChange={(e) => setPredictionDepth(parseInt(e.target.value))}
                      size="sm"
                    />
                  </Form.Group>

                  <Dropdown className="me-3">
                    <Dropdown.Toggle size="sm" variant="outline-secondary">
                      {activeScenario?.name || 'Выберите сценарий'}
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      {demoScenarios.map(scenario => (
                        <Dropdown.Item 
                          key={scenario.id}
                          onClick={() => handleScenarioSelect(scenario)}
                        >
                          {scenario.name}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>

                  <Button
                    size="sm"
                    variant={simulationStatus === 'running' ? 'warning' : 'success'}
                    onClick={handleRunSimulation}
                    disabled={simulationStatus === 'running' || !activeScenario}
                    className="me-2"
                  >
                    {simulationStatus === 'running' ? '⏳ Расчет...' : '🚀 Запустить'}
                  </Button>

                  <Form.Check
                    type="switch"
                    id="heatmap-switch"
                    label="Проблемы"
                    checked={showHeatmap}
                    onChange={(e) => setShowHeatmap(e.target.checked)}
                    className="small"
                  />
                </div>
              )}
            </Col>

            {/* Статус и действия */}
            <Col md={3} className="text-end">
              <div className="d-flex align-items-center justify-content-end">
                <Badge bg={
                  simulationStatus === 'idle' ? 'secondary' :
                  simulationStatus === 'running' ? 'warning' : 'success'
                } className="me-2">
                  {simulationStatus === 'idle' && 'Готов'}
                  {simulationStatus === 'running' && 'В процессе'}
                  {simulationStatus === 'completed' && 'Завершено'}
                </Badge>
                
                <Dropdown>
                  <Dropdown.Toggle size="sm" variant="outline-primary">
                    📁 Действия
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item>📥 Экспорт данных</Dropdown.Item>
                    <Dropdown.Item>📄 Создать отчет</Dropdown.Item>
                    <Dropdown.Item>💾 Сохранить сценарий</Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item>⚙️ Настройки</Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </Col>
          </Row>

          {/* Прогресс бар для симуляции */}
          {simulationStatus === 'running' && (
            <div className="mt-2">
              <ProgressBar animated now={65} label="65%" className="mb-1" />
              <small className="text-muted">Идет расчет модели пассажиропотока...</small>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Панель метрик */}
      <Card className="mb-3 metrics-panel">
        <Card.Body className="p-2">
          <Row className="g-2">
            {demoMetrics.map((metric, index) => (
              <Col md={3} key={index}>
                <MetricCard metric={metric} />
              </Col>
            ))}
          </Row>
        </Card.Body>
      </Card>

      {/* Основная карта */}
      <div className="map-container">
        <MapComponent markers={demoMarkers} />
        
        {/* Легенда для карты */}
        <div className="map-legend">
          <div className="legend-title">Нагрузка на остановках</div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: 'green' }}></span>
            <span className="legend-text">Низкая (1-3 чел)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: 'yellow' }}></span>
            <span className="legend-text">Средняя (4-7 чел)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: 'red' }}></span>
            <span className="legend-text">Высокая (8+ чел)</span>
          </div>
          {showHeatmap && (
            <div className="legend-item mt-2">
              <span className="legend-color" style={{ backgroundColor: 'purple' }}></span>
              <span className="legend-text">Проблемный узел</span>
            </div>
          )}
        </div>

        {/* Боковая панель инструментов (только в режиме симуляции) */}
        {mapMode === 'simulation' && (
          <div className="tool-sidebar">
            <Card>
              <Card.Header className="p-2">
                <strong className="small">🛠️ Инструменты</strong>
              </Card.Header>
              <Card.Body className="p-2">
                <Button size="sm" variant="outline-secondary" className="w-100 mb-2">
                  ✏️ Добавить остановку
                </Button>
                <Button size="sm" variant="outline-secondary" className="w-100 mb-2">
                  🗑️ Удалить остановку
                </Button>
                <Button size="sm" variant="outline-secondary" className="w-100 mb-2">
                  🚌 Новый маршрут
                </Button>
                <Button size="sm" variant="outline-secondary" className="w-100 mb-2">
                  ⚠️ Закрыть остановку
                </Button>
                
                <hr className="my-2" />
                
                <Form.Group className="mb-2">
                  <Form.Label className="small mb-1">Пассажиропоток</Form.Label>
                  <div className="d-flex">
                    <Button size="sm" variant="outline-secondary" className="flex-grow-1 me-1">-30%</Button>
                    <Button size="sm" variant="outline-secondary" className="flex-grow-1">+30%</Button>
                  </div>
                </Form.Group>
                
                <Form.Group className="mb-2">
                  <Form.Label className="small mb-1">Тип дня</Form.Label>
                  <Form.Select size="sm">
                    <option>Будний</option>
                    <option>Выходной</option>
                    <option>Праздник</option>
                  </Form.Select>
                </Form.Group>
              </Card.Body>
            </Card>
          </div>
        )}

        {/* Нижняя панель временного слайдера (только после симуляции) */}
        {mapMode === 'simulation' && simulationStatus === 'completed' && (
          <div className="time-slider-panel">
            <Card>
              <Card.Body className="p-2">
                <div className="d-flex align-items-center">
                  <span className="me-3 small">Временной срез: <strong>08:00</strong></span>
                  <Form.Range className="flex-grow-1 mx-3" />
                  <div className="time-controls">
                    <Button size="sm" variant="outline-secondary" className="me-1">⏪</Button>
                    <Button size="sm" variant="outline-secondary" className="me-1">▶️</Button>
                    <Button size="sm" variant="outline-secondary">⏩</Button>
                  </div>
                  <Badge bg="info" className="ms-3">Симуляция активна</Badge>
                </div>
              </Card.Body>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsMapWrapper;