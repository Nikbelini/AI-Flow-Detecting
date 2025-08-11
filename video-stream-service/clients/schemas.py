from pydantic import BaseModel, TypeAdapter


class StopsUrlSchema(BaseModel):
    id: int
    url: str


class StopsUrlsResponse(BaseModel):
    stops: list[StopsUrlSchema]

stop_urls_adapter = TypeAdapter(list[StopsUrlSchema])
