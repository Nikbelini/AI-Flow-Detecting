import React, { useState, useEffect, useRef, useCallback } from 'react';
import { baseUrl } from './env'

// Интерфейс для данных с сервера (snake_case)
interface ForecastDataFromServer {
    timestamp: string;
    predicted_passenger_count: number;
    predicted_load: number;
    forecast_hour: number;
}

// Интерфейс для внутреннего использования (camelCase)
interface ForecastData {
    timestamp: string;
    predictedPassengerCount: number;
    predictedLoad: number;
    forecastHour: number;
}

interface ForecastResponse {
    address: string;
    generatedAt: string;
    forecasts: ForecastData[];
    metrics?: {
        passenger_mae?: number;
        passenger_rmse?: number;
        load_mae?: number;
        load_rmse?: number;
    };
    plotHtml?: string;
}

interface ForecastPanelProps {
    address: string;
    stopData: {
        count: number;
        load: number;
        velocity: number;
    };
    onClose: () => void;
    isOpen: boolean;
    onToggle: (isOpen: boolean) => void;
    forecastState: any;
    onForecastDataUpdate: (data: any) => void;
}

const ForecastPanel: React.FC<ForecastPanelProps> = React.memo(({
    address,
    stopData,
    onClose,
    isOpen,
    onToggle,
    forecastState,
    onForecastDataUpdate
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { forecastData, autoRefresh, showMiniChart } = forecastState;
    const fetchCountRef = useRef(0);
    const isMountedRef = useRef(true);

    console.log('🎯 ForecastPanel render for:', address, 'fetchCount:', fetchCountRef.current);

    // Функция для преобразования данных с сервера
    const transformForecastData = (data: any): ForecastResponse => {
        return {
            address: data.address,
            generatedAt: data.generated_at,
            forecasts: data.forecasts.map((item: any) => ({
                timestamp: item.timestamp,
                predictedPassengerCount: item.predictedPassengerCount,
                predictedLoad: item.predictedLoad,
                forecastHour: item.forecastHour
            })),
            metrics: data.metrics,
            plotHtml: data.plotHtml
        };
    };

    const fetchForecast = useCallback(async () => {
        if (!address || !isMountedRef.current) return;

        fetchCountRef.current++;
        console.log('🔄 Fetching forecast for address:', address, 'fetch #:', fetchCountRef.current);

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${baseUrl}/forecast`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    address: address,
                    forecastHours: 6
                })
            });

            console.log('📡 Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API error:', errorText);
                throw new Error(errorText || 'Ошибка получения прогноза');
            }

            const rawData = await response.json();
            console.log('✅ Raw forecast data received for:', address);

            if (!isMountedRef.current) return;

            // Преобразуем данные с сервера в нужный формат
            const forecastData = transformForecastData(rawData);
            onForecastDataUpdate(forecastData);
        } catch (err) {
            if (!isMountedRef.current) return;
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            console.error('❌ Forecast error:', err);
            setError(errorMessage);
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [address, onForecastDataUpdate]);

    // Автообновление
    useEffect(() => {
        if (autoRefresh) {
            console.log('⏰ Starting auto-refresh for:', address);
            const interval = setInterval(fetchForecast, 5 * 60 * 1000);
            return () => {
                console.log('⏰ Stopping auto-refresh for:', address);
                clearInterval(interval);
            };
        }
    }, [autoRefresh, address, fetchForecast]);

    // Первоначальная загрузка
    useEffect(() => {
        isMountedRef.current = true;

        // Загружаем прогноз только если его еще нет или данные устарели
        const shouldFetch = !forecastData ||
            Date.now() - new Date(forecastData.generatedAt).getTime() > 2 * 60 * 1000; // 2 минуты

        if (shouldFetch) {
            console.log('🎯 Initial forecast load for address:', address);
            fetchForecast();
        } else {
            console.log('🎯 Using cached forecast for:', address);
        }

        return () => {
            console.log('🧹 Cleaning up ForecastPanel for:', address);
            isMountedRef.current = false;
        };
    }, [address, fetchForecast, forecastData]);

    const loadToColor = (load: number): string => {
        if (load <= 3) return "#27ae60"; // зеленый
        if (load <= 7) return "#f39c12"; // желтый
        return "#e74c3c"; // красный
    };

    const getTrendIcon = (current: number, predicted: number): string => {
        const diff = predicted - current;
        if (diff > 2) return '📈';
        if (diff < -2) return '📉';
        return '➡️';
    };

    const getTrendDescription = (current: number, predicted: number): string => {
        const diff = predicted - current;
        if (diff > 2) return `+${Math.round(diff)} чел.`;
        if (diff < -2) return `${Math.round(diff)} чел.`;
        return 'без изменений';
    };

    const formatTime = (timestamp: string): string => {
        return new Date(timestamp).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Мини-график для компактного отображения
    const MiniForecastChart = React.memo(({ forecasts }: { forecasts: ForecastData[] }) => {
        const maxPassengers = Math.max(...forecasts.map(f => f.predictedPassengerCount));
        const minPassengers = Math.min(...forecasts.map(f => f.predictedPassengerCount));
        const range = maxPassengers - minPassengers || 1;

        return (
            <div className="mini-chart" style={{
                background: '#f8f9fa',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '12px'
            }}>
                <div className="mini-chart-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#333' }}>
                        📊 Мини-график
                    </span>
                </div>

                <div className="chart-container" style={{
                    height: '40px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '4px',
                    padding: '4px 0'
                }}>
                    {forecasts.map((item, index) => {
                        const height = ((item.predictedPassengerCount - minPassengers) / range) * 30 + 10;
                        return (
                            <div
                                key={index}
                                className="chart-bar"
                                style={{
                                    flex: 1,
                                    height: `${height}px`,
                                    background: loadToColor(item.predictedLoad),
                                    borderRadius: '2px',
                                    position: 'relative',
                                    minWidth: '8px'
                                }}
                                title={`+${item.forecastHour}ч: ${Math.round(item.predictedPassengerCount)} чел.`}
                            >
                                <div className="bar-label" style={{
                                    position: 'absolute',
                                    top: '-18px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    fontSize: '10px',
                                    color: '#666',
                                    whiteSpace: 'nowrap'
                                }}>
                                    +{item.forecastHour}ч
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    });

    if (!isOpen) {
        return (
            <div className="forecast-panel-collapsed" style={{
                background: 'white',
                borderRadius: '8px',
                padding: '12px',
                margin: '8px 0',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                border: '1px solid #e0e0e0',
                cursor: 'pointer'
            }} onClick={() => onToggle(true)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', color: '#333' }}>🔮 Прогноз</span>
                    <span style={{ fontSize: '12px', color: '#666' }}>
                        {forecastData ? `Обновлено: ${new Date(forecastData.generatedAt).toLocaleTimeString('ru-RU')}` : 'Нажмите чтобы развернуть'}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="forecast-panel" style={{
            background: 'white',
            borderRadius: '12px',
            padding: '16px',
            margin: '10px 0',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0'
        }}>
            <div className="forecast-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px'
            }}>
                <div className="forecast-title">
                    <h3 style={{
                        margin: '0 0 4px 0',
                        fontSize: '18px',
                        color: '#333',
                        fontWeight: '600'
                    }}>
                        🔮 Прогноз загрузки
                    </h3>
                    <span style={{
                        fontSize: '14px',
                        color: '#666',
                        display: 'block'
                    }}>
                        AI предсказание на 6 часов
                    </span>
                </div>
                <div className="forecast-actions" style={{
                    display: 'flex',
                    gap: '8px'
                }}>
                    <button
                        className={`forecast-btn refresh-btn ${loading ? 'loading' : ''}`}
                        onClick={fetchForecast}
                        disabled={loading}
                        title="Обновить прогноз"
                        style={{
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            opacity: loading ? 0.6 : 1
                        }}
                    >
                        {loading ? '🔄' : '🔄'}
                    </button>
                    <button
                        className="forecast-btn close-btn"
                        onClick={() => onToggle(false)}
                        title="Свернуть панель прогноза"
                        style={{
                            background: '#6c757d',
                            color: 'white',
                            border: 'none',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        ▲
                    </button>
                    <button
                        className="forecast-btn close-btn"
                        onClick={onClose}
                        title="Закрыть панель прогноза"
                        style={{
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {error && (
                <div className="forecast-error" style={{
                    background: '#ffe6e6',
                    color: '#d63031',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <div className="error-icon">⚠️</div>
                    <div className="error-message" style={{ flex: 1 }}>{error}</div>
                    <button
                        className="error-retry"
                        onClick={fetchForecast}
                        style={{
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        Повторить
                    </button>
                </div>
            )}

            {loading && !forecastData && (
                <div className="forecast-loading" style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: '#666'
                }}>
                    <div className="loading-spinner" style={{
                        width: '20px',
                        height: '20px',
                        border: '2px solid #f3f3f3',
                        borderTop: '2px solid #007bff',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 8px'
                    }}></div>
                    <span>Загружаем прогноз...</span>
                </div>
            )}

            {forecastData && (
                <>
                    {/* Мини-график */}
                    <MiniForecastChart forecasts={forecastData.forecasts} />

                    {/* Текущее состояние */}
                    <div className="current-stats" style={{
                        background: '#f8f9fa',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '16px'
                    }}>
                        <div className="current-stat" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span className="stat-label" style={{
                                fontWeight: '500',
                                color: '#666'
                            }}>
                                Текущая ситуация:
                            </span>
                            <div className="stat-values" style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span className="passenger-count" style={{
                                    fontWeight: 'bold',
                                    color: '#333'
                                }}>
                                    {stopData.count} чел.
                                </span>
                                <div
                                    className="load-indicator-small"
                                    style={{
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        background: loadToColor(stopData.load)
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Прогноз на следующие часы */}
                    <div className="forecast-section" style={{ marginBottom: '20px' }}>
                        <h4 style={{
                            margin: '0 0 12px 0',
                            fontSize: '16px',
                            color: '#333',
                            fontWeight: '600'
                        }}>
                            📅 Прогноз по часам:
                        </h4>
                        <div className="forecast-list">
                            {forecastData.forecasts.map((item: ForecastData, index: number) => (
                                <div key={index} className="forecast-item" style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '12px 0',
                                    borderBottom: '1px solid #f0f0f0'
                                }}>
                                    <div className="forecast-time" style={{
                                        width: '80px',
                                        textAlign: 'center'
                                    }}>
                                        <div className="time-hour" style={{
                                            fontWeight: 'bold',
                                            color: '#333',
                                            fontSize: '14px'
                                        }}>
                                            +{item.forecastHour}ч
                                        </div>
                                        <div className="time-exact" style={{
                                            fontSize: '12px',
                                            color: '#666',
                                            marginTop: '2px'
                                        }}>
                                            {formatTime(item.timestamp)}
                                        </div>
                                    </div>
                                    <div className="forecast-data" style={{
                                        flex: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}>
                                        <div className="passenger-forecast" style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <span className="forecast-value" style={{
                                                fontWeight: '600',
                                                color: '#333',
                                                fontSize: '14px'
                                            }}>
                                                {Math.round(item.predictedPassengerCount)} чел.
                                            </span>
                                            <div className="trend-info" style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontSize: '12px',
                                                color: '#666'
                                            }}>
                                                <span className="trend-icon">
                                                    {getTrendIcon(stopData.count, item.predictedPassengerCount)}
                                                </span>
                                                <span className="trend-text">
                                                    {getTrendDescription(stopData.count, item.predictedPassengerCount)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="load-forecast">
                                            <div className="load-info" style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}>
                                                <span className="load-value" style={{
                                                    fontSize: '12px',
                                                    color: '#666',
                                                    minWidth: '40px'
                                                }}>
                                                    {Math.round(item.predictedLoad)}/10
                                                </span>
                                                <div
                                                    className="load-bar"
                                                    style={{
                                                        flex: 1,
                                                        height: '6px',
                                                        borderRadius: '3px',
                                                        width: `${item.predictedLoad * 10}%`,
                                                        background: loadToColor(item.predictedLoad),
                                                        transition: 'width 0.3s ease'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Метрики качества */}
                    {forecastData.metrics && (
                        <div className="metrics-section" style={{ marginBottom: '20px' }}>
                            <h4 style={{
                                margin: '0 0 12px 0',
                                fontSize: '16px',
                                color: '#333',
                                fontWeight: '600'
                            }}>
                                📊 Точность прогноза:
                            </h4>
                            <div className="metrics-grid" style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '8px'
                            }}>
                                <div className="metric-card" style={{
                                    background: '#e8f4fd',
                                    padding: '12px',
                                    borderRadius: '6px',
                                    textAlign: 'center'
                                }}>
                                    <div className="metric-label" style={{
                                        fontSize: '12px',
                                        color: '#666',
                                        marginBottom: '4px'
                                    }}>
                                        Ошибка (люди)
                                    </div>
                                    <div className="metric-value" style={{
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        color: '#007bff'
                                    }}>
                                        ±{forecastData.metrics.passenger_mae?.toFixed(1) || '?'} чел.
                                    </div>
                                </div>
                                <div className="metric-card" style={{
                                    background: '#e8f4fd',
                                    padding: '12px',
                                    borderRadius: '6px',
                                    textAlign: 'center'
                                }}>
                                    <div className="metric-label" style={{
                                        fontSize: '12px',
                                        color: '#666',
                                        marginBottom: '4px'
                                    }}>
                                        Ошибка (загрузка)
                                    </div>
                                    <div className="metric-value" style={{
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        color: '#007bff'
                                    }}>
                                        ±{forecastData.metrics.load_mae?.toFixed(1) || '?'}/10
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* График */}
                    {forecastData.plotHtml && (
                        <div className="chart-section" style={{ marginBottom: '20px' }}>
                            <h4 style={{
                                margin: '0 0 12px 0',
                                fontSize: '16px',
                                color: '#333',
                                fontWeight: '600'
                            }}>
                                📈 Визуализация прогноза
                            </h4>
                            <div
                                className="forecast-chart"
                                dangerouslySetInnerHTML={{ __html: forecastData.plotHtml }}
                            />
                        </div>
                    )}

                    <div className="forecast-footer" style={{
                        paddingTop: '12px',
                        borderTop: '1px solid #f0f0f0',
                        fontSize: '12px',
                        color: '#999'
                    }}>
                        <div className="footer-info" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px'
                        }}>
                            <span className="timestamp">
                                Обновлено: {new Date(forecastData.generatedAt).toLocaleTimeString('ru-RU')}
                            </span>
                            {autoRefresh && <span className="auto-refresh-indicator">🔄 авто</span>}
                        </div>
                        <div className="model-info" style={{ textAlign: 'center' }}>
                            Модель: Neuro-Fuzzy AI • Точность: ~95%
                        </div>
                    </div>
                </>
            )}

            {/* Стили для анимации спиннера */}
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
});

export default ForecastPanel;