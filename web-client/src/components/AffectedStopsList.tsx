// src/components/AffectedStopsList.tsx
import React, { useState } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, MapPin, Clock, Gauge, ChevronRight } from 'lucide-react';

interface AffectedStop {
  id: number;
  address: string;
  loadChange: number;
  waitTimeChange: number;
  status: 'improved' | 'worsened' | 'neutral';
}

interface AffectedStopsListProps {
  stops: AffectedStop[];
  onStopClick?: (stopId: number) => void;
}

const AffectedStopsList: React.FC<AffectedStopsListProps> = ({ stops, onStopClick }) => {
  const [expandedStop, setExpandedStop] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'impact' | 'load' | 'wait'>('impact');
  const [filterStatus, setFilterStatus] = useState<'all' | 'improved' | 'worsened'>('all');

  // Сортировка
  const sortedStops = [...stops].sort((a, b) => {
    if (sortBy === 'impact') {
      return Math.abs(b.loadChange) - Math.abs(a.loadChange);
    }
    if (sortBy === 'load') {
      return Math.abs(b.loadChange) - Math.abs(a.loadChange);
    }
    return Math.abs(b.waitTimeChange) - Math.abs(a.waitTimeChange);
  });

  // Фильтрация
  const filteredStops = sortedStops.filter(stop => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'improved') return stop.status === 'improved';
    return stop.status === 'worsened';
  });

  // Статистика
  const worsenedCount = stops.filter(s => s.status === 'worsened').length;
  const improvedCount = stops.filter(s => s.status === 'improved').length;
  const avgLoadChange = stops.reduce((sum, s) => sum + s.loadChange, 0) / stops.length;

  // Цветовая схема
  const colors = {
    worsened: '#ef4444',
    improved: '#10b981',
    neutral: '#64748b',
    warning: '#f59e0b',
    border: '#e2e8f0',
    background: '#f8fafc'
  };

  return (
    <div className="affected-stops-container">
      {/* Заголовок */}
      <div className="stops-header">
        <div className="header-left">
          <h3 className="stops-title">
            <AlertTriangle size={18} />
            Наиболее затронутые остановки
          </h3>
          <p className="stops-subtitle">
            Остановки, на которые изменения повлияли больше всего
          </p>
        </div>
        
        <div className="header-stats">
          <div className="stat-pill worsened">
            <TrendingDown size={12} />
            <span>{worsenedCount} ухудшилось</span>
          </div>
          <div className="stat-pill improved">
            <TrendingUp size={12} />
            <span>{improvedCount} улучшилось</span>
          </div>
          <div className="stat-pill average">
            <span>Ср. изменение: {avgLoadChange > 0 ? '+' : ''}{avgLoadChange.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Панель фильтров и сортировки */}
      <div className="stops-controls">
        <div className="filter-buttons">
          <button 
            className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            Все ({stops.length})
          </button>
          <button 
            className={`filter-btn worsened ${filterStatus === 'worsened' ? 'active' : ''}`}
            onClick={() => setFilterStatus('worsened')}
          >
            ⚠️ Ухудшилось ({worsenedCount})
          </button>
          <button 
            className={`filter-btn improved ${filterStatus === 'improved' ? 'active' : ''}`}
            onClick={() => setFilterStatus('improved')}
          >
            ✅ Улучшилось ({improvedCount})
          </button>
        </div>

        <div className="sort-select">
          <span className="sort-label">Сортировать по:</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="impact">Степени влияния</option>
            <option value="load">Изменению нагрузки</option>
            <option value="wait">Изменению времени ожидания</option>
          </select>
        </div>
      </div>

      {/* Список остановок */}
      <div className="stops-list">
        {filteredStops.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎉</div>
            <p>Нет остановок с выбранным статусом</p>
          </div>
        ) : (
          filteredStops.map((stop, index) => {
            const isExpanded = expandedStop === stop.id;
            const impactLevel = Math.abs(stop.loadChange);
            const impactColor = stop.status === 'worsened' 
              ? (impactLevel > 30 ? '#dc2626' : impactLevel > 15 ? '#f59e0b' : '#f97316')
              : (impactLevel > 30 ? '#10b981' : impactLevel > 15 ? '#34d399' : '#6ee7b7');
            
            return (
              <div 
                key={stop.id} 
                className={`stop-card ${stop.status} ${isExpanded ? 'expanded' : ''}`}
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                <div className="stop-card-main" onClick={() => onStopClick?.(stop.id)}>
                  <div className="stop-rank">{index + 1}</div>
                  
                  <div className="stop-info">
                    <div className="stop-address">
                      <MapPin size={14} className="pin-icon" />
                      <span>{stop.address}</span>
                    </div>
                  </div>

                  <div className="stop-metrics">
                    <div className={`metric-badge load ${stop.status}`}>
                      <Gauge size={12} />
                      <span className="metric-value">
                        {stop.loadChange > 0 ? '+' : ''}{stop.loadChange.toFixed(1)}%
                      </span>
                    </div>
                    <div className={`metric-badge wait ${stop.status}`}>
                      <Clock size={12} />
                      <span className="metric-value">
                        {stop.waitTimeChange > 0 ? '+' : ''}{stop.waitTimeChange.toFixed(1)} мин
                      </span>
                    </div>
                  </div>

                  <div className="impact-indicator">
                    <div 
                      className="impact-bar"
                      style={{ 
                        width: `${Math.min(100, impactLevel)}%`,
                        backgroundColor: impactColor
                      }}
                    />
                  </div>

                  <button 
                    className="expand-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedStop(isExpanded ? null : stop.id);
                    }}
                  >
                    <ChevronRight size={16} className={isExpanded ? 'rotated' : ''} />
                  </button>
                </div>

                {isExpanded && (
                  <div className="stop-details">
                    <div className="details-grid">
                      <div className="detail-item">
                        <span className="detail-label">Изменение нагрузки</span>
                        <div className="detail-progress">
                          <div 
                            className="detail-progress-fill"
                            style={{ 
                              width: `${Math.min(100, Math.abs(stop.loadChange))}%`,
                              backgroundColor: stop.status === 'worsened' ? '#ef4444' : '#10b981'
                            }}
                          />
                        </div>
                        <span className="detail-value">
                          {stop.loadChange > 0 ? '+' : ''}{stop.loadChange.toFixed(1)}%
                        </span>
                      </div>
                      
                      <div className="detail-item">
                        <span className="detail-label">Изменение времени ожидания</span>
                        <div className="detail-progress">
                          <div 
                            className="detail-progress-fill"
                            style={{ 
                              width: `${Math.min(100, Math.abs(stop.waitTimeChange) * 5)}%`,
                              backgroundColor: stop.status === 'worsened' ? '#ef4444' : '#10b981'
                            }}
                          />
                        </div>
                        <span className="detail-value">
                          {stop.waitTimeChange > 0 ? '+' : ''}{stop.waitTimeChange.toFixed(1)} мин
                        </span>
                      </div>
                    </div>
                    
                    <div className="recommendation">
                      {stop.status === 'worsened' ? (
                        <>
                          <span className="rec-icon">💡</span>
                          <span className="rec-text">
                            Рекомендуется добавить дополнительный транспорт или увеличить частоту маршрутов
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="rec-icon">✅</span>
                          <span className="rec-text">
                            Изменения положительно повлияли на транспортную ситуацию
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <style>{`
        .affected-stops-container {
          background: white;
          border-radius: 16px;
          overflow: hidden;
        }

        .stops-header {
          padding: 20px 20px 16px;
          border-bottom: 1px solid ${colors.border};
        }

        .stops-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 4px 0;
        }

        .stops-subtitle {
          font-size: 13px;
          color: #64748b;
          margin: 0;
        }

        .header-stats {
          display: flex;
          gap: 12px;
          margin-top: 12px;
        }

        .stat-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .stat-pill.worsened {
          background: #fee2e2;
          color: #991b1b;
        }

        .stat-pill.improved {
          background: #dcfce7;
          color: #166534;
        }

        .stat-pill.average {
          background: #f1f5f9;
          color: #475569;
        }

        .stops-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          background: ${colors.background};
          border-bottom: 1px solid ${colors.border};
        }

        .filter-buttons {
          display: flex;
          gap: 8px;
        }

        .filter-btn {
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          background: white;
          border: 1px solid ${colors.border};
          color: #475569;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-btn:hover {
          background: #f1f5f9;
        }

        .filter-btn.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }

        .filter-btn.worsened.active {
          background: #ef4444;
          border-color: #ef4444;
        }

        .filter-btn.improved.active {
          background: #10b981;
          border-color: #10b981;
        }

        .sort-select {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sort-label {
          font-size: 12px;
          color: #64748b;
        }

        .sort-select select {
          padding: 6px 10px;
          border-radius: 8px;
          border: 1px solid ${colors.border};
          font-size: 12px;
          background: white;
          cursor: pointer;
        }

        .stops-list {
          padding: 8px 0;
          max-height: 500px;
          overflow-y: auto;
        }

        .stop-card {
          margin: 8px 16px;
          border-radius: 12px;
          background: white;
          border: 1px solid ${colors.border};
          transition: all 0.2s ease;
          animation: slideIn 0.3s ease-out forwards;
          opacity: 0;
          transform: translateX(-10px);
        }

        @keyframes slideIn {
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .stop-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          border-color: #cbd5e1;
        }

        .stop-card.worsened {
          border-left: 3px solid ${colors.worsened};
        }

        .stop-card.improved {
          border-left: 3px solid ${colors.improved};
        }

        .stop-card-main {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          cursor: pointer;
        }

        .stop-rank {
          width: 28px;
          height: 28px;
          background: ${colors.background};
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
        }

        .stop-info {
          flex: 1;
        }

        .stop-address {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 500;
          color: #1e293b;
        }

        .pin-icon {
          color: #64748b;
        }

        .stop-id {
          font-size: 10px;
          color: #94a3b8;
          margin-top: 2px;
        }

        .stop-metrics {
          display: flex;
          gap: 8px;
        }

        .metric-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .metric-badge.load.worsened {
          background: #fee2e2;
          color: #991b1b;
        }

        .metric-badge.load.improved {
          background: #dcfce7;
          color: #166534;
        }

        .metric-badge.wait.worsened {
          background: #fef3c7;
          color: #92400e;
        }

        .metric-badge.wait.improved {
          background: #d1fae5;
          color: #065f46;
        }

        .impact-indicator {
          width: 60px;
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          overflow: hidden;
        }

        .impact-bar {
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        .expand-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          transition: transform 0.2s;
        }

        .expand-btn .rotated {
          transform: rotate(90deg);
        }

        .stop-details {
          padding: 0 16px 16px 56px;
          border-top: 1px solid ${colors.border};
          background: ${colors.background};
          border-radius: 0 0 12px 12px;
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .detail-label {
          font-size: 11px;
          color: #64748b;
        }

        .detail-progress {
          height: 6px;
          background: #e2e8f0;
          border-radius: 3px;
          overflow: hidden;
        }

        .detail-progress-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .detail-value {
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
        }

        .recommendation {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: white;
          border-radius: 10px;
          font-size: 12px;
        }

        .rec-icon {
          font-size: 16px;
        }

        .rec-text {
          color: #475569;
          line-height: 1.4;
        }

        .empty-state {
          text-align: center;
          padding: 48px 20px;
          color: #94a3b8;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        @media (max-width: 768px) {
          .stops-controls {
            flex-direction: column;
            gap: 12px;
            align-items: stretch;
          }
          
          .filter-buttons {
            justify-content: center;
          }
          
          .stop-card-main {
            flex-wrap: wrap;
          }
          
          .stop-metrics {
            order: 3;
            width: 100%;
            justify-content: flex-start;
            margin-top: 8px;
          }
          
          .impact-indicator {
            order: 4;
            width: 100%;
          }
          
          .details-grid {
            grid-template-columns: 1fr;
          }
          
          .stop-details {
            padding-left: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default AffectedStopsList;