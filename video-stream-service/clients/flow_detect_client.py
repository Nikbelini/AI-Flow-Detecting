from dataclasses import dataclass
from httpx import Client, Timeout, Limits
from .schemas import StopsUrlSchema, StopsUrlsResponse


@dataclass(frozen=True, kw_only=True, slots=True)
class FlowDetectClient:
    url: str

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
