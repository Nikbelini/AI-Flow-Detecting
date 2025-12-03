// src/pages/Map/Map.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapComponent.css';
import PopupContent from './PopupContent';
import { getMarkers } from '../../api/markersApi'; // Только getMarkers

// Определяем интерфейс здесь, если не экспортируется
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
    const [mapState, setMapState] = useState({
        center: [48.2412, 54.1851],
        zoom: 10
    });
    
    // Локальное состояние для маркеров, если не переданы извне
    const [localMarkers, setLocalMarkers] = useState<Marker[]>([]);
    const [loading, setLoading] = useState(!externalMarkers);
    const [error, setError] = useState<string | null>(null);

    // Используем либо внешние маркеры, либо локальные
    const markers = externalMarkers || localMarkers;

    // Состояние прогнозов для каждого маркера
    const [forecastsState, setForecastsState] = useState<Map<string, ForecastState>>(new Map());

    // Загрузка маркеров при монтировании, если не переданы извне
    useEffect(() => {
        if (!externalMarkers) {
            fetchMarkers();
            
            // Автообновление каждые 30 секунд
            const intervalId = setInterval(fetchMarkers, 30000);
            return () => clearInterval(intervalId);
        }
    }, [externalMarkers]);

    const fetchMarkers = async () => {
        try {
            setLoading(true);
            setError(null);
            const fetchedMarkers = await getMarkers();
            setLocalMarkers(fetchedMarkers);
            
            // Уведомляем родительский компонент
            if (onMarkersLoad) {
                onMarkersLoad(fetchedMarkers);
            }
        } catch (err) {
            console.error('Failed to fetch markers:', err);
            setError('Не удалось загрузить данные остановок');
            // Можно использовать fallback данные
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
            center: mapState.center,
            zoom: mapState.zoom
        });

        map.current.on('moveend', () => {
            if (map.current) {
                setMapState({
                    center: map.current.getCenter().toArray(),
                    zoom: map.current.getZoom()
                });
            }
        });

        return () => {
            if (map.current) map.current.remove();
            // Очищаем все корни при размонтировании
            popupRootsRef.current.forEach(root => root.unmount());
            popupRootsRef.current.clear();
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

    const getForecastState = useCallback((address: string): ForecastState => {
        return forecastsState.get(address) || {
            showForecast: false,
            isForecastOpen: false,
            forecastData: null,
            autoRefresh: false,
            showMiniChart: true
        };
    }, [forecastsState]);

    // Обновление маркеров на карте
    useEffect(() => {
        if (!map.current || loading) return;

        console.log('🔄 Updating markers, total:', markers.length);

        // Запоминаем какой popup был открыт перед обновлением
        const previouslyOpenedMarker = markersRef.current.find(m => 
            m.getPopup()?.isOpen()
        );
        const openedMarkerAddress = previouslyOpenedMarker?._address;

        // Удаляем старые маркеры
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

        // Добавляем новые маркеры
        const markersInstances = markers.map(marker => {
            const el = document.createElement('div');
            el.className = 'marker';
            const color = loadToColor(marker.load);
            el.style.backgroundColor = color;
            el.style.cursor = 'pointer';
            el.style.setProperty('--marker-color', color);
            el.innerHTML = `<div class="marker-inner" style="color: ${color}">${marker.load}</div>`;

            // Создаем контейнер для React-компонента
            const popupContainer = document.createElement('div');
            const popup = new maplibregl.Popup({ offset: 25, className: 'custom-popup' })
                .setDOMContent(popupContainer);

            const markerInstance = new maplibregl.Marker({ element: el, anchor: 'bottom-left' })
                .setLngLat([marker.lng, marker.lat])
                .setPopup(popup)
                .addTo(map.current);

            // Сохраняем адрес в маркере для идентификации
            markerInstance._address = marker.address;

            // Создаем корень для React и сохраняем его
            const root = createRoot(popupContainer);
            popupRootsRef.current.set(marker.address, root);

            // Получаем текущее состояние прогноза для этого маркера
            const forecastState = getForecastState(marker.address);

            // Рендерим React-компонент в popup
            root.render(
                <PopupContent 
                    marker={marker}
                    forecastState={forecastState}
                    onForecastStateChange={(updates) => updateForecastState(marker.address, updates)}
                />
            );

            // Открываем popup если это тот же маркер, что был открыт до обновления
            if (openedMarkerAddress === marker.address) {
                markerInstance.togglePopup();
            }

            return markerInstance;
        });

        markersRef.current = markersInstances;
    }, [markers, loading, getForecastState, updateForecastState]);

    // Обновляем popup при изменении состояния прогноза
    useEffect(() => {
        if (!markers.length) return;
        
        console.log('🔄 Forecast state updated, updating popups');
        
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

    // Перемещение к выбранному маркеру
    useEffect(() => {
        if (selectedMarker && map.current && markers.length > 0) {
            // Находим соответствующий маркер
            const targetMarker = markersRef.current.find(m => 
                m._address === selectedMarker.address
            );

            if (targetMarker) {
                // Закрываем все другие popup
                markersRef.current.forEach(marker => {
                    if (marker !== targetMarker && marker.getPopup().isOpen()) {
                        marker.togglePopup();
                    }
                });

                // Открываем popup выбранного маркера
                if (!targetMarker.getPopup().isOpen()) {
                    targetMarker.togglePopup();
                }

                // Перемещаем карту
                map.current.flyTo({
                    center: [selectedMarker.lng, selectedMarker.lat],
                    zoom: 15,
                    essential: true
                });
            }
        }
    }, [selectedMarker, markers]);

    const loadToColor = (load: number): string => {
        if (load <= 3) return "#10b981"; // green
        if (load <= 7) return "#f59e0b"; // yellow
        return "#ef4444"; // red
    };
    
    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
            {/* Индикатор загрузки */}
            {loading && (
                <div className="map-loading-overlay">
                    <div className="spinner"></div>
                    <p>Загрузка остановок...</p>
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
            
            {/* Информация о загруженных маркерах */}
            {!loading && markers.length > 0 && (
                <div className="map-stats-overlay">
                    <div className="stats-badge">
                    🚏 {markers.length} остановок
                    </div>
                </div>
            )}
            
            <div
                ref={mapContainer}
                style={{
                    width: '100vw',
                    height: '100vh',
                    borderRadius: '8px',
                    border: '1px solid #ccc',
                    opacity: loading ? 0.7 : 1
                }}
            />
        </div>
    );
};

export default MapComponent;