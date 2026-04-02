import React, { useState, useEffect } from 'react';
import MapComponent from './Map/Map';
import {
  MapPin, Route, X, Save, Trash2, RefreshCw, Download,
  ChevronUp, ChevronDown, AlertCircle, CheckCircle, Bus,
  Link, Plus, Search, Eye, EyeOff, Zap
} from 'lucide-react';
import { useStops } from '../hooks/api/useStops';
import { useRoutes } from '../hooks/api/useRoutes';
import type {
  Stop,
  Route as ApiRoute,
  TransportType,
  RouteCreateRequest,
  RouteStopRequest
} from '../api/types';
import { Input, Select, Button, Tag, Tooltip, Badge, Spin, Empty } from 'antd';
import './AnalyticsPage.css';

const { Option } = Select;

const AnalyticsPage: React.FC = () => {
  const [creationMode, setCreationMode] = useState<'none' | 'stop' | 'route'>('none');
  const [selectedStopsForRoute, setSelectedStopsForRoute] = useState<
    { id: number; order: number; address: string }[]
  >([]);
  const [newStopData, setNewStopData] = useState({
    address: '', url: '', lat: 0, lng: 0, count: 0, velocity: 0, load: 1, cityId: 1
  });
  const [newRouteData, setNewRouteData] = useState({
    number: '', name: '', transportType: 'BUS' as TransportType, cityId: 1,
    directionAName: '', directionBName: '', intervalMinutes: 15, operatingHours: '06:00-23:00'
  });
  const [showStopModal, setShowStopModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'info' | 'success' | 'error'>('info');
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLoad, setFilterLoad] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [isStopsCollapsed, setIsStopsCollapsed] = useState(false);
  const [isRoutesCollapsed, setIsRoutesCollapsed] = useState(false);
  const [stopsLimit, setStopsLimit] = useState(6);
  const [routesLimit, setRoutesLimit] = useState(5);

  const { getStops, createStop } = useStops();
  const { getAllRoutes, createRoute } = useRoutes();

  const [stops, setStops] = useState<Stop[]>([]);
  const [routes, setRoutes] = useState<ApiRoute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [stopsData, routesData] = await Promise.all([getStops(), getAllRoutes()]);
      const normalizedStops = stopsData.map((stop: any) => ({
        ...stop, id: Number(stop.id), address: String(stop.address || '').trim(), url: stop.url || ''
      }));
      setStops(normalizedStops);
      setRoutes(routesData);
    } catch (error) {
      showNotificationFunc('Ошибка при загрузке данных', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotificationFunc = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (creationMode === 'stop') {
      setNewStopData(prev => ({ ...prev, lat, lng }));
      setShowStopModal(true);
    }
  };

  const handleMarkerClick = (marker: Stop) => {
    if (creationMode !== 'route') return;
    const markerId = Number(marker.id);
    if (isNaN(markerId) || markerId === 0) {
      showNotificationFunc('Ошибка: некорректный ID остановки', 'error');
      return;
    }
    if (selectedStopsForRoute.some(stop => stop.id === markerId)) {
      showNotificationFunc(`Остановка "${marker.address}" уже в маршруте`, 'info');
      return;
    }
    setSelectedStopsForRoute(prev => [...prev, {
      id: markerId, order: prev.length + 1, address: marker.address
    }]);
    showNotificationFunc(`✓ Добавлено: ${marker.address}`, 'success');
  };

  const handleCreateStopSubmit = async () => {
    try {
      if (!newStopData.address.trim() || !newStopData.lat || !newStopData.lng) {
        showNotificationFunc('Заполните обязательные поля', 'error');
        return;
      }
      await createStop({ ...newStopData, address: newStopData.address.trim(), url: newStopData.url.trim() || '' });
      await loadData();
      setShowStopModal(false);
      setNewStopData({ address: '', url: '', lat: 0, lng: 0, count: 0, velocity: 0, load: 1, cityId: 1 });
      setCreationMode('none');
      showNotificationFunc('🎉 Остановка создана!', 'success');
    } catch (error) {
      showNotificationFunc('Ошибка при создании', 'error');
    }
  };

  const handleCreateRouteSubmit = async () => {
    try {
      if (selectedStopsForRoute.length < 2 || !newRouteData.number.trim()) {
        showNotificationFunc('Выберите ≥2 остановки и укажите номер', 'error');
        return;
      }
      const sortedStops = [...selectedStopsForRoute].sort((a, b) => a.order - b.order);
      const routeStops: RouteStopRequest[] = sortedStops.map((item, index) => ({
        stopId: item.id, order: index + 1, direction: 'A', travelTimeToNext: index < sortedStops.length - 1 ? 5 : 0
      }));
      const requestData: RouteCreateRequest = {
        ...newRouteData, number: newRouteData.number.trim(),
        name: newRouteData.name || undefined,
        directionAName: newRouteData.directionAName || undefined,
        directionBName: newRouteData.directionBName || undefined,
        stops: routeStops
      };
      const createdRoute = await createRoute(requestData);
      setRoutes(prev => [...prev, createdRoute]);
      setShowRouteModal(false);
      setCreationMode('none');
      setSelectedStopsForRoute([]);
      setNewRouteData({ number: '', name: '', transportType: 'BUS', cityId: 1, directionAName: '', directionBName: '', intervalMinutes: 15, operatingHours: '06:00-23:00' });
      showNotificationFunc(`🚌 Маршрут ${newRouteData.number} создан!`, 'success');
    } catch (error) {
      showNotificationFunc('Ошибка при создании маршрута', 'error');
    }
  };

  const filteredStops = stops.filter(stop => {
    const matchesSearch = stop.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLoad = filterLoad === 'all'
      ? true
      : filterLoad === 'low' ? stop.load <= 3
        : filterLoad === 'medium' ? stop.load > 3 && stop.load <= 7
          : stop.load > 7;
    return matchesSearch && matchesLoad;
  });

  const getLoadTag = (load: number) => {
    if (load <= 3) return <Tag color="green">Низкая</Tag>;
    if (load <= 7) return <Tag color="orange">Средняя</Tag>;
    return <Tag color="red">Высокая</Tag>;
  };

  const getTransportIcon = (type: TransportType) => {
    const icons: Record<TransportType, string> = {
      BUS: '🚌', TROLLEYBUS: '🚎', TRAM: '🚊', MINIBUS: '🚐', METRO: '🚇', TRAIN: '🚆'
    };
    return icons[type] || '🚌';
  };

  return (
    <div className="analytics-page">
      {/* 🔔 Уведомления */}
      {showNotification && (
        <div className={`notification-toast ${notificationType} animate-slide-in`}>
          <div className="notification-icon">
            {notificationType === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          </div>
          <span className="notification-message">{notificationMessage}</span>
          <button className="notification-close" onClick={() => setShowNotification(false)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* 📊 Шапка */}
      <header className="page-header">
        <div className="header-brand">
          <div className="brand-logo">📈</div>
          <div>
            <h1 className="page-title">Аналитический центр</h1>
            <p className="page-subtitle">Прогнозирование пассажиропотоков в реальном времени</p>
          </div>
        </div>
        <div className="header-actions">
          <Button
            icon={<RefreshCw size={16} className={loading ? 'spinning' : ''} />}
            onClick={loadData}
            loading={loading}
            size="middle"
          >
            Обновить
          </Button>
          <Button icon={<Download size={16} />} type="primary">
            Экспорт
          </Button>
        </div>
      </header>

      {/* 🎛️ Панель управления */}
      <div className="control-panel">
        <div className="panel-section">
          <span className="panel-label">Режим:</span>
          <div className="mode-buttons">
            <Button
              type={creationMode === 'stop' ? 'primary' : 'default'}
              icon={<MapPin size={16} />}
              onClick={() => setCreationMode(creationMode === 'stop' ? 'none' : 'stop')}
              size="small"
            >
              Остановка
            </Button>
            <Button
              type={creationMode === 'route' ? 'primary' : 'default'}
              icon={<Route size={16} />}
              onClick={() => {
                setCreationMode(creationMode === 'route' ? 'none' : 'route');
                setSelectedStopsForRoute([]);
              }}
              size="small"
            >
              Маршрут
            </Button>
          </div>
        </div>

        <div className="panel-section">
          <span className="panel-label">Фильтры:</span>
          <div className="filter-group">
            <Input
              placeholder="Поиск остановки..."
              prefix={<Search size={14} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              size="small"
              className="search-input"
            />
            <Select
              value={filterLoad}
              onChange={setFilterLoad}
              size="small"
              className="filter-select"
              dropdownMatchSelectWidth={false}
            >
              <Option value="all">Все загрузки</Option>
              <Option value="low">🟢 Низкая</Option>
              <Option value="medium">🟡 Средняя</Option>
              <Option value="high">🔴 Высокая</Option>
            </Select>
          </div>
        </div>

        <div className="panel-section">
          <span className="panel-label">Визуализация:</span>
          <Button
            type={showHeatmap ? 'primary' : 'default'}
            icon={showHeatmap ? <Eye size={16} /> : <EyeOff size={16} />}
            onClick={() => setShowHeatmap(!showHeatmap)}
            size="small"
          >
            Тепловая карта
          </Button>
        </div>

        {creationMode !== 'none' && (
          <div className="panel-section active-mode">
            <Badge count={creationMode === 'route' ? selectedStopsForRoute.length : 0} offset={[-8, 4]}>
              <Tag color={creationMode === 'stop' ? 'blue' : 'purple'} className="mode-tag">
                {creationMode === 'stop' ? '🎯 Разместите остановку на карте' : `🔗 Выбрано: ${selectedStopsForRoute.length}`}
              </Tag>
            </Badge>
            <Button type="link" danger size="small" onClick={() => { setCreationMode('none'); setSelectedStopsForRoute([]); }}>
              <X size={14} /> Отменить
            </Button>
          </div>
        )}
      </div>

      {/* 🗺️ Основная сетка */}
      <div className="main-grid">
        {/* Карта */}
        <div className="map-card">
          <div className="card-header">
            <h3><MapPin size={18} /> Интерактивная карта</h3>
            <div className="card-stats">
              <Badge count={stops.length} showZero className="stat-badge">
                <span className="stat-label">Остановки</span>
              </Badge>
              <Badge count={routes.length} showZero className="stat-badge">
                <span className="stat-label">Маршруты</span>
              </Badge>
            </div>
          </div>
          <div className="card-body map-wrapper">
            {loading ? (
              <div className="map-loading">
                <Spin size="large" tip="Загрузка карты..." />
              </div>
            ) : (
              <MapComponent
                markers={filteredStops}
                routes={routes}
                selectedRouteId={selectedRouteId}
                onMapClick={handleMapClick}
                onMarkerClick={handleMarkerClick}
                isCreatingStop={creationMode === 'stop'}
                isCreatingRoute={creationMode === 'route'}
                selectedStops={selectedStopsForRoute.map(s => s.id)}
              />
            )}
            {showHeatmap && <div className="heatmap-overlay"><Tag color="cyan">🔥 Тепловая карта активна</Tag></div>}
          </div>
        </div>

        {/* Сайдбар */}
        <aside className="sidebar">
          {/* Остановки */}
          {/* Остановки — СВОРАЧИВАЕМЫЙ СПИСОК */}
          <div className="sidebar-card stops-card">
            <div className="card-header">
              <h3><Bus size={18} /> Остановки</h3>
              <div className="card-header-actions">
                <Tooltip title="Обновить">
                  <Button type="text" size="small" icon={<RefreshCw size={14} />} onClick={loadData} />
                </Tooltip>
                {/* ✅ Кнопка сворачивания */}
                <Button
                  type="text"
                  size="small"
                  icon={isStopsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  onClick={() => setIsStopsCollapsed(!isStopsCollapsed)}
                  title={isStopsCollapsed ? 'Развернуть' : 'Свернуть'}
                />
              </div>
            </div>

            {/* ✅ Сворачиваемый контент */}
            {!isStopsCollapsed && (
              <>
                <div className="card-body stops-list">
                  {filteredStops.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет остановок" />
                  ) : (
                    filteredStops.slice(0, stopsLimit).map((stop) => (
                      <div key={stop.id} className={`stop-item ${selectedStopsForRoute.some(s => s.id === stop.id) ? 'selected' : ''}`}>
                        <div className="stop-marker" style={{ backgroundColor: stop.load <= 3 ? '#10b981' : stop.load <= 7 ? '#f59e0b' : '#ef4444' }}>
                          {stop.load}
                        </div>
                        <div className="stop-content">
                          <div className="stop-address" title={stop.address}>{stop.address}</div>
                          <div className="stop-meta">
                            {getLoadTag(stop.load)}
                            <span className="stop-count">{stop.count} чел.</span>
                          </div>
                          {stop.url && (
                            <a href={stop.url} target="_blank" rel="noopener noreferrer" className="stop-link" onClick={(e) => e.stopPropagation()}>
                              <Link size={12} /> Источник
                            </a>
                          )}
                        </div>
                        {selectedStopsForRoute.some(s => s.id === stop.id) && (
                          <div className="stop-order">#{selectedStopsForRoute.find(s => s.id === stop.id)?.order}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* ✅ Кнопка "Показать ещё" */}
                {filteredStops.length > stopsLimit && (
                  <div className="card-footer">
                    <Button
                      type="link"
                      size="small"
                      block
                      onClick={() => setStopsLimit(prev => prev + 6)}
                    >
                      Показать ещё ({filteredStops.length - stopsLimit})
                    </Button>
                  </div>
                )}

                {/* ✅ Кнопка "Свернуть" если показано больше 6 */}
                {stopsLimit > 6 && (
                  <div className="card-footer">
                    <Button
                      type="link"
                      size="small"
                      block
                      onClick={() => setStopsLimit(6)}
                    >
                      Свернуть список
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Маршруты */}
          {/* Маршруты — СВОРАЧИВАЕМЫЙ СПИСОК */}
          <div className="sidebar-card routes-card">
            <div className="card-header">
              <h3><Route size={18} /> Маршруты</h3>
              <div className="card-header-actions">
                {/* ✅ Кнопка сворачивания */}
                <Button
                  type="text"
                  size="small"
                  icon={isRoutesCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  onClick={() => setIsRoutesCollapsed(!isRoutesCollapsed)}
                  title={isRoutesCollapsed ? 'Развернуть' : 'Свернуть'}
                />
              </div>
            </div>

            {/* ✅ Сворачиваемый контент */}
            {!isRoutesCollapsed && (
              <>
                <div className="card-body routes-list">
                  {routes.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Нет маршрутов" />
                  ) : (
                    routes.slice(0, routesLimit).map((route) => (
                      <div key={route.id} className={`route-item ${selectedRouteId === route.id ? 'selected' : ''}`} onClick={() => setSelectedRouteId(route.id)}>
                        <div className="route-badge">
                          <span className="route-icon">{getTransportIcon(route.transportType)}</span>
                          <span className="route-number">{route.number}</span>
                        </div>
                        <div className="route-content">
                          {route.name && <div className="route-name">{route.name}</div>}
                          <div className="route-stops-preview">
                            {route.stops.slice(0, 2).map((stop, idx) => (
                              <span key={stop.stopId}>{stop.address.split(',')[0]}{idx === 0 && route.stops.length > 2 && '...'}</span>
                            ))}
                          </div>
                          <div className="route-meta">
                            <Tag color="blue">{route.intervalMinutes} мин</Tag>
                            <span className="route-hours">{route.operatingHours}</span>
                            {route.isActive && <Tag color="green">Активен</Tag>}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* ✅ Кнопка "Показать ещё" для маршрутов */}
                {routes.length > routesLimit && (
                  <div className="card-footer">
                    <Button
                      type="link"
                      size="small"
                      block
                      onClick={() => setRoutesLimit(prev => prev + 5)}
                    >
                      Показать ещё ({routes.length - routesLimit})
                    </Button>
                  </div>
                )}

                {/* ✅ Кнопка "Свернуть" если показано больше 5 */}
                {routesLimit > 5 && (
                  <div className="card-footer">
                    <Button
                      type="link"
                      size="small"
                      block
                      onClick={() => setRoutesLimit(5)}
                    >
                      Свернуть список
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Панель создания маршрута */}
        {creationMode === 'route' && selectedStopsForRoute.length > 0 && (
          <div className="route-builder-card">
            <div className="card-header">
              <h3><Zap size={18} /> Конструктор маршрута</h3>
              <Badge count={selectedStopsForRoute.length} size="small" />
            </div>
            <div className="card-body route-builder">
              <div className="builder-instructions">
                <AlertCircle size={14} />
                <span>Кликайте по остановкам на карте в нужном порядке</span>
              </div>
              <div className="selected-stops-list">
                {selectedStopsForRoute.map((item, index) => (
                  <div key={item.id} className="builder-stop-item">
                    <div className="stop-order-circle">{item.order}</div>
                    <div className="stop-details">
                      <div className="stop-name" title={item.address}>{item.address}</div>
                      <div className="stop-actions">
                        <Tooltip title="Вверх"><Button size="small" type="text" icon={<ChevronUp size={14} />} disabled={index === 0} onClick={() => { const arr = [...selectedStopsForRoute];[arr[index], arr[index - 1]] = [arr[index - 1], arr[index]]; setSelectedStopsForRoute(arr.map((s, i) => ({ ...s, order: i + 1 }))); }} /></Tooltip>
                        <Tooltip title="Вниз"><Button size="small" type="text" icon={<ChevronDown size={14} />} disabled={index === selectedStopsForRoute.length - 1} onClick={() => { const arr = [...selectedStopsForRoute];[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]; setSelectedStopsForRoute(arr.map((s, i) => ({ ...s, order: i + 1 }))); }} /></Tooltip>
                        <Tooltip title="Удалить"><Button size="small" type="text" danger icon={<X size={14} />} onClick={() => setSelectedStopsForRoute(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 })))} /></Tooltip>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="primary"
                block
                size="large"
                icon={<Plus size={18} />}
                onClick={() => selectedStopsForRoute.length >= 2 && setShowRouteModal(true)}
                disabled={selectedStopsForRoute.length < 2}
                className="complete-route-btn"
              >
                Завершить создание маршрута
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 🪟 Модальное окно: Остановка */}
      {showStopModal && (
        <div className="modal-backdrop" onClick={() => setShowStopModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><MapPin size={20} /> Новая остановка</h3>
              <Button type="text" icon={<X size={18} />} onClick={() => setShowStopModal(false)} />
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Адрес <span className="required">*</span></label>
                  <Input
                    placeholder="ул. Примерная, д. 1"
                    value={newStopData.address}
                    onChange={(e) => setNewStopData(p => ({ ...p, address: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="form-group full">
                  <label>URL источника</label>
                  <Input
                    placeholder="https://..."
                    value={newStopData.url}
                    onChange={(e) => setNewStopData(p => ({ ...p, url: e.target.value }))}
                    prefix={<Link size={14} />}
                  />
                </div>
                <div className="form-group">
                  <label>Широта</label>
                  <Input type="number" step="0.000001" value={newStopData.lat} readOnly suffix="°" />
                </div>
                <div className="form-group">
                  <label>Долгота</label>
                  <Input type="number" step="0.000001" value={newStopData.lng} readOnly suffix="°" />
                </div>
                <div className="form-group">
                  <label>Пассажиров</label>
                  <Input type="number" min="0" value={newStopData.count} onChange={(e) => setNewStopData(p => ({ ...p, count: +e.target.value || 0 }))} />
                </div>
                <div className="form-group">
                  <label>Загрузка</label>
                  <Select value={newStopData.load} onChange={(v) => setNewStopData(p => ({ ...p, load: v }))}>
                    {[...Array(10)].map((_, i) => <Option key={i + 1} value={i + 1}>{i + 1}</Option>)}
                  </Select>
                </div>
              </div>
              <div className="coords-preview">
                <Tag color="blue">📍 {newStopData.lat.toFixed(4)}, {newStopData.lng.toFixed(4)}</Tag>
              </div>
            </div>
            <div className="modal-footer">
              <Button onClick={() => setShowStopModal(false)}>Отмена</Button>
              <Button
                type="primary"
                icon={<Save size={16} />}
                onClick={handleCreateStopSubmit}
                disabled={!newStopData.address.trim() || !newStopData.lat}
              >
                Создать
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 🪟 Модальное окно: Маршрут */}
      {showRouteModal && (
        <div className="modal-backdrop" onClick={() => setShowRouteModal(false)}>
          <div className="modal-container modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Route size={20} /> Настройка маршрута</h3>
              <Button type="text" icon={<X size={18} />} onClick={() => setShowRouteModal(false)} />
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Номер <span className="required">*</span></label>
                  <Input placeholder="105" value={newRouteData.number} onChange={(e) => setNewRouteData(p => ({ ...p, number: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Название</label>
                  <Input placeholder="Центр — Юг" value={newRouteData.name} onChange={(e) => setNewRouteData(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Транспорт</label>
                  <Select value={newRouteData.transportType} onChange={(v) => setNewRouteData(p => ({ ...p, transportType: v }))}>
                    <Option value="BUS">🚌 Автобус</Option>
                    <Option value="TROLLEYBUS">🚎 Троллейбус</Option>
                    <Option value="TRAM">🚊 Трамвай</Option>
                    <Option value="MINIBUS">🚐 Маршрутка</Option>
                    <Option value="METRO">🚇 Метро</Option>
                    <Option value="TRAIN">🚆 Поезд</Option>
                  </Select>
                </div>
                <div className="form-group">
                  <label>Интервал (мин)</label>
                  <Input type="number" min="1" value={newRouteData.intervalMinutes} onChange={(e) => setNewRouteData(p => ({ ...p, intervalMinutes: +e.target.value || 15 }))} />
                </div>
                <div className="form-group full">
                  <label>Направление А → Б</label>
                  <div className="direction-inputs">
                    <Input placeholder="Откуда" value={newRouteData.directionAName} onChange={(e) => setNewRouteData(p => ({ ...p, directionAName: e.target.value }))} />
                    <span className="direction-arrow">→</span>
                    <Input placeholder="Куда" value={newRouteData.directionBName} onChange={(e) => setNewRouteData(p => ({ ...p, directionBName: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group full">
                  <label>Время работы</label>
                  <Input placeholder="06:00–23:00" value={newRouteData.operatingHours} onChange={(e) => setNewRouteData(p => ({ ...p, operatingHours: e.target.value }))} />
                </div>
              </div>

              {/* Превью остановок */}
              <div className="route-preview">
                <h4><Route size={14} /> Остановки ({selectedStopsForRoute.length})</h4>
                <div className="preview-stops">
                  {selectedStopsForRoute.map((s, i) => (
                    <div key={s.id} className="preview-stop">
                      <span className="preview-order">{i + 1}</span>
                      <span className="preview-name" title={s.address}>{s.address}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button danger icon={<Trash2 size={16} />} onClick={() => { setShowRouteModal(false); setCreationMode('none'); setSelectedStopsForRoute([]); }}>
                Отменить
              </Button>
              <Button
                type="primary"
                icon={<Save size={16} />}
                onClick={handleCreateRouteSubmit}
                disabled={!newRouteData.number.trim() || selectedStopsForRoute.length < 2}
              >
                Создать маршрут
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;