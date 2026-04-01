import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { baseUrl } from './env';

// Типы для ошибок
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  timestamp?: string;
}

// Конфигурация клиента
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: baseUrl,
    timeout: 30000, // Увеличиваем для моделирования
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
  });

  // Интерсептор для добавления токена (если нужно)
  client.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('access_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Интерсептор для обработки ошибок
  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error) => {
      console.error('API Error:', error.response?.data || error.message);
      
      // Форматируем ошибку
      const apiError: ApiError = {
        message: error.response?.data?.message || error.message || 'Unknown error',
        code: error.response?.data?.code,
        status: error.response?.status,
        timestamp: new Date().toISOString(),
      };
      
      // Можно добавить обработку специфичных ошибок
      if (error.response?.status === 401) {
        // Обработка неавторизованного доступа
        window.location.href = '/login';
      }
      
      return Promise.reject(apiError);
    }
  );

  return client;
};

const apiClient = createApiClient();

export default apiClient;