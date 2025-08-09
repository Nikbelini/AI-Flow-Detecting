import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapComponent.css';
const MapComponent = () => {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const [mapError, setMapError] = useState(null);

    const loadToColor = (load) => {
        if (load <= 3) return "green";
        if (load <= 7) return "yellow";
        return "red";
    }


    const markers = [
        {
            id: 1,
            url: "http: //example",
            coordinates: [37.6178, 55.7512],
            adress: "Остановка",
            count: 5,
            velocity: 5,
            load: 10,
        },
        {
            id: 2,
            coordinates: [30.3358, 59.9342],
            url: "http: //example",
            adress: "Государственный Эрмитаж",
            count: 5,
            velocity: 5,
            load: 5,
        },
        {
            id: 3,
            url: "http: //example",
            coordinates: [43.5855, 39.7231],
            title: "Олимпийский парк Сочи",
            count: 5,
            velocity: 5,
            load: 1,
        }
    ];
    useEffect(() => {
        if (!mapContainer.current) {
            setMapError('Контейнер карты не найден');
            return;
        }

        try {
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

            map.current.on('load', () => {
                console.log('Карта успешно загружена');
                map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

                markers.forEach(marker => {
                    const el = document.createElement('div');
                    el.className = 'marker';
                    el.style.backgroundColor = loadToColor(marker.load);
                    el.style.cursor = 'pointer';
                    el.style.setProperty('--marker-color', loadToColor(marker.load));

                    el.innerHTML = `<div class="marker-inner" style = "color: ${loadToColor(marker.load)}"> ${marker.load} </div>`


                    // Создаем popup
                    const popup = new maplibregl.Popup({ offset: 25, className: 'custom-popup' })
                        .setHTML(`
                            <div class="popup-card">
                            <div class="popup-header">
                                <h3>${marker.adress || marker.title || 'Точка доступа'}</h3>
                            </div>
                            <div class="popup-body">
                                <div class="popup-row">
                                <div class="popup-icon">📍</div>
                                <div class="popup-address">${marker.adress || 'Адрес не указан'}</div>
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
                        `);

                    // Добавляем маркер на карту
                    new maplibregl.Marker({ element: el, anchor: 'bottom' })
                        .setLngLat(marker.coordinates)
                        .setPopup(popup)
                        .addTo(map.current);
                });
            });


            map.current.on('error', (e) => {
                console.error('Ошибка карты:', e.error);
                setMapError('Не удалось загрузить карту');
            });

        } catch (err) {
            console.error('Ошибка инициализации карты:', err);
            setMapError('Ошибка при создании карты');
        }

        return () => {
            if (map.current) map.current.remove();
        };
    }, []);

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
            {mapError && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.8)'
                }}>
                    <p style={{ color: 'red' }}>{mapError}</p>
                </div>
            )}
        </div>
    );
};

export default MapComponent;