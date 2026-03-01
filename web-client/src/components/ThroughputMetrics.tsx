// src/pages/components/ThroughputMetrics.tsx
import React from 'react';
import { TrendingUp, Clock, Zap, Target, Users } from 'lucide-react';

interface ThroughputMetricsProps {
  baseThroughput: any;
  modifiedThroughput?: any;
}

const ThroughputMetrics: React.FC<ThroughputMetricsProps> = ({ 
  baseThroughput, 
  modifiedThroughput 
}) => {
  const formatNumber = (num: number) => Math.round(num).toLocaleString();
  
  return (
    <div className="throughput-metrics">
      <div className="panel-section">
        <h3 className="panel-title">
          <Zap size={18} />
          Пропускная способность в час пик
        </h3>
        
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">
              <Clock size={16} />
              Час пик
            </div>
            <div className="metric-value">{baseThroughput.peak_hour}:00</div>
          </div>
          
          <div className="metric-card">
            <div className="metric-label">
              <Users size={16} />
              Пассажиров в час
            </div>
            <div className="metric-value">
              {formatNumber(baseThroughput.peak_hour_passengers)}
              {modifiedThroughput && (
                <span className={`metric-change ${
                  modifiedThroughput.peak_hour_passengers > baseThroughput.peak_hour_passengers 
                    ? 'positive' : 'negative'
                }`}>
                  {((modifiedThroughput.peak_hour_passengers / baseThroughput.peak_hour_passengers - 1) * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-label">
              <Target size={16} />
              Теоретический максимум
            </div>
            <div className="metric-value">{formatNumber(baseThroughput.theoretical_capacity)}</div>
          </div>
          
          <div className="metric-card">
            <div className="metric-label">
              <TrendingUp size={16} />
              Использование
            </div>
            <div className="metric-value">
              {(baseThroughput.utilization_rate * 100).toFixed(1)}%
              {modifiedThroughput && (
                <span className={`metric-change ${
                  modifiedThroughput.utilization_rate > baseThroughput.utilization_rate 
                    ? 'negative' : 'positive'
                }`}>
                  {((modifiedThroughput.utilization_rate / baseThroughput.utilization_rate - 1) * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="panel-section">
        <h3 className="panel-title">
          <Clock size={18} />
          Почасовая пропускная способность
        </h3>
        
        <div className="throughput-chart">
          <div className="chart-bars throughput">
            {baseThroughput.hourly_throughput.map((data: any) => (
              <div key={data.hour} className="throughput-bar-group">
                <div 
                  className="throughput-bar"
                  style={{ 
                    height: `${(data.passengers_departed / baseThroughput.peak_hour_passengers) * 100}%` 
                  }}
                  title={`${data.hour}:00 - уехало: ${data.passengers_departed}, ждёт: ${data.passengers_waiting}`}
                />
                <div className="hour-label">{data.hour}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="throughput-stats">
          <div className="stat-row">
            <span className="stat-label">Всего уехало за день:</span>
            <span className="stat-value">
              {formatNumber(baseThroughput.hourly_throughput.reduce(
                (acc: number, h: any) => acc + h.passengers_departed, 0
              ))}
            </span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Средняя очередь:</span>
            <span className="stat-value">
              {formatNumber(baseThroughput.hourly_throughput.reduce(
                (acc: number, h: any) => acc + h.passengers_waiting, 0
              ) / 24)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThroughputMetrics;