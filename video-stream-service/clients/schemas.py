from typing import Optional
from pydantic import BaseModel, TypeAdapter


class StopsUrlSchema(BaseModel):
    id: int
    url: Optional[str] = None


class StopsUrlsResponse(BaseModel):
    stops: list[StopsUrlSchema]

stop_urls_adapter = TypeAdapter(list[StopsUrlSchema])
