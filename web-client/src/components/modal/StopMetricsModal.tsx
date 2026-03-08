// src/pages/components/StopMetricsModal.tsx
import React from 'react';
import { X, Clock, Users, TrendingUp, Calendar } from 'lucide-react';

interface StopMetricsModalProps {
  stopId: number;
  baseMetrics: any;
  modifiedMetrics?: any;
  onClose: () => void;
}

const StopMetricsModal: React.FC<StopMetricsModalProps> = ({
  stopId,
  baseMetrics,
  modifiedMetrics,
  onClose
}) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{baseMetrics.address}</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body">
          <div className="stop-stats-grid">
            <div className="stat-card">
              <Users size={20} />
              <div className="stat-info">
                <span className="stat-label">Всего пассажиров</span>
                <span className="stat-value">{baseMetrics.total_passengers}</span>
              </div>
            </div>
            
            <div className="stat-card">
              <Clock size={20} />
              <div className="stat-info">
                <span className="stat-label">Ср. время ожидания</span>
                <span className="stat-value">{baseMetrics.avg_wait_time.toFixed(1)} мин</span>
              </div>
            </div>
            
            <div className="stat-card">
              <TrendingUp size={20} />
              <div className="stat-info">
                <span className="stat-label">Пиковый час</span>
                <span className="stat-value">{baseMetrics.peak_hour}:00</span>
              </div>
            </div>
            
            <div className="stat-card">
              <Calendar size={20} />
              <div className="stat-info">
                <span className="stat-label">Использование</span>
                <span className="stat-value">{(baseMetrics.utilization * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
          
          <h3>Почасовая динамика</h3>
          <div className="hourly-grid">
            <div className="hourly-header">
              <span>Час</span>
              <span>Пассажиры</span>
              <span>Уехало</span>
              <span>Ждёт</span>
              <span>Ср. ожидание</span>
            </div>
            {baseMetrics.hourly.map((hour: any) => (
              <div key={hour.hour} className="hourly-row">
                <span>{hour.hour}:00</span>
                <span>{hour.passengers}</span>
                <span>{hour.departed}</span>
                <span>{hour.waiting}</span>
                <span>{hour.avg_wait?.toFixed(1) || '-'} мин</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StopMetricsModal;