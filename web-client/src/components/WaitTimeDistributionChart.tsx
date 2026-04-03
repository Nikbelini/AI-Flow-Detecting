// src/components/WaitTimeDistributionChart.tsx
import React, { useState } from 'react';
import { BarChart, PieChart, TrendingUp, Clock, AlertCircle, Info } from 'lucide-react';

interface WaitTimeDistribution {
  buckets: number[];
  counts: number[];
  percentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
  average: number;
  median: number;
  p95: number;
  p99: number;
}

interface WaitTimeDistributionChartProps {
  baseDistribution: WaitTimeDistribution;
  modifiedDistribution?: WaitTimeDistribution;
}

const WaitTimeDistributionChart: React.FC<WaitTimeDistributionChartProps> = ({
  baseDistribution,
  modifiedDistribution
}) => {
  const [showComparison, setShowComparison] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  
  const maxCount = Math.max(...baseDistribution.counts);
  const totalPassengers = baseDistribution.counts.reduce((a, b) => a + b, 0);
  
  // Цветовая схема
  const colors = {
    base: '#3b82f6',
    modified: '#f59e0b',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    background: '#f8fafc',
    border: '#e2e8f0'
  };

  // Функция для получения цвета в зависимости от времени ожидания
  const getWaitTimeColor = (bucketIndex: number): string => {
    if (bucketIndex <= 1) return colors.success;
    if (bucketIndex <= 2) return colors.warning;
    return colors.danger;
  };

  // Функция для оценки изменения
  const getChangeStatus = (base: number, modified: number) => {
    const diff = modified - base;
    const percent = (diff / base) * 100;
    
    if (diff < -1) return { type: 'improved', text: '↓ улучшение', color: colors.success, icon: '✅' };
    if (diff > 1) return { type: 'worsened', text: '↑ ухудшение', color: colors.danger, icon: '⚠️' };
    return { type: 'neutral', text: 'без изменений', color: '#64748b', icon: '⚪' };
  };

  return (
    <div className="wait-distribution-container">
      {/* Заголовок */}
      <div className="distribution-header-section">
        <div className="header-left">
          <h3 className="section-title">
            <BarChart size={20} />
            Распределение времени ожидания
          </h3>
          <p className="section-subtitle">
            Анализ того, как долго пассажиры ждут транспорт
          </p>
        </div>
        
        {modifiedDistribution && (
          <label className="comparison-toggle-switch">
            <input
              type="checkbox"
              checked={showComparison}
              onChange={() => setShowComparison(!showComparison)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">
              <TrendingUp size={14} />
              Сравнить с изменениями
            </span>
          </label>
        )}
      </div>

      {/* График распределения */}
      <div className="distribution-chart-section">
        <div className="chart-header">
          <span className="chart-title">Распределение пассажиров по времени ожидания</span>
          <div className="chart-stats">
            <span className="stat-badge">
              <Clock size={12} />
              Всего: {totalPassengers.toLocaleString()} пасс.
            </span>
          </div>
        </div>

        <div className="distribution-chart">
          {baseDistribution.buckets.map((bucket, index) => {
            const baseHeight = (baseDistribution.counts[index] / maxCount) * 100;
            const modHeight = showComparison && modifiedDistribution
              ? (modifiedDistribution.counts[index] / maxCount) * 100
              : 0;
            
            const isHovered = hoveredBar === index;
            const waitColor = getWaitTimeColor(index);
            
            return (
              <div 
                key={bucket} 
                className="distribution-bar-group"
                onMouseEnter={() => setHoveredBar(index)}
                onMouseLeave={() => setHoveredBar(null)}
              >
                <div className="bar-container">
                  <div
                    className="distribution-bar base"
                    style={{ 
                      height: `${baseHeight}%`,
                      backgroundColor: waitColor,
                      opacity: isHovered ? 1 : 0.8
                    }}
                  >
                    <span className="bar-value">{baseDistribution.counts[index]}</span>
                  </div>
                  {showComparison && modifiedDistribution && (
                    <div
                      className="distribution-bar modified"
                      style={{ 
                        height: `${modHeight}%`,
                        backgroundColor: colors.modified,
                        opacity: isHovered ? 0.9 : 0.6
                      }}
                    >
                      <span className="bar-value">{modifiedDistribution.counts[index]}</span>
                    </div>
                  )}
                </div>
                <div className="bucket-label">
                  <span>{bucket}-{bucket+5}</span>
                  <small>мин</small>
                </div>
                
                {isHovered && (
                  <div className="bar-tooltip">
                    <div className="tooltip-row">
                      <span className="tooltip-label">Базовый:</span>
                      <span className="tooltip-value">{baseDistribution.counts[index]} пасс.</span>
                    </div>
                    {showComparison && modifiedDistribution && (
                      <div className="tooltip-row">
                        <span className="tooltip-label">С изменениями:</span>
                        <span className="tooltip-value">{modifiedDistribution.counts[index]} пасс.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: colors.base }}></div>
            <span>Базовый сценарий</span>
          </div>
          {showComparison && modifiedDistribution && (
            <div className="legend-item">
              <div className="legend-color" style={{ backgroundColor: colors.modified }}></div>
              <span>С изменениями</span>
            </div>
          )}
          <div className="legend-divider" />
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: colors.success }}></div>
            <span>Быстро (0-5 мин)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: colors.warning }}></div>
            <span>Средне (5-15 мин)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: colors.danger }}></div>
            <span>Долго ({'>'}15 мин)</span>
          </div>
        </div>
      </div>

      {/* Статистика ожидания */}
      <div className="stats-section">
        <div className="stats-header">
          <h4 className="stats-title">
            <PieChart size={16} />
            Детальная статистика
          </h4>
        </div>

        <div className="percentiles-grid">
          <div className="percentile-card">
            <div className="percentile-icon">📊</div>
            <div className="percentile-info">
              <div className="percentile-label">Медиана (50%)</div>
              <div className="percentile-value">{baseDistribution.median.toFixed(1)} <span>мин</span></div>
            </div>
            {modifiedDistribution && (
              <div className={`percentile-change ${getChangeStatus(baseDistribution.median, modifiedDistribution.median).type}`}>
                {getChangeStatus(baseDistribution.median, modifiedDistribution.median).icon}
                {Math.abs((modifiedDistribution.median - baseDistribution.median)).toFixed(1)} мин
              </div>
            )}
          </div>
          
          <div className="percentile-card highlighted">
            <div className="percentile-icon">🎯</div>
            <div className="percentile-info">
              <div className="percentile-label">p95 (95% пассажиров)</div>
              <div className="percentile-value">{baseDistribution.p95.toFixed(1)} <span>мин</span></div>
            </div>
            {modifiedDistribution && (
              <div className={`percentile-change ${getChangeStatus(baseDistribution.p95, modifiedDistribution.p95).type}`}>
                {getChangeStatus(baseDistribution.p95, modifiedDistribution.p95).icon}
                {Math.abs((modifiedDistribution.p95 - baseDistribution.p95)).toFixed(1)} мин
              </div>
            )}
          </div>
          
          <div className="percentile-card">
            <div className="percentile-icon">⚠️</div>
            <div className="percentile-info">
              <div className="percentile-label">p99 (99% пассажиров)</div>
              <div className="percentile-value">{baseDistribution.p99.toFixed(1)} <span>мин</span></div>
            </div>
            {modifiedDistribution && (
              <div className={`percentile-change ${getChangeStatus(baseDistribution.p99, modifiedDistribution.p99).type}`}>
                {getChangeStatus(baseDistribution.p99, modifiedDistribution.p99).icon}
                {Math.abs((modifiedDistribution.p99 - baseDistribution.p99)).toFixed(1)} мин
              </div>
            )}
          </div>
          
          <div className="percentile-card">
            <div className="percentile-icon">📈</div>
            <div className="percentile-info">
              <div className="percentile-label">Среднее</div>
              <div className="percentile-value">{baseDistribution.average.toFixed(1)} <span>мин</span></div>
            </div>
            {modifiedDistribution && (
              <div className={`percentile-change ${getChangeStatus(baseDistribution.average, modifiedDistribution.average).type}`}>
                {getChangeStatus(baseDistribution.average, modifiedDistribution.average).icon}
                {Math.abs((modifiedDistribution.average - baseDistribution.average)).toFixed(1)} мин
              </div>
            )}
          </div>
        </div>

        {/* Сводка по категориям ожидания */}
        <div className="distribution-summary">
          <div className="summary-title">
            <Info size={14} />
            Качество обслуживания
          </div>
          
          <div className="summary-grid">
            <div className="summary-card good">
              <div className="summary-icon">😊</div>
              <div className="summary-content">
                <div className="summary-label">Быстро {'<'} 5 мин</div>
                <div className="summary-value">
                  {((baseDistribution.counts[0] / totalPassengers) * 100).toFixed(1)}%
                </div>
                <div className="summary-desc">отличное обслуживание</div>
              </div>
            </div>
            
            <div className="summary-card warning">
              <div className="summary-icon">😐</div>
              <div className="summary-content">
                <div className="summary-label">Средне 5-15 мин</div>
                <div className="summary-value">
                  {((baseDistribution.counts.slice(1, 3).reduce((a, b) => a + b, 0) / totalPassengers) * 100).toFixed(1)}%
                </div>
                <div className="summary-desc">приемлемо</div>
              </div>
            </div>
            
            <div className="summary-card bad">
              <div className="summary-icon">😤</div>
              <div className="summary-content">
                <div className="summary-label">Долго {'>'} 15 мин</div>
                <div className="summary-value">
                  {((baseDistribution.counts.slice(3).reduce((a, b) => a + b, 0) / totalPassengers) * 100).toFixed(1)}%
                </div>
                <div className="summary-desc">требует улучшения</div>
              </div>
            </div>
          </div>

          {/* Общая оценка */}
          <div className="overall-rating">
            <div className="rating-label">Общая оценка качества</div>
            <div className="rating-value">
              {(() => {
                const goodPercent = (baseDistribution.counts[0] / totalPassengers) * 100;
                if (goodPercent >= 70) return '🌟 Отлично';
                if (goodPercent >= 50) return '👍 Хорошо';
                if (goodPercent >= 30) return '😐 Удовлетворительно';
                return '⚠️ Требует улучшения';
              })()}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .wait-distribution-container {
          background: white;
          border-radius: 16px;
          overflow: hidden;
        }

        .distribution-header-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 20px 24px;
          border-bottom: 1px solid ${colors.border};
          background: white;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 4px 0;
        }

        .section-subtitle {
          font-size: 13px;
          color: #64748b;
          margin: 0;
        }

        .comparison-toggle-switch {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
        }

        .comparison-toggle-switch input {
          display: none;
        }

        .toggle-slider {
          width: 44px;
          height: 24px;
          background: #cbd5e1;
          border-radius: 24px;
          position: relative;
          transition: all 0.3s;
        }

        .toggle-slider:before {
          content: '';
          position: absolute;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          top: 2px;
          left: 2px;
          transition: all 0.3s;
        }

        .comparison-toggle-switch input:checked + .toggle-slider {
          background: #3b82f6;
        }

        .comparison-toggle-switch input:checked + .toggle-slider:before {
          transform: translateX(20px);
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #475569;
        }

        .distribution-chart-section {
          padding: 20px 24px;
          background: ${colors.background};
          border-bottom: 1px solid ${colors.border};
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .chart-title {
          font-size: 13px;
          font-weight: 500;
          color: #334155;
        }

        .chart-stats {
          display: flex;
          gap: 12px;
        }

        .stat-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: white;
          border-radius: 20px;
          font-size: 12px;
          color: #475569;
          border: 1px solid ${colors.border};
        }

        .distribution-chart {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 200px;
          margin-bottom: 16px;
        }

        .distribution-bar-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
        }

        .bar-container {
          width: 100%;
          height: 160px;
          display: flex;
          flex-direction: column-reverse;
          gap: 2px;
          position: relative;
        }

        .distribution-bar {
          width: 100%;
          min-height: 2px;
          border-radius: 4px 4px 0 0;
          transition: all 0.3s ease;
          position: relative;
          cursor: pointer;
        }

        .distribution-bar.base {
          background-color: ${colors.base};
        }

        .distribution-bar.modified {
          background-color: ${colors.modified};
        }

        .bar-value {
          position: absolute;
          top: -20px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 10px;
          font-weight: 600;
          color: #475569;
          white-space: nowrap;
        }

        .bucket-label {
          margin-top: 8px;
          text-align: center;
          font-size: 10px;
          color: #64748b;
        }

        .bucket-label small {
          font-size: 8px;
          display: block;
        }

        .bar-tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: #1e293b;
          color: white;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 11px;
          white-space: nowrap;
          z-index: 10;
          margin-bottom: 8px;
          pointer-events: none;
        }

        .tooltip-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .chart-legend {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid ${colors.border};
        }

        .legend-divider {
          width: 1px;
          background: ${colors.border};
        }

        .stats-section {
          padding: 20px 24px;
        }

        .stats-header {
          margin-bottom: 16px;
        }

        .stats-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 600;
          color: #334155;
          margin: 0;
        }

        .percentiles-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }

        .percentile-card {
          background: ${colors.background};
          border-radius: 12px;
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid ${colors.border};
          transition: all 0.2s;
        }

        .percentile-card.highlighted {
          background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
          border-color: #3b82f6;
        }

        .percentile-icon {
          font-size: 24px;
        }

        .percentile-info {
          flex: 1;
        }

        .percentile-label {
          font-size: 11px;
          color: #64748b;
          margin-bottom: 4px;
        }

        .percentile-value {
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
        }

        .percentile-value span {
          font-size: 11px;
          font-weight: 400;
          color: #64748b;
        }

        .percentile-change {
          font-size: 11px;
          font-weight: 500;
          padding: 2px 8px;
          border-radius: 20px;
          white-space: nowrap;
        }

        .percentile-change.improved {
          background: #dcfce7;
          color: #166534;
        }

        .percentile-change.worsened {
          background: #fee2e2;
          color: #991b1b;
        }

        .percentile-change.neutral {
          background: #f1f5f9;
          color: #475569;
        }

        .distribution-summary {
          background: ${colors.background};
          border-radius: 12px;
          padding: 16px;
        }

        .summary-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 16px;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .summary-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 12px;
          background: white;
        }

        .summary-card.good { border-left: 3px solid ${colors.success}; }
        .summary-card.warning { border-left: 3px solid ${colors.warning}; }
        .summary-card.bad { border-left: 3px solid ${colors.danger}; }

        .summary-icon {
          font-size: 24px;
        }

        .summary-content {
          flex: 1;
        }

        .summary-label {
          font-size: 11px;
          color: #64748b;
        }

        .summary-value {
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
        }

        .summary-desc {
          font-size: 10px;
          color: #94a3b8;
          margin-top: 2px;
        }

        .overall-rating {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 12px;
          border-top: 1px solid ${colors.border};
        }

        .rating-label {
          font-size: 13px;
          font-weight: 500;
          color: #475569;
        }

        .rating-value {
          font-size: 14px;
          font-weight: 600;
          color: #3b82f6;
        }

        @media (max-width: 768px) {
          .percentiles-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .summary-grid {
            flex-direction: column;
          }
          
          .distribution-chart {
            height: 150px;
          }
        }
      `}</style>
    </div>
  );
};

export default WaitTimeDistributionChart;