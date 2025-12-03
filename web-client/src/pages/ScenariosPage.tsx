// src/pages/ScenariosPage.tsx
import React, { useState } from 'react';
import './ScenariosPage.css';

interface Scenario {
  id: number;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'draft' | 'planned';
  created: string;
  changes: number;
  impact: 'critical' | 'high' | 'medium' | 'low';
  results: {
    waitTime: number;
    utilization: number;
    cost: number;
    satisfaction: number;
  };
}

const ScenariosPage: React.FC = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([
    {
      id: 1,
      name: 'Открытие ТЦ "Северный"',
      description: 'Добавление 3 новых остановок возле торгового центра',
      status: 'active',
      created: '15.01.2024',
      changes: 3,
      impact: 'high',
      results: { waitTime: -12, utilization: +8, cost: +15, satisfaction: +25 }
    },
    {
      id: 2,
      name: 'Ремонт моста на Ленинском',
      description: 'Временное закрытие 2 остановок на 2 недели',
      status: 'completed',
      created: '10.01.2024',
      changes: 2,
      impact: 'critical',
      results: { waitTime: +47, utilization: -5, cost: +8, satisfaction: -35 }
    },
    {
      id: 3,
      name: 'Увеличение парка на 20%',
      description: 'Добавление 15 новых автобусов на маршруты',
      status: 'draft',
      created: '05.01.2024',
      changes: 5,
      impact: 'medium',
      results: { waitTime: -18, utilization: +15, cost: +42, satisfaction: +18 }
    },
    {
      id: 4,
      name: 'Новый маршрут №45',
      description: 'Соединение спального района с центром',
      status: 'planned',
      created: '20.12.2023',
      changes: 8,
      impact: 'high',
      results: { waitTime: -22, utilization: +12, cost: +28, satisfaction: +32 }
    },
    {
      id: 5,
      name: 'Ночные маршруты',
      description: 'Запуск 5 ночных маршрутов с 23:00 до 6:00',
      status: 'active',
      created: '18.01.2024',
      changes: 5,
      impact: 'medium',
      results: { waitTime: -8, utilization: +6, cost: +22, satisfaction: +15 }
    },
    {
      id: 6,
      name: 'Электробусы на маршрут 101',
      description: 'Замена 10 дизельных автобусов на электробусы',
      status: 'draft',
      created: '12.01.2024',
      changes: 10,
      impact: 'high',
      results: { waitTime: -5, utilization: +3, cost: +65, satisfaction: +42 }
    }
  ]);

  const [filter, setFilter] = useState('all');
  const [selectedScenarios, setSelectedScenarios] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const getStatusConfig = (status: Scenario['status']) => {
    const configs = {
      active: { label: 'Активный', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', icon: '▶️' },
      completed: { label: 'Завершен', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', icon: '✅' },
      draft: { label: 'Черновик', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: '📝' },
      planned: { label: 'Запланирован', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', icon: '📅' }
    };
    return configs[status];
  };

  const getImpactConfig = (impact: Scenario['impact']) => {
    const configs = {
      critical: { label: 'Критическое', color: '#ef4444', icon: '⚠️' },
      high: { label: 'Высокое', color: '#f97316', icon: '🔥' },
      medium: { label: 'Среднее', color: '#eab308', icon: '⚡' },
      low: { label: 'Низкое', color: '#6b7280', icon: '💡' }
    };
    return configs[impact];
  };

  const toggleScenarioSelection = (id: number) => {
    setSelectedScenarios(prev => 
      prev.includes(id) 
        ? prev.filter(scenarioId => scenarioId !== id)
        : [...prev, id]
    );
  };

  const filteredScenarios = scenarios.filter(scenario => {
    const matchesFilter = filter === 'all' || scenario.status === filter;
    const matchesSearch = scenario.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         scenario.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const statistics = {
    total: scenarios.length,
    active: scenarios.filter(s => s.status === 'active').length,
    completed: scenarios.filter(s => s.status === 'completed').length,
    draft: scenarios.filter(s => s.status === 'draft').length,
    planned: scenarios.filter(s => s.status === 'planned').length
  };

  return (
    <div className="scenarios-page">
      {/* Заголовок и управление */}
      <div className="scenarios-header">
        <div className="header-left">
          <h1 className="page-title">📁 Библиотека сценариев</h1>
          <p className="page-subtitle">Создание, управление и сравнение сценариев изменений транспортной сети</p>
        </div>
        
        <div className="header-right">
          <div className="search-box">
            <input
              type="text"
              placeholder="Поиск сценариев..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <span className="search-icon">🔍</span>
          </div>
          
          <button className="new-scenario-btn">
            <span className="btn-icon">+</span> Новый сценарий
          </button>
        </div>
      </div>

      {/* Основная сетка */}
      <div className="scenarios-grid">
        {/* Основная таблица сценариев */}
        <div className="scenarios-table-container">
          <div className="table-header">
            <div className="table-filters">
              <div className="filter-buttons">
                <button 
                  className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                  onClick={() => setFilter('all')}
                >
                  Все ({scenarios.length})
                </button>
                <button 
                  className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
                  onClick={() => setFilter('active')}
                >
                  Активные ({statistics.active})
                </button>
                <button 
                  className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                  onClick={() => setFilter('completed')}
                >
                  Завершенные ({statistics.completed})
                </button>
                <button 
                  className={`filter-btn ${filter === 'draft' ? 'active' : ''}`}
                  onClick={() => setFilter('draft')}
                >
                  Черновики ({statistics.draft})
                </button>
              </div>
              
              {selectedScenarios.length > 0 && (
                <div className="selection-actions">
                  <span className="selection-count">Выбрано: {selectedScenarios.length}</span>
                  <button className="compare-btn">
                    ⚖️ Сравнить ({selectedScenarios.length})
                  </button>
                  <button className="action-btn">
                    🗑️ Удалить
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="scenarios-table">
            {filteredScenarios.map(scenario => {
              const statusConfig = getStatusConfig(scenario.status);
              const impactConfig = getImpactConfig(scenario.impact);
              
              return (
                <div 
                  key={scenario.id} 
                  className={`scenario-card ${selectedScenarios.includes(scenario.id) ? 'selected' : ''}`}
                  onClick={() => toggleScenarioSelection(scenario.id)}
                >
                  <div className="scenario-select">
                    <div className={`select-checkbox ${selectedScenarios.includes(scenario.id) ? 'checked' : ''}`}>
                      {selectedScenarios.includes(scenario.id) && '✓'}
                    </div>
                  </div>
                  
                  <div className="scenario-main">
                    <div className="scenario-header">
                      <h3 className="scenario-name">{scenario.name}</h3>
                      <div className="scenario-meta">
                        <span className="scenario-date">📅 {scenario.created}</span>
                        <span className="scenario-changes">🔄 {scenario.changes} изменений</span>
                      </div>
                    </div>
                    
                    <p className="scenario-description">{scenario.description}</p>
                    
                    <div className="scenario-results">
                      <div className="result-grid">
                        <div className="result-item">
                          <div className="result-label">Ожидание</div>
                          <div className={`result-value ${scenario.results.waitTime > 0 ? 'negative' : 'positive'}`}>
                            {scenario.results.waitTime > 0 ? '+' : ''}{scenario.results.waitTime}%
                          </div>
                        </div>
                        <div className="result-item">
                          <div className="result-label">Загрузка</div>
                          <div className={`result-value ${scenario.results.utilization > 0 ? 'positive' : 'negative'}`}>
                            {scenario.results.utilization > 0 ? '+' : ''}{scenario.results.utilization}%
                          </div>
                        </div>
                        <div className="result-item">
                          <div className="result-label">Стоимость</div>
                          <div className={`result-value ${scenario.results.cost > 0 ? 'negative' : 'positive'}`}>
                            {scenario.results.cost > 0 ? '+' : ''}{scenario.results.cost}%
                          </div>
                        </div>
                        <div className="result-item">
                          <div className="result-label">Удовлетворение</div>
                          <div className={`result-value ${scenario.results.satisfaction > 0 ? 'positive' : 'negative'}`}>
                            {scenario.results.satisfaction > 0 ? '+' : ''}{scenario.results.satisfaction}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="scenario-side">
                    <div 
                      className="scenario-status"
                      style={{ 
                        backgroundColor: statusConfig.bg,
                        color: statusConfig.color
                      }}
                    >
                      <span className="status-icon">{statusConfig.icon}</span>
                      <span className="status-label">{statusConfig.label}</span>
                    </div>
                    
                    <div 
                      className="scenario-impact"
                      style={{ color: impactConfig.color }}
                    >
                      <span className="impact-icon">{impactConfig.icon}</span>
                      <span className="impact-label">{impactConfig.label}</span>
                    </div>
                    
                    <div className="scenario-actions">
                      <button className="action-btn" onClick={(e) => {
                        e.stopPropagation();
                        // Открыть сценарий
                      }}>
                        ▶ Открыть
                      </button>
                      <button className="action-btn" onClick={(e) => {
                        e.stopPropagation();
                        // Копировать сценарий
                      }}>
                        📋 Копировать
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Боковая панель */}
        <div className="scenarios-sidebar">
          {/* Статистика */}
          <div className="sidebar-card statistics-card">
            <h3>📈 Статистика</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{statistics.total}</div>
                <div className="stat-label">Всего сценариев</div>
              </div>
              <div className="stat-item">
                <div className="stat-value" style={{ color: '#10b981' }}>{statistics.active}</div>
                <div className="stat-label">Активных</div>
              </div>
              <div className="stat-item">
                <div className="stat-value" style={{ color: '#3b82f6' }}>{statistics.completed}</div>
                <div className="stat-label">Завершенных</div>
              </div>
              <div className="stat-item">
                <div className="stat-value" style={{ color: '#f59e0b' }}>{statistics.draft}</div>
                <div className="stat-label">Черновиков</div>
              </div>
            </div>
          </div>

          {/* Шаблоны */}
          <div className="sidebar-card templates-card">
            <h3>🎯 Шаблоны сценариев</h3>
            <div className="templates-list">
              {[
                { name: 'Сезонные изменения', icon: '🍂', color: '#f59e0b', count: 4 },
                { name: 'Дорожные работы', icon: '🚧', color: '#ef4444', count: 7 },
                { name: 'Массовые мероприятия', icon: '🎪', color: '#8b5cf6', count: 3 },
                { name: 'Оптимизация маршрутов', icon: '🔄', color: '#10b981', count: 6 },
                { name: 'Новая инфраструктура', icon: '🏗️', color: '#3b82f6', count: 5 },
                { name: 'Изменения расписания', icon: '⏰', color: '#ec4899', count: 8 }
              ].map((template, idx) => (
                <div key={idx} className="template-item">
                  <div className="template-icon" style={{ backgroundColor: template.color + '20' }}>
                    <span style={{ color: template.color }}>{template.icon}</span>
                  </div>
                  <div className="template-info">
                    <div className="template-name">{template.name}</div>
                    <div className="template-count">{template.count} сценариев</div>
                  </div>
                  <button className="use-template-btn">Использовать</button>
                </div>
              ))}
            </div>
          </div>

          {/* Быстрые действия */}
          <div className="sidebar-card actions-card">
            <h3>⚡ Быстрые действия</h3>
            <div className="quick-actions">
              <button className="quick-action-btn">
                📥 Импорт сценария
              </button>
              <button className="quick-action-btn">
                📤 Экспорт выбранных
              </button>
              <button className="quick-action-btn">
                🏷️ Добавить теги
              </button>
              <button className="quick-action-btn">
                📊 Создать отчет
              </button>
            </div>
            
            <div className="comparison-section">
              <h4>Сравнение сценариев</h4>
              <p className="comparison-hint">
                Выберите 2-3 сценария для сравнения их влияния на систему
              </p>
              <button 
                className="compare-scenarios-btn"
                disabled={selectedScenarios.length < 2}
              >
                ⚖️ Сравнить выбранные ({selectedScenarios.length})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScenariosPage;