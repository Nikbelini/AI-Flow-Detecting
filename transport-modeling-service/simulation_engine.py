# transport-modeling-service/simulation_engine.py
import numpy as np
from datetime import datetime
import logging
from typing import List, Dict, Any
import asyncio

from data_models import (
    SimulationResults, Metrics, HourlyData, AffectedStop,
    Modification, StopStatus
)
from modifications import ModificationApplier

logger = logging.getLogger(__name__)

class SimulationEngine:
    def __init__(self, cache_service, db_service):
        self.cache = cache_service
        self.db = db_service
        self.modification_applier = ModificationApplier()
    
    async def run(
        self,
        city_id: int,
        modifications: List[Modification],
        stops_data: List[Dict]
    ) -> SimulationResults:
        """
        Запуск симуляции
        """
        logger.info(f"🏁 Запуск симуляции для города {city_id}")
        
        # Фильтруем только включенные модификации
        active_mods = [m for m in modifications if m.enabled]
        
        # 1. Получаем базовое состояние (без изменений)
        base_state = await self._get_base_state(stops_data)
        
        # 2. Применяем изменения
        modified_state = await self._apply_modifications(
            base_state, 
            active_mods,
            stops_data
        )
        
        # 3. Симулируем по часам
        hourly_data = await self._simulate_hourly(
            base_state,
            modified_state,
            active_mods
        )
        
        # 4. Считаем метрики
        base_metrics = self._calculate_metrics(base_state)
        modified_metrics = self._calculate_metrics(modified_state)
        
        # 5. Находим наиболее затронутые остановки
        affected_stops = self._find_affected_stops(
            base_state,
            modified_state,
            stops_data
        )
        
        results = SimulationResults(
            baseMetrics=base_metrics,
            modifiedMetrics=modified_metrics,
            hourlyData=hourly_data,
            affectedStops=affected_stops
        )
        
        logger.info(f"✅ Симуляция завершена: время ожидания +{modified_metrics.avgWaitTime - base_metrics.avgWaitTime:.1f} мин")
        
        return results
    
    async def _get_base_state(self, stops_data: List[Dict]) -> Dict:
        """
        Получение базового состояния сети
        """
        state = {
            "stops": {},
            "routes": {},
            "metrics": {}
        }
        
        for stop in stops_data:
            stop_id = stop["id"]
            state["stops"][stop_id] = {
                "id": stop_id,
                "address": stop["address"],
                "pattern": stop.get("avg_pattern", [5] * 24),
                "base_count": stop.get("avg_count", 10),
                "load": stop.get("avg_load", 3),
                "wait_time": stop.get("avg_wait_time", 8),
                "capacity": 50  # базовая вместимость
            }
        
        return state
    
    async def _apply_modifications(
        self,
        base_state: Dict,
        modifications: List[Modification],
        stops_data: List[Dict]
    ) -> Dict:
        """
        Применение изменений к сети
        """
        # Копируем состояние
        modified_state = {
            "stops": base_state["stops"].copy(),
            "routes": base_state["routes"].copy()
        }
        
        for mod in modifications:
            if mod.type == "close_stop" and mod.target_id:
                # Закрываем остановку
                if mod.target_id in modified_state["stops"]:
                    modified_state["stops"][mod.target_id]["closed_hours"] = \
                        mod.parameters.get("hours", [7, 8, 9, 17, 18, 19])
                    
                    logger.info(f"🚫 Закрыта остановка {mod.target_id} в часы: {mod.parameters.get('hours')}")
            
            elif mod.type == "change_interval" and mod.target_id:
                # Меняем интервал
                modified_state["stops"][mod.target_id]["new_interval"] = \
                    mod.parameters.get("interval", 15)
            
            elif mod.type == "change_capacity" and mod.target_id:
                # Меняем вместимость
                modified_state["stops"][mod.target_id]["new_capacity"] = \
                    mod.parameters.get("capacity", 30)
        
        return modified_state
    
    async def _simulate_hourly(
        self,
        base_state: Dict,
        modified_state: Dict,
        modifications: List[Modification]
    ) -> List[HourlyData]:
        """
        Почасовая симуляция
        """
        hourly = []
        
        for hour in range(24):
            # Базовый сценарий
            base_passengers = sum(
                stop["pattern"][hour] 
                for stop in base_state["stops"].values()
            )
            
            base_wait = np.mean([
                stop.get("wait_time", 8) 
                for stop in base_state["stops"].values()
            ])
            
            # Модифицированный сценарий
            modified_passengers = base_passengers
            modified_wait = base_wait
            
            # Применяем эффекты закрытых остановок
            for mod in modifications:
                if mod.type == "close_stop" and mod.target_id:
                    closed_hours = mod.parameters.get("hours", [])
                    if hour in closed_hours:
                        stop = modified_state["stops"].get(mod.target_id)
                        if stop:
                            # Пассажиры перераспределяются на соседние
                            modified_passengers -= stop["pattern"][hour]
                            modified_wait *= 1.2  # +20% времени ожидания
            
            hourly.append(HourlyData(
                hour=hour,
                basePassengers=float(base_passengers),
                modifiedPassengers=float(modified_passengers),
                baseWaitTime=float(base_wait),
                modifiedWaitTime=float(modified_wait)
            ))
        
        return hourly
    
    def _calculate_metrics(self, state: Dict) -> Metrics:
        """
        Расчёт метрик по состоянию
        """
        stops = list(state["stops"].values())
        
        avg_wait = np.mean([s.get("wait_time", 8) for s in stops])
        max_wait = np.max([s.get("wait_time", 8) for s in stops])
        total_pass = sum(s.get("pattern", [0])[0] for s in stops)
        avg_load = np.mean([s.get("load", 3) for s in stops])
        
        return Metrics(
            avgWaitTime=float(avg_wait),
            maxWaitTime=float(max_wait),
            totalPassengers=int(total_pass),
            avgLoad=float(avg_load),
            transportUtilization=float(avg_load / 10)  # 0-1 scale
        )
    
    def _find_affected_stops(
        self,
        base_state: Dict,
        modified_state: Dict,
        stops_data: List[Dict]
    ) -> List[AffectedStop]:
        """
        Поиск остановок, наиболее затронутых изменениями
        """
        affected = []
        
        for stop_data in stops_data:
            stop_id = stop_data["id"]
            
            # Базовые значения
            base_load = base_state["stops"].get(stop_id, {}).get("load", 3)
            base_wait = base_state["stops"].get(stop_id, {}).get("wait_time", 8)
            
            # Модифицированные значения
            modified_load = modified_state["stops"].get(stop_id, {}).get("load", 3)
            modified_wait = modified_state["stops"].get(stop_id, {}).get("wait_time", 8)
            
            # Изменения
            load_change = ((modified_load - base_load) / base_load * 100) if base_load > 0 else 0
            wait_change = modified_wait - base_wait
            
            # Определяем статус
            if load_change < -10:
                status = StopStatus.IMPROVED
            elif load_change > 10:
                status = StopStatus.WORSENED
            else:
                status = StopStatus.NEUTRAL
            
            # Берём только значительные изменения
            if abs(load_change) > 10 or abs(wait_change) > 1:
                affected.append(AffectedStop(
                    id=stop_id,
                    address=stop_data["address"],
                    loadChange=float(load_change),
                    waitTimeChange=float(wait_change),
                    status=status
                ))
        
        # Сортируем по убыванию влияния
        affected.sort(key=lambda x: abs(x.loadChange), reverse=True)
        
        return affected[:10]  # Топ-10