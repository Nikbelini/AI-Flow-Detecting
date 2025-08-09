import MapComponent from './map.tsx';
import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import HeaderComponent from './header.tsx';
import { getMarkers } from './GetMarkes.ts';

function App() {
  const [searchValue, setSearchValue] = useState('');
  const [markers, setMarkers] = useState([]);

  useEffect(() => {
      // Загружаем маркеры асинхронно
      const fetchMarkers = async () => {
          try {
              const data = await getMarkers();
              setMarkers(data);
          } catch (error) {
              console.error('Ошибка загрузки маркеров:', error);
              setMapError('Не удалось загрузить маркеры');
          }
      };

      fetchMarkers();
  }, []);

  return (
    <>
      <HeaderComponent onSearchInputChange={setSearchValue} markers={markers} />

      <MapComponent markers={markers}>

      </MapComponent>

    </>
  )
}

export default App
