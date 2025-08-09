from pydantic import BaseModel, TypeAdapter


class StopsUrlSchema(BaseModel):
    id: int
    url: str


stop_urls_adapter = TypeAdapter(list[StopsUrlSchema])
