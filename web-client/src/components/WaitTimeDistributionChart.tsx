// src/pages/components/WaitTimeDistributionChart.tsx
import React, { useState } from 'react';
import { BarChart, PieChart, TrendingUp } from 'lucide-react';

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
  
  const maxCount = Math.max(...baseDistribution.counts);
  const totalPassengers = baseDistribution.counts.reduce((a, b) => a + b, 0);
  
  return (
    <div className="wait-distribution">
      <div className="panel-section">
        <div className="distribution-header">
          <h3 className="panel-title">
            <BarChart size={18} />
            Распределение времени ожидания
          </h3>
          
          {modifiedDistribution && (
            <label className="comparison-toggle">
              <input
                type="checkbox"
                checked={showComparison}
                onChange={() => setShowComparison(!showComparison)}
              />
              <span>Сравнить с изменениями</span>
            </label>
          )}
        </div>
        
        <div className="distribution-chart">
          {baseDistribution.buckets.map((bucket, index) => {
            const baseHeight = (baseDistribution.counts[index] / maxCount) * 100;
            const modHeight = showComparison && modifiedDistribution
              ? (modifiedDistribution.counts[index] / maxCount) * 100
              : 0;
            
            // Безопасное получение значения для tooltip
            const getModifiedTooltip = () => {
              if (!showComparison || !modifiedDistribution) return '';
              const modifiedCount = modifiedDistribution.counts[index] || 0;
              return `${bucket}-${bucket+5} мин: ${modifiedCount} пасс.`;
            };
            
            return (
              <div key={bucket} className="distribution-bar-group">
                <div className="bar-container">
                  <div
                    className="distribution-bar base"
                    style={{ height: `${baseHeight}%` }}
                    title={`${bucket}-${bucket+5} мин: ${baseDistribution.counts[index]} пасс.`}
                  />
                  {showComparison && modifiedDistribution && (
                    <div
                      className="distribution-bar modified"
                      style={{ height: `${modHeight}%` }}
                      title={getModifiedTooltip()}
                    />
                  )}
                </div>
                <div className="bucket-label">{bucket}-{bucket+5}</div>
              </div>
            );
          })}
        </div>
        
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color base"></div>
            <span>Базовый сценарий</span>
          </div>
          {showComparison && modifiedDistribution && (
            <div className="legend-item">
              <div className="legend-color modified"></div>
              <span>С изменениями</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="panel-section">
        <h3 className="panel-title">
          <PieChart size={18} />
          Статистика ожидания
        </h3>
        
        <div className="percentiles-grid">
          <div className="percentile-card">
            <div className="percentile-label">Медиана (50%)</div>
            <div className="percentile-value">{baseDistribution.median.toFixed(1)} мин</div>
            {modifiedDistribution && (
              <div className={`percentile-change ${
                modifiedDistribution.median > baseDistribution.median ? 'worse' : 'better'
              }`}>
                {modifiedDistribution.median > baseDistribution.median ? '↑' : '↓'} 
                {Math.abs((modifiedDistribution.median - baseDistribution.median)).toFixed(1)} мин
              </div>
            )}
          </div>
          
          <div className="percentile-card highlight">
            <div className="percentile-label">p95 (95%)</div>
            <div className="percentile-value">{baseDistribution.p95.toFixed(1)} мин</div>
            {modifiedDistribution && (
              <div className={`percentile-change ${
                modifiedDistribution.p95 > baseDistribution.p95 ? 'worse' : 'better'
              }`}>
                {modifiedDistribution.p95 > baseDistribution.p95 ? '↑' : '↓'} 
                {Math.abs((modifiedDistribution.p95 - baseDistribution.p95)).toFixed(1)} мин
              </div>
            )}
          </div>
          
          <div className="percentile-card">
            <div className="percentile-label">p99 (99%)</div>
            <div className="percentile-value">{baseDistribution.p99.toFixed(1)} мин</div>
            {modifiedDistribution && (
              <div className={`percentile-change ${
                modifiedDistribution.p99 > baseDistribution.p99 ? 'worse' : 'better'
              }`}>
                {modifiedDistribution.p99 > baseDistribution.p99 ? '↑' : '↓'} 
                {Math.abs((modifiedDistribution.p99 - baseDistribution.p99)).toFixed(1)} мин
              </div>
            )}
          </div>
          
          <div className="percentile-card">
            <div className="percentile-label">Среднее</div>
            <div className="percentile-value">{baseDistribution.average.toFixed(1)} мин</div>
            {modifiedDistribution && (
              <div className={`percentile-change ${
                modifiedDistribution.average > baseDistribution.average ? 'worse' : 'better'
              }`}>
                {modifiedDistribution.average > baseDistribution.average ? '↑' : '↓'} 
                {Math.abs((modifiedDistribution.average - baseDistribution.average)).toFixed(1)} мин
              </div>
            )}
          </div>
        </div>
        
        <div className="distribution-summary">
          <div className="summary-row">
            <span className="summary-label">Всего пассажиров:</span>
            <span className="summary-value">{totalPassengers.toLocaleString()}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Ждут {'<'} 5 мин:</span>
            <span className="summary-value">
              {((baseDistribution.counts[0] / totalPassengers) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Ждут {'>'} 15 мин:</span>
            <span className="summary-value">
              {((baseDistribution.counts.slice(3).reduce((a, b) => a + b, 0) / totalPassengers) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaitTimeDistributionChart;