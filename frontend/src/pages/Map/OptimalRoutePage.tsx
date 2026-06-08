import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./OptimalRoutePage.css";

import { useCities } from "../../hooks/api/useCities";
import { useStops } from "../../hooks/api/useStops";
import { formatCoordsHuman } from "../../utils/geo";
import { useOptimalRoute } from "../../hooks/api/useOptimalRoute";

import {
  Clock,
  MapPin,
  X,
  Building2,
  Loader2,
  Route,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Check,
  Sparkles,
  Zap,
  Users,
  ArrowRightLeft,
  Navigation,
  Timer,
  Moon,
} from "lucide-react";

import { Select, Spin, Input, Badge, Tooltip, DatePicker } from "antd";
import type { Stop } from "../../api/types";
import dayjs from "dayjs";

const { Option } = Select;

// ====================== UTILS ======================
const isValidCoordinate = (lat: number, lng: number): boolean => {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
};

const toMapLibre = (lat: number, lng: number): [number, number] => [lng, lat];

const getLoadColor = (load: number): string => {
  if (load <= 3) return "#10b981";
  if (load <= 7) return "#f59e0b";
  return "#ef4444";
};

const getMarkerSize = (load: number): "size-s" | "size-m" | "size-l" => {
  if (load <= 3) return "size-s";
  if (load <= 7) return "size-m";
  return "size-l";
};

const ROUTE_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ec4899",
  "#06b6d4", "#8b5cf6", "#ef4444", "#84cc16",
];

type MarkerHTMLElement = HTMLDivElement & {
  _clickHandler?: (e: MouseEvent) => void;
};

type MarkerEntry = {
  marker: maplibregl.Marker;
  element: MarkerHTMLElement;
};

// ====================== GEOJSON TYPES ======================
type GeoJSONLineFeature = {
  type: "Feature";
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: {
    routeId: number; routeName: string; routeNumber: string;
    label: string; color: string;
  };
};

type GeoJSONPointFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { type: "start" | "end" };
};

type GeoJSONFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJSONPointFeature[];
};

// ====================== COMPONENT ======================
const OptimalRoutePage: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<Stop["id"], MarkerEntry>>(new Map());

  const mapLoadedRef = useRef(false);
  const mapInitializingRef = useRef(true);

  const {
    cities, loading: citiesLoading, selectedCityId,
    selectedCity, selectCity,
  } = useCities();

  const { getStopsByCity, loading: stopsLoading } = useStops();

  const {
    loading: routeLoading, error: routeError, result: routeResult,
    startStopId, goalStopId, selectedAlternativeIndex, activeSegments,
    setStartStop, setGoalStop, selectAlternative,
    clearSelection, buildRoute, clearResult, isReadyToBuild,
  } = useOptimalRoute();

  const [stops, setStops] = useState<Stop[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [optimizationMode, setOptimizationMode] = useState<
    "FASTEST" | "LESS_CROWDED" | "MIN_TRANSFERS"
  >("FASTEST");
  const [searchQuery, setSearchQuery] = useState("");
  const [scheduledTime, setScheduledTime] = useState<dayjs.Dayjs | null>(null);
  const [showScheduler, setShowScheduler] = useState(false);

  const [selectMode, setSelectMode] = useState<"START" | "GOAL">("START");
  const selectModeRef = useRef<"START" | "GOAL">("START");

  const setSelectModeSafe = useCallback((mode: "START" | "GOAL") => {
    selectModeRef.current = mode;
    setSelectMode(mode);
  }, []);

  // ====================== TIME ======================
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  // ====================== LOAD STOPS ======================
  useEffect(() => {
    if (!selectedCityId) return;
    const loadStops = async () => {
      try {
        const data = await getStopsByCity(selectedCityId);
        setStops(data);
        clearSelection();
        clearResult();
        setSelectModeSafe("START");
      } catch (err) {
        console.error("Failed to load stops:", err);
      }
    };
    loadStops();
  }, [selectedCityId, getStopsByCity, clearSelection, clearResult, setSelectModeSafe]);

  // ====================== MAP INIT ======================
  useEffect(() => {
    if (!mapContainer.current || !selectedCity) return;
    if (map.current) {
      map.current.flyTo({
        center: toMapLibre(selectedCity.lat, selectedCity.lng),
        zoom: 11, duration: 1200,
      });
      return;
    }

    mapInitializingRef.current = true;
    const newMap = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          "osm-raster-tiles": {
            type: "raster",
            tiles: [
              "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{
          id: "osm-tiles", type: "raster",
          source: "osm-raster-tiles", minzoom: 0, maxzoom: 22,
        }],
      },
      center: toMapLibre(selectedCity.lat, selectedCity.lng),
      zoom: 11, maxZoom: 18, minZoom: 9,
      pitch: 0, bearing: 0, fadeDuration: 0,
    });

    map.current = newMap;
    newMap.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");
    newMap.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");
    newMap.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true }, trackUserLocation: true,
    }), "top-right");

    newMap.on("load", () => {
      mapLoadedRef.current = true;
      mapInitializingRef.current = false;
      newMap.resize();
    });
    newMap.on("error", (e) => console.error("Map error:", e.error));

    return () => {
      markersRef.current.forEach(({ marker, element }) => {
        if (element._clickHandler) element.removeEventListener("click", element._clickHandler);
        marker.remove();
      });
      markersRef.current.clear();
      newMap.remove();
      map.current = null;
      mapLoadedRef.current = false;
      mapInitializingRef.current = true;
    };
  }, [selectedCity]);

  // ====================== MARKER ELEMENT ======================
  const createMarkerElement = useCallback(
    (stop: Stop, isStart: boolean, isGoal: boolean): MarkerHTMLElement => {
      const root = document.createElement("div") as MarkerHTMLElement;
      root.className = "custom-marker-root";
      const inner = document.createElement("div");
      const sizeClass = getMarkerSize(stop.load);
      const color = isGoal ? "#ef4444" : isStart ? "#6366f1" : getLoadColor(stop.load);
      inner.className = `custom-marker-inner ${sizeClass}${isStart ? " is-start" : ""}${isGoal ? " is-goal" : ""}`;
      inner.style.backgroundColor = color;
      const text = document.createElement("div");
      text.className = "marker-text";
      text.textContent = isGoal ? "Б" : isStart ? "А" : String(stop.load ?? 0);
      inner.appendChild(text);
      root.appendChild(inner);
      root.setAttribute("title", `${stop.address}\n${isStart ? "🚦 Старт" : isGoal ? "🏁 Финиш" : `Загрузка: ${stop.load}/10`}`);
      return root;
    }, []
  );

  const updateMarkerElement = useCallback(
    (root: MarkerHTMLElement, stop: Stop, isStart: boolean, isGoal: boolean) => {
      const inner = root.querySelector(".custom-marker-inner") as HTMLDivElement;
      if (!inner) return;
      const sizeClass = getMarkerSize(stop.load);
      const color = isGoal ? "#ef4444" : isStart ? "#6366f1" : getLoadColor(stop.load);
      inner.className = `custom-marker-inner ${sizeClass}${isStart ? " is-start" : ""}${isGoal ? " is-goal" : ""}`;
      inner.style.backgroundColor = color;
      const text = inner.querySelector(".marker-text") as HTMLElement;
      if (text) {
        const newText = isGoal ? "Б" : isStart ? "А" : String(stop.load ?? 0);
        if (text.textContent !== newText) text.textContent = newText;
      }
      const newTitle = `${stop.address}\n${isStart ? "🚦 Старт" : isGoal ? "🏁 Финиш" : `Загрузка: ${stop.load}/10`}`;
      if (root.getAttribute("title") !== newTitle) root.setAttribute("title", newTitle);
    }, []
  );

  // ====================== CLICK HANDLER ======================
  const handleMarkerClick = useCallback(
    (e: MouseEvent, stopId: Stop["id"]) => {
      e.preventDefault();
      e.stopPropagation();
      const mode = selectModeRef.current;
      if (mode === "START") {
        setStartStop(stopId);
        if (goalStopId === stopId) setGoalStop(null);
        clearResult();
        setSelectModeSafe("GOAL");
        return;
      }
      if (mode === "GOAL") {
        setGoalStop(stopId);
        if (startStopId === stopId) setStartStop(null);
        clearResult();
      }
    },
    [goalStopId, startStopId, setStartStop, setGoalStop, clearResult, setSelectModeSafe]
  );

  // ====================== ROUTE STOP IDS ======================
  const routeStopIds = useMemo<Set<number>>(() => {
    if (!activeSegments || activeSegments.length === 0) return new Set<number>();
    const ids = new Set<number>();
    for (const seg of activeSegments) {
      ids.add(seg.from_stop);
      ids.add(seg.to_stop);
    }
    return ids;
  }, [activeSegments]);

  // ====================== MARKERS RENDER ======================
  useEffect(() => {
    if (!map.current || !mapLoadedRef.current || mapInitializingRef.current) return;

    markersRef.current.forEach((value, stopId) => {
      const stop = stops.find((s) => s.id === stopId);
      if (!stop) return;
      const isStart = stop.id === startStopId;
      const isGoal = stop.id === goalStopId;
      updateMarkerElement(value.element, stop, isStart, isGoal);
      if (routeResult && activeSegments.length > 0) {
        value.element.style.display = routeStopIds.has(stopId) ? "" : "none";
      } else {
        value.element.style.display = "";
      }
    });

    for (const stop of stops) {
      if (!isValidCoordinate(stop.lat, stop.lng)) continue;
      if (markersRef.current.has(stop.id)) continue;
      const isStart = stop.id === startStopId;
      const isGoal = stop.id === goalStopId;
      const el = createMarkerElement(stop, isStart, isGoal);
      if (routeResult && activeSegments.length > 0 && !routeStopIds.has(stop.id)) {
        el.style.display = "none";
      }
      const handler = (e: MouseEvent) => handleMarkerClick(e, stop.id);
      el.addEventListener("click", handler);
      el._clickHandler = handler;
      const markerInstance = new maplibregl.Marker({
        element: el, anchor: "center", clickTolerance: 10,
      }).setLngLat(toMapLibre(stop.lat, stop.lng)).addTo(map.current);
      markersRef.current.set(stop.id, { marker: markerInstance, element: el });
    }

    markersRef.current.forEach((value, stopId) => {
      if (!stops.find((s) => s.id === stopId)) {
        if (value.element._clickHandler) {
          value.element.removeEventListener("click", value.element._clickHandler);
        }
        value.marker.remove();
        markersRef.current.delete(stopId);
      }
    });
  }, [
    stops, startStopId, goalStopId, routeResult, activeSegments, routeStopIds,
    createMarkerElement, updateMarkerElement, handleMarkerClick,
  ]);

  // ====================== CLEAN ROUTE LAYERS ======================
  const cleanRouteLayers = useCallback(() => {
    if (!map.current) return;
    const style = map.current.getStyle();
    if (!style) return;
    const layers = style.layers ?? [];
    for (const layer of layers) {
      if (layer.id.startsWith("route-segment-") || layer.id === "optimal-route-points" || layer.id.endsWith("-hitbox")) {
        if (map.current.getLayer(layer.id)) map.current.removeLayer(layer.id);
      }
    }
    const sources = style.sources ?? {};
    for (const id of Object.keys(sources)) {
      if (id.startsWith("route-segment-") || id === "optimal-route-points") {
        if (map.current.getSource(id)) map.current.removeSource(id);
      }
    }
    const popup = (map.current as unknown as { _routePopup?: maplibregl.Popup })._routePopup;
    if (popup) {
      popup.remove();
      delete (map.current as unknown as { _routePopup?: maplibregl.Popup })._routePopup;
    }
  }, []);

  // ====================== DRAW ROUTE ======================
  const drawOptimalRoute = useCallback((segmentsToDraw?: typeof activeSegments) => {
    if (!map.current || !routeResult) return;
    cleanRouteLayers();
    const segments = segmentsToDraw ?? activeSegments;
    if (!segments || segments.length === 0) return;

    type RouteGroup = {
      routeId: number; routeName: string; routeNumber: string;
      coords: [number, number][];
    };

    const groups: RouteGroup[] = [];
    let currentGroup: RouteGroup | undefined;

    for (const seg of segments) {
      const fromStop = stops.find((s) => s.id === seg.from_stop);
      const toStop = stops.find((s) => s.id === seg.to_stop);
      if (!fromStop || !toStop) continue;
      if (!isValidCoordinate(fromStop.lat, fromStop.lng)) continue;
      if (!isValidCoordinate(toStop.lat, toStop.lng)) continue;

      if (!currentGroup || currentGroup.routeId !== seg.route_id) {
        currentGroup = {
          routeId: seg.route_id,
          routeName: seg.route_name ?? "",
          routeNumber: seg.route_number ?? "",
          coords: [],
        };
        groups.push(currentGroup);
      }
      if (currentGroup.coords.length === 0) {
        currentGroup.coords.push([fromStop.lng, fromStop.lat]);
      }
      currentGroup.coords.push([toStop.lng, toStop.lat]);
    }

    const allCoords: [number, number][] = [];

    groups.forEach((group, idx) => {
      if (group.coords.length < 2) return;
      const sourceId = `route-segment-${idx}`;
      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
      allCoords.push(...group.coords);
      const label = [group.routeNumber ? `№${group.routeNumber}` : "", group.routeName].filter(Boolean).join(" — ");

      const feature: GeoJSONLineFeature = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: group.coords },
        properties: {
          routeId: group.routeId, routeName: group.routeName,
          routeNumber: group.routeNumber, label, color,
        },
      };

      map.current!.addSource(sourceId, { type: "geojson", data: feature });
      // Glow effect
      map.current!.addLayer({
        id: `${sourceId}-glow`, type: "line", source: sourceId,
        paint: { "line-color": color, "line-width": 14, "line-opacity": 0.25, "line-blur": 6 },
      });
      // Hitbox
      map.current!.addLayer({
        id: `${sourceId}-hitbox`, type: "line", source: sourceId,
        paint: { "line-color": color, "line-width": 20, "line-opacity": 0 },
      });
      // Main line
      map.current!.addLayer({
        id: sourceId, type: "line", source: sourceId,
        paint: { "line-color": color, "line-width": 5, "line-opacity": 1 },
        layout: { "line-cap": "round", "line-join": "round" },
      });

      map.current!.on("mouseenter", `${sourceId}-hitbox`, (e) => {
        map.current!.getCanvas().style.cursor = "pointer";
        const prevPopup = (map.current as unknown as { _routePopup?: maplibregl.Popup })._routePopup;
        if (prevPopup) prevPopup.remove();
        const popup = new maplibregl.Popup({
          closeButton: false, closeOnClick: false,
          className: "route-hover-popup", offset: 12,
        })
          .setLngLat(e.lngLat)
          .setHTML(`<div class="route-popup-inner">
            <div class="route-popup-number">🚌 ${group.routeNumber ? `№${group.routeNumber}` : "—"}</div>
            ${group.routeName ? `<div class="route-popup-name">${group.routeName}</div>` : ""}
          </div>`)
          .addTo(map.current!);
        (map.current as unknown as { _routePopup?: maplibregl.Popup })._routePopup = popup;
      });

      map.current!.on("mousemove", `${sourceId}-hitbox`, (e) => {
        const popup = (map.current as unknown as { _routePopup?: maplibregl.Popup })._routePopup;
        popup?.setLngLat(e.lngLat);
      });

      map.current!.on("mouseleave", `${sourceId}-hitbox`, () => {
        map.current!.getCanvas().style.cursor = "";
        const popup = (map.current as unknown as { _routePopup?: maplibregl.Popup })._routePopup;
        if (popup) {
          popup.remove();
          delete (map.current as unknown as { _routePopup?: maplibregl.Popup })._routePopup;
        }
      });
    });

    const firstSeg = segments[0];
    const lastSeg = segments[segments.length - 1];
    const startStop = stops.find((s) => s.id === firstSeg.from_stop);
    const endStop = stops.find((s) => s.id === lastSeg.to_stop);
    const pointFeatures: GeoJSONPointFeature[] = [];

    if (startStop && isValidCoordinate(startStop.lat, startStop.lng)) {
      pointFeatures.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [startStop.lng, startStop.lat] },
        properties: { type: "start" },
      });
    }
    if (endStop && isValidCoordinate(endStop.lat, endStop.lng)) {
      pointFeatures.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [endStop.lng, endStop.lat] },
        properties: { type: "end" },
      });
    }

    if (pointFeatures.length > 0) {
      const fc: GeoJSONFeatureCollection = { type: "FeatureCollection", features: pointFeatures };
      map.current!.addSource("optimal-route-points", { type: "geojson", data: fc });
      map.current!.addLayer({
        id: "optimal-route-points", type: "circle", source: "optimal-route-points",
        paint: {
          "circle-radius": 10,
          "circle-color": ["match", ["get", "type"], "start", "#6366f1", "end", "#ef4444", "#64748b"],
          "circle-stroke-width": 3, "circle-stroke-color": "#ffffff",
        },
      });
    }

    if (allCoords.length >= 2) {
      const bounds = new maplibregl.LngLatBounds();
      allCoords.forEach((c) => bounds.extend(c));
      map.current!.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 40, right: isSidebarCollapsed ? 40 : 420 },
        duration: 1000, maxZoom: 14,
      });
    }
  }, [routeResult, activeSegments, stops, isSidebarCollapsed, cleanRouteLayers]);

  // ====================== REDRAW ROUTE ======================
  useEffect(() => {
    if (!map.current || !mapLoadedRef.current) return;
    if (!routeResult || activeSegments.length === 0) {
      cleanRouteLayers();
      return;
    }
    const t = setTimeout(() => drawOptimalRoute(), 50);
    return () => clearTimeout(t);
  }, [routeResult, activeSegments, drawOptimalRoute, cleanRouteLayers]);

  // ====================== RESIZE ======================
  useEffect(() => {
    const handleResize = () => {
      if (!map.current) return;
      requestAnimationFrame(() => {
        map.current?.resize();
        map.current?.triggerRepaint();
      });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isSidebarCollapsed]);

  // ====================== FILTERED STOPS ======================
  const filteredStops = useMemo(() => {
    let baseStops = stops;
    if (routeResult && activeSegments.length > 0) {
      baseStops = stops.filter((s) => routeStopIds.has(s.id));
    }
    if (!searchQuery.trim()) return baseStops;
    const query = searchQuery.toLowerCase();
    return baseStops.filter(
      (s) => s.address.toLowerCase().includes(query) || s.url?.toLowerCase().includes(query)
    );
  }, [stops, searchQuery, routeResult, activeSegments, routeStopIds]);

  // ====================== BUILD ROUTE ======================
  const handleBuildRoute = async () => {
    if (!selectedCityId || !isReadyToBuild) return;
    const scheduledFor = scheduledTime ? scheduledTime.toISOString() : null;
    await buildRoute(selectedCityId, optimizationMode, stops, scheduledFor);
  };

  // ====================== SELECT ALTERNATIVE ======================
  const handleSelectAlternative = useCallback((idx: number) => {
    selectAlternative(idx);
    // Перерисовываем маршрут с сегментами из альтернативы
    if (routeResult?.alternatives?.[idx]?.segments) {
      setTimeout(() => drawOptimalRoute(routeResult.alternatives[idx].segments), 50);
    }
  }, [selectAlternative, routeResult, drawOptimalRoute]);

  // ====================== LEGEND ======================
  const routeLegend = useMemo(() => {
    if (!activeSegments || activeSegments.length === 0) return [];
    const seen = new Set<number>();
    const items: { routeId: number; routeNumber: string; routeName: string; color: string }[] = [];
    let colorIdx = 0;
    for (const seg of activeSegments) {
      if (typeof seg.route_id !== "number") continue;
      if (!seen.has(seg.route_id)) {
        seen.add(seg.route_id);
        items.push({
          routeId: seg.route_id,
          routeNumber: seg.route_number ?? "",
          routeName: seg.route_name ?? "",
          color: ROUTE_COLORS[colorIdx % ROUTE_COLORS.length],
        });
        colorIdx++;
      }
    }
    return items;
  }, [activeSegments]);

  const modeConfig = {
    FASTEST: { icon: <Zap size={16} />, label: "Быстрый", desc: "Минимум времени" },
    LESS_CROWDED: { icon: <Users size={16} />, label: "Свободный", desc: "Меньше людей" },
    MIN_TRANSFERS: { icon: <ArrowRightLeft size={16} />, label: "Мин. пересадок", desc: "Прямой путь" },
  };

  // ====================== UI ======================
  return (
    <div className="optimal-route-page">
      <header className="page-header">
        <div className="header-left">
          <div className="header-logo">
            <Navigation size={22} />
          </div>
          <h1>Построение маршрута</h1>
        </div>
        <div className="header-controls">
          <div className="header-time">
            <Clock size={15} />
            <span>{formatTime(currentTime)}</span>
          </div>
          <div className="city-select-wrapper">
            {citiesLoading ? <Spin size="small" /> : (
              <Select value={selectedCityId || undefined} onChange={selectCity}
                style={{ width: 220 }} placeholder="Выберите город" showSearch optionFilterProp="label">
                {cities.map((city) => (
                  <Option key={city.id} value={city.id} label={city.name}>
                    <Tooltip title={formatCoordsHuman(city.lat, city.lng)}>
                      <span className="city-option">
                        <Building2 size={14} style={{ color: "#6366f1" }} />{city.name}
                      </span>
                    </Tooltip>
                  </Option>
                ))}
              </Select>
            )}
          </div>
        </div>
      </header>

      <div className="page-content">
        <aside className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}>
          <div className="sidebar-header">
            {!isSidebarCollapsed && (
              <div className="sidebar-title">
                <Sparkles size={16} />
                <span>Настройки маршрута</span>
              </div>
            )}
            <button className="toggle-sidebar-btn"
              onClick={() => setIsSidebarCollapsed((p) => !p)}
              title={isSidebarCollapsed ? "Развернуть" : "Свернуть"}>
              {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {!isSidebarCollapsed && (
            <div className="sidebar-content">
              {/* MODE */}
              <div className="section-block">
                <div className="section-label">Режим оптимизации</div>
                <div className="mode-buttons">
                  {(["FASTEST", "LESS_CROWDED", "MIN_TRANSFERS"] as const).map((mode) => (
                    <button key={mode}
                      className={`mode-btn ${optimizationMode === mode ? "active" : ""}`}
                      onClick={() => setOptimizationMode(mode)} disabled={routeLoading}>
                      <span className="mode-icon">{modeConfig[mode].icon}</span>
                      <span className="mode-label">{modeConfig[mode].label}</span>
                      <span className="mode-desc">{modeConfig[mode].desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* SCHEDULER */}
              <div className="section-block">
                <button className={`scheduler-toggle ${showScheduler ? "active" : ""}`}
                  onClick={() => setShowScheduler(!showScheduler)}>
                  <Calendar size={16} />
                  <span>Планирование на время</span>
                  <ChevronRight size={14} className={`chevron ${showScheduler ? "open" : ""}`} />
                </button>
                {showScheduler && (
                  <div className="scheduler-input-wrap">
                    <label>Дата и время отправления</label>
                    <DatePicker showTime={{ format: "HH:mm" }} format="DD.MM.YYYY HH:mm"
                      value={scheduledTime} onChange={(date) => setScheduledTime(date)}
                      placeholder="Выберите время" style={{ width: "100%" }}
                      disabledDate={(current) => current && current < dayjs().startOf("day")} />
                    <div className="scheduler-hint">
                      <Timer size={12} />
                      <span>Маршрут будет построен с учётом расписания на выбранное время</span>
                    </div>
                  </div>
                )}
              </div>

              {/* NIGHT BANNER */}
              {routeResult?.isScheduled && routeResult.scheduledMessage && (
                <div className="night-banner">
                  <div className="night-icon-wrap">
                    <Moon size={18} />
                  </div>
                  <div className="night-text">
                    <strong>Ночной режим</strong>
                    <span>{routeResult.scheduledMessage}</span>
                  </div>
                </div>
              )}

              {/* ROUTE POINTS */}
              <div className="section-block route-points-section">
                <div className="section-label">
                  <MapPin size={14} />
                  <span>Точки маршрута</span>
                </div>
                <div className="select-mode-hint">
                  <span className="hint-dot" />
                  Сейчас выбирается: <b>{selectMode === "START" ? "Откуда" : "Куда"}</b>
                </div>

                <div className={`point-card ${selectMode === "START" ? "active-select" : ""} ${startStopId ? "selected" : ""}`}
                  onClick={() => setSelectModeSafe("START")}>
                  <div className="point-header">
                    <div className="point-badge start">А</div>
                    <strong>Откуда</strong>
                    {startStopId && (
                      <button className="clear-point-btn" onClick={(e) => {
                        e.stopPropagation(); setStartStop(null); clearResult(); setSelectModeSafe("START");
                      }}><X size={14} /></button>
                    )}
                  </div>
                  {startStopId ? (
                    <div className="point-address">{stops.find((s) => s.id === startStopId)?.address}</div>
                  ) : <small className="point-hint">Кликните на маркер на карте</small>}
                </div>

                <div className="arrow-down">
                  <div className="arrow-line" />
                  <div className="arrow-icon">↓</div>
                  <div className="arrow-line" />
                </div>

                <div className={`point-card ${selectMode === "GOAL" ? "active-select" : ""} ${goalStopId ? "selected goal" : ""}`}
                  onClick={() => setSelectModeSafe("GOAL")}>
                  <div className="point-header">
                    <div className="point-badge goal">Б</div>
                    <strong>Куда</strong>
                    {goalStopId && (
                      <button className="clear-point-btn" onClick={(e) => {
                        e.stopPropagation(); setGoalStop(null); clearResult(); setSelectModeSafe("GOAL");
                      }}><X size={14} /></button>
                    )}
                  </div>
                  {goalStopId ? (
                    <div className="point-address">{stops.find((s) => s.id === goalStopId)?.address}</div>
                  ) : <small className="point-hint">Кликните на маркер на карте</small>}
                </div>

                <button className={`build-btn ${scheduledTime ? "scheduled" : ""}`}
                  onClick={handleBuildRoute} disabled={!isReadyToBuild || routeLoading}>
                  {routeLoading ? (
                    <><Loader2 size={18} className="loader" />Построение...</>
                  ) : scheduledTime ? (
                    <><Calendar size={18} />Запланировать на {scheduledTime.format("HH:mm")}</>
                  ) : (
                    <><Route size={18} />Построить маршрут</>
                  )}
                </button>

                {routeError && (
                  <div className="map-error-inline">
                    <span>⚠️ {routeError}</span>
                    <button className="close-result-btn" onClick={() => clearResult()}><X size={14} /></button>
                  </div>
                )}

                {routeResult && (
                  <div className="result-panel">
                    <div className="result-panel-header">
                      <div className="result-title">
                        <Check size={16} className="check-icon" />
                        <h4>Маршрут построен</h4>
                      </div>
                      <button className="close-result-btn" onClick={clearResult}><X size={16} /></button>
                    </div>

                    <div className="result-stats">
                      <div className="result-stat">
                        <Timer size={14} className="stat-icon" />
                        <span className="label">Время</span>
                        <span className="value">{Math.round(routeResult.totalCostMinutes)} мин</span>
                      </div>
                      <div className="result-stat">
                        <Route size={14} className="stat-icon" />
                        <span className="label">Режим</span>
                        <span className="value">{routeResult.mode}</span>
                      </div>
                      <div className="result-stat">
                        <MapPin size={14} className="stat-icon" />
                        <span className="label">Сегментов</span>
                        <span className="value">{activeSegments.length}</span>
                      </div>
                    </div>

                    <div className="route-summary">
                      <span className="point start">
                        <MapPin size={14} />{routeResult.startStop?.address}
                      </span>
                      <span className="arrow">→</span>
                      <span className="point goal">
                        <MapPin size={14} />{routeResult.goalStop?.address}
                      </span>
                    </div>

                    {/* ALTERNATIVES */}
                    {routeResult.alternatives && routeResult.alternatives.length > 0 && (
                      <div className="alternatives-section">
                        <div className="alternatives-title">
                          <ArrowRightLeft size={12} />
                          <span>Альтернативные маршруты</span>
                        </div>
                        <div className="alternatives-list">
                          {routeResult.alternatives.map((alt, idx) => (
                            <button key={idx}
                              className={`alternative-btn ${selectedAlternativeIndex === idx ? "active" : ""}`}
                              onClick={() => handleSelectAlternative(idx)}>
                              <div className="alt-info">
                                <div className="alt-label">Маршрут #{idx + 1}</div>
                                <div className="alt-desc">{alt.segments.length} сегментов</div>
                              </div>
                              <div className="alt-cost">{Math.round(alt.totalCostMinutes)} мин</div>
                              {selectedAlternativeIndex === idx && <Check size={16} className="alt-check" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {routeLegend.length > 0 && (
                      <div className="route-legend">
                        <div className="route-legend-title">Используемые маршруты</div>
                        {routeLegend.map((item) => (
                          <div key={item.routeId} className="route-legend-item">
                            <span className="route-legend-color" style={{ backgroundColor: item.color }} />
                            <span className="route-legend-number">№{item.routeNumber || "—"}</span>
                            {item.routeName && (
                              <span className="route-legend-name" title={item.routeName}>{item.routeName}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* STOPS LIST */}
              <div className="section-block stops-list-section">
                <div className="section-label">
                  <MapPin size={14} />
                  <span>Остановки ({filteredStops.length})</span>
                  {routeResult && activeSegments.length > 0 && (
                    <span className="route-filter-badge">по маршруту</span>
                  )}
                </div>
                <Input className="stops-search" placeholder="Поиск остановки..."
                  prefix={<Search size={14} style={{ color: "#94a3b8" }} />}
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  allowClear size="small" />
                <div className="stops-list">
                  {stopsLoading ? (
                    <div style={{ textAlign: "center", padding: 20 }}><Spin size="small" /></div>
                  ) : filteredStops.length === 0 ? (
                    <div className="empty-state">
                      <MapPin size={32} className="icon" />
                      <p>Не найдено</p>
                      <small>{searchQuery ? "Попробуйте другой запрос" : "Выберите другой город"}</small>
                    </div>
                  ) : (
                    filteredStops.map((stop) => {
                      const isStart = stop.id === startStopId;
                      const isGoal = stop.id === goalStopId;
                      const loadLabel = stop.load <= 3 ? "low" : stop.load <= 7 ? "medium" : "high";
                      return (
                        <div key={stop.id}
                          className={`stop-item ${isStart ? "is-start" : isGoal ? "is-goal" : ""}`}
                          onClick={() => {
                            const mode = selectModeRef.current;
                            if (mode === "START") { setStartStop(stop.id); setSelectModeSafe("GOAL"); }
                            else setGoalStop(stop.id);
                            clearResult();
                          }}>
                          {(isStart || isGoal) && (
                            <div className={`stop-indicator ${isStart ? "start" : "goal"}`}>
                              {isStart ? "А" : "Б"}
                            </div>
                          )}
                          <div className="stop-info">
                            <div className="stop-address" title={stop.address}>{stop.address}</div>
                            <div className="stop-meta">
                              <Badge className={`load-badge ${loadLabel}`} text={`${stop.load}/10`} />
                              <span className="stop-coords">{stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>

        <main className="map-area">
          {(citiesLoading || stopsLoading) && (
            <div className="map-overlay"><Spin size="large" /></div>
          )}
          {routeError && <div className="map-error">⚠️ {routeError}</div>}
          <div ref={mapContainer} className="map-container" />
        </main>
      </div>
    </div>
  );
};

export default React.memo(OptimalRoutePage);