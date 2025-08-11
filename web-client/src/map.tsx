import React, { useRef, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapComponent.css';
import PopupContent from './PopupContent';

const MapComponent = ({ markers = [], selectedMarker }) => {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const markersRef = useRef([]);
    const [mapState, setMapState] = useState({
        center: [48.2412, 54.1851],
        zoom: 10
    });

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
        };
    }, []);

    // Обновление маркеров
    useEffect(() => {
        if (!map.current) return;

        // Запоминаем какой popup был открыт перед обновлением
        const previouslyOpenedMarker = markersRef.current.find(m => 
            m.getPopup()?.isOpen()
        );
        const openedMarkerId = previouslyOpenedMarker?.getLngLat().toString();

        // Удаляем старые маркеры
        markersRef.current.forEach(marker => marker.remove());
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
                .setLngLat(marker.coordinates)
                .setPopup(popup)
                .addTo(map.current);

            // Рендерим React-компонент в popup
            const root = createRoot(popupContainer);
            root.render(<PopupContent marker={marker} />);

            // Открываем popup если это тот же маркер, что был открыт до обновления
            if (openedMarkerId === markerInstance.getLngLat().toString()) {
                markerInstance.togglePopup();
            }

            return markerInstance;
        });

        markersRef.current = markersInstances;
    }, [markers]);

    // Перемещение к выбранному маркеру
    useEffect(() => {
        if (selectedMarker && map.current) {
            // Находим соответствующий маркер
            const targetMarker = markersRef.current.find(m => 
                m.getLngLat().toString() === selectedMarker.coordinates.toString()
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
                    center: selectedMarker.coordinates,
                    zoom: 15,
                    essential: true
                });
            }
        }
    }, [selectedMarker]);

    const loadToColor = (load) => {
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