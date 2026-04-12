import React, { useState, useEffect, useRef } from 'react';
import MapComponent from './Map/Map';
import { MapPin, Route, X, Save, Trash2, RefreshCw, Download, AlertCircle, CheckCircle, Bus, Link, Search, Clock, Navigation, Edit2 } from 'lucide-react';
import { useStops } from '../hooks/api/useStops';
import { useRoutes } from '../hooks/api/useRoutes';
import type {
  Stop,
  Route as ApiRoute,
  TransportType,
  RouteCreateRequest,
  RouteStopRequest
} from '../api/types';
import './AnalyticsPage.css';

const AnalyticsPage: React.FC = () => {
  const [creationMode, setCreationMode] = useState<'none' | 'stop' | 'route'>('none');
  const [selectedStopsForRoute, setSelectedStopsForRoute] = useState<
    { id: number; order: number; address: string }[]
  >([]);
  const [newStopData, setNewStopData] = useState({
    address: '',
    url: '',
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

  const [editingRoute, setEditingRoute] = useState<ApiRoute | null>(null);
  const [showEditRouteModal, setShowEditRouteModal] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [showEditStopModal, setShowEditStopModal] = useState(false);

  const [showStopModal, setShowStopModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'info' | 'success' | 'error'>('info');
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [routeSearchQuery, setRouteSearchQuery] = useState('');
  const [stopSearchQuery, setStopSearchQuery] = useState('');
  const [expandedRouteId, setExpandedRouteId] = useState<number | null>(null);

  // ========== Локальное состояние ==========
  const [stops, setStops] = useState<Stop[]>([]);
  const [routes, setRoutes] = useState<ApiRoute[]>([]);

  // ========== REFS (ДОБАВЛЯЕМ ОБЪЯВЛЕНИЕ) ==========
  const stopsListRef = useRef<HTMLDivElement>(null);
  const routesListRef = useRef<HTMLDivElement>(null);

  // ========== ХУКИ ==========
  const { stops: stopsData, isLoading: stopsLoading, createStop, updateStop, deleteStop } = useStops();
  const { routes: routesData, isLoading: routesLoading, createRoute, updateRoute, deleteRoute } = useRoutes();

  // ========== СИНХРОНИЗАЦИЯ ==========
  useEffect(() => {
    if (stopsData) {
      const normalizedStops = stopsData.map((stop: any) => ({
        ...stop,
        id: Number(stop.id),
        address: String(stop.address || '').trim(),
        url: stop.url || ''
      }));
      setStops(normalizedStops);
    }
  }, [stopsData]);

  useEffect(() => {
    if (routesData) {
      setRoutes(routesData);
    }
  }, [routesData]);

  const isLoading = stopsLoading || routesLoading;

  const refreshData = () => {
    window.location.reload();
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
    console.log('Marker clicked:', marker);

    if (creationMode === 'route') {
      const markerId = Number(marker.id);
      if (isNaN(markerId) || markerId === 0) {
        console.error('Invalid marker id:', marker);
        showNotificationFunc('Ошибка: некорректный ID остановки', 'error');
        return;
      }

      const alreadySelected = selectedStopsForRoute.some(
        stop => stop.id === markerId
      );

      if (alreadySelected) {
        showNotificationFunc(`Остановка "${marker.address}" уже добавлена в маршрут`, 'info');
        return;
      }

      const newStop = {
        id: markerId,
        order: selectedStopsForRoute.length + 1,
        address: marker.address
      };

      setSelectedStopsForRoute(prev => [...prev, newStop]);
      showNotificationFunc(`Остановка "${marker.address}" добавлена (${selectedStopsForRoute.length + 1})`, 'info');
      return;
    }

    setEditingStop(marker);
    setShowEditStopModal(true);
  };

  const handleRouteClick = (routeId: number) => {
    setSelectedRouteId(routeId);
  };

  const handleRouteClickOnMap = (route: ApiRoute) => {
    setSelectedRouteId(route.id);
    showNotificationFunc(`Маршрут ${route.number} выбран`, 'info');
  };

  const handleRouteDoubleClick = (routeId: number) => {
    setExpandedRouteId(expandedRouteId === routeId ? null : routeId);
  };

  const handleEditRoute = (route: ApiRoute) => {
    setEditingRoute(route);
    setNewRouteData({
      number: route.number,
      name: route.name || '',
      transportType: route.transportType,
      cityId: route.cityId || 1,
      directionAName: route.directionAName || '',
      directionBName: route.directionBName || '',
      intervalMinutes: route.intervalMinutes || 15,
      operatingHours: route.operatingHours || '06:00-23:00'
    });
    setShowEditRouteModal(true);
  };

  const handleUpdateRouteSubmit = async () => {
    if (!editingRoute) return;

    try {
      if (!newRouteData.number.trim()) {
        showNotificationFunc('Введите номер маршрута', 'error');
        return;
      }

      const requestData = {
        number: newRouteData.number,
        name: newRouteData.name || undefined,
        transportType: newRouteData.transportType,
        directionAName: newRouteData.directionAName || undefined,
        directionBName: newRouteData.directionBName || undefined,
        intervalMinutes: newRouteData.intervalMinutes,
        operatingHours: newRouteData.operatingHours
      };

      console.log('Updating route:', editingRoute.id, requestData);
      await updateRoute(editingRoute.id, requestData);

      setShowEditRouteModal(false);
      setEditingRoute(null);
      showNotificationFunc(`Маршрут "${newRouteData.number}" обновлён!`, 'success');
    } catch (error) {
      console.error('Route update error:', error);
      showNotificationFunc('Ошибка при обновлении маршрута', 'error');
    }
  };

  const handleDeleteRoute = async (routeId: number) => {
    if (!confirm('Удалить этот маршрут? Это действие нельзя отменить.')) return;

    try {
      await deleteRoute(routeId);
      if (selectedRouteId === routeId) setSelectedRouteId(null);
      showNotificationFunc('Маршрут удалён', 'success');
    } catch (error) {
      console.error('Route delete error:', error);
      showNotificationFunc('Ошибка при удалении маршрута', 'error');
    }
  };

  const handleEditStop = (stop: Stop) => {
    setEditingStop(stop);
    setNewStopData({
      address: stop.address,
      url: stop.url || '',
      lat: stop.lat,
      lng: stop.lng,
      count: stop.count || 0,
      velocity: stop.velocity || 0,
      load: stop.load || 0,
      cityId: stop.cityId || 1
    });
    setShowEditStopModal(true);
  };

  const handleUpdateStopSubmit = async () => {
    if (!editingStop) return;

    try {
      if (!newStopData.address.trim()) {
        showNotificationFunc('Введите адрес остановки', 'error');
        return;
      }

      const stopData = {
        address: newStopData.address.trim(),
        url: newStopData.url.trim() || '',
        lat: newStopData.lat,
        lng: newStopData.lng,
        count: newStopData.count,
        velocity: newStopData.velocity,
        load: newStopData.load,
        cityId: newStopData.cityId
      };

      console.log('Updating stop:', editingStop.id, stopData);
      await updateStop(editingStop.id, stopData);

      setShowEditStopModal(false);
      setEditingStop(null);
      showNotificationFunc(`Остановка "${newStopData.address}" обновлена!`, 'success');
    } catch (error) {
      console.error('Stop update error:', error);
      showNotificationFunc('Ошибка при обновлении остановки', 'error');
    }
  };

  const handleDeleteStop = async (stopId: number) => {
    if (!confirm('Удалить эту остановку? Это действие нельзя отменить.')) return;

    try {
      await deleteStop(stopId);
      showNotificationFunc('Остановка удалена', 'success');
    } catch (error) {
      console.error('Stop delete error:', error);
      showNotificationFunc('Ошибка при удалении остановки', 'error');
    }
  };

  const handleCreateStopSubmit = async () => {
    try {
      if (!newStopData.address.trim()) {
        showNotificationFunc('Введите адрес остановки', 'error');
        return;
      }
      if (newStopData.lat === 0 || newStopData.lng === 0) {
        showNotificationFunc('Координаты не установлены', 'error');
        return;
      }

      const stopData = {
        address: newStopData.address.trim(),
        url: newStopData.url.trim() || '',
        lat: newStopData.lat,
        lng: newStopData.lng,
        count: newStopData.count,
        velocity: newStopData.velocity,
        load: newStopData.load,
        cityId: newStopData.cityId
      };

      console.log('Creating stop with data:', stopData);
      await createStop(stopData);

      setShowStopModal(false);
      setNewStopData({
        address: '',
        url: '',
        lat: 0,
        lng: 0,
        count: 0,
        velocity: 0,
        load: 0,
        cityId: 1
      });
      setCreationMode('none');
      showNotificationFunc('Остановка успешно создана!', 'success');
    } catch (error) {
      console.error('Stop creation error:', error);
      showNotificationFunc('Ошибка при создании остановки', 'error');
    }
  };

  const handleCreateRouteSubmit = async () => {
    try {
      if (selectedStopsForRoute.length < 2) {
        showNotificationFunc('Выберите минимум 2 остановки', 'error');
        return;
      }

      if (!newRouteData.number.trim()) {
        showNotificationFunc('Введите номер маршрута', 'error');
        return;
      }

      const sortedStops = [...selectedStopsForRoute].sort((a, b) => a.order - b.order);

      const routeStops: RouteStopRequest[] = sortedStops.map((item, index) => ({
        stopId: item.id,
        order: index + 1,
        direction: 'A',
        travelTimeToNext: index < sortedStops.length - 1 ? 5 : 0
      }));

      const requestData: RouteCreateRequest = {
        number: newRouteData.number,
        name: newRouteData.name || undefined,
        transportType: newRouteData.transportType,
        cityId: newRouteData.cityId,
        directionAName: newRouteData.directionAName || undefined,
        directionBName: newRouteData.directionBName || undefined,
        intervalMinutes: newRouteData.intervalMinutes,
        operatingHours: newRouteData.operatingHours,
        stops: routeStops
      };

      console.log('Sending route data:', requestData);

      const createdRoute = await createRoute(requestData);

      setRoutes(prev => [...prev, createdRoute]);
      setShowRouteModal(false);
      setCreationMode('none');
      setSelectedStopsForRoute([]);
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

      showNotificationFunc(`Маршрут "${newRouteData.number}" создан!`, 'success');
    } catch (error) {
      console.error('Route creation error:', error);
      showNotificationFunc('Ошибка при создании маршрута', 'error');
    }
  };

  const cancelCreationMode = () => {
    setCreationMode('none');
    setSelectedStopsForRoute([]);
    showNotificationFunc('Создание отменено', 'info');
  };

  const moveStopUp = (index: number) => {
    if (index <= 0) return;
    const newStops = [...selectedStopsForRoute];
    [newStops[index], newStops[index - 1]] = [newStops[index - 1], newStops[index]];
    setSelectedStopsForRoute(newStops.map((item, i) => ({ ...item, order: i + 1 })));
  };

  const moveStopDown = (index: number) => {
    if (index >= selectedStopsForRoute.length - 1) return;
    const newStops = [...selectedStopsForRoute];
    [newStops[index], newStops[index + 1]] = [newStops[index + 1], newStops[index]];
    setSelectedStopsForRoute(newStops.map((item, i) => ({ ...item, order: i + 1 })));
  };

  const removeStopFromRoute = (stopId: number) => {
    const newStops = selectedStopsForRoute.filter(item => item.id !== stopId);
    setSelectedStopsForRoute(newStops.map((item, index) => ({ ...item, order: index + 1 })));
  };

  const removeLastStop = () => {
    if (selectedStopsForRoute.length === 0) return;
    setSelectedStopsForRoute(selectedStopsForRoute.slice(0, -1));
  };

  const getMarkerColor = (load: number): string => {
    if (load <= 3) return "#10b981";
    if (load <= 7) return "#f59e0b";
    return "#ef4444";
  };

  const getTransportIcon = (type: TransportType) => {
    switch (type) {
      case 'BUS': return '🚌';
      case 'TROLLEYBUS': return '🚎';
      case 'TRAM': return '🚊';
      case 'MINIBUS': return '🚐';
      case 'METRO': return '🚇';
      case 'TRAIN': return '🚆';
      default: return '🚌';
    }
  };

  const filteredRoutes = routes.filter(route =>
    route.number.toLowerCase().includes(routeSearchQuery.toLowerCase()) ||
    (route.name && route.name.toLowerCase().includes(routeSearchQuery.toLowerCase()))
  );

  const filteredStops = stops.filter(stop =>
    stop.address.toLowerCase().includes(stopSearchQuery.toLowerCase())
  );

  if (isLoading && stops.length === 0 && routes.length === 0) {
    return (
      <div className="analytics-page loading-state">
        <div className="spinner"></div>
        <p>Загрузка данных...</p>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      {showNotification && (
        <div className={`creation-notification ${notificationType}`}>
          {notificationType === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{notificationMessage}</span>
        </div>
      )}

      <div className="analytics-header">
        <div className="header-left">
          <h1 className="page-title">Аналитический центр</h1>
          <p className="page-subtitle">Прогнозирование и анализ пассажиропотоков</p>
        </div>
        <div className="header-right">
          <button className="export-btn">
            <Download size={16} />
            Экспорт данных
          </button>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="main-card map-container">
          <div className="card-header">
            <h3>
              Карта пассажиропотоков
              {creationMode === 'stop' && <span className="creation-badge">Создание остановки</span>}
              {creationMode === 'route' && (
                <span className="creation-badge">
                  Создание маршрута: {selectedStopsForRoute.length} остановок
                </span>
              )}
            </h3>
            <div className="card-controls">
              <button
                className={`mode-btn ${creationMode === 'stop' ? 'active' : ''}`}
                onClick={() => setCreationMode('stop')}
                title="Добавить остановку"
              >
                <MapPin size={16} />
              </button>
              <button
                className={`mode-btn ${creationMode === 'route' ? 'active' : ''}`}
                onClick={() => {
                  setCreationMode('route');
                  setSelectedStopsForRoute([]);
                  showNotificationFunc('Выберите остановки для маршрута по порядку', 'info');
                }}
                title="Создать маршрут"
              >
                <Route size={16} />
              </button>
              {(creationMode === 'stop' || creationMode === 'route') && (
                <div className="mode-controls">
                  {creationMode === 'route' && selectedStopsForRoute.length > 0 && (
                    <button className="mode-btn undo" onClick={removeLastStop} title="Удалить последнюю остановку">
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button className="mode-btn cancel" onClick={cancelCreationMode} title="Отменить создание">
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="card-body map-wrapper">
            <MapComponent
              markers={stops}
              routes={routes}
              selectedRouteId={selectedRouteId}
              onMapClick={handleMapClick}
              onMarkerClick={handleMarkerClick}
              onRouteClick={handleRouteClickOnMap}
              onEditRoute={handleEditRoute}
              onDeleteRoute={handleDeleteRoute}
              onEditStop={handleEditStop}
              onDeleteStop={handleDeleteStop}
              isCreatingStop={creationMode === 'stop'}
              isCreatingRoute={creationMode === 'route'}
              selectedStops={selectedStopsForRoute.map(s => s.id)}
            />
          </div>
        </div>

        <div className="sidebar">
          <div className="stops-card">
            <div className="card-header">
              <h3>Остановки ({stops.length})</h3>
              <div className="card-actions">
                <button className="refresh-btn" onClick={refreshData} title="Обновить">
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
            <div className="search-box">
              <Search size={14} />
              <input
                type="text"
                placeholder="Поиск остановок..."
                value={stopSearchQuery}
                onChange={(e) => setStopSearchQuery(e.target.value)}
              />
              {stopSearchQuery && (
                <button className="clear-search" onClick={() => setStopSearchQuery('')}>✕</button>
              )}
            </div>
            <div className="card-body stops-list" ref={stopsListRef}>
              {filteredStops.length === 0 ? (
                <div className="empty-state">
                  <MapPin size={24} />
                  <p>Остановок не найдено</p>
                </div>
              ) : (
                filteredStops.map((stop) => (
                  <div
                    key={stop.id}
                    className={`stop-item ${selectedStopsForRoute.some(s => s.id === stop.id) ? 'selected' : ''}`}
                    onClick={() => handleEditStop(stop)}
                  >
                    <div className="stop-marker" style={{ backgroundColor: getMarkerColor(stop.load) }}>
                      {stop.load}
                    </div>
                    <div className="stop-info">
                      <div className="stop-address">{stop.address}</div>
                      {stop.url && stop.url.trim() !== '' && (
                        <a
                          href={stop.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="stop-url"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link size={12} />
                          <span>Ссылка</span>
                        </a>
                      )}
                      <div className="stop-stats">
                        <span className="stat">{stop.count} чел</span>
                        <span className="stat">{stop.load}/10</span>
                      </div>
                    </div>
                    <div className="stop-actions">
                      <button
                        className="stop-edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditStop(stop);
                        }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="stop-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStop(stop.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {selectedStopsForRoute.some(s => s.id === stop.id) && (
                      <div className="stop-order">
                        #{selectedStopsForRoute.find(s => s.id === stop.id)?.order}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="routes-card">
            <div className="card-header">
              <h3>Маршруты ({routes.length})</h3>
              <div className="card-actions">
                <button className="refresh-btn" onClick={refreshData} title="Обновить">
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
            <div className="search-box">
              <Search size={14} />
              <input
                type="text"
                placeholder="Поиск по номеру или названию..."
                value={routeSearchQuery}
                onChange={(e) => setRouteSearchQuery(e.target.value)}
              />
              {routeSearchQuery && (
                <button className="clear-search" onClick={() => setRouteSearchQuery('')}>✕</button>
              )}
            </div>
            <div className="card-body routes-list" ref={routesListRef}>
              {filteredRoutes.length === 0 ? (
                <div className="empty-state">
                  <Bus size={24} />
                  <p>Маршрутов не найдено</p>
                </div>
              ) : (
                filteredRoutes.map((route) => (
                  <div
                    key={route.id}
                    className={`route-item ${selectedRouteId === route.id ? 'selected' : ''} ${expandedRouteId === route.id ? 'expanded' : ''}`}
                    onClick={() => handleRouteClick(route.id)}
                    onDoubleClick={() => handleRouteDoubleClick(route.id)}
                  >
                    <div className="route-header">
                      <div className="route-number">
                        <span className="route-icon">{getTransportIcon(route.transportType)}</span>
                        <span className="route-number-text">{route.number}</span>
                      </div>
                      <div className="route-header-actions">
                        <button
                          className="route-edit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditRoute(route);
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="route-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRoute(route.id);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {route.name && (
                      <div className="route-name">{route.name}</div>
                    )}

                    <div className="route-stops-preview">
                      <div className="stops-preview-header">
                        <Navigation size={12} />
                        <span>Остановки: {route.stops.length}</span>
                      </div>
                      <div className="stops-list-mini">
                        {route.stops.slice(0, 3).map((stop, idx) => (
                          <span key={stop.stopId} className="stop-name">
                            {stop.address.split(',')[1]?.trim() || stop.address.substring(0, 30)}
                            {idx < Math.min(route.stops.length, 3) - 1 && ' → '}
                          </span>
                        ))}
                        {route.stops.length > 3 && (
                          <span className="stops-more"> +{route.stops.length - 3}</span>
                        )}
                      </div>
                    </div>

                    {expandedRouteId === route.id && (
                      <div className="route-details-expanded">
                        <div className="details-grid">
                          <div className="detail-item">
                            <Clock size={12} />
                            <span>Интервал: {route.intervalMinutes} мин</span>
                          </div>
                          <div className="detail-item">
                            <span>Время работы: {route.operatingHours || 'Круглосуточно'}</span>
                          </div>
                        </div>
                        {route.directionAName && route.directionBName && (
                          <div className="route-directions">
                            <div className="direction">
                              <span className="direction-label">Направление А:</span>
                              <span>{route.directionAName}</span>
                            </div>
                            <div className="direction">
                              <span className="direction-label">Направление Б:</span>
                              <span>{route.directionBName}</span>
                            </div>
                          </div>
                        )}
                        <div className="stops-full-list">
                          <div className="stops-title">Все остановки:</div>
                          <div className="stops-list-full">
                            {route.stops.map((stop, idx) => (
                              <div key={stop.stopId} className="stop-item-mini">
                                <span className="stop-order-mini">{idx + 1}</span>
                                <span className="stop-name-full">{stop.address}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="route-footer">
                      <div className="route-metrics">
                        <span className="metric">{getTransportIcon(route.transportType)}</span>
                        <span className="metric">
                          <Clock size={12} /> {route.intervalMinutes} мин
                        </span>
                      </div>
                      {selectedRouteId === route.id && (
                        <div className="selected-indicator">
                          <CheckCircle size={14} />
                          <span>Выбран на карте</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {creationMode === 'route' && selectedStopsForRoute.length > 0 && (
          <div className="selected-stops-card">
            <div className="card-header">
              <h3>Маршрут в разработке ({selectedStopsForRoute.length})</h3>
              <button className="close-card" onClick={() => setCreationMode('none')}>
                <X size={16} />
              </button>
            </div>
            <div className="card-body selected-stops-list">
              <div className="route-instructions">
                <AlertCircle size={14} />
                <span>Выберите остановки на карте в нужном порядке</span>
              </div>
              <div className="stops-ordered-list">
                {selectedStopsForRoute.map((item, index) => (
                  <div key={item.id} className="selected-stop-item">
                    <div className="stop-order-badge">#{item.order}</div>
                    <div className="stop-info">
                      <div className="stop-address" title={item.address}>
                        {item.address}
                      </div>
                      <div className="stop-actions">
                        <button
                          className="action-btn"
                          onClick={() => moveStopUp(index)}
                          disabled={index === 0}
                          title="Переместить выше"
                        >
                          ⬆️
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => moveStopDown(index)}
                          disabled={index === selectedStopsForRoute.length - 1}
                          title="Переместить ниже"
                        >
                          ⬇️
                        </button>
                        <button
                          className="action-btn remove"
                          onClick={() => removeStopFromRoute(item.id)}
                          title="Удалить из маршрута"
                        >
                          ❌
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="configure-route-btn"
                onClick={() => {
                  if (selectedStopsForRoute.length >= 2) {
                    setShowRouteModal(true);
                  } else {
                    showNotificationFunc('Добавьте еще остановки', 'error');
                  }
                }}
              >
                Завершить создание маршрута
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Модальные окна - без изменений */}
      {showStopModal && (
        <div className="modal-overlay" onClick={() => setShowStopModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Создание остановки</h3>
              <button className="modal-close" onClick={() => setShowStopModal(false)}>
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
                <label>URL (необязательно)</label>
                <div className="url-input-wrapper">
                  <Link size={16} className="url-icon" />
                  <input
                    type="url"
                    value={newStopData.url}
                    onChange={(e) => setNewStopData(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://example.com/stop/123"
                  />
                </div>
                <small className="field-hint">Оставьте пустым, если не нужен</small>
              </div>
              <div className="form-group">
                <label>Координаты</label>
                <div className="coordinates-inputs">
                  <input
                    type="number"
                    step="0.000001"
                    value={newStopData.lat}
                    onChange={(e) => setNewStopData(prev => ({ ...prev, lat: parseFloat(e.target.value) || 0 }))}
                    placeholder="Широта"
                  />
                  <input
                    type="number"
                    step="0.000001"
                    value={newStopData.lng}
                    onChange={(e) => setNewStopData(prev => ({ ...prev, lng: parseFloat(e.target.value) || 0 }))}
                    placeholder="Долгота"
                  />
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
              <button className="btn-secondary" onClick={() => setShowStopModal(false)}>Отмена</button>
              <button className="btn-primary" onClick={handleCreateStopSubmit} disabled={!newStopData.address.trim()}>
                <Save size={16} /> Создать остановку
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditStopModal && editingStop && (
        <div className="modal-overlay" onClick={() => setShowEditStopModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Редактирование остановки</h3>
              <button className="modal-close" onClick={() => setShowEditStopModal(false)}>
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
                <label>URL (необязательно)</label>
                <div className="url-input-wrapper">
                  <Link size={16} className="url-icon" />
                  <input
                    type="url"
                    value={newStopData.url}
                    onChange={(e) => setNewStopData(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://example.com/stop/123"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Координаты</label>
                <div className="coordinates-inputs">
                  <input
                    type="number"
                    step="0.000001"
                    value={newStopData.lat}
                    onChange={(e) => setNewStopData(prev => ({ ...prev, lat: parseFloat(e.target.value) || 0 }))}
                    placeholder="Широта"
                  />
                  <input
                    type="number"
                    step="0.000001"
                    value={newStopData.lng}
                    onChange={(e) => setNewStopData(prev => ({ ...prev, lng: parseFloat(e.target.value) || 0 }))}
                    placeholder="Долгота"
                  />
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
              <button className="btn-secondary" onClick={() => setShowEditStopModal(false)}>Отмена</button>
              <button className="btn-primary" onClick={handleUpdateStopSubmit}>
                <Save size={16} /> Сохранить изменения
              </button>
            </div>
          </div>
        </div>
      )}

      {showRouteModal && (
        <div className="modal-overlay" onClick={() => setShowRouteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Завершение создания маршрута</h3>
              <button className="modal-close" onClick={() => setShowRouteModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
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
                  <option value="BUS">Автобус</option>
                  <option value="TROLLEYBUS">Троллейбус</option>
                  <option value="TRAM">Трамвай</option>
                  <option value="MINIBUS">Маршрутка</option>
                  <option value="METRO">Метро</option>
                  <option value="TRAIN">Поезд</option>
                </select>
              </div>
              <div className="form-group">
                <label>Название направления А</label>
                <input
                  type="text"
                  value={newRouteData.directionAName}
                  onChange={(e) => setNewRouteData(prev => ({ ...prev, directionAName: e.target.value }))}
                  placeholder="Откуда"
                />
              </div>
              <div className="form-group">
                <label>Название направления Б</label>
                <input
                  type="text"
                  value={newRouteData.directionBName}
                  onChange={(e) => setNewRouteData(prev => ({ ...prev, directionBName: e.target.value }))}
                  placeholder="Куда"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Интервал (мин)</label>
                  <input
                    type="number"
                    min="1"
                    value={newRouteData.intervalMinutes}
                    onChange={(e) => setNewRouteData(prev => ({ ...prev, intervalMinutes: parseInt(e.target.value) || 15 }))}
                  />
                </div>
                <div className="form-group">
                  <label>Время работы</label>
                  <input
                    type="text"
                    value={newRouteData.operatingHours}
                    onChange={(e) => setNewRouteData(prev => ({ ...prev, operatingHours: e.target.value }))}
                    placeholder="06:00-23:00"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowRouteModal(false);
                  setSelectedStopsForRoute([]);
                  setCreationMode('none');
                }}
              >
                <Trash2 size={16} /> Отменить
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateRouteSubmit}
                disabled={!newRouteData.number.trim() || selectedStopsForRoute.length < 2}
              >
                <Save size={16} /> Создать маршрут
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditRouteModal && editingRoute && (
        <div className="modal-overlay" onClick={() => setShowEditRouteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Редактирование маршрута {editingRoute.number}</h3>
              <button className="modal-close" onClick={() => setShowEditRouteModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
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
                  <option value="BUS">Автобус</option>
                  <option value="TROLLEYBUS">Троллейбус</option>
                  <option value="TRAM">Трамвай</option>
                  <option value="MINIBUS">Маршрутка</option>
                  <option value="METRO">Метро</option>
                  <option value="TRAIN">Поезд</option>
                </select>
              </div>
              <div className="form-group">
                <label>Название направления А</label>
                <input
                  type="text"
                  value={newRouteData.directionAName}
                  onChange={(e) => setNewRouteData(prev => ({ ...prev, directionAName: e.target.value }))}
                  placeholder="Откуда"
                />
              </div>
              <div className="form-group">
                <label>Название направления Б</label>
                <input
                  type="text"
                  value={newRouteData.directionBName}
                  onChange={(e) => setNewRouteData(prev => ({ ...prev, directionBName: e.target.value }))}
                  placeholder="Куда"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Интервал (мин)</label>
                  <input
                    type="number"
                    min="1"
                    value={newRouteData.intervalMinutes}
                    onChange={(e) => setNewRouteData(prev => ({ ...prev, intervalMinutes: parseInt(e.target.value) || 15 }))}
                  />
                </div>
                <div className="form-group">
                  <label>Время работы</label>
                  <input
                    type="text"
                    value={newRouteData.operatingHours}
                    onChange={(e) => setNewRouteData(prev => ({ ...prev, operatingHours: e.target.value }))}
                    placeholder="06:00-23:00"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowEditRouteModal(false)}>Отмена</button>
              <button className="btn-primary" onClick={handleUpdateRouteSubmit}>
                <Save size={16} /> Сохранить изменения
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;