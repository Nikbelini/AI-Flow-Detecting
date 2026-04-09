// src/pages/OptimalRoutePage/OptimalRoutePage.tsx
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './OptimalRoutePage.css';

import { useCities } from '../../hooks/api/useCities';
import { useStops } from '../../hooks/api/useStops';
import { formatCoordsHuman } from '../../utils/geo';
import { useOptimalRoute } from '../../hooks/api/useOptimalRoute';

import {
  Clock, MapPin, X, Building2,
  Loader2, Route, Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Select, Spin, Input, Badge, Tooltip } from 'antd';
import type { Stop } from '../../api/types';

const { Option } = Select;

// ===== УТИЛИТЫ =====
const isValidCoordinate = (lat: number, lng: number): boolean => {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
};

const toMapLibre = (lat: number, lng: number): [number, number] => [lng, lat];

const getLoadColor = (load: number): string => {
  if (load <= 3) return '#10b981';
  if (load <= 7) return '#f59e0b';
  return '#ef4444';
};

const getMarkerSize = (load: number): 'size-s' | 'size-m' | 'size-l' => {
  if (load <= 3) return 'size-s';
  if (load <= 7) return 'size-m';
  return 'size-l';
};

// ===== КОМПОНЕНТ =====
const OptimalRoutePage: React.FC = () => {
  // Рефы
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<Stop['id'], {
    marker: maplibregl.Marker;
    element: HTMLDivElement
  }>>(new Map());

  // Хуки
  const {
    cities, loading: citiesLoading, selectedCityId, selectedCity, selectCity
  } = useCities();

  const { getStopsByCity, loading: stopsLoading } = useStops();

  const {
    loading: routeLoading,
    error: routeError,
    result: routeResult,
    startStopId,
    goalStopId,
    setStartStop,
    setGoalStop,
    clearSelection,
    buildRoute,
    clearResult,
    isReadyToBuild,
  } = useOptimalRoute();

  // Состояния
  const [stops, setStops] = useState<Stop[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapInitializing, setMapInitializing] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [optimizationMode, setOptimizationMode] = useState<'FASTEST' | 'LESS_CROWDED' | 'MIN_TRANSFERS'>('FASTEST');
  const [searchQuery, setSearchQuery] = useState('');

  // ===== ЭФФЕКТЫ =====

  // Время
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Загрузка остановок
  useEffect(() => {
    if (!selectedCityId) return;
    const loadStops = async () => {
      try {
        const data = await getStopsByCity(selectedCityId);
        setStops(data);
        clearSelection();
        clearResult();
      } catch (err) {
        console.error('Failed to load stops:', err);
      }
    };
    loadStops();
  }, [selectedCityId, getStopsByCity, clearSelection, clearResult]);

  // Инициализация карты
  useEffect(() => {
    if (!mapContainer.current || !selectedCity) return;

    if (map.current) {
      map.current.flyTo({
        center: toMapLibre(selectedCity.lat, selectedCity.lng),
        zoom: 11,
        duration: 1500
      });
      return;
    }

    setMapInitializing(true);

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
            attribution: '© OpenStreetMap contributors'
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
      center: toMapLibre(selectedCity.lat, selectedCity.lng),
      zoom: 11,
      maxZoom: 18,
      minZoom: 9,
      pitch: 0,
      bearing: 0,
      fadeDuration: 0,
      localIdeographFontFamily: false,
    });

    map.current.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');
    map.current.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');
    map.current.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    }), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);
      setMapInitializing(false);
      map.current?.resize();
    });

    map.current.on('error', (e) => console.error('Map error:', e.error));

    map.current.on('click', (e: maplibregl.MapMouseEvent) => {
      const target = e.originalEvent.target as HTMLElement;
      if (target.closest('.custom-marker')) return;
    });

    const initTimeout = setTimeout(() => { map.current?.resize(); }, 200);

    return () => {
      clearTimeout(initTimeout);
      if (map.current) {
        markersRef.current.forEach(({ marker, element }) => {
          if ((element as any)._clickHandler) {
            element.removeEventListener('click', (element as any)._clickHandler);
            delete (element as any)._clickHandler;
          }
          marker.remove();
        });
        markersRef.current.clear();
        map.current.remove();
        map.current = null;
      }
      setMapLoaded(false);
      setMapInitializing(true);
    };
  }, [selectedCity]);

  // 🔥 Отрисовка маркеров — ИСПРАВЛЕНА: не пересоздаёт, только обновляет стиль
  useEffect(() => {
    if (!map.current || !mapLoaded || mapInitializing) return;

    // 1. Обновляем стиль существующих маркеров
    markersRef.current.forEach((value, stopId) => {
      const stop = stops.find(s => s.id === stopId);
      if (!stop) return;
      const isStart = stop.id === startStopId;
      const isGoal = stop.id === goalStopId;
      updateMarkerElement(value.element, stop, isStart, isGoal);
    });

    // 2. Создаём новые маркеры только для новых остановок
    stops.forEach(stop => {
      if (!isValidCoordinate(stop.lat, stop.lng)) return;
      if (markersRef.current.has(stop.id)) return; // ✅ Уже есть — пропускаем!

      const isStart = stop.id === startStopId;
      const isGoal = stop.id === goalStopId;
      const el = createMarkerElement(stop, isStart, isGoal);

      const clickHandler = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!startStopId) {
          setStartStop(stop.id);
          clearResult();
        } else if (!goalStopId) {
          setGoalStop(stop.id);
        } else {
          setStartStop(stop.id);
          setGoalStop(null);
          clearResult();
        }
      };

      el.addEventListener('click', clickHandler);
      (el as any)._clickHandler = clickHandler;
      el.setAttribute('data-stop-id', String(stop.id));

      const markerInstance = new maplibregl.Marker({
        element: el,
        anchor: 'center',
        clickTolerance: 10
      })
        .setLngLat(toMapLibre(stop.lat, stop.lng))
        .addTo(map.current!);

      markersRef.current.set(stop.id, { marker: markerInstance, element: el });
    });

    // 3. Удаляем маркеры для остановок, которых нет в списке
    markersRef.current.forEach((value, stopId) => {
      if (!stops.find(s => s.id === stopId)) {
        const { marker, element } = value;
        if ((element as any)._clickHandler) {
          element.removeEventListener('click', (element as any)._clickHandler);
          delete (element as any)._clickHandler;
        }
        marker.remove();
        markersRef.current.delete(stopId);
      }
    });
  }, [stops, startStopId, goalStopId, mapLoaded, mapInitializing]);

  // 🔥 Отрисовка маршрута — ИСПРАВЛЕНА: конвертация ID + отладка
  useEffect(() => {
    if (!map.current || !mapLoaded || !routeResult) return;
    // Небольшая задержка, чтобы stops точно обновился
    setTimeout(() => drawOptimalRoute(), 50);
  }, [routeResult, mapLoaded, stops]);

  const drawOptimalRoute = useCallback(() => {
    if (!map.current || !routeResult) return;

    // 🔍 Детальная отладка
    console.log('🗺️ Route debug:', {
      segmentsCount: routeResult.segments?.length,
      firstSeg: routeResult.segments?.[0],
      stopsCount: stops.length,
      firstStop: stops[0]?.id,
      expectedStart: routeResult.response.stops?.[0],
      expectedGoal: routeResult.response.stops?.[1],
    });

    // Удаляем старые слои
    ['optimal-route-line', 'optimal-route-points'].forEach(id => {
      if (map.current?.getLayer(id)) map.current.removeLayer(id);
      if (map.current?.getSource(id)) map.current.removeSource(id);
    });

    if (!routeResult.segments || routeResult.segments.length === 0) {
      console.warn('⚠️ No segments');
      return;
    }

    const lineCoords: [number, number][] = [];
    const pointFeatures: any[] = [];
    let foundCount = 0;
    let missingCount = 0;

    routeResult.segments.forEach((seg, idx) => {
      // 🔥 Конвертируем ID в number (бэкенд может слать string!)
      const fromStopId = Number(seg.from_stop ?? seg.fromStop);
      const toStopId = Number(seg.to_stop ?? seg.toStop);

      if (!fromStopId || !toStopId) {
        console.warn('⚠️ Invalid segment IDs:', seg);
        return;
      }

      // 🔍 Ищем остановки с конвертацией
      const fromStop = stops.find(s => Number(s.id) === fromStopId);
      const toStop = stops.find(s => Number(s.id) === toStopId);

      if (!fromStop) {
        console.warn(`⚠️ Stop not found: from_stop=${fromStopId}`);
        missingCount++;
      } else {
        foundCount++;
      }
      if (!toStop) {
        console.warn(`⚠️ Stop not found: to_stop=${toStopId}`);
        missingCount++;
      } else {
        foundCount++;
      }

      if (fromStop && isValidCoordinate(fromStop.lat, fromStop.lng)) {
        lineCoords.push(toMapLibre(fromStop.lat, fromStop.lng));
        if (idx === 0) {
          pointFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: toMapLibre(fromStop.lat, fromStop.lng) },
            properties: { type: 'start', label: 'Старт' }
          });
        }
      }
      if (toStop && isValidCoordinate(toStop.lat, toStop.lng)) {
        if (idx === routeResult.segments.length - 1) {
          pointFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: toMapLibre(toStop.lat, toStop.lng) },
            properties: { type: 'end', label: 'Финиш' }
          });
        }
        lineCoords.push(toMapLibre(toStop.lat, toStop.lng));
      }
    });

    console.log('📍 Coords:', { count: lineCoords.length, found: foundCount, missing: missingCount });

    if (lineCoords.length < 2) {
      console.error('❌ Not enough coords. Check if stop IDs match!');
      return;
    }

    try {
      // Линия
      if (map.current.getSource('optimal-route-line')) {
        (map.current.getSource('optimal-route-line') as any).setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: lineCoords },
          properties: {}
        });
      } else {
        map.current.addSource('optimal-route-line', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: lineCoords },
            properties: {}
          } as any
        });
        map.current.addLayer({
          id: 'optimal-route-line',
          type: 'line',
          source: 'optimal-route-line',
          paint: {
            'line-color': '#10b981',
            'line-width': 5,
            'line-opacity': 0.95,
          }
        });
      }

      // Точки
      if (pointFeatures.length > 0) {
        if (map.current.getSource('optimal-route-points')) {
          (map.current.getSource('optimal-route-points') as any).setData({
            type: 'FeatureCollection',
            features: pointFeatures
          });
        } else {
          map.current.addSource('optimal-route-points', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: pointFeatures } as any
          });
          map.current.addLayer({
            id: 'optimal-route-points',
            type: 'circle',
            source: 'optimal-route-points',
            paint: {
              'circle-radius': 9,
              'circle-color': ['match', ['get', 'type'], 'start', '#3b82f6', 'end', '#ef4444', '#6b7280'],
              'circle-stroke-width': 3,
              'circle-stroke-color': '#ffffff'
            }
          });
        }
      }

      // Фитим
      const bounds = new maplibregl.LngLatBounds();
      lineCoords.forEach(c => bounds.extend(c));
      map.current.fitBounds(bounds, { padding: 80, duration: 1200, maxZoom: 14 });

      console.log('✅ Route drawn!');
    } catch (err) {
      console.error('❌ Draw error:', err);
    }
  }, [routeResult, stops]);

  // Ресайз
  useEffect(() => {
    const handleResize = () => {
      if (map.current && mapLoaded) {
        requestAnimationFrame(() => {
          map.current?.resize();
          map.current?.triggerRepaint();
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarCollapsed, mapLoaded]);

  // ===== ФУНКЦИИ МАРКЕРОВ =====
  const updateMarkerElement = (el: HTMLDivElement, stop: Stop, isStart: boolean, isGoal: boolean) => {
    const sizeClass = getMarkerSize(stop.load);
    const color = isGoal ? '#ef4444' : isStart ? '#3b82f6' : getLoadColor(stop.load);

    el.className = `custom-marker ${sizeClass}${isStart || isGoal ? ` ${isStart ? 'is-start' : 'is-goal'}` : ''}`;
    el.style.backgroundColor = color;
    el.style.borderColor = 'white';
    el.style.boxShadow = isStart || isGoal
      ? `0 0 0 3px ${isStart ? 'rgba(59, 130, 246, 0.5)' : 'rgba(239, 68, 68, 0.5)'}, 0 6px 20px rgba(0,0,0,0.3)`
      : '0 4px 12px rgba(0,0,0,0.25)';
    el.style.zIndex = isStart || isGoal ? '210' : '100';

    const text = el.querySelector('.marker-text') as HTMLElement;
    if (text) {
      text.textContent = isGoal ? 'Б' : isStart ? 'А' : (stop.load?.toString() || '0');
    }
    el.setAttribute('title', `${stop.address}\n${isStart ? '🚦 Старт' : isGoal ? '🏁 Финиш' : `Загрузка: ${stop.load}/10`}`);
  };

  const createMarkerElement = (stop: Stop, isStart: boolean, isGoal: boolean): HTMLDivElement => {
    const el = document.createElement('div');
    const sizeClass = getMarkerSize(stop.load);
    const color = isGoal ? '#ef4444' : isStart ? '#3b82f6' : getLoadColor(stop.load);

    el.className = `custom-marker ${sizeClass}${isStart || isGoal ? ` ${isStart ? 'is-start' : 'is-goal'}` : ''}`;
    Object.assign(el.style, {
      backgroundColor: color,
      border: '3px solid white',
      boxShadow: isStart || isGoal
        ? `0 0 0 3px ${isStart ? 'rgba(59, 130, 246, 0.5)' : 'rgba(239, 68, 68, 0.5)'}, 0 6px 20px rgba(0,0,0,0.3)`
        : '0 4px 12px rgba(0,0,0,0.25)',
      cursor: 'pointer',
      zIndex: isStart || isGoal ? '210' : '100',
    });

    const text = document.createElement('div');
    text.className = 'marker-text';
    text.textContent = isGoal ? 'Б' : isStart ? 'А' : (stop.load?.toString() || '0');
    Object.assign(text.style, {
      color: 'white',
      fontWeight: '700',
      fontSize: sizeClass === 'size-l' ? '14px' : '12px',
      textShadow: '0 1px 3px rgba(0,0,0,0.4)',
      pointerEvents: 'none',
    });

    el.appendChild(text);
    el.setAttribute('title', `${stop.address}\n${isStart ? '🚦 Старт' : isGoal ? '🏁 Финиш' : `Загрузка: ${stop.load}/10`}`);
    el.setAttribute('data-stop-id', String(stop.id));
    return el;
  };

  const formatTime = (date: Date) => date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  const filteredStops = useMemo(() => {
    if (!searchQuery.trim()) return stops;
    const query = searchQuery.toLowerCase();
    return stops.filter(s =>
      s.address.toLowerCase().includes(query) || s.url?.toLowerCase().includes(query)
    );
  }, [stops, searchQuery]);

  const handleBuildRoute = async () => {
    if (!selectedCityId || !isReadyToBuild) return;
    await buildRoute(selectedCityId, optimizationMode, stops);
  };

  // ===== РЕНДЕР =====
  return (
    <div className="optimal-route-page">
      {/* HEADER */}
      <header className="page-header">
        <h1><Route size={22} /> Построение маршрута</h1>
        <div className="header-controls">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b' }}>
            <Clock size={16} /><span style={{ fontSize: 14 }}>{formatTime(currentTime)}</span>
          </div>
          <div className="city-select-wrapper">
            {citiesLoading ? <Spin size="small" /> : (
              <Select value={selectedCityId || undefined} onChange={selectCity} style={{ width: 220 }} placeholder="Город" showSearch optionFilterProp="label">
                {cities.map(city => (
                  <Option key={city.id} value={city.id} label={city.name}>
                    <Tooltip title={formatCoordsHuman(city.lat, city.lng)}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Building2 size={14} style={{ color: '#666' }} />{city.name}
                      </span>
                    </Tooltip>
                  </Option>
                ))}
              </Select>
            )}
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <div className="page-content">
        {/* SIDEBAR */}
        <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-header">
            {!isSidebarCollapsed && <h3>⚙️ Настройки</h3>}
            <button className="toggle-sidebar-btn" onClick={() => setIsSidebarCollapsed(p => !p)} title={isSidebarCollapsed ? 'Развернуть' : 'Свернуть'}>
              {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {!isSidebarCollapsed && (
            <div className="sidebar-content">
              {/* Режим */}
              <div className="mode-selector">
                <label>Режим:</label>
                <div className="mode-buttons">
                  {(['FASTEST', 'LESS_CROWDED', 'MIN_TRANSFERS'] as const).map(mode => (
                    <button key={mode} className={`mode-btn ${optimizationMode === mode ? 'active' : ''}`} onClick={() => setOptimizationMode(mode)} disabled={routeLoading}>
                      <span className="icon">{mode === 'FASTEST' ? '⚡' : mode === 'LESS_CROWDED' ? '👥' : '🔀'}</span>
                      <span>{mode === 'FASTEST' ? 'Быстрый' : mode === 'LESS_CROWDED' ? 'Свободный' : 'Мин. пересадок'}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Точки маршрута */}
              <div className="route-points-section">
                <h4>📍 Маршрут</h4>

                {/* ОТКУДА */}
                <div className={`point-card ${startStopId ? 'selected' : ''}`} onClick={() => setGoalStop(null)}>
                  <div className="point-header">
                    <MapPin size={18} color="#3b82f6" /><strong>Откуда</strong>
                    {startStopId && <button className="clear-point-btn" onClick={(e) => { e.stopPropagation(); setStartStop(null); }}><X size={14} /></button>}
                  </div>
                  {startStopId ? (
                    <div className="point-address">{stops.find(s => s.id === startStopId)?.address}</div>
                  ) : <small className="point-hint">Кликните на маркер</small>}
                </div>

                <div style={{ textAlign: 'center', color: '#94a3b8', margin: '8px 0' }}>↓</div>

                {/* КУДА */}
                <div className={`point-card ${goalStopId ? 'selected goal' : ''}`} onClick={() => setStartStop(null)}>
                  <div className="point-header">
                    <MapPin size={18} color="#ef4444" /><strong>Куда</strong>
                    {goalStopId && <button className="clear-point-btn" onClick={(e) => { e.stopPropagation(); setGoalStop(null); }}><X size={14} /></button>}
                  </div>
                  {goalStopId ? (
                    <div className="point-address">{stops.find(s => s.id === goalStopId)?.address}</div>
                  ) : <small className="point-hint">Кликните на маркер</small>}
                </div>

                {/* Кнопка */}
                <button className="build-btn" onClick={handleBuildRoute} disabled={!isReadyToBuild || routeLoading}>
                  {routeLoading ? <><Loader2 size={18} className="loader" /> Построение...</> : <><Route size={18} /> Построить маршрут</>}
                </button>

                {/* Ошибка */}
                {routeError && <div className="map-error" style={{ position: 'relative', maxWidth: '100%' }}>⚠️ {routeError}<button className="close-result-btn" style={{ position: 'absolute', right: 8, top: 8 }} onClick={() => { }}><X size={14} /></button></div>}

                {/* Результат */}
                {routeResult && (
                  <div className="result-panel">
                    <div className="result-panel-header">
                      <h4>✅ Маршрут построен</h4>
                      <button className="close-result-btn" onClick={clearResult}><X size={16} /></button>
                    </div>
                    <div className="result-stats">
                      <div className="result-stat"><span className="label">Время</span><span className="value">{routeResult.totalCostMinutes} мин</span></div>
                      <div className="result-stat"><span className="label">Режим</span><span className="value">{routeResult.mode}</span></div>
                      <div className="result-stat"><span className="label">Сегментов</span><span className="value">{routeResult.segments.length}</span></div>
                    </div>
                    <div className="route-summary">
                      <span className="point"><MapPin size={14} color="#3b82f6" /> {routeResult.startStop?.address}</span>
                      <span className="arrow">→</span>
                      <span className="point"><MapPin size={14} color="#ef4444" /> {routeResult.goalStop?.address}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Список остановок */}
              <div className="stops-list-section">
                <h4>📍 Остановки ({stops.length})</h4>
                <Input className="stops-search" placeholder="Поиск..." prefix={<Search size={14} style={{ color: '#94a3b8' }} />} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} allowClear size="small" />
                <div className="stops-list">
                  {stopsLoading ? <div style={{ textAlign: 'center', padding: 20 }}><Spin size="small" /></div> : filteredStops.length === 0 ? (
                    <div className="empty-state"><MapPin size={32} className="icon" /><p>Не найдено</p><small>{searchQuery ? 'Другой запрос' : 'Другой город'}</small></div>
                  ) : filteredStops.map(stop => {
                    const isStart = stop.id === startStopId;
                    const isGoal = stop.id === goalStopId;
                    const loadLabel = stop.load <= 3 ? 'low' : stop.load <= 7 ? 'medium' : 'high';
                    return (
                      <div key={stop.id} className={`stop-item ${isStart ? 'is-start' : isGoal ? 'is-goal' : ''}`} onClick={() => { if (!startStopId) setStartStop(stop.id); else if (!goalStopId) setGoalStop(stop.id); else { setStartStop(stop.id); setGoalStop(null); clearResult(); } }}>
                        {(isStart || isGoal) && <div className={`stop-indicator ${isStart ? 'start' : 'goal'}`}>{isStart ? 'А' : 'Б'}</div>}
                        <div className="stop-info">
                          <div className="stop-address" title={stop.address}>{stop.address}</div>
                          <div className="stop-meta">
                            <Badge className={`load-badge ${loadLabel}`} text={`${stop.load}/10`} />
                            <span className="stop-coords">{stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* MAP */}
        <main className="map-area">
          {(mapInitializing || stopsLoading || citiesLoading) && !mapLoaded && <div className="map-overlay"><Spin size="large" /></div>}
          {routeError && <div className="map-error">⚠️ {routeError}</div>}
          <div ref={mapContainer} className="map-container" style={{ opacity: mapInitializing ? 0.5 : 1, transition: 'opacity 0.3s ease' }} />
        </main>
      </div>
    </div>
  );
};

export default React.memo(OptimalRoutePage);