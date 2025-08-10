import { useState } from 'react';

const HeaderComponent = ({ onSearchInputChange, markers, onMarkerSelect }) => {
    const [searchValue, setSearchValue] = useState('');
    const [filteredMarkers, setFilteredMarkers] = useState([]);

    const handleInputChange = (e) => {
        const value = e.target.value;
        setSearchValue(value);
        
        if (onSearchInputChange) {
            onSearchInputChange(value);
        }

        if (value.trim() === '') {
            setFilteredMarkers([]);
        } else {
            const filtered = markers.filter(marker => 
                marker.adress.toLowerCase().includes(value.toLowerCase())
            );
            setFilteredMarkers(filtered);
        }
    };

    const handleMarkerClick = (marker) => {
        if (onMarkerSelect) {
            onMarkerSelect(marker);
        }
        setSearchValue(marker.adress);
        setFilteredMarkers([]);
    };
    

    return (
        <header className="map-header">
            <div className="search-wrapper">
                <div className="search-container">
                    <svg
                        className="search-icon"
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M19 19L13 13M15 8C15 11.866 11.866 15 8 15C4.13401 15 1 11.866 1 8C1 4.13401 4.13401 1 8 1C11.866 1 15 4.13401 15 8Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                    <input 
                        className="map-header-search" 
                        type="text" 
                        placeholder='Введите адрес остановки...'
                        value={searchValue}
                        onChange={handleInputChange}
                    />
                </div>
                
                {filteredMarkers.length > 0 && (
                    <div className="search-results-container">
                        {filteredMarkers.map((marker, index) => (
                            <button
                                key={index}
                                className="search-result-button"
                                onClick={() => handleMarkerClick(marker)}
                            >
                                {marker.adress}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </header>
    );
};

export default HeaderComponent;