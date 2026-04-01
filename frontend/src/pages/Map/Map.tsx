import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapComponent.css';
import ModalContent from './ModalContent';
import { getMarkers } from '../../api/endpoints/markersApi';
import { Clock, RefreshCw, MapPin, Minimize2, Maximize2, X } from 'lucide-react';
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

  const markers = externalMarkers || localMarkers;

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

  // Отрисовка маршрутов при изменении данных или загрузке карты
  useEffect(() => {
    if (!map.current || !mapLoaded) {
      console.log('Map not ready for routes');
      return;
    }
    
    console.log('Drawing routes, count:', routes.length, 'selectedId:', selectedRouteId);
    drawRoutes();
  }, [routes, selectedRouteId, mapLoaded]);

  const drawRoutes = () => {
    if (!map.current) {
      console.log('No map instance');
      return;
    }

    console.log('Starting drawRoutes with routes:', routes.length);

    // Удаляем старые слои и источник
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

    if (routes.length === 0) {
      console.log('No routes to draw');
      return;
    }

    const features: any[] = [];

    routes.forEach(route => {
      if (!route.stops || route.stops.length < 2) {
        console.log(`Route ${route.id} has insufficient stops`);
        return;
      }

      const sortedStops = [...route.stops].sort((a, b) => a.orderInRoute - b.orderInRoute);
      
      const coordinates = sortedStops
        .map(stop => {
          if (!stop.lng || !stop.lat) {
            console.warn('Stop missing coordinates:', stop);
            return null;
          }
          // MapLibre ожидает [lng, lat]
          return [stop.lng, stop.lat];
        })
        .filter(coord => coord !== null);

      if (coordinates.length < 2) {
        console.log(`Route ${route.id} has insufficient valid coordinates`);
        return;
      }

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

    console.log('Features to draw:', features);

    if (features.length === 0) {
      console.log('No valid features to draw');
      return;
    }

    try {
      map.current.addSource('routes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: features
        }
      });

      console.log('Source added successfully');

      // Невыделенные маршруты (серые, пунктирные)
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

      console.log('Base routes layer added');

      // Выделенный маршрут (синий, жирный)
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

        console.log('Selected route layer added');
        
        // Центрируем карту на выбранном маршруте
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
                <h3>🗺️ Карта пассажиропотоков</h3>
                <div className="time-display">
                  <Clock size={16} />
                  <span>{formatTime(currentTime)}</span>
                </div>
              </div>
              <button className="collapse-btn" onClick={() => setIsPanelCollapsed(true)}>
                <Minimize2 size={20} />
              </button>
            </div>

            {(isCreatingStop || isCreatingRoute) && (
              <div className="creation-mode-info">
                <div className="mode-indicator">
                  {isCreatingStop ? (
                    <>
                      <MapPin size={18} />
                      <span>Режим создания остановки - кликните на карту</span>
                    </>
                  ) : (
                    <>
                      <MapPin size={18} />
                      <span>Режим создания маршрута - кликайте на остановки</span>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="stats-section">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">
                    <MapPin size={20} />
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{markers.length}</div>
                    <div className="stat-label">Остановок</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">
                    <RefreshCw size={20} />
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{routes.length}</div>
                    <div className="stat-label">Маршрутов</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="actions-section">
              <button className="action-btn primary" onClick={fetchMarkers} disabled={loading}>
                <RefreshCw size={18} />
                {loading ? 'Обновление...' : 'Обновить данные'}
              </button>
            </div>
          </>
        ) : (
          <div className="collapsed-panel">
            <button className="expand-btn" onClick={() => setIsPanelCollapsed(false)}>
              <Maximize2 size={24} />
            </button>
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

      {selectedModalMarker && !isCreatingRoute && !isCreatingStop && (
        <button
          className="modal-close-btn"
          onClick={() => setSelectedModalMarker(null)}
        >
          <X size={20} />
        </button>
      )}
    </div>
  );
};

export default MapComponent;