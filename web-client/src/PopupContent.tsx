import React, { useState } from 'react';
import HlsPlayer from './HlsPlayer';
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

interface PopupContentProps {
    marker: Marker;
}

const PopupContent: React.FC<PopupContentProps> = ({ marker }) => {
    const [showForecast, setShowForecast] = useState(false);

    const loadToColor = (load: number): string => {
        if (load <= 3) return "var(--load-low, #27ae60)";
        if (load <= 7) return "var(--load-medium, #f39c12)";
        return "var(--load-high, #e74c3c)";
    };

    return (
        <div className="popup-card">
            <div className="popup-header">
                <h3>🚏 Остановка</h3>
                <button
                    className={`forecast-toggle ${showForecast ? 'active' : ''}`}
                    onClick={() => setShowForecast(!showForecast)}
                    title={showForecast ? 'Скрыть прогноз' : 'Показать прогноз'}
                >
                    {showForecast ? '📊' : '🔮'}
                </button>
            </div>

            <div className="popup-body">
                <div className="popup-row">
                    <div className="popup-icon">📍</div>
                    <div className="popup-address">{marker.address || 'Адрес не указан'}</div>
                </div>

                {marker.url && (
                    <div className="popup-row">
                        <div className="popup-icon">🔗</div>
                        <a
                            href={`/bus-stop?src=${marker.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="popup-url"
                        >
                            Показать видео в реальном времени
                        </a>
                    </div>
                )}

                <div className="popup-metrics">
                    <div className="metric-item">
                        <div className="metric-icon">👥</div>
                        <div className="metric-content">
                            <div className="metric-value">{marker.count}</div>
                            <div className="metric-label">людей сейчас</div>
                        </div>
                    </div>
                    <div className="metric-item">
                        <div className="metric-icon">⚡</div>
                        <div className="metric-content">
                            <div className="metric-value">{marker.velocity}</div>
                            <div className="metric-label">скорость притока</div>
                        </div>
                    </div>
                    <div className="metric-item">
                        <div className="metric-icon">📊</div>
                        <div className="metric-content">
                            <div className="metric-value">{marker.load}/10</div>
                            <div className="metric-label">загрузка</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="popup-footer">
                <div className="load-indicator">
                    <div
                        className="load-dot"
                        style={{ background: loadToColor(marker.load) }}
                        title={`Уровень загрузки: ${marker.load}/10`}
                    />
                    <span className="load-text">
                        {marker.load <= 3 ? 'Свободно' :
                            marker.load <= 7 ? 'Умеренная загрузка' : 'Высокая загрузка'}
                    </span>
                </div>
            </div>

            {/* Панель прогнозирования */}
            {showForecast && (
                <ForecastPanel
                    address={marker.address} // передаем address вместо stopId
                    stopData={marker}
                    onClose={() => setShowForecast(false)}
                />
            )}
        </div>
    );
};

export default PopupContent;