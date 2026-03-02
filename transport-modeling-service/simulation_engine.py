# transport-modeling-service/simulation_engine.py
import numpy as np
import logging
import copy
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import math
import random
from collections import defaultdict

from data_models import (
    SimulationResults, Metrics, HourlyData, AffectedStop,
    Modification, ModificationTarget, ModificationType, AffectedStopStatus,
    # Новые модели для метрик
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
        self.AGENT_SAMPLE_RATE = 0.5  # 50% пассажиров моделируем как агентов
    
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
        
        # 3. Запускаем почасовую симуляцию с агентами
        base_hourly, base_agents = self._simulate_day_with_agents(network, [])
        modified_hourly, modified_agents = self._simulate_day_with_agents(
            modified_network, 
            active_mods
        )
        
        # 4. Считаем базовые метрики
        base_metrics = self._calculate_metrics_from_hourly(base_hourly, network)
        modified_metrics = self._calculate_metrics_from_hourly(modified_hourly, modified_network)
        
        # 5. Считаем НОВЫЕ метрики пропускной способности
        base_throughput = self._calculate_passenger_throughput(base_hourly, network)
        modified_throughput = self._calculate_passenger_throughput(modified_hourly, modified_network)
        
        # 6. Считаем распределение времени ожидания (из агентов)
        base_wait_distribution = self._calculate_wait_time_distribution(base_agents)
        modified_wait_distribution = self._calculate_wait_time_distribution(modified_agents)
        
        # 7. Считаем метрики по каждой остановке
        base_stop_metrics = self._calculate_stop_metrics(base_hourly, network)
        modified_stop_metrics = self._calculate_stop_metrics(modified_hourly, modified_network)
        
        # 8. Находим наиболее затронутые остановки
        affected_stops = self._find_affected_stops(
            network,
            modified_network,
            stops_data,
            base_stop_metrics,
            modified_stop_metrics
        )
        
        # 9. Формируем почасовые данные для графика
        hourly_data = []
        for hour in range(24):
            hourly_data.append(HourlyData(
                hour=hour,
                basePassengers=float(base_hourly[hour]["total_passengers"]),
                modifiedPassengers=float(modified_hourly[hour]["total_passengers"]),
                baseWaitTime=float(base_hourly[hour]["avg_wait_time"]),
                modifiedWaitTime=float(modified_hourly[hour]["avg_wait_time"])
            ))
        
        # Расширяем SimulationResults новыми полями
        results = SimulationResults(
            baseMetrics=base_metrics,
            modifiedMetrics=modified_metrics,
            hourlyData=hourly_data,
            affectedStops=affected_stops,
            # Новые поля
            baseThroughput=base_throughput,
            modifiedThroughput=modified_throughput,
            baseWaitDistribution=base_wait_distribution,
            modifiedWaitDistribution=modified_wait_distribution,
            baseStopMetrics=base_stop_metrics,
            modifiedStopMetrics=modified_stop_metrics
        )
        
        logger.info(f"✅ Симуляция завершена")
        logger.info(f"📊 Среднее время ожидания: {base_metrics.avgWaitTime:.1f} → {modified_metrics.avgWaitTime:.1f} мин")
        logger.info(f"📊 Пропускная способность: {base_throughput['peak_hour_passengers']} → {modified_throughput['peak_hour_passengers']} пасс/час")
        
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
            
            # ПОЛУЧАЕМ КЛАСТЕР ИЗ ДАННЫХ (ВАЖНО!)
            cluster = stop.get("cluster", "unknown")
            
            # Получаем паттерн из данных или создаём реалистичный
            pattern = stop.get("avg_pattern")
            
            # ЕСЛИ ПАТТЕРН ПУСТОЙ ИЛИ НЕПОЛНЫЙ - СОЗДАЁМ РЕАЛИСТИЧНЫЙ
            if not pattern or len(pattern) < 24 or all(p == 0 for p in pattern):
                # Определяем кластер (уже есть из данных)
                
                if cluster == "office":
                    # Офисный район: пик утром и вечером
                    pattern = [2] * 24  # база ночью
                    for h in [7,8,9]: pattern[h] = 35  # утро
                    for h in [12,13]: pattern[h] = 15   # обед
                    for h in [17,18,19]: pattern[h] = 40  # вечер
                    for h in [20,21,22]: pattern[h] = 10   # после работы
                    
                elif cluster == "shopping":
                    # ТЦ: пик днём и вечером
                    pattern = [2] * 24
                    for h in [10,11,12,13,14,15,16]: pattern[h] = 25
                    for h in [17,18,19,20]: pattern[h] = 35
                    
                elif cluster == "educational":
                    # Университет/школа: пик утром
                    pattern = [2] * 24
                    for h in [8,9,10]: pattern[h] = 40
                    for h in [12,13]: pattern[h] = 20
                    for h in [16,17,18]: pattern[h] = 30
                    
                elif cluster == "transport_hub":
                    # Вокзал/станция: постоянно
                    pattern = [15] * 24
                    for h in [7,8,9,17,18,19]: pattern[h] = 40
                    
                else:  # residential или unknown
                    # Жилой район: утром уезжают, вечером приезжают
                    pattern = [5] * 24
                    for h in [7,8,9]: pattern[h] = 30  # уезжают
                    for h in [17,18,19,20]: pattern[h] = 35  # приезжают
            
            # Убеждаемся, что паттерн - список из 24 чисел
            if len(pattern) < 24:
                # Дополняем нулями
                pattern = pattern + [0] * (24 - len(pattern))
            elif len(pattern) > 24:
                pattern = pattern[:24]
            
            # Преобразуем все значения в float/int
            pattern = [float(p) if isinstance(p, (int, float)) else 0 for p in pattern]
            
            network["stops"][stop_id] = {
                "id": stop_id,
                "address": stop.get("address", f"Остановка {stop_id}"),
                "lat": lat,
                "lng": lng,
                "pattern": pattern,  # теперь паттерн точно есть!
                "base_load": stop.get("avg_load", 3),
                "cluster": cluster,  # используем кластер из данных
                "peak_hours": stop.get("peak_hours", []),
                "capacity": 50,  # базовая вместимость остановки
                "routes": [],      # будет заполнено позже
                "theoretical_capacity": 0,  # будет рассчитано
                "closed_hours": [],  # часы, когда остановка закрыта
                "redistributed": {},  # перераспределённые пассажиры по часам
                "carryover": 0  # накопленные пассажиры с прошлого часа
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
                "capacity_per_hour": (60 / max(interval, 1)) * self.BUS_CAPACITY,
                "vehicle_capacity": self.BUS_CAPACITY
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
                        "interval": interval,
                        "capacity_per_hour": network["routes"][route_id]["capacity_per_hour"]
                    }
                    network["stops"][stop_id]["routes"].append(route_info)
                    
                    # Добавляем в обратный индекс
                    if stop_id not in network["stop_routes"]:
                        network["stop_routes"][stop_id] = []
                    network["stop_routes"][stop_id].append(route_id)
        
        # Рассчитываем теоретическую пропускную способность каждой остановки
        for stop_id, stop in network["stops"].items():
            route_ids = network["stop_routes"].get(stop_id, [])
            theoretical_capacity = 0
            for route_id in route_ids:
                if route_id in network["routes"]:
                    theoretical_capacity += network["routes"][route_id]["capacity_per_hour"]
            stop["theoretical_capacity"] = theoretical_capacity
            
            # Логируем для отладки
            if sum(stop["pattern"]) > 0:
                logger.debug(f"🛑 Остановка {stop_id}: паттерн сумма={sum(stop['pattern'])}, теор.пропускная={theoretical_capacity}")
        
        # 3. Строим связи между остановками
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
        
        # Проверяем, что у всех остановок есть ненулевые паттерны
        total_passengers = sum(sum(stop["pattern"]) for stop in network["stops"].values())
        logger.info(f"🏗️ Построена сеть: {len(network['stops'])} остановок, {len(network['routes'])} маршрутов")
        logger.info(f"📊 Всего пассажиров за день: {total_passengers}")
        
        return network

    def _simulate_day_with_agents(
        self,
        network: Dict,
        modifications: List[Modification]
    ) -> Tuple[List[Dict], List[Dict]]:
        """
        Почасовая симуляция с агентами для точного измерения времени ожидания
        """
        hourly_results = []
        
        # Состояние агентов (каждый агент = один пассажир)
        agents = []  # список активных агентов
        completed_agents = []  # агенты, которые已完成 поездку
        
        for hour in range(24):
            # ВАЖНО: Передаём существующих агентов в генерацию
            agents = self._generate_agents_for_hour(network, hour, agents)
            
            # Симулируем час
            hour_result, remaining_agents, completed_in_hour = self._simulate_hour_with_agents(
                network,
                hour,
                agents,  # передаём ВСЕХ агентов
                modifications
            )
            
            # Сохраняем результаты часа
            hourly_results.append(hour_result)
            
            # Обновляем состояние
            agents = remaining_agents
            completed_agents.extend(completed_in_hour)
            
            logger.info(f"⏰ Час {hour}: {hour_result['total_passengers']} пасс., уехало {hour_result['total_departed']}, ждут {len(agents)}")
        
        return hourly_results, completed_agents
    
    def _generate_agents_for_hour(self, network: Dict, hour: int, existing_agents: List[Dict] = None) -> List[Dict]:
        """
        Генерация агентов-пассажиров для часа с учётом существующих
        """
        agents = []
        agent_id_counter = 0
        
        # Если есть существующие агенты - используем их ID
        if existing_agents:
            agent_id_counter = max([a["id"] for a in existing_agents], default=0) + 1
            # Добавляем существующих агентов, которые ещё не уехали
            agents.extend([a for a in existing_agents if a.get("status") in ["waiting", "redistributed"]])
        
        for stop_id, stop in network["stops"].items():
            # Базовое количество пассажиров из паттерна
            base_count = stop.get("pattern", [5]*24)[hour]
            
            # ВАЖНО: Добавляем redistributed пассажиров
            redistributed = stop.get("redistributed", {}).get(hour, 0)
            
            # ВАЖНО: Добавляем накопленных с прошлого часа
            # Они уже есть в existing_agents, поэтому не создаём новых
            
            total_new_passengers = int(base_count + redistributed)
            
            # Создаём новых агентов ТОЛЬКО для новых пассажиров
            for _ in range(total_new_passengers):
                agent = {
                    "id": agent_id_counter,
                    "start_stop": stop_id,
                    "start_hour": hour,
                    "start_minute": random.randint(0, 59),
                    "wait_time": 0,
                    "status": "waiting",
                    "original_stop": stop_id  # для отслеживания перераспределения
                }
                agents.append(agent)
                agent_id_counter += 1
        
        logger.debug(f"👥 Час {hour}: всего агентов {len(agents)} (новых {total_new_passengers if 'total_new_passengers' in locals() else 0})")
        return agents
    
    def _simulate_hour_with_agents(
        self,
        network: Dict,
        hour: int,
        agents: List[Dict],
        modifications: List[Modification]
    ) -> Tuple[Dict, List[Dict], List[Dict]]:
        """
        Симуляция часа с агентами
        """
        hour_result = {
            "total_passengers": 0,
            "total_departed": 0,
            "total_waiting": 0,
            "avg_wait_time": 0,
            "stops": defaultdict(lambda: {
                "passengers": 0,
                "departed": 0,
                "waiting": 0,
                "wait_times": []
            }),
            "carryover": {}
        }
        
        # Группируем агентов по остановкам
        agents_by_stop = defaultdict(list)
        for agent in agents:
            agents_by_stop[agent["start_stop"]].append(agent)
        
        # Определяем закрытые остановки
        closed_stops = []
        for stop_id, stop in network["stops"].items():
            closed_hours = stop.get("closed_hours", [])
            if hour in closed_hours:
                closed_stops.append(stop_id)
        
        remaining_agents = []
        completed_agents = []
        
        # Обрабатываем каждую остановку
        for stop_id, stop_agents in agents_by_stop.items():
            stop = network["stops"].get(stop_id, {})
            
            # ВСЕГДА добавляем пассажиров в total_passengers, даже если остановка закрыта!
            hour_result["total_passengers"] += len(stop_agents)
            
            # Если остановка закрыта
            if stop_id in closed_stops:
                for agent in stop_agents:
                    agent["status"] = "redistributed"
                    agent["redistribute_hour"] = hour
                    agent["original_stop"] = stop_id
                    remaining_agents.append(agent)
                
                hour_result["stops"][stop_id]["passengers"] += len(stop_agents)
                hour_result["stops"][stop_id]["waiting"] += len(stop_agents)
                hour_result["total_waiting"] += len(stop_agents)
                continue
            
            # Получаем маршруты этой остановки
            route_ids = network["stop_routes"].get(stop_id, [])
            
            if not route_ids:
                # Нет маршрутов - все ждут
                for agent in stop_agents:
                    agent["wait_time"] += 60
                    remaining_agents.append(agent)
                
                hour_result["stops"][stop_id]["passengers"] += len(stop_agents)
                hour_result["stops"][stop_id]["waiting"] += len(stop_agents)
                hour_result["total_waiting"] += len(stop_agents)
                continue
            
            # Считаем пропускную способность
            route_capacities = []
            route_intervals = []
            
            for route_id in route_ids:
                if route_id in network["routes"]:
                    route = network["routes"][route_id]
                    route_capacities.append(route["capacity_per_hour"])
                    route_intervals.append(route["current_interval"])
            
            total_capacity = sum(route_capacities)
            
            if total_capacity == 0:
                # Все ждут
                for agent in stop_agents:
                    agent["wait_time"] += 60
                    remaining_agents.append(agent)
                
                hour_result["stops"][stop_id]["passengers"] += len(stop_agents)
                hour_result["stops"][stop_id]["waiting"] += len(stop_agents)
                hour_result["total_waiting"] += len(stop_agents)
                continue
            
            # Сколько может уехать
            can_depart = min(len(stop_agents), int(total_capacity))
            
            # Сортируем агентов по времени прибытия
            stop_agents.sort(key=lambda a: a.get("wait_time", 0), reverse=True)
            
            # Отправляем агентов
            departing = stop_agents[:can_depart]
            waiting = stop_agents[can_depart:]
            
            # Обрабатываем уехавших
            for agent in departing:
                agent["departure_hour"] = hour
                agent["departure_minute"] = random.randint(0, 59)
                agent["wait_time"] += self._calculate_agent_wait_time(route_intervals)
                agent["status"] = "departed"
                agent["chosen_route"] = random.choice(route_ids) if route_ids else None
                completed_agents.append(agent)
                
                hour_result["stops"][stop_id]["wait_times"].append(agent["wait_time"])
            
            # Обрабатываем оставшихся
            for agent in waiting:
                agent["wait_time"] += 60
                remaining_agents.append(agent)
            
            # Заполняем результаты
            hour_result["stops"][stop_id]["passengers"] += len(stop_agents)
            hour_result["stops"][stop_id]["departed"] += len(departing)
            hour_result["stops"][stop_id]["waiting"] += len(waiting)
            
            hour_result["total_departed"] += len(departing)
            hour_result["total_waiting"] += len(waiting)
            
            # Среднее время ожидания для этой остановки
            if hour_result["stops"][stop_id]["wait_times"]:
                hour_result["stops"][stop_id]["avg_wait"] = np.mean(
                    hour_result["stops"][stop_id]["wait_times"]
                )
        
        # Общее среднее время ожидания
        all_wait_times = []
        for stop_result in hour_result["stops"].values():
            all_wait_times.extend(stop_result.get("wait_times", []))
        
        if all_wait_times:
            hour_result["avg_wait_time"] = np.mean(all_wait_times)
        
        # Добавляем redistributed агентов
        redistributed_agents = [a for a in remaining_agents if a.get("status") == "redistributed"]
        for agent in redistributed_agents:
            agent["start_stop"] = self._find_nearest_open_stop(
                network, 
                agent["original_stop"], 
                hour,
                closed_stops
            )
        
        return hour_result, remaining_agents, completed_agents
    
    def _calculate_agent_wait_time(self, route_intervals: List[int]) -> float:
        """
        Расчёт времени ожидания для одного агента
        """
        if not route_intervals:
            return 30  # полчаса по умолчанию
        
        # Эффективный интервал
        effective_interval = 1 / sum(1/i for i in route_intervals)
        
        # Случайное время ожидания (равномерное распределение от 0 до интервала)
        wait_time = random.uniform(0, effective_interval)
        
        return wait_time
    
    def _redistribute_passengers(
        self,
        network: Dict,
        closed_stop_id: int,
        passengers: int,
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
        
        # Ищем соседние остановки
        nearby_stops = self._find_nearby_stops(network, closed_stop_id, radius=self.WALKING_RADIUS)
        
        # Исключаем закрытые остановки
        nearby_stops = [s for s in nearby_stops if s not in all_closed_stops]
        
        if not nearby_stops:
            return
        
        # Считаем общую вместимость соседей
        total_capacity = 0
        for stop_id in nearby_stops:
            if stop_id in network["stops"]:
                route_count = len(network["stop_routes"].get(stop_id, []))
                total_capacity += route_count * 50
        
        if total_capacity == 0:
            return
        
        # Распределяем пассажиров пропорционально вместимости
        for stop_id in nearby_stops:
            if stop_id in network["stops"]:
                route_count = len(network["stop_routes"].get(stop_id, []))
                stop_capacity = route_count * 50
                share = stop_capacity / total_capacity
                
                if "redistributed" not in network["stops"][stop_id]:
                    network["stops"][stop_id]["redistributed"] = {}
                
                if hour not in network["stops"][stop_id]["redistributed"]:
                    network["stops"][stop_id]["redistributed"][hour] = 0
                
                network["stops"][stop_id]["redistributed"][hour] += passengers * share
        
        logger.debug(f"🔄 Перераспределено {passengers} пассажиров с {closed_stop_id}")
    
    def _find_nearby_stops(self, network: Dict, stop_id: int, radius: float) -> List[int]:
        """
        Поиск остановок в радиусе
        """
        stop = network["stops"].get(stop_id)
        if not stop:
            return []
        
        stop_lat = stop.get("lat", 0)
        stop_lng = stop.get("lng", 0)
        
        nearby = []
        
        for sid, s in network["stops"].items():
            if sid == stop_id:
                continue
            
            s_lat = s.get("lat", 0)
            s_lng = s.get("lng", 0)
            
            # Грубое расстояние
            lat_diff = abs(stop_lat - s_lat) * 111000
            lng_diff = abs(stop_lng - s_lng) * 111000 * math.cos(math.radians(stop_lat))
            distance = math.sqrt(lat_diff**2 + lng_diff**2)
            
            if distance <= radius:
                nearby.append(sid)
        
        return nearby[:5]

    def _find_nearest_open_stop(
        self,
        network: Dict,
        original_stop_id: int,
        hour: int,
        closed_stops: List[int]
    ) -> int:
        """
        Поиск ближайшей работающей остановки для перераспределённых агентов
        """
        # Находим ближайшие остановки
        nearby = self._find_nearby_stops(network, original_stop_id, self.WALKING_RADIUS)
        
        # Исключаем закрытые в этот час
        open_stops = []
        for stop_id in nearby:
            if stop_id in closed_stops:
                continue
            
            stop = network["stops"].get(stop_id)
            if stop:
                closed_hours = stop.get("closed_hours", [])
                if hour not in closed_hours:
                    open_stops.append(stop_id)
        
        if open_stops:
            # Выбираем случайную из доступных
            return random.choice(open_stops)
        
        # Если нет открытых - оставляем на месте (но таких не должно быть)
        logger.warning(f"⚠️ Не найдено открытых остановок рядом с {original_stop_id} в час {hour}")
        return original_stop_id
    
    def _calculate_passenger_throughput(self, hourly_data: List[Dict], network: Dict) -> Dict:
        """
        Расчёт пропускной способности
        """
        hourly_throughput = []
        for hour, data in enumerate(hourly_data):
            throughput = {
                "hour": hour,
                "passengers_arrived": int(data["total_passengers"]),
                "passengers_departed": int(data["total_departed"]),
                "passengers_waiting": int(data["total_waiting"])
            }
            hourly_throughput.append(throughput)
        
        if not hourly_throughput:
            return {
                "hourly_throughput": [],
                "peak_hour": 0,
                "peak_hour_passengers": 0,
                "theoretical_capacity": 0,
                "utilization_rate": 0,
                "stop_throughput": {}
            }
        
        peak_hour = max(
            range(len(hourly_throughput)),
            key=lambda h: hourly_throughput[h]["passengers_arrived"]
        )
        
        theoretical_capacity = sum(
            stop.get("theoretical_capacity", 0) 
            for stop in network["stops"].values()
        )
        
        peak_hour_throughput = hourly_throughput[peak_hour]["passengers_departed"]
        
        utilization_rate = peak_hour_throughput / theoretical_capacity if theoretical_capacity > 0 else 0
        
        stop_throughput = {}
        for stop_id, stop in network["stops"].items():
            theoretical = stop.get("theoretical_capacity", 0)
            stop_throughput[stop_id] = {
                "theoretical": theoretical,
                "estimated_actual": theoretical * 0.8
            }
        
        return {
            "hourly_throughput": hourly_throughput,
            "peak_hour": peak_hour,
            "peak_hour_passengers": peak_hour_throughput,
            "theoretical_capacity": int(theoretical_capacity),
            "utilization_rate": float(utilization_rate),
            "stop_throughput": stop_throughput
        }
    
    def _calculate_wait_time_distribution(self, agents: List[Dict]) -> Dict:
        """
        Расчёт распределения времени ожидания
        """
        if not agents:
            return {
                "buckets": [],
                "counts": [],
                "percentiles": {},
                "average": 0,
                "median": 0,
                "p95": 0,
                "p99": 0
            }
        
        wait_times = [a["wait_time"] for a in agents if a["wait_time"] > 0]
        
        if not wait_times:
            return {
                "buckets": [],
                "counts": [],
                "percentiles": {},
                "average": 0,
                "median": 0,
                "p95": 0,
                "p99": 0
            }
        
        max_wait = max(wait_times)
        buckets = list(range(0, int(max_wait) + 5, 5))
        counts, _ = np.histogram(wait_times, bins=buckets)
        
        percentiles = {
            "p50": np.percentile(wait_times, 50),
            "p75": np.percentile(wait_times, 75),
            "p90": np.percentile(wait_times, 90),
            "p95": np.percentile(wait_times, 95),
            "p99": np.percentile(wait_times, 99)
        }
        
        return {
            "buckets": [int(b) for b in buckets[:-1]],
            "counts": [int(c) for c in counts],
            "percentiles": {k: float(v) for k, v in percentiles.items()},
            "average": float(np.mean(wait_times)),
            "median": float(np.median(wait_times)),
            "p95": float(percentiles["p95"]),
            "p99": float(percentiles["p99"])
        }
    
    def _calculate_stop_metrics(self, hourly_data: List[Dict], network: Dict) -> Dict:
        """
        Расчёт метрик по каждой остановке
        """
        stop_metrics = {}
        
        for stop_id, stop in network["stops"].items():
            stop_hourly = []
            total_passengers = 0
            total_departed = 0
            wait_times = []
            
            for hour_data in hourly_data:
                if "stops" in hour_data and stop_id in hour_data["stops"]:
                    stop_result = hour_data["stops"][stop_id]
                    stop_hourly.append({
                        "hour": len(stop_hourly),
                        "passengers": stop_result.get("passengers", 0),
                        "departed": stop_result.get("departed", 0),
                        "waiting": stop_result.get("waiting", 0),
                        "avg_wait": stop_result.get("avg_wait", 0)
                    })
                    total_passengers += stop_result.get("passengers", 0)
                    total_departed += stop_result.get("departed", 0)
                    if "avg_wait" in stop_result and stop_result["avg_wait"] > 0:
                        wait_times.append(stop_result["avg_wait"])
            
            theoretical = stop.get("theoretical_capacity", 0)
            
            if stop_hourly:
                peak_hour = max(
                    range(len(stop_hourly)),
                    key=lambda h: stop_hourly[h]["passengers"]
                )
                peak_passengers = stop_hourly[peak_hour]["passengers"]
            else:
                peak_hour = 0
                peak_passengers = 0
            
            stop_metrics[stop_id] = {
                "id": stop_id,
                "address": stop.get("address", f"Остановка {stop_id}"),
                "hourly": stop_hourly,
                "total_passengers": total_passengers,
                "total_departed": total_departed,
                "avg_departure_rate": total_departed / 24 if total_departed > 0 else 0,
                "avg_wait_time": np.mean(wait_times) if wait_times else 0,
                "theoretical_capacity": theoretical,
                "peak_hour": peak_hour,
                "peak_passengers": peak_passengers,
                "utilization": peak_passengers / theoretical if theoretical > 0 else 0
            }
        
        return stop_metrics
    
    def _apply_modifications(self, network: Dict, modifications: List[Modification]) -> Dict:
        """
        Применение изменений к сети
        """
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
        """Закрытие остановки"""
        stop_id = mod.targetId
        hours = mod.parameters.get("hours", [7, 8, 9, 17, 18, 19])
        
        if stop_id in network["stops"]:
            network["stops"][stop_id]["closed_hours"] = hours
            logger.info(f"🚫 Закрыта остановка {stop_id}")
    
    def _apply_change_interval(self, network: Dict, mod: Modification):
        """Изменение интервала маршрута"""
        route_id = mod.targetId
        new_interval = mod.parameters.get("interval", 15)
        
        if route_id in network["routes"]:
            old_interval = network["routes"][route_id]["current_interval"]
            network["routes"][route_id]["current_interval"] = new_interval
            network["routes"][route_id]["frequency"] = 60 / max(new_interval, 1)
            network["routes"][route_id]["capacity_per_hour"] = (60 / max(new_interval, 1)) * self.BUS_CAPACITY
            logger.info(f"⏱️ Маршрут {route_id}: {old_interval} → {new_interval} мин")
    
    def _apply_change_capacity(self, network: Dict, mod: Modification):
        """Изменение вместимости"""
        stop_id = mod.targetId
        new_capacity = mod.parameters.get("capacity", 50)
        
        if stop_id in network["stops"]:
            network["stops"][stop_id]["capacity"] = new_capacity
            logger.info(f"📦 Остановка {stop_id}: вместимость → {new_capacity}")
    
    def _calculate_metrics_from_hourly(self, hourly_data: List[Dict], network: Dict) -> Metrics:
        """
        Расчёт базовых метрик
        """
        if not hourly_data:
            return Metrics(
                avgWaitTime=0,
                maxWaitTime=0,
                totalPassengers=0,
                avgLoad=0,
                transportUtilization=0
            )
        
        total_passengers = sum(h["total_passengers"] for h in hourly_data)
        
        if total_passengers > 0:
            weighted_wait = sum(
                h["avg_wait_time"] * h["total_passengers"] 
                for h in hourly_data if h["avg_wait_time"] != float('inf')
            ) / total_passengers
        else:
            weighted_wait = 0
        
        max_wait = max((h["avg_wait_time"] for h in hourly_data if h["avg_wait_time"] != float('inf')), default=0)
        total_pass = int(total_passengers)
        
        loads = [stop.get("base_load", 3) for stop in network["stops"].values()]
        avg_load = np.mean(loads) if loads else 0
        
        return Metrics(
            avgWaitTime=float(weighted_wait),
            maxWaitTime=float(max_wait),
            totalPassengers=total_pass,
            avgLoad=float(avg_load),
            transportUtilization=float(avg_load / 10)
        )
    
    def _find_affected_stops(
        self,
        base_network: Dict,
        modified_network: Dict,
        stops_data: List[Dict],
        base_stop_metrics: Dict = None,
        modified_stop_metrics: Dict = None
    ) -> List[AffectedStop]:
        """
        Поиск затронутых остановок
        """
        affected = []
        
        for stop_data in stops_data:
            stop_id = stop_data["id"]
            
            if base_stop_metrics and modified_stop_metrics and stop_id in base_stop_metrics and stop_id in modified_stop_metrics:
                base_wait = base_stop_metrics[stop_id].get("avg_wait_time", 0)
                mod_wait = modified_stop_metrics[stop_id].get("avg_wait_time", 0)
                wait_change = mod_wait - base_wait
                
                base_load = base_stop_metrics[stop_id].get("utilization", 0)
                mod_load = modified_stop_metrics[stop_id].get("utilization", 0)
                load_change = (mod_load - base_load) * 100
            else:
                wait_change = 0
                load_change = 0
            
            if abs(load_change) > 5 or abs(wait_change) > 2:
                status = AffectedStopStatus.WORSENED if load_change > 0 else AffectedStopStatus.IMPROVED
                affected.append(AffectedStop(
                    id=stop_id,
                    address=stop_data.get("address", f"Остановка {stop_id}"),
                    loadChange=float(load_change),
                    waitTimeChange=float(wait_change),
                    status=status
                ))
        
        affected.sort(key=lambda x: abs(x.loadChange), reverse=True)
        return affected[:10]