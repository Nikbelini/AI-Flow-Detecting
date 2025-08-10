import React, { useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapComponent.css';

const MapComponent = ({ markers = [], selectedMarker }) => {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const markersRef = useRef([]); // Ссылка на маркеры для доступа в других эффектах

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

        // Создаем массив для хранения маркеров
        const markersInstances = [];

        map.current.on('load', () => {
            map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

            markers.forEach(marker => {
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

                markersInstances.push(markerInstance);
            });
        });

        // Сохраняем маркеры в ref
        markersRef.current = markersInstances;

        return () => {
            if (map.current) map.current.remove();
        };
    }, [markers]);

    // Эффект для перемещения карты при выборе маркера
    useEffect(() => {
        if (selectedMarker && map.current) {
            // Закрываем все открытые popup
            markersRef.current.forEach(marker => {
                if (marker.getPopup().isOpen()) {
                    marker.togglePopup();
                }
            });

            // Перемещаем карту к выбранному маркеру
            map.current.flyTo({
                center: selectedMarker.coordinates,
                zoom: 15,
                essential: true
            });

         
            
            
        }
    }, [selectedMarker]);

    // Остальной код остается без изменений
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