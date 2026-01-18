// src/pages/AnalyticsPage.tsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import MapComponent from './Map/Map';
import { 
  Plus, Route, MapPin, X, Filter, Save, Trash2, 
  Layers, Settings, Download, RefreshCw, LineChart,
  Users, Bus, Target, Zap, Maximize2, Minimize2,
  ChevronUp, ChevronDown, Navigation, AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useStops } from '../hooks/api/useStops';
import { useRoutes } from '../hooks/api/useRoutes';
import type { Stop, Route as RouteType, TransportType } from '../api/types';

import './AnalyticsPage.css';

const AnalyticsPage: React.FC = () => {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [predictionDepth, setPredictionDepth] = useState(24);
  const [activeMetric, setActiveMetric] = useState('passenger');
  
  // Состояние для управления созданием
  const [creationMode, setCreationMode] = useState<'none' | 'stop' | 'route'>('none');
  const [selectedStopsForRoute, setSelectedStopsForRoute] = useState<{id: number, order: number, address: string}[]>([]);
  const [tempStopLocation, setTempStopLocation] = useState<{lat: number, lng: number} | null>(null);
  
  const [newStopData, setNewStopData] = useState({
    address: '',
    lat: 0,
    lng: 0,
    count: 0,
    velocity: 0,
    load: 0,
    cityId: 1
  });
  
  const [newRouteData, setNewRouteData] = useState({
    number: '',
    name: '',
    transportType: 'BUS' as TransportType,
    cityId: 1,
    directionAName: '',
    directionBName: '',
    intervalMinutes: 15,
    operatingHours: '06:00-23:00'
  });

  const [showCreationNotification, setShowCreationNotification] = useState(false);
  const [creationNotificationMessage, setCreationNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'info' | 'success' | 'error'>('info');

  // API хуки
  const { 
    loading: stopsLoading, 
    getStops, 
    createStop, 
    updateStopStats 
  } = useStops();
  
  const { 
    loading: routesLoading, 
    getAllRoutes, 
    createRoute, 
    searchRoutes 
  } = useRoutes();

  // Данные
  const [stops, setStops] = useState<Stop[]>([]);
  const [routes, setRoutes] = useState<RouteType[]>([]);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteType | null>(null);

  const metrics = [
    { id: 'passenger', title: 'Пассажиропоток', unit: 'чел/час', value: 1247, trend: 12.5 },
    { id: 'buses', title: 'Транспорт', unit: 'ед.', value: 42, trend: -3.2 },
    { id: 'accuracy', title: 'Точность', unit: '%', value: 87.3, trend: 2.1 },
    { id: 'delay', title: 'Задержка', unit: 'мин', value: 4.2, trend: -1.8 }
  ];

  // Функция для показа уведомлений
  const showNotification = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    console.log(`📢 Уведомление [${type}]:`, message);
    setCreationNotificationMessage(message);
    setNotificationType(type);
    setShowCreationNotification(true);
    
    setTimeout(() => {
      setShowCreationNotification(false);
    }, 3000);
  }, []);

  // Инструменты - ИСПРАВЛЕНО: используется useCallback для action функций
  const tools = useMemo(() => [
    { 
      icon: <MapPin size={20} />, 
      title: 'Создать остановку', 
      desc: 'Добавить новую точку на карте',
      action: () => {
        console.log('🟢 Нажата кнопка "Создать остановку"');
        handleCreateStopClick();
      }
    },
    { 
      icon: <Route size={20} />, 
      title: 'Создать маршрут', 
      desc: 'Объединить остановки в линию',
      action: () => {
        console.log('🟢 Нажата кнопка "Создать маршрут"');
        handleCreateRouteClick();
      }
    },
    { 
      icon: <LineChart size={20} />, 
      title: 'Статистика', 
      desc: 'Диаграммы и графики',
      action: () => {
        console.log('📊 Открытие статистики');
        showNotification('Открытие статистики...', 'info');
      }
    },
    { 
      icon: <Filter size={20} />, 
      title: 'Просмотр маршрутов', 
      desc: 'Анализ существующих линий',
      action: () => {
        console.log('👁️ Просмотр маршрутов');
        showNotification('Просмотр существующих маршрутов', 'info');
      }
    },
    { 
      icon: <Settings size={20} />, 
      title: 'Оптимизация', 
      desc: 'Решение оптимизации',
      action: () => {
        console.log('⚙️ Открытие оптимизации');
        showNotification('Открытие инструментов оптимизации', 'info');
      }
    },
    { 
      icon: <Download size={20} />, 
      title: 'Экспорт данных', 
      desc: 'CSV, JSON, API',
      action: () => {
        console.log('💾 Экспорт данных');
        showNotification('Подготовка к экспорту данных...', 'info');
      }
    }
  ], [showNotification]);

  const timeFilters = [
    { label: 'Час', value: 'hour' },
    { label: 'День', value: 'day' },
    { label: 'Неделя', value: 'week' },
    { label: 'Месяц', value: 'month' }
  ];

  const transportTypes = [
    { value: 'BUS', label: 'Автобус', color: '#3B82F6' },
    { value: 'TROLLEYBUS', label: 'Троллейбус', color: '#10B981' },
    { value: 'TRAM', label: 'Трамвай', color: '#8B5CF6' },
    { value: 'MINIBUS', label: 'Маршрутка', color: '#F59E0B' },
    { value: 'METRO', label: 'Метро', color: '#EF4444' },
    { value: 'TRAIN', label: 'Поезд', color: '#6B7280' }
  ];

  // Мемоизированный список выбранных остановок с информацией
  const selectedStopsWithInfo = useMemo(() => {
    return selectedStopsForRoute.map(item => {
      const stop = stops.find(s => s.id === item.id);
      return stop ? { ...item, stop } : null;
    }).filter(Boolean) as Array<{id: number, order: number, address: string, stop: Stop}>;
  }, [selectedStopsForRoute, stops]);

  // Получить координаты для линии маршрута
  const routeCoordinates = useMemo(() => {
    if (creationMode !== 'route' || selectedStopsWithInfo.length === 0) return [];
    
    return selectedStopsWithInfo
      .sort((a, b) => a.order - b.order)
      .map(item => [item.stop.lng, item.stop.lat] as [number, number]);
  }, [selectedStopsWithInfo, creationMode]);

  // Загрузка данных
  useEffect(() => {
    console.log('🔍 Компонент AnalyticsPage загружен');
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('📥 Загрузка данных...');
      const [stopsData, routesData] = await Promise.all([
        getStops(),
        getAllRoutes()
      ]);
      setStops(stopsData);
      setRoutes(routesData);
      console.log(`✅ Данные загружены: ${stopsData.length} остановок, ${routesData.length} маршрутов`);
    } catch (error) {
      console.error('❌ Ошибка при загрузке данных:', error);
      showNotification('Ошибка при загрузке данных', 'error');
    }
  };

  // Обработчики для создания остановки
  const handleCreateStopClick = () => {
    console.log('🔄 Активируем режим создания остановки');
    setCreationMode('stop');
    setSelectedStopsForRoute([]);
    setSelectedStop(null);
    setTempStopLocation(null);
    
    showNotification('Режим создания остановки активирован. Кликните на карте для выбора местоположения.', 'info');
  };

  const handleMapClick = useCallback((lat: number, lng: number) => {
    console.log('📍 Клик на карте:', lat, lng);
    
    if (creationMode === 'stop') {
      setTempStopLocation({ lat, lng });
      setNewStopData(prev => ({
        ...prev,
        lat,
        lng,
        address: `Новая остановка (${lat.toFixed(4)}, ${lng.toFixed(4)})`
      }));
      
      // Открыть модалку для ввода параметров
      setTimeout(() => {
        const modal = document.getElementById('stop-creation-modal');
        if (modal) {
          modal.classList.add('active');
          console.log('📋 Открыто модальное окно создания остановки');
        }
        showNotification('Местоположение выбрано. Заполните параметры остановки.', 'info');
      }, 100);
    }
  }, [creationMode, showNotification]);

  const handleCreateStopSubmit = async () => {
    try {
      if (!newStopData.address.trim()) {
        showNotification('Введите адрес остановки', 'error');
        return;
      }

      console.log('📤 Отправка запроса на создание остановки:', newStopData);
      const createdStop = await createStop({
        ...newStopData,
        url: `https://example.com/stop/${Date.now()}`
      });
      
      setStops(prev => [...prev, createdStop]);
      setCreationMode('none');
      setTempStopLocation(null);
      setNewStopData({
        address: '',
        lat: 0,
        lng: 0,
        count: 0,
        velocity: 0,
        load: 0,
        cityId: 1
      });
      
      // Закрыть модалку
      const modal = document.getElementById('stop-creation-modal');
      if (modal) {
        modal.classList.remove('active');
        console.log('📋 Закрыто модальное окно создания остановки');
      }
      
      showNotification('✅ Остановка успешно создана!', 'success');
    } catch (error) {
      console.error('❌ Ошибка при создании остановки:', error);
      showNotification('❌ Ошибка при создании остановки', 'error');
    }
  };

  // Обработчики для создания маршрута - ИСПРАВЛЕНО!
  const handleCreateRouteClick = () => {
    console.log('🔄 Активируем режим создания маршрута');
    setCreationMode('route');
    setSelectedStopsForRoute([]);
    setSelectedStop(null);
    setTempStopLocation(null);
    
    showNotification('🚌 Режим создания маршрута активирован. Кликните на остановки, чтобы добавить их в маршрут.', 'info');
  };

  const handleStopSelect = useCallback((marker: Stop) => {
    console.log('🛑 Остановка выбрана для маршрута:', marker.id, marker.address);
    
    if (creationMode === 'route') {
      setSelectedStopsForRoute(prev => {
        // Если остановка уже выбрана, удаляем её
        const existingIndex = prev.findIndex(item => item.id === marker.id);
        
        if (existingIndex >= 0) {
          // Удаляем и перенумеровываем оставшиеся
          const newStops = prev.filter(item => item.id !== marker.id);
          const result = newStops.map((item, index) => ({ 
            ...item, 
            order: index + 1 
          }));
          console.log('➖ Удалена остановка из маршрута. Новый порядок:', result.map(s => s.order));
          return result;
        }
        
        // Добавляем новую остановку в конец
        const newStop = { 
          id: marker.id, 
          order: prev.length + 1,
          address: marker.address 
        };
        const newStops = [...prev, newStop];
        
        console.log('➕ Добавлена остановка в маршрут. Новый порядок:', newStops.map(s => s.order));
        // Показываем уведомление
        showNotification(`📍 Остановка "${marker.address}" добавлена в маршрут. Всего: ${newStops.length} остановок`, 'info');
        
        return newStops;
      });
      
      // Выделяем выбранную остановку
      setSelectedStop(marker);
    }
  }, [creationMode, showNotification]);

  // Функции для изменения порядка остановок
  const moveStopUp = (index: number) => {
    if (index <= 0) return;
    
    setSelectedStopsForRoute(prev => {
      const newStops = [...prev];
      [newStops[index], newStops[index - 1]] = [newStops[index - 1], newStops[index]];
      
      // Обновляем порядок
      const result = newStops.map((item, i) => ({ ...item, order: i + 1 }));
      console.log('⬆️ Изменен порядок остановок:', result.map(s => s.order));
      return result;
    });
  };

  const moveStopDown = (index: number) => {
    if (index >= selectedStopsForRoute.length - 1) return;
    
    setSelectedStopsForRoute(prev => {
      const newStops = [...prev];
      [newStops[index], newStops[index + 1]] = [newStops[index + 1], newStops[index]];
      
      // Обновляем порядок
      const result = newStops.map((item, i) => ({ ...item, order: i + 1 }));
      console.log('⬇️ Изменен порядок остановок:', result.map(s => s.order));
      return result;
    });
  };

  const removeStopFromRoute = (stopId: number) => {
    setSelectedStopsForRoute(prev => {
      const newStops = prev.filter(item => item.id !== stopId);
      const result = newStops.map((item, index) => ({ ...item, order: index + 1 }));
      console.log('🗑️ Удалена остановка из маршрута. Новый порядок:', result.map(s => s.order));
      return result;
    });
    
    showNotification('🗑️ Остановка удалена из маршрута', 'info');
  };

  const handleCreateRouteSubmit = async () => {
    try {
      if (selectedStopsForRoute.length < 2) {
        showNotification('❌ Выберите минимум 2 остановки для маршрута', 'error');
        return;
      }

      if (!newRouteData.number.trim()) {
        showNotification('❌ Введите номер маршрута', 'error');
        return;
      }

      if (!newRouteData.transportType) {
        showNotification('❌ Выберите тип транспорта', 'error');
        return;
      }

      console.log('📤 Отправка запроса на создание маршрута:', {
        ...newRouteData,
        stopsCount: selectedStopsForRoute.length
      });

      // Формируем остановки маршрута в правильном порядке
      const routeStops = selectedStopsForRoute
        .sort((a, b) => a.order - b.order)
        .map((item, index) => ({
          stopId: item.id,
          order: index + 1,
          direction: 'A',
          travelTimeToNext: index < selectedStopsForRoute.length - 1 ? 5 : undefined
        }));

      const createdRoute = await createRoute({
        ...newRouteData,
        stops: routeStops
      });

      console.log('✅ Маршрут создан:', createdRoute);
      
      setRoutes(prev => [...prev, createdRoute]);
      setCreationMode('none');
      setSelectedStopsForRoute([]);
      setSelectedStop(null);
      setNewRouteData({
        number: '',
        name: '',
        transportType: 'BUS',
        cityId: 1,
        directionAName: '',
        directionBName: '',
        intervalMinutes: 15,
        operatingHours: '06:00-23:00'
      });

      // Закрыть модалку
      const modal = document.getElementById('route-creation-modal');
      if (modal) {
        modal.classList.remove('active');
        console.log('📋 Закрыто модальное окно создания маршрута');
      }

      showNotification(`✅ Маршрут "${newRouteData.number}" успешно создан!`, 'success');
    } catch (error) {
      console.error('❌ Ошибка при создании маршрута:', error);
      showNotification('❌ Ошибка при создании маршрута', 'error');
    }
  };

  // Вспомогательные функции
  const getTransportColor = (type: TransportType) => {
    const transport = transportTypes.find(t => t.value === type);
    return transport?.color || '#3B82F6';
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Отмена режима создания
  const cancelCreationMode = () => {
    console.log('❌ Отмена режима создания:', creationMode);
    
    if (creationMode === 'stop') {
      showNotification('❌ Создание остановки отменено', 'info');
    } else if (creationMode === 'route') {
      showNotification('❌ Создание маршрута отменено', 'info');
    }
    
    setCreationMode('none');
    setSelectedStopsForRoute([]);
    setTempStopLocation(null);
  };

  return (
    <div className="analytics-page">
      {/* Уведомление о создании */}
      {showCreationNotification && (
        <div className={`creation-notification ${notificationType}`}>
          {notificationType === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{creationNotificationMessage}</span>
        </div>
      )}

      {/* Заголовок и фильтры */}
      <div className="analytics-header">
        <div className="header-left">
          <h1 className="page-title">
            <LineChart size={28} />
            Аналитический центр
          </h1>
          <p className="page-subtitle">
            Прогнозирование и анализ пассажиропотоков в реальном времени
          </p>
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
            <Download size={16} />
            Экспорт данных
          </button>
        </div>
      </div>

      {/* Основная сетка */}
      <div className="analytics-grid">
        {/* Основная карта */}
        <div className="main-card map-container">
          <div className="card-header">
            <h3>
              <MapPin size={20} />
              Карта пассажиропотоков
              {creationMode === 'stop' && (
                <span className="creation-badge creating">
                  <MapPin size={14} />
                  Создание остановки
                </span>
              )}
              {creationMode === 'route' && (
                <span className="creation-badge creating">
                  <Route size={14} />
                  Создание маршрута: {selectedStopsForRoute.length} остановок
                </span>
              )}
            </h3>
            <div className="card-controls">
              <div className="creation-mode">
                <button 
                  className={`mode-btn ${creationMode === 'stop' ? 'active' : ''}`}
                  onClick={handleCreateStopClick}
                  title="Создать остановку"
                >
                  <MapPin size={16} />
                </button>
                <button 
                  className={`mode-btn ${creationMode === 'route' ? 'active' : ''}`}
                  onClick={handleCreateRouteClick}
                  title="Создать маршрут"
                >
                  <Route size={16} />
                </button>
                {(creationMode === 'stop' || creationMode === 'route') && (
                  <button 
                    className="mode-btn cancel"
                    onClick={cancelCreationMode}
                    title="Отменить создание"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              
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
            <MapComponent 
              markers={stops}
              onMapClick={handleMapClick}
              selectedStop={selectedStop}
              onMarkerClick={(marker) => {
                console.log('🖱️ Клик на маркере в MapComponent:', marker.address);
                handleStopSelect(marker);
              }}
              isCreatingStop={creationMode === 'stop'}
              isCreatingRoute={creationMode === 'route'}
              selectedStops={selectedStopsForRoute.map(s => s.id)}
              tempStopLocation={tempStopLocation}
              routeCoordinates={routeCoordinates}
            />
            
            {/* Инструкции по созданию */}
            {creationMode === 'stop' && (
              <div className="creation-overlay">
                <div className="creation-instructions">
                  <h4><MapPin size={18} /> Создание остановки</h4>
                  <p>Кликните на карте, чтобы выбрать местоположение</p>
                  {tempStopLocation && (
                    <div className="selected-coordinates">
                      <span>Выбрано местоположение:</span>
                      <span className="coordinates">
                        {tempStopLocation.lat.toFixed(4)}, {tempStopLocation.lng.toFixed(4)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {creationMode === 'route' && (
              <div className="creation-overlay">
                <div className="creation-instructions">
                  <h4><Route size={18} /> Создание маршрута</h4>
                  <p>Кликайте на остановки, чтобы добавить их в маршрут</p>
                  <div className="selected-stops-info">
                    <p>Выбрано остановок: <strong>{selectedStopsForRoute.length}</strong></p>
                    {selectedStopsForRoute.length > 0 && (
                      <>
                        <p className="route-order">
                          Порядок: {selectedStopsForRoute.map(s => `#${s.order}`).join(' → ')}
                        </p>
                        <button 
                          className="create-btn"
                          onClick={() => {
                            if (selectedStopsForRoute.length >= 2) {
                              const modal = document.getElementById('route-creation-modal');
                              if (modal) {
                                modal.classList.add('active');
                                console.log('📋 Открыто модальное окно создания маршрута');
                              }
                              showNotification('⚙️ Откройте настройки маршрута для завершения', 'info');
                            } else {
                              showNotification('❌ Выберите минимум 2 остановки для создания маршрута', 'error');
                            }
                          }}
                        >
                          <Settings size={16} />
                          Настроить маршрут
                        </button>
                      </>
                    )}
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
            <h3>
              <Settings size={20} />
              Инструменты аналитика
            </h3>
          </div>
          <div className="card-body tools-grid">
            {tools.map((tool, index) => (
              <button 
                key={index} 
                className="tool-button"
                onClick={tool.action}
                data-testid={`tool-button-${index}`}
              >
                <span className="tool-icon">{tool.icon}</span>
                <div className="tool-info">
                  <div className="tool-title">{tool.title}</div>
                  <div className="tool-desc">{tool.desc}</div>
                </div>
                {creationMode !== 'none' && tool.title.includes('Создать') && (
                  <div className="tool-badge">Активно</div>
                )}
              </button>
            ))}
          </div>
          <div className="card-footer">
            <Link to="/simulation" className="simulation-button">
              <Zap size={16} />
              Запустить обучение модели
            </Link>
          </div>
        </div>

        {/* Список остановок */}
        <div className="stops-card">
          <div className="card-header">
            <h3>
              <Users size={20} />
              Остановки ({stops.length})
              {creationMode === 'route' && (
                <span className="selection-hint">Выбирайте для маршрута</span>
              )}
            </h3>
            <button 
              className="refresh-btn"
              onClick={loadData}
              disabled={stopsLoading || routesLoading}
            >
              <RefreshCw size={16} className={stopsLoading ? 'spinning' : ''} />
            </button>
          </div>
          <div className="card-body stops-list">
            {stops.slice(0, 5).map((stop) => (
              <div 
                key={stop.id} 
                className={`stop-item ${selectedStop?.id === stop.id ? 'selected' : ''} ${selectedStopsForRoute.some(s => s.id === stop.id) ? 'in-route selected' : ''}`}
                onClick={() => {
                  console.log('🖱️ Клик на остановке в списке:', stop.address);
                  if (creationMode === 'route') {
                    handleStopSelect(stop);
                  } else {
                    setSelectedStop(stop);
                  }
                }}
              >
                <div className="stop-marker" style={{ backgroundColor: getMarkerColor(stop.load) }}>
                  {stop.load}
                </div>
                <div className="stop-info">
                  <div className="stop-address">{stop.address}</div>
                  <div className="stop-stats">
                    <span className="stat">{stop.count} чел</span>
                    <span className="stat">{stop.load}/10</span>
                    <span className="stat">{stop.velocity} км/ч</span>
                  </div>
                </div>
                {selectedStopsForRoute.some(s => s.id === stop.id) && (
                  <div className="stop-order">
                    #{selectedStopsForRoute.find(s => s.id === stop.id)?.order}
                  </div>
                )}
              </div>
            ))}
            {stops.length > 5 && (
              <div className="more-stops">
                и еще {stops.length - 5} остановок...
              </div>
            )}
          </div>
        </div>

        {/* Список выбранных остановок для маршрута */}
        {creationMode === 'route' && selectedStopsForRoute.length > 0 && (
          <div className="selected-stops-card">
            <div className="card-header">
              <h3>
                <Navigation size={20} />
                Маршрут в разработке
              </h3>
            </div>
            <div className="card-body selected-stops-list">
              <div className="route-summary">
                <div className="summary-item">
                  <span className="summary-label">Остановок:</span>
                  <span className="summary-value">{selectedStopsForRoute.length}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Порядок:</span>
                  <span className="summary-value">
                    {selectedStopsForRoute.map(s => `#${s.order}`).join(' → ')}
                  </span>
                </div>
              </div>
              
              {selectedStopsWithInfo.map((item, index) => (
                <div key={item.id} className="selected-stop-item">
                  <div className="stop-order-badge">#{item.order}</div>
                  <div className="stop-info">
                    <div className="stop-address">{item.address}</div>
                    <div className="stop-actions">
                      <button 
                        className="action-btn"
                        onClick={() => moveStopUp(index)}
                        disabled={index === 0}
                        title="Поднять выше"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button 
                        className="action-btn"
                        onClick={() => moveStopDown(index)}
                        disabled={index === selectedStopsForRoute.length - 1}
                        title="Опустить ниже"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button 
                        className="action-btn remove"
                        onClick={() => removeStopFromRoute(item.id)}
                        title="Удалить из маршрута"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <button 
                className="configure-route-btn"
                onClick={() => {
                  if (selectedStopsForRoute.length >= 2) {
                    const modal = document.getElementById('route-creation-modal');
                    if (modal) {
                      modal.classList.add('active');
                      console.log('📋 Открыто модальное окно создания маршрута');
                    }
                  } else {
                    showNotification('❌ Добавьте еще остановки', 'error');
                  }
                }}
              >
                <Settings size={16} />
                Завершить создание маршрута
              </button>
            </div>
          </div>
        )}

        {/* Список маршрутов */}
        {creationMode !== 'route' && (
          <div className="routes-card">
            <div className="card-header">
              <h3>
                <Bus size={20} />
                Маршруты ({routes.length})
              </h3>
            </div>
            <div className="card-body routes-list">
              {routes.slice(0, 4).map((route) => (
                <div 
                  key={route.id} 
                  className="route-item"
                  onClick={() => setSelectedRoute(route)}
                >
                  <div 
                    className="route-color" 
                    style={{ backgroundColor: getTransportColor(route.transportType) }}
                  >
                    {route.number}
                  </div>
                  <div className="route-info">
                    <div className="route-name">{route.name || `Маршрут ${route.number}`}</div>
                    <div className="route-details">
                      <span className="route-type">{route.transportType}</span>
                      <span className="route-stops">{route.stops?.length || 0} ост.</span>
                      <span className="route-status">
                        {route.isActive ? 'Активен' : 'Неактивен'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {routes.length > 4 && (
                <div className="more-routes">
                  и еще {routes.length - 4} маршрутов...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Статус системы */}
        <div className="status-card">
          <div className="card-header">
            <h3>
              <Target size={20} />
              Статус системы
            </h3>
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
                <span className="status-name">Сбор данных</span>
                <span className="status-value success">Активен</span>
              </div>
              <div className="status-progress">
                <div className="progress-bar" style={{ width: '100%' }}></div>
              </div>
            </div>
            
            <div className="status-item">
              <div className="status-header">
                <span className="status-name">API сервисы</span>
                <span className="status-value success">Доступны</span>
              </div>
              <div className="status-progress">
                <div className="progress-bar" style={{ width: '100%' }}></div>
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
            <button className="settings-btn" onClick={loadData}>
              <RefreshCw size={14} className={stopsLoading ? 'spinning' : ''} />
              Обновить данные
            </button>
          </div>
        </div>
      </div>

      {/* Модальное окно создания остановки */}
      <div id="stop-creation-modal" className="modal">
        <div className="modal-content">
          <div className="modal-header">
            <h3>
              <MapPin size={20} />
              Создание остановки
            </h3>
            <button 
              className="modal-close"
              onClick={() => {
                const modal = document.getElementById('stop-creation-modal');
                if (modal) modal.classList.remove('active');
                setTempStopLocation(null);
                setCreationMode('none');
              }}
            >
              <X size={20} />
            </button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label>Адрес остановки *</label>
              <input 
                type="text" 
                value={newStopData.address}
                onChange={(e) => setNewStopData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Введите адрес"
                required
              />
            </div>
            <div className="form-group">
              <label>Координаты</label>
              <div className="coordinates-display">
                <span>Широта: {newStopData.lat.toFixed(6)}</span>
                <span>Долгота: {newStopData.lng.toFixed(6)}</span>
              </div>
            </div>
            <div className="stats-grid">
              <div className="form-group">
                <label>Количество людей</label>
                <input 
                  type="number" 
                  min="0"
                  value={newStopData.count}
                  onChange={(e) => setNewStopData(prev => ({ ...prev, count: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="form-group">
                <label>Скорость потока</label>
                <input 
                  type="number" 
                  min="0"
                  value={newStopData.velocity}
                  onChange={(e) => setNewStopData(prev => ({ ...prev, velocity: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="form-group">
                <label>Загрузка (1-10)</label>
                <input 
                  type="number" 
                  min="1"
                  max="10"
                  value={newStopData.load}
                  onChange={(e) => setNewStopData(prev => ({ ...prev, load: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button 
              className="btn-secondary"
              onClick={() => {
                const modal = document.getElementById('stop-creation-modal');
                if (modal) modal.classList.remove('active');
                setTempStopLocation(null);
                setCreationMode('none');
              }}
            >
              Отмена
            </button>
            <button 
              className="btn-primary"
              onClick={handleCreateStopSubmit}
              disabled={!newStopData.address.trim()}
            >
              <Save size={16} />
              Создать остановку
            </button>
          </div>
        </div>
      </div>

      {/* Модальное окно создания маршрута */}
      <div id="route-creation-modal" className="modal">
        <div className="modal-content">
          <div className="modal-header">
            <h3>
              <Route size={20} />
              Завершение создания маршрута
              <span className="stops-count">{selectedStopsForRoute.length} остановок</span>
            </h3>
            <button 
              className="modal-close"
              onClick={() => {
                const modal = document.getElementById('route-creation-modal');
                if (modal) modal.classList.remove('active');
              }}
            >
              <X size={20} />
            </button>
          </div>
          <div className="modal-body">
            {/* Порядок остановок */}
            <div className="selected-stops-section">
              <h4>Порядок следования:</h4>
              <div className="selected-stops-container">
                {selectedStopsWithInfo.map((item, index) => (
                  <div key={item.id} className="selected-stop-item-modal">
                    <div className="stop-order-modal">#{item.order}</div>
                    <div className="stop-info-modal">
                      <div className="stop-address-modal">{item.address}</div>
                      <div className="stop-coordinates-modal">
                        {item.stop.lat.toFixed(4)}, {item.stop.lng.toFixed(4)}
                      </div>
                    </div>
                    <div className="stop-actions-modal">
                      <button 
                        className="action-btn-modal"
                        onClick={() => moveStopUp(index)}
                        disabled={index === 0}
                        title="Поднять выше"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button 
                        className="action-btn-modal"
                        onClick={() => moveStopDown(index)}
                        disabled={index === selectedStopsForRoute.length - 1}
                        title="Опустить ниже"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button 
                        className="action-btn-modal remove"
                        onClick={() => removeStopFromRoute(item.id)}
                        title="Удалить из маршрута"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Параметры маршрута */}
            <div className="form-grid">
              <div className="form-group">
                <label>Номер маршрута *</label>
                <input 
                  type="text" 
                  value={newRouteData.number}
                  onChange={(e) => setNewRouteData(prev => ({ ...prev, number: e.target.value }))}
                  placeholder="105"
                  required
                />
              </div>
              <div className="form-group">
                <label>Название маршрута</label>
                <input 
                  type="text" 
                  value={newRouteData.name}
                  onChange={(e) => setNewRouteData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Центр - Южный район"
                />
              </div>
              <div className="form-group">
                <label>Тип транспорта *</label>
                <select 
                  value={newRouteData.transportType}
                  onChange={(e) => setNewRouteData(prev => ({ ...prev, transportType: e.target.value as TransportType }))}
                  required
                >
                  <option value="">Выберите тип</option>
                  {transportTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Интервал (минуты)</label>
                <input 
                  type="number" 
                  min="1"
                  value={newRouteData.intervalMinutes}
                  onChange={(e) => setNewRouteData(prev => ({ ...prev, intervalMinutes: parseInt(e.target.value) || 15 }))}
                />
              </div>
              <div className="form-group full-width">
                <label>Направление</label>
                <div className="direction-inputs">
                  <input 
                    type="text" 
                    placeholder="Начало маршрута (например: Центральный вокзал)"
                    value={newRouteData.directionAName}
                    onChange={(e) => setNewRouteData(prev => ({ ...prev, directionAName: e.target.value }))}
                  />
                  <span className="direction-arrow">→</span>
                  <input 
                    type="text" 
                    placeholder="Конец маршрута (например: Южный микрорайон)"
                    value={newRouteData.directionBName}
                    onChange={(e) => setNewRouteData(prev => ({ ...prev, directionBName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Часы работы</label>
                <input 
                  type="text" 
                  value={newRouteData.operatingHours}
                  onChange={(e) => setNewRouteData(prev => ({ ...prev, operatingHours: e.target.value }))}
                  placeholder="06:00-23:00"
                />
              </div>
              <div className="form-group">
                <label>Город</label>
                <select 
                  value={newRouteData.cityId}
                  onChange={(e) => setNewRouteData(prev => ({ ...prev, cityId: parseInt(e.target.value) || 1 }))}
                >
                  <option value={1}>Город 1</option>
                  <option value={2}>Город 2</option>
                </select>
              </div>
            </div>
            
            {/* Предварительный просмотр */}
            <div className="route-preview">
              <h4>Предварительный просмотр:</h4>
              <div className="preview-info">
                <div className="preview-route">
                  <span className="preview-number" style={{ backgroundColor: getTransportColor(newRouteData.transportType) }}>
                    {newRouteData.number || 'XXX'}
                  </span>
                  <span className="preview-name">
                    {newRouteData.name || `Маршрут ${newRouteData.number || 'XXX'}`}
                  </span>
                </div>
                <div className="preview-stops">
                  <span className="preview-label">Остановок:</span>
                  <span className="preview-value">{selectedStopsForRoute.length}</span>
                </div>
                <div className="preview-direction">
                  <span className="preview-label">Направление:</span>
                  <span className="preview-value">
                    {newRouteData.directionAName || 'Начало'} → {newRouteData.directionBName || 'Конец'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button 
              className="btn-secondary"
              onClick={() => {
                const modal = document.getElementById('route-creation-modal');
                if (modal) modal.classList.remove('active');
                setSelectedStopsForRoute([]);
                setCreationMode('none');
              }}
            >
              <Trash2 size={16} />
              Отменить
            </button>
            <button 
              className="btn-primary"
              onClick={handleCreateRouteSubmit}
              disabled={!newRouteData.number.trim() || !newRouteData.transportType || selectedStopsForRoute.length < 2}
            >
              <Save size={16} />
              Создать маршрут
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Вспомогательная функция для цвета маркера
const getMarkerColor = (load: number): string => {
  if (load <= 3) return "#10b981";
  if (load <= 7) return "#f59e0b";
  return "#ef4444";
};

export default AnalyticsPage;