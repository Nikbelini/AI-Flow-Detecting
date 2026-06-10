import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapComponent.css';
import ModalContent from './ModalContent';
import {
  Clock, RefreshCw, MapPin, Minimize2, Maximize2, TrendingUp,
  Users, Bus, Activity, Layers, Edit2, Trash2, Thermometer
} from 'lucide-react';
import type { Stop, Route as ApiRoute } from '../../api/types';
import { stopsApi } from '../../api/endpoints/stopsApi';
import type { CityResponse } from '../../api/endpoints/citiesApi';
import { citiesApi } from '../../api/endpoints/citiesApi';
import { routesApi } from '../../api/endpoints/routesApi';
import type { Feature, LineString, GeoJsonProperties } from 'geojson';

// Расширенный тип карты для хранения попапа
interface MapWithPopup extends maplibregl.Map {
  _routePopup?: maplibregl.Popup;
}

// Расширенный тип DOM-элемента для хранения обработчика
interface MarkerElement extends HTMLDivElement {
  _clickHandler?: (e: MouseEvent) => void;
}

interface MapComponentProps {
  cityId?: number;
  markers?: Stop[];
  routes?: ApiRoute[];
  selectedRouteId?: number | null;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (marker: Stop) => void;
  onRouteClick?: (route: ApiRoute) => void;
  // Удаляем неиспользуемые пропсы
  // onEditStop?: (stop: Stop) => void;
  // onDeleteStop?: (stopId: number) => void;
  onEditRoute?: (route: ApiRoute) => void;
  onDeleteRoute?: (routeId: number) => void;
  isCreatingStop?: boolean;
  isCreatingRoute?: boolean;
  selectedStops?: number[];
}

const MapComponent: React.FC<MapComponentProps> = ({
  cityId,
  markers: externalMarkers,
  routes = [],
  selectedRouteId,
  onMapClick,
  onMarkerClick,
  onRouteClick,
  onEditRoute,
  onDeleteRoute,
  isCreatingStop = false,
  isCreatingRoute = false,
  selectedStops = []
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapWithPopup | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onMapClickRef = useRef(onMapClick);
  const onRouteClickRef = useRef(onRouteClick);

  // Состояния для селектора городов
  const [citiesList, setCitiesList] = useState<CityResponse[]>([]);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState(true);

  const [selectedCityId, setSelectedCityId] = useState<number>(
    cityId || 1
  );

  const activeCityId = cityId ?? selectedCityId;

  const [localMarkers, setLocalMarkers] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(!externalMarkers);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedModalMarker, setSelectedModalMarker] = useState<Stop | null>(null);

  const [localRoutes, setLocalRoutes] = useState<ApiRoute[]>([]);
  // Удаляем неиспользуемое состояние routesLoading
  // const [routesLoading, setRoutesLoading] = useState(false);

  // Удаляем неиспользуемое состояние для тултипа
  // const [selectedRouteTooltip, setSelectedRouteTooltip] = useState<ApiRoute | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'routes'>('stats');
  const [hoveredRouteId, setHoveredRouteId] = useState<number | null>(null);
  const [currentZoom, setCurrentZoom] = useState(10);

  const markers = externalMarkers || localMarkers;

  // Подсчёт общей загрузки
  const totalLoad = markers.reduce((sum, m) => sum + (m.load || 0), 0);
  const avgLoad = markers.length > 0 ? (totalLoad / markers.length).toFixed(1) : '0';
  const totalPassengers = markers.reduce((sum, m) => sum + (m.count || 0), 0);
  const peakLoadStops = [...markers].sort((a, b) => (b.load || 0) - (a.load || 0)).slice(0, 3);

  // Загрузка списка городов из API
  useEffect(() => {
    let mounted = true;
    const loadCities = async () => {
      try {
        setCitiesLoading(true);
        const data = await citiesApi.getAllCities();
        if (mounted) setCitiesList(data);
      } catch (err) {
        console.error('Failed to load cities:', err);
      } finally {
        if (mounted) setCitiesLoading(false);
      }
    };
    loadCities();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
    onMapClickRef.current = onMapClick;
    onRouteClickRef.current = onRouteClick;
  }, [onMarkerClick, onMapClick, onRouteClick]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!externalMarkers && activeCityId) fetchMarkers();
  }, [externalMarkers, activeCityId]);

  const fetchMarkers = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedMarkers = await stopsApi.getStopsByCity(activeCityId);
      const normalized: Stop[] = fetchedMarkers.map((m: Stop) => ({
        ...m,
        id: Number(m.id),
        lat: Number(m.lat),
        lng: Number(m.lng)
      }));
      setLocalMarkers(normalized);
    } catch (err) {
      console.error('Failed to fetch markers:', err);
      setError('Не удалось загрузить данные остановок');
    } finally {
      setLoading(false);
    }
  };

  const getCityCoords = (id: number): { center: [number, number]; zoom: number } | null => {
    const city = citiesList.find(c => c.id === id);
    if (city && city.lat != null && city.lng != null) {
      return { center: [city.lng, city.lat], zoom: 12 };
    }
    return null;
  };

  const handleCitySelect = (newCityId: number) => {
    setIsCityDropdownOpen(false);

    if (cityId !== undefined) {
      if ((window as { __onCityChange?: (id: number) => void }).__onCityChange) {
        (window as { __onCityChange?: (id: number) => void }).__onCityChange?.(newCityId);
      }
      return;
    }

    setSelectedCityId(newCityId);

    if (map.current && mapLoaded) {
      const coords = getCityCoords(newCityId);
      if (coords) {
        map.current.flyTo({
          center: coords.center,
          zoom: coords.zoom,
          duration: 1000
        });
      }
    }
  };

  useEffect(() => {
    if (activeCityId) {
      fetchRoutes();
    }
  }, [activeCityId]);

  const fetchRoutes = async () => {
    try {
      // setRoutesLoading(true); // удалено
      const data = await routesApi.getRoutesByCity(activeCityId, undefined, true);
      setLocalRoutes(data);
    } catch (err) {
      console.error('Failed to fetch routes:', err);
    } finally {
      // setRoutesLoading(false);
    }
  };

  // Инициализация карты
  useEffect(() => {
    if (!mapContainer.current) return;

    const cityCoords = getCityCoords(activeCityId) || { center: [48.366667, 54.316667], zoom: 12 };

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
      center: cityCoords.center,
      zoom: cityCoords.zoom,
      maxZoom: 18,
      minZoom: 8
    }) as MapWithPopup;

    map.current.addControl(new maplibregl.NavigationControl());
    map.current.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }));

    map.current.on('load', () => {
      console.log('Map loaded');
      setMapLoaded(true);
    });

    map.current.on('zoomend', () => {
      if (map.current) {
        setCurrentZoom(map.current.getZoom());
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        markersRef.current.forEach(marker => marker.remove());
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      if (onMapClickRef.current && isCreatingStop) {
        const { lng, lat } = e.lngLat;
        onMapClickRef.current(lat, lng);
      }
    };

    if (isCreatingStop) {
      map.current.on('click', handleClick);
    }

    return () => {
      if (map.current) {
        map.current.off('click', handleClick);
      }
    };
  }, [isCreatingStop]);

  const displayRoutes = routes.length > 0 ? routes : localRoutes;

  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    drawRoutes();
  }, [displayRoutes, selectedRouteId, mapLoaded]);

  const drawRoutes = () => {
    if (!map.current) return;

    try {
      if (map.current.getLayer('routes-line-selected')) {
        map.current.removeLayer('routes-line-selected');
      }
      if (map.current.getLayer('routes-line')) {
        map.current.removeLayer('routes-line');
      }
      if (map.current.getLayer('routes-hover')) {
        map.current.removeLayer('routes-hover');
      }
      if (map.current.getSource('routes')) {
        map.current.removeSource('routes');
      }
    } catch (error) {
      console.log('Error removing old layers:', error);
    }

    if (routes.length === 0) return;

    const features: Feature<LineString, GeoJsonProperties>[] = [];

    routes.forEach(route => {
      if (!route.stops || route.stops.length < 2) return;

      const sortedStops = [...route.stops].sort((a, b) => a.orderInRoute - b.orderInRoute);

      const coordinates: [number, number][] = sortedStops
        .map(stop => {
          if (!stop.lng || !stop.lat) return null;
          return [stop.lng, stop.lat] as [number, number];
        })
        .filter((coord): coord is [number, number] => coord !== null);

      if (coordinates.length < 2) return;

      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        },
        properties: {
          id: route.id,
          number: route.number,
          name: route.name || '',
          transportType: route.transportType,
          intervalMinutes: route.intervalMinutes,
          stopsCount: route.stops.length,
          isActive: route.isActive,
          isSelected: route.id === selectedRouteId,
          isHovered: route.id === hoveredRouteId
        }
      });
    });

    if (features.length === 0) return;

    try {
      map.current.addSource('routes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: features
        }
      });

      map.current.addLayer({
        id: 'routes-line',
        type: 'line',
        source: 'routes',
        filter: ['!=', ['get', 'isSelected'], true],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#94a3b8',
          'line-width': 3,
          'line-opacity': 0.6,
          'line-dasharray': [2, 1]
        }
      });

      map.current.addLayer({
        id: 'routes-hover',
        type: 'line',
        source: 'routes',
        filter: ['==', ['get', 'isHovered'], true],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#f59e0b',
          'line-width': 6,
          'line-opacity': 0.8
        }
      });

      if (selectedRouteId) {
        map.current.addLayer({
          id: 'routes-line-selected',
          type: 'line',
          source: 'routes',
          filter: ['==', ['get', 'isSelected'], true],
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 5,
            'line-opacity': 1
          }
        });

        const selectedFeature = features.find(f => f.properties?.id === selectedRouteId);
        if (selectedFeature && selectedFeature.geometry.type === 'LineString') {
          const bounds = new maplibregl.LngLatBounds();
          selectedFeature.geometry.coordinates.forEach((coord: [number, number]) => {
            bounds.extend(coord);
          });
          map.current.fitBounds(bounds, { padding: 50, duration: 1000 });
        }
      }

      setupRouteEventHandlers();

    } catch (error) {
      console.error('Error adding routes to map:', error);
    }
  };

  const setupRouteEventHandlers = () => {
    if (!map.current) return;

    map.current.on('click', 'routes-line', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const routeId = feature.properties?.id;
      const route = routes.find(r => r.id === routeId);

      if (route && onRouteClickRef.current) {
        onRouteClickRef.current(route);
        showRouteTooltip(route, e.lngLat);
      }
    });

    map.current.on('click', 'routes-line-selected', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const routeId = feature.properties?.id;
      const route = routes.find(r => r.id === routeId);

      if (route && onRouteClickRef.current) {
        onRouteClickRef.current(route);
        showRouteTooltip(route, e.lngLat);
      }
    });

    map.current.on('mouseenter', 'routes-line', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const routeId = feature.properties?.id;
      setHoveredRouteId(routeId);
      map.current!.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseenter', 'routes-line-selected', () => {
      map.current!.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', 'routes-line', () => {
      setHoveredRouteId(null);
      map.current!.getCanvas().style.cursor = '';
    });

    map.current.on('mouseleave', 'routes-line-selected', () => {
      map.current!.getCanvas().style.cursor = '';
    });
  };

  const showRouteTooltip = (route: ApiRoute, lngLat: maplibregl.LngLat) => {
    if (!map.current) return;

    if (map.current._routePopup) {
      map.current._routePopup.remove();
    }

    const transportIcon = getTransportIcon(route.transportType);
    const statusText = route.isActive ? 'Активен' : 'Неактивен';

    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      offset: [0, -10],
      className: 'route-popup',
      maxWidth: '300px'
    })
      .setLngLat(lngLat)
      .setHTML(`
        <div class="route-popup-content">
          <div class="route-popup-header">
            <div class="route-popup-icon">${transportIcon}</div>
            <div class="route-popup-info">
              <div class="route-popup-number">${route.number}</div>
            </div>
            <div class="route-popup-status ${route.isActive ? 'active' : 'inactive'}">${statusText}</div>
          </div>
          ${route.name ? `<div class="route-popup-name-row">
            <div class="route-popup-name-icon">📋</div>
            <div class="route-popup-name">${route.name}</div>
          </div>` : ''}
          <div class="route-popup-details">
            <div class="detail-item">
              <span class="detail-icon">⏱️</span>
              <span class="detail-label">Интервал</span>
              <span class="detail-value">${route.intervalMinutes} мин</span>
            </div>
            <div class="detail-item">
              <span class="detail-icon">🚏</span>
              <span class="detail-label">Остановок</span>
              <span class="detail-value">${route.stops.length}</span>
            </div>
            <div class="detail-item">
              <span class="detail-icon">🕐</span>
              <span class="detail-label">Время работы</span>
              <span class="detail-value">${route.operatingHours || '06:00-23:00'}</span>
            </div>
          </div>
          <div class="route-popup-actions">
            <button class="popup-edit-btn" data-route-id="${route.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 3l4 4-7 7H10v-4l7-7z"/>
                <path d="M4 20h16"/>
              </svg>
              <span>Редактировать</span>
            </button>
            <button class="popup-delete-btn" data-route-id="${route.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13"/>
                <path d="M9 4h6"/>
              </svg>
              <span>Удалить</span>
            </button>
          </div>
        </div>
      `)
      .addTo(map.current);

    const popupElement = popup.getElement();
    const editBtn = popupElement.querySelector('.popup-edit-btn');
    const deleteBtn = popupElement.querySelector('.popup-delete-btn');

    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.remove();
        if (onEditRoute) onEditRoute(route);
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.remove();
        if (onDeleteRoute && confirm(`Удалить маршрут ${route.number}?`)) {
          onDeleteRoute(route.id);
        }
      });
    }

    map.current._routePopup = popup;
  };

  const getTransportIcon = (type: string): string => {
    switch (type) {
      case 'BUS': return '🚌';
      case 'TROLLEYBUS': return '🚎';
      case 'TRAM': return '🚊';
      case 'MINIBUS': return '🚐';
      default: return '🚌';
    }
  };

  const getClusterColor = (avgLoad: number): string => {
    if (avgLoad <= 3) return "#10b981";
    if (avgLoad <= 7) return "#f59e0b";
    return "#ef4444";
  };

  const getClusterSize = (count: number): number => {
    if (count <= 5) return 40;
    if (count <= 15) return 50;
    if (count <= 30) return 60;
    return 70;
  };

  useEffect(() => {
    if (!map.current || !mapLoaded || loading || markers.length === 0) return;

    markersRef.current.forEach(marker => {
      const el = marker.getElement() as MarkerElement;
      if (el && el._clickHandler) {
        el.removeEventListener('click', el._clickHandler);
      }
      marker.remove();
    });
    markersRef.current = [];

    const zoom = map.current.getZoom();
    const shouldCluster = zoom < 12;

    if (shouldCluster) {
      const clusterMap = new Map<string, { stops: Stop[]; avgLoad: number; count: number; centerLng: number; centerLat: number }>();

      markers.forEach(marker => {
        const gridX = Math.floor(marker.lng / 0.02);
        const gridY = Math.floor(marker.lat / 0.02);
        const key = `${gridX}:${gridY}`;

        if (!clusterMap.has(key)) {
          clusterMap.set(key, {
            stops: [],
            avgLoad: 0,
            count: 0,
            centerLng: 0,
            centerLat: 0
          });
        }

        const cluster = clusterMap.get(key)!;
        cluster.stops.push(marker);
        cluster.count++;
        cluster.centerLng = (cluster.centerLng * (cluster.count - 1) + marker.lng) / cluster.count;
        cluster.centerLat = (cluster.centerLat * (cluster.count - 1) + marker.lat) / cluster.count;
        cluster.avgLoad = (cluster.avgLoad * (cluster.count - 1) + (marker.load || 0)) / cluster.count;
      });

      clusterMap.forEach((cluster) => {
        if (cluster.count === 0) return;

        const size = getClusterSize(cluster.count);
        const clusterColor = heatmapEnabled ? getClusterColor(cluster.avgLoad) : '#3b82f6';
        const isSelected = isCreatingRoute && selectedStops.some(id => cluster.stops.some(s => s.id === id));

        const el = document.createElement('div') as MarkerElement;
        el.className = 'custom-marker cluster-marker';
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.backgroundColor = isSelected ? '#3B82F6' : clusterColor;
        el.style.borderRadius = '50%';
        el.style.border = isSelected ? '3px solid #2563EB' : '3px solid white';
        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.cursor = 'pointer';
        el.style.transition = 'all 0.2s ease';
        el.style.color = 'white';
        el.style.fontWeight = 'bold';
        el.style.textShadow = '0 1px 2px rgba(0,0,0,0.3)';

        const countSpan = document.createElement('div');
        countSpan.textContent = cluster.count.toString();
        countSpan.style.fontSize = `${size * 0.35}px`;
        countSpan.style.fontWeight = 'bold';

        const loadSpan = document.createElement('div');
        loadSpan.textContent = `${Math.round(cluster.avgLoad)}/10`;
        loadSpan.style.fontSize = `${size * 0.25}px`;
        loadSpan.style.opacity = '0.8';

        el.appendChild(countSpan);
        el.appendChild(loadSpan);

        const clickHandler = (e: MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();

          if (isCreatingRoute) {
            cluster.stops.forEach(stop => {
              if (onMarkerClickRef.current && !selectedStops.includes(stop.id)) {
                onMarkerClickRef.current(stop);
              }
            });
          } else {
            if (map.current) {
              const currentZoom = map.current.getZoom();
              map.current.flyTo({
                center: [cluster.centerLng, cluster.centerLat],
                zoom: Math.min(currentZoom + 2, 16),
                duration: 500
              });
            }
          }
        };

        el.addEventListener('click', clickHandler);
        el._clickHandler = clickHandler;

        const markerInstance = new maplibregl.Marker({
          element: el,
          anchor: 'center'
        })
          .setLngLat([cluster.centerLng, cluster.centerLat])
          .addTo(map.current!);

        markersRef.current.push(markerInstance);
      });
    } else {
      markers.forEach(marker => {
        const isSelected = isCreatingRoute && selectedStops.includes(marker.id);
        const markerColor = heatmapEnabled ? loadToColor(marker.load) : '#3b82f6';
        const size = getMarkerSize(marker.load);
        const selectedIndex = isSelected ? selectedStops.indexOf(marker.id) + 1 : 0;

        const el = document.createElement('div') as MarkerElement;
        el.className = 'custom-marker';
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.backgroundColor = isSelected ? '#3B82F6' : markerColor;
        el.style.cursor = 'pointer';
        el.style.border = isSelected ? '3px solid #2563EB' : '3px solid white';
        el.style.borderRadius = '50%';
        el.style.boxShadow = isSelected
          ? '0 4px 12px rgba(37, 99, 235, 0.5)'
          : '0 4px 12px rgba(0,0,0,0.3)';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.transition = 'all 0.3s ease';

        const text = document.createElement('div');
        text.className = 'marker-text';
        if (isSelected && selectedIndex > 0) {
          text.textContent = selectedIndex.toString();
        } else {
          text.textContent = marker.load?.toString() || '0';
        }
        text.style.color = 'white';
        text.style.fontWeight = 'bold';
        text.style.fontSize = size > 40 ? '14px' : '12px';
        text.style.textShadow = '0 1px 2px rgba(0,0,0,0.3)';
        el.appendChild(text);

        const clickHandler = (e: MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();

          if (isCreatingRoute && onMarkerClickRef.current) {
            onMarkerClickRef.current(marker);
            return;
          }

          if (!isCreatingRoute && !isCreatingStop) {
            setSelectedModalMarker(marker);
            map.current?.flyTo({
              center: [marker.lng, marker.lat],
              zoom: 15,
              essential: true,
              duration: 800
            });
          }
        };

        el.addEventListener('click', clickHandler);
        el._clickHandler = clickHandler;

        const markerInstance = new maplibregl.Marker({
          element: el,
          anchor: 'center'
        })
          .setLngLat([marker.lng, marker.lat])
          .addTo(map.current!);

        markersRef.current.push(markerInstance);
      });
    }
  }, [markers, loading, isCreatingRoute, isCreatingStop, selectedStops, mapLoaded, currentZoom, heatmapEnabled]);

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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="map-page">
      <div className={`map-control-panel ${isPanelCollapsed ? 'collapsed' : ''}`}>
        {!isPanelCollapsed ? (
          <>
            <div className="panel-header">
              <div className="header-main">
                <div className="title-section">
                  <div className="title-icon">🗺️</div>
                  <div className="title-text">
                    <h3>Карта пассажиропотоков</h3>
                    <span className="title-sub">в реальном времени</span>
                  </div>
                </div>

                <div className="city-selector-wrapper">
                  <button
                    className="city-selector-btn"
                    onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                    disabled={citiesLoading}
                    type="button"
                  >
                    <MapPin size={14} />
                    <span>
                      {citiesLoading ? 'Загрузка...' :
                        citiesList.find(c => c.id === activeCityId)?.name || 'Город'}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className={`chevron ${isCityDropdownOpen ? 'rotated' : ''}`}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {isCityDropdownOpen && (
                    <div className="city-dropdown">
                      {citiesList.map(city => (
                        <button
                          key={city.id}
                          className={`city-dropdown-item ${city.id === activeCityId ? 'active' : ''}`}
                          onClick={() => handleCitySelect(city.id)}
                          type="button"
                        >
                          <span className="city-name">{city.name}</span>
                          {city.id === cityId && <span className="city-check">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="time-display">
                  <Clock size={14} />
                  <span>{formatTime(currentTime)}</span>
                </div>
              </div>
              <button className="collapse-btn" onClick={() => setIsPanelCollapsed(true)}>
                <Minimize2 size={20} />
              </button>
            </div>

            <div className="panel-tabs">
              <button
                className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
                onClick={() => setActiveTab('stats')}
              >
                <Activity size={14} />
                Статистика
              </button>
              <button
                className={`tab-btn ${activeTab === 'routes' ? 'active' : ''}`}
                onClick={() => setActiveTab('routes')}
              >
                <Layers size={14} />
                Маршруты
              </button>
            </div>

            <div className="panel-content">
              {activeTab === 'stats' && (
                <>
                  <div className="stats-section">
                    <div className="stats-grid">
                      <div className="stat-card">
                        <div className="stat-icon blue">
                          <MapPin size={20} />
                        </div>
                        <div className="stat-info">
                          <div className="stat-value">{markers.length}</div>
                          <div className="stat-label">Остановок</div>
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-icon purple">
                          <Bus size={20} />
                        </div>
                        <div className="stat-info">
                          <div className="stat-value">{displayRoutes.length}</div>
                          <div className="stat-label">Маршрутов</div>
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-icon green">
                          <Users size={20} />
                        </div>
                        <div className="stat-info">
                          <div className="stat-value">{totalPassengers.toLocaleString()}</div>
                          <div className="stat-label">Пассажиров</div>
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-icon orange">
                          <TrendingUp size={20} />
                        </div>
                        <div className="stat-info">
                          <div className="stat-value">{avgLoad}</div>
                          <div className="stat-label">Ср. загрузка</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="load-distribution">
                    <div className="section-title">
                      <div className="title-dot green"></div>
                      <span>Распределение загрузки</span>
                    </div>
                    <div className="load-bars">
                      <div className="load-bar-item">
                        <span className="load-label">Низкая (0-3)</span>
                        <div className="load-bar-bg">
                          <div
                            className="load-bar-fill green"
                            style={{ width: `${(markers.filter(m => m.load <= 3).length / markers.length) * 100}%` }}
                          />
                        </div>
                        <span className="load-count">{markers.filter(m => m.load <= 3).length}</span>
                      </div>
                      <div className="load-bar-item">
                        <span className="load-label">Средняя (4-7)</span>
                        <div className="load-bar-bg">
                          <div
                            className="load-bar-fill orange"
                            style={{ width: `${(markers.filter(m => m.load > 3 && m.load <= 7).length / markers.length) * 100}%` }}
                          />
                        </div>
                        <span className="load-count">{markers.filter(m => m.load > 3 && m.load <= 7).length}</span>
                      </div>
                      <div className="load-bar-item">
                        <span className="load-label">Высокая (8-10)</span>
                        <div className="load-bar-bg">
                          <div
                            className="load-bar-fill red"
                            style={{ width: `${(markers.filter(m => m.load > 7).length / markers.length) * 100}%` }}
                          />
                        </div>
                        <span className="load-count">{markers.filter(m => m.load > 7).length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="top-stops">
                    <div className="section-title">
                      <div className="title-dot red"></div>
                      <span>Наиболее загруженные</span>
                    </div>
                    <div className="top-stops-list">
                      {peakLoadStops.map((stop, idx) => (
                        <div
                          key={stop.id}
                          className="top-stop-item"
                          onClick={() => {
                            if (onMarkerClick) onMarkerClick(stop);
                          }}
                        >
                          <div className="top-stop-rank">#{idx + 1}</div>
                          <div className="top-stop-address">{stop.address}</div>
                          <div className="top-stop-load">{stop.load}/10</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'routes' && (
                <div className="routes-info">
                  <div className="section-title">
                    <div className="title-dot blue"></div>
                    <span>Маршруты в системе</span>
                  </div>
                  <div className="routes-stats">
                    <div className="route-stat-item">
                      <span className="route-stat-label">Всего маршрутов</span>
                      <span className="route-stat-value">{displayRoutes.length}</span>
                    </div>
                    <div className="route-stat-item">
                      <span className="route-stat-label">Активных</span>
                      <span className="route-stat-value active">
                        {displayRoutes.filter(r => r.isActive).length}
                      </span>
                    </div>
                    <div className="route-stat-item">
                      <span className="route-stat-label">Средний интервал</span>
                      <span className="route-stat-value">
                        {displayRoutes.length > 0
                          ? Math.round(
                            displayRoutes.reduce((sum, r) => sum + (r.intervalMinutes || 15), 0) /
                            displayRoutes.length
                          )
                          : 0} мин
                      </span>
                    </div>
                  </div>

                  <div className="routes-list-sidebar">
                    {routes.map(route => (
                      <div
                        key={route.id}
                        className={`route-list-item ${selectedRouteId === route.id ? 'selected' : ''}`}
                        onClick={() => onRouteClick?.(route)}
                      >
                        <div className="route-list-header">
                          <span className="route-list-icon">{getTransportIcon(route.transportType)}</span>
                          <span className="route-list-number">{route.number}</span>
                          <span className={`route-list-status ${route.isActive ? 'active' : 'inactive'}`}>
                            {route.isActive ? 'Активен' : 'Неактивен'}
                          </span>
                        </div>
                        {route.name && <div className="route-list-name">{route.name}</div>}
                        <div className="route-list-details">
                          <span>🕐 {route.intervalMinutes} мин</span>
                          <span>🛑 {route.stops.length} ост.</span>
                        </div>
                        <div className="route-list-actions">
                          <button
                            className="route-edit-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditRoute?.(route);
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="route-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Удалить маршрут ${route.number}?`)) {
                                onDeleteRoute?.(route.id);
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedRouteId && (
                    <div className="selected-route-info">
                      <div className="selected-route-header">
                        <span>✅ Выбран на карте</span>
                      </div>
                      <div className="selected-route-detail">
                        Маршрут #{routes.find(r => r.id === selectedRouteId)?.number}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="actions-section">
              <button className="action-btn primary" onClick={fetchMarkers} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'spin' : ''} />
                {loading ? 'Обновление...' : 'Обновить данные'}
              </button>

              <button
                className={`action-btn ${heatmapEnabled ? 'active' : ''}`}
                onClick={() => setHeatmapEnabled(!heatmapEnabled)}
                title={heatmapEnabled ? 'Выключить тепловую карту' : 'Включить тепловую карту'}
                style={{ marginTop: '8px' }}
              >
                <Thermometer size={16} />
                Тепловая карта
              </button>
            </div>

            {(isCreatingStop || isCreatingRoute) && (
              <div className="creation-mode-info">
                <div className="mode-indicator">
                  <div className="mode-dot"></div>
                  {isCreatingStop ? (
                    <span>Режим создания остановки — кликните на карту</span>
                  ) : (
                    <span>Режим создания маршрута — кликайте на остановки</span>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="collapsed-panel">
            <button className="expand-btn" onClick={() => setIsPanelCollapsed(false)}>
              <Maximize2 size={24} />
            </button>
            <div className="collapsed-stats">
              <div className="collapsed-stat">
                <MapPin size={14} />
                <span>{markers.length}</span>
              </div>
              <div className="collapsed-stat">
                <Bus size={14} />
                <span>{routes.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="map-area">
        {loading && (
          <div className="map-loading-overlay">
            <div className="spinner"></div>
            <p>Загрузка данных...</p>
          </div>
        )}

        {error && (
          <div className="map-error-overlay">
            <div className="error-message">⚠️ {error}</div>
            <button className="retry-btn" onClick={fetchMarkers}>Повторить</button>
          </div>
        )}

        <div
          ref={mapContainer}
          className="map-container"
          style={{
            cursor: isCreatingStop ? 'crosshair' : isCreatingRoute ? 'pointer' : 'grab'
          }}
        />
      </div>

      {selectedModalMarker && !isCreatingRoute && !isCreatingStop && (
        <ModalContent
          marker={selectedModalMarker}
          isOpen={!!selectedModalMarker}
          onClose={() => setSelectedModalMarker(null)}
        />
      )}
    </div>
  );
};

export default MapComponent;