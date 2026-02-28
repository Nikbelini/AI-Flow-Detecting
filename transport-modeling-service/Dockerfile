# transport-modeling-service/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Копирование зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копирование кода
COPY . .

# Создаём __init__.py
RUN touch /app/__init__.py

# Делаем run.py исполняемым
RUN chmod +x /app/run.py

# Устанавливаем PYTHONPATH
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Порты
EXPOSE 8084

# ЗАПУСК ЧЕРЕЗ run.py (это решает проблему!)
CMD ["python", "run.py"]