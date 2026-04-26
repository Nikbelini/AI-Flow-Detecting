// src/components/MapRegionSelector.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MapPin, Edit3, Check, X } from 'lucide-react';
import maplibregl from 'maplibre-gl';

interface MapRegionSelectorProps {
  onRegionSelected?: (bounds: maplibregl.LngLatBounds | null) => void;
  initialBounds?: maplibregl.LngLatBounds | null;
  map: maplibregl.Map | null;
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
}

const MapRegionSelector: React.FC<MapRegionSelectorProps> = ({
  onRegionSelected,
  initialBounds = null,
  map,
  enabled = false,
  onToggle
}) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<maplibregl.LngLat | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<maplibregl.LngLat | null>(null);
  const [activeRegion, setActiveRegion] = useState<maplibregl.LngLatBounds | null>(initialBounds);
  
  const sourceId = 'region-selector-rectangle';
  const layerId = 'region-selector-rectangle-fill';
  const outlineLayerId = 'region-selector-rectangle-outline';
  
  // Флаг для отслеживания готовности слоёв
  const layersReady = useRef(false);

  // Нормализация bounds (west всегда меньше east)
  const normalizeBounds = useCallback((bounds: maplibregl.LngLatBounds): maplibregl.LngLatBounds => {
    let west = bounds.getWest();
    let east = bounds.getEast();
    const south = bounds.getSouth();
    const north = bounds.getNorth();

    // Если west > east, значит пользователь тянул справа налево
    if (west > east) {
      const temp = west;
      west = east;
      east = temp;
    }

    return new maplibregl.LngLatBounds(
      new maplibregl.LngLat(west, south),
      new maplibregl.LngLat(east, north)
    );
  }, []);

  // Создаём и добавляем источник для рисования прямоугольника
  const updateRectangleSource = useCallback(() => {
    if (!map || !map.getSource || !map.getSource(sourceId)) return;

    if (selectionStart && selectionEnd) {
      const bounds = new maplibregl.LngLatBounds(selectionStart, selectionEnd);
      const normalizedBounds = normalizeBounds(bounds);
      
      const polygon: GeoJSON.Feature = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [normalizedBounds.getWest(), normalizedBounds.getNorth()],
            [normalizedBounds.getEast(), normalizedBounds.getNorth()],
            [normalizedBounds.getEast(), normalizedBounds.getSouth()],
            [normalizedBounds.getWest(), normalizedBounds.getSouth()],
            [normalizedBounds.getWest(), normalizedBounds.getNorth()]
          ]]
        },
        properties: {}
      };

      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(polygon);
    } else {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: []
      });
    }
  }, [map, selectionStart, selectionEnd, sourceId, normalizeBounds]);

  // Добавляем источник и слои при монтировании (только когда карта готова)
  const initLayers = useCallback(() => {
    if (!map || !map.getSource || layersReady.current) return;

    try {
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });
      }

      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#3b82f6',
            'fill-opacity': 0.2,
            'fill-outline-color': '#2563eb'
          }
        });
      }

      if (!map.getLayer(outlineLayerId)) {
        map.addLayer({
          id: outlineLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#3b82f6',
            'line-width': 3,
            'line-dasharray': [5, 5]
          }
        });
      }

      layersReady.current = true;
    } catch (error) {
      console.warn('Error initializing region selector layers:', error);
    }
  }, [map, sourceId, layerId, outlineLayerId]);

  // Инициализация при готовности карты
  useEffect(() => {
    if (!map) return;

    const onLoad = () => {
      initLayers();
    };

    if (map.loaded()) {
      onLoad();
    } else {
      map.on('load', onLoad);
      return () => {
        map.off('load', onLoad);
      };
    }
  }, [map, initLayers]);

  // Восстановление активной области при initialBounds
  useEffect(() => {
    if (activeRegion && map && layersReady.current) {
      const sw = activeRegion.getSouthWest();
      const ne = activeRegion.getNorthEast();
      setSelectionStart(sw);
      setSelectionEnd(ne);
      updateRectangleSource();
    }
  }, [activeRegion, map, updateRectangleSource]);

  const handleMouseDown = useCallback((e: maplibregl.MapMouseEvent) => {
    if (!enabled || !isSelecting) return;
    e.preventDefault();
    const start = e.lngLat;
    setSelectionStart(start);
    setSelectionEnd(start);
    updateRectangleSource();
  }, [enabled, isSelecting, updateRectangleSource]);

  const handleMouseMove = useCallback((e: maplibregl.MapMouseEvent) => {
    if (!enabled || !isSelecting || !selectionStart) return;
    e.preventDefault();
    const end = e.lngLat;
    setSelectionEnd(end);
    updateRectangleSource();
  }, [enabled, isSelecting, selectionStart, updateRectangleSource]);

  const handleMouseUp = useCallback(() => {
    if (!enabled || !isSelecting || !selectionStart || !selectionEnd) return;

    // Создаём bounds и нормализуем
    const bounds = new maplibregl.LngLatBounds(selectionStart, selectionEnd);
    const normalizedBounds = normalizeBounds(bounds);
    
    setActiveRegion(normalizedBounds);
    onRegionSelected?.(normalizedBounds);
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    updateRectangleSource();

    if (map) map.getCanvas().style.cursor = '';
  }, [enabled, isSelecting, selectionStart, selectionEnd, onRegionSelected, map, updateRectangleSource, normalizeBounds]);

  const startSelection = useCallback(() => {
    if (!enabled || !map) return;
    setIsSelecting(true);
    map.getCanvas().style.cursor = 'crosshair';
  }, [enabled, map]);

  const clearRegion = useCallback(() => {
    setActiveRegion(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    onRegionSelected?.(null);
    updateRectangleSource();
  }, [onRegionSelected, updateRectangleSource]);

  const toggleMode = useCallback(() => {
    const newEnabled = !enabled;
    onToggle?.(newEnabled);
    if (!newEnabled) {
      clearRegion();
      if (map) map.getCanvas().style.cursor = '';
    }
  }, [enabled, onToggle, clearRegion, map]);

  // Подписка на события карты (только когда enabled)
  useEffect(() => {
    if (!map || !enabled) return;

    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);

    return () => {
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
    };
  }, [map, enabled, handleMouseDown, handleMouseMove, handleMouseUp]);

  return (
    <div className="map-region-selector">
      <button
        className={`region-selector-btn ${enabled ? 'active' : ''}`}
        onClick={toggleMode}
        title={enabled ? 'Отключить выделение области' : 'Выделить область для моделирования'}
      >
        <MapPin size={16} />
        <span>Выделить область</span>
      </button>

      {enabled && !isSelecting && !activeRegion && (
        <button className="region-selector-start-btn" onClick={startSelection}>
          <Edit3 size={14} />
          Начать выделение
        </button>
      )}

      {enabled && activeRegion && (
        <div className="region-selector-info">
          <div className="region-info-text">
            <Check size={14} />
            <span>Область выделена</span>
          </div>
          <button className="region-clear-btn" onClick={clearRegion}>
            <X size={14} />
            Очистить
          </button>
        </div>
      )}

      {isSelecting && (
        <div className="region-selecting-hint">
          <span>🔍 Перетащите курсор, чтобы выделить область</span>
        </div>
      )}
    </div>
  );
};

export default MapRegionSelector;