import './StopMetricsModal.css';
import React from 'react';
import { X, Clock, Users, TrendingUp, Calendar, Bus, ArrowUp, ArrowDown } from 'lucide-react';

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
  // Находим пиковый час для подсветки
  const peakHour = baseMetrics.peak_hour;
  
  // Если есть изменённые метрики, показываем сравнение
  const hasComparison = modifiedMetrics && modifiedMetrics.stopId === stopId;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content stop-metrics-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-info">
            <Bus size={20} className="header-icon" />
            <h2>{baseMetrics.address}</h2>
            <span className="stop-id">ID: {stopId}</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <span className="close-symbol">✕</span>
          </button>
        </div>
        
        <div className="modal-body">
          {/* Карточки со статистикой */}
          <div className="stop-stats-grid">
            <div className="stat-card">
              <div className="stat-icon"><Users size={20} /></div>
              <div className="stat-info">
                <span className="stat-label">Всего пассажиров</span>
                <span className="stat-value">{baseMetrics.total_passengers}</span>
                {hasComparison && (
                  <span className={`stat-diff ${modifiedMetrics.total_passengers > baseMetrics.total_passengers ? 'up' : 'down'}`}>
                    {modifiedMetrics.total_passengers > baseMetrics.total_passengers ? '↑' : '↓'} 
                    {Math.abs(((modifiedMetrics.total_passengers - baseMetrics.total_passengers) / baseMetrics.total_passengers * 100)).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon"><Clock size={20} /></div>
              <div className="stat-info">
                <span className="stat-label">Ср. время ожидания</span>
                <span className="stat-value">{baseMetrics.avg_wait_time.toFixed(1)} мин</span>
                {hasComparison && (
                  <span className={`stat-diff ${modifiedMetrics.avg_wait_time > baseMetrics.avg_wait_time ? 'up' : 'down'}`}>
                    {modifiedMetrics.avg_wait_time > baseMetrics.avg_wait_time ? '↑' : '↓'} 
                    {Math.abs(modifiedMetrics.avg_wait_time - baseMetrics.avg_wait_time).toFixed(1)} мин
                  </span>
                )}
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon"><TrendingUp size={20} /></div>
              <div className="stat-info">
                <span className="stat-label">Пиковый час</span>
                <span className="stat-value">{baseMetrics.peak_hour}:00</span>
                <span className="stat-hint">пиковая нагрузка</span>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon"><Calendar size={20} /></div>
              <div className="stat-info">
                <span className="stat-label">Использование</span>
                <span className="stat-value">{(baseMetrics.utilization * 100).toFixed(1)}%</span>
                {hasComparison && (
                  <span className={`stat-diff ${modifiedMetrics.utilization > baseMetrics.utilization ? 'up' : 'down'}`}>
                    {modifiedMetrics.utilization > baseMetrics.utilization ? '↑' : '↓'} 
                    {Math.abs((modifiedMetrics.utilization - baseMetrics.utilization) * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Почасовая динамика */}
          <div className="hourly-section">
            <h3>📊 Почасовая динамика</h3>
            <div className="hourly-grid">
              <div className="hourly-header">
                <span>Час</span>
                <span>Пассажиры</span>
                <span>Уехало</span>
                <span>Ждёт</span>
                <span>Ср. ожидание</span>
              </div>
              <div className="hourly-body">
                {baseMetrics.hourly.map((hour: any) => (
                  <div 
                    key={hour.hour} 
                    className={`hourly-row ${hour.hour === peakHour ? 'peak-hour' : ''}`}
                  >
                    <span>{hour.hour}:00</span>
                    <span>{hour.passengers}</span>
                    <span>{hour.departed}</span>
                    <span>{hour.waiting}</span>
                    <span>{hour.avg_wait?.toFixed(1) || '-'} мин</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="hourly-legend">
              <span className="legend-item">
                <span className="legend-color peak"></span>
                Пиковый час
              </span>
              <span className="legend-item">
                <span className="legend-icon">👥</span>
                Пассажиры — общее количество в час
              </span>
              <span className="legend-item">
                <span className="legend-icon">✅</span>
                Уехало — успешно отправлены
              </span>
              <span className="legend-item">
                <span className="legend-icon">⏳</span>
                Ждёт — остались на остановке
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StopMetricsModal;