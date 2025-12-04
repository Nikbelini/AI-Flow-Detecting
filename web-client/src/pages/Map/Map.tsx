// src/pages/Map/Map.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapComponent.css';
import ModalContent from './ModalContent';
import { getMarkers } from '../../api/markersApi';
import { 
  Clock, Filter, Layers, RefreshCw, Zap, BarChart, 
  MapPin, Maximize2, Minimize2, Settings, X 
} from 'lucide-react';

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
    const map = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<maplibregl.Marker[]>([]);
    
    // Состояния UI
    const [localMarkers, setLocalMarkers] = useState<Marker[]>([]);
    const [loading, setLoading] = useState(!externalMarkers);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [showTraffic, setShowTraffic] = useState(true);
    const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [mapStats, setMapStats] = useState({
      totalStops: 0,
      avgLoad: 0,
      maxLoad: 0,
      activeRoutes: 0
    });
    
    // Модальное окно
    const [selectedModalMarker, setSelectedModalMarker] = useState<Marker | null>(null);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
    const [forecastsState, setForecastsState] = useState<Map<string, ForecastState>>(new Map());

    const markers = externalMarkers || localMarkers;

    // Таймер для автообновления времени
    useEffect(() => {
      const timer = setInterval(() => {
        setCurrentTime(new Date());
      }, 60000);
      
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
            zoom: 10,
            maxZoom: 18,
            minZoom: 8
        });

        // Добавляем навигацию
        map.current.addControl(new maplibregl.NavigationControl());
        
        // Добавляем масштаб
        map.current.addControl(new maplibregl.ScaleControl({
            maxWidth: 100,
            unit: 'metric'
        }));

        return () => {
            if (map.current) {
                map.current.remove();
                markersRef.current.forEach(marker => marker.remove());
            }
        };
    }, []);

    // Функции для управления состоянием прогноза
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

    // Обработчик клика на маркер - ТОЛЬКО модальное окно
    const handleMarkerClick = (marker: Marker) => {
        console.log('Marker clicked:', marker.address);
        setSelectedModalMarker(marker);
        
        // Плавно приближаем карту к маркеру (опционально)
        if (map.current) {
            map.current.flyTo({
                center: [marker.lng, marker.lat],
                zoom: 15,
                essential: true,
                duration: 800
            });
        }
    };

    // Фильтрация маркеров
    const filteredMarkers = markers.filter(marker => {
      if (selectedFilters.includes('high') && marker.load <= 7) return false;
      if (selectedFilters.includes('medium') && (marker.load <= 3 || marker.load > 7)) return false;
      if (selectedFilters.includes('low') && marker.load > 3) return false;
      return true;
    });

    // Создание кастомного маркера БЕЗ попапа
    const createCustomMarker = (marker: Marker): HTMLDivElement => {
        const el = document.createElement('div');
        el.className = 'custom-marker';
        const color = loadToColor(marker.load);
        const size = getMarkerSize(marker.load);
        
        // Базовые стили
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.backgroundColor = color;
        el.style.cursor = 'pointer';
        el.style.border = '3px solid white';
        el.style.borderRadius = '50%';
        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.transition = 'all 0.3s ease';
        el.style.zIndex = '10';
        el.style.position = 'relative';
        el.style.transformOrigin = 'center center'; // Фиксируем точку трансформации

        // Внешний контур для анимации
        const pulse = document.createElement('div');
        pulse.className = 'marker-pulse';
        pulse.style.position = 'absolute';
        pulse.style.top = '0';
        pulse.style.left = '0';
        pulse.style.right = '0';
        pulse.style.bottom = '0';
        pulse.style.borderRadius = '50%';
        pulse.style.border = `2px solid ${color}`;
        pulse.style.opacity = '0.5';
        pulse.style.animation = 'pulse 2s infinite';
        el.appendChild(pulse);

        // Создаем текстовое содержимое
        const text = document.createElement('div');
        text.className = 'marker-text';
        text.textContent = marker.load.toString();
        text.style.color = 'white';
        text.style.fontWeight = 'bold';
        text.style.fontSize = size > 40 ? '14px' : '12px';
        text.style.textShadow = '0 1px 2px rgba(0,0,0,0.3)';
        text.style.position = 'relative';
        text.style.zIndex = '2';
        el.appendChild(text);

        // Всплывающая подсказка (будет через CSS псевдоэлемент)
        el.setAttribute('data-address', marker.address);
        el.setAttribute('data-load', marker.load.toString());

        return el;
    };

    // Добавление обработчиков к маркеру
    const addMarkerEventListeners = (markerElement: HTMLDivElement, marker: Marker) => {
        const handleClick = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            handleMarkerClick(marker);
        };

        const handleMouseEnter = () => {
            // Не двигаем маркер, только меняем тень и добавляем класс
            markerElement.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
            markerElement.style.zIndex = '100';
            markerElement.classList.add('marker-hover');
        };

        const handleMouseLeave = () => {
            markerElement.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            markerElement.style.zIndex = '10';
            markerElement.classList.remove('marker-hover');
        };

        markerElement.addEventListener('click', handleClick);
        markerElement.addEventListener('mouseenter', handleMouseEnter);
        markerElement.addEventListener('mouseleave', handleMouseLeave);

        // Сохраняем ссылки на обработчики для очистки
        (markerElement as any)._clickHandler = handleClick;
        (markerElement as any)._mouseEnterHandler = handleMouseEnter;
        (markerElement as any)._mouseLeaveHandler = handleMouseLeave;
    };

    // Очистка обработчиков маркера
    const cleanupMarker = (markerElement: HTMLDivElement) => {
        if ((markerElement as any)._clickHandler) {
            markerElement.removeEventListener('click', (markerElement as any)._clickHandler);
        }
        if ((markerElement as any)._mouseEnterHandler) {
            markerElement.removeEventListener('mouseenter', (markerElement as any)._mouseEnterHandler);
        }
        if ((markerElement as any)._mouseLeaveHandler) {
            markerElement.removeEventListener('mouseleave', (markerElement as any)._mouseLeaveHandler);
        }
    };

    // Обновление маркеров на карте
    useEffect(() => {
        if (!map.current || loading) return;

        console.log('🔄 Updating markers, total:', filteredMarkers.length);

        // Удаляем старые маркеры
        markersRef.current.forEach((markerInstance, index) => {
            const markerElement = markerInstance.getElement() as HTMLDivElement;
            if (markerElement) {
                cleanupMarker(markerElement);
            }
            markerInstance.remove();
        });
        markersRef.current = [];

        // Добавляем новые маркеры
        const markersInstances = filteredMarkers.map(marker => {
            const markerElement = createCustomMarker(marker);
            
            // Добавляем обработчики событий
            addMarkerEventListeners(markerElement, marker);
            
            // Создаем маркер с anchor: 'bottom' чтобы не убегал
            const markerInstance = new maplibregl.Marker({ 
                element: markerElement,
                anchor: 'center' // Используем center, но фиксируем через transform-origin
            })
                .setLngLat([marker.lng, marker.lat])
                .addTo(map.current!);

            return markerInstance;
        });

        markersRef.current = markersInstances;
    }, [filteredMarkers, loading]);

    // Эффект для выбранного маркера извне
    useEffect(() => {
        if (selectedMarker && map.current && markers.length > 0) {
            const marker = markers.find(m => m.address === selectedMarker.address);
            if (marker) {
                setSelectedModalMarker(marker);
                map.current.flyTo({
                    center: [marker.lng, marker.lat],
                    zoom: 15,
                    essential: true,
                    duration: 800
                });
            }
        }
    }, [selectedMarker, markers]);

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

    const handleOpenForecast = () => {
        if (selectedModalMarker) {
            updateForecastState(selectedModalMarker.address, {
                showForecast: true,
                isForecastOpen: true
            });
        }
    };

    // Закрытие модального окна при клике на Escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && selectedModalMarker) {
                setSelectedModalMarker(null);
            }
        };
        
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [selectedModalMarker]);

    return (
        <div className="map-page">
            {/* Боковая панель управления */}
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
                            <button 
                                className="collapse-btn"
                                onClick={() => setIsPanelCollapsed(true)}
                                title="Свернуть панель"
                            >
                                <Minimize2 size={20} />
                            </button>
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
                    </>
                ) : (
                    <div className="collapsed-panel">
                        <button 
                            className="expand-btn"
                            onClick={() => setIsPanelCollapsed(false)}
                            title="Развернуть панель"
                        >
                            <Maximize2 size={24} />
                        </button>
                        <div className="collapsed-stats">
                            <div className="mini-stat">
                                <MapPin size={16} />
                                <span>{mapStats.totalStops}</span>
                            </div>
                            <div className="mini-stat">
                                <Zap size={16} />
                                <span>{mapStats.avgLoad}%</span>
                            </div>
                        </div>
                    </div>
                )}
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
                
                {/* Быстрые кнопки управления */}
                <div className="quick-controls">
                    <button 
                        className="quick-btn"
                        onClick={fetchMarkers}
                        title="Обновить данные"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <button 
                        className="quick-btn"
                        onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
                        title={isPanelCollapsed ? "Развернуть панель" : "Свернуть панель"}
                    >
                        {isPanelCollapsed ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
                    </button>
                    <button 
                        className="quick-btn"
                        title="Настройки карты"
                    >
                        <Settings size={18} />
                    </button>
                </div>
                
                {/* Бейдж с количеством маркеров */}
                {/*{!loading && markers.length > 0 && (
                    <div className="map-stats-badge">
                        <div className="stats-content">
                            <span className="stats-icon">🚏</span>
                            <span className="stats-text">{filteredMarkers.length}/{markers.length} остановок</span>
                            {selectedFilters.length > 0 && (
                                <span className="filter-indicator">{selectedFilters.length} фильтр(а)</span>
                            )}
                        </div>
                    </div>
                )}*/}
                
                <div
                    ref={mapContainer}
                    className="map-container"
                    style={{ opacity: loading ? 0.7 : 1 }}
                />
            </div>

            {/* Модальное окно */}
            {selectedModalMarker && (
                <ModalContent
                    marker={selectedModalMarker}
                    isOpen={!!selectedModalMarker}
                    onClose={() => setSelectedModalMarker(null)}
                    onForecastClick={handleOpenForecast}
                />
            )}
            
            {/* Кнопка закрытия модального окна */}
            {selectedModalMarker && (
                <button 
                    className="modal-close-btn"
                    onClick={() => setSelectedModalMarker(null)}
                    title="Закрыть детали остановки (Esc)"
                >
                    <X size={20} />
                </button>
            )}
        </div>
    );
};

export default MapComponent;