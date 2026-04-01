export type UserRoles = 'ADMIN' | 'USER' | 'LoGISTIC' | 'OTHER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRoles;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Типы для запроса
export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
}

// Типы для ответа
export interface RegisterResponse {
  success: boolean;
  message: string;
  email?: string;
}

// Ответ от бэкенда при логине/регистрации — предположим, что UserGet выглядит так:
export interface UserGet {
  id: number;
  email: string;
  fullName?: string;
  phoneNumber?: string;
  role: 'ADMIN' | 'USER' | 'LoGISTIC' | 'OTHER'; // или string, если роли динамические
}