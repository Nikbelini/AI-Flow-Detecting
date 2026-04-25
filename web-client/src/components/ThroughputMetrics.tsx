// src/components/ThroughputMetrics.tsx
import React from 'react';
import { TrendingUp, Clock, Zap, Target, Users, Route } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, ComposedChart
} from 'recharts';

interface ThroughputMetricsProps {
  baseThroughput: any;
  modifiedThroughput?: any;
  baseMetrics?: any;
  modifiedMetrics?: any;
}

const ThroughputMetrics: React.FC<ThroughputMetricsProps> = ({ 
  baseThroughput, 
  modifiedThroughput,
  baseMetrics,
  modifiedMetrics
}) => {
  const formatNumber = (num: number) => Math.round(num).toLocaleString();
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} мин`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours} ч ${mins} мин`;
  };
  
  // Подготавливаем данные для графика
  const chartData = baseThroughput.hourly_throughput.map((item: any) => ({
    hour: item.hour,
    departed: item.passengers_departed,
    waiting: item.passengers_waiting,
    arrived: item.passengers_arrived,
    // Если есть модифицированные данные - добавляем их
    ...(modifiedThroughput && {
      modifiedDeparted: modifiedThroughput.hourly_throughput[item.hour]?.passengers_departed,
      modifiedWaiting: modifiedThroughput.hourly_throughput[item.hour]?.passengers_waiting,
    })
  }));

  const peakHour = baseThroughput.peak_hour;
  
  return (
    <div className="throughput-metrics">
      {/* ========== ВРЕМЯ В ПУТИ (новая секция) ========== */}
      {(baseMetrics || modifiedMetrics) && (
        <div className="panel-section">
          <h3 className="panel-title">
            <Route size={18} />
            Время в пути
          </h3>
          
          <div className="metrics-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
            marginTop: '12px'
          }}>
            {/* Среднее время в пути */}
            <div className="metric-card" style={{
              background: '#f8fafc',
              padding: '12px',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Clock size={16} color="#6366f1" />
                <span style={{ fontSize: '12px', color: '#64748b' }}>Среднее время в пути</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>
                {formatTime(baseMetrics?.avgTravelTime || 0)}
                {modifiedMetrics && modifiedMetrics.avgTravelTime !== undefined && (
                  <span style={{
                    fontSize: '12px',
                    marginLeft: '8px',
                    color: modifiedMetrics.avgTravelTime > (baseMetrics?.avgTravelTime || 0) 
                      ? '#ef4444' : '#10b981'
                  }}>
                    {modifiedMetrics.avgTravelTime > (baseMetrics?.avgTravelTime || 0) ? '↑' : '↓'}
                    {Math.abs(((modifiedMetrics.avgTravelTime / (baseMetrics?.avgTravelTime || 1) - 1) * 100)).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            
            {/* Максимальное время в пути */}
            <div className="metric-card" style={{
              background: '#f8fafc',
              padding: '12px',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Zap size={16} color="#ef4444" />
                <span style={{ fontSize: '12px', color: '#64748b' }}>Максимальное время в пути</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>
                {formatTime(baseMetrics?.maxTravelTime || 0)}
                {modifiedMetrics && modifiedMetrics.maxTravelTime !== undefined && (
                  <span style={{
                    fontSize: '12px',
                    marginLeft: '8px',
                    color: modifiedMetrics.maxTravelTime > (baseMetrics?.maxTravelTime || 0) 
                      ? '#ef4444' : '#10b981'
                  }}>
                    {modifiedMetrics.maxTravelTime > (baseMetrics?.maxTravelTime || 0) ? '↑' : '↓'}
                    {Math.abs(((modifiedMetrics.maxTravelTime / (baseMetrics?.maxTravelTime || 1) - 1) * 100)).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Информация о расчёте */}
          <div style={{
            fontSize: '11px',
            color: '#64748b',
            marginTop: '8px',
            textAlign: 'center'
          }}>
            Время в пути включает ожидание и поездку от посадки до высадки
          </div>
        </div>
      )}

      {/* ========== ПРОПУСКНАЯ СПОСОБНОСТЬ ========== */}
      <div className="panel-section">
        <h3 className="panel-title">
          <Zap size={18} />
          Пропускная способность в час пик
        </h3>
        
        <div className="metrics-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginTop: '12px'
        }}>
          {/* Час пик */}
          <div className="metric-card" style={{
            background: '#f8fafc',
            padding: '12px',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <Clock size={16} color="#64748b" />
              <span style={{ fontSize: '12px', color: '#64748b' }}>Час пик</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>
              {baseThroughput.peak_hour}:00
            </div>
          </div>
          
          {/* Пассажиров в час */}
          <div className="metric-card" style={{
            background: '#f8fafc',
            padding: '12px',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <Users size={16} color="#64748b" />
              <span style={{ fontSize: '12px', color: '#64748b' }}>Пассажиров в час</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>
              {formatNumber(baseThroughput.peak_hour_passengers)}
              {modifiedThroughput && (
                <span style={{
                  fontSize: '12px',
                  marginLeft: '8px',
                  color: modifiedThroughput.peak_hour_passengers > baseThroughput.peak_hour_passengers 
                    ? '#ef4444' : '#10b981'
                }}>
                  {modifiedThroughput.peak_hour_passengers > baseThroughput.peak_hour_passengers ? '↑' : '↓'}
                  {Math.abs(((modifiedThroughput.peak_hour_passengers / baseThroughput.peak_hour_passengers - 1) * 100)).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          
          {/* Теоретический максимум */}
          <div className="metric-card" style={{
            background: '#f8fafc',
            padding: '12px',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <Target size={16} color="#64748b" />
              <span style={{ fontSize: '12px', color: '#64748b' }}>Теоретический максимум</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>
              {formatNumber(baseThroughput.theoretical_capacity)}
            </div>
          </div>
          
          {/* Использование */}
          <div className="metric-card" style={{
            background: '#f8fafc',
            padding: '12px',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <TrendingUp size={16} color="#64748b" />
              <span style={{ fontSize: '12px', color: '#64748b' }}>Использование</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>
              {(baseThroughput.utilization_rate * 100).toFixed(1)}%
              {modifiedThroughput && (
                <span style={{
                  fontSize: '12px',
                  marginLeft: '8px',
                  color: modifiedThroughput.utilization_rate > baseThroughput.utilization_rate 
                    ? '#ef4444' : '#10b981'
                }}>
                  {modifiedThroughput.utilization_rate > baseThroughput.utilization_rate ? '↑' : '↓'}
                  {Math.abs(((modifiedThroughput.utilization_rate / baseThroughput.utilization_rate - 1) * 100)).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* ========== ГРАФИК: Почасовая пропускная способность ========== */}
      <div className="panel-section">
        <h3 className="panel-title">
          <Clock size={18} />
          Почасовая пропускная способность
        </h3>
        
        <div style={{ width: '100%', height: '220px', marginTop: '12px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}`} stroke="#64748b" fontSize={10} interval={3} />
              <YAxis yAxisId="left" stroke="#64748b" fontSize={10} label={{ value: 'Пассажиров', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }} />
              <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} formatter={(value: number, name: string) => {
                const labels: Record<string, string> = { departed: 'Уехало', waiting: 'Ожидает', arrived: 'Прибыло' };
                return [`${value} чел.`, labels[name] || name];
              }} labelFormatter={(hour) => `${hour}:00`} />
              <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} formatter={(value) => {
                const labels: Record<string, string> = { departed: 'Уехало', waiting: 'Ожидает', arrived: 'Прибыло' };
                return labels[value] || value;
              }} />
              <Bar yAxisId="left" dataKey="departed" name="departed" fill="#3b82f6" opacity={0.8} radius={[4, 4, 0, 0]} barSize={20} />
              {chartData.some(d => d.waiting > 0) && (
                <Bar yAxisId="left" dataKey="waiting" name="waiting" fill="#f59e0b" opacity={0.6} radius={[4, 4, 0, 0]} barSize={20} />
              )}
              <Line yAxisId="left" type="monotone" dataKey="arrived" name="arrived" stroke="#10b981" strokeWidth={2} dot={false} activeDot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '8px', background: '#f1f5f9', borderRadius: '6px', fontSize: '12px' }}>
          <div style={{ width: '8px', height: '8px', background: '#f97316', borderRadius: '2px' }}></div>
          <span>Пиковый час: <strong>{peakHour}:00</strong> (уехало {formatNumber(baseThroughput.peak_hour_passengers)} чел.)</span>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
          <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Всего уехало за день</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>
              {formatNumber(baseThroughput.hourly_throughput.reduce((acc: number, h: any) => acc + h.passengers_departed, 0))}
            </div>
          </div>
          <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Средняя очередь</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>
              {formatNumber(baseThroughput.hourly_throughput.reduce((acc: number, h: any) => acc + h.passengers_waiting, 0) / 24)}
            </div>
          </div>
        </div>
      </div>
      
      {/* ========== СРАВНЕНИЕ С ИЗМЕНЕНИЯМИ ========== */}
      {modifiedThroughput && (
        <div className="panel-section">
          <h3 className="panel-title">
            <TrendingUp size={18} />
            Сравнение с изменениями
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ padding: '8px', background: '#f8fafc', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Было (час пик)</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{formatNumber(baseThroughput.peak_hour_passengers)} чел.</div>
            </div>
            <div style={{ padding: '8px', background: '#f8fafc', borderRadius: '6px', borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Стало (час пик)</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{formatNumber(modifiedThroughput.peak_hour_passengers)} чел.</div>
            </div>
          </div>
          
          {/* Сравнение времени в пути */}
          {baseMetrics && modifiedMetrics && (
            <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ padding: '8px', background: '#f8fafc', borderRadius: '6px', borderLeft: '3px solid #6366f1' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Ср. время в пути (было)</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{formatTime(baseMetrics.avgTravelTime || 0)}</div>
              </div>
              <div style={{ padding: '8px', background: '#f8fafc', borderRadius: '6px', borderLeft: '3px solid #8b5cf6' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Ср. время в пути (стало)</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{formatTime(modifiedMetrics.avgTravelTime || 0)}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ThroughputMetrics;