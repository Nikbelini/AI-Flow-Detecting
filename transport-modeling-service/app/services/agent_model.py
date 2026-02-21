# app/services/agent_model.py
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Set
import random
import logging
from collections import defaultdict

from app.models.data_models import (
    Stop, Route, Agent, PassengerDemand, SimulationScenario
)

logger = logging.getLogger(__name__)

class AgentModel:
    def __init__(self):
        self.agents = []
        self.current_time = None
        self.simulation_id = None
    
    def initialize_simulation(self, city_id: int, 
                            stops: List[Stop],
                            routes: List[Route],
                            scenario: SimulationScenario) -> str:
        """Инициализировать симуляцию"""
        self.simulation_id = f"sim_{city_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.current_time = datetime.now().replace(hour=6, minute=0, second=0)
        self.agents = []
        self.stops = {stop.id: stop for stop in stops}
        self.routes = {route.id: route for route in routes}
        
        # Создаем агентов на основе спроса
        num_agents = self._estimate_agent_count(stops, scenario)
        self._create_agents(num_agents, stops, scenario)
        
        logger.info(f"Simulation {self.simulation_id} initialized with {num_agents} agents")
        return self.simulation_id
    
    def _estimate_agent_count(self, stops: List[Stop], 
                             scenario: SimulationScenario) -> int:
        """Оценить количество агентов"""
        total_demand = sum(stop.count for stop in stops)
        
        # Масштабируем по сценарию
        scale_factor = scenario.parameters.get('demand_scale', 1.0)
        
        # Каждый агент представляет примерно 1-3 пассажира
        agents_per_passenger = random.uniform(1, 3)
        
        estimated_agents = int(total_demand * scale_factor / agents_per_passenger)
        
        # Ограничиваем для производительности
        max_agents = scenario.parameters.get('max_agents', 10000)
        return min(estimated_agents, max_agents)
    
    def _create_agents(self, num_agents: int, 
                      stops: List[Stop],
                      scenario: SimulationScenario):
        """Создать агентов"""
        stop_ids = [stop.id for stop in stops]
        stop_weights = [stop.count + 1 for stop in stops]  # +1 чтобы избежать 0
        
        for agent_id in range(num_agents):
            # Выбираем начальную остановку (взвешенная по спросу)
            current_stop = random.choices(stop_ids, weights=stop_weights)[0]
            
            # Выбираем целевую остановку (не может быть той же)
            possible_destinations = [sid for sid in stop_ids if sid != current_stop]
            destination_stop = random.choice(possible_destinations)
            
            # Время отправления (распределение по часам)
            departure_hour = self._sample_departure_hour(scenario)
            departure_time = self.current_time.replace(
                hour=departure_hour,
                minute=random.randint(0, 59)
            )
            
            # Предпочтения транспорта
            transport_preferences = self._generate_transport_preferences()
            
            agent = Agent(
                id=agent_id,
                current_stop_id=current_stop,
                destination_stop_id=destination_stop,
                departure_time=departure_time,
                route_preferences=transport_preferences,
                patience_level=random.uniform(0.7, 1.3),
                walking_distance_limit=random.uniform(300, 1000)
            )
            
            self.agents.append(agent)
    
    def _sample_departure_hour(self, scenario: SimulationScenario) -> int:
        """Выбрать час отправления с учетом сценария"""
        hour_distribution = scenario.parameters.get(
            'hourly_distribution',
            {
                7: 0.15, 8: 0.20, 9: 0.10,  # Утро
                12: 0.05, 13: 0.05, 14: 0.05,  # День
                17: 0.15, 18: 0.20, 19: 0.05  # Вечер
            }
        )
        
        hours = list(hour_distribution.keys())
        weights = list(hour_distribution.values())
        
        return random.choices(hours, weights=weights)[0]
    
    def _generate_transport_preferences(self) -> List[str]:
        """Сгенерировать предпочтения транспорта"""
        transport_types = ['BUS', 'TROLLEYBUS', 'TRAM', 'MINIBUS', 'METRO']
        weights = [0.25, 0.15, 0.20, 0.30, 0.10]  # Примерные предпочтения
        
        # Выбираем 1-3 типа транспорта
        num_preferences = random.randint(1, 3)
        preferred_types = random.choices(
            transport_types, 
            weights=weights, 
            k=num_preferences
        )
        
        return list(set(preferred_types))  # Убираем дубликаты
    
    def run_simulation_step(self, step_minutes: int = 15) -> Dict:
        """Выполнить один шаг симуляции"""
        step_results = {
            'timestamp': self.current_time,
            'active_agents': 0,
            'completed_trips': 0,
            'waiting_agents': defaultdict(int),
            'onboard_agents': defaultdict(int),
            'stop_loads': defaultdict(int),
            'route_utilization': defaultdict(int)
        }
        
        # Обновляем время
        self.current_time += timedelta(minutes=step_minutes)
        
        # Обрабатываем каждого агента
        for agent in self.agents:
            if agent.departure_time <= self.current_time and agent.arrival_time is None:
                # Агент активен
                step_results['active_agents'] += 1
                
                # Логика перемещения агента
                self._process_agent_movement(agent, step_results)
        
        return step_results
    
    def _process_agent_movement(self, agent: Agent, results: Dict):
        """Обработать перемещение агента"""
        # Здесь должна быть сложная логика выбора маршрута,
        # ожидания, посадки, высадки и т.д.
        
        # Временная упрощенная логика
        current_stop = self.stops[agent.current_stop_id]
        destination_stop = self.stops[agent.destination_stop_id]
        
        # Ищем подходящие маршруты
        suitable_routes = self._find_suitable_routes(
            agent.current_stop_id,
            agent.destination_stop_id,
            agent.route_preferences
        )
        
        if suitable_routes:
            # Агент выбирает маршрут
            chosen_route = random.choice(suitable_routes)
            
            # Обновляем статистику
            results['route_utilization'][chosen_route.id] += 1
            results['onboard_agents'][chosen_route.id] += 1
            
            # Симулируем поездку
            travel_time = self._estimate_travel_time(
                agent.current_stop_id,
                agent.destination_stop_id,
                chosen_route
            )
            
            agent.arrival_time = self.current_time + timedelta(minutes=travel_time)
            results['completed_trips'] += 1
        else:
            # Агент ждет
            results['waiting_agents'][agent.current_stop_id] += 1
        
        # Обновляем нагрузку на остановке
        results['stop_loads'][agent.current_stop_id] += 1
    
    def _find_suitable_routes(self, start_stop_id: int,
                             end_stop_id: int,
                             preferences: List[str]) -> List[Route]:
        """Найти подходящие маршруты"""
        suitable_routes = []
        
        for route in self.routes.values():
            # Проверяем, проходит ли маршрут через обе остановки
            start_found = False
            end_found = False
            
            for route_stop in route.stops:
                if route_stop.stop_id == start_stop_id:
                    start_found = True
                if route_stop.stop_id == end_stop_id:
                    end_found = True
                
                if start_found and end_found:
                    # Проверяем предпочтения
                    if route.transport_type in preferences:
                        suitable_routes.append(route)
                    break
        
        return suitable_routes
    
    def _estimate_travel_time(self, start_stop_id: int,
                             end_stop_id: int,
                             route: Route) -> int:
        """Оценить время в пути"""
        # Находим порядок остановок в маршруте
        start_order = None
        end_order = None
        
        for route_stop in route.stops:
            if route_stop.stop_id == start_stop_id:
                start_order = route_stop.order_in_route
            if route_stop.stop_id == end_stop_id:
                end_order = route_stop.order_in_route
        
        if start_order is None or end_order is None:
            return 30  # Запасное значение
        
        # Расчет времени
        stop_count = abs(end_order - start_order)
        avg_time_per_stop = 3  # минуты
        
        return stop_count * avg_time_per_stop
    
    def run_full_simulation(self, duration_hours: int = 12) -> Dict:
        """Запустить полную симуляцию"""
        steps = []
        
        for hour in range(duration_hours):
            for minute in [0, 15, 30, 45]:
                step_result = self.run_simulation_step()
                steps.append(step_result)
        
        # Агрегируем результаты
        aggregated = self._aggregate_results(steps)
        
        return {
            'simulation_id': self.simulation_id,
            'duration_hours': duration_hours,
            'total_steps': len(steps),
            'total_agents': len(self.agents),
            'completed_trips': sum(step['completed_trips'] for step in steps),
            'aggregated_results': aggregated,
            'detailed_steps': steps[:100]  # Первые 100 шагов для деталей
        }
    
    def _aggregate_results(self, steps: List[Dict]) -> Dict:
        """Агрегировать результаты симуляции"""
        aggregated = {
            'avg_stop_loads': defaultdict(list),
            'route_efficiency': {},
            'peak_hours': [],
            'bottleneck_stops': []
        }
        
        # Собираем данные по остановкам
        stop_loads_over_time = defaultdict(list)
        
        for step in steps:
            for stop_id, load in step['stop_loads'].items():
                stop_loads_over_time[stop_id].append(load)
        
        # Рассчитываем среднюю нагрузку
        for stop_id, loads in stop_loads_over_time.items():
            aggregated['avg_stop_loads'][stop_id] = {
                'avg': np.mean(loads),
                'max': np.max(loads),
                'std': np.std(loads)
            }
        
        # Находим узкие места (остановки с максимальной нагрузкой)
        max_loads = [(stop_id, data['max']) 
                     for stop_id, data in aggregated['avg_stop_loads'].items()]
        max_loads.sort(key=lambda x: x[1], reverse=True)
        aggregated['bottleneck_stops'] = max_loads[:5]
        
        return aggregated
    
    def apply_scenario_changes(self, scenario: SimulationScenario):
        """Применить изменения сценария"""
        changes = scenario.parameters.get('changes', {})
        
        # Изменение маршрутов
        if 'new_routes' in changes:
            for route_data in changes['new_routes']:
                self._add_route(route_data)
        
        if 'modified_routes' in changes:
            for route_data in changes['modified_routes']:
                self._modify_route(route_data)
        
        if 'removed_routes' in changes:
            for route_id in changes['removed_routes']:
                self._remove_route(route_id)
        
        # Изменение спроса
        if 'demand_changes' in changes:
            for stop_id, demand_change in changes['demand_changes'].items():
                self._adjust_stop_demand(int(stop_id), demand_change)
        
        logger.info(f"Applied scenario changes: {scenario.name}")
    
    def _add_route(self, route_data: Dict):
        """Добавить новый маршрут"""
        # Создаем объект Route из данных
        route = Route(**route_data)
        self.routes[route.id] = route
        
        # Обновляем информацию у связанных остановок
        for route_stop in route.stops:
            if route_stop.stop_id in self.stops:
                stop = self.stops[route_stop.stop_id]
                # Обновляем нагрузку на остановке
                stop.load = min(stop.load + 10, 100)  # Примерная логика
    
    def _modify_route(self, route_data: Dict):
        """Модифицировать существующий маршрут"""
        route_id = route_data['id']
        if route_id in self.routes:
            # Обновляем маршрут
            self.routes[route_id] = Route(**route_data)
    
    def _remove_route(self, route_id: int):
        """Удалить маршрут"""
        if route_id in self.routes:
            del self.routes[route_id]
    
    def _adjust_stop_demand(self, stop_id: int, demand_change: Dict):
        """Скорректировать спрос на остановке"""
        if stop_id in self.stops:
            stop = self.stops[stop_id]
            
            # Применяем изменения
            scale_factor = demand_change.get('scale', 1.0)
            stop.count = int(stop.count * scale_factor)
            
            # Обновляем веса для генерации агентов
            # (это повлияет на будущие симуляции)