import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapComponent.css';

const MapComponent = ({ markers = [], selectedMarker }) => {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const markersRef = useRef([]);
    const [mapState, setMapState] = useState({
        center: [48.2412, 54.1851],
        zoom: 10
    });
    const [openedPopupMarkerId, setOpenedPopupMarkerId] = useState(null);

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

            const popup = new maplibregl.Popup({ offset: 25, className: 'custom-popup' })
                .setHTML(createPopupContent(marker));

            const markerInstance = new maplibregl.Marker({ element: el, anchor: 'bottom-left' })
                .setLngLat(marker.coordinates)
                .setPopup(popup)
                .addTo(map.current);

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

    // Остальные функции без изменений
    const loadToColor = (load) => {
        if (load <= 3) return "green";
        if (load <= 7) return "yellow";
        return "red";
    };

    const createPopupContent = (marker) => {
        return `
            <div class="popup-card">
                <div class="popup-header">
                    <h3>Остановка</h3>
                </div>
                <div class="popup-body">
                    <div class="popup-row">
                        <div class="popup-icon">📍</div>
                        <div class="popup-address">${marker.address || 'Адрес не указан'}</div>
                    </div>
                    ${marker.url ? `
                    <div class="popup-row">
                        <div class="popup-icon">🔗</div>
                        <a href="${marker.url}" target="_blank" class="popup-url">${marker.url}</a>
                    </div>
                    ` : ''}
                    <div class="popup-metrics">
                        <div class="metric-item">
                            <div class="metric-icon">👥</div>
                            <div class="metric-value">${marker.count}</div>
                            <div class="metric-label">посетителей</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-icon">⚡</div>
                            <div class="metric-value">${marker.velocity}</div>
                            <div class="metric-label">скорость</div>
                        </div>
                    </div>
                </div>
                <div class="popup-footer">
                    <div class="load-indicator">
                        <div class="load-dot" style="background: ${loadToColor(marker.load)};"></div>
                        <span class="load-text">Нагрузка: ${marker.load}/10</span>
                    </div>
                </div>
            </div>
        `;
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