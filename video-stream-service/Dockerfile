FROM python:3.13-slim-bookworm

ENV PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /code

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/

ENV UV_COMPILE_BYTE=1
ENV UV_LINK_MODE=copy

RUN apt-get update && apt-get install ffmpeg libsm6 libxext6 libgl1  -y

COPY ./pyproject.toml ./uv.lock ./.python-version /code/

RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --no-install-project

COPY . /code/

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync

