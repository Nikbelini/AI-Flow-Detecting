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
} from "lucide-react";

import { Select, Spin, Input, Badge, Tooltip } from "antd";
import type { Stop } from "../../api/types";

const { Option } = Select;

// ===== UTILS =====
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

type MarkerEntry = {
  marker: maplibregl.Marker;
  element: HTMLDivElement;
};

const OptimalRoutePage: React.FC = () => {
  // refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  const markersRef = useRef<Map<Stop["id"], MarkerEntry>>(new Map());

  // hooks
  const { cities, loading: citiesLoading, selectedCityId, selectedCity, selectCity } =
    useCities();

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

  // states
  const [stops, setStops] = useState<Stop[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapInitializing, setMapInitializing] = useState(true);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [optimizationMode, setOptimizationMode] = useState<
    "FASTEST" | "LESS_CROWDED" | "MIN_TRANSFERS"
  >("FASTEST");

  const [searchQuery, setSearchQuery] = useState("");

  // UX: режим выбора
  const [selectMode, setSelectMode] = useState<"START" | "GOAL">("START");
  const selectModeRef = useRef<"START" | "GOAL">("START");

  const setSelectModeSafe = useCallback((mode: "START" | "GOAL") => {
    selectModeRef.current = mode;
    setSelectMode(mode);
  }, []);

  // ===== TIME =====
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  // ===== LOAD STOPS =====
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

  // ===== MAP INIT =====
  useEffect(() => {
    if (!mapContainer.current || !selectedCity) return;

    if (map.current) {
      map.current.flyTo({
        center: toMapLibre(selectedCity.lat, selectedCity.lng),
        zoom: 11,
        duration: 1200,
      });
      return;
    }

    setMapInitializing(true);

    map.current = new maplibregl.Map({
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
        layers: [
          {
            id: "osm-tiles",
            type: "raster",
            source: "osm-raster-tiles",
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      },
      center: toMapLibre(selectedCity.lat, selectedCity.lng),
      zoom: 11,
      maxZoom: 18,
      minZoom: 9,
      pitch: 0,
      bearing: 0,
      fadeDuration: 0,
    });

    map.current.addControl(
      new maplibregl.NavigationControl({ showCompass: true, showZoom: true }),
      "top-right"
    );

    map.current.addControl(
      new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
      "bottom-left"
    );

    map.current.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "top-right"
    );

    map.current.on("load", () => {
      setMapLoaded(true);
      setMapInitializing(false);
      map.current?.resize();
    });

    map.current.on("error", (e) => console.error("Map error:", e.error));

    return () => {
      if (map.current) {
        markersRef.current.forEach(({ marker, element }) => {
          if ((element as any)._clickHandler) {
            element.removeEventListener("click", (element as any)._clickHandler);
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

  // ===== MARKERS =====
  const createMarkerElement = useCallback(
    (stop: Stop, isStart: boolean, isGoal: boolean): HTMLDivElement => {
      const root = document.createElement("div");
      root.className = "custom-marker-root";

      const inner = document.createElement("div");

      const sizeClass = getMarkerSize(stop.load);
      const color = isGoal
        ? "#ef4444"
        : isStart
        ? "#3b82f6"
        : getLoadColor(stop.load);

      inner.className = `custom-marker-inner ${sizeClass}${isStart ? " is-start" : ""}${
        isGoal ? " is-goal" : ""
      }`;

      inner.style.backgroundColor = color;

      const text = document.createElement("div");
      text.className = "marker-text";
      text.textContent = isGoal ? "Б" : isStart ? "А" : String(stop.load ?? 0);

      inner.appendChild(text);
      root.appendChild(inner);

      root.setAttribute(
        "title",
        `${stop.address}\n${
          isStart ? "🚦 Старт" : isGoal ? "🏁 Финиш" : `Загрузка: ${stop.load}/10`
        }`
      );

      return root;
    },
    []
  );

  const updateMarkerElement = useCallback(
    (root: HTMLDivElement, stop: Stop, isStart: boolean, isGoal: boolean) => {
      const inner = root.querySelector(".custom-marker-inner") as HTMLDivElement;
      if (!inner) return;

      const sizeClass = getMarkerSize(stop.load);
      const color = isGoal
        ? "#ef4444"
        : isStart
        ? "#3b82f6"
        : getLoadColor(stop.load);

      inner.className = `custom-marker-inner ${sizeClass}${isStart ? " is-start" : ""}${
        isGoal ? " is-goal" : ""
      }`;

      inner.style.backgroundColor = color;

      const text = inner.querySelector(".marker-text") as HTMLElement;
      if (text) {
        const newText = isGoal ? "Б" : isStart ? "А" : String(stop.load ?? 0);
        if (text.textContent !== newText) text.textContent = newText;
      }

      const newTitle = `${stop.address}\n${
        isStart ? "🚦 Старт" : isGoal ? "🏁 Финиш" : `Загрузка: ${stop.load}/10`
      }`;

      if (root.getAttribute("title") !== newTitle) root.setAttribute("title", newTitle);
    },
    []
  );

  // ===== FIX CLICK LOGIC =====
  const handleMarkerClick = useCallback(
    (e: MouseEvent, stopId: Stop["id"]) => {
      e.preventDefault();
      e.stopPropagation();

      const mode = selectModeRef.current;

      // START selection
      if (mode === "START") {
        setStartStop(stopId);

        // если выбрали старт = финиш -> сбрасываем финиш
        if (goalStopId === stopId) {
          setGoalStop(null);
        }

        clearResult?.();
        setSelectModeSafe("GOAL");
        return;
      }

      // GOAL selection
      if (mode === "GOAL") {
        setGoalStop(stopId);

        // если выбрали финиш = старт -> сбрасываем старт
        if (startStopId === stopId) {
          setStartStop(null);
        }

        clearResult?.();

        // можешь оставить GOAL или переключить обратно на START:
        // setSelectModeSafe("START");
        return;
      }
    },
    [goalStopId, startStopId, setStartStop, setGoalStop, clearResult, setSelectModeSafe]
  );

  // ===== MARKERS RENDER =====
  useEffect(() => {
    if (!map.current || !mapLoaded || mapInitializing) return;

    // update existing markers
    markersRef.current.forEach((value, stopId) => {
      const stop = stops.find((s) => s.id === stopId);
      if (!stop) return;

      const isStart = stop.id === startStopId;
      const isGoal = stop.id === goalStopId;

      updateMarkerElement(value.element, stop, isStart, isGoal);
    });

    // create new markers
    stops.forEach((stop) => {
      if (!isValidCoordinate(stop.lat, stop.lng)) return;
      if (markersRef.current.has(stop.id)) return;

      const isStart = stop.id === startStopId;
      const isGoal = stop.id === goalStopId;

      const el = createMarkerElement(stop, isStart, isGoal);

      const handler = (e: MouseEvent) => handleMarkerClick(e, stop.id);
      el.addEventListener("click", handler);
      (el as any)._clickHandler = handler;

      const markerInstance = new maplibregl.Marker({
        element: el,
        anchor: "center",
        clickTolerance: 10,
      })
        .setLngLat(toMapLibre(stop.lat, stop.lng))
        .addTo(map.current!);

      markersRef.current.set(stop.id, { marker: markerInstance, element: el });
    });

    // remove old markers
    markersRef.current.forEach((value, stopId) => {
      if (!stops.find((s) => s.id === stopId)) {
        const { marker, element } = value;

        if ((element as any)._clickHandler) {
          element.removeEventListener("click", (element as any)._clickHandler);
          delete (element as any)._clickHandler;
        }

        marker.remove();
        markersRef.current.delete(stopId);
      }
    });
  }, [
    stops,
    startStopId,
    goalStopId,
    mapLoaded,
    mapInitializing,
    createMarkerElement,
    updateMarkerElement,
    handleMarkerClick,
  ]);

  // ===== ROUTE DRAW =====
  const drawOptimalRoute = useCallback(() => {
    if (!map.current || !routeResult) return;

    ["optimal-route-line", "optimal-route-points"].forEach((id) => {
      if (map.current?.getLayer(id)) map.current.removeLayer(id);
      if (map.current?.getSource(id)) map.current.removeSource(id);
    });

    if (!routeResult.segments || routeResult.segments.length === 0) return;

    const lineCoords: [number, number][] = [];
    const pointFeatures: any[] = [];

    routeResult.segments.forEach((seg, idx) => {
      const fromStopId = Number(seg.from_stop ?? seg.fromStop);
      const toStopId = Number(seg.to_stop ?? seg.toStop);

      if (!fromStopId || !toStopId) return;

      const fromStop = stops.find((s) => Number(s.id) === fromStopId);
      const toStop = stops.find((s) => Number(s.id) === toStopId);

      if (fromStop && isValidCoordinate(fromStop.lat, fromStop.lng)) {
        lineCoords.push(toMapLibre(fromStop.lat, fromStop.lng));

        if (idx === 0) {
          pointFeatures.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: toMapLibre(fromStop.lat, fromStop.lng) },
            properties: { type: "start", label: "Старт" },
          });
        }
      }

      if (toStop && isValidCoordinate(toStop.lat, toStop.lng)) {
        lineCoords.push(toMapLibre(toStop.lat, toStop.lng));

        if (idx === routeResult.segments.length - 1) {
          pointFeatures.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: toMapLibre(toStop.lat, toStop.lng) },
            properties: { type: "end", label: "Финиш" },
          });
        }
      }
    });

    if (lineCoords.length < 2) return;

    map.current.addSource("optimal-route-line", {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: { type: "LineString", coordinates: lineCoords },
        properties: {},
      } as any,
    });

    map.current.addLayer({
      id: "optimal-route-line",
      type: "line",
      source: "optimal-route-line",
      paint: {
        "line-color": "#10b981",
        "line-width": 5,
        "line-opacity": 0.95,
      },
    });

    if (pointFeatures.length > 0) {
      map.current.addSource("optimal-route-points", {
        type: "geojson",
        data: { type: "FeatureCollection", features: pointFeatures } as any,
      });

      map.current.addLayer({
        id: "optimal-route-points",
        type: "circle",
        source: "optimal-route-points",
        paint: {
          "circle-radius": 9,
          "circle-color": [
            "match",
            ["get", "type"],
            "start",
            "#3b82f6",
            "end",
            "#ef4444",
            "#6b7280",
          ],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    const bounds = new maplibregl.LngLatBounds();
    lineCoords.forEach((c) => bounds.extend(c));

    map.current.fitBounds(bounds, {
      padding: {
        top: 80,
        bottom: 80,
        left: 40,
        right: isSidebarCollapsed ? 40 : 420,
      },
      duration: 1000,
      maxZoom: 14,
    });
  }, [routeResult, stops, isSidebarCollapsed]);

  useEffect(() => {
    if (!map.current || !mapLoaded || !routeResult) return;
    setTimeout(() => drawOptimalRoute(), 50);
  }, [routeResult, mapLoaded, drawOptimalRoute]);

  // ===== RESIZE =====
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
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isSidebarCollapsed, mapLoaded]);

  // ===== FILTER =====
  const filteredStops = useMemo(() => {
    if (!searchQuery.trim()) return stops;
    const query = searchQuery.toLowerCase();

    return stops.filter(
      (s) =>
        s.address.toLowerCase().includes(query) ||
        s.url?.toLowerCase().includes(query)
    );
  }, [stops, searchQuery]);

  // ===== BUILD ROUTE =====
  const handleBuildRoute = async () => {
    if (!selectedCityId || !isReadyToBuild) return;
    await buildRoute(selectedCityId, optimizationMode, stops);
  };

  // ===== UI =====
  return (
    <div className="optimal-route-page">
      {/* HEADER */}
      <header className="page-header">
        <h1>
          <Route size={22} /> Построение маршрута
        </h1>

        <div className="header-controls">
          <div className="header-time">
            <Clock size={16} />
            <span>{formatTime(currentTime)}</span>
          </div>

          <div className="city-select-wrapper">
            {citiesLoading ? (
              <Spin size="small" />
            ) : (
              <Select
                value={selectedCityId || undefined}
                onChange={selectCity}
                style={{ width: 220 }}
                placeholder="Город"
                showSearch
                optionFilterProp="label"
              >
                {cities.map((city) => (
                  <Option key={city.id} value={city.id} label={city.name}>
                    <Tooltip title={formatCoordsHuman(city.lat, city.lng)}>
                      <span className="city-option">
                        <Building2 size={14} style={{ color: "#666" }} />
                        {city.name}
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
        <aside className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}>
          <div className="sidebar-header">
            {!isSidebarCollapsed && <h3>⚙️ Настройки</h3>}

            <button
              className="toggle-sidebar-btn"
              onClick={() => setIsSidebarCollapsed((p) => !p)}
              title={isSidebarCollapsed ? "Развернуть" : "Свернуть"}
            >
              {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {!isSidebarCollapsed && (
            <div className="sidebar-content">
              {/* MODE */}
              <div className="mode-selector">
                <label>Режим:</label>

                <div className="mode-buttons">
                  {(["FASTEST", "LESS_CROWDED", "MIN_TRANSFERS"] as const).map((mode) => (
                    <button
                      key={mode}
                      className={`mode-btn ${optimizationMode === mode ? "active" : ""}`}
                      onClick={() => setOptimizationMode(mode)}
                      disabled={routeLoading}
                    >
                      <span className="icon">
                        {mode === "FASTEST" ? "⚡" : mode === "LESS_CROWDED" ? "👥" : "🔀"}
                      </span>
                      <span>
                        {mode === "FASTEST"
                          ? "Быстрый"
                          : mode === "LESS_CROWDED"
                          ? "Свободный"
                          : "Мин. пересадок"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ROUTE POINTS */}
              <div className="route-points-section">
                <h4>📍 Маршрут</h4>

                <div className="select-mode-hint">
                  Сейчас выбирается: <b>{selectMode === "START" ? "Откуда" : "Куда"}</b>
                </div>

                {/* START */}
                <div
                  className={`point-card ${selectMode === "START" ? "active-select" : ""} ${
                    startStopId ? "selected" : ""
                  }`}
                  onClick={() => setSelectModeSafe("START")}
                >
                  <div className="point-header">
                    <MapPin size={18} color="#3b82f6" />
                    <strong>Откуда</strong>

                    {startStopId && (
                      <button
                        className="clear-point-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStartStop(null);
                          clearResult?.();
                          setSelectModeSafe("START");
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {startStopId ? (
                    <div className="point-address">
                      {stops.find((s) => s.id === startStopId)?.address}
                    </div>
                  ) : (
                    <small className="point-hint">Кликните на маркер</small>
                  )}
                </div>

                <div className="arrow-down">↓</div>

                {/* GOAL */}
                <div
                  className={`point-card ${selectMode === "GOAL" ? "active-select" : ""} ${
                    goalStopId ? "selected goal" : ""
                  }`}
                  onClick={() => setSelectModeSafe("GOAL")}
                >
                  <div className="point-header">
                    <MapPin size={18} color="#ef4444" />
                    <strong>Куда</strong>

                    {goalStopId && (
                      <button
                        className="clear-point-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGoalStop(null);
                          clearResult?.();
                          setSelectModeSafe("GOAL");
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {goalStopId ? (
                    <div className="point-address">
                      {stops.find((s) => s.id === goalStopId)?.address}
                    </div>
                  ) : (
                    <small className="point-hint">Кликните на маркер</small>
                  )}
                </div>

                {/* BUILD BUTTON */}
                <button
                  className="build-btn"
                  onClick={handleBuildRoute}
                  disabled={!isReadyToBuild || routeLoading}
                >
                  {routeLoading ? (
                    <>
                      <Loader2 size={18} className="loader" />
                      Построение...
                    </>
                  ) : (
                    <>
                      <Route size={18} />
                      Построить маршрут
                    </>
                  )}
                </button>

                {/* ERROR */}
                {routeError && (
                  <div className="map-error" style={{ position: "relative" }}>
                    ⚠️ {routeError}
                    <button
                      className="close-result-btn"
                      style={{ position: "absolute", right: 8, top: 8 }}
                      onClick={() => clearResult()}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* RESULT */}
                {routeResult && (
                  <div className="result-panel">
                    <div className="result-panel-header">
                      <h4>✅ Маршрут построен</h4>
                      <button className="close-result-btn" onClick={clearResult}>
                        <X size={16} />
                      </button>
                    </div>

                    <div className="result-stats">
                      <div className="result-stat">
                        <span className="label">Время</span>
                        <span className="value">{routeResult.totalCostMinutes / 5} мин</span>
                      </div>

                      <div className="result-stat">
                        <span className="label">Режим</span>
                        <span className="value">{routeResult.mode}</span>
                      </div>

                      <div className="result-stat">
                        <span className="label">Сегментов</span>
                        <span className="value">{routeResult.segments.length}</span>
                      </div>
                    </div>

                    <div className="route-summary">
                      <span className="point">
                        <MapPin size={14} color="#3b82f6" />
                        {routeResult.startStop?.address}
                      </span>
                      <span className="arrow">→</span>
                      <span className="point">
                        <MapPin size={14} color="#ef4444" />
                        {routeResult.goalStop?.address}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* STOPS LIST */}
              <div className="stops-list-section">
                <h4>📍 Остановки ({stops.length})</h4>

                <Input
                  className="stops-search"
                  placeholder="Поиск..."
                  prefix={<Search size={14} style={{ color: "#94a3b8" }} />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  allowClear
                  size="small"
                />

                <div className="stops-list">
                  {stopsLoading ? (
                    <div style={{ textAlign: "center", padding: 20 }}>
                      <Spin size="small" />
                    </div>
                  ) : filteredStops.length === 0 ? (
                    <div className="empty-state">
                      <MapPin size={32} className="icon" />
                      <p>Не найдено</p>
                      <small>{searchQuery ? "Другой запрос" : "Другой город"}</small>
                    </div>
                  ) : (
                    filteredStops.map((stop) => {
                      const isStart = stop.id === startStopId;
                      const isGoal = stop.id === goalStopId;

                      const loadLabel =
                        stop.load <= 3 ? "low" : stop.load <= 7 ? "medium" : "high";

                      return (
                        <div
                          key={stop.id}
                          className={`stop-item ${isStart ? "is-start" : isGoal ? "is-goal" : ""}`}
                          onClick={() => {
                            const mode = selectModeRef.current;

                            if (mode === "START") {
                              setStartStop(stop.id);
                              setSelectModeSafe("GOAL");
                            } else {
                              setGoalStop(stop.id);
                            }

                            clearResult?.();
                          }}
                        >
                          {(isStart || isGoal) && (
                            <div className={`stop-indicator ${isStart ? "start" : "goal"}`}>
                              {isStart ? "А" : "Б"}
                            </div>
                          )}

                          <div className="stop-info">
                            <div className="stop-address" title={stop.address}>
                              {stop.address}
                            </div>

                            <div className="stop-meta">
                              <Badge className={`load-badge ${loadLabel}`} text={`${stop.load}/10`} />
                              <span className="stop-coords">
                                {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                              </span>
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

        {/* MAP */}
        <main className="map-area">
          {(mapInitializing || stopsLoading || citiesLoading) && !mapLoaded && (
            <div className="map-overlay">
              <Spin size="large" />
            </div>
          )}

          {routeError && <div className="map-error">⚠️ {routeError}</div>}

          <div
            ref={mapContainer}
            className="map-container"
            style={{
              opacity: mapInitializing ? 0.5 : 1,
              transition: "opacity 0.3s ease",
            }}
          />
        </main>
      </div>
    </div>
  );
};

export default React.memo(OptimalRoutePage);