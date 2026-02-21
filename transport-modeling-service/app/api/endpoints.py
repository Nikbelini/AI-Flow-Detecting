# app/api/endpoints.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Dict, Optional
import asyncio
import uuid
from datetime import datetime, timedelta

from app.models.data_models import *
from app.models.simulation import *
from app.main import (
    get_data_service, get_statistical_model, 
    get_agent_model, get_data_processor
)
from app.services.data_service import DataService
from app.services.statistical_model import StatisticalModel
from app.services.agent_model import AgentModel
from app.utils.data_processor import DataProcessor

router = APIRouter()

# Результаты симуляций в памяти (в production использовать Redis)
simulation_results = {}

@router.get("/city/{city_id}/data")
async def get_city_complete_data(
    city_id: int,
    data_service: DataService = Depends(get_data_service)
):
    """Получить все данные города для моделирования"""
    data = await data_service.get_city_full_data(city_id)
    
    if not data.get('city'):
        raise HTTPException(status_code=404, detail="City not found")
    
    return {
        "success": True,
        "city_id": city_id,
        "data": data,
        "timestamp": datetime.now()
    }

@router.post("/city/{city_id}/analyze")
async def analyze_city_data(
    city_id: int,
    data_service: DataService = Depends(get_data_service),
    statistical_model: StatisticalModel = Depends(get_statistical_model)
):
    """Провести анализ данных города"""
    # Получаем данные
    data = await data_service.get_city_full_data(city_id)
    
    if not data.get('stops'):
        raise HTTPException(status_code=404, detail="No data available")
    
    # Анализируем паттерны остановок
    analysis_results = []
    for stop in data['stops']:
        pattern_analysis = statistical_model.analyze_stop_patterns(stop)
        analysis_results.append(pattern_analysis)
    
    # Корреляционный анализ
    correlation_matrix = statistical_model.calculate_correlation_matrix(data['stops'])
    transfer_patterns = statistical_model.identify_transfer_patterns(correlation_matrix)
    
    return {
        "success": True,
        "city_id": city_id,
        "stop_analysis": analysis_results,
        "correlation_analysis": {
            "matrix_size": correlation_matrix.shape,
            "transfer_patterns": transfer_patterns
        },
        "timestamp": datetime.now()
    }

@router.post("/city/{city_id}/predict")
async def predict_demand(
    city_id: int,
    prediction_request: DemandPredictionRequest,
    data_service: DataService = Depends(get_data_service),
    statistical_model: StatisticalModel = Depends(get_statistical_model)
):
    """Прогнозировать спрос"""
    # Получаем данные
    data = await data_service.get_city_full_data(city_id)
    
    # Создаем диапазон дат для прогноза
    start_date = prediction_request.start_date
    end_date = prediction_request.end_date
    
    date_range = pd.date_range(start=start_date, end=end_date, freq='H')
    
    # Прогнозируем для каждой остановки
    predictions = {}
    
    for stop in data['stops'][:50]:  # Ограничиваем для производительности
        stop_predictions = statistical_model.predict_demand(
            stop.id,
            date_range,
            data['weather'],
            data['events']
        )
        
        predictions[stop.id] = {
            "address": stop.address,
            "predictions": stop_predictions.to_dict('records')
        }
    
    return {
        "success": True,
        "city_id": city_id,
        "prediction_range": {
            "start": start_date,
            "end": end_date
        },
        "predictions": predictions,
        "timestamp": datetime.now()
    }

@router.post("/simulation/run")
async def run_simulation(
    simulation_request: SimulationRequest,
    background_tasks: BackgroundTasks,
    data_service: DataService = Depends(get_data_service),
    agent_model: AgentModel = Depends(get_agent_model)
):
    """Запустить симуляцию"""
    # Получаем данные города
    data = await data_service.get_city_full_data(simulation_request.city_id)
    
    if not data.get('city'):
        raise HTTPException(status_code=404, detail="City not found")
    
    # Создаем сценарий
    scenario = SimulationScenario(
        name=simulation_request.scenario_name,
        description=simulation_request.description,
        parameters=simulation_request.parameters
    )
    
    # Инициализируем симуляцию
    simulation_id = agent_model.initialize_simulation(
        simulation_request.city_id,
        data['stops'],
        data['routes'],
        scenario
    )
    
    # Применяем изменения сценария
    agent_model.apply_scenario_changes(scenario)
    
    # Запускаем симуляцию в фоне
    background_tasks.add_task(
        run_simulation_background,
        simulation_id,
        agent_model,
        simulation_request.duration_hours
    )
    
    return {
        "success": True,
        "simulation_id": simulation_id,
        "status": "started",
        "estimated_duration": f"{simulation_request.duration_hours * 2} seconds",
        "message": "Simulation started in background"
    }

async def run_simulation_background(simulation_id: str, 
                                   agent_model: AgentModel,
                                   duration_hours: int):
    """Фоновая задача для выполнения симуляции"""
    try:
        # Выполняем симуляцию
        results = agent_model.run_full_simulation(duration_hours)
        
        # Сохраняем результаты
        simulation_results[simulation_id] = {
            "status": "completed",
            "results": results,
            "completed_at": datetime.now()
        }
        
    except Exception as e:
        simulation_results[simulation_id] = {
            "status": "failed",
            "error": str(e),
            "failed_at": datetime.now()
        }

@router.get("/simulation/{simulation_id}/status")
async def get_simulation_status(simulation_id: str):
    """Получить статус симуляции"""
    if simulation_id not in simulation_results:
        return {
            "simulation_id": simulation_id,
            "status": "not_found",
            "message": "Simulation not found"
        }
    
    result = simulation_results[simulation_id]
    
    return {
        "simulation_id": simulation_id,
        "status": result["status"],
        "details": result
    }

@router.post("/optimization/route")
async def optimize_routes(
    optimization_request: RouteOptimizationRequest,
    data_service: DataService = Depends(get_data_service),
    data_processor: DataProcessor = Depends(get_data_processor)
):
    """Оптимизировать маршруты"""
    # Получаем данные
    data = await data_service.get_city_full_data(optimization_request.city_id)
    
    # Анализируем текущую ситуацию
    analysis = data_processor.analyze_route_efficiency(data['routes'], data['stops'])
    
    # Генерируем рекомендации
    recommendations = data_processor.generate_route_recommendations(
        analysis,
        optimization_request.optimization_goals
    )
    
    return {
        "success": True,
        "city_id": optimization_request.city_id,
        "current_analysis": analysis,
        "recommendations": recommendations,
        "optimization_goals": optimization_request.optimization_goals
    }

@router.post("/scenario/evaluate")
async def evaluate_scenario(
    scenario_request: ScenarioEvaluationRequest,
    data_service: DataService = Depends(get_data_service),
    statistical_model: StatisticalModel = Depends(get_statistical_model)
):
    """Оценить сценарий изменений"""
    # Получаем текущие данные
    current_data = await data_service.get_city_full_data(scenario_request.city_id)
    
    # Применяем сценарий к данным
    modified_data = apply_scenario_to_data(
        current_data,
        scenario_request.changes
    )
    
    # Анализируем изменения
    comparison = compare_scenarios(
        current_data,
        modified_data,
        statistical_model
    )
    
    return {
        "success": True,
        "scenario_name": scenario_request.name,
        "comparison": comparison,
        "estimated_impact": estimate_scenario_impact(comparison)
    }

@router.post("/visualization/generate")
async def generate_visualization(
    viz_request: VisualizationRequest,
    data_processor: DataProcessor = Depends(get_data_processor)
):
    """Сгенерировать визуализации"""
    # Генерируем различные типы визуализаций
    visualizations = {}
    
    if viz_request.types and "heatmap" in viz_request.types:
        heatmap_data = data_processor.generate_heatmap_data(
            viz_request.city_id,
            viz_request.parameters.get("time_range")
        )
        visualizations["heatmap"] = heatmap_data
    
    if viz_request.types and "network" in viz_request.types:
        network_graph = data_processor.generate_network_graph(
            viz_request.city_id
        )
        visualizations["network"] = network_graph
    
    if viz_request.types and "timeseries" in viz_request.types:
        timeseries_data = data_processor.generate_timeseries_data(
            viz_request.city_id,
            viz_request.parameters.get("stop_ids", [])
        )
        visualizations["timeseries"] = timeseries_data
    
    return {
        "success": True,
        "visualizations": visualizations,
        "formats": viz_request.formats
    }

# Вспомогательные модели запросов
class DemandPredictionRequest(BaseModel):
    start_date: datetime
    end_date: datetime
    include_weather: bool = True
    include_events: bool = True

class SimulationRequest(BaseModel):
    city_id: int
    scenario_name: str
    description: Optional[str] = None
    parameters: Dict = {}
    duration_hours: int = 12

class RouteOptimizationRequest(BaseModel):
    city_id: int
    optimization_goals: List[str] = ["efficiency", "coverage", "cost"]
    constraints: Optional[Dict] = None

class ScenarioEvaluationRequest(BaseModel):
    city_id: int
    name: str
    changes: Dict
    evaluation_metrics: List[str] = ["demand", "coverage", "efficiency"]

class VisualizationRequest(BaseModel):
    city_id: int
    types: List[str] = ["heatmap", "network", "timeseries"]
    parameters: Dict = {}
    formats: List[str] = ["json", "png"]