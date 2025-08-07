import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MapComponent = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapError, setMapError] = useState(null);

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