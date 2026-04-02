import { useState, useCallback, useEffect } from 'react';
import { citiesApi } from '../../api/endpoints/citiesApi';
import type { City } from '../../api/types';

export const useCities = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);

  const fetchCities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await citiesApi.getAllCities();
      setCities(data);
      
      // Выбираем первый город по умолчанию, если ещё не выбран
      if (data.length > 0 && selectedCityId === null) {
        setSelectedCityId(data[0].id);
      }
      return data;
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить список городов');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedCityId]);

  useEffect(() => {
    fetchCities();
  }, [fetchCities]);

  const selectCity = useCallback((cityId: number) => {
    setSelectedCityId(cityId);
  }, []);

  const selectedCity = useCallback(() => {
    return cities.find(c => c.id === selectedCityId) || null;
  }, [cities, selectedCityId]);

  return {
    cities,
    loading,
    error,
    selectedCityId,
    selectedCity: selectedCity(),
    selectCity,
    refreshCities: fetchCities,
  };
};