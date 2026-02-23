import React, { useRef, useEffect, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './SimulationMap.css';
import { Users, Clock, MapPin } from 'lucide-react';
import type { Stop } from '../../api/types';

interface ExtendedStop extends Stop {
  color?: string;
  avg_load?: number;
  avg_wait_time?: number;
  cluster?: string;
  peak_hours?: number[];
}

interface SimulationMapProps {
  markers: ExtendedStop[];
  selectedStopId?: number | null;
  onMarkerClick?: (marker: ExtendedStop) => void;
  selectionMode?: boolean;
}

const SimulationMap: React.FC<SimulationMapProps> = ({
  markers,
  selectedStopId,
  onMarkerClick,
  selectionMode = false
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredStop, setHoveredStop] = useState<ExtendedStop | null>(null);

  // Инициализация карты
  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap'
          }
        },
        layers: [{
          id: 'osm-tiles',
          type: 'raster',
          source: 'osm',
          minzoom: 0,
          maxzoom: 22
        }]
      },
      center: [48.2412, 54.1851],
      zoom: 12
    });

    map.current.addControl(new maplibregl.NavigationControl());
    map.current.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }));

    map.current.on('load', () => {
      console.log('Simulation map loaded');
      setMapLoaded(true);
    });

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  // Отрисовка маркеров
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Удаляем старые маркеры
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Создаём новые маркеры
    markers.forEach(stop => {
      const el = createMarkerElement(stop);
      
      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'center',
        offset: [0, 0]
      })
        .setLngLat([stop.lng, stop.lat])
        .addTo(map.current!);

      // Добавляем обработчики
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log('Marker clicked:', stop);
        onMarkerClick?.(stop);
      });

      el.addEventListener('mouseenter', () => {
        setHoveredStop(stop);
        showTooltip(stop);
      });

      el.addEventListener('mouseleave', () => {
        setHoveredStop(null);
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
      });

      markersRef.current.push(marker);
    });

    // Центрируем на выбранной остановке
    if (selectedStopId) {
      const selected = markers.find(m => m.id === selectedStopId);
      if (selected) {
        map.current.flyTo({
          center: [selected.lng, selected.lat],
          zoom: 15,
          duration: 800
        });
      }
    }

  }, [markers, mapLoaded, selectedStopId, onMarkerClick]);

  const showTooltip = (stop: ExtendedStop) => {
    if (!map.current) return;

    if (popupRef.current) {
      popupRef.current.remove();
    }

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: [0, -30]
    })
      .setLngLat([stop.lng, stop.lat])
      .setHTML(`
        <div class="stop-tooltip">
          <strong>${stop.address || 'Остановка'}</strong><br/>
          Загрузка: ${stop.load || stop.avg_load || 0}/10<br/>
          Время ожидания: ${(stop.avg_wait_time || 8.2).toFixed(1)} мин
          ${stop.cluster ? `<br/><small>${getClusterLabel(stop.cluster)}</small>` : ''}
        </div>
      `)
      .addTo(map.current);

    popupRef.current = popup;
  };

  const createMarkerElement = (stop: ExtendedStop): HTMLDivElement => {
    const el = document.createElement('div');
    const size = getMarkerSize(stop.load || stop.avg_load || 3);
    const color = stop.color || getColorByLoad(stop.load || stop.avg_load || 3);
    const isSelected = stop.id === selectedStopId;

    el.className = 'simulation-marker';
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.backgroundColor = color;
    el.style.borderRadius = '50%';
    el.style.border = isSelected ? '4px solid #3b82f6' : '3px solid white';
    el.style.boxShadow = isSelected 
      ? '0 4px 12px rgba(59, 130, 246, 0.5)'
      : '0 4px 12px rgba(0,0,0,0.3)';
    el.style.cursor = selectionMode ? 'pointer' : 'default';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.transition = 'all 0.2s ease';
    el.style.fontWeight = 'bold';
    el.style.color = 'white';
    el.style.textShadow = '0 1px 2px rgba(0,0,0,0.3)';

    // Отображаем загрузку или пиковый час
    if (stop.peak_hours?.includes(new Date().getHours())) {
      el.textContent = '⚡';
    } else {
      el.textContent = String(stop.load || stop.avg_load || 0);
    }

    return el;
  };

  const getColorByLoad = (load: number): string => {
    if (load <= 3) return '#10b981';
    if (load <= 7) return '#f59e0b';
    return '#ef4444';
  };

  const getMarkerSize = (load: number): number => {
    if (load <= 3) return 32;
    if (load <= 7) return 40;
    return 48;
  };

  const getClusterLabel = (cluster: string): string => {
    const labels: Record<string, string> = {
      'office': '🏢 Офисный район',
      'shopping': '🛍️ ТЦ',
      'residential': '🏘️ Жилой район',
      'transport_hub': '🚉 Транспортный узел',
      'educational': '📚 Образовательный'
    };
    return labels[cluster] || cluster;
  };

  return (
    <div className="simulation-map-wrapper">
      <div ref={mapContainer} className="simulation-map-container" />
      
      {selectionMode && (
        <div className="simulation-map-hint">
          <MapPin size={16} />
          <span>Кликните на остановку для выбора</span>
        </div>
      )}

      {hoveredStop && (
        <div className="simulation-map-mini-info">
          <strong>{hoveredStop.address}</strong>
          <div className="mini-stats">
            <span><Users size={12} /> {hoveredStop.load || hoveredStop.avg_load || 0}/10</span>
            <span><Clock size={12} /> {(hoveredStop.avg_wait_time || 8.2).toFixed(1)} мин</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationMap;