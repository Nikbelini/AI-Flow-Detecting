// src/pages/SimulationPage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './SimulationPage.css';
import SimulationMap, { type MapRoute } from './Map/SimulationMap';
import { useStops } from '../hooks/api/useStops';
import { useRoutes } from '../hooks/api/useRoutes';
import {
  Play, RotateCcw, Download, Eye, EyeOff,
  Clock, Users, Bus, TrendingUp,
  Plus, Trash2, Settings, Route as RouteIcon,
  PieChart, Activity, Target, Save,
} from 'lucide-react';
import type { Stop } from '../api/types';
import StopMetricsModal from '../components/modal/StopMetricsModal';
import ThroughputMetrics from '../components/ThroughputMetrics';
import WaitTimeDistributionChart from '../components/WaitTimeDistributionChart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart
} from 'recharts';
import KeyMetrics from '../components/KeyMetrics';
import AffectedStopsList from '../components/AffectedStopsList';
import ScenarioManager from '../components/ScenarioManager';

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

type ModificationType = 'close_stop' | 'add_stop' | 'change_interval' | 'change_capacity' | 'add_route' | 'delete_route';

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
  const [cityStops, setCityStops] = useState<ExtendedStop[]>([]);
  const [cityRoutes, setCityRoutes] = useState<MapRoute[]>([]);
  const [serviceAvailable, setServiceAvailable] = useState(true);

  // Состояния для создания элементов
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
  const [showResultsModal, setShowResultsModal] = useState(false);

  const CITY_ID = 1;

  const [showStops, setShowStops] = useState(true);
  const [searchRouteQuery, setSearchRouteQuery] = useState('');
  const [filteredRouteIds, setFilteredRouteIds] = useState<Set<number>>(new Set());

  // Используем реактивные данные из хуков
  const {
    getStops,
    stops: stopsFromQuery,
    isLoading: stopsLoading
  } = useStops();

  const {
    getAllRoutes,
    routes: routesFromQuery,
    isLoading: routesLoading
  } = useRoutes();

  // Флаг для предотвращения двойной загрузки
  const initialLoadDone = useRef(false);

  // Реактивное обновление остановок из React Query
  useEffect(() => {
    if (stopsFromQuery && stopsFromQuery.length > 0) {
      const stopsWithCoords: ExtendedStop[] = stopsFromQuery.map((stop: any) => ({
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
      setCityStops(stopsWithCoords);
      console.log('✅ Остановки обновлены из кэша:', stopsWithCoords.length);
    }
  }, [stopsFromQuery, CITY_ID]);

  // Реактивное обновление маршрутов из React Query
  useEffect(() => {
    if (routesFromQuery && routesFromQuery.length > 0) {
      const routesForMap: MapRoute[] = routesFromQuery.map((route: any) => {
        const path = generateRoutePath(route.stops || [], cityStops);
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
      setCityRoutes(routesForMap);
      console.log('✅ Маршруты обновлены из кэша:', routesForMap.length);
    }
  }, [routesFromQuery, cityStops]);

  // Проверка здоровья сервиса при монтировании
  useEffect(() => {
    const checkServiceHealth = async () => {
      try {
        const healthResponse = await fetch('http://localhost:8084/health');
        const healthData = await healthResponse.json();
        setServiceAvailable(healthData.status === 'healthy');
      } catch (error) {
        console.error('❌ Сервис моделирования недоступен:', error);
        setServiceAvailable(false);
      }
    };
    checkServiceHealth();
  }, []);

  // Триггер загрузки данных (один раз при монтировании)
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      getStops().catch(console.error);
      getAllRoutes().catch(console.error);
    }
  }, [getStops, getAllRoutes]);

  // Загрузка маршрутов из modeling-service (дополнительно)
  useEffect(() => {
    const loadRoutesFromModelingService = async () => {
      if (!serviceAvailable) return;

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

    loadRoutesFromModelingService();
  }, [serviceAvailable]);

  const isLoading = (stopsLoading || routesLoading) && cityStops.length === 0 && cityRoutes.length === 0;

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

  // ========== НОВАЯ ФУНКЦИЯ: Удаление маршрута ==========
  const addDeleteRouteModification = async () => {
    if (!selectedRoute) {
      alert('⚠️ Сначала выберите маршрут на карте');
      return;
    }
    if (!selectedRoute.id) {
      console.error('❌ У выбранного маршрута нет ID:', selectedRoute);
      alert('❌ Ошибка: не удалось получить ID маршрута');
      return;
    }

    // Подтверждение удаления
    const confirmed = confirm(
      `⚠️ Вы уверены, что хотите удалить маршрут ${selectedRoute.number}?\n\n` +
      `Это повлияет на ${selectedRoute.stops?.length || 0} остановок и может значительно ухудшить транспортную доступность.`
    );

    if (!confirmed) return;

    const newMod: Modification = {
      id: Date.now().toString(),
      type: 'delete_route',
      targetType: 'route',
      targetId: selectedRoute.id,
      parameters: {},
      enabled: true,
      label: `🗑️ Удаление маршрута ${selectedRoute.number}`
    };

    console.log('🗑️ Добавление модификации удаления маршрута:', newMod);
    const validation = await validateModifications([newMod]);
    if (!validation.valid) {
      console.error('❌ Валидация не пройдена:', validation.errors);
      alert('❌ Изменение не прошло валидацию: ' + (validation.errors?.[0]?.error || 'Неизвестная ошибка'));
      return;
    }
    setModifications(prev => [...prev, newMod]);
  };

  // ========== Функции создания ==========

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

          {/* Панель управления картой */}
          <div className="panel-section map-controls">
            <h3 className="panel-title">
              <Settings size={18} />
              Управление картой
            </h3>

            <div className="map-toggle">
              <div className="toggle-label">
                <Bus size={16} />
                <span>Показывать остановки</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showStops}
                  onChange={(e) => setShowStops(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>

            <div className="route-search">
              <div className="search-header">
                <RouteIcon size={16} />
                <span>Фильтр маршрутов</span>
              </div>
              <div className="search-input-wrapper">
                <input
                  type="text"
                  className="route-search-input"
                  placeholder="Поиск по номеру или названию..."
                  value={searchRouteQuery}
                  onChange={(e) => {
                    const query = e.target.value.toLowerCase();
                    setSearchRouteQuery(query);

                    if (query.trim() === '') {
                      setFilteredRouteIds(new Set());
                    } else {
                      const filtered = cityRoutes
                        .filter(route =>
                          route.number?.toLowerCase().includes(query) ||
                          route.name?.toLowerCase().includes(query)
                        )
                        .map(route => route.id);
                      setFilteredRouteIds(new Set(filtered));
                    }
                  }}
                />
                {searchRouteQuery && (
                  <button
                    className="clear-search"
                    onClick={() => {
                      setSearchRouteQuery('');
                      setFilteredRouteIds(new Set());
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {searchRouteQuery && (
                <div className="search-results-count">
                  Найдено маршрутов: {filteredRouteIds.size}
                </div>
              )}

              {searchRouteQuery && filteredRouteIds.size > 0 && (
                <div className="search-results-list">
                  {cityRoutes
                    .filter(route => filteredRouteIds.has(route.id))
                    .slice(0, 5)
                    .map(route => (
                      <div
                        key={route.id}
                        className="search-result-item"
                        onClick={() => {
                          setSelectedRoute(route);
                          setEditMode('select_route');
                        }}
                      >
                        <span className="route-number">{route.number}</span>
                        <span className="route-name">{route.name}</span>
                      </div>
                    ))}
                  {filteredRouteIds.size > 5 && (
                    <div className="search-more">и ещё {filteredRouteIds.size - 5}...</div>
                  )}
                </div>
              )}
            </div>

            {(searchRouteQuery || !showStops) && (
              <button
                className="reset-filters-btn"
                onClick={() => {
                  setSearchRouteQuery('');
                  setFilteredRouteIds(new Set());
                  setShowStops(true);
                }}
              >
                <RotateCcw size={14} />
                Сбросить все фильтры
              </button>
            )}
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
              </div>
              {simState.results?.baseStopMetrics?.[selectedStop.id] && (
                <button className="quick-action-btn details" onClick={() => setSelectedStopForMetrics(selectedStop.id)}>
                  <BarChart size={14} /> Детальная статистика
                </button>
              )}
            </div>
          )}

          {/* Выбранный маршрут - ДОБАВЛЕНА КНОПКА УДАЛЕНИЯ */}
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
                <button className="quick-action-btn primary" onClick={addRouteModification}>
                  ⏱️ Изменить интервал
                </button>
                <button className="quick-action-btn delete" onClick={addDeleteRouteModification}>
                  🗑️ Удалить маршрут
                </button>
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
                      {mod.type === 'delete_route' && (
                        <span className="mod-params delete-route">⚠️ Маршрут будет удалён</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ===== КОМПОНЕНТ УПРАВЛЕНИЯ СЦЕНАРИЯМИ ===== */}
          <div className="panel-section">
            <h3 className="panel-title">
              <Save size={18} /> Сценарии
            </h3>
            <ScenarioManager
              cityId={CITY_ID}
              currentModifications={modifications}
              onLoadScenario={(loadedMods) => {
                setModifications(loadedMods);
                setSimState(prev => ({ ...prev, status: 'idle', results: null }));
              }}
              onScenarioSaved={() => {
                console.log('Сценарий сохранён');
              }}
              disabled={simState.status === 'running'}
            />
          </div>

          {/* Блок результатов симуляции */}
          <div className="panel-section results-section">
            <h3 className="panel-title">
              <TrendingUp size={18} /> Результаты симуляции
            </h3>

            {simState.results ? (
              <div className="results-preview">
                <div className="results-preview-stats">
                  <div className="preview-stat">
                    <span>Ср. время ожидания:</span>
                    <strong>{simState.results.modifiedMetrics.avgWaitTime.toFixed(1)} мин</strong>
                    <span className={`preview-delta ${simState.results.modifiedMetrics.avgWaitTime > simState.results.baseMetrics.avgWaitTime ? 'negative' : 'positive'}`}>
                      {((simState.results.modifiedMetrics.avgWaitTime / simState.results.baseMetrics.avgWaitTime - 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="preview-stat">
                    <span>Всего пассажиров:</span>
                    <strong>{simState.results.modifiedMetrics.totalPassengers}</strong>
                    <span className={`preview-delta ${simState.results.modifiedMetrics.totalPassengers > simState.results.baseMetrics.totalPassengers ? 'positive' : 'negative'}`}>
                      {((simState.results.modifiedMetrics.totalPassengers / simState.results.baseMetrics.totalPassengers - 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="results-actions">
                  <button className="open-results-btn" onClick={() => setShowResultsModal(true)}>
                    📊 Открыть полные результаты
                  </button>
                  <button className="export-btn-small" onClick={exportResults}>
                    <Download size={14} /> Экспорт
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-results-preview">
                <div className="empty-icon">📊</div>
                <p>Нет результатов</p>
                <p className="empty-hint">Добавьте изменения и запустите симуляцию</p>
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
              showStops={showStops}
              filteredRouteIds={filteredRouteIds}
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
      </div>

      {/* ИСПРАВЛЕННОЕ Модальное окно создания маршрута */}
      {showNewRouteModal && (
        <div className="modal-overlay" onClick={() => {
          setShowNewRouteModal(false);
          setNewRouteStops([]);
          setCreationMode(null);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>

            {/* 1. ШАПКА (было просто h3) */}
            <div className="modal-header">
              <h3>🛤️ Создание нового маршрута</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowNewRouteModal(false);
                  setNewRouteStops([]);
                  setCreationMode(null);
                }}
              >
                ✕
              </button>
            </div>

            {/* 2. ТЕЛО С ПРОКРУТКОЙ (было modal-body-scroll) */}
            <div className="modal-body">
              <div className="form-group">
                <label>Номер маршрута:</label>
                <input
                  type="text"
                  placeholder="например: 15А"
                  value={newRouteNumber}
                  onChange={(e) => setNewRouteNumber(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Название (необязательно):</label>
                <input
                  type="text"
                  placeholder="например: Центр - Северный"
                  value={newRouteName}
                  onChange={(e) => setNewRouteName(e.target.value)}
                />
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
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={newRouteInterval}
                  onChange={(e) => setNewRouteInterval(parseInt(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Выбранные остановки ({newRouteStops.length}):</label>
                <div className="selected-stops-preview">
                  {newRouteStops.length === 0 ? (
                    <div className="empty-stops-message">
                      <span>👆 Кликните на остановки на карте</span>
                    </div>
                  ) : (
                    newRouteStops.map((stopId, idx) => {
                      const stop = cityStops.find(s => s.id === stopId);
                      return (
                        <div key={idx} className="preview-stop">
                          <span className="stop-order">{idx + 1}</span>
                          <span className="stop-address">{stop?.address || `Остановка ${stopId}`}</span>
                          <button
                            className="remove-stop"
                            onClick={() => setNewRouteStops(prev => prev.filter((_, i) => i !== idx))}
                            title="Удалить из маршрута"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* 3. ФУТЕР (было form-actions) */}
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowNewRouteModal(false);
                  setNewRouteStops([]);
                  setCreationMode(null);
                }}
              >
                ❌ Отмена
              </button>
              <button
                className="btn-primary"
                onClick={createNewRoute}
                disabled={!newRouteNumber || newRouteStops.length < 2}
              >
                ✅ Создать маршрут
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно создания остановки */}
      {showNewStopModal && newStopPosition && (
        <div className="modal-overlay" onClick={() => {
          setShowNewStopModal(false);
          setCreationMode(null);
        }}>
          <div className="modal-content create-stop-modal" onClick={(e) => e.stopPropagation()}>
            <h3>➕ Добавление новой остановки</h3>

            <div className="form-group">
              <label>Название остановки:</label>
              <input
                type="text"
                placeholder="например: ул. Новая, 10"
                value={newStopAddress}
                onChange={(e) => setNewStopAddress(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Координаты:</label>
              <div className="coordinates-display">
                <span>широта: {newStopPosition[1].toFixed(6)}</span>
                <span>долгота: {newStopPosition[0].toFixed(6)}</span>
              </div>
            </div>

            <div className="form-group">
              <label>Вместимость (пасс/час):</label>
              <input
                type="number"
                min="10"
                max="200"
                value={newStopCapacity}
                onChange={(e) => setNewStopCapacity(parseInt(e.target.value))}
              />
            </div>

            <div className="form-actions">
              <button
                className="action-btn secondary"
                onClick={() => {
                  setShowNewStopModal(false);
                  setCreationMode(null);
                }}
              >
                ❌ Отмена
              </button>
              <button className="action-btn primary" onClick={createNewStop}>
                ✅ Добавить остановку
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно с полными результатами */}
      {showResultsModal && simState.results && (
        <div className="modal-overlay results-modal-overlay" onClick={() => setShowResultsModal(false)}>
          <div className="modal-content results-modal" onClick={(e) => e.stopPropagation()}>
            <div className="results-modal-header">
              <h2>📊 Результаты моделирования</h2>
              <button className="close-modal-btn" onClick={() => setShowResultsModal(false)}>✕</button>
            </div>

            <div className="results-modal-content">
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

              <div className="results-modal-body">
                {activeMetricTab === 'basic' && (
                  <>
                    <KeyMetrics
                      baseMetrics={simState.results.baseMetrics}
                      modifiedMetrics={simState.results.modifiedMetrics}
                    />

                    <div className="panel-section">
                      <h3 className="panel-title"><Clock size={18} /> Почасовая динамика</h3>
                      <div style={{ width: '100%', height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={simState.results.hourlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} stroke="#64748b" fontSize={11} />
                            <YAxis yAxisId="left" stroke="#64748b" fontSize={11} label={{ value: 'Пассажиры', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Legend />
                            <Bar yAxisId="left" dataKey="basePassengers" name="Базовый сценарий" fill="#3b82f6" opacity={0.7} radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar yAxisId="left" dataKey="modifiedPassengers" name="С изменениями" fill="#f59e0b" opacity={0.7} radius={[4, 4, 0, 0]} barSize={20} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <AffectedStopsList
                      stops={simState.results.affectedStops}
                      onStopClick={(stopId) => {
                        const stop = cityStops.find(s => s.id === stopId);
                        if (stop) setSelectedStop(stop);
                      }}
                    />
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
              </div>

              <div className="results-modal-footer">
                <button className="export-btn" onClick={exportResults}>
                  <Download size={18} /> Экспортировать результаты (JSON)
                </button>
                <button className="close-btn" onClick={() => setShowResultsModal(false)}>
                  Закрыть
                </button>
              </div>
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