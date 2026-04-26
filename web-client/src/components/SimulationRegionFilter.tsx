// src/components/SimulationRegionFilter.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Filter, MapPin, X, Check, AlertCircle } from 'lucide-react';
import maplibregl from 'maplibre-gl';

interface SimulationRegionFilterProps {
  bounds: maplibregl.LngLatBounds | null;
  stops: Array<{ id: number; lat: number; lng: number; address?: string }>;
  routes: Array<{ id: number; path: [number, number][]; stops: number[] }>;
  onFilterChange: (filteredStopIds: Set<number>, filteredRouteIds: Set<number>) => void;
  className?: string;
}

export const SimulationRegionFilter: React.FC<SimulationRegionFilterProps> = ({
  bounds,
  stops,
  routes,
  onFilterChange,
  className = ''
}) => {
  const [filteredStopIds, setFilteredStopIds] = useState<Set<number>>(new Set());
  const [filteredRouteIds, setFilteredRouteIds] = useState<Set<number>>(new Set());
  const [isActive, setIsActive] = useState(false);

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

  // Функция для проверки, находится ли точка в области
  const isPointInBounds = useCallback((lng: number, lat: number, bounds: maplibregl.LngLatBounds): boolean => {
    // Нормализуем bounds на всякий случай
    const west = Math.min(bounds.getWest(), bounds.getEast());
    const east = Math.max(bounds.getWest(), bounds.getEast());
    const south = bounds.getSouth();
    const north = bounds.getNorth();

    return lng >= west && lng <= east && lat >= south && lat <= north;
  }, []);

  // Функция для проверки, пересекает ли линия область
  const isLineIntersectingBounds = useCallback((
    path: [number, number][],
    bounds: maplibregl.LngLatBounds
  ): boolean => {
    if (!path || path.length === 0) return false;

    const west = Math.min(bounds.getWest(), bounds.getEast());
    const east = Math.max(bounds.getWest(), bounds.getEast());
    const south = bounds.getSouth();
    const north = bounds.getNorth();

    // Проверяем любую точку маршрута
    for (const [lng, lat] of path) {
      if (lng >= west && lng <= east && lat >= south && lat <= north) return true;
    }

    // Проверяем пересечения с границами прямоугольника
    const edges: [[number, number], [number, number]][] = [
      [[west, south], [east, south]],
      [[east, south], [east, north]],
      [[east, north], [west, north]],
      [[west, north], [west, south]]
    ];

    const doSegmentsIntersect = (
      x1: number, y1: number,
      x2: number, y2: number,
      x3: number, y3: number,
      x4: number, y4: number
    ): boolean => {
      const orient = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
        return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      };

      const o1 = orient(x1, y1, x2, y2, x3, y3);
      const o2 = orient(x1, y1, x2, y2, x4, y4);
      const o3 = orient(x3, y3, x4, y4, x1, y1);
      const o4 = orient(x3, y3, x4, y4, x2, y2);

      if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) {
        const minX1 = Math.min(x1, x2);
        const maxX1 = Math.max(x1, x2);
        const minY1 = Math.min(y1, y2);
        const maxY1 = Math.max(y1, y2);
        const minX2 = Math.min(x3, x4);
        const maxX2 = Math.max(x3, x4);
        const minY2 = Math.min(y3, y4);
        const maxY2 = Math.max(y3, y4);
        
        return (minX1 <= maxX2 && maxX1 >= minX2 && minY1 <= maxY2 && maxY1 >= minY2);
      }

      return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
    };

    for (let i = 0; i < path.length - 1; i++) {
      const [x1, y1] = path[i];
      const [x2, y2] = path[i + 1];

      for (const edge of edges) {
        const [ex1, ey1] = edge[0];
        const [ex2, ey2] = edge[1];

        if (doSegmentsIntersect(x1, y1, x2, y2, ex1, ey1, ex2, ey2)) {
          return true;
        }
      }
    }

    return false;
  }, []);

  // Применение фильтрации
  const applyFilter = useCallback(() => {
    if (!bounds) {
      setFilteredStopIds(new Set());
      setFilteredRouteIds(new Set());
      onFilterChange(new Set(), new Set());
      setIsActive(false);
      return;
    }

    // Нормализуем bounds
    const normalizedBounds = normalizeBounds(bounds);
    const west = Math.min(normalizedBounds.getWest(), normalizedBounds.getEast());
    const east = Math.max(normalizedBounds.getWest(), normalizedBounds.getEast());
    const south = normalizedBounds.getSouth();
    const north = normalizedBounds.getNorth();

    console.log(`🔍 Фильтрация области (нормализовано): west=${west}, east=${east}, south=${south}, north=${north}`);
    console.log(`📊 Всего остановок: ${stops.length}`);

    const newStopIds = new Set<number>();
    const newRouteIds = new Set<number>();

    // Фильтруем остановки
    for (const stop of stops) {
      // Убеждаемся, что координаты - числа
      const lng = typeof stop.lng === 'number' ? stop.lng : parseFloat(stop.lng as any);
      const lat = typeof stop.lat === 'number' ? stop.lat : parseFloat(stop.lat as any);
      
      if (isPointInBounds(lng, lat, normalizedBounds)) {
        newStopIds.add(stop.id);
        console.log(`✅ Остановка ${stop.id} (${stop.address}) - (${lng}, ${lat}) попала в область`);
      }
    }

    console.log(`📊 Найдено остановок в области: ${newStopIds.size}`);

    // Фильтруем маршруты
    for (const route of routes) {
      let hasStopInBounds = false;
      for (const stopId of route.stops) {
        if (newStopIds.has(stopId)) {
          hasStopInBounds = true;
          break;
        }
      }

      if (!hasStopInBounds && route.path && route.path.length > 0) {
        if (isLineIntersectingBounds(route.path, normalizedBounds)) {
          hasStopInBounds = true;
        }
      }

      if (hasStopInBounds) {
        newRouteIds.add(route.id);
      }
    }

    setFilteredStopIds(newStopIds);
    setFilteredRouteIds(newRouteIds);
    onFilterChange(newStopIds, newRouteIds);
    setIsActive(newStopIds.size > 0);
  }, [bounds, stops, routes, onFilterChange, isPointInBounds, isLineIntersectingBounds, normalizeBounds]);

  useEffect(() => {
    applyFilter();
  }, [applyFilter]);

  const clearFilter = useCallback(() => {
    setFilteredStopIds(new Set());
    setFilteredRouteIds(new Set());
    onFilterChange(new Set(), new Set());
    setIsActive(false);
  }, [onFilterChange]);

  if (!bounds) return null;

  return (
    <div className={`simulation-region-filter ${className}`}>
      <div className="filter-header">
        <Filter size={16} />
        <span>Фильтр области моделирования</span>
        <button className="filter-clear-btn" onClick={clearFilter}>
          <X size={14} />
        </button>
      </div>

      <div className="filter-stats">
        <div className="stat-item">
          <MapPin size={14} />
          <span>Остановок: {filteredStopIds.size}</span>
        </div>
        <div className="stat-item">
          <span>🚌 Маршрутов: {filteredRouteIds.size}</span>
        </div>
      </div>

      {filteredStopIds.size === 0 ? (
        <div className="filter-warning">
          <AlertCircle size={14} />
          <span>В выбранной области нет остановок. Моделирование будет пустым.</span>
        </div>
      ) : (
        <div className="filter-success">
          <Check size={14} />
          <span>Будут смоделированы только выбранные остановки и маршруты</span>
        </div>
      )}
    </div>
  );
};

export default SimulationRegionFilter;