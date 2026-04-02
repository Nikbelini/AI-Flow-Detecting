import React from 'react';
import { Card, ListGroup, Button, Badge } from 'react-bootstrap';
import type { MapMode, Scenario } from '../types';

interface ScenarioPanelProps {
  mapMode: MapMode;
  activeScenario: Scenario | null;
  onScenarioSelect: (scenario: Scenario) => void;
  onScenarioDelete: (id: string) => void;
}

const ScenarioPanel: React.FC<ScenarioPanelProps> = ({
  mapMode,
  activeScenario,
  onScenarioSelect,
  onScenarioDelete
}) => {
  const demoScenarios: Scenario[] = [
    {
      id: '1',
      name: 'Открытие ТЦ "Северный"',
      description: 'Добавление 3 новых остановок у ТЦ',
      created: new Date('2024-01-15'),
      changes: [{ type: 'add_stop', parameters: { count: 3 } }]
    },
    {
      id: '2',
      name: 'Ремонт моста на Ленинском',
      description: 'Закрытие 2 остановок на 2 недели',
      created: new Date('2024-01-10'),
      changes: [{ type: 'close_stop', parameters: { count: 2, durationDays: 14 } }]
    },
    {
      id: '3',
      name: 'Увеличение парка на 20%',
      description: 'Добавление транспорта на маршруты 5, 12, 23',
      created: new Date('2024-01-05'),
      changes: [{ type: 'change_interval', parameters: { routes: [5, 12, 23] } }]
    }
  ];

  const getScenarioBadge = (scenario: Scenario) => {
    if (scenario.id === activeScenario?.id) {
      return <Badge bg="success">Активен</Badge>;
    }
    if (scenario.created > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
      return <Badge bg="info">Новый</Badge>;
    }
    return null;
  };

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <strong>📁 Библиотека сценариев</strong>
        <Button size="sm" variant="outline-primary">
          + Создать
        </Button>
      </Card.Header>
      <Card.Body className="p-0">
        <ListGroup variant="flush">
          {demoScenarios.map((scenario) => (
            <ListGroup.Item
              key={scenario.id}
              action
              active={scenario.id === activeScenario?.id}
              onClick={() => onScenarioSelect(scenario)}
              className="d-flex justify-content-between align-items-start"
            >
              <div className="ms-2 me-auto">
                <div className="fw-bold">{scenario.name}</div>
                <small className="text-muted">{scenario.description}</small>
                <div>
                  <small className="text-muted">
                    Создан: {scenario.created.toLocaleDateString()}
                  </small>
                </div>
              </div>
              <div className="d-flex flex-column align-items-end">
                {getScenarioBadge(scenario)}
                <Button
                  size="sm"
                  variant="link"
                  className="text-danger p-0 mt-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onScenarioDelete(scenario.id);
                  }}
                >
                  <small>Удалить</small>
                </Button>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Card.Body>
      <Card.Footer className="text-center">
        <small className="text-muted">
          {mapMode === 'simulation'
            ? 'Выберите сценарий для симуляции'
            : 'Для работы со сценариями перейдите в режим симуляции'}
        </small>
      </Card.Footer>
    </Card>
  );
};

export default ScenarioPanel;