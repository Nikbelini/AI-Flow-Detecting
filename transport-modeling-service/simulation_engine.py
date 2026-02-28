# transport-modeling-service/simulation_engine.py
import numpy as np
import logging
import copy
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import math

from data_models import (
    SimulationResults, Metrics, HourlyData, AffectedStop,
    Modification, ModificationTarget, ModificationType, AffectedStopStatus
)

logger = logging.getLogger(__name__)

class SimulationEngine:
    """
    Движок моделирования с реальной физикой процессов
    """
    
    def __init__(self, cache_service, db_service):
        self.cache = cache_service
        self.db = db_service
        # Константы
        self.BUS_CAPACITY = 50  # вместимость одного автобуса
        self.WALKING_RADIUS = 500  # метров, радиус перераспределения
    
    async def run(
        self,
        city_id: int,
        modifications: List[Modification],
        stops_data: List[Dict]
    ) -> SimulationResults:
        """
        Запуск симуляции с учётом маршрутов
        """
        logger.info(f"🏁 Запуск симуляции для города {city_id}")
        
        # Фильтруем только включенные модификации
        active_mods = [m for m in modifications if m.enabled]
        
        # Получаем маршруты города
        try:
            routes_data = await self.db.get_routes_with_path(city_id)
            logger.info(f"🛤️ Загружено {len(routes_data)} маршрутов")
        except Exception as e:
            logger.warning(f"⚠️ Не удалось загрузить маршруты: {e}")
            routes_data = []
        
        # 1. Строим полную модель сети
        network = self._build_network_model(stops_data, routes_data)
        
        # 2. Применяем изменения к сети
        modified_network = self._apply_modifications(network, active_mods)
        
        # 3. Запускаем почасовую симуляцию
        base_hourly, modified_hourly = self._simulate_day(
            network, 
            modified_network,
            active_mods
        )
        
        # 4. Считаем метрики
        base_metrics = self._calculate_metrics_from_hourly(base_hourly, network)
        modified_metrics = self._calculate_metrics_from_hourly(modified_hourly, modified_network)
        
        # 5. Находим наиболее затронутые остановки
        affected_stops = self._find_affected_stops(
            network,
            modified_network,
            stops_data
        )
        
        # 6. Формируем почасовые данные для графика
        hourly_data = []
        for hour in range(24):
            hourly_data.append(HourlyData(
                hour=hour,
                basePassengers=float(base_hourly[hour]["total_passengers"]),
                modifiedPassengers=float(modified_hourly[hour]["total_passengers"]),
                baseWaitTime=float(base_hourly[hour]["avg_wait_time"]),
                modifiedWaitTime=float(modified_hourly[hour]["avg_wait_time"])
            ))
        
        results = SimulationResults(
            baseMetrics=base_metrics,
            modifiedMetrics=modified_metrics,
            hourlyData=hourly_data,
            affectedStops=affected_stops
        )
        
        logger.info(f"✅ Симуляция завершена")
        
        return results
    
    def _build_network_model(self, stops_data: List[Dict], routes_data: List[Dict]) -> Dict:
        """
        Построение полной модели транспортной сети
        """
        network = {
            "stops": {},
            "routes": {},
            "stop_connections": {},  # связи между остановками
            "stop_routes": {}        # какие маршруты через остановку
        }
        
        # 1. Добавляем остановки
        for stop in stops_data:
            stop_id = stop["id"]
            
            # Безопасно получаем координаты
            lng = stop.get("lng", 0)
            lat = stop.get("lat", 0)
            
            # Если координаты пришли как строка - конвертируем
            if isinstance(lng, str):
                try:
                    lng = float(lng.strip())
                except (ValueError, TypeError):
                    lng = 0.0
                    logger.warning(f"⚠️ Некорректная долгота для остановки {stop_id}: {stop.get('lng')}")
            
            if isinstance(lat, str):
                try:
                    lat = float(lat.strip())
                except (ValueError, TypeError):
                    lat = 0.0
                    logger.warning(f"⚠️ Некорректная широта для остановки {stop_id}: {stop.get('lat')}")
            
            network["stops"][stop_id] = {
                "id": stop_id,
                "address": stop.get("address", f"Остановка {stop_id}"),
                "lat": lat,
                "lng": lng,
                "pattern": stop.get("avg_pattern", [5] * 24),  # базовый спрос по часам
                "base_load": stop.get("avg_load", 3),
                "cluster": stop.get("cluster", "unknown"),
                "peak_hours": stop.get("peak_hours", []),
                "capacity": 50,  # базовая вместимость остановки
                "routes": []      # будет заполнено позже
            }
        
        # 2. Добавляем маршруты и строим связи
        for route in routes_data:
            route_id = route["id"]
            route_stops = route.get("stops", [])
            
            # Интервал маршрута
            interval = route.get("interval_minutes", 15)
            
            network["routes"][route_id] = {
                "id": route_id,
                "number": route.get("number", ""),
                "base_interval": interval,
                "current_interval": interval,  # может быть изменён
                "stops": route_stops,
                "transport_type": route.get("transport_type", "BUS"),
                "frequency": 60 / max(interval, 1),  # транспорта в час
                "capacity_per_hour": (60 / max(interval, 1)) * self.BUS_CAPACITY
            }
            
            # Добавляем маршрут к каждой остановке
            for i, stop_id in enumerate(route_stops):
                if stop_id in network["stops"]:
                    if "routes" not in network["stops"][stop_id]:
                        network["stops"][stop_id]["routes"] = []
                    
                    # Добавляем информацию о маршруте на этой остановке
                    route_info = {
                        "route_id": route_id,
                        "order": i,
                        "interval": interval
                    }
                    network["stops"][stop_id]["routes"].append(route_info)
                    
                    # Добавляем в обратный индекс
                    if stop_id not in network["stop_routes"]:
                        network["stop_routes"][stop_id] = []
                    network["stop_routes"][stop_id].append(route_id)
        
        # 3. Строим связи между остановками (кто с кем соединён маршрутами)
        for route_id, route in network["routes"].items():
            stops = route["stops"]
            for i in range(len(stops) - 1):
                stop_a = stops[i]
                stop_b = stops[i + 1]
                
                # Добавляем связь в обе стороны
                key = f"{min(stop_a, stop_b)}:{max(stop_a, stop_b)}"
                if key not in network["stop_connections"]:
                    network["stop_connections"][key] = []
                
                connection = {
                    "route_id": route_id,
                    "from_stop": stop_a,
                    "to_stop": stop_b,
                    "travel_time": 5  # минут, в реальности из БД
                }
                network["stop_connections"][key].append(connection)
        
        logger.info(f"🏗️ Построена сеть: {len(network['stops'])} остановок, {len(network['routes'])} маршрутов")
        
        return network
    
    def _apply_modifications(self, network: Dict, modifications: List[Modification]) -> Dict:
        """
        Применение изменений к сети (создаём копию с изменениями)
        """
        # Глубокое копирование
        modified = copy.deepcopy(network)
        
        for mod in modifications:
            if mod.type == ModificationType.CLOSE_STOP:
                self._apply_close_stop(modified, mod)
            
            elif mod.type == ModificationType.CHANGE_INTERVAL:
                self._apply_change_interval(modified, mod)
            
            elif mod.type == ModificationType.CHANGE_CAPACITY:
                self._apply_change_capacity(modified, mod)
        
        return modified
    
    def _apply_close_stop(self, network: Dict, mod: Modification):
        """
        Применение закрытия остановки
        """
        stop_id = mod.targetId
        hours = mod.parameters.get("hours", [7, 8, 9, 17, 18, 19])
        
        if stop_id in network["stops"]:
            network["stops"][stop_id]["closed_hours"] = hours
            logger.info(f"🚫 Закрыта остановка {stop_id} в часы {hours}")
    
    def _apply_change_interval(self, network: Dict, mod: Modification):
        """
        Изменение интервала маршрута
        """
        route_id = mod.targetId
        new_interval = mod.parameters.get("interval", 15)
        
        if route_id in network["routes"]:
            old_interval = network["routes"][route_id]["current_interval"]
            network["routes"][route_id]["current_interval"] = new_interval
            network["routes"][route_id]["frequency"] = 60 / max(new_interval, 1)
            network["routes"][route_id]["capacity_per_hour"] = (60 / max(new_interval, 1)) * self.BUS_CAPACITY
            
            logger.info(f"⏱️ Маршрут {route_id}: интервал {old_interval} → {new_interval} мин")
    
    def _apply_change_capacity(self, network: Dict, mod: Modification):
        """
        Изменение вместимости остановки
        """
        stop_id = mod.targetId
        new_capacity = mod.parameters.get("capacity", 50)
        
        if stop_id in network["stops"]:
            network["stops"][stop_id]["capacity"] = new_capacity
            logger.info(f"📦 Остановка {stop_id}: вместимость → {new_capacity}")
    
    def _simulate_day(
        self, 
        base_network: Dict, 
        modified_network: Dict,
        modifications: List[Modification]
    ) -> Tuple[List[Dict], List[Dict]]:
        """
        Почасовая симуляция всего дня
        Возвращает почасовые метрики для базового и изменённого сценариев
        """
        base_hourly = []
        modified_hourly = []
        
        # Состояние накопленных пассажиров (кто не уехал)
        base_carryover = {stop_id: 0 for stop_id in base_network["stops"]}
        modified_carryover = {stop_id: 0 for stop_id in modified_network["stops"]}
        
        for hour in range(24):
            # Базовый сценарий
            base_result = self._simulate_hour(
                base_network,
                hour,
                base_carryover,
                modifications=[]
            )
            base_hourly.append(base_result)
            base_carryover = base_result["carryover"]
            
            # Модифицированный сценарий
            modified_result = self._simulate_hour(
                modified_network,
                hour,
                modified_carryover,
                modifications=[m for m in modifications if m.enabled]
            )
            modified_hourly.append(modified_result)
            modified_carryover = modified_result["carryover"]
        
        return base_hourly, modified_hourly
    
    def _simulate_hour(
        self,
        network: Dict,
        hour: int,
        carryover: Dict[int, float],
        modifications: List[Modification]
    ) -> Dict:
        """
        Симуляция одного часа
        """
        hour_result = {
            "total_passengers": 0,
            "total_departed": 0,
            "total_waiting": 0,
            "avg_wait_time": 0,
            "stops": {},
            "carryover": {}
        }
        
        wait_times = []
        
        # Сначала собираем информацию о закрытых остановках
        closed_stops = []
        for stop_id, stop in network["stops"].items():
            closed_hours = stop.get("closed_hours", [])
            if hour in closed_hours:
                closed_stops.append(stop_id)
        
        # Для каждой остановки считаем пассажиров и отток
        for stop_id, stop in network["stops"].items():
            # 1. Пассажиры в этом часе
            base_passengers = stop.get("pattern", [5]*24)[hour]
            
            # Добавляем redistributed пассажиров с закрытых остановок
            redistributed = stop.get("redistributed", {}).get(hour, 0)
            
            # Добавляем накопленных с прошлого часа
            total_passengers = base_passengers + redistributed + carryover.get(stop_id, 0)
            
            # Если остановка закрыта
            if hour in stop.get("closed_hours", []):
                # Пассажиры перераспределяются на соседние остановки
                self._redistribute_passengers(
                    network, stop_id, total_passengers, hour, closed_stops
                )
                hour_result["stops"][stop_id] = {
                    "passengers": total_passengers,
                    "departed": 0,
                    "waiting": total_passengers,
                    "wait_time": float('inf')
                }
                # !!! ВАЖНО: не теряем пассажиров, они перераспределены
                hour_result["carryover"][stop_id] = 0
                # Добавляем в общую статистику
                hour_result["total_passengers"] += total_passengers
                hour_result["total_waiting"] += total_passengers
                continue
            
            # 2. Получаем маршруты этой остановки
            route_ids = network["stop_routes"].get(stop_id, [])
            
            if not route_ids:
                # Нет маршрутов - никто не уезжает
                hour_result["stops"][stop_id] = {
                    "passengers": total_passengers,
                    "departed": 0,
                    "waiting": total_passengers,
                    "wait_time": float('inf')
                }
                hour_result["carryover"][stop_id] = total_passengers
                hour_result["total_passengers"] += total_passengers
                hour_result["total_waiting"] += total_passengers
                continue
            
            # 3. Считаем общую пропускную способность
            total_capacity = 0
            route_intervals = []
            
            for route_id in route_ids:
                if route_id in network["routes"]:
                    route = network["routes"][route_id]
                    capacity = route["capacity_per_hour"]
                    total_capacity += capacity
                    route_intervals.append(route["current_interval"])
            
            # 4. Сколько реально уедет
            departed = min(total_passengers, total_capacity)
            waiting = total_passengers - departed
            
            # 5. Время ожидания
            if total_capacity > 0:
                utilization = departed / total_capacity
                
                if route_intervals:
                    effective_interval = 1 / sum(1/i for i in route_intervals)
                else:
                    effective_interval = 15
                
                if utilization < 0.95:
                    wait_time = (effective_interval / 2) * (1 + (utilization**2) / (1 - utilization))
                else:
                    wait_time = effective_interval * 5
            else:
                wait_time = float('inf')
            
            # Сохраняем результаты
            hour_result["stops"][stop_id] = {
                "passengers": total_passengers,
                "departed": departed,
                "waiting": waiting,
                "wait_time": wait_time,
                "utilization": departed / total_capacity if total_capacity > 0 else 0
            }
            
            hour_result["total_passengers"] += total_passengers
            hour_result["total_departed"] += departed
            hour_result["total_waiting"] += waiting
            
            if not math.isinf(wait_time) and wait_time > 0:
                wait_times.append(wait_time)
            
            # Накопленные пассажиры переходят на следующий час
            hour_result["carryover"][stop_id] = waiting
        
        # Среднее время ожидания
        if wait_times:
            hour_result["avg_wait_time"] = np.mean(wait_times)
        else:
            hour_result["avg_wait_time"] = 0
        
        return hour_result

    def _redistribute_passengers(
        self,
        network: Dict,
        closed_stop_id: int,
        passengers: float,
        hour: int,
        all_closed_stops: List[int]
    ):
        """
        Перераспределение пассажиров с закрытой остановки на соседние
        """
        if passengers == 0:
            return
        
        closed_stop = network["stops"].get(closed_stop_id)
        if not closed_stop:
            return
        
        # Ищем соседние остановки (упрощённо - по координатам)
        nearby_stops = self._find_nearby_stops(network, closed_stop_id, radius=self.WALKING_RADIUS)
        
        # Исключаем закрытые остановки
        nearby_stops = [s for s in nearby_stops if s not in all_closed_stops]
        
        if not nearby_stops:
            # Нет соседних остановок - пассажиры никуда не идут
            return
        
        # Считаем общую вместимость соседей
        total_capacity = 0
        for stop_id in nearby_stops:
            if stop_id in network["stops"]:
                # Вместимость зависит от количества маршрутов
                route_count = len(network["stop_routes"].get(stop_id, []))
                total_capacity += route_count * 50  # пропорционально маршрутам
        
        if total_capacity == 0:
            return
        
        # Распределяем пассажиров пропорционально вместимости
        for stop_id in nearby_stops:
            if stop_id in network["stops"]:
                route_count = len(network["stop_routes"].get(stop_id, []))
                stop_capacity = route_count * 50
                share = stop_capacity / total_capacity
                
                # Добавляем пассажиров к паттерну этого часа
                # (в реальности это сложнее, но для симуляции - ок)
                if "redistributed" not in network["stops"][stop_id]:
                    network["stops"][stop_id]["redistributed"] = {}
                
                if hour not in network["stops"][stop_id]["redistributed"]:
                    network["stops"][stop_id]["redistributed"][hour] = 0
                
                network["stops"][stop_id]["redistributed"][hour] += passengers * share
        
        logger.debug(f"🔄 Перераспределено {passengers:.0f} пассажиров с {closed_stop_id} на {len(nearby_stops)} остановок")
    
    def _find_nearby_stops(self, network: Dict, stop_id: int, radius: float) -> List[int]:
        """
        Поиск остановок в радиусе (по координатам)
        """
        stop = network["stops"].get(stop_id)
        if not stop:
            return []
        
        stop_lat = stop.get("lat", 0)
        stop_lng = stop.get("lng", 0)
        
        nearby = []
        
        # Проходим по всем остановкам
        for sid, s in network["stops"].items():
            if sid == stop_id:
                continue
            
            s_lat = s.get("lat", 0)
            s_lng = s.get("lng", 0)
            
            # Грубое расстояние (градусы -> метры: 1 градус ~ 111 км)
            # Для простоты используем манхэттенское расстояние
            lat_diff = abs(stop_lat - s_lat) * 111000
            lng_diff = abs(stop_lng - s_lng) * 111000 * math.cos(math.radians(stop_lat))
            distance = math.sqrt(lat_diff**2 + lng_diff**2)
            
            if distance <= radius:
                nearby.append(sid)
        
        return nearby[:5]  # не больше 5 соседей
    
    def _calculate_metrics_from_hourly(self, hourly_data: List[Dict], network: Dict) -> Metrics:
        """
        Расчёт метрик из почасовых данных
        """
        if not hourly_data:
            return Metrics(
                avgWaitTime=0,
                maxWaitTime=0,
                totalPassengers=0,
                avgLoad=0,
                transportUtilization=0
            )
        
        # Среднее время ожидания (средневзвешенное по пассажирам)
        total_passengers = sum(h["total_passengers"] for h in hourly_data)
        if total_passengers > 0:
            weighted_wait = sum(
                h["avg_wait_time"] * h["total_passengers"] 
                for h in hourly_data if h["avg_wait_time"] != float('inf')
            ) / total_passengers
        else:
            weighted_wait = 0
        
        # Максимальное время ожидания
        max_wait = max((h["avg_wait_time"] for h in hourly_data if h["avg_wait_time"] != float('inf')), default=0)
        
        # Общее количество пассажиров
        total_pass = int(total_passengers)
        
        # Средняя загрузка (из состояния остановок)
        loads = [stop.get("base_load", 3) for stop in network["stops"].values()]
        avg_load = np.mean(loads) if loads else 0
        
        # Использование транспорта
        utilizations = []
        for hour_data in hourly_data:
            for stop_result in hour_data["stops"].values():
                if "utilization" in stop_result:
                    utilizations.append(stop_result["utilization"])
        
        avg_util = np.mean(utilizations) if utilizations else 0.5
        
        return Metrics(
            avgWaitTime=float(weighted_wait),
            maxWaitTime=float(max_wait),
            totalPassengers=total_pass,
            avgLoad=float(avg_load),
            transportUtilization=float(avg_util)
        )
    
    def _find_affected_stops(
        self,
        base_network: Dict,
        modified_network: Dict,
        stops_data: List[Dict]
    ) -> List[AffectedStop]:
        """
        Поиск остановок, наиболее затронутых изменениями
        """
        affected = []
        
        for stop_data in stops_data:
            stop_id = stop_data["id"]
            
            # Базовая пропускная способность
            base_routes = base_network["stop_routes"].get(stop_id, [])
            base_capacity = sum(
                base_network["routes"][r]["capacity_per_hour"] 
                for r in base_routes if r in base_network["routes"]
            )
            
            # Модифицированная пропускная способность
            mod_routes = modified_network["stop_routes"].get(stop_id, [])
            mod_capacity = sum(
                modified_network["routes"][r]["capacity_per_hour"] 
                for r in mod_routes if r in modified_network["routes"]
            )
            
            # Изменение пропускной способности
            if base_capacity > 0:
                capacity_change = ((mod_capacity - base_capacity) / base_capacity) * 100
            else:
                capacity_change = 0
            
            # Загрузка (упрощённо)
            base_load = stop_data.get("avg_load", 3)
            # Предполагаем, что загрузка обратно пропорциональна пропускной способности
            if mod_capacity > 0 and base_capacity > 0:
                load_change = base_load * (base_capacity / mod_capacity - 1)
            else:
                load_change = 0
            
            # Время ожидания
            wait_change = 0
            if base_capacity > 0 and mod_capacity > 0:
                # Грубая оценка: время ожидания обратно пропорционально пропускной способности
                wait_change = 8 * (base_capacity / mod_capacity - 1)
            
            # Определяем статус
            if load_change < -1:
                status = AffectedStopStatus.IMPROVED
            elif load_change > 1:
                status = AffectedStopStatus.WORSENED
            else:
                status = AffectedStopStatus.NEUTRAL
            
            # Берём только значительные изменения
            if abs(capacity_change) > 10 or abs(load_change) > 1:
                affected.append(AffectedStop(
                    id=stop_id,
                    address=stop_data.get("address", f"Остановка {stop_id}"),
                    loadChange=float(load_change),
                    waitTimeChange=float(wait_change),
                    status=status
                ))
        
        # Сортируем по убыванию влияния
        affected.sort(key=lambda x: abs(x.loadChange), reverse=True)
        
        return affected[:10]