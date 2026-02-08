import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapComponent.css';
import ModalContent from './ModalContent';
import { getMarkers } from '../../api/markersApi';
import { Clock, Filter, RefreshCw, Zap, BarChart, MapPin, Minimize2, Maximize2, X } from 'lucide-react';

interface MarkerData {
  id: number;
  address: string;
  count: number;
  velocity: number;
  load: number;
  lat: number;
  lng: number;
}

interface MapComponentProps {
  markers?: MarkerData[];
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (marker: MarkerData) => void;
  isCreatingStop?: boolean;
  isCreatingRoute?: boolean;
  selectedStops?: number[];
}

const MapComponent: React.FC<MapComponentProps> = ({
  markers: externalMarkers,
  onMapClick,
  onMarkerClick,
  isCreatingStop = false,
  isCreatingRoute = false,
  selectedStops = []
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [localMarkers, setLocalMarkers] = useState<MarkerData[]>([]);
  const [loading, setLoading] = useState(!externalMarkers);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedModalMarker, setSelectedModalMarker] = useState<MarkerData | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  const markers = externalMarkers || localMarkers;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!externalMarkers) {
      fetchMarkers();
    }
  }, [externalMarkers]);

  const fetchMarkers = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedMarkers = await getMarkers();
      setLocalMarkers(fetchedMarkers);
    } catch (err) {
      console.error('Failed to fetch markers:', err);
      setError('Не удалось загрузить данные остановок');
    } finally {
      setLoading(false);
    }
  };

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
      center: [54.1851, 48.2412],
      zoom: 10,
      maxZoom: 18,
      minZoom: 8
    });

    map.current.addControl(new maplibregl.NavigationControl());
    map.current.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }));

    map.current.on('click', (e) => {
      if (onMapClick && isCreatingStop) {
        const { lng, lat } = e.lngLat;
        onMapClick(lat, lng);
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        markersRef.current.forEach(marker => marker.remove());
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    
    const handleClick = (e: maplibregl.MapMouseEvent) => {
      if (onMapClick && isCreatingStop) {
        const { lng, lat } = e.lngLat;
        onMapClick(lat, lng);
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
  }, [isCreatingStop, onMapClick]);

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

  const createCustomMarker = (marker: MarkerData): HTMLDivElement => {
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

  const handleMarkerClick = (marker: MarkerData) => {
    if (isCreatingRoute && onMarkerClick) {
      onMarkerClick(marker);
      return;
    }
    if (!isCreatingRoute && !isCreatingStop) {
      setSelectedModalMarker(marker);
      if (map.current) {
        map.current.flyTo({
          center: [marker.lng, marker.lat],
          zoom: 15,
          essential: true,
          duration: 800
        });
      }
    }
  };

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
        handleMarkerClick(marker);
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
                    <div className="stat-value">-</div>
                    <div className="stat-label">Автообновление</div>
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