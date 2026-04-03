// src/pages/Map/SimulationMap.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './SimulationMap.css';
import { Users, Clock, MapPin, EyeOff, Route as RouteIcon } from 'lucide-react';
import type { Stop } from '../../api/types';

interface ExtendedStop extends Stop {
  color?: string;
  avg_load?: number;
  avg_wait_time?: number;
  cluster?: string;
  peak_hours?: number[];
}

export interface MapRoute {
  id: number;
  number?: string;
  name?: string;
  path: [number, number][];
  color?: string;
  stops?: number[];
  intervalMinutes?: number;
  transportType?: string;
  isActive?: boolean;
  cityId?: number;
}

interface SimulationMapProps {
  markers: ExtendedStop[];
  routes?: MapRoute[];
  selectedStopId?: number | null;
  selectedRouteId?: number | null;
  onMarkerClick?: (marker: ExtendedStop) => void;
  onRouteClick?: (route: MapRoute) => void;
  onMapClick?: (lngLat: [number, number]) => void;
  selectionMode?: boolean;
  creationMode?: 'stop' | 'route' | null;
  // НОВЫЕ ПРОПСЫ
  showStops?: boolean;
  filteredRouteIds?: Set<number>;
  onShowStopsChange?: (show: boolean) => void;
}

const SimulationMap: React.FC<SimulationMapProps> = ({
  markers,
  routes = [],
  selectedStopId,
  selectedRouteId,
  onMarkerClick,
  onRouteClick,
  onMapClick,
  selectionMode = false,
  creationMode = null,
  showStops = true,
  filteredRouteIds = new Set(),
  onShowStopsChange
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const routePopupRef = useRef<maplibregl.Popup | null>(null);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredStop, setHoveredStop] = useState<ExtendedStop | null>(null);
  const [hoveredRoute, setHoveredRoute] = useState<MapRoute | null>(null);

  // ФИЛЬТРАЦИЯ МАРКЕРОВ
  const visibleMarkers = showStops ? markers : [];
  
  // ФИЛЬТРАЦИЯ МАРШРУТОВ
  const visibleRoutes = filteredRouteIds.size > 0 
    ? routes.filter(route => filteredRouteIds.has(route.id))
    : routes;

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
      console.log('✅ Simulation map loaded');
      setMapLoaded(true);
    });

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  // Обработчик клика по карте для создания остановки
  useEffect(() => {
    if (!map.current || !mapLoaded || !onMapClick || creationMode !== 'stop') return;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      if (creationMode === 'stop') {
        onMapClick([e.lngLat.lng, e.lngLat.lat]);
      }
    };

    map.current.on('click', handleMapClick);

    return () => {
      map.current?.off('click', handleMapClick);
    };
  }, [mapLoaded, onMapClick, creationMode]);

  // Отрисовка маршрутов (используем visibleRoutes)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Удаляем старые слои
    ['routes', 'routes-outline', 'routes-highlight'].forEach(layerId => {
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
    });
    
    if (map.current.getSource('routes')) {
      map.current.removeSource('routes');
    }

    // Если нет маршрутов для отображения - выходим
    if (visibleRoutes.length === 0) {
      console.log('🛤️ Нет маршрутов для отображения');
      return;
    }

    console.log('🛤️ Отрисовка маршрутов:', visibleRoutes.length);

    const routesWithColors = visibleRoutes.map(route => ({
      ...route,
      color: route.color || `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
    }));

    const features = routesWithColors.map(route => ({
      type: 'Feature' as const,
      properties: { 
        id: route.id, 
        color: route.color,
        name: route.name || `Маршрут ${route.id}`,
        number: route.number || '',
        interval: route.intervalMinutes || 15,
        transportType: route.transportType || 'BUS',
        isSelected: route.id === selectedRouteId
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: route.path
      }
    }));

    map.current.addSource('routes', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features
      }
    });

    map.current.addLayer({
      id: 'routes-outline',
      type: 'line',
      source: 'routes',
      paint: {
        'line-color': '#ffffff',
        'line-width': 8,
        'line-opacity': 0.4
      }
    });

    map.current.addLayer({
      id: 'routes',
      type: 'line',
      source: 'routes',
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'isSelected'], true],
          '#f97316',
          ['get', 'color']
        ],
        'line-width': [
          'case',
          ['==', ['get', 'isSelected'], true],
          6,
          4
        ],
        'line-opacity': 0.8
      }
    });

    map.current.addLayer({
      id: 'routes-highlight',
      type: 'line',
      source: 'routes',
      paint: {
        'line-color': '#ffaa00',
        'line-width': 8,
        'line-opacity': 0
      }
    });

    // Удаляем старые обработчики, чтобы не накапливались
    map.current.off('click', 'routes');
    map.current.off('mouseenter', 'routes');
    map.current.off('mouseleave', 'routes');
    map.current.off('mousemove', 'routes');

    map.current.on('click', 'routes', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const routeId = feature.properties?.id;
      const route = routesWithColors.find(r => r.id === routeId);
      if (route && onRouteClick) {
        console.log('🖱️ Route clicked:', route);
        onRouteClick(route);
      }
    });

    map.current.on('mouseenter', 'routes', () => {
      map.current!.getCanvas().style.cursor = selectionMode ? 'pointer' : 'default';
      map.current!.setPaintProperty('routes-highlight', 'line-opacity', 0.3);
    });

    map.current.on('mouseleave', 'routes', () => {
      map.current!.getCanvas().style.cursor = '';
      map.current!.setPaintProperty('routes-highlight', 'line-opacity', 0);
    });

    map.current.on('mousemove', 'routes', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const routeId = feature.properties?.id;
      const route = routesWithColors.find(r => r.id === routeId);
      if (route && e.lngLat) {
        showRouteTooltip(route, e.lngLat);
        setHoveredRoute(route);
      }
    });

    map.current.on('mouseleave', 'routes', () => {
      if (routePopupRef.current) {
        routePopupRef.current.remove();
        routePopupRef.current = null;
      }
      setHoveredRoute(null);
    });

  }, [visibleRoutes, mapLoaded, selectedRouteId, onRouteClick, selectionMode]);

  // Отрисовка маркеров (используем visibleMarkers)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    console.log('📍 Отрисовка маркеров:', visibleMarkers.length);

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    visibleMarkers.forEach(stop => {
      const el = createMarkerElement(stop);
      
      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'center',
        offset: [0, 0]
      })
        .setLngLat([stop.lng, stop.lat])
        .addTo(map.current!);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log('✅ Marker clicked:', stop.id, stop.address);
        onMarkerClick?.({
          ...stop,
          id: stop.id,
          address: stop.address,
          lat: stop.lat,
          lng: stop.lng,
          load: stop.load || stop.avg_load || 3,
          avg_load: stop.avg_load,
          avg_wait_time: stop.avg_wait_time || 8.2
        });
      });

      el.addEventListener('mouseenter', () => {
        setHoveredStop(stop);
        showStopTooltip(stop);
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

  }, [visibleMarkers, mapLoaded, selectedStopId, onMarkerClick]);

  const showStopTooltip = (stop: ExtendedStop) => {
    if (!map.current) return;
    if (popupRef.current) popupRef.current.remove();

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
          ${stop.peak_hours?.length ? `<br/><small>Пик: ${stop.peak_hours.map(h => `${h}:00`).join(', ')}</small>` : ''}
        </div>
      `)
      .addTo(map.current);

    popupRef.current = popup;
  };

  const showRouteTooltip = (route: MapRoute, lngLat: maplibregl.LngLat) => {
    if (!map.current) return;
    if (routePopupRef.current) routePopupRef.current.remove();

    const transportIcon = 
      route.transportType === 'BUS' ? '🚌' :
      route.transportType === 'TROLLEYBUS' ? '🚎' :
      route.transportType === 'TRAM' ? '🚊' :
      route.transportType === 'MINIBUS' ? '🚐' : '🚌';

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: [0, -10]
    })
      .setLngLat(lngLat)
      .setHTML(`
        <div class="route-tooltip">
          <strong>${transportIcon} Маршрут ${route.number || route.id}</strong><br/>
          ${route.name ? `<span>${route.name}</span><br/>` : ''}
          Интервал: ${route.intervalMinutes || 15} мин<br/>
          Остановок: ${route.stops?.length || 0}
        </div>
      `)
      .addTo(map.current);

    routePopupRef.current = popup;
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

    const currentHour = new Date().getHours();
    if (stop.peak_hours?.includes(currentHour)) {
      el.textContent = '⚡';
      el.style.fontSize = `${size * 0.6}px`;
    } else {
      el.textContent = String(stop.load || stop.avg_load || 0);
      el.style.fontSize = `${size * 0.5}px`;
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
      'educational': '📚 Образовательный',
      'unknown': '❓ Неизвестно'
    };
    return labels[cluster] || cluster;
  };

  return (
    <div className="simulation-map-wrapper">
      <div ref={mapContainer} className="simulation-map-container" />
      
      {selectionMode && (
        <div className="simulation-map-hint">
          <MapPin size={16} />
          <span>Кликните на остановку или маршрут для выбора</span>
        </div>
      )}

      {creationMode === 'stop' && (
        <div className="simulation-map-hint creation">
          <MapPin size={16} />
          <span>Кликните на карту, чтобы добавить новую остановку</span>
        </div>
      )}

      {/* НОВЫЙ: Бейдж "Остановки скрыты" */}
      {!showStops && markers.length > 0 && (
        <div className="map-status-badge hidden-stops">
          <EyeOff size={14} />
          <span>Остановки скрыты</span>
          {onShowStopsChange && (
            <button onClick={() => onShowStopsChange(true)}>Показать</button>
          )}
        </div>
      )}

      {/* НОВЫЙ: Бейдж "Фильтрация маршрутов" */}
      {filteredRouteIds.size > 0 && routes.length > 0 && (
        <div className="map-status-badge filtered-routes">
          <RouteIcon size={14} />
          <span>Показано {filteredRouteIds.size} из {routes.length} маршрутов</span>
        </div>
      )}

      {hoveredStop && (
        <div className="simulation-map-mini-info stop">
          <strong>{hoveredStop.address}</strong>
          <div className="mini-stats">
            <span><Users size={12} /> {hoveredStop.load || hoveredStop.avg_load || 0}/10</span>
            <span><Clock size={12} /> {(hoveredStop.avg_wait_time || 8.2).toFixed(1)} мин</span>
          </div>
        </div>
      )}

      {hoveredRoute && !hoveredStop && (
        <div className="simulation-map-mini-info route">
          <strong>
            {hoveredRoute.transportType === 'BUS' && '🚌'}
            {hoveredRoute.transportType === 'TROLLEYBUS' && '🚎'}
            {hoveredRoute.transportType === 'TRAM' && '🚊'}
            {hoveredRoute.transportType === 'MINIBUS' && '🚐'}
            {' '}Маршрут {hoveredRoute.number || hoveredRoute.id}
          </strong>
          <div className="mini-stats">
            <span>⏱️ {hoveredRoute.intervalMinutes || 15} мин</span>
            <span>🛑 {hoveredRoute.stops?.length || 0} ост.</span>
          </div>
        </div>
      )}

      <div className="map-legend">
        <div className="legend-title">Загрузка</div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#10b981' }}></div>
          <span>Низкая (0-3)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#f59e0b' }}></div>
          <span>Средняя (4-7)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#ef4444' }}></div>
          <span>Высокая (8-10)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#3b82f6' }}></div>
          <span>Маршруты</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#f97316' }}></div>
          <span>Выбранный маршрут</span>
        </div>
        <div className="legend-item">
          <div className="legend-icon">⚡</div>
          <span>Пиковый час</span>
        </div>
      </div>
    </div>
  );
};

export default SimulationMap;