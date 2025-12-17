import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapComponent.css';
import PopupContent from './PopupContent';

interface Marker {
    id: number;
    address: string;
    url?: string;
    count: number;
    velocity: number;
    load: number;
    lat: number;
    lng: number;
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
}

const MapComponent: React.FC<MapComponentProps> = ({ markers = [], selectedMarker }) => {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const markersRef = useRef([]);
    const popupRootsRef = useRef(new Map());
    const [mapState, setMapState] = useState({
        center: [48.2412, 54.1851],
        zoom: 10
    });

    // Состояние прогнозов для каждого маркера
    const [forecastsState, setForecastsState] = useState<Map<string, ForecastState>>(new Map());

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

    // Обновление маркеров
    useEffect(() => {
        if (!map.current) return;

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
            el.style.backgroundColor = loadToColor(marker.load);
            el.style.cursor = 'pointer';
            el.style.setProperty('--marker-color', loadToColor(marker.load));
            el.innerHTML = `<div class="marker-inner" style="color: ${loadToColor(marker.load)}">${marker.load}</div>`;

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
    }, [markers, getForecastState, updateForecastState]);

    // Обновляем popup при изменении состояния прогноза
    useEffect(() => {
        console.log('🔄 Forecast state updated, updating popups');
        
        markersRef.current.forEach(markerInstance => {
            const address = markerInstance._address;
            if (address && markerInstance.getPopup().isOpen()) {
                const root = popupRootsRef.current.get(address);
                if (root) {
                    const forecastState = getForecastState(address);
                    const marker = markers.find(m => m.address === address);
                    if (marker) {
                        // Создаем новый контейнер
                        const newContainer = document.createElement('div');
                        const popup = markerInstance.getPopup();
                        
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
        if (selectedMarker && map.current) {
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
    }, [selectedMarker]);

    const loadToColor = (load: number): string => {
        if (load <= 3) return "green";
        if (load <= 7) return "yellow";
        return "red";
    };
    
    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
            <div
                ref={mapContainer}
                style={{
                    width: '100vw',
                    height: '100vh',
                    borderRadius: '8px',
                    border: '1px solid #ccc'
                }}
            />
        </div>
    );
};

export default MapComponent;