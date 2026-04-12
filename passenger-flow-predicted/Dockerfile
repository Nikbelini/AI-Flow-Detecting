# FROM python:3.14-slim

FROM pytorch/pytorch:2.11.0-cuda12.8-cudnn9-runtime

WORKDIR /app

# Системные зависимости для sklearn
# RUN apt-get update && apt-get install -y \
#     build-essential \
#     && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Убедись, что в requirements.txt НЕТ строк torch и torchvision!
# RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir --break-system-packages -r requirements.txt

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

COPY . .
RUN mkdir -p result/models

EXPOSE 8083
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8083"]
