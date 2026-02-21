from loguru import logger
from ultralytics import YOLO

class YoloModelRegistry:
    def __init__(self):
        self._cache = {}

    def get(self, model_path: str) -> YOLO:
        if model_path not in self._cache:
            logger.info(f"Загружаем YOLO модель: {model_path}")
            self._cache[model_path] = YOLO(model_path)
        return self._cache[model_path]