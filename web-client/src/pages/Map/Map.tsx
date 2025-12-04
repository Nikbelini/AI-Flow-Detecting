// src/pages/Map/Map.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapComponent.css';
import PopupContent from './PopupContent';
import { getMarkers } from '../../api/markersApi';
import { Clock, Filter, Layers, RefreshCw, Zap, BarChart, MapPin } from 'lucide-react';

interface Marker {
  id: number;
  address: string;
  url?: string;
  count: number;
  velocity: number;
  load: number;
  lat: number;
  lng: number;
  coordinates?: [number, number];
}

interface ForecastState {
  showForecast: boolean;
  isForecastOpen: boolean;
  forecastData: any;
  autoRefresh: boolean;
  showMiniChart: boolean;
}

interface MapComponentProps {
  markers?: Marker[];
  selectedMarker?: Marker;
  onMarkersLoad?: (markers: Marker[]) => void;
}

const MapComponent: React.FC<MapComponentProps> = ({ 
    markers: externalMarkers, 
    selectedMarker,
    onMarkersLoad 
}) => {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const markersRef = useRef([]);
    const popupRootsRef = useRef(new Map());
    
    // Состояния UI
    const [localMarkers, setLocalMarkers] = useState<Marker[]>([]);
    const [loading, setLoading] = useState(!externalMarkers);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [showTraffic, setShowTraffic] = useState(true);
    const [filterLoad, setFilterLoad] = useState<number | null>(null);
    const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [mapStats, setMapStats] = useState({
      totalStops: 0,
      avgLoad: 0,
      maxLoad: 0,
      activeRoutes: 0
    });

    const markers = externalMarkers || localMarkers;

    const [forecastsState, setForecastsState] = useState<Map<string, ForecastState>>(new Map());

    // Таймер для автообновления времени
    useEffect(() => {
      const timer = setInterval(() => {
        setCurrentTime(new Date());
      }, 60000); // Обновляем каждую минуту
      
      return () => clearInterval(timer);
    }, []);

    // Загрузка маркеров
    useEffect(() => {
        if (!externalMarkers) {
            fetchMarkers();
            
            if (autoRefresh) {
              const intervalId = setInterval(fetchMarkers, 30000);
              return () => clearInterval(intervalId);
            }
        }
    }, [externalMarkers, autoRefresh]);

    const fetchMarkers = async () => {
        try {
            setLoading(true);
            setError(null);
            const fetchedMarkers = await getMarkers();
            setLocalMarkers(fetchedMarkers);
            
            // Обновляем статистику
            updateMapStats(fetchedMarkers);
            
            if (onMarkersLoad) {
                onMarkersLoad(fetchedMarkers);
            }
        } catch (err) {
            console.error('Failed to fetch markers:', err);
            setError('Не удалось загрузить данные остановок');
        } finally {
            setLoading(false);
        }
    };

    const updateMapStats = (markers: Marker[]) => {
      const total = markers.length;
      const avgLoad = total > 0 ? Math.round(markers.reduce((sum, m) => sum + m.load, 0) / total) : 0;
      const maxLoad = Math.max(...markers.map(m => m.load), 0);
      const activeRoutes = new Set(markers.map(m => m.url?.split('/').pop() || '')).size;
      
      setMapStats({ totalStops: total, avgLoad, maxLoad, activeRoutes });
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
            zoom: 10
        });

        map.current.on('moveend', () => {
            if (map.current) {
                // Можно сохранять состояние карты
            }
        });

        return () => {
            if (map.current) map.current.remove();
            popupRootsRef.current.forEach(root => root.unmount());
            popupRootsRef.current.clear();
        };
    }, []);

    const updateForecastState = useCallback((address: string, updates: Partial<ForecastState>) => {
        setForecastsState(prev => {
            const newState = new Map(prev);
            const currentState = newState.get(address) || {
                showForecast: false,
                isForecastOpen: false,
                forecastData: null,
                autoRefresh: false,
                showMiniChart: true
            };
            newState.set(address, { ...currentState, ...updates });
            return newState;
        });
    }, []);

    const getForecastState = useCallback((address: string): ForecastState => {
        return forecastsState.get(address) || {
            showForecast: false,
            isForecastOpen: false,
            forecastData: null,
            autoRefresh: false,
            showMiniChart: true
        };
    }, [forecastsState]);

    // Фильтрация маркеров
    const filteredMarkers = markers.filter(marker => {
      if (filterLoad !== null && marker.load < filterLoad) return false;
      if (selectedFilters.includes('high') && marker.load <= 7) return false;
      if (selectedFilters.includes('medium') && (marker.load <= 3 || marker.load > 7)) return false;
      if (selectedFilters.includes('low') && marker.load > 3) return false;
      return true;
    });

    // Обновление маркеров на карте
    useEffect(() => {
        if (!map.current || loading) return;

        markersRef.current.forEach(marker => {
            const address = marker._address;
            if (address && popupRootsRef.current.has(address)) {
                const root = popupRootsRef.current.get(address);
                root.unmount();
                popupRootsRef.current.delete(address);
            }
            marker.remove();
        });
        markersRef.current = [];

        const previouslyOpenedMarker = markersRef.current.find(m => 
            m.getPopup()?.isOpen()
        );
        const openedMarkerAddress = previouslyOpenedMarker?._address;

        const markersInstances = filteredMarkers.map(marker => {
            const el = document.createElement('div');
            el.className = 'marker';
            const color = loadToColor(marker.load);
            el.style.backgroundColor = color;
            el.style.cursor = 'pointer';
            el.style.setProperty('--marker-color', color);
            
            const markerSize = getMarkerSize(marker.load);
            el.innerHTML = `
              <div class="marker-inner" style="color: ${color}; font-size: ${markerSize.fontSize}">
                ${marker.load}
              </div>
            `;

            const popupContainer = document.createElement('div');
            const popup = new maplibregl.Popup({ offset: 25, className: 'custom-popup' })
                .setDOMContent(popupContainer);

            const markerInstance = new maplibregl.Marker({ element: el, anchor: 'bottom-left' })
                .setLngLat([marker.lng, marker.lat])
                .setPopup(popup)
                .addTo(map.current);

            markerInstance._address = marker.address;

            const root = createRoot(popupContainer);
            popupRootsRef.current.set(marker.address, root);

            const forecastState = getForecastState(marker.address);

            root.render(
                <PopupContent 
                    marker={marker}
                    forecastState={forecastState}
                    onForecastStateChange={(updates) => updateForecastState(marker.address, updates)}
                />
            );

            if (openedMarkerAddress === marker.address) {
                markerInstance.togglePopup();
            }

            return markerInstance;
        });

        markersRef.current = markersInstances;
    }, [filteredMarkers, loading, getForecastState, updateForecastState]);

    useEffect(() => {
        if (!markers.length) return;
        
        markersRef.current.forEach(markerInstance => {
            const address = markerInstance._address;
            if (address && markerInstance.getPopup().isOpen()) {
                const root = popupRootsRef.current.get(address);
                if (root) {
                    const forecastState = getForecastState(address);
                    const marker = markers.find(m => m.address === address);
                    if (marker) {
                        root.render(
                            <PopupContent 
                                marker={marker}
                                forecastState={forecastState}
                                onForecastStateChange={(updates) => updateForecastState(address, updates)}
                            />
                        );
                    }
                }
            }
        });
    }, [forecastsState, markers, getForecastState, updateForecastState]);

    useEffect(() => {
        if (selectedMarker && map.current && markers.length > 0) {
            const targetMarker = markersRef.current.find(m => 
                m._address === selectedMarker.address
            );

            if (targetMarker) {
                markersRef.current.forEach(marker => {
                    if (marker !== targetMarker && marker.getPopup().isOpen()) {
                        marker.togglePopup();
                    }
                });

                if (!targetMarker.getPopup().isOpen()) {
                    targetMarker.togglePopup();
                }

                map.current.flyTo({
                    center: [selectedMarker.lng, selectedMarker.lat],
                    zoom: 15,
                    essential: true
                });
            }
        }
    }, [selectedMarker, markers]);

    const loadToColor = (load: number): string => {
        if (load <= 3) return "#10b981";
        if (load <= 7) return "#f59e0b";
        return "#ef4444";
    };

    const getMarkerSize = (load: number) => {
      if (load <= 3) return { size: 32, fontSize: '12px' };
      if (load <= 7) return { size: 40, fontSize: '14px' };
      return { size: 48, fontSize: '16px' };
    };

    const toggleFilter = (filter: string) => {
      setSelectedFilters(prev => 
        prev.includes(filter) 
          ? prev.filter(f => f !== filter)
          : [...prev, filter]
      );
    };

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    };

    return (
        <div className="map-page">
            {/* Боковая панель управления */}
            <div className="map-control-panel">
                <div className="panel-header">
                    <h3>🗺️ Карта пассажиропотоков</h3>
                    <div className="time-display">
                        <Clock size={16} />
                        <span>{formatTime(currentTime)}</span>
                    </div>
                </div>

                {/* Статистика */}
                <div className="stats-section">
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon">
                                <MapPin size={20} />
                            </div>
                            <div className="stat-info">
                                <div className="stat-value">{mapStats.totalStops}</div>
                                <div className="stat-label">Остановок</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">
                                <Zap size={20} />
                            </div>
                            <div className="stat-info">
                                <div className="stat-value">{mapStats.avgLoad}%</div>
                                <div className="stat-label">Ср. загрузка</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">
                                <BarChart size={20} />
                            </div>
                            <div className="stat-info">
                                <div className="stat-value">{mapStats.maxLoad}%</div>
                                <div className="stat-label">Макс. загрузка</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">
                                <Layers size={20} />
                            </div>
                            <div className="stat-info">
                                <div className="stat-value">{mapStats.activeRoutes}</div>
                                <div className="stat-label">Маршрутов</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Фильтры */}
                <div className="filters-section">
                    <h4>
                        <Filter size={18} />
                        Фильтры загрузки
                    </h4>
                    <div className="filter-buttons">
                        <button 
                            className={`filter-btn ${selectedFilters.includes('high') ? 'active' : ''}`}
                            onClick={() => toggleFilter('high')}
                            style={{ '--filter-color': '#ef4444' } as React.CSSProperties}
                        >
                            <div className="filter-dot"></div>
                            Высокая
                        </button>
                        <button 
                            className={`filter-btn ${selectedFilters.includes('medium') ? 'active' : ''}`}
                            onClick={() => toggleFilter('medium')}
                            style={{ '--filter-color': '#f59e0b' } as React.CSSProperties}
                        >
                            <div className="filter-dot"></div>
                            Средняя
                        </button>
                        <button 
                            className={`filter-btn ${selectedFilters.includes('low') ? 'active' : ''}`}
                            onClick={() => toggleFilter('low')}
                            style={{ '--filter-color': '#10b981' } as React.CSSProperties}
                        >
                            <div className="filter-dot"></div>
                            Низкая
                        </button>
                    </div>
                </div>

                {/* Настройки отображения */}
                <div className="display-section">
                    <h4>
                        <Layers size={18} />
                        Отображение
                    </h4>
                    <div className="toggle-group">
                        <label className="toggle-item">
                            <input 
                                type="checkbox" 
                                checked={showHeatmap}
                                onChange={(e) => setShowHeatmap(e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                            <span className="toggle-label">Тепловая карта</span>
                        </label>
                        <label className="toggle-item">
                            <input 
                                type="checkbox" 
                                checked={showTraffic}
                                onChange={(e) => setShowTraffic(e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                            <span className="toggle-label">Трафик в реальном времени</span>
                        </label>
                        <label className="toggle-item">
                            <input 
                                type="checkbox" 
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                            <span className="toggle-label">Автообновление</span>
                        </label>
                    </div>
                </div>

                {/* Быстрые действия */}
                <div className="actions-section">
                    <button 
                        className="action-btn primary"
                        onClick={fetchMarkers}
                        disabled={loading}
                    >
                        <RefreshCw size={18} />
                        {loading ? 'Обновление...' : 'Обновить данные'}
                    </button>
                    <button className="action-btn secondary">
                        Экспорт данных
                    </button>
                </div>

                {/* Легенда */}
                <div className="legend-section">
                    <h4>Легенда</h4>
                    <div className="legend-items">
                        <div className="legend-item">
                            <div className="legend-color" style={{ backgroundColor: '#ef4444' }}></div>
                            <span>Высокая загрузка (8-10)</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-color" style={{ backgroundColor: '#f59e0b' }}></div>
                            <span>Средняя загрузка (4-7)</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-color" style={{ backgroundColor: '#10b981' }}></div>
                            <span>Низкая загрузка (1-3)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Основная область карты */}
            <div className="map-area">
                {/* Индикатор загрузки */}
                {loading && (
                    <div className="map-loading-overlay">
                        <div className="spinner"></div>
                        <p>Загрузка данных в реальном времени...</p>
                    </div>
                )}
                
                {/* Сообщение об ошибке */}
                {error && (
                    <div className="map-error-overlay">
                        <div className="error-message">⚠️ {error}</div>
                        <button className="retry-btn" onClick={fetchMarkers}>
                            Повторить
                        </button>
                    </div>
                )}
                
                {/* Бейдж с количеством маркеров */}
                {!loading && markers.length > 0 && (
                    <div className="map-stats-badge">
                        <div className="stats-content">
                            <span className="stats-icon">🚏</span>
                            <span className="stats-text">{filteredMarkers.length}/{markers.length} остановок</span>
                            {selectedFilters.length > 0 && (
                                <span className="filter-indicator">фильтры активны</span>
                            )}
                        </div>
                    </div>
                )}
                
                <div
                    ref={mapContainer}
                    className="map-container"
                    style={{ opacity: loading ? 0.7 : 1 }}
                />
            </div>
        </div>
    );
};

export default MapComponent;