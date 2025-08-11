import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import HeaderComponent from './header.tsx';
import MapComponent from './map.tsx';
import { getMarkers } from './GetMarkes.ts';
import BusStop from './BusStop.tsx';

function App() {
  const [searchValue, setSearchValue] = useState('');
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapState, setMapState] = useState({
    center: [55.751244, 37.618423], // Москва по умолчанию
    zoom: 10
  });

  useEffect(() => {
    const fetchMarkers = async () => {
      try {
        const data = await getMarkers();
        setMarkers(data);
      } catch (error) {
        console.error('Ошибка загрузки маркеров:', error);
      }
    };

    // Первоначальная загрузка
    fetchMarkers();

    // Интервал для обновления
    const intervalId = setInterval(fetchMarkers, 12000);

    return () => clearInterval(intervalId);
  }, []);

  const handleMarkerSelect = (marker) => {
    setSelectedMarker(marker);
  };

  const handleMapMove = (newCenter, newZoom) => {
    setMapState({
      center: newCenter,
      zoom: newZoom
    });
  };

  return (
    <Router>
      <Routes>
        <Route path="/bus-stop" element={<BusStop />} />
        <Route path="/" element={
          <>
            <HeaderComponent 
              onSearchInputChange={setSearchValue} 
              markers={markers} 
              onMarkerSelect={handleMarkerSelect}
            />
            <MapComponent 
              markers={markers} 
              selectedMarker={selectedMarker}
              initialCenter={mapState.center}
              initialZoom={mapState.zoom}
              onMapMove={handleMapMove}
            />
          </>
        } />
      </Routes>
    </Router>
  );
}

export default App;