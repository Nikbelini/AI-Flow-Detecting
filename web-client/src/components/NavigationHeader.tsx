import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  MapFill, 
  GraphUp, 
  Folder, 
  PlayCircle,
  Gear,
  Bell,
  PersonCircle,
  Clock,
  CloudArrowUp,
  Speedometer2,
  CheckCircle,
  ExclamationTriangle
} from 'react-bootstrap-icons';
import './NavigationHeader.css'; // Создадим отдельный CSS файл

const NavigationHeader: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Определяем активный раздел
  const getActiveKey = () => {
    if (location.pathname === '/map') return 'map';
    if (location.pathname === '/analytics') return 'analytics';
    if (location.pathname === '/scenarios') return 'scenarios';
    if (location.pathname === '/simulation') return 'simulation';
    return 'map';
  };

  const activeKey = getActiveKey();

  // Получаем иконку для раздела
  const getSectionIcon = (section: string) => {
    switch(section) {
      case 'map': return <MapFill />;
      case 'analytics': return <GraphUp />;
      case 'scenarios': return <Folder />;
      case 'simulation': return <PlayCircle />;
      default: return <MapFill />;
    }
  };

  const navItems = [
    { key: 'map', label: 'Карта', color: 'primary', badge: 'LIVE' },
    { key: 'analytics', label: 'Аналитика', color: 'info', badge: 'Новое' },
    { key: 'login', label: 'Логин', color: 'warning' },
    { key: 'simulation', label: 'Симулятор', color: 'danger' }
  ];

  return (
    <div className="navigation-header">
      {/* Основная панель */}
      <div className="main-navbar">
        <div className="nav-container">
          {/* Логотип */}
          <div className="nav-logo">
            <Link to="/" className="logo-link">
              <div className="logo-icon">
                <Speedometer2 className="text-white" size={20} />
                <span className="ai-badge">AI</span>
              </div>
              <div className="logo-text">
                <span className="logo-title">FlowDetect</span>
                <span className="logo-subtitle">Система анализа пассажиропотоков</span>
              </div>
            </Link>
          </div>

          {/* Навигация - ГОРИЗОНТАЛЬНО */}
          <div className="nav-center">
            <div className="nav-items">
              {navItems.map((item) => (
                <Link
                  key={item.key}
                  to={`/${item.key}`}
                  className={`nav-item ${activeKey === item.key ? `nav-item-active bg-${item.color}` : ''}`}
                >
                  <span className="nav-item-icon">{getSectionIcon(item.key)}</span>
                  <span className="nav-item-label">{item.label}</span>
                  {item.badge && (
                    <span className={`nav-badge bg-${item.color}`}>{item.badge}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Правая часть - ГОРИЗОНТАЛЬНО */}
          <div className="nav-right">
            {/* Уведомления */}
            <div className="notification-icon">
              <Bell size={20} />
              <span className="notification-badge">3</span>
            </div>

            {/* Профиль */}
            <div className="profile-dropdown">
              <div className="profile-icon">
                <PersonCircle size={28} className="text-primary" />
              </div>
              <div className="profile-info">
                <div className="profile-name">Пассажир / Водитель</div>
              </div>
            </div>

            {/* Кнопка запуска */}
            <button 
              className="quick-start-btn"
              onClick={() => navigate('/simulation')}
            >
              <PlayCircle /> Быстрый запуск
            </button>
          </div>
        </div>
      </div>

      {/* Вторая строка */}
      <div className="sub-navbar">
        <div className="sub-nav-container">
          <div className="sub-nav-left">
            <span className="current-mode">
              {activeKey === 'map' && '🗺️ Режим мониторинга'}
              {activeKey === 'analytics' && '📊 Аналитический режим'}
              {activeKey === 'scenarios' && '📁 Управление сценариями'}
              {activeKey === 'simulation' && '🎮 Режим симуляции'}
            </span>
            <span className="last-updated">Обновлено: 15:42</span>
          </div>
          
          <div className="sub-nav-right">
            <div className="system-status">
              <CheckCircle className="text-success" />
              <span>Система активна</span>
            </div>
            <div className="system-load">
              <span>Загрузка:</span>
              <div className="load-bar">
                <div className="load-progress" style={{ width: '87%' }}></div>
              </div>
              <span>87%</span>
            </div>
            <span className="version">v2.1.4</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NavigationHeader;