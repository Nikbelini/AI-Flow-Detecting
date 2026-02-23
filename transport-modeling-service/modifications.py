# transport-modeling-service/modifications.py
from typing import Tuple, Optional
from data_models import Modification, ModificationType

class ModificationApplier:
    def validate(self, mod: Modification) -> Tuple[bool, Optional[str]]:
        """
        Валидация модификации
        """
        if mod.type == ModificationType.CLOSE_STOP:
            return self._validate_close_stop(mod)
        
        elif mod.type == ModificationType.CHANGE_INTERVAL:
            return self._validate_change_interval(mod)
        
        elif mod.type == ModificationType.CHANGE_CAPACITY:
            return self._validate_change_capacity(mod)
        
        return False, f"Неизвестный тип изменения: {mod.type}"
    
    def _validate_close_stop(self, mod: Modification) -> Tuple[bool, Optional[str]]:
        if not mod.target_id:
            return False, "Не указана остановка"
        
        hours = mod.parameters.get("hours", [])
        if not hours:
            return False, "Не указаны часы закрытия"
        
        for h in hours:
            if not isinstance(h, int) or h < 0 or h > 23:
                return False, f"Некорректный час: {h}"
        
        return True, None
    
    def _validate_change_interval(self, mod: Modification) -> Tuple[bool, Optional[str]]:
        if not mod.target_id:
            return False, "Не указана остановка"
        
        interval = mod.parameters.get("interval")
        if not interval or not isinstance(interval, (int, float)):
            return False, "Некорректный интервал"
        
        if interval < 1 or interval > 60:
            return False, "Интервал должен быть от 1 до 60 минут"
        
        return True, None
    
    def _validate_change_capacity(self, mod: Modification) -> Tuple[bool, Optional[str]]:
        if not mod.target_id:
            return False, "Не указана остановка"
        
        capacity = mod.parameters.get("capacity")
        if not capacity or not isinstance(capacity, int):
            return False, "Некорректная вместимость"
        
        if capacity < 10 or capacity > 200:
            return False, "Вместимость должна быть от 10 до 200"
        
        return True, None