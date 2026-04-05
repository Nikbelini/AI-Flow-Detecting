import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapComponent.css';
import ModalContent from './ModalContent';
import { getMarkers } from '../../api/markersApi';
import { Clock, RefreshCw, MapPin, Minimize2, Maximize2, X, ChevronDown, ChevronUp, TrendingUp, Users, Bus, Activity, Layers } from 'lucide-react';
import type { Stop, Route as ApiRoute } from '../../api/types';

interface MapComponentProps {
  markers?: Stop[];
  routes?: ApiRoute[];
  selectedRouteId?: number | null;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (marker: Stop) => void;
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
  isCreatingStop = false,
  isCreatingRoute = false,
  selectedStops = []
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onMapClickRef = useRef(onMapClick);

  const [localMarkers, setLocalMarkers] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(!externalMarkers);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedModalMarker, setSelectedModalMarker] = useState<Stop | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'routes'>('stats');

  const markers = externalMarkers || localMarkers;

  // Подсчёт общей загрузки
  const totalLoad = markers.reduce((sum, m) => sum + (m.load || 0), 0);
  const avgLoad = markers.length > 0 ? (totalLoad / markers.length).toFixed(1) : '0';
  const totalPassengers = markers.reduce((sum, m) => sum + (m.count || 0), 0);
  const peakLoadStops = [...markers].sort((a, b) => (b.load || 0) - (a.load || 0)).slice(0, 3);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
    onMapClickRef.current = onMapClick;
  }, [onMarkerClick, onMapClick]);

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

  // Отрисовка маршрутов
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
          isSelected: route.id === selectedRouteId
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
    } catch (error) {
      console.error('Error adding routes to map:', error);
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
                  {/* Основные метрики */}
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

                  {/* Загрузка остановок (простое распределение) */}
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

                  {/* Топ загруженных остановок */}
                  <div className="top-stops">
                    <div className="section-title">
                      <div className="title-dot red"></div>
                      <span>Наиболее загруженные</span>
                    </div>
                    <div className="top-stops-list">
                      {peakLoadStops.map((stop, idx) => (
                        <div key={stop.id} className="top-stop-item">
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

            {/* Кнопка обновления */}
            <div className="actions-section">
              <button className="action-btn primary" onClick={fetchMarkers} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'spin' : ''} />
                {loading ? 'Обновление...' : 'Обновить данные'}
              </button>
            </div>

            {/* Индикатор режима создания */}
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