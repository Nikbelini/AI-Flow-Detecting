import React from 'react';

const PopupContent = ({ marker }) => {
    const loadToColor = (load) => {
        if (load <= 3) return "green";
        if (load <= 7) return "yellow";
        return "red";
    };

    return (
        <div className="popup-card">
            <div className="popup-header">
                <h3>Остановка</h3>
            </div>
            <div className="popup-body">
                <div className="popup-row">
                    <div className="popup-icon">📍</div>
                    <div className="popup-address">{marker.address || 'Адрес не указан'}</div>
                </div>
                {marker.url && (
                    <div className="popup-row">
                        <div className="popup-icon">🔗</div>
                        <a href={marker.url} target="_blank" rel="noopener noreferrer" className="popup-url">
                            {marker.url}
                        </a>
                    </div>
                )}
                <div className="popup-metrics">
                    <div className="metric-item">
                        <div className="metric-icon">👥</div>
                        <div className="metric-value">{marker.count}</div>
                        <div className="metric-label">посетителей</div>
                    </div>
                    <div className="metric-item">
                        <div className="metric-icon">⚡</div>
                        <div className="metric-value">{marker.velocity}</div>
                        <div className="metric-label">скорость</div>
                    </div>
                </div>
            </div>
            <div className="popup-footer">
                <div className="load-indicator">
                    <div className="load-dot" style={{ background: loadToColor(marker.load) }} />
                    <span className="load-text">Нагрузка: {marker.load}/10</span>
                </div>
            </div>
        </div>
    );
};

export default PopupContent;