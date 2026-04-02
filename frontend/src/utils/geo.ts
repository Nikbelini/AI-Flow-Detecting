export const isValidCoordinate = (lat: number, lng: number): boolean => {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
};

export const toMapLibre = (lat: number, lng: number): [number, number] => {
  if (!isValidCoordinate(lat, lng)) {
    throw new Error(`Invalid coords: lat=${lat}, lng=${lng}`);
  }
  return [lng, lat];
};

export const formatCoordsHuman = (lat: number, lng: number, decimals = 4): string => {
  const ns = lat >= 0 ? 'с.ш.' : 'ю.ш.';
  const ew = lng >= 0 ? 'в.д.' : 'з.д.';
  return `${Math.abs(lat).toFixed(decimals)}° ${ns}, ${Math.abs(lng).toFixed(decimals)}° ${ew}`;
};

export const safeToMapLibre = (lat: number, lng: number): [number, number] => {
  // Если координаты явно перепутаны (широта > 90 или долгота > 180)
  if (!isValidCoordinate(lat, lng) && isValidCoordinate(lng, lat)) {
    console.warn('🔄 Auto-fix: coords were swapped, using [lat, lng] as [lng, lat]');
    return [lat, lng]; // исходные были (lng, lat), меняем на (lat, lng) → [lng, lat]
  }
  return toMapLibre(lat, lng);
};