export const getOrCreateDeviceId = (): string => {
  const key = 'flowdetect_device_id';
  
  let id = localStorage.getItem(key);
  
  if (!id) {
    // Генерация простого UUID v4
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    localStorage.setItem(key, id);
  }
  
  return id;
};

/**
 * Очистить deviceId (при полном логауте, если нужно)
 */
export const clearDeviceId = (): void => {
  localStorage.removeItem('flowdetect_device_id');
};