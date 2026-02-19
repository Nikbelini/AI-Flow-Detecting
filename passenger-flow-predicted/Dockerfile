FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
ENV PYTHONPATH=/app

COPY . .

EXPOSE 8083

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8083"]
