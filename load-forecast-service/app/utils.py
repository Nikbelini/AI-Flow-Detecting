import plotly.graph_objects as go
from plotly.subplots import make_subplots
from sklearn.metrics import mean_absolute_error, mean_squared_error
import numpy as np

def calculate_metrics(actual_passenger, actual_load, pred_passenger, pred_load):
    """Расчет метрик качества"""
    return {
        'passenger_mae': mean_absolute_error(actual_passenger, pred_passenger),
        'passenger_rmse': np.sqrt(mean_squared_error(actual_passenger, pred_passenger)),
        'load_mae': mean_absolute_error(actual_load, pred_load),
        'load_rmse': np.sqrt(mean_squared_error(actual_load, pred_load))
    }

def create_forecast_plot(historical_data, predictions):
    """Создание графика прогноза"""
    # Преобразуем исторические данные
    history_times = [pd.to_datetime(item['timestamp']) for item in historical_data[-24:]]
    history_passengers = [item['passenger_count'] for item in historical_data[-24:]]
    history_loads = [item['load'] for item in historical_data[-24:]]
    
    # Данные прогноза
    forecast_times = [pd.to_datetime(pred['timestamp']) for pred in predictions]
    forecast_passengers = [pred['predicted_passenger_count'] for pred in predictions]
    forecast_loads = [pred['predicted_load'] for pred in predictions]
    
    fig = make_subplots(
        rows=2, cols=1,
        subplot_titles=['Прогноз пассажиропотока', 'Прогноз загрузки остановки']
    )
    
    # Пассажиропоток
    fig.add_trace(
        go.Scatter(x=history_times, y=history_passengers,
                  mode='lines+markers', name='История', line=dict(color='blue')),
        row=1, col=1
    )
    
    fig.add_trace(
        go.Scatter(x=forecast_times, y=forecast_passengers,
                  mode='lines+markers', name='Прогноз', 
                  line=dict(color='red', dash='dash')),
        row=1, col=1
    )
    
    # Загрузка
    fig.add_trace(
        go.Scatter(x=history_times, y=history_loads,
                  mode='lines+markers', name='История', line=dict(color='green')),
        row=2, col=1
    )
    
    fig.add_trace(
        go.Scatter(x=forecast_times, y=forecast_loads,
                  mode='lines+markers', name='Прогноз', 
                  line=dict(color='orange', dash='dash')),
        row=2, col=1
    )
    
    fig.update_layout(height=600, title_text="Прогноз пассажиропотока")
    return fig.to_html(include_plotlyjs='cdn')