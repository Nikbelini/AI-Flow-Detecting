FROM python:3.14-slim

WORKDIR /app

# Системные зависимости для sklearn
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

COPY . .

# Создаём директорию для моделей
RUN mkdir -p result/models

EXPOSE 8083

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8083", "--reload"]