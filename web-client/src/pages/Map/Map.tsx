import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapComponent.css';
import ModalContent from './ModalContent';
import { getMarkers } from '../../api/markersApi';
import { Clock, RefreshCw, MapPin, Minimize2, Maximize2, X, ChevronDown, ChevronUp, TrendingUp, Users, Bus, Activity, Layers, Edit2, Trash2, Info } from 'lucide-react';
import type { Stop, Route as ApiRoute } from '../../api/types';

interface MapComponentProps {
  markers?: Stop[];
  routes?: ApiRoute[];
  selectedRouteId?: number | null;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (marker: Stop) => void;
  onRouteClick?: (route: ApiRoute) => void;
  onEditStop?: (stop: Stop) => void;
  onDeleteStop?: (stopId: number) => void;
  onEditRoute?: (route: ApiRoute) => void;
  onDeleteRoute?: (routeId: number) => void;
  isCreatingStop?: boolean;
  isCreatingRoute?: boolean;
  selectedStops?: number[];
}

const MapComponent: React.FC<MapComponentProps> = ({
  markers: externalMarkers,
  routes = [],
  selectedRouteId,
  onMapClick,
  onMarkerClick,
  onRouteClick,
  onEditStop,
  onDeleteStop,
  onEditRoute,
  onDeleteRoute,
  isCreatingStop = false,
  isCreatingRoute = false,
  selectedStops = []
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onMapClickRef = useRef(onMapClick);
  const onRouteClickRef = useRef(onRouteClick);

  const [localMarkers, setLocalMarkers] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(!externalMarkers);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedModalMarker, setSelectedModalMarker] = useState<Stop | null>(null);
  const [selectedRouteTooltip, setSelectedRouteTooltip] = useState<ApiRoute | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'routes'>('stats');
  const [hoveredRouteId, setHoveredRouteId] = useState<number | null>(null);

  const markers = externalMarkers || localMarkers;

  // Подсчёт общей загрузки
  const totalLoad = markers.reduce((sum, m) => sum + (m.load || 0), 0);
  const avgLoad = markers.length > 0 ? (totalLoad / markers.length).toFixed(1) : '0';
  const totalPassengers = markers.reduce((sum, m) => sum + (m.count || 0), 0);
  const peakLoadStops = [...markers].sort((a, b) => (b.load || 0) - (a.load || 0)).slice(0, 3);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
    onMapClickRef.current = onMapClick;
    onRouteClickRef.current = onRouteClick;
  }, [onMarkerClick, onMapClick, onRouteClick]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!externalMarkers) fetchMarkers();
  }, [externalMarkers]);

  const fetchMarkers = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedMarkers = await getMarkers();
      const normalized = fetchedMarkers.map((m: any) => ({ ...m, id: Number(m.id) }));
      setLocalMarkers(normalized);
    } catch (err) {
      console.error('Failed to fetch markers:', err);
      setError('Не удалось загрузить данные остановок');
    } finally {
      setLoading(false);
    }
  };

  // Инициализация карты
  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-raster-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap'
          }
        },
        layers: [{
          id: 'osm-tiles',
          type: 'raster',
          source: 'osm-raster-tiles',
          minzoom: 0,
          maxzoom: 22
        }]
      },
      center: [48.2412, 54.1851],
      zoom: 10,
      maxZoom: 18,
      minZoom: 8
    });

    map.current.addControl(new maplibregl.NavigationControl());
    map.current.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }));

    map.current.on('load', () => {
      console.log('Map loaded');
      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        markersRef.current.forEach(marker => marker.remove());
      }
    };
  }, []);

  // Обработка кликов для создания остановки
  useEffect(() => {
    if (!map.current) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      if (onMapClickRef.current && isCreatingStop) {
        const { lng, lat } = e.lngLat;
        onMapClickRef.current(lat, lng);
      }
    };

    if (isCreatingStop) {
      map.current.on('click', handleClick);
    }

    return () => {
      if (map.current) {
        map.current.off('click', handleClick);
      }
    };
  }, [isCreatingStop]);

  // Отрисовка маршрутов с обработчиками кликов
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    drawRoutes();
  }, [routes, selectedRouteId, mapLoaded]);

  const drawRoutes = () => {
    if (!map.current) return;

    try {
      if (map.current.getLayer('routes-line-selected')) {
        map.current.removeLayer('routes-line-selected');
      }
      if (map.current.getLayer('routes-line')) {
        map.current.removeLayer('routes-line');
      }
      if (map.current.getLayer('routes-hover')) {
        map.current.removeLayer('routes-hover');
      }
      if (map.current.getSource('routes')) {
        map.current.removeSource('routes');
      }
    } catch (error) {
      console.log('Error removing old layers:', error);
    }

    if (routes.length === 0) return;

    const features: any[] = [];

    routes.forEach(route => {
      if (!route.stops || route.stops.length < 2) return;

      const sortedStops = [...route.stops].sort((a, b) => a.orderInRoute - b.orderInRoute);

      const coordinates = sortedStops
        .map(stop => {
          if (!stop.lng || !stop.lat) return null;
          return [stop.lng, stop.lat];
        })
        .filter(coord => coord !== null);

      if (coordinates.length < 2) return;

      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        },
        properties: {
          id: route.id,
          number: route.number,
          name: route.name || '',
          transportType: route.transportType,
          intervalMinutes: route.intervalMinutes,
          stopsCount: route.stops.length,
          isActive: route.isActive,
          isSelected: route.id === selectedRouteId,
          isHovered: route.id === hoveredRouteId
        }
      });
    });

    if (features.length === 0) return;

    try {
      map.current.addSource('routes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: features
        }
      });

      // Слой для невыделенных маршрутов
      map.current.addLayer({
        id: 'routes-line',
        type: 'line',
        source: 'routes',
        filter: ['!=', ['get', 'isSelected'], true],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#94a3b8',
          'line-width': 3,
          'line-opacity': 0.6,
          'line-dasharray': [2, 1]
        }
      });

      // Слой для подсветки при наведении
      map.current.addLayer({
        id: 'routes-hover',
        type: 'line',
        source: 'routes',
        filter: ['==', ['get', 'isHovered'], true],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#f59e0b',
          'line-width': 6,
          'line-opacity': 0.8
        }
      });

      // Слой для выделенного маршрута
      if (selectedRouteId) {
        map.current.addLayer({
          id: 'routes-line-selected',
          type: 'line',
          source: 'routes',
          filter: ['==', ['get', 'isSelected'], true],
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 5,
            'line-opacity': 1
          }
        });

        const selectedFeature = features.find(f => f.properties.id === selectedRouteId);
        if (selectedFeature) {
          const bounds = new maplibregl.LngLatBounds();
          selectedFeature.geometry.coordinates.forEach((coord: [number, number]) => {
            bounds.extend(coord);
          });
          map.current.fitBounds(bounds, { padding: 50, duration: 1000 });
        }
      }

      // Добавляем обработчики событий на маршруты
      setupRouteEventHandlers();

    } catch (error) {
      console.error('Error adding routes to map:', error);
    }
  };

  const setupRouteEventHandlers = () => {
    if (!map.current) return;

    // Обработчик клика по маршруту
    map.current.on('click', 'routes-line', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const routeId = feature.properties?.id;
      const route = routes.find(r => r.id === routeId);

      if (route && onRouteClickRef.current) {
        console.log('Route clicked:', route);
        onRouteClickRef.current(route);
        showRouteTooltip(route, e.lngLat);
      }
    });

    map.current.on('click', 'routes-line-selected', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const routeId = feature.properties?.id;
      const route = routes.find(r => r.id === routeId);

      if (route && onRouteClickRef.current) {
        console.log('Selected route clicked:', route);
        onRouteClickRef.current(route);
        showRouteTooltip(route, e.lngLat);
      }
    });

    // Обработчик наведения для подсветки
    map.current.on('mouseenter', 'routes-line', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const routeId = feature.properties?.id;
      setHoveredRouteId(routeId);
      map.current!.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseenter', 'routes-line-selected', (e) => {
      map.current!.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', 'routes-line', () => {
      setHoveredRouteId(null);
      map.current!.getCanvas().style.cursor = '';
    });

    map.current.on('mouseleave', 'routes-line-selected', () => {
      map.current!.getCanvas().style.cursor = '';
    });

    // Всплывающая подсказка при наведении
    map.current.on('mousemove', 'routes-line', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const routeId = feature.properties?.id;
      const route = routes.find(r => r.id === routeId);

      if (route && e.lngLat) {
        showRouteTooltip(route, e.lngLat);
      }
    });

    map.current.on('mousemove', 'routes-line-selected', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const routeId = feature.properties?.id;
      const route = routes.find(r => r.id === routeId);

      if (route && e.lngLat) {
        showRouteTooltip(route, e.lngLat);
      }
    });
  };

  const showRouteTooltip = (route: ApiRoute, lngLat: maplibregl.LngLat) => {
    if (!map.current) return;

    // Удаляем старый попап
    if ((map.current as any)._routePopup) {
      (map.current as any)._routePopup.remove();
    }

    const transportIcon = getTransportIcon(route.transportType);
    const statusIcon = route.isActive ? '✅' : '⛔';
    const statusText = route.isActive ? 'Активен' : 'Неактивен';

    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      offset: [0, -10],
      className: 'route-popup',
      maxWidth: '300px'
    })
      .setLngLat(lngLat)
      .setHTML(`
    <div class="route-popup-content">
      <div class="route-popup-header">
        <div class="route-popup-icon">${transportIcon}</div>
        <div class="route-popup-info">
          <div class="route-popup-number">${route.number}</div>
        </div>
        <div class="route-popup-status ${route.isActive ? 'active' : 'inactive'}">${statusText}</div>
      </div>
      ${route.name ? `<div class="route-popup-name-row">
        <div class="route-popup-name-icon">📋</div>
        <div class="route-popup-name">${route.name}</div>
      </div>` : ''}
      <div class="route-popup-details">
        <div class="detail-item">
          <span class="detail-icon">⏱️</span>
          <span class="detail-label">Интервал</span>
          <span class="detail-value">${route.intervalMinutes} мин</span>
        </div>
        <div class="detail-item">
          <span class="detail-icon">🚏</span>
          <span class="detail-label">Остановок</span>
          <span class="detail-value">${route.stops.length}</span>
        </div>
        <div class="detail-item">
          <span class="detail-icon">🕐</span>
          <span class="detail-label">Время работы</span>
          <span class="detail-value">${route.operatingHours || '06:00-23:00'}</span>
        </div>
      </div>
      <div class="route-popup-actions">
        <button class="popup-edit-btn" data-route-id="${route.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 3l4 4-7 7H10v-4l7-7z"/>
            <path d="M4 20h16"/>
          </svg>
          <span>Редактировать</span>
        </button>
        <button class="popup-delete-btn" data-route-id="${route.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13"/>
            <path d="M9 4h6"/>
          </svg>
          <span>Удалить</span>
        </button>
      </div>
    </div>
  `)
      .addTo(map.current);


    // Добавляем обработчики для кнопок в попапе
    const popupElement = popup.getElement();
    const editBtn = popupElement.querySelector('.popup-edit-btn');
    const deleteBtn = popupElement.querySelector('.popup-delete-btn');

    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.remove();
        if (onEditRoute) onEditRoute(route);
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.remove();
        if (onDeleteRoute && confirm(`Удалить маршрут ${route.number}?`)) {
          onDeleteRoute(route.id);
        }
      });
    }

    (map.current as any)._routePopup = popup;
  };

  const getTransportIcon = (type: string): string => {
    switch (type) {
      case 'BUS': return '🚌';
      case 'TROLLEYBUS': return '🚎';
      case 'TRAM': return '🚊';
      case 'MINIBUS': return '🚐';
      default: return '🚌';
    }
  };

  // Отрисовка маркеров
  useEffect(() => {
    if (!map.current || loading) return;

    markersRef.current.forEach((markerInstance) => {
      const markerElement = markerInstance.getElement() as HTMLDivElement;
      if (markerElement && (markerElement as any)._clickHandler) {
        markerElement.removeEventListener('click', (markerElement as any)._clickHandler);
      }
      markerInstance.remove();
    });
    markersRef.current = [];

    const markersInstances = markers.map(marker => {
      const markerElement = createCustomMarker(marker);

      const clickHandler = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        console.log('Marker clicked:', marker);

        if (isCreatingRoute && onMarkerClickRef.current) {
          onMarkerClickRef.current(marker);
          return;
        }

        if (!isCreatingRoute && !isCreatingStop) {
          setSelectedModalMarker(marker);
          map.current?.flyTo({
            center: [marker.lng, marker.lat],
            zoom: 15,
            essential: true,
            duration: 800
          });
        }
      };

      markerElement.addEventListener('click', clickHandler);
      (markerElement as any)._clickHandler = clickHandler;

      const markerInstance = new maplibregl.Marker({
        element: markerElement,
        anchor: 'center'
      })
        .setLngLat([marker.lng, marker.lat])
        .addTo(map.current!);
      return markerInstance;
    });

    markersRef.current = markersInstances;
  }, [markers, loading, isCreatingRoute, isCreatingStop, selectedStops]);

  const loadToColor = (load: number): string => {
    if (load <= 3) return "#10b981";
    if (load <= 7) return "#f59e0b";
    return "#ef4444";
  };

  const getMarkerSize = (load: number): number => {
    if (load <= 3) return 32;
    if (load <= 7) return 40;
    return 48;
  };

  const createCustomMarker = (marker: Stop): HTMLDivElement => {
    const el = document.createElement('div');
    el.className = 'custom-marker';

    const isSelected = isCreatingRoute && selectedStops.includes(marker.id);
    const color = loadToColor(marker.load);
    const size = getMarkerSize(marker.load);
    const selectedIndex = isSelected ? selectedStops.indexOf(marker.id) + 1 : 0;

    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.backgroundColor = isSelected ? '#3B82F6' : color;
    el.style.cursor = 'pointer';
    el.style.border = isSelected ? '3px solid #2563EB' : '3px solid white';
    el.style.borderRadius = '50%';
    el.style.boxShadow = isSelected
      ? '0 4px 12px rgba(37, 99, 235, 0.5)'
      : '0 4px 12px rgba(0,0,0,0.3)';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.transition = 'all 0.3s ease';

    const text = document.createElement('div');
    text.className = 'marker-text';
    if (isSelected && selectedIndex > 0) {
      text.textContent = selectedIndex.toString();
    } else {
      text.textContent = marker.load?.toString() || '0';
    }
    text.style.color = 'white';
    text.style.fontWeight = 'bold';
    text.style.fontSize = size > 40 ? '14px' : '12px';
    text.style.textShadow = '0 1px 2px rgba(0,0,0,0.3)';
    el.appendChild(text);

    el.setAttribute('data-address', marker.address || '');
    el.setAttribute('data-load', marker.load?.toString() || '0');
    el.setAttribute('data-id', marker.id?.toString() || '');

    return el;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="map-page">
      <div className={`map-control-panel ${isPanelCollapsed ? 'collapsed' : ''}`}>
        {!isPanelCollapsed ? (
          <>
            <div className="panel-header">
              <div className="header-main">
                <div className="title-section">
                  <div className="title-icon">🗺️</div>
                  <div className="title-text">
                    <h3>Карта пассажиропотоков</h3>
                    <span className="title-sub">в реальном времени</span>
                  </div>
                </div>
                <div className="time-display">
                  <Clock size={14} />
                  <span>{formatTime(currentTime)}</span>
                </div>
              </div>
              <button className="collapse-btn" onClick={() => setIsPanelCollapsed(true)}>
                <Minimize2 size={20} />
              </button>
            </div>

            {/* Табы */}
            <div className="panel-tabs">
              <button
                className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
                onClick={() => setActiveTab('stats')}
              >
                <Activity size={14} />
                Статистика
              </button>
              <button
                className={`tab-btn ${activeTab === 'routes' ? 'active' : ''}`}
                onClick={() => setActiveTab('routes')}
              >
                <Layers size={14} />
                Маршруты
              </button>
            </div>

            {/* Содержимое вкладок */}
            <div className="panel-content">
              {activeTab === 'stats' && (
                <>
                  <div className="stats-section">
                    <div className="stats-grid">
                      <div className="stat-card">
                        <div className="stat-icon blue">
                          <MapPin size={20} />
                        </div>
                        <div className="stat-info">
                          <div className="stat-value">{markers.length}</div>
                          <div className="stat-label">Остановок</div>
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-icon purple">
                          <Bus size={20} />
                        </div>
                        <div className="stat-info">
                          <div className="stat-value">{routes.length}</div>
                          <div className="stat-label">Маршрутов</div>
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-icon green">
                          <Users size={20} />
                        </div>
                        <div className="stat-info">
                          <div className="stat-value">{totalPassengers.toLocaleString()}</div>
                          <div className="stat-label">Пассажиров</div>
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-icon orange">
                          <TrendingUp size={20} />
                        </div>
                        <div className="stat-info">
                          <div className="stat-value">{avgLoad}</div>
                          <div className="stat-label">Ср. загрузка</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="load-distribution">
                    <div className="section-title">
                      <div className="title-dot green"></div>
                      <span>Распределение загрузки</span>
                    </div>
                    <div className="load-bars">
                      <div className="load-bar-item">
                        <span className="load-label">Низкая (0-3)</span>
                        <div className="load-bar-bg">
                          <div
                            className="load-bar-fill green"
                            style={{ width: `${(markers.filter(m => m.load <= 3).length / markers.length) * 100}%` }}
                          />
                        </div>
                        <span className="load-count">{markers.filter(m => m.load <= 3).length}</span>
                      </div>
                      <div className="load-bar-item">
                        <span className="load-label">Средняя (4-7)</span>
                        <div className="load-bar-bg">
                          <div
                            className="load-bar-fill orange"
                            style={{ width: `${(markers.filter(m => m.load > 3 && m.load <= 7).length / markers.length) * 100}%` }}
                          />
                        </div>
                        <span className="load-count">{markers.filter(m => m.load > 3 && m.load <= 7).length}</span>
                      </div>
                      <div className="load-bar-item">
                        <span className="load-label">Высокая (8-10)</span>
                        <div className="load-bar-bg">
                          <div
                            className="load-bar-fill red"
                            style={{ width: `${(markers.filter(m => m.load > 7).length / markers.length) * 100}%` }}
                          />
                        </div>
                        <span className="load-count">{markers.filter(m => m.load > 7).length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="top-stops">
                    <div className="section-title">
                      <div className="title-dot red"></div>
                      <span>Наиболее загруженные</span>
                    </div>
                    <div className="top-stops-list">
                      {peakLoadStops.map((stop, idx) => (
                        <div
                          key={stop.id}
                          className="top-stop-item"
                          onClick={() => {
                            if (onMarkerClick) onMarkerClick(stop);
                          }}
                        >
                          <div className="top-stop-rank">#{idx + 1}</div>
                          <div className="top-stop-address">{stop.address}</div>
                          <div className="top-stop-load">{stop.load}/10</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'routes' && (
                <div className="routes-info">
                  <div className="section-title">
                    <div className="title-dot blue"></div>
                    <span>Маршруты в системе</span>
                  </div>
                  <div className="routes-stats">
                    <div className="route-stat-item">
                      <span className="route-stat-label">Всего маршрутов</span>
                      <span className="route-stat-value">{routes.length}</span>
                    </div>
                    <div className="route-stat-item">
                      <span className="route-stat-label">Активных</span>
                      <span className="route-stat-value active">{routes.filter(r => r.isActive).length}</span>
                    </div>
                    <div className="route-stat-item">
                      <span className="route-stat-label">Средний интервал</span>
                      <span className="route-stat-value">
                        {routes.length > 0
                          ? Math.round(routes.reduce((sum, r) => sum + (r.intervalMinutes || 15), 0) / routes.length)
                          : 0} мин
                      </span>
                    </div>
                  </div>

                  {/* Список маршрутов */}
                  <div className="routes-list-sidebar">
                    {routes.map(route => (
                      <div
                        key={route.id}
                        className={`route-list-item ${selectedRouteId === route.id ? 'selected' : ''}`}
                        onClick={() => onRouteClick?.(route)}
                      >
                        <div className="route-list-header">
                          <span className="route-list-icon">{getTransportIcon(route.transportType)}</span>
                          <span className="route-list-number">{route.number}</span>
                          <span className={`route-list-status ${route.isActive ? 'active' : 'inactive'}`}>
                            {route.isActive ? 'Активен' : 'Неактивен'}
                          </span>
                        </div>
                        {route.name && <div className="route-list-name">{route.name}</div>}
                        <div className="route-list-details">
                          <span>🕐 {route.intervalMinutes} мин</span>
                          <span>🛑 {route.stops.length} ост.</span>
                        </div>
                        <div className="route-list-actions">
                          <button
                            className="route-edit-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditRoute?.(route);
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="route-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Удалить маршрут ${route.number}?`)) {
                                onDeleteRoute?.(route.id);
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedRouteId && (
                    <div className="selected-route-info">
                      <div className="selected-route-header">
                        <span>✅ Выбран на карте</span>
                      </div>
                      <div className="selected-route-detail">
                        Маршрут #{routes.find(r => r.id === selectedRouteId)?.number}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="actions-section">
              <button className="action-btn primary" onClick={fetchMarkers} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'spin' : ''} />
                {loading ? 'Обновление...' : 'Обновить данные'}
              </button>
            </div>

            {(isCreatingStop || isCreatingRoute) && (
              <div className="creation-mode-info">
                <div className="mode-indicator">
                  <div className="mode-dot"></div>
                  {isCreatingStop ? (
                    <span>Режим создания остановки — кликните на карту</span>
                  ) : (
                    <span>Режим создания маршрута — кликайте на остановки</span>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="collapsed-panel">
            <button className="expand-btn" onClick={() => setIsPanelCollapsed(false)}>
              <Maximize2 size={24} />
            </button>
            <div className="collapsed-stats">
              <div className="collapsed-stat">
                <MapPin size={14} />
                <span>{markers.length}</span>
              </div>
              <div className="collapsed-stat">
                <Bus size={14} />
                <span>{routes.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="map-area">
        {loading && (
          <div className="map-loading-overlay">
            <div className="spinner"></div>
            <p>Загрузка данных...</p>
          </div>
        )}

        {error && (
          <div className="map-error-overlay">
            <div className="error-message">⚠️ {error}</div>
            <button className="retry-btn" onClick={fetchMarkers}>Повторить</button>
          </div>
        )}

        <div
          ref={mapContainer}
          className="map-container"
          style={{
            cursor: isCreatingStop ? 'crosshair' : isCreatingRoute ? 'pointer' : 'grab'
          }}
        />
      </div>

      {selectedModalMarker && !isCreatingRoute && !isCreatingStop && (
        <ModalContent
          marker={selectedModalMarker}
          isOpen={!!selectedModalMarker}
          onClose={() => setSelectedModalMarker(null)}
        />
      )}
    </div>
  );
};

export default MapComponent;