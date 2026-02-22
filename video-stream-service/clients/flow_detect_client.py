from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from httpx import Client, Timeout, Limits
from .schemas import StopsUrlSchema, StopsUrlsResponse
from loguru import logger


@dataclass(frozen=True, kw_only=True, slots=True)
class WeatherData:
    weatherCode: int
    precipitation: float
    datetime: datetime

@dataclass(frozen=True, kw_only=True, slots=True)
class FlowDetectClient:
    url: Optional[str] = None

    @property
    def client(self) -> Client:
        timeout = Timeout(timeout=6)
        limits = Limits(max_connections=10, max_keepalive_connections=10)
        client = Client(
            base_url=self.url,
            verify=False,
            timeout=timeout,
            limits=limits,
        )
        return client

    def get_stops_urls(self) -> list[StopsUrlSchema]:
        response = self.client.get('/stops/url')
        response.raise_for_status()
        response_body = response.json()
        stops = StopsUrlsResponse(**response_body)
        # stop_urls = stop_urls_adapter.validate_python(response_body)
        return stops.stops

    def patch_stops_metrics(self, _id: int, count: int) -> None:
        request_body = {"count": count}
        response = self.client.patch(f'/stops/{_id}', json=request_body)
        response.raise_for_status()

    def get_current_weather(self, stop_id: int) -> WeatherData:
        """
        Получить последнюю погоду для города, к которому относится остановка.
        Если не удалось — fallback на clear, precipitation=0
        """
        try:
            response = self.client.get(f"/weather/latest/{stop_id}")
            response.raise_for_status()
            data = response.json()
            if not data:
                raise ValueError("Погода не найдена")

            weather = WeatherData(
                weatherCode=int(data.get("weatherCode", 0)),
                precipitation=float(data.get("precipitation", 0.0)),
                datetime=datetime.fromisoformat(data.get("datetime")) if data.get("datetime") else datetime.now()
            )
            logger.info(f"🌤️ Получена погода для stop{stop_id}: {weather}")
            return weather

        except Exception as e:
            logger.warning(f"⚠️ Не удалось получить погоду для stop{stop_id}, fallback на clear: {e}")
            # fallback
            return WeatherData(weatherCode=0, precipitation=0.0, datetime=datetime.now())