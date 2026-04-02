import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapComponent.css';
import ModalContent from './ModalContent';
import { getMarkers } from '../../api/endpoints/markersApi';
import { Clock, RefreshCw, MapPin, Minimize2, Maximize2, X, Building2, Loader2 } from 'lucide-react';
import type { Stop, Route as ApiRoute } from '../../api/types';
import { Select, Spin, Badge, Tooltip } from 'antd';
import type { SelectProps } from 'antd/es/select';
import { formatCoordsHuman } from '../../utils/geo';
import { useCities } from '../../hooks/api/useCities';

const { Option } = Select;

const isValidCoordinate = (lat: number, lng: number): boolean => {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
};

const toMapLibre = (lat: number, lng: number): [number, number] => [lng, lat];

interface MapComponentProps {
  markers?: Stop[];
  routes?: ApiRoute[];
  selectedRouteId?: number | null;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (marker: Stop) => void;
  isCreatingStop?: boolean;
  isCreatingRoute?: boolean;
  selectedStops?: number[];
  defaultCityId?: number;
}

const MapComponent: React.FC<MapComponentProps> = ({
  markers: externalMarkers,
  routes = [],
  selectedRouteId,
  onMapClick,
  onMarkerClick,
  isCreatingStop = false,
  isCreatingRoute = false,
  selectedStops = [],
  defaultCityId,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<Stop['id'], { marker: maplibregl.Marker; element: HTMLDivElement }>>(new Map());
  const onMarkerClickRef = useRef(onMarkerClick);
  const onMapClickRef = useRef(onMapClick);

  const { cities, loading: citiesLoading, selectedCityId, selectedCity, selectCity, error: citiesError } = useCities();

  const [localMarkers, setLocalMarkers] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(!externalMarkers);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedModalMarker, setSelectedModalMarker] = useState<Stop | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapInitializing, setMapInitializing] = useState(true);

  const markers = useMemo(() => {
    const sourceMarkers = externalMarkers || localMarkers;
    if (!selectedCityId) return sourceMarkers;
    return sourceMarkers.filter(m => m.cityId === selectedCityId || !m.cityId);
  }, [externalMarkers, localMarkers, selectedCityId]);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
    onMapClickRef.current = onMapClick;
  }, [onMarkerClick, onMapClick]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!externalMarkers && selectedCityId) {
      fetchMarkers(selectedCityId);
    }
  }, [externalMarkers, selectedCityId]);

  // 🗺️ Инициализация карты — ИСПРАВЛЕНО
  useEffect(() => {
    if (!mapContainer.current || !selectedCity) return;

    if (map.current) {
      map.current.flyTo({ 
        center: toMapLibre(selectedCity.lat, selectedCity.lng), 
        zoom: 11, 
        duration: 1500 
      });
      return;
    }

    setMapInitializing(true);

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
            attribution: '© OpenStreetMap contributors'
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
      center: toMapLibre(selectedCity.lat, selectedCity.lng),
      zoom: 11,
      maxZoom: 18,
      minZoom: 9,
      pitch: 0,
      bearing: 0,
      fadeDuration: 0,
      localIdeographFontFamily: false,
    });

    // ✅ КРИТИЧНО: resize после инициализации
    const initTimeout = setTimeout(() => {
      if (map.current) {
        map.current.resize();
        map.current.triggerRepaint();
      }
    }, 150);

    map.current.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');
    map.current.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');
    map.current.addControl(new maplibregl.GeolocateControl({ 
      positionOptions: { enableHighAccuracy: true }, 
      trackUserLocation: true 
    }), 'top-right');

    map.current.on('load', () => { 
      setMapLoaded(true); 
      setMapInitializing(false);
      // Ещё один resize после полной загрузки карты
      setTimeout(() => {
        map.current?.resize();
        map.current?.triggerRepaint();
      }, 50);
    });
    
    map.current.on('error', (e) => console.error('❌ Map error:', e.error));

    map.current.on('click', (e: maplibregl.MapMouseEvent) => {
      const target = e.originalEvent.target as HTMLElement;
      if (target.closest('.custom-marker') || target.closest('.modal-container') || target.closest('.modal-overlay')) return;
      if (isCreatingStop && onMapClickRef.current) {
        const { lng, lat } = e.lngLat;
        onMapClickRef.current(lat, lng);
      }
    });

    return () => {
      clearTimeout(initTimeout);
      if (map.current) {
        markersRef.current.forEach(({ marker, element }) => {
          if (element && (element as any)._clickHandler) {
            element.removeEventListener('click', (element as any)._clickHandler);
            delete (element as any)._clickHandler;
          }
          marker.remove();
        });
        markersRef.current.clear();
        map.current.remove();
        map.current = null;
      }
      setMapLoaded(false);
      setMapInitializing(true);
    };
  }, [selectedCity, isCreatingStop]);

  // 🔄 Resize handler — ИСПРАВЛЕНО
  useEffect(() => {
    const triggerResize = () => {
      if (map.current && mapLoaded) {
        // Force reflow
        if (mapContainer.current) {
          void mapContainer.current.offsetWidth;
        }
        requestAnimationFrame(() => {
          map.current?.resize();
          map.current?.triggerRepaint();
        });
      }
    };

    triggerResize();
    const handleWindowResize = () => triggerResize();
    window.addEventListener('resize', handleWindowResize);
    
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [isPanelCollapsed, mapLoaded]);

  const fetchMarkers = async (cityId: number) => {
    try {
      setLoading(true);
      setError(null);
      const fetchedMarkers = await getMarkers(cityId);
      const normalized = fetchedMarkers.map((m: any) => ({ 
        ...m, 
        id: Number(m.id), 
        cityId: m.cityId || cityId, 
        lat: Number(m.lat), 
        lng: Number(m.lng) 
      }));
      setLocalMarkers(normalized);
    } catch (err) {
      console.error('Failed to fetch markers:', err);
      setError('Не удалось загрузить данные остановок');
    } finally {
      setLoading(false);
    }
  };

  // 🛣️ Отрисовка маршрутов — УПРОЩЕНО (без GeoJSON типов)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    drawRoutes();
  }, [routes, selectedRouteId, mapLoaded]);

  const drawRoutes = useCallback(() => {
    if (!map.current) return;
    
    ['routes-line-selected', 'routes-line'].forEach(layerId => {
      if (map.current?.getLayer(layerId)) map.current.removeLayer(layerId);
    });
    if (map.current?.getSource('routes')) map.current.removeSource('routes');
    if (routes.length === 0) return;

    // ✅ Простой массив — MapLibre сам конвертирует
    const features = routes
      .filter(route => route.stops && route.stops.length >= 2)
      .map(route => {
        const sortedStops = [...route.stops].sort((a, b) => a.orderInRoute - b.orderInRoute);
        const coordinates = sortedStops
          .map(stop => isValidCoordinate(stop.lat, stop.lng) ? toMapLibre(stop.lat, stop.lng) : null)
          .filter((c): c is [number, number] => c !== null);
        if (coordinates.length < 2) return null;
        
        return {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates },
          properties: { 
            id: route.id, 
            number: route.number, 
            isSelected: route.id === selectedRouteId 
          }
        };
      })
      .filter(Boolean);

    if (features.length === 0) return;

    try {
      // ✅ Используем as any — MapLibre разберётся
      map.current.addSource('routes', { 
        type: 'geojson', 
        data: { type: 'FeatureCollection', features } as any 
      });

      map.current.addLayer({
        id: 'routes-line', 
        type: 'line', 
        source: 'routes',
        filter: ['!=', ['get', 'isSelected'], true],
        paint: { 
          'line-color': '#94a3b8', 
          'line-width': 3, 
          'line-opacity': 0.6, 
          'line-dasharray': [2, 2] 
        }
      });

      if (selectedRouteId) {
        map.current.addLayer({
          id: 'routes-line-selected', 
          type: 'line', 
          source: 'routes',
          filter: ['==', ['get', 'isSelected'], true],
          paint: { 
            'line-color': '#3b82f6', 
            'line-width': 5, 
            'line-opacity': 1 
          }
        });
        const selectedFeature = features.find((f: any) => f.properties.id === selectedRouteId);
        if (selectedFeature) {
          const bounds = new maplibregl.LngLatBounds();
          selectedFeature.geometry.coordinates.forEach((coord: [number, number]) => bounds.extend(coord));
          map.current.fitBounds(bounds, { padding: 60, duration: 1000, maxZoom: 14 });
        }
      }
    } catch (error) {
      console.error('Error adding routes:', error);
    }
  }, [routes, selectedRouteId]);

  // 📍 Отрисовка маркеров — ИСПРАВЛЕНО
  useEffect(() => {
    if (!map.current || loading || mapInitializing) return;

    // Удаляем маркеры, которых больше нет
    markersRef.current.forEach((value, id) => {
      if (!markers.find(m => m.id === id)) {
        const { marker, element } = value;
        if (element && (element as any)._clickHandler) {
          element.removeEventListener('click', (element as any)._clickHandler);
          delete (element as any)._clickHandler;
        }
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Создаём/обновляем маркеры
    markers.forEach(marker => {
      if (!isValidCoordinate(marker.lat, marker.lng)) return;

      if (markersRef.current.has(marker.id)) {
        const existing = markersRef.current.get(marker.id)!;
        updateMarkerElement(existing.element, marker, isCreatingRoute, selectedStops);
        return;
      }

      const el = createCustomMarker(marker, isCreatingRoute, selectedStops);
      
      const clickHandler = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (isCreatingRoute && onMarkerClickRef.current) {
          onMarkerClickRef.current(marker);
          return;
        }
        if (!isCreatingRoute && !isCreatingStop) {
          setSelectedModalMarker(marker);
        }
      };

      el.addEventListener('click', clickHandler, { passive: false });
      (el as any)._clickHandler = clickHandler;
      el.setAttribute('data-marker-id', String(marker.id));

      // ✅ Создаём ОДИН экземпляр маркера
      const markerInstance = new maplibregl.Marker({ 
        element: el, 
        anchor: 'center',
        clickTolerance: 8
      })
        .setLngLat(toMapLibre(marker.lat, marker.lng))
        .addTo(map.current!);
        
      markersRef.current.set(marker.id, { marker: markerInstance, element: el });
    });

  }, [markers, loading, isCreatingRoute, isCreatingStop, selectedStops, mapInitializing]);

  const updateMarkerElement = (el: HTMLDivElement, marker: Stop, isCreatingRoute: boolean, selectedStops: number[]) => {
    const isSelected = isCreatingRoute && selectedStops.includes(marker.id);
    const color = loadToColor(marker.load);
    const size = getMarkerSize(marker.load);
    const index = isSelected ? selectedStops.indexOf(marker.id) + 1 : 0;

    Object.assign(el.style, {
  width: `${size}px`,
  height: `${size}px`,
  backgroundColor: isSelected ? '#3B82F6' : color,
  cursor: 'pointer',
  border: isSelected ? '3px solid #2563EB' : '3px solid white',
  borderRadius: '50%',
  boxShadow: isSelected ? '0 4px 20px rgba(37, 99, 235, 0.6)' : '0 4px 12px rgba(0,0,0,0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  // transition: 'all 0.25s ease',  // ← можно оставить или убрать, теперь в CSS
  pointerEvents: 'auto',
  zIndex: isSelected ? '150' : '100',
  // ❗ УДАЛЕНО: transform: isSelected ? 'scale(1.1)' : 'scale(1)',
});

    const text = el.querySelector('.marker-text') as HTMLElement;
    if (text) {
      text.textContent = (isSelected && index > 0) ? index.toString() : (marker.load?.toString() || '0');
      Object.assign(text.style, { fontSize: size > 40 ? '14px' : '12px' });
    }

    el.setAttribute('title', `${marker.address}\nЗагрузка: ${marker.load}/10`);
  };

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

  const createCustomMarker = (marker: Stop, isCreatingRoute: boolean, selectedStops: number[]): HTMLDivElement => {
    const el = document.createElement('div');
    el.className = 'custom-marker';
    
    const isSelected = isCreatingRoute && selectedStops.includes(marker.id);
    const color = loadToColor(marker.load);
    const size = getMarkerSize(marker.load);
    const index = isSelected ? selectedStops.indexOf(marker.id) + 1 : 0;

    Object.assign(el.style, {
      width: `${size}px`,
      height: `${size}px`,
      backgroundColor: isSelected ? '#3B82F6' : color,
      cursor: 'pointer',
      border: isSelected ? '3px solid #2563EB' : '3px solid white',
      borderRadius: '50%',
      boxShadow: isSelected ? '0 4px 20px rgba(37, 99, 235, 0.6)' : '0 4px 12px rgba(0,0,0,0.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.25s ease',
      transform: isSelected ? 'scale(1.1)' : 'scale(1)',
      pointerEvents: 'auto',
      zIndex: isSelected ? '150' : '100',
      // ❗ НЕТ position: relative — MapLibre сам управляет!
    });

    const text = document.createElement('div');
    text.className = 'marker-text';
    text.textContent = (isSelected && index > 0) ? index.toString() : (marker.load?.toString() || '0');
    Object.assign(text.style, {
      color: 'white',
      fontWeight: '700',
      fontSize: size > 40 ? '14px' : '12px',
      textShadow: '0 1px 3px rgba(0,0,0,0.4)',
      lineHeight: '1',
      userSelect: 'none',
      pointerEvents: 'none',
    });
    el.appendChild(text);
    el.setAttribute('title', `${marker.address}\nЗагрузка: ${marker.load}/10`);
    el.setAttribute('data-marker-id', String(marker.id));
    return el;
  };

  const formatTime = (date: Date) => date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const handleCityChange = (value: number) => { 
    selectCity(value); 
    setSelectedModalMarker(null); 
  };

  const filterOption: SelectProps['filterOption'] = (input, option) => {
    const label = option?.label ?? option?.children;
    if (typeof label === 'string') {
      return label.toLowerCase().includes(input.toLowerCase());
    }
    return false;
  };

  return (
    <div className="map-page">
      <div className={`map-control-panel ${isPanelCollapsed ? 'collapsed' : ''}`}>
        {!isPanelCollapsed ? (
          <>
            <div className="panel-header">
              <div className="header-main">
                <h3>🗺️ Карта пассажиропотоков</h3>
                <div className="time-display">
                  <Clock size={16} />
                  <span>{formatTime(currentTime)}</span>
                </div>
              </div>
              <button className="collapse-btn" onClick={() => setIsPanelCollapsed(true)} title="Свернуть">
                <Minimize2 size={18} />
              </button>
            </div>

            <div className="city-filter-section">
              <div className="filter-label">
                <Building2 size={16} />
                <span>Город:</span>
              </div>
              {citiesLoading ? (
                <Spin size="small" />
              ) : citiesError ? (
                <span className="error-text">Ошибка загрузки</span>
              ) : (
                <Select
                  className="city-select"
                  value={selectedCityId || undefined}
                  onChange={handleCityChange}
                  style={{ width: '100%' }}
                  placeholder="Выберите город"
                  showSearch
                  optionFilterProp="label"
                  filterOption={filterOption}
                >
                  {cities.map(city => (
                    <Option key={city.id} value={city.id} label={city.name}>
                      <Tooltip title={`${formatCoordsHuman(city.lat, city.lng)}`}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={14} style={{ color: '#666' }} />
                          {city.name}
                          {defaultCityId === city.id && (
                            <Badge color="green" text="по умолчанию" style={{ fontSize: '10px' }} />
                          )}
                        </span>
                      </Tooltip>
                    </Option>
                  ))}
                </Select>
              )}
            </div>

            {(isCreatingStop || isCreatingRoute) && (
              <div className="creation-mode-info">
                <div className="mode-indicator">
                  <MapPin size={18} />
                  <span>
                    {isCreatingStop 
                      ? '🎯 Кликните на карту для создания остановки' 
                      : '🔗 Кликните на остановки для создания маршрута'}
                  </span>
                </div>
              </div>
            )}

            <div className="stats-section">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon"><MapPin size={20} /></div>
                  <div className="stat-info">
                    <div className="stat-value">{markers.length}</div>
                    <div className="stat-label">Остановок</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon"><RefreshCw size={20} /></div>
                  <div className="stat-info">
                    <div className="stat-value">{routes.length}</div>
                    <div className="stat-label">Маршрутов</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="actions-section">
              <button 
                className="action-btn primary" 
                onClick={() => selectedCityId && fetchMarkers(selectedCityId)} 
                disabled={loading || !selectedCityId}
              >
                {loading ? <Loader2 size={18} className="spin" /> : <RefreshCw size={18} />}
                {loading ? 'Загрузка...' : 'Обновить'}
              </button>
            </div>
          </>
        ) : (
          <div className="collapsed-panel">
            <Tooltip title="Развернуть панель">
              <button className="expand-btn" onClick={() => setIsPanelCollapsed(false)}>
                <Maximize2 size={22} />
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      <div className="map-area">
        {(loading || mapInitializing || citiesLoading) && (
          <div className="map-loading-overlay">
            <Spin size="large" tip="Загрузка данных..." />
          </div>
        )}

        {error && (
          <div className="map-error-overlay">
            <div className="error-message">⚠️ {error}</div>
            <button className="retry-btn" onClick={() => selectedCityId && fetchMarkers(selectedCityId)}>
              Повторить
            </button>
          </div>
        )}

        <div
          ref={mapContainer}
          className="map-container"
          style={{
            cursor: isCreatingStop ? 'crosshair' : isCreatingRoute ? 'pointer' : 'grab',
            opacity: mapInitializing ? 0.5 : 1,
            transition: 'opacity 0.3s ease',
            pointerEvents: 'auto',
          }}
        />
      </div>

      {selectedModalMarker && !isCreatingRoute && !isCreatingStop && (
        <>
          <ModalContent
            marker={selectedModalMarker}
            isOpen={!!selectedModalMarker}
            onClose={() => setSelectedModalMarker(null)}
          />
          <button className="modal-close-btn" onClick={() => setSelectedModalMarker(null)} title="Закрыть" aria-label="Закрыть">
            <X size={20} />
          </button>
        </>
      )}
    </div>
  );
};

export default React.memo(MapComponent);