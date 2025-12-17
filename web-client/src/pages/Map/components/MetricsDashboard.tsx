// src/pages/Map/components/MetricsDashboard.tsx
import React from 'react';
import { Card, Row, Col, ProgressBar } from 'react-bootstrap';
import { MapMode, SimulationStatus } from '../types';

interface MetricsDashboardProps {
  mapMode: MapMode;
  simulationStatus: SimulationStatus;
  selectedStop: string | null;
}

const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  mapMode,
  simulationStatus,
  selectedStop
}) => {
  // Демо-данные
  const metrics = {
    current: {
      avgWaitTime: 8.2,
      passengerKm: 12500,
      transportUtilization: 0.67,
      maxLoad: 145
    },
    simulated: {
      avgWaitTime: 12.1,
      passengerKm: 11800,
      transportUtilization: 0.72,
      maxLoad: 210
    }
  };

  const diff = {
    avgWaitTime: ((metrics.simulated.avgWaitTime - metrics.current.avgWaitTime) / metrics.current.avgWaitTime * 100).toFixed(1),
    passengerKm: ((metrics.simulated.passengerKm - metrics.current.passengerKm) / metrics.current.passengerKm * 100).toFixed(1),
    transportUtilization: ((metrics.simulated.transportUtilization - metrics.current.transportUtilization) / metrics.current.transportUtilization * 100).toFixed(1),
    maxLoad: ((metrics.simulated.maxLoad - metrics.current.maxLoad) / metrics.current.maxLoad * 100).toFixed(1)
  };

  const MetricCard = ({ 
    title, 
    current, 
    simulated, 
    diff, 
    unit = '',
    isPositive = true 
  }: {
    title: string;
    current: number;
    simulated: number;
    diff: string;
    unit: string;
    isPositive?: boolean;
  }) => (
    <Card className="h-100">
      <Card.Body>
        <Card.Title className="fs-6">{title}</Card.Title>
        <div className="d-flex align-items-end mb-2">
          <span className="fs-4 fw-bold">{simulated.toFixed(1)}{unit}</span>
          {mapMode === 'comparison' && (
            <span className={`ms-2 fs-6 ${parseFloat(diff) >= 0 ? 'text-danger' : 'text-success'}`}>
              ({diff}%)
            </span>
          )}
        </div>
        {mapMode === 'comparison' && (
          <>
            <div className="text-muted small">Было: {current.toFixed(1)}{unit}</div>
            <ProgressBar 
              now={Math.min(simulated, 100)} 
              variant={parseFloat(diff) >= 0 ? 'danger' : 'success'}
              className="mt-2"
            />
          </>
        )}
      </Card.Body>
    </Card>
  );

  return (
    <Card>
      <Card.Header>
        <strong>📊 Ключевые показатели эффективности</strong>
        {selectedStop && (
          <span className="ms-2 text-muted">| Остановка: {selectedStop}</span>
        )}
      </Card.Header>
      <Card.Body>
        <Row className="g-3">
          <Col md={3}>
            <MetricCard
              title="Среднее время ожидания"
              current={metrics.current.avgWaitTime}
              simulated={metrics.simulated.avgWaitTime}
              diff={diff.avgWaitTime}
              unit=" мин"
              isPositive={false}
            />
          </Col>
          <Col md={3}>
            <MetricCard
              title="Пассажиро-километры"
              current={metrics.current.passengerKm}
              simulated={metrics.simulated.passengerKm}
              diff={diff.passengerKm}
              unit=""
              isPositive={true}
            />
          </Col>
          <Col md={3}>
            <MetricCard
              title="Использование транспорта"
              current={metrics.current.transportUtilization}
              simulated={metrics.simulated.transportUtilization}
              diff={diff.transportUtilization}
              unit=""
              isPositive={true}
            />
          </Col>
          <Col md={3}>
            <MetricCard
              title="Максимальная нагрузка"
              current={metrics.current.maxLoad}
              simulated={metrics.simulated.maxLoad}
              diff={diff.maxLoad}
              unit=" чел"
              isPositive={false}
            />
          </Col>
        </Row>

        {/* График для выбранной метрики */}
        {mapMode === 'comparison' && (
          <div className="mt-3">
            <Card>
              <Card.Header>
                <small className="text-muted">График изменения по часам</small>
              </Card.Header>
              <Card.Body className="text-center">
                <div className="border rounded p-4 bg-light">
                  <p className="text-muted mb-0">
                    [Здесь будет график сравнения сценариев]
                  </p>
                  <small>
                    {selectedStop 
                      ? `Данные по остановке: ${selectedStop}` 
                      : 'Выберите остановку на карте для детального анализа'}
                  </small>
                </div>
                <div className="mt-2">
                  <button className="btn btn-sm btn-outline-primary me-2">
                    📥 Экспорт данных
                  </button>
                  <button className="btn btn-sm btn-outline-secondary">
                    📄 Создать отчет
                  </button>
                </div>
              </Card.Body>
            </Card>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default MetricsDashboard;