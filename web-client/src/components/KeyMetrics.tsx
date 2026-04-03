// src/components/KeyMetrics.tsx
import React from 'react';
import { TrendingUp, Clock, Users, Gauge, ArrowUp, ArrowDown, Minus } from 'lucide-react';
// Убираем импорт motion

interface MetricsData {
  avgWaitTime: number;
  maxWaitTime: number;
  totalPassengers: number;
  avgLoad: number;
  transportUtilization: number;
}

interface KeyMetricsProps {
  baseMetrics: MetricsData;
  modifiedMetrics: MetricsData;
}

const KeyMetrics: React.FC<KeyMetricsProps> = ({ baseMetrics, modifiedMetrics }) => {
  const getChange = (base: number, modified: number) => {
    if (base === 0) return { value: 0, type: 'neutral' };
    const change = ((modified - base) / base) * 100;
    if (change > 0) return { value: change, type: 'positive' };
    if (change < 0) return { value: Math.abs(change), type: 'negative' };
    return { value: 0, type: 'neutral' };
  };

  const ChangeIcon = ({ type }: { type: string }) => {
    if (type === 'positive') return <ArrowUp size={14} className="text-green-500" />;
    if (type === 'negative') return <ArrowDown size={14} className="text-red-500" />;
    return <Minus size={14} className="text-gray-400" />;
  };

  const metrics = [
    {
      id: 'waitTime',
      title: 'Среднее время ожидания',
      unit: 'мин',
      icon: <Clock size={20} className="text-blue-500" />,
      base: baseMetrics.avgWaitTime,
      modified: modifiedMetrics.avgWaitTime,
      color: '#3b82f6',
      description: 'Среднее время, которое пассажиры проводят на остановке',
      isBetterWhenLower: true  // ✅ меньше = лучше
    },
    {
      id: 'maxWait',
      title: 'Максимальное время ожидания',
      unit: 'мин',
      icon: <Clock size={20} className="text-orange-500" />,
      base: baseMetrics.maxWaitTime,
      modified: modifiedMetrics.maxWaitTime,
      color: '#f59e0b',
      description: 'Худшее время ожидания в часы пик',
      isBetterWhenLower: true
    },
    {
      id: 'passengers',
      title: 'Всего пассажиров',
      unit: 'чел',
      icon: <Users size={20} className="text-green-500" />,
      base: baseMetrics.totalPassengers,
      modified: modifiedMetrics.totalPassengers,
      color: '#10b981',
      description: 'Общее количество пассажиров за день',
      isBetterWhenLower: false,  // ✅ больше = лучше
      formatter: (v: number) => v.toLocaleString()
    },
    {
      id: 'load',
      title: 'Средняя загрузка остановок',
      unit: '/10',
      icon: <Gauge size={20} className="text-purple-500" />,
      base: baseMetrics.avgLoad,
      modified: modifiedMetrics.avgLoad,
      color: '#8b5cf6',
      description: 'Загруженность остановок по шкале от 0 до 10',
      isBetterWhenLower: true
    },
    {
      id: 'utilization',
      title: 'Использование транспорта',
      unit: '%',
      icon: <TrendingUp size={20} className="text-cyan-500" />,
      base: baseMetrics.transportUtilization * 100,
      modified: modifiedMetrics.transportUtilization * 100,
      color: '#06b6d4',
      description: 'Эффективность использования транспортных средств',
      isBetterWhenLower: false,
      formatter: (v: number) => v.toFixed(1)
    }
  ];

  return (
    <div className="key-metrics-container">
      <div className="metrics-header">
        <h3 className="metrics-title">
          <TrendingUp size={18} />
          Ключевые метрики эффективности
        </h3>
        <p className="metrics-subtitle">
          Сравнение базового и изменённого сценариев
        </p>
      </div>

      <div className="metrics-grid">
        {metrics.map((metric, index) => {
          const change = getChange(metric.base, metric.modified);
          const isBetter = metric.isBetterWhenLower 
            ? change.type === 'negative'  // уменьшение = хорошо
            : change.type === 'positive';  // увеличение = хорошо

          return (
            <div 
              key={metric.id} 
              className="metric-card"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="metric-card-header">
                <div className="metric-icon" style={{ backgroundColor: `${metric.color}15` }}>
                  {metric.icon}
                </div>
                <div className="metric-title-tooltip" title={metric.description}>
                  <span className="metric-title">{metric.title}</span>
                </div>
              </div>

              <div className="metric-values">
                <div className="metric-value baseline">
                  <span className="value-label">Было</span>
                  <span className="value-number">
                    {metric.formatter ? metric.formatter(metric.base) : metric.base.toFixed(1)}
                    <span className="value-unit">{metric.unit}</span>
                  </span>
                </div>

                <div className="metric-arrow">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 4L12 20M12 20L8 16M12 20L16 16" stroke={metric.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>

                <div className="metric-value modified">
                  <span className="value-label">Стало</span>
                  <span className="value-number" style={{ color: metric.color }}>
                    {metric.formatter ? metric.formatter(metric.modified) : metric.modified.toFixed(1)}
                    <span className="value-unit">{metric.unit}</span>
                  </span>
                </div>
              </div>

              <div className={`metric-change-badge ${isBetter ? 'improved' : 'worsened'}`}>
                <ChangeIcon type={change.type} />
                <span>
                  {change.type === 'positive' && `+${change.value.toFixed(1)}%`}
                  {change.type === 'negative' && `-${change.value.toFixed(1)}%`}
                  {change.type === 'neutral' && '0%'}
                </span>
              </div>

              <div className="metric-progress">
                <div className="progress-bar-bg">
                  <div 
                    className="progress-bar-fill baseline"
                    style={{ 
                      width: `${Math.min(100, (metric.base / Math.max(metric.base, metric.modified)) * 100)}%`
                    }}
                  />
                  <div 
                    className="progress-bar-fill modified"
                    style={{ 
                      width: `${Math.min(100, (metric.modified / Math.max(metric.base, metric.modified)) * 100)}%`,
                      backgroundColor: metric.color
                    }}
                  />
                </div>
                <div className="progress-labels">
                  <span>Базовый</span>
                  <span>С изменениями</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="metrics-summary">
        <div className="summary-item">
          <span className="summary-label">Общая эффективность</span>
          <div className="summary-value">
            {(() => {
              let totalImprovement = 0;
              let count = 0;
              
              metrics.forEach(m => {
                const change = getChange(m.base, m.modified);
                const isGood = m.isBetterWhenLower 
                  ? change.type === 'negative'
                  : change.type === 'positive';
                
                if (change.type !== 'neutral') {
                  totalImprovement += isGood ? change.value : -change.value;
                  count++;
                }
              });
              
              const avgImprovement = count > 0 ? totalImprovement / count : 0;
              
              if (avgImprovement > 5) return `✨ +${avgImprovement.toFixed(1)}% улучшение`;
              if (avgImprovement > 0) return `👍 +${avgImprovement.toFixed(1)}% улучшение`;
              if (avgImprovement > -5) return `⚪ ${Math.abs(avgImprovement).toFixed(1)}% изменение`;
              return `⚠️ ${Math.abs(avgImprovement).toFixed(1)}% ухудшение`;
            })()}
          </div>
        </div>
        <div className="summary-item">
          <span className="summary-label">Рекомендация</span>
          <div className="summary-value">
            {baseMetrics.avgWaitTime > modifiedMetrics.avgWaitTime 
              ? '✅ Изменения эффективны'
              : baseMetrics.avgWaitTime < modifiedMetrics.avgWaitTime
              ? '💡 Требуется дополнительная оптимизация'
              : '⚪ Нет значимых изменений'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyMetrics;