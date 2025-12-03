// src/pages/Map/components/SimulationControls.tsx
import React, { useState } from 'react';
import { Card, Button, Form, ProgressBar, Alert } from 'react-bootstrap';
import { SimulationStatus, Scenario } from '../types';

interface SimulationControlsProps {
  status: SimulationStatus;
  onRunSimulation: (scenario: Scenario) => void;
  onSaveScenario: () => void;
}

const SimulationControls: React.FC<SimulationControlsProps> = ({
  status,
  onRunSimulation,
  onSaveScenario
}) => {
  const [predictionDepth, setPredictionDepth] = useState(24); // часы
  const [selectedScenario, setSelectedScenario] = useState<string>('');

  const demoScenario: Scenario = {
    id: 'demo-1',
    name: 'Демо: Закрытие центральной остановки',
    description: 'Временное закрытие остановки "Центральная" на 4 часа',
    created: new Date(),
    changes: [
      {
        type: 'close_stop',
        parameters: { stopId: 'center-1', durationHours: 4 }
      }
    ]
  };

  const handleRun = () => {
    onRunSimulation(demoScenario);
  };

  return (
    <Card className="mb-3">
      <Card.Header>
        <strong>🎮 Управление симуляцией</strong>
      </Card.Header>
      <Card.Body>
        <Form.Group className="mb-3">
          <Form.Label>
            <strong>Глубина прогноза:</strong> {predictionDepth} часов
          </Form.Label>
          <Form.Range
            min="1"
            max="72"
            value={predictionDepth}
            onChange={(e) => setPredictionDepth(parseInt(e.target.value))}
            disabled={status === 'running'}
          />
          <div className="d-flex justify-content-between">
            <small>1 час</small>
            <small>24 часа</small>
            <small>72 часа</small>
          </div>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Загрузить сценарий</Form.Label>
          <Form.Select 
            size="sm"
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            disabled={status === 'running'}
          >
            <option value="">Выберите сценарий...</option>
            <option value="demo-1">Демо: Закрытие остановки</option>
            <option value="demo-2">Демо: Новый маршрут</option>
            <option value="demo-3">Демо+30% пассажиров</option>
          </Form.Select>
        </Form.Group>

        <div className="d-grid gap-2 mb-3">
          <Button
            variant={status === 'running' ? 'warning' : 'primary'}
            size="lg"
            onClick={handleRun}
            disabled={status === 'running'}
          >
            {status === 'running' ? (
              <>⏳ Запущена симуляция...</>
            ) : (
              <>🚀 Запустить симуляцию</>
            )}
          </Button>

          <Button
            variant="outline-success"
            onClick={onSaveScenario}
            disabled={status !== 'completed'}
          >
            💾 Сохранить сценарий
          </Button>
        </div>

        {status === 'running' && (
          <Alert variant="info" className="mb-0">
            <ProgressBar animated now={45} label="45%" className="mb-2" />
            <small className="d-block">Идет расчет модели. Подождите...</small>
          </Alert>
        )}

        {status === 'completed' && (
          <Alert variant="success" className="mb-0">
            <strong>✓ Симуляция завершена!</strong>
            <small className="d-block mt-1">Результаты готовы к анализу</small>
          </Alert>
        )}

        <div className="mt-3">
          <Form.Text className="text-muted">
            <small>
              Статус: <strong>
                {status === 'idle' && 'Готов'}
                {status === 'ready' && 'Настроен'}
                {status === 'running' && 'В процессе'}
                {status === 'completed' && 'Завершено'}
              </strong>
            </small>
          </Form.Text>
        </div>
      </Card.Body>
    </Card>
  );
};

export default SimulationControls;