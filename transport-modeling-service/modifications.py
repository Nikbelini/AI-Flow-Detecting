# transport-modeling-service/modifications.py
from typing import Tuple, Optional
from data_models import Modification, ModificationType, ModificationTarget

class ModificationApplier:
    def validate(self, mod: Modification) -> Tuple[bool, Optional[str]]:
        """
        Валидация модификации
        """
        if mod.type == ModificationType.CLOSE_STOP:
            return self._validate_close_stop(mod)
        
        elif mod.type == ModificationType.ADD_STOP:
            return self._validate_add_stop(mod)
        
        elif mod.type == ModificationType.ADD_ROUTE:
            return self._validate_add_route(mod)
        
        elif mod.type == ModificationType.CHANGE_INTERVAL:
            return self._validate_change_interval(mod)
        
        elif mod.type == ModificationType.CHANGE_CAPACITY:
            return self._validate_change_capacity(mod)
        
        return False, f"Неизвестный тип изменения: {mod.type}"
    
    def _validate_close_stop(self, mod: Modification) -> Tuple[bool, Optional[str]]:
        """Валидация закрытия остановки"""
        if mod.targetType != ModificationTarget.STOP:
            return False, "Закрытие остановки должно применяться к остановке"
        
        if not mod.targetId:
            return False, "Не указана остановка"
        
        hours = mod.parameters.get("hours", [])
        if not hours:
            return False, "Не указаны часы закрытия"
        
        for h in hours:
            if not isinstance(h, int) or h < 0 or h > 23:
                return False, f"Некорректный час: {h}"
        
        return True, None
    
    
    def _validate_add_stop(self, mod: Modification) -> Tuple[bool, Optional[str]]:
        """
        Валидация добавления новой остановки
        """
        if mod.targetType != ModificationTarget.STOP:
            return False, "Добавление остановки должно применяться к остановке"
        
        # ID может быть временным (от фронта), но должен быть
        if not mod.targetId:
            return False, "Не указан ID новой остановки"
        
        params = mod.parameters
        
        # Проверяем координаты (обязательно)
        lat = params.get("lat")
        lng = params.get("lng")
        
        if lat is None or lng is None:
            return False, "Не указаны координаты остановки"
        
        try:
            lat = float(lat)
            lng = float(lng)
            if lat < -90 or lat > 90 or lng < -180 or lng > 180:
                return False, "Некорректные координаты (выходят за допустимые пределы)"
        except (ValueError, TypeError):
            return False, "Некорректный формат координат (должны быть числами)"
        
        # Проверяем адрес (опционально, но лучше если есть)
        address = params.get("address", "")
        if address and len(address) > 200:
            return False, "Название остановки слишком длинное (максимум 200 символов)"
        
        # Проверяем вместимость (опционально)
        capacity = params.get("capacity", 50)
        if not isinstance(capacity, (int, float)):
            try:
                capacity = int(capacity)
            except (ValueError, TypeError):
                return False, "Вместимость должна быть числом"
        
        if capacity < 10 or capacity > 200:
            return False, "Вместимость должна быть от 10 до 200 пассажиров в час"
        
        # Проверяем паттерн (опционально)
        pattern = params.get("pattern")
        if pattern is not None:
            if not isinstance(pattern, list) or len(pattern) != 24:
                return False, "Паттерн должен быть списком из 24 чисел"
            for val in pattern:
                if not isinstance(val, (int, float)) or val < 0:
                    return False, "Все значения паттерна должны быть неотрицательными числами"
        
        return True, None
    
    def _validate_add_route(self, mod: Modification) -> Tuple[bool, Optional[str]]:
        """
        Валидация добавления нового маршрута
        """
        if mod.targetType != ModificationTarget.ROUTE:
            return False, "Добавление маршрута должно применяться к маршруту"
        
        # ID может быть временным (от фронта), но должен быть
        if not mod.targetId:
            return False, "Не указан ID нового маршрута"
        
        params = mod.parameters
        
        # Проверяем номер маршрута (обязательно)
        number = params.get("number")
        if not number:
            return False, "Не указан номер маршрута"
        
        if not isinstance(number, str) or len(number) > 20:
            return False, "Номер маршрута должен быть строкой до 20 символов"
        
        # Проверяем список остановок (обязательно)
        stops = params.get("stops", [])
        if not isinstance(stops, list):
            return False, "Список остановок должен быть массивом"
        
        if len(stops) < 2:
            return False, "Маршрут должен содержать минимум 2 остановки"
        
        # Проверяем, что все остановки - числа
        for stop_id in stops:
            if not isinstance(stop_id, (int, float)):
                return False, f"ID остановки должен быть числом: {stop_id}"
        
        # Проверяем интервал (обязательно)
        interval = params.get("interval", 15)
        if not isinstance(interval, (int, float)):
            try:
                interval = int(interval)
            except (ValueError, TypeError):
                return False, "Интервал должен быть числом"
        
        if interval < 1 or interval > 60:
            return False, "Интервал должен быть от 1 до 60 минут"
        
        # Проверяем тип транспорта (опционально)
        transport_type = params.get("transportType", "BUS")
        valid_types = ["BUS", "TROLLEYBUS", "TRAM", "MINIBUS"]
        if transport_type not in valid_types:
            return False, f"Некорректный тип транспорта. Допустимые: {', '.join(valid_types)}"
        
        # Проверяем название маршрута (опционально)
        name = params.get("name")
        if name and len(name) > 128:
            return False, "Название маршрута слишком длинное (максимум 128 символов)"
        
        # Проверяем путь (опционально, для отрисовки)
        path = params.get("path")
        if path is not None:
            if not isinstance(path, list):
                return False, "Путь маршрута должен быть массивом"
            
            for point in path:
                if not isinstance(point, list) or len(point) != 2:
                    return False, "Каждая точка пути должна быть [lng, lat]"
                try:
                    lng, lat = float(point[0]), float(point[1])
                    if lat < -90 or lat > 90 or lng < -180 or lng > 180:
                        return False, "Некорректные координаты в пути"
                except (ValueError, TypeError):
                    return False, "Некорректный формат координат в пути"
        
        return True, None
    
    def _validate_change_interval(self, mod: Modification) -> Tuple[bool, Optional[str]]:
        """Валидация изменения интервала маршрута"""
        if mod.targetType != ModificationTarget.ROUTE:
            return False, "Изменение интервала должно применяться к маршруту"
        
        if not mod.targetId:
            return False, "Не указан маршрут"
        
        interval = mod.parameters.get("interval")
        if not interval or not isinstance(interval, (int, float)):
            return False, "Некорректный интервал"
        
        if interval < 1 or interval > 60:
            return False, "Интервал должен быть от 1 до 60 минут"
        
        return True, None
    
    def _validate_change_capacity(self, mod: Modification) -> Tuple[bool, Optional[str]]:
        """Валидация изменения вместимости остановки"""
        if mod.targetType != ModificationTarget.STOP:
            return False, "Изменение вместимости должно применяться к остановке"
        
        if not mod.targetId:
            return False, "Не указана остановка"
        
        capacity = mod.parameters.get("capacity")
        if not capacity or not isinstance(capacity, int):
            return False, "Некорректная вместимость"
        
        if capacity < 10 or capacity > 200:
            return False, "Вместимость должна быть от 10 до 200"
        
        return True, None