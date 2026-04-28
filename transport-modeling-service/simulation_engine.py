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
    Modification, ModificationTarget, ModificationType, AffectedStopStatus, RegionBounds
)

logger = logging.getLogger(__name__)

class SimulationEngine:
    """
    Движок моделирования с реальной физикой процессов и предпочтениями маршрутов
    """
    
    def __init__(self, cache_service, db_service):
        self.cache = cache_service
        self.db = db_service
        
        self.BUS_CAPACITY = 50
        self.WALKING_RADIUS = 500
        self.AGENT_SAMPLE_RATE = 0.5
    
    def _create_empty_results(self) -> SimulationResults:
        """Создаёт пустые результаты для случая, когда нет данных для моделирования"""
        empty_metrics = Metrics(
            avgWaitTime=0,
            maxWaitTime=0,
            totalPassengers=0,
            avgLoad=0,
            transportUtilization=0,
            avgTravelTime=0,
            maxTravelTime=0
        )
        
        hourly_data = []
        for hour in range(24):
            hourly_data.append(HourlyData(
                hour=hour,
                basePassengers=0,
                modifiedPassengers=0,
                baseWaitTime=0,
                modifiedWaitTime=0
            ))
        
        return SimulationResults(
            baseMetrics=empty_metrics,
            modifiedMetrics=empty_metrics,
            hourlyData=hourly_data,
            affectedStops=[],
            baseThroughput=None,
            modifiedThroughput=None,
            baseWaitDistribution=None,
            modifiedWaitDistribution=None,
            baseStopMetrics={},
            modifiedStopMetrics={}
        )

    async def run(
        self,
        city_id: int,
        modifications: List[Modification],
        stops_data: List[Dict],
        region: Optional[RegionBounds] = None
    ) -> SimulationResults:
        """
        Запуск симуляции с учётом маршрутов и опциональной области моделирования
        
        Args:
            city_id: ID города
            modifications: Список модификаций
            stops_data: Данные об остановках
            region: Опциональные границы области моделирования (minLng, maxLng, minLat, maxLat)
        """
        logger.info(f"🏁 Запуск симуляции для города {city_id}")
        logger.info(f"📊 Исходное количество остановок: {len(stops_data)}")
        
        # Фильтруем только включенные модификации
        active_mods = [m for m in modifications if m.enabled]
        
        # Если задана область моделирования, логируем её границы
        if region:
            logger.info(f"🗺️ Область моделирования: {region.minLng:.4f}E - {region.maxLng:.4f}E, "
                        f"{region.minLat:.4f}N - {region.maxLat:.4f}N")
        
        # Фильтруем остановки по области, если задана
        original_stops_count = len(stops_data)
        filtered_stop_ids = set()
        
        if region and stops_data:
            filtered_stops = []
            for stop in stops_data:
                lng = stop.get("lng", 0)
                lat = stop.get("lat", 0)
                
                if isinstance(lng, str):
                    try:
                        lng = float(lng.strip())
                    except (ValueError, TypeError):
                        lng = 0.0
                if isinstance(lat, str):
                    try:
                        lat = float(lat.strip())
                    except (ValueError, TypeError):
                        lat = 0.0
                
                # Проверяем, попадает ли остановка в область
                if (region.minLng <= lng <= region.maxLng and 
                    region.minLat <= lat <= region.maxLat):
                    filtered_stops.append(stop)
                    filtered_stop_ids.add(stop.get("id"))
            
            stops_data = filtered_stops
            logger.info(f"📍 Отфильтровано остановок: {len(stops_data)} из {original_stops_count} в области")
            
            # Если после фильтрации не осталось остановок, возвращаем пустые результаты
            if len(stops_data) == 0:
                logger.warning(f"⚠️ В выбранной области нет остановок. Моделирование невозможно.")
                return self._create_empty_results()
        else:
            logger.info(f"📍 Фильтрация по области не применяется, используются все {len(stops_data)} остановок")
            # Если регион не задан, собираем все ID остановок
            filtered_stop_ids = {stop.get("id") for stop in stops_data}
        
        logger.info(f"📊 Количество остановок в области: {len(filtered_stop_ids)}")
        
        # Получаем маршруты города (с учётом области, если задана)
        try:
            if region and filtered_stop_ids:
                # Получаем маршруты, проходящие через оставшиеся остановки
                routes_data = await self.db.get_routes_by_stop_ids(city_id, list(filtered_stop_ids))
                logger.info(f"🛤️ Загружено {len(routes_data)} маршрутов (фильтр по остановкам в области)")
            else:
                routes_data = await self.db.get_routes_with_path(city_id)
                logger.info(f"🛤️ Загружено {len(routes_data)} маршрутов (все)")
        except Exception as e:
            logger.warning(f"⚠️ Не удалось загрузить маршруты: {e}")
            routes_data = []
        
        # Отфильтровываем маршруты, которые не содержат остановки из области
        if region and routes_data and filtered_stop_ids:
            filtered_routes = []
            for route in routes_data:
                route_stops = route.get("stops", [])
                # Проверяем, есть ли у маршрута хотя бы одна остановка в области
                if any(stop_id in filtered_stop_ids for stop_id in route_stops):
                    filtered_routes.append(route)
            routes_data = filtered_routes
            logger.info(f"🛤️ После фильтрации маршрутов по остановкам: {len(routes_data)}")
        
        # 1. Строим полную модель сети
        network = self._build_network_model(stops_data, routes_data)
        
        # Проверяем, что сеть не пуста
        if len(network["stops"]) == 0:
            logger.warning("⚠️ Сеть не содержит остановок. Возвращаем пустые результаты.")
            return self._create_empty_results()
        
        logger.info(f"🏗️ Построена сеть: {len(network['stops'])} остановок, {len(network['routes'])} маршрутов")
        
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
        
        # 5. Считаем метрики пропускной способности
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
        if region:
            logger.info(f"🗺️ Моделирование выполнено в заданной области: "
                        f"{region.minLng:.4f} - {region.maxLng:.4f}, {region.minLat:.4f} - {region.maxLat:.4f}")
        
        return results
    
    def _build_network_model(self, stops_data: List[Dict], routes_data: List[Dict]) -> Dict:
        """
        Построение полной модели транспортной сети
        """
        network = {
            "stops": {},
            "routes": {},
            "stop_connections": {},
            "stop_routes": {}
        }
        
        # 1. Добавляем остановки
        for stop in stops_data:
            stop_id = stop["id"]
            
            lng = stop.get("lng", 0)
            lat = stop.get("lat", 0)
            
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
            
            cluster = stop.get("cluster", "unknown")
            pattern = stop.get("avg_pattern")
            
            if not pattern or len(pattern) < 24 or all(p == 0 for p in pattern):
                if cluster == "office":
                    pattern = [2] * 24
                    for h in [7,8,9]: pattern[h] = 35
                    for h in [12,13]: pattern[h] = 15
                    for h in [17,18,19]: pattern[h] = 40
                    for h in [20,21,22]: pattern[h] = 10
                elif cluster == "shopping":
                    pattern = [2] * 24
                    for h in [10,11,12,13,14,15,16]: pattern[h] = 25
                    for h in [17,18,19,20]: pattern[h] = 35
                elif cluster == "educational":
                    pattern = [2] * 24
                    for h in [8,9,10]: pattern[h] = 40
                    for h in [12,13]: pattern[h] = 20
                    for h in [16,17,18]: pattern[h] = 30
                elif cluster == "transport_hub":
                    pattern = [15] * 24
                    for h in [7,8,9,17,18,19]: pattern[h] = 40
                else:
                    pattern = [5] * 24
                    for h in [7,8,9]: pattern[h] = 30
                    for h in [17,18,19,20]: pattern[h] = 35
            
            if len(pattern) < 24:
                pattern = pattern + [0] * (24 - len(pattern))
            elif len(pattern) > 24:
                pattern = pattern[:24]
            
            pattern = [float(p) if isinstance(p, (int, float)) else 0 for p in pattern]
            
            network["stops"][stop_id] = {
                "id": stop_id,
                "address": stop.get("address", f"Остановка {stop_id}"),
                "lat": lat,
                "lng": lng,
                "pattern": pattern,
                "base_load": stop.get("avg_load", 3),
                "cluster": cluster,
                "peak_hours": stop.get("peak_hours", []),
                "capacity": 50,
                "routes": [],
                "theoretical_capacity": 0,
                "closed_hours": [],
                "redistributed": {},
                "carryover": 0
            }
        
        # 2. Добавляем маршруты и строим связи
        for route in routes_data:
            route_id = route["id"]
            route_stops = route.get("stops", [])
            interval = route.get("interval_minutes", 15)
            
            network["routes"][route_id] = {
                "id": route_id,
                "number": route.get("number", ""),
                "base_interval": interval,
                "current_interval": interval,
                "stops": route_stops,
                "transport_type": route.get("transport_type", "BUS"),
                "frequency": 60 / max(interval, 1),
                "capacity_per_hour": (60 / max(interval, 1)) * self.BUS_CAPACITY,
                "vehicle_capacity": self.BUS_CAPACITY
            }
            
            for i, stop_id in enumerate(route_stops):
                if stop_id in network["stops"]:
                    if "routes" not in network["stops"][stop_id]:
                        network["stops"][stop_id]["routes"] = []
                    
                    route_info = {
                        "route_id": route_id,
                        "order": i,
                        "interval": interval,
                        "capacity_per_hour": network["routes"][route_id]["capacity_per_hour"]
                    }
                    network["stops"][stop_id]["routes"].append(route_info)
                    
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
        
        # 3. Строим связи между остановками
        for route_id, route in network["routes"].items():
            stops = route["stops"]
            for i in range(len(stops) - 1):
                stop_a = stops[i]
                stop_b = stops[i + 1]
                key = f"{min(stop_a, stop_b)}:{max(stop_a, stop_b)}"
                if key not in network["stop_connections"]:
                    network["stop_connections"][key] = []
                
                connection = {
                    "route_id": route_id,
                    "from_stop": stop_a,
                    "to_stop": stop_b,
                    "travel_time": 5
                }
                network["stop_connections"][key].append(connection)
        
        total_passengers = sum(sum(stop["pattern"]) for stop in network["stops"].values())
        logger.info(f"🏗️ Построена сеть: {len(network['stops'])} остановок, {len(network['routes'])} маршрутов")
        logger.info(f"📊 Всего пассажиров за день: {total_passengers}")
        
        return network

    def _get_routes_to_destination(self, stop_id: int, dest_stop_id: int, network: Dict) -> List[int]:
        """
        Возвращает список маршрутов, проходящих через текущую остановку и ведущих к пункту назначения.
        Маршрут подходит, если он включает dest_stop_id в свой список остановок после текущей.
        """
        suitable_routes = []
        for route_id, route in network["routes"].items():
            stops = route.get("stops", [])
            if stop_id not in stops:
                continue
            try:
                idx_current = stops.index(stop_id)
            except ValueError:
                continue
            if dest_stop_id in stops[idx_current+1:]:
                suitable_routes.append(route_id)
        return suitable_routes

    def _simulate_day_with_agents(
        self,
        network: Dict,
        modifications: List[Modification]
    ) -> Tuple[List[Dict], List[Dict]]:
        """
        Почасовая симуляция с агентами
        """
        hourly_results = []
        agents = []
        completed_agents = []
        
        for hour in range(24):
            agents = self._generate_agents_for_hour(network, hour, agents)
            
            hour_result, remaining_agents, completed_in_hour = self._simulate_hour_with_agents(
                network,
                hour,
                agents,
                modifications
            )
            
            # ✅ Сохраняем travel_times в hour_result
            hour_travel_times = [a.get("travel_time", 0) for a in completed_in_hour if a.get("travel_time", 0) > 0]
            hour_result["travel_times"] = hour_travel_times
            
            hourly_results.append(hour_result)
            agents = remaining_agents
            completed_agents.extend(completed_in_hour)
            
            logger.info(f"⏰ Час {hour}: {hour_result['total_passengers']} пасс., уехало {hour_result['total_departed']}, "
                    f"ср.время в пути {np.mean(hour_travel_times) if hour_travel_times else 0:.1f} мин")
        
        return hourly_results, completed_agents
    
    def _generate_agents_for_hour(self, network: Dict, hour: int, existing_agents: List[Dict] = None) -> List[Dict]:
        """
        Генерация агентов-пассажиров с указанием пункта назначения.
        Пункт назначения выбирается случайно среди всех остановок города с весами,
        пропорциональными их привлекательности в данный час.
        """
        agents = []
        agent_id_counter = 0
        
        if existing_agents:
            agent_id_counter = max([a["id"] for a in existing_agents], default=0) + 1
            agents.extend([a for a in existing_agents if a.get("status") in ["waiting", "redistributed"]])
        
        # Вычисляем веса для выбора destination (привлекательность остановок в этот час)
        stop_weights = {}
        for stop_id, stop in network["stops"].items():
            pattern = stop.get("pattern", [5]*24)
            weight = pattern[hour]
            if weight <= 0:
                weight = 1
            stop_weights[stop_id] = weight
        
        total_weight = sum(stop_weights.values())
        if total_weight == 0:
            total_weight = 1
        
        for stop_id, stop in network["stops"].items():
            base_count = stop.get("pattern", [5]*24)[hour]
            redistributed = stop.get("redistributed", {}).get(hour, 0)
            total_new_passengers = int(base_count + redistributed)
            
            for _ in range(total_new_passengers):
                dest_stop_id = stop_id
                while dest_stop_id == stop_id:
                    rand = random.random() * total_weight
                    cum = 0
                    for sid, w in stop_weights.items():
                        cum += w
                        if rand <= cum:
                            dest_stop_id = sid
                            break
                
                agent = {
                    "id": agent_id_counter,
                    "start_stop": stop_id,
                    "destination_stop": dest_stop_id,
                    "start_hour": hour,
                    "start_minute": random.randint(0, 59),
                    "wait_time": 0,
                    "travel_time": 0,
                    "boarded_at_hour": None,
                    "boarded_at_minute": None,
                    "status": "waiting",
                    "original_stop": stop_id
                }
                agents.append(agent)
                agent_id_counter += 1
        
        return agents
    
    def _simulate_hour_with_agents(
        self,
        network: Dict,
        hour: int,
        agents: List[Dict],
        modifications: List[Modification]
    ) -> Tuple[Dict, List[Dict], List[Dict]]:
        """
        Симуляция часа с агентами, учитывающая пункт назначения
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
                for agent in stop_agents:
                    agent["wait_time"] += 60
                    remaining_agents.append(agent)
                
                hour_result["stops"][stop_id]["passengers"] += len(stop_agents)
                hour_result["stops"][stop_id]["waiting"] += len(stop_agents)
                hour_result["total_waiting"] += len(stop_agents)
                continue
            
            # Группируем агентов по destination
            agents_by_dest = defaultdict(list)
            for agent in stop_agents:
                dest = agent["destination_stop"]
                agents_by_dest[dest].append(agent)
            
            # Для каждого destination вычисляем список подходящих маршрутов
            suitable_routes_cache = {}
            for dest in agents_by_dest.keys():
                suitable = self._get_routes_to_destination(stop_id, dest, network)
                suitable_routes_cache[dest] = suitable
            
            # Сортируем всех агентов по времени ожидания
            all_agents = stop_agents
            all_agents.sort(key=lambda a: a.get("wait_time", 0), reverse=True)
            
            # Для каждого агента пытаемся найти подходящий маршрут
            departing = []
            waiting = []
            for agent in all_agents:
                dest = agent["destination_stop"]
                suitable = suitable_routes_cache.get(dest, [])
                if not suitable:
                    waiting.append(agent)
                    continue
                chosen_route = random.choice(suitable)
                agent["chosen_route"] = chosen_route
                departing.append(agent)
            
            # Применяем ограничения по пропускной способности
            departing_by_route = defaultdict(list)
            for agent in departing:
                route_id = agent["chosen_route"]
                departing_by_route[route_id].append(agent)
            
            actually_departed = []
            still_waiting = []
            for route_id, route_agents in departing_by_route.items():
                route = network["routes"].get(route_id)
                if not route:
                    still_waiting.extend(route_agents)
                    continue
                capacity = route.get("capacity_per_hour", 0)
                can_depart_count = min(len(route_agents), int(capacity))
                route_agents.sort(key=lambda a: a.get("wait_time", 0), reverse=True)
                departed_here = route_agents[:can_depart_count]
                waiting_here = route_agents[can_depart_count:]
                actually_departed.extend(departed_here)
                still_waiting.extend(waiting_here)
            
            # Обрабатываем departed
            for agent in actually_departed:
                route_id = agent["chosen_route"]
                route = network["routes"][route_id]
                route_intervals = [route["current_interval"]]
                
                # Запоминаем время посадки
                agent["boarded_at_hour"] = hour
                agent["boarded_at_minute"] = random.randint(0, 59)
                
                # Время ожидания
                wait_time = self._calculate_agent_wait_time(route_intervals)
                agent["wait_time"] += wait_time
                
                # Рассчитываем время в пути до destination
                travel_time_minutes = self._calculate_travel_time(
                    network, 
                    stop_id, 
                    agent["destination_stop"], 
                    route_id,
                    hour
                )
                agent["travel_time"] = travel_time_minutes
                
                agent["status"] = "departed"
                completed_agents.append(agent)
                
                hour_result["stops"][stop_id]["wait_times"].append(agent["wait_time"])
                
                if "travel_times" not in hour_result["stops"][stop_id]:
                    hour_result["stops"][stop_id]["travel_times"] = []
                hour_result["stops"][stop_id]["travel_times"].append(travel_time_minutes)
            
            # Оставшиеся
            all_waiting = still_waiting + waiting
            for agent in all_waiting:
                agent["wait_time"] += 60
                remaining_agents.append(agent)
            
            # Заполняем статистику
            hour_result["stops"][stop_id]["passengers"] += len(stop_agents)
            hour_result["stops"][stop_id]["departed"] += len(actually_departed)
            hour_result["stops"][stop_id]["waiting"] += len(all_waiting)
            hour_result["total_departed"] += len(actually_departed)
            hour_result["total_waiting"] += len(all_waiting)
            
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

        all_travel_times = []
        for stop_result in hour_result["stops"].values():
            all_travel_times.extend(stop_result.get("travel_times", []))
        
        if all_travel_times:
            hour_result["avg_travel_time"] = np.mean(all_travel_times)
            hour_result["max_travel_time"] = np.max(all_travel_times)
        else:
            hour_result["avg_travel_time"] = 0
            hour_result["max_travel_time"] = 0
        
        return hour_result, remaining_agents, completed_agents
    
    def _calculate_travel_time(
        self,
        network: Dict,
        from_stop_id: int,
        to_stop_id: int,
        route_id: int,
        hour: int
    ) -> float:
        """
        Расчёт времени поездки от остановки from_stop_id до остановки to_stop_id
        по заданному маршруту route_id с учётом часа (для возможных пробок в будущем).
        """
        route = network["routes"].get(route_id)
        if not route:
            return 30  # значение по умолчанию
        
        stops = route.get("stops", [])
        if not stops:
            return 30
        
        # Находим позиции остановок в маршруте
        try:
            from_idx = stops.index(from_stop_id)
            to_idx = stops.index(to_stop_id)
        except ValueError:
            # Остановки не найдены в маршруте → возвращаем базовое время
            return 30
        
        if to_idx <= from_idx:
            # Маршрут не проходит в нужном направлении
            return 30
        
        # Базовое время между остановками (минут)
        # В реальности можно взять из БД или рассчитать по расстоянию
        base_travel_time_per_stop = 2
        
        # Количество промежутков между остановками
        segments = to_idx - from_idx
        travel_time = segments * base_travel_time_per_stop
        
        # Можно добавить коэффициент загруженности в час пик
        if hour in [7, 8, 9, 17, 18, 19]:
            travel_time *= 1.3  # +30% в часы пик
        
        return travel_time

    def _calculate_agent_wait_time(self, route_intervals: List[int]) -> float:
        """
        Расчёт времени ожидания для одного агента
        """
        if not route_intervals:
            return 30
        
        effective_interval = 1 / sum(1/i for i in route_intervals)
        wait_time = random.uniform(0, effective_interval)
        return wait_time
    
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
        nearby = self._find_nearby_stops(network, original_stop_id, self.WALKING_RADIUS)
        
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
            return random.choice(open_stops)
        
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
            elif mod.type == ModificationType.ADD_STOP:
                self._apply_add_stop(modified, mod)
            elif mod.type == ModificationType.ADD_ROUTE:
                self._apply_add_route(modified, mod)
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

    def _apply_add_stop(self, network: Dict, mod: Modification):
        """
        Добавление новой остановки
        """
        stop_id = mod.targetId
        params = mod.parameters
        
        address = params.get("address", f"Новая остановка {stop_id}")
        lat = params.get("lat", 0)
        lng = params.get("lng", 0)
        capacity = params.get("capacity", 50)
        pattern = params.get("pattern", [5] * 24)
        
        cluster = "unknown"
        peak_hours = []
        
        network["stops"][stop_id] = {
            "id": stop_id,
            "address": address,
            "lat": lat,
            "lng": lng,
            "pattern": pattern,
            "base_load": 3,
            "cluster": cluster,
            "peak_hours": peak_hours,
            "capacity": capacity,
            "routes": [],
            "theoretical_capacity": 0,
            "closed_hours": [],
            "redistributed": {},
            "carryover": 0
        }
        
        if stop_id not in network["stop_routes"]:
            network["stop_routes"][stop_id] = []
        
        logger.info(f"➕ Добавлена новая остановка {stop_id}: {address}")

    def _apply_add_route(self, network: Dict, mod: Modification):
        """
        Добавление нового маршрута
        """
        route_id = mod.targetId
        params = mod.parameters
        
        number = params.get("number", str(route_id))
        stops = params.get("stops", [])
        interval = params.get("interval", 15)
        transport_type = params.get("transportType", "BUS")
        
        if len(stops) < 2:
            logger.warning(f"⚠️ Маршрут {route_id} содержит менее 2 остановок, пропускаем")
            return
        
        network["routes"][route_id] = {
            "id": route_id,
            "number": number,
            "base_interval": interval,
            "current_interval": interval,
            "stops": stops,
            "transport_type": transport_type,
            "frequency": 60 / max(interval, 1),
            "capacity_per_hour": (60 / max(interval, 1)) * self.BUS_CAPACITY,
            "vehicle_capacity": self.BUS_CAPACITY
        }
        
        for i, stop_id in enumerate(stops):
            if stop_id in network["stops"]:
                if "routes" not in network["stops"][stop_id]:
                    network["stops"][stop_id]["routes"] = []
                
                route_info = {
                    "route_id": route_id,
                    "order": i,
                    "interval": interval,
                    "capacity_per_hour": network["routes"][route_id]["capacity_per_hour"]
                }
                network["stops"][stop_id]["routes"].append(route_info)
                
                if stop_id not in network["stop_routes"]:
                    network["stop_routes"][stop_id] = []
                network["stop_routes"][stop_id].append(route_id)
        
        for i in range(len(stops) - 1):
            stop_a = stops[i]
            stop_b = stops[i + 1]
            
            key = f"{min(stop_a, stop_b)}:{max(stop_a, stop_b)}"
            if key not in network["stop_connections"]:
                network["stop_connections"][key] = []
            
            connection = {
                "route_id": route_id,
                "from_stop": stop_a,
                "to_stop": stop_b,
                "travel_time": 5
            }
            network["stop_connections"][key].append(connection)
        
        for stop_id in stops:
            if stop_id in network["stops"]:
                route_ids = network["stop_routes"].get(stop_id, [])
                theoretical_capacity = 0
                for rid in route_ids:
                    if rid in network["routes"]:
                        theoretical_capacity += network["routes"][rid]["capacity_per_hour"]
                network["stops"][stop_id]["theoretical_capacity"] = theoretical_capacity
        
        logger.info(f"🛤️ Добавлен новый маршрут {route_id}: {number}, остановок: {len(stops)}")
    
    def _calculate_metrics_from_hourly(self, hourly_data: List[Dict], network: Dict) -> Metrics:
        """
        Расчёт базовых метрик с учётом времени в пути
        """
        if not hourly_data:
            return Metrics(
                avgWaitTime=0,
                maxWaitTime=0,
                totalPassengers=0,
                avgLoad=0,
                transportUtilization=0,
                avgTravelTime=0,
                maxTravelTime=0
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
        
        all_travel_times = []
        for h in hourly_data:
            all_travel_times.extend(h.get("travel_times", []))
        
        if all_travel_times:
            avg_travel = np.mean(all_travel_times)
            max_travel = np.max(all_travel_times)
        else:
            avg_travel = 0
            max_travel = 0
        
        return Metrics(
            avgWaitTime=float(weighted_wait),
            maxWaitTime=float(max_wait),
            totalPassengers=total_pass,
            avgLoad=float(avg_load),
            transportUtilization=float(avg_load / 10),
            avgTravelTime=float(avg_travel),
            maxTravelTime=float(max_travel)
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