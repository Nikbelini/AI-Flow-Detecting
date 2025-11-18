from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from .models import ForecastRequest, ForecastResponse, HealthResponse, BatchForecastRequest
from .predictor import PassengerFlowPredictor
import logging
from datetime import datetime
import os
from typing import List
from pydantic import ValidationError
import json
import gzip

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Инициализация приложения
app = FastAPI(
    title="Passenger Flow Forecast API",
    description="API для прогнозирования пассажиропотока на остановках",
    version="1.0.0"
)

# Инициализация предсказателя
predictor = PassengerFlowPredictor(
    model_weights_path=os.getenv("MODEL_WEIGHTS_PATH", "models/best_powerful_model.weights.h5"),
    preprocessor_path=os.getenv("PREPROCESSOR_PATH", "models/preprocessor.pkl")
)

@app.on_event("startup")
async def startup_event():
    """Загрузка модели при запуске"""
    logger.info("🚀 Загрузка модели прогнозирования...")
    try:
        if not predictor.load_model():
            logger.warning("⚠️ Модель не загружена, но сервис продолжает работу")
        else:
            logger.info("✅ Модель успешно загружена")
    except Exception as e:
        logger.error(f"❌ Критическая ошибка загрузки модели: {e}")
        # Не падаем, позволяем сервису работать в degraded mode

@app.get("/health")
async def health_check():
    """Проверка здоровья сервиса"""
    return JSONResponse(
        content={
            "status": "healthy" if predictor.is_loaded else "degraded",
            "service": "load-forecast-service",
            "model_loaded": predictor.is_loaded,
            "timestamp": datetime.now().isoformat()
        }
    )

@app.get("/")
async def root():
    """Корневой endpoint"""
    return {
        "message": "Passenger Flow Forecast Service",
        "version": "1.0.0",
        "status": "running",
        "model_loaded": predictor.is_loaded
    }

@app.post("/forecast")
async def make_forecast(request: Request):
    try:
        # Читаем сырое тело запроса
        raw_body = await request.body()
        logger.info("📥 Received RAW request body")
        logger.info(f"Raw body length: {len(raw_body)} bytes")
        
        # Проверяем заголовки на gzip
        content_encoding = request.headers.get('content-encoding', '').lower()
        logger.info(f"Content-Encoding: {content_encoding}")
        
        # Парсим данные с учетом gzip
        try:
            if 'gzip' in content_encoding:
                logger.info("🔧 Detected gzip encoding, decompressing...")
                import gzip
                decompressed_body = gzip.decompress(raw_body)
                request_data = json.loads(decompressed_body)
                logger.info("✅ GZIP decompression successful")
            else:
                request_data = json.loads(raw_body)
                logger.info("✅ JSON parsed successfully (no compression)")
        except (json.JSONDecodeError, gzip.BadGzipFile) as e:
            logger.error(f"❌ Data parsing error: {e}")
            # Пробуем распарсить как plain JSON на всякий случай
            try:
                request_data = json.loads(raw_body)
                logger.info("✅ JSON parsed as plain text (fallback)")
            except:
                raise HTTPException(status_code=400, detail=f"Invalid data format: {e}")
        
        logger.info(f"Request data type: {type(request_data)}")
        logger.info(f"Request data keys: {list(request_data.keys())}")
        
        # Логируем структуру запроса
        historical_data = request_data.get('historicalData') or request_data.get('historical_data')
        logger.info(f"Historical data type: {type(historical_data)}")
        logger.info(f"Historical data length: {len(historical_data) if historical_data else 0}")
        
        forecast_horizon = request_data.get('forecastHorizon') or request_data.get('forecast_horizon')
        logger.info(f"Forecast horizon: {forecast_horizon}")
        
        include_plots = request_data.get('includePlots') or request_data.get('include_plots')
        logger.info(f"Include plots: {include_plots}")
        
        if historical_data and len(historical_data) > 0:
            sample = historical_data[0]
            logger.info(f"Sample data type: {type(sample)}")
            logger.info(f"Sample data keys: {list(sample.keys())}")
            logger.info(f"Sample data preview: {str(sample)[:200]}...")
        
        logger.info("🔄 Attempting Pydantic validation...")
        
        # Пытаемся распарсить через Pydantic
        try:
            forecast_request = ForecastRequest(**request_data)
            logger.info("✅ Pydantic validation PASSED")
            logger.info(f"Parsed historical_data count: {len(forecast_request.historical_data)}")
            logger.info(f"Parsed forecast_horizon: {forecast_request.forecast_horizon}")
            logger.info(f"Parsed include_plots: {forecast_request.include_plots}")
        except ValidationError as e:
            logger.error("❌ Pydantic validation FAILED")
            logger.error(f"Validation errors: {e.errors()}")
            for error in e.errors():
                logger.error(f"Field: {error['loc']}, Error: {error['msg']}, Type: {error['type']}")
            raise HTTPException(status_code=400, detail=f"Validation error: {e.errors()}")
        
        # Остальной код обработки...
        if not predictor.is_loaded:
            raise HTTPException(status_code=503, detail="Модель временно недоступна")
        
        if len(forecast_request.historical_data) < 24:
            raise HTTPException(status_code=400, detail="Недостаточно исторических данных")
        
        logger.info(f"📊 Starting forecast for {len(forecast_request.historical_data)} records")
        
        predictions = predictor.forecast(
            forecast_request.historical_data, 
            forecast_request.forecast_horizon
        )
        
        metrics = {
            "passenger_mae": 2.99,
            "passenger_rmse": 3.92,
            "load_mae": 0.61,
            "load_rmse": 0.82
        }
        
        response = ForecastResponse(
            predictions=predictions,
            metrics=metrics,
            plot_html=None,
            timestamp=datetime.now()
        )
        
        logger.info("✅ Forecast completed successfully")
        return response.dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка прогнозирования: {e}")
        import traceback
        logger.error(f"❌ Stack trace: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Ошибка прогнозирования: {str(e)}")

@app.post("/batch_forecast")
async def make_batch_forecast(request: BatchForecastRequest):
    """Пакетное прогнозирование"""
    results = []
    for forecast_request in request.requests:
        try:
            result = await make_forecast(forecast_request.dict())
            results.append(result)
        except Exception as e:
            results.append({"error": str(e)})
    
    return {"results": results}

@app.get("/model/info")
async def get_model_info():
    """Информация о модели"""
    if not predictor.is_loaded:
        raise HTTPException(status_code=503, detail="Модель не загружена")
    
    return {
        "model_type": "Hybrid Neuro-Fuzzy LSTM",
        "input_shape": {
            "temporal": predictor.model.input_shape[0],
            "fuzzy": predictor.model.input_shape[1]
        },
        "output_shape": predictor.model.output_shape,
        "trainable_params": predictor.model.count_params()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)