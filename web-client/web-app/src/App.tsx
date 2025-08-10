import { useState, useEffect } from 'react';
import './App.css';
import HeaderComponent from './header.tsx';
import MapComponent from './map.tsx';
import { getMarkers } from './GetMarkes.ts';

function App() {
  const [searchValue, setSearchValue] = useState('');
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);

  useEffect(() => {
    const fetchMarkers = async () => {
      try {
        const data = await getMarkers();
        setMarkers(data);
      } catch (error) {
        console.error('Ошибка загрузки маркеров:', error);
      }
    };

    fetchMarkers();
  }, []);

  const handleMarkerSelect = (marker) => {
    setSelectedMarker(marker);
  };

  return (
    <>
      <HeaderComponent 
        onSearchInputChange={setSearchValue} 
        markers={markers} 
        onMarkerSelect={handleMarkerSelect}
      />
      <MapComponent markers={markers} selectedMarker={selectedMarker} />
    </>
  );
}

export default App;