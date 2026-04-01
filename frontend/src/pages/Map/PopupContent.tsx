import React from 'react';
import ForecastPanel from './ForecastPanel';

interface Marker {
    id: number;
    address: string;
    url?: string;
    count: number;
    velocity: number;
    load: number;
    lat: number;
    lng: number;
}

interface ForecastState {
    showForecast: boolean;
    isForecastOpen: boolean;
    forecastData: any;
    autoRefresh: boolean;
    showMiniChart: boolean;
}

interface PopupContentProps {
    marker: Marker;
    forecastState: ForecastState;
    onForecastStateChange: (updates: Partial<ForecastState>) => void;
}

const PopupContent: React.FC<PopupContentProps> = ({ 
    marker, 
    forecastState, 
    onForecastStateChange 
}) => {
    const { showForecast, isForecastOpen } = forecastState;

    console.log('🔄 PopupContent render for:', marker.address);

    const loadToColor = (load: number): string => {
        if (load <= 3) return "var(--load-low, #27ae60)";
        if (load <= 7) return "var(--load-medium, #f39c12)";
        return "var(--load-high, #e74c3c)";
    };

    const handleForecastToggle = (show: boolean) => {
        console.log('📊 Forecast toggle:', show);
        onForecastStateChange({ 
            showForecast: show,
            isForecastOpen: show ? isForecastOpen : false
        });
    };

    const handleForecastPanelToggle = (open: boolean) => {
        console.log('📊 Forecast panel toggle:', open);
        onForecastStateChange({ isForecastOpen: open });
    };

    const handleCloseForecast = () => {
        console.log('📊 Closing forecast');
        onForecastStateChange({ 
            showForecast: false,
            isForecastOpen: false 
        });
    };

    const handleForecastDataUpdate = (forecastData: any) => {
        onForecastStateChange({ forecastData });
    };

    return (
        <div className="popup-card">
            <div className="popup-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
            }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>🚏 Остановка</h3>
                <button
                    className={`forecast-toggle ${showForecast ? 'active' : ''}`}
                    onClick={() => handleForecastToggle(!showForecast)}
                    title={showForecast ? 'Скрыть прогноз' : 'Показать прогноз'}
                    style={{
                        background: showForecast ? '#007bff' : '#6c757d',
                        color: 'white',
                        border: 'none',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {showForecast ? '📊 Скрыть' : '🔮 Прогноз'}
                </button>
            </div>

            <div className="popup-body">
                <div className="popup-row" style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    marginBottom: '8px'
                }}>
                    <div className="popup-icon" style={{ marginRight: '8px' }}>📍</div>
                    <div className="popup-address" style={{ fontSize: '14px', color: '#333' }}>
                        {marker.address || 'Адрес не указан'}
                    </div>
                </div>

                {marker.url && (
                    <div className="popup-row" style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '12px'
                    }}>
                        <div className="popup-icon" style={{ marginRight: '8px' }}>🔗</div>
                        <a
                            href={`/bus-stop?src=${marker.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="popup-url"
                            style={{
                                fontSize: '14px',
                                color: '#007bff',
                                textDecoration: 'none'
                            }}
                        >
                            Видео в реальном времени
                        </a>
                    </div>
                )}

                <div className="popup-metrics" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                    marginBottom: '12px'
                }}>
                    <div className="metric-item" style={{
                        background: '#f8f9fa',
                        padding: '8px',
                        borderRadius: '6px',
                        textAlign: 'center'
                    }}>
                        <div className="metric-icon" style={{ fontSize: '16px', marginBottom: '4px' }}>👥</div>
                        <div className="metric-content">
                            <div className="metric-value" style={{ 
                                fontWeight: 'bold', 
                                fontSize: '14px', 
                                color: '#333' 
                            }}>
                                {marker.count}
                            </div>
                            <div className="metric-label" style={{ 
                                fontSize: '11px', 
                                color: '#666' 
                            }}>
                                людей сейчас
                            </div>
                        </div>
                    </div>
                    <div className="metric-item" style={{
                        background: '#f8f9fa',
                        padding: '8px',
                        borderRadius: '6px',
                        textAlign: 'center'
                    }}>
                        <div className="metric-icon" style={{ fontSize: '16px', marginBottom: '4px' }}>⚡</div>
                        <div className="metric-content">
                            <div className="metric-value" style={{ 
                                fontWeight: 'bold', 
                                fontSize: '14px', 
                                color: '#333' 
                            }}>
                                {marker.velocity}
                            </div>
                            <div className="metric-label" style={{ 
                                fontSize: '11px', 
                                color: '#666' 
                            }}>
                                скорость притока
                            </div>
                        </div>
                    </div>
                    <div className="metric-item" style={{
                        background: '#f8f9fa',
                        padding: '8px',
                        borderRadius: '6px',
                        textAlign: 'center'
                    }}>
                        <div className="metric-icon" style={{ fontSize: '16px', marginBottom: '4px' }}>📊</div>
                        <div className="metric-content">
                            <div className="metric-value" style={{ 
                                fontWeight: 'bold', 
                                fontSize: '14px', 
                                color: '#333' 
                            }}>
                                {marker.load}/10
                            </div>
                            <div className="metric-label" style={{ 
                                fontSize: '11px', 
                                color: '#666' 
                            }}>
                                загрузка
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="popup-footer" style={{
                paddingTop: '8px',
                borderTop: '1px solid #f0f0f0'
            }}>
                <div className="load-indicator" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <div
                        className="load-dot"
                        style={{ 
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: loadToColor(marker.load)
                        }}
                        title={`Уровень загрузки: ${marker.load}/10`}
                    />
                    <span className="load-text" style={{
                        fontSize: '12px',
                        color: '#666'
                    }}>
                        {marker.load <= 3 ? 'Свободно' :
                            marker.load <= 7 ? 'Умеренная загрузка' : 'Высокая загрузка'}
                    </span>
                </div>
            </div>

            {/* Панель прогнозирования */}
            {showForecast && (
                <ForecastPanel
                    address={marker.address}
                    stopData={marker}
                    onClose={handleCloseForecast}
                    isOpen={isForecastOpen}
                    onToggle={handleForecastPanelToggle}
                    forecastState={forecastState}
                    onForecastDataUpdate={handleForecastDataUpdate}
                />
            )}
        </div>
    );
};

export default React.memo(PopupContent);