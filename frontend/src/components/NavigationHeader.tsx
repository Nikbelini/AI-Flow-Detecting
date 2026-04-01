import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  MapFill, GraphUp, Bell, PersonCircle,
  Speedometer2, 
  ChevronDown, BoxArrowRight, PersonGear 
} from 'react-bootstrap-icons';
import './NavigationHeader.css';

const NavigationHeader: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getActiveKey = () => {
    if (location.pathname === '/map') return 'map';
    if (location.pathname === '/analytics') return 'analytics';
    return 'map';
  };

  const activeKey = getActiveKey();

  const navItems = [
    { key: 'map', label: 'Карта', color: 'primary' },
    { key: 'analytics', label: 'Аналитика', color: 'info' }
  ];

  const getSectionIcon = (section: string) => {
    switch(section) {
      case 'map': return <MapFill />;
      case 'analytics': return <GraphUp />;
      default: return <MapFill />;
    }
  };

  const handleLogout = async () => {
    setIsProfileOpen(false);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
      navigate('/login', { replace: true });
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .filter(part => part)
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="navigation-header">
      <div className="main-navbar">
        <div className="nav-container">
          {/* Логотип */}
          <div className="nav-logo">
            <Link to="/" className="logo-link">
              <div className="logo-icon">
                <Speedometer2 className="text-white" size={20} />
              </div>
              <div className="logo-text">
                <span className="logo-title">FlowDetect</span>
              </div>
            </Link>
          </div>

          {/* Навигация — только Карта и Аналитика */}
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
                </Link>
              ))}
            </div>
          </div>

          {/* Правая часть */}
          <div className="nav-right">
            {/* Уведомления */}
            <div className="notification-icon">
              <Bell size={20} />
              <span className="notification-badge">3</span>
            </div>

            {/* Профиль / Кнопка входа */}
            <div className="profile-section" ref={profileRef}>
              {user ? (
                <>
                  <button 
                    className="profile-trigger"
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    aria-expanded={isProfileOpen}
                    aria-haspopup="true"
                  >
                    <div className="profile-avatar">
                      {getInitials(user.fullName || user.email)}
                    </div>
                    <div className="profile-info">
                      <span className="profile-name">{user.fullName || user.email}</span>
                      {user.role && <span className="profile-role">{user.role}</span>}
                    </div>
                    <ChevronDown className={`profile-arrow ${isProfileOpen ? 'rotated' : ''}`} size={16} />
                  </button>

                  {isProfileOpen && (
                    <div className="profile-dropdown-menu">
                      <div className="dropdown-header">
                        <div className="dropdown-avatar">
                          {getInitials(user.fullName || user.email)}
                        </div>
                        <div>
                          <div className="dropdown-name">{user.fullName || user.email}</div>
                          <div className="dropdown-email">{user.email}</div>
                        </div>
                      </div>
                      
                      <div className="dropdown-divider" />
                      
                      <button 
                        className="dropdown-item"
                        onClick={() => {
                          setIsProfileOpen(false);
                          navigate('/profile');
                        }}
                      >
                        <PersonGear className="dropdown-icon" />
                        <span>Мой профиль</span>
                      </button>
                      
                      <button 
                        className="dropdown-item dropdown-item-danger"
                        onClick={handleLogout}
                      >
                        <BoxArrowRight className="dropdown-icon" />
                        <span>Выйти</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <Link to="/login" className="login-button-header">
                  <PersonCircle size={20} />
                  <span>Войти</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Вторая строка — упрощённая */}
      <div className="sub-navbar">
        <div className="sub-nav-container">
          <div className="sub-nav-left">
            <span className="current-mode">
              {activeKey === 'map' && 'Режим мониторинга'}
              {activeKey === 'analytics' && 'Аналитический режим'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NavigationHeader;