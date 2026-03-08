// src/pages/SimulationPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import './SimulationPage.css';
import SimulationMap, { type MapRoute } from './Map/SimulationMap';
import { useStops } from '../hooks/api/useStops';
import { useRoutes } from '../hooks/api/useRoutes';
import {
  Play, Save, RotateCcw, Download, Eye, EyeOff,
  Clock, Users, Bus, AlertTriangle, TrendingUp,
  Plus, Trash2, Settings, Route as RouteIcon,
  PieChart, Activity, Target, MapPin
} from 'lucide-react';
import type { Stop } from '../api/types';
import StopMetricsModal from '../components/modal/StopMetricsModal';
import ThroughputMetrics from '../components/ThroughputMetrics';
import WaitTimeDistributionChart from '../components/WaitTimeDistributionChart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Line
} from 'recharts';

// ========== ТИПЫ ==========

interface WaitTimeDistribution {
  buckets: number[];
  counts: number[];
  percentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
  average: number;
  median: number;
  p95: number;
  p99: number;
}

interface HourlyThroughput {
  hour: number;
  passengers_arrived: number;
  passengers_departed: number;
  passengers_waiting: number;
}

interface StopThroughput {
  theoretical: number;
  estimated_actual: number;
}

interface PassengerThroughput {
  hourly_throughput: HourlyThroughput[];
  peak_hour: number;
  peak_hour_passengers: number;
  theoretical_capacity: number;
  utilization_rate: number;
  stop_throughput: Record<number, StopThroughput>;
}

interface StopHourlyMetric {
  hour: number;
  passengers: number;
  departed: number;
  waiting: number;
  avg_wait?: number;
}

interface StopMetricsDetail {
  id: number;
  address: string;
  hourly: StopHourlyMetric[];
  total_passengers: number;
  total_departed: number;
  avg_departure_rate: number;
  avg_wait_time: number;
  theoretical_capacity: number;
  peak_hour: number;
  peak_passengers: number;
  utilization: number;
}

interface Metrics {
  avgWaitTime: number;
  maxWaitTime: number;
  totalPassengers: number;
  avgLoad: number;
  transportUtilization: number;
}

interface HourlyData {
  hour: number;
  basePassengers: number;
  modifiedPassengers: number;
  baseWaitTime: number;
  modifiedWaitTime: number;
}

interface AffectedStop {
  id: number;
  address: string;
  loadChange: number;
  waitTimeChange: number;
  status: 'improved' | 'worsened' | 'neutral';
}

interface SimulationResults {
  baseMetrics: Metrics;
  modifiedMetrics: Metrics;
  hourlyData: HourlyData[];
  affectedStops: AffectedStop[];
  baseThroughput?: PassengerThroughput;
  modifiedThroughput?: PassengerThroughput;
  baseWaitDistribution?: WaitTimeDistribution;
  modifiedWaitDistribution?: WaitTimeDistribution;
  baseStopMetrics?: Record<number, StopMetricsDetail>;
  modifiedStopMetrics?: Record<number, StopMetricsDetail>;
}

type ModificationType = 'close_stop' | 'add_stop' | 'change_interval' | 'change_capacity' | 'add_route';

interface Modification {
  id: string;
  type: ModificationType;
  targetType: 'stop' | 'route';
  targetId: number;
  parameters: Record<string, any>;
  enabled: boolean;
  label?: string;
}

interface ExtendedStop extends Stop {
  avg_load?: number;
  avg_count?: number;
  avg_wait_time?: number;
  max_count?: number;
  cluster?: 'office' | 'shopping' | 'residential' | 'transport_hub' | 'educational' | 'unknown';
  peak_hours?: number[];
  avg_pattern?: number[];
  color?: string;
}

interface NewStopData {
  lat: number;
  lng: number;
  address?: string;
  capacity?: number;
}

interface NewRouteData {
  stops: number[];
  number: string;
  name?: string;
  intervalMinutes: number;
  transportType: 'BUS' | 'TROLLEYBUS' | 'TRAM' | 'MINIBUS';
  color?: string;
}

interface SimulationState {
  status: 'idle' | 'running' | 'completed' | 'error';
  progress: number;
  currentHour: number;
  results: SimulationResults | null;
  simulationId?: string;
  errorMessage?: string;
}

// ========== КОМПОНЕНТ ==========

const SimulationPage: React.FC = () => {
  const [simState, setSimState] = useState<SimulationState>({
    status: 'idle',
    progress: 0,
    currentHour: 8,
    results: null
  });

  const [modifications, setModifications] = useState<Modification[]>([]);
  const [selectedStop, setSelectedStop] = useState<ExtendedStop | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<MapRoute | null>(null);
  const [editMode, setEditMode] = useState<'view' | 'select_stop' | 'select_route'>('view');
  const [selectedHour, setSelectedHour] = useState(8);
  const [cityStops, setCityStops] = useState<ExtendedStop[]>([]);
  const [cityRoutes, setCityRoutes] = useState<MapRoute[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [serviceAvailable, setServiceAvailable] = useState(true);

  // Новые состояния для создания элементов
  const [creationMode, setCreationMode] = useState<'stop' | 'route' | null>(null);
  const [newRouteStops, setNewRouteStops] = useState<number[]>([]);
  const [newStopPosition, setNewStopPosition] = useState<[number, number] | null>(null);
  const [showNewRouteModal, setShowNewRouteModal] = useState(false);
  const [showNewStopModal, setShowNewStopModal] = useState(false);

  // Состояния для форм
  const [newStopAddress, setNewStopAddress] = useState('');
  const [newStopCapacity, setNewStopCapacity] = useState(50);
  const [newRouteNumber, setNewRouteNumber] = useState('');
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteType, setNewRouteType] = useState<'BUS' | 'TROLLEYBUS' | 'TRAM' | 'MINIBUS'>('BUS');
  const [newRouteInterval, setNewRouteInterval] = useState(15);

  const [activeMetricTab, setActiveMetricTab] = useState<'basic' | 'throughput' | 'distribution'>('basic');
  const [selectedStopForMetrics, setSelectedStopForMetrics] = useState<number | null>(null);

  const CITY_ID = 1;

  const { getStops } = useStops();
  const { getAllRoutes } = useRoutes();

  // ========== Загрузка данных ==========

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);

        const healthResponse = await fetch('http://localhost:8084/health');
        const healthData = await healthResponse.json();
        setServiceAvailable(healthData.status === 'healthy');

        const [stopsData, routesData] = await Promise.all([
          getStops(),
          getAllRoutes()
        ]);

        const stopsWithCoords: ExtendedStop[] = stopsData.map((stop: any) => ({
          id: Number(stop.id),
          address: stop.address || `Остановка ${stop.id}`,
          lat: stop.lat,
          lng: stop.lng,
          url: stop.url || '',
          count: stop.count || 0,
          velocity: stop.velocity || 0,
          load: stop.load || 3,
          cityId: CITY_ID,
          avg_load: stop.avg_load,
          avg_count: stop.avg_count,
          avg_wait_time: stop.avg_wait_time || 8.2,
          max_count: stop.max_count,
          cluster: stop.cluster,
          peak_hours: stop.peak_hours,
          avg_pattern: stop.avg_pattern,
          color: getStopColor(stop.id)
        }));

        const routesForMap: MapRoute[] = routesData.map((route: any) => {
          const path = generateRoutePath(route.stops || [], stopsWithCoords);
          return {
            id: route.id,
            number: route.number || String(route.id),
            name: route.name,
            path: path,
            color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
            stops: route.stops?.map((s: any) => s.stopId || s.id) || [],
            intervalMinutes: route.intervalMinutes || 15,
            transportType: route.transportType || 'BUS',
            isActive: route.isActive,
            cityId: route.cityId
          };
        });

        setCityStops(stopsWithCoords);
        setCityRoutes(routesForMap);
        console.log('✅ Загружено:', { stops: stopsWithCoords.length, routes: routesForMap.length });
      } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
        setServiceAvailable(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    const loadRoutesFromModelingService = async () => {
      try {
        const response = await fetch('http://localhost:8084/routes/1');
        if (response.ok) {
          const data = await response.json();
          console.log('🛤️ Маршруты из modeling-service:', data);
          const modelingRoutes: MapRoute[] = data.map((route: any) => ({
            id: route.id,
            number: route.number,
            name: route.name,
            path: route.path || [],
            stops: route.stops,
            intervalMinutes: route.interval_minutes || 15,
            transportType: route.transport_type,
            color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
          }));
          setCityRoutes(prev => {
            const merged = [...prev, ...modelingRoutes];
            return Array.from(new Map(merged.map(r => [r.id, r])).values());
          });
        }
      } catch (error) {
        console.error('❌ Ошибка загрузки маршрутов из modeling-service:', error);
      }
    };

    if (serviceAvailable) {
      loadRoutesFromModelingService();
    }
  }, [serviceAvailable]);

  const generateRoutePath = (stops: any[], allStops: ExtendedStop[]): [number, number][] => {
    if (!stops || stops.length === 0) return [];
    return stops
      .map((stop: any) => {
        const stopId = stop.stopId || stop.id;
        const foundStop = allStops.find(s => s.id === stopId);
        return foundStop ? [foundStop.lng, foundStop.lat] as [number, number] : null;
      })
      .filter(Boolean) as [number, number][];
  };

  // ========== Валидация и симуляция ==========

  const validateModifications = useCallback(async (mods: Modification[]) => {
    try {
      console.log('🔍 Отправка на валидацию:', JSON.stringify(mods, null, 2));
      const response = await fetch('http://localhost:8084/modifications/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mods)
      });
      const result = await response.json();
      console.log('📊 Результат валидации:', result);
      return result;
    } catch (error) {
      console.error('❌ Ошибка валидации:', error);
      return { valid: false, errors: [] };
    }
  }, []);

  const runSimulation = useCallback(async () => {
    if (!serviceAvailable) {
      alert('❌ Сервис моделирования недоступен');
      return;
    }
    if (modifications.length === 0) {
      alert('⚠️ Добавьте хотя бы одно изменение');
      return;
    }

    setSimState({ status: 'running', progress: 0, currentHour: 8, results: null });

    try {
      console.log('🚀 Запуск симуляции с изменениями:', modifications);
      const response = await fetch('http://localhost:8084/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city_id: CITY_ID,
          modifications: modifications.filter(m => m.enabled),
          simulation_hours: 24
        })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      console.log('📊 Получены результаты:', data);

      let progress = 0;
      const interval = setInterval(() => {
        progress += 20;
        setSimState(prev => ({ ...prev, progress }));
        if (progress >= 100) {
          clearInterval(interval);
          setSimState(prev => ({
            ...prev,
            status: 'completed',
            progress: 100,
            results: data.results || data
          }));
        }
      }, 300);
    } catch (error) {
      console.error('❌ Ошибка симуляции:', error);
      setSimState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Неизвестная ошибка'
      }));
    }
  }, [modifications, serviceAvailable, CITY_ID]);

  // ========== Управление модификациями ==========

  const addStopModification = async (type: ModificationType) => {
    if (!selectedStop) {
      alert('⚠️ Сначала выберите остановку на карте');
      return;
    }
    if (!selectedStop.id) {
      console.error('❌ У выбранной остановки нет ID:', selectedStop);
      alert('❌ Ошибка: не удалось получить ID остановки');
      return;
    }

    const newMod: Modification = {
      id: Date.now().toString(),
      type,
      targetType: 'stop',
      targetId: selectedStop.id,
      parameters: type === 'close_stop' ? { hours: [7, 8, 9, 17, 18, 19] } :
        type === 'change_interval' ? { interval: 15 } :
          type === 'change_capacity' ? { capacity: 50 } : {},
      enabled: true,
      label: `${type === 'close_stop' ? '🚫' : type === 'change_interval' ? '⏱️' : '📦'} ${selectedStop.address}`
    };

    console.log('➕ Добавление модификации остановки:', newMod);
    const validation = await validateModifications([newMod]);
    if (!validation.valid) {
      console.error('❌ Валидация не пройдена:', validation.errors);
      alert('❌ Изменение не прошло валидацию: ' + (validation.errors?.[0]?.error || 'Неизвестная ошибка'));
      return;
    }
    setModifications(prev => [...prev, newMod]);
  };

  const addRouteModification = async () => {
    if (!selectedRoute) {
      alert('⚠️ Сначала выберите маршрут на карте');
      return;
    }
    if (!selectedRoute.id) {
      console.error('❌ У выбранного маршрута нет ID:', selectedRoute);
      alert('❌ Ошибка: не удалось получить ID маршрута');
      return;
    }

    const newInterval = prompt('Введите новый интервал (в минутах):', String(selectedRoute.intervalMinutes || 15));
    if (!newInterval) return;
    const interval = parseInt(newInterval);
    if (isNaN(interval) || interval < 1 || interval > 60) {
      alert('❌ Интервал должен быть от 1 до 60 минут');
      return;
    }

    const newMod: Modification = {
      id: Date.now().toString(),
      type: 'change_interval',
      targetType: 'route',
      targetId: selectedRoute.id,
      parameters: { interval },
      enabled: true,
      label: `⏱️ Маршрут ${selectedRoute.number} (${interval} мин)`
    };

    console.log('➕ Добавление модификации маршрута:', newMod);
    const validation = await validateModifications([newMod]);
    if (!validation.valid) {
      console.error('❌ Валидация не пройдена:', validation.errors);
      alert('❌ Изменение не прошло валидацию');
      return;
    }
    setModifications(prev => [...prev, newMod]);
  };

  // ========== Новые функции создания ==========

  const createNewStop = async () => {
    if (!newStopPosition) return;

    const tempId = Date.now();
    const newStop: ExtendedStop = {
      id: tempId,
      address: newStopAddress || `Новая остановка ${cityStops.length + 1}`,
      lat: newStopPosition[1],
      lng: newStopPosition[0],
      url: '',
      count: 0,
      velocity: 0,
      load: 3,
      cityId: CITY_ID,
      avg_load: 3,
      avg_count: 5,
      avg_wait_time: 8,
      cluster: 'unknown',
      peak_hours: [],
      avg_pattern: Array(24).fill(5),
      color: '#10b981'
    };

    setCityStops(prev => [...prev, newStop]);

    const newMod: Modification = {
      id: Date.now().toString(),
      type: 'add_stop',
      targetType: 'stop',
      targetId: tempId,
      parameters: {
        address: newStop.address,
        lat: newStop.lat,
        lng: newStop.lng,
        capacity: newStopCapacity || 50,
        pattern: Array(24).fill(5)
      },
      enabled: true,
      label: `➕ ${newStop.address}`
    };

    setModifications(prev => [...prev, newMod]);
    setShowNewStopModal(false);
    setNewStopPosition(null);
    setNewStopAddress('');
    setCreationMode(null);
    alert(`✅ Остановка "${newStop.address}" добавлена и будет участвовать в симуляции`);
  };

  const createNewRoute = async () => {
    if (!newRouteNumber || newRouteStops.length < 2) return;

    const tempId = Date.now();
    const path: [number, number][] = newRouteStops
      .map(stopId => {
        const stop = cityStops.find(s => s.id === stopId);
        return stop ? [stop.lng, stop.lat] as [number, number] : null;
      })
      .filter(Boolean) as [number, number][];

    const newRoute: MapRoute = {
      id: tempId,
      number: newRouteNumber,
      name: newRouteName,
      path: path,
      stops: newRouteStops,
      intervalMinutes: newRouteInterval,
      transportType: newRouteType,
      color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
      isActive: true
    };

    setCityRoutes(prev => [...prev, newRoute]);

    const newMod: Modification = {
      id: Date.now().toString(),
      type: 'add_route',
      targetType: 'route',
      targetId: tempId,
      parameters: {
        number: newRoute.number,
        stops: newRouteStops,
        interval: newRouteInterval,
        transportType: newRouteType,
        path: path
      },
      enabled: true,
      label: `🛤️ Маршрут ${newRoute.number}`
    };

    setModifications(prev => [...prev, newMod]);
    setShowNewRouteModal(false);
    setNewRouteStops([]);
    setNewRouteNumber('');
    setNewRouteName('');
    setCreationMode(null);
    alert(`✅ Маршрут ${newRoute.number} добавлен и будет участвовать в симуляции`);
  };

  const removeModification = (id: string) => {
    setModifications(prev => prev.filter(m => m.id !== id));
  };

  const toggleModification = (id: string) => {
    setModifications(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
  };

  const resetSimulation = () => {
    setSimState({ status: 'idle', progress: 0, currentHour: 8, results: null });
    setModifications([]);
    setSelectedStop(null);
    setSelectedRoute(null);
    setCreationMode(null);
    setNewRouteStops([]);
  };

  // ========== Обработчики карты ==========

  const handleMarkerClick = (marker: any) => {
    console.log('📍 Marker clicked:', marker);

    if (creationMode === 'route' && editMode === 'select_stop') {
      if (!marker || !marker.id) {
        console.error('❌ Маркер без ID:', marker);
        return;
      }
      if (!newRouteStops.includes(marker.id)) {
        setNewRouteStops(prev => [...prev, marker.id]);
        const stop = cityStops.find(s => s.id === marker.id);
        alert(`✅ Остановка "${stop?.address || marker.id}" добавлена в маршрут (позиция ${newRouteStops.length + 1})`);
      } else {
        alert('⚠️ Эта остановка уже добавлена в маршрут');
      }
      return;
    }

    if (editMode === 'select_stop') {
      if (!marker || !marker.id) {
        console.error('❌ Маркер без ID:', marker);
        return;
      }
      const fullStop = cityStops.find(s => s.id === marker.id);
      if (fullStop) {
        console.log('✅ Найдены полные данные остановки:', fullStop);
        setSelectedStop(fullStop);
        setSelectedRoute(null);
        if (simState.results?.baseStopMetrics?.[fullStop.id]) {
          setSelectedStopForMetrics(fullStop.id);
        }
      } else {
        console.warn('⚠️ Полные данные не найдены');
        alert('❌ Ошибка: данные остановки не найдены');
      }
    } else if (editMode === 'select_route') {
      alert('⚠️ Сейчас режим выбора маршрута. Переключитесь на "Выбор остановки"');
    }
  };

  const handleRouteClick = (route: MapRoute) => {
    console.log('🛤️ Route clicked:', route);
    if (editMode === 'select_route') {
      if (!route || !route.id) {
        console.error('❌ Маршрут без ID:', route);
        return;
      }
      setSelectedRoute(route);
      setSelectedStop(null);
      console.log('✅ Выбран маршрут:', route.number);
    } else if (editMode === 'select_stop') {
      alert('⚠️ Сейчас режим выбора остановки. Переключитесь на "Выбор маршрута"');
    }
  };

  const handleMapClick = (lngLat: [number, number]) => {
    if (creationMode === 'stop') {
      setNewStopPosition(lngLat);
      setShowNewStopModal(true);
    }
  };

  const getStopColor = (stopId: number): string => {
    if (!simState.results) return '#10b981';
    const affected = simState.results.affectedStops.find(a => a.id === stopId);
    if (!affected) return '#10b981';
    if (affected.loadChange > 30) return '#ef4444';
    if (affected.loadChange > 10) return '#f59e0b';
    return '#10b981';
  };

  const exportResults = () => {
    if (!simState.results) return;
    const dataStr = JSON.stringify(simState.results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `simulation_results_${new Date().toISOString()}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const formatPercent = (value: number): string => (value * 100).toFixed(1) + '%';

  return (
    <div className="simulation-page">
      {/* Заголовок */}
      <div className="simulation-header">
        <div className="header-left">
          <h1 className="page-title">🎮 Моделирование "Что если"</h1>
          <p className="page-subtitle">
            Безопасно изменяйте транспортную сеть и мгновенно оценивайте последствия
          </p>
        </div>

        <div className="header-right">
          {!serviceAvailable && <div className="service-warning">⚠️ Сервис моделирования недоступен</div>}
          <div className="simulation-status">
            <div className={`status-badge ${simState.status}`}>
              {simState.status === 'idle' && '⚪ Готов к запуску'}
              {simState.status === 'running' && '🟡 Выполняется...'}
              {simState.status === 'completed' && '🟢 Симуляция завершена'}
              {simState.status === 'error' && '🔴 Ошибка'}
            </div>
            {simState.status === 'running' && (
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${simState.progress}%` }}></div>
              </div>
            )}
            {simState.errorMessage && <div className="error-message">{simState.errorMessage}</div>}
          </div>

          <div className="header-actions">
            <button
              className="action-btn primary"
              onClick={runSimulation}
              disabled={simState.status === 'running' || modifications.length === 0 || !serviceAvailable}
            >
              <Play size={18} /> Запустить симуляцию
            </button>
            <button className="action-btn secondary" onClick={resetSimulation}>
              <RotateCcw size={18} /> Сбросить
            </button>
          </div>
        </div>
      </div>

      {/* Основная сетка */}
      <div className="simulation-grid">
        {/* Левая панель - инструменты моделирования */}
        <div className="left-panel">
          <div className="panel-section">
            <h3 className="panel-title"><Settings size={18} /> Режим редактирования</h3>
            <div className="edit-mode-tabs">
              <button className={`mode-tab ${editMode === 'view' ? 'active' : ''}`} onClick={() => setEditMode('view')}>
                <Eye size={16} /> Просмотр
              </button>
              <button className={`mode-tab ${editMode === 'select_stop' ? 'active' : ''}`} onClick={() => {
                setEditMode('select_stop');
                setSelectedStop(null);
                setSelectedRoute(null);
              }}>
                <Plus size={16} /> Выбор остановки
              </button>
              <button className={`mode-tab ${editMode === 'select_route' ? 'active' : ''}`} onClick={() => {
                setEditMode('select_route');
                setSelectedStop(null);
                setSelectedRoute(null);
              }}>
                <RouteIcon size={16} /> Выбор маршрута
              </button>
            </div>
            {editMode === 'select_stop' && (
              <div className="selection-hint"><div className="hint-dot"></div><span>Кликните на остановку на карте</span></div>
            )}

            <div className="panel-section">
              <h3 className="panel-title"><Plus size={18} /> Создание новых элементов</h3>
              <div className="creation-actions">
                <button
                  className={`creation-btn ${creationMode === 'stop' ? 'active' : ''}`}
                  onClick={() => {
                    setCreationMode('stop');
                    setEditMode('view');
                    alert('Кликните на карте, чтобы добавить новую остановку');
                  }}
                >
                  <Bus size={16} /> Добавить остановку
                </button>
                <button
                  className={`creation-btn ${creationMode === 'route' ? 'active' : ''}`}
                  onClick={() => {
                    setCreationMode('route');
                    setEditMode('select_stop');
                    setNewRouteStops([]);
                    alert('Выберите остановки для маршрута в порядке следования');
                  }}
                >
                  <RouteIcon size={16} /> Добавить маршрут
                </button>
              </div>
            </div>
            {/* ====================================== */}

            {/* Индикатор создания маршрута */}
            {creationMode === 'route' && newRouteStops.length > 0 && (
              <div className="panel-section route-creation-indicator">
                <h4>Создание маршрута</h4>
                <p>Выбрано остановок: {newRouteStops.length}</p>
                <div className="selected-stops-list">
                  {newRouteStops.map((stopId, idx) => {
                    const stop = cityStops.find(s => s.id === stopId);
                    return (
                      <div key={idx} className="selected-stop-item">
                        {idx + 1}. {stop?.address || `Остановка ${stopId}`}
                      </div>
                    );
                  })}
                </div>
                <div className="route-creation-actions">
                  <button
                    className="action-btn primary small"
                    onClick={() => setShowNewRouteModal(true)}
                    disabled={newRouteStops.length < 2}
                  >
                    Завершить маршрут
                  </button>
                  <button
                    className="action-btn secondary small"
                    onClick={() => {
                      setNewRouteStops([]);
                      setCreationMode(null);
                    }}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {editMode === 'select_route' && (
              <div className="selection-hint"><div className="hint-dot" style={{ backgroundColor: '#3b82f6' }}></div><span>Кликните на маршрут на карте</span></div>
            )}
          </div>

          {/* Секция создания новых элементов */}
          <div className="panel-section">
            <h3 className="panel-title"><Plus size={18} /> Создание новых элементов</h3>
            <div className="creation-actions">
              <button
                className={`creation-btn ${creationMode === 'stop' ? 'active' : ''}`}
                onClick={() => {
                  setCreationMode('stop');
                  setEditMode('view');
                  alert('Кликните на карте, чтобы добавить новую остановку');
                }}
              >
                <Bus size={16} /> Добавить остановку
              </button>
              <button
                className={`creation-btn ${creationMode === 'route' ? 'active' : ''}`}
                onClick={() => {
                  setCreationMode('route');
                  setEditMode('select_stop');
                  setNewRouteStops([]);
                  alert('Выберите остановки для маршрута в порядке следования');
                }}
              >
                <RouteIcon size={16} /> Добавить маршрут
              </button>
            </div>
          </div>

          {/* Индикатор создания маршрута */}
          {creationMode === 'route' && newRouteStops.length > 0 && (
            <div className="panel-section route-creation-indicator">
              <h4>Создание маршрута</h4>
              <p>Выбрано остановок: {newRouteStops.length}</p>
              <div className="selected-stops-list">
                {newRouteStops.map((stopId, idx) => {
                  const stop = cityStops.find(s => s.id === stopId);
                  return (
                    <div key={idx} className="selected-stop-item">
                      {idx + 1}. {stop?.address || `Остановка ${stopId}`}
                    </div>
                  );
                })}
              </div>
              <div className="route-creation-actions">
                <button
                  className="action-btn primary small"
                  onClick={() => setShowNewRouteModal(true)}
                  disabled={newRouteStops.length < 2}
                >
                  Завершить маршрут
                </button>
                <button
                  className="action-btn secondary small"
                  onClick={() => {
                    setNewRouteStops([]);
                    setCreationMode(null);
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* Выбранная остановка */}
          {selectedStop && (
            <div className="panel-section selected-stop">
              <h3 className="panel-title"><Bus size={18} /> Выбранная остановка</h3>
              <div className="stop-info">
                <div className="stop-address">{selectedStop.address}</div>
                <div className="stop-metrics">
                  <div className="stop-metric"><Users size={14} /><span>Загрузка: {selectedStop.load || selectedStop.avg_load || 0}/10</span></div>
                  <div className="stop-metric"><Clock size={14} /><span>Ср. ожидание: {(selectedStop.avg_wait_time || 8.2).toFixed(1)} мин</span></div>
                  {selectedStop.cluster && (
                    <div className="stop-metric">
                      <span className="cluster-badge">
                        {selectedStop.cluster === 'office' && '🏢 Офис'}
                        {selectedStop.cluster === 'shopping' && '🛍️ ТЦ'}
                        {selectedStop.cluster === 'residential' && '🏘️ Жилой'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {selectedStop.peak_hours && selectedStop.peak_hours.length > 0 && (
                <div className="stop-peak-hours"><small>Пиковые часы: {selectedStop.peak_hours.map(h => `${h}:00`).join(', ')}</small></div>
              )}
              <div className="quick-actions">
                <button className="quick-action-btn" onClick={() => addStopModification('close_stop')}>🚫 Закрыть</button>
                <button className="quick-action-btn" onClick={() => addStopModification('change_interval')}>⏱️ Интервал</button>
                <button className="quick-action-btn" onClick={() => addStopModification('change_capacity')}>📦 Вместимость</button>
              </div>
              {simState.results?.baseStopMetrics?.[selectedStop.id] && (
                <button className="quick-action-btn details" onClick={() => setSelectedStopForMetrics(selectedStop.id)}>
                  <BarChart size={14} /> Детальная статистика
                </button>
              )}
            </div>
          )}

          {/* Выбранный маршрут */}
          {selectedRoute && (
            <div className="panel-section selected-route">
              <h3 className="panel-title"><RouteIcon size={18} /> Выбранный маршрут</h3>
              <div className="route-info">
                <div className="route-number">
                  {selectedRoute.transportType === 'BUS' && '🚌'}
                  {selectedRoute.transportType === 'TROLLEYBUS' && '🚎'}
                  {selectedRoute.transportType === 'TRAM' && '🚊'}
                  {selectedRoute.transportType === 'MINIBUS' && '🚐'} {selectedRoute.number}
                </div>
                {selectedRoute.name && <div className="route-name">{selectedRoute.name}</div>}
                <div className="route-metrics">
                  <div className="route-metric"><Clock size={14} /><span>Интервал: {selectedRoute.intervalMinutes} мин</span></div>
                  <div className="route-metric"><span>Остановок: {selectedRoute.stops?.length || 0}</span></div>
                </div>
              </div>
              <div className="quick-actions">
                <button className="quick-action-btn primary" onClick={addRouteModification}>⏱️ Изменить интервал</button>
              </div>
            </div>
          )}

          {/* Активные изменения */}
          <div className="panel-section">
            <h3 className="panel-title"><Plus size={18} /> Активные изменения ({modifications.length})</h3>
            {modifications.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">⚡</div>
                <p>Нет активных изменений</p>
                <p className="empty-hint">Выберите остановку или маршрут и добавьте изменение</p>
              </div>
            ) : (
              <div className="modifications-list">
                {modifications.map(mod => (
                  <div key={mod.id} className={`modification-item ${!mod.enabled ? 'disabled' : ''}`}>
                    <div className="modification-header">
                      <div className="modification-type">{mod.label || `${mod.type} #${mod.targetId}`}</div>
                      <div className="modification-actions">
                        <button className="mod-action" onClick={() => toggleModification(mod.id)} title={mod.enabled ? 'Отключить' : 'Включить'}>
                          {mod.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button className="mod-action delete" onClick={() => removeModification(mod.id)} title="Удалить">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="modification-details">
                      {mod.targetType === 'stop' && <span className="mod-target">Остановка #{mod.targetId}</span>}
                      {mod.targetType === 'route' && <span className="mod-target">Маршрут #{mod.targetId}</span>}
                      {mod.type === 'close_stop' && mod.parameters.hours && (
                        <span className="mod-params">Часы: {mod.parameters.hours.join(', ')}</span>
                      )}
                      {mod.type === 'change_interval' && mod.parameters.interval && (
                        <span className="mod-params">Новый интервал: {mod.parameters.interval} мин</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Центральная область - карта */}
        <div className="map-area">
          {isLoading ? (
            <div className="loading-overlay">Загрузка остановок и маршрутов...</div>
          ) : (
            <SimulationMap
              markers={cityStops.map(stop => ({ ...stop, color: getStopColor(stop.id) }))}
              routes={cityRoutes}
              onMarkerClick={handleMarkerClick}
              onRouteClick={handleRouteClick}
              onMapClick={handleMapClick}
              selectionMode={editMode !== 'view'}
              creationMode={creationMode}
              selectedStopId={selectedStop?.id}
              selectedRouteId={selectedRoute?.id}
            />
          )}
          {(editMode === 'select_stop' || editMode === 'select_route') && (
            <div className="map-overlay-hint">
              <div className="hint-box">
                <div className="hint-arrow">👆</div>
                <p>{editMode === 'select_stop' ? 'Кликните на остановку на карте' : 'Кликните на маршрут на карте'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Правая панель - результаты */}
        <div className="right-panel">
          {simState.results ? (
            <>
              <div className="metric-tabs">
                <button className={`metric-tab ${activeMetricTab === 'basic' ? 'active' : ''}`} onClick={() => setActiveMetricTab('basic')}>
                  <Activity size={16} /> Основные
                </button>
                <button className={`metric-tab ${activeMetricTab === 'throughput' ? 'active' : ''}`} onClick={() => setActiveMetricTab('throughput')}>
                  <Target size={16} /> Пропускная способность
                </button>
                <button className={`metric-tab ${activeMetricTab === 'distribution' ? 'active' : ''}`} onClick={() => setActiveMetricTab('distribution')}>
                  <PieChart size={16} /> Распределение
                </button>
              </div>

              <div className="right-panel-content">
                {activeMetricTab === 'basic' && (
                  <>
                    <div className="panel-section">
                      <h3 className="panel-title"><TrendingUp size={18} /> Ключевые метрики</h3>
                      <div className="metrics-comparison">
                        <div className="metric-row header">
                          <div className="metric-name">Метрика</div>
                          <div className="metric-base">Было</div>
                          <div className="metric-modified">Стало</div>
                          <div className="metric-change">Δ</div>
                        </div>
                        <div className="metric-row">
                          <div className="metric-name">Ср. время ожидания</div>
                          <div className="metric-base">{simState.results.baseMetrics.avgWaitTime.toFixed(1)} мин</div>
                          <div className="metric-modified">{simState.results.modifiedMetrics.avgWaitTime.toFixed(1)} мин</div>
                          <div className={`metric-change ${simState.results.modifiedMetrics.avgWaitTime > simState.results.baseMetrics.avgWaitTime ? 'negative' : 'positive'}`}>
                            {((simState.results.modifiedMetrics.avgWaitTime / simState.results.baseMetrics.avgWaitTime - 1) * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className="metric-row">
                          <div className="metric-name">Макс. время ожидания</div>
                          <div className="metric-base">{simState.results.baseMetrics.maxWaitTime.toFixed(1)} мин</div>
                          <div className="metric-modified">{simState.results.modifiedMetrics.maxWaitTime.toFixed(1)} мин</div>
                          <div className={`metric-change ${simState.results.modifiedMetrics.maxWaitTime > simState.results.baseMetrics.maxWaitTime ? 'negative' : 'positive'}`}>
                            {((simState.results.modifiedMetrics.maxWaitTime / simState.results.baseMetrics.maxWaitTime - 1) * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className="metric-row">
                          <div className="metric-name">Всего пассажиров</div>
                          <div className="metric-base">{simState.results.baseMetrics.totalPassengers}</div>
                          <div className="metric-modified">{simState.results.modifiedMetrics.totalPassengers}</div>
                          <div className={`metric-change ${simState.results.modifiedMetrics.totalPassengers > simState.results.baseMetrics.totalPassengers ? 'positive' : 'negative'}`}>
                            {((simState.results.modifiedMetrics.totalPassengers / simState.results.baseMetrics.totalPassengers - 1) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="panel-section">
                      <h3 className="panel-title"><Clock size={18} /> Почасовая динамика</h3>
                      <div style={{ width: '100%', height: '200px', marginTop: '8px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={simState.results.hourlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} stroke="#64748b" fontSize={10} />
                            <YAxis yAxisId="left" stroke="#64748b" fontSize={10} label={{ value: 'Пассажиры', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                            <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}
                              formatter={(value: number) => [`${Math.round(value)} пасс.`, '']}
                              labelFormatter={(hour) => `${hour}:00`}
                            />
                            <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} />
                            <Bar yAxisId="left" dataKey="basePassengers" name="Базовый сценарий" fill="#3b82f6" opacity={0.7} radius={[4, 4, 0, 0]} barSize={20} onClick={(data) => data && setSelectedHour(data.hour)} />
                            <Bar yAxisId="left" dataKey="modifiedPassengers" name="С изменениями" fill="#f59e0b" opacity={0.7} radius={[4, 4, 0, 0]} barSize={20} onClick={(data) => data && setSelectedHour(data.hour)} />
                            <Line yAxisId="left" type="monotone" dataKey="modifiedPassengers" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '8px', padding: '4px', fontSize: '11px', color: '#64748b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '2px' }}></div>
                          <span>Базовый</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '8px', height: '8px', background: '#f59e0b', borderRadius: '2px' }}></div>
                          <span>С изменениями</span>
                        </div>
                      </div>
                    </div>

                    <div className="panel-section">
                      <h3 className="panel-title"><AlertTriangle size={18} /> Наиболее затронутые остановки</h3>
                      <div className="affected-stops-list">
                        {simState.results.affectedStops.map(stop => (
                          <div key={stop.id} className={`affected-stop-item ${stop.status}`} onClick={() => {
                            const stopData = cityStops.find(s => s.id === stop.id);
                            if (stopData) setSelectedStop(stopData);
                          }}>
                            <div className="stop-address">{stop.address}</div>
                            <div className="stop-changes">
                              <div className="change-badge load">
                                <span className="change-label">Нагрузка</span>
                                <span className={`change-value ${stop.loadChange > 0 ? 'up' : 'down'}`}>
                                  {stop.loadChange > 0 ? '↑' : '↓'} {Math.abs(stop.loadChange)}%
                                </span>
                              </div>
                              <div className="change-badge wait">
                                <span className="change-label">Ожидание</span>
                                <span className={`change-value ${stop.waitTimeChange > 0 ? 'up' : 'down'}`}>
                                  {stop.waitTimeChange > 0 ? '↑' : '↓'} {Math.abs(stop.waitTimeChange)} мин
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {activeMetricTab === 'throughput' && simState.results.baseThroughput && (
                  <ThroughputMetrics
                    baseThroughput={simState.results.baseThroughput}
                    modifiedThroughput={simState.results.modifiedThroughput}
                  />
                )}

                {activeMetricTab === 'distribution' && simState.results.baseWaitDistribution && (
                  <WaitTimeDistributionChart
                    baseDistribution={simState.results.baseWaitDistribution}
                    modifiedDistribution={simState.results.modifiedWaitDistribution}
                  />
                )}

                <div className="panel-section">
                  <button className="export-btn full-width" onClick={exportResults}>
                    <Download size={18} /> Экспортировать результаты
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-results">
              <div className="empty-icon">📊</div>
              <h3>Нет результатов</h3>
              <p>Добавьте изменения и запустите симуляцию</p>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно создания остановки */}
      {showNewStopModal && newStopPosition && (
        <div className="modal-overlay">
          <div className="modal-content create-stop-modal">
            <h3>➕ Добавление новой остановки</h3>
            <div className="form-group">
              <label>Название остановки:</label>
              <input type="text" placeholder="например: ул. Новая, 10" value={newStopAddress} onChange={(e) => setNewStopAddress(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Координаты:</label>
              <div className="coordinates-display">
                <span>lat: {newStopPosition[1].toFixed(6)}</span>
                <span>lng: {newStopPosition[0].toFixed(6)}</span>
              </div>
            </div>
            <div className="form-group">
              <label>Вместимость (пасс/час):</label>
              <input type="number" min="10" max="200" value={newStopCapacity} onChange={(e) => setNewStopCapacity(parseInt(e.target.value))} />
            </div>
            <div className="form-actions">
              <button className="action-btn primary" onClick={createNewStop}>✅ Добавить</button>
              <button className="action-btn secondary" onClick={() => { setShowNewStopModal(false); setCreationMode(null); }}>❌ Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно создания маршрута */}
      {showNewRouteModal && (
        <div className="modal-overlay">
          <div className="modal-content create-route-modal">
            <h3>🛤️ Создание нового маршрута</h3>
            <div className="form-group">
              <label>Номер маршрута:</label>
              <input type="text" placeholder="например: 15А" value={newRouteNumber} onChange={(e) => setNewRouteNumber(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Название (необязательно):</label>
              <input type="text" placeholder="например: Центр - Северный" value={newRouteName} onChange={(e) => setNewRouteName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Тип транспорта:</label>
              <select value={newRouteType} onChange={(e) => setNewRouteType(e.target.value as any)}>
                <option value="BUS">🚌 Автобус</option>
                <option value="TROLLEYBUS">🚎 Троллейбус</option>
                <option value="TRAM">🚊 Трамвай</option>
                <option value="MINIBUS">🚐 Маршрутка</option>
              </select>
            </div>
            <div className="form-group">
              <label>Интервал (минуты):</label>
              <input type="number" min="1" max="60" value={newRouteInterval} onChange={(e) => setNewRouteInterval(parseInt(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Выбранные остановки ({newRouteStops.length}):</label>
              <div className="selected-stops-preview">
                {newRouteStops.map((stopId, idx) => {
                  const stop = cityStops.find(s => s.id === stopId);
                  return (
                    <div key={idx} className="preview-stop">
                      <span className="stop-order">{idx + 1}</span>
                      <span className="stop-address">{stop?.address || `Остановка ${stopId}`}</span>
                      <button className="remove-stop" onClick={() => setNewRouteStops(prev => prev.filter((_, i) => i !== idx))}>✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="form-actions">
              <button className="action-btn primary" onClick={createNewRoute} disabled={!newRouteNumber || newRouteStops.length < 2}>✅ Создать маршрут</button>
              <button className="action-btn secondary" onClick={() => { setShowNewRouteModal(false); setNewRouteStops([]); setCreationMode(null); }}>❌ Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно детальной статистики остановки */}
      {selectedStopForMetrics && simState.results?.baseStopMetrics && (
        <StopMetricsModal
          stopId={selectedStopForMetrics}
          baseMetrics={simState.results.baseStopMetrics[selectedStopForMetrics]}
          modifiedMetrics={simState.results.modifiedStopMetrics?.[selectedStopForMetrics]}
          onClose={() => setSelectedStopForMetrics(null)}
        />
      )}
    </div>
  );
};

export default SimulationPage;