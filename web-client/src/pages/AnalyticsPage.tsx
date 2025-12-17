// src/pages/AnalyticsPage.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import MapComponent from './Map/Map';
import './AnalyticsPage.css'; // Создадим CSS файл для стилей

const AnalyticsPage: React.FC = () => {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [predictionDepth, setPredictionDepth] = useState(24);
  const [activeMetric, setActiveMetric] = useState('passenger');

  const metrics = [
    { id: 'passenger', title: 'Пассажиропоток', unit: 'чел/час', value: 1247, trend: 12.5 },
    { id: 'buses', title: 'Транспорт', unit: 'ед.', value: 42, trend: -3.2 },
    { id: 'accuracy', title: 'Точность', unit: '%', value: 87.3, trend: 2.1 },
    { id: 'delay', title: 'Задержка', unit: 'мин', value: 4.2, trend: -1.8 }
  ];

  const tools = [
    { icon: '📊', title: 'Генератор отчетов', desc: 'Автоматические отчеты PDF/Excel' },
    { icon: '🎯', title: 'Статистика (диаграммы, графики)', desc: 'Отображение' },
    { icon: '🔍', title: 'Просмотр маршрутов', desc: 'Более быстрый маршрут' },
    { icon: '📈', title: 'Оптимизационное решение', desc: 'Решение оптимизации' },
    { icon: '🔄', title: 'Калибровка модели', desc: 'Обновить коэффициенты' },
    { icon: '💾', title: 'Экспорт данных', desc: 'CSV, JSON, API' }
  ];

  const timeFilters = [
    { label: 'Час', value: 'hour' },
    { label: 'День', value: 'day' },
    { label: 'Неделя', value: 'week' },
    { label: 'Месяц', value: 'month' }
  ];

  return (
    <div className="analytics-page">
      {/* Заголовок и фильтры */}
      <div className="analytics-header">
        <div className="header-left">
          <h1 className="page-title">📊 Аналитический центр</h1>
          <p className="page-subtitle">Прогнозирование и анализ пассажиропотоков в реальном времени</p>
        </div>
        
        <div className="header-right">
          <div className="time-filters">
            {timeFilters.map((filter) => (
              <button 
                key={filter.value}
                className={`time-filter-btn ${filter.value === 'day' ? 'active' : ''}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <button className="export-btn">
            📤 Экспорт данных
          </button>
        </div>
      </div>

      {/* Основная сетка */}
      <div className="analytics-grid">
        {/* Основная карта */}
        <div className="main-card map-container">
          <div className="card-header">
            <h3>🗺️ Карта пассажиропотоков</h3>
            <div className="card-controls">
              <div className="heatmap-toggle">
                <span className="toggle-label">Тепловая карта</span>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={showHeatmap}
                    onChange={(e) => setShowHeatmap(e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
              </div>
              
              <div className="prediction-slider">
                <span className="slider-label">Прогноз: {predictionDepth} ч</span>
                <input 
                  type="range" 
                  min="1" 
                  max="72" 
                  value={predictionDepth}
                  onChange={(e) => setPredictionDepth(parseInt(e.target.value))}
                  className="range-slider"
                />
              </div>
            </div>
          </div>
          
          <div className="card-body map-wrapper">
            <MapComponent />
            {showHeatmap && (
              <div className="heatmap-overlay">
                <div className="heatmap-legend">
                  <div className="legend-title">Интенсивность потока</div>
                  <div className="legend-gradient">
                    <span>Низкая</span>
                    <div className="gradient-bar"></div>
                    <span>Высокая</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Метрики */}
        <div className="metrics-grid">
          {metrics.map((metric) => (
            <div 
              key={metric.id} 
              className={`metric-card ${activeMetric === metric.id ? 'active' : ''}`}
              onClick={() => setActiveMetric(metric.id)}
            >
              <div className="metric-header">
                <h4>{metric.title}</h4>
                <div className={`trend-indicator ${metric.trend >= 0 ? 'positive' : 'negative'}`}>
                  {metric.trend >= 0 ? '↗' : '↘'} {Math.abs(metric.trend)}%
                </div>
              </div>
              <div className="metric-value">
                {metric.value} <span className="metric-unit">{metric.unit}</span>
              </div>
              <div className="metric-progress">
                <div 
                  className="progress-bar" 
                  style={{ width: `${Math.min(100, (metric.value / 1500) * 100)}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        {/* Панель инструментов */}
        <div className="tools-card">
          <div className="card-header">
            <h3>🛠️ Инструменты аналитика</h3>
          </div>
          <div className="card-body tools-grid">
            {tools.map((tool, index) => (
              <button key={index} className="tool-button">
                <span className="tool-icon">{tool.icon}</span>
                <div className="tool-info">
                  <div className="tool-title">{tool.title}</div>
                  <div className="tool-desc">{tool.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="card-footer">
            <Link to="/simulation" className="simulation-button">
              🎮 Запустить обучение модели
            </Link>
          </div>
        </div>

        {/* Графики и статистика */}
        <div className="charts-card">
          <div className="card-header">
            <h3>📈 Динамика пассажиропотока</h3>
            <select className="chart-select">
              <option>По часам</option>
              <option>По дням</option>
              <option>По неделям</option>
            </select>
          </div>
          <div className="card-body">
            <div className="chart-placeholder">
              <div className="chart-grid">
                {Array.from({ length: 24 }).map((_, hour) => (
                  <div key={hour} className="chart-bar-container">
                    <div 
                      className="chart-bar" 
                      style={{ 
                        height: `${30 + Math.sin(hour / 3) * 40 + Math.random() * 20}%` 
                      }}
                    ></div>
                    <div className="chart-label">{hour}:00</div>
                  </div>
                ))}
              </div>
              <div className="chart-legend">
                <div className="legend-item">
                  <div className="legend-color actual"></div>
                  <span>Фактический</span>
                </div>
                <div className="legend-item">
                  <div className="legend-color predicted"></div>
                  <span>Прогноз</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Статус системы */}
        <div className="status-card">
          <div className="card-header">
            <h3>⚙️ Статус системы</h3>
          </div>
          <div className="card-body">
            <div className="status-item">
              <div className="status-header">
                <span className="status-name">Модель прогнозирования</span>
                <span className="status-value success">Активна</span>
              </div>
              <div className="status-progress">
                <div className="progress-bar" style={{ width: '95%' }}></div>
              </div>
            </div>
            
            <div className="status-item">
              <div className="status-header">
                <span className="status-name">Сбор данных с камер</span>
                <span className="status-value warning">42/64 активны</span>
              </div>
              <div className="status-progress">
                <div className="progress-bar" style={{ width: '65%' }}></div>
              </div>
            </div>
            
            <div className="status-item">
              <div className="status-header">
                <span className="status-name">Обновление в реальном времени</span>
                <span className="status-value">Задержка 3.2с</span>
              </div>
              <div className="status-progress">
                <div className="progress-bar" style={{ width: '88%' }}></div>
              </div>
            </div>
            
            <div className="status-item">
              <div className="status-header">
                <span className="status-name">Точность прогнозов</span>
                <span className="status-value success">87.3%</span>
              </div>
              <div className="status-progress">
                <div className="progress-bar" style={{ width: '87%' }}></div>
              </div>
            </div>
          </div>
          <div className="card-footer">
            <button className="settings-button">
              ⚙️ Настройки системы
            </button>
            <button className="refresh-button">
              🔄 Обновить данные
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;