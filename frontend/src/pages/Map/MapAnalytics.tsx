import React, { useState } from 'react';
import { Card, Row, Col, Button, Dropdown, Form } from 'react-bootstrap';
import SimulationControls from './components/SimulationControls';
import MapView from "./MapView"
import ScenarioPanel from './components/ScenarioPanel';
import MetricsDashboard from './components/MetricsDashboard';
import type { MapMode, Scenario, SimulationStatus } from './types';


const MapAnalytics: React.FC = () => {
  const [mapMode, setMapMode] = useState<MapMode>('realtime');
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus>('idle');
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);

  // Переключение режимов карты
  const handleModeChange = (mode: MapMode) => {
    setMapMode(mode);
    if (mode === 'simulation') {
      setSimulationStatus('ready');
    } else {
      setSimulationStatus('idle');
    }
  };

  // Запуск симуляции
  const handleRunSimulation = (scenario: Scenario) => {
    setActiveScenario(scenario);
    setSimulationStatus('running');
    
    // Имитация расчета
    setTimeout(() => {
      setSimulationStatus('completed');
    }, 2000);
  };

  // Сохранение сценария
  const handleSaveScenario = () => {
    // Логика сохранения
    console.log('Сценарий сохранен');
  };

  return (
    <div className="map-analytics-container">
      {/* Панель режимов */}
      <div className="mode-selector mb-3">
        <Button
          variant={mapMode === 'realtime' ? 'primary' : 'outline-primary'}
          onClick={() => handleModeChange('realtime')}
          className="me-2"
        >
          📍 Режим реального времени
        </Button>
        <Button
          variant={mapMode === 'simulation' ? 'primary' : 'outline-primary'}
          onClick={() => handleModeChange('simulation')}
          className="me-2"
        >
          🎮 Режим симуляции
        </Button>
        <Button
          variant={mapMode === 'comparison' ? 'primary' : 'outline-primary'}
          onClick={() => handleModeChange('comparison')}
        >
          📊 Режим сравнения
        </Button>
      </div>

      <Row>
        {/* Основная карта */}
        <Col lg={8}>
          <Card className="mb-3">
            <Card.Header>
              <div className="d-flex justify-content-between align-items-center">
                <span>
                  {mapMode === 'realtime' && 'Карта пассажиропотока в реальном времени'}
                  {mapMode === 'simulation' && 'Карта симуляции пассажиропотока'}
                  {mapMode === 'comparison' && 'Сравнение сценариев'}
                </span>
                <div>
                  <Form.Check
                    type="switch"
                    id="heatmap-switch"
                    label="Показать проблемные узлы"
                    checked={showHeatmap}
                    onChange={(e) => setShowHeatmap(e.target.checked)}
                    disabled={mapMode === 'realtime'}
                  />
                </div>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              <MapView
                mode={mapMode}
                showHeatmap={showHeatmap}
                selectedStop={selectedStop}
                onStopSelect={setSelectedStop}
              />
              
              {/* Ползунок времени для симуляции */}
              {mapMode === 'simulation' && simulationStatus === 'completed' && (
                <div className="time-slider-container p-3 border-top">
                  <Form.Label>Временной срез: <strong>08:00</strong></Form.Label>
                  <Form.Range 
                    min="0" 
                    max="23" 
                    defaultValue="8"
                    className="time-slider"
                  />
                  <div className="d-flex justify-content-between">
                    <small>00:00</small>
                    <small>12:00</small>
                    <small>23:00</small>
                  </div>
                  <div className="mt-2">
                    <Button size="sm" variant="outline-secondary" className="me-2">
                      ⏪
                    </Button>
                    <Button size="sm" variant="outline-secondary" className="me-2">
                      ▶️ Воспроизвести
                    </Button>
                    <Button size="sm" variant="outline-secondary">
                      ⏩
                    </Button>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Дашборд метрик */}
          <MetricsDashboard 
            mapMode={mapMode}
            simulationStatus={simulationStatus}
            selectedStop={selectedStop}
          />
        </Col>

        {/* Боковая панель управления */}
        <Col lg={4}>
          {/* Панель управления симуляцией */}
          {mapMode === 'simulation' && (
            <SimulationControls
              status={simulationStatus}
              onRunSimulation={handleRunSimulation}
              onSaveScenario={handleSaveScenario}
            />
          )}

          {/* Панель сценариев */}
          <ScenarioPanel 
            mapMode={mapMode}
            activeScenario={activeScenario}
            onScenarioSelect={setActiveScenario}
            onScenarioDelete={(id) => console.log('Удалить', id)}
          />

          {/* Панель инструментов "Что если?" */}
          {mapMode === 'simulation' && (
            <Card className="mb-3">
              <Card.Header>
                <strong>🛠️ Инструменты "Что если?"</strong>
              </Card.Header>
              <Card.Body>
                <Dropdown className="mb-2">
                  <Dropdown.Toggle variant="outline-primary" size="sm" className="w-100">
                    ✏️ Редактор сети
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item>Добавить остановку</Dropdown.Item>
                    <Dropdown.Item>Удалить остановку</Dropdown.Item>
                    <Dropdown.Item>Проложить маршрут</Dropdown.Item>
                    <Dropdown.Item>Временно закрыть остановку</Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>

                <Form.Group className="mb-3">
                  <Form.Label>Общий пассажиропоток</Form.Label>
                  <div className="d-flex align-items-center">
                    <Button size="sm" variant="outline-secondary">-30%</Button>
                    <Form.Range className="mx-2" />
                    <Button size="sm" variant="outline-secondary">+30%</Button>
                  </div>
                  <Form.Text>Текущее: +0%</Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Шаблон дня</Form.Label>
                  <Form.Select size="sm">
                    <option>Будний день</option>
                    <option>Выходной</option>
                    <option>Праздник</option>
                    <option>Особое событие</option>
                  </Form.Select>
                </Form.Group>

                <Button variant="outline-info" size="sm" className="w-100">
                  ⚙️ Дополнительные параметры
                </Button>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default MapAnalytics;