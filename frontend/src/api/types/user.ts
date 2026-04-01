export type UserRoles = 'ADMIN' | 'USER' | 'LoGISTIC' | 'OTHER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'USER' | 'LoGISTIC' | 'OTHER';
  emailConfirmed: boolean;
  twoFactorEnabled: boolean;
  accountLocked: boolean;
  failedAttempts: number;
  lockUntil: string | null;
  lastPasswordChangeAt: string | null;
  lastLoginAt: string | null;
  createdAt?: string;
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

export interface UserGetResponse {
  id: number;
  email: string;
  fullName: string;
  role: UserRoles;
  emailConfirmed: boolean;
  twoFactorEnabled: boolean;
  accountLocked: boolean;
  failedAttempts: number;
  lockUntil: string | null;
  lastPasswordChangeAt: string | null;
  lastLoginAt: string | null;
}

export interface UserUpdate {
  fullName?: string;
  email?: string;
}

export interface OtpRequest {
  otp: string;
}

export interface ChangePassword {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PolicyUpdate {
  passwordExpirationDays?: number;
  maxFailedAttempts?: number;
  lockDurationSeconds?: number;
}

export interface SecurityPolicyDto {
  id: number;
  maxFailedAttempts: number;
  lockDurationSeconds: number;
  passwordExpirationDays: number;
}

export interface DeviceSessionDto {
  sessionId: string;
  ip: string;
  country: string;
  browser: string;
  os: string;
  deviceName: string;
  createdAt: string;
  lastActiveAt: string;
  currentSession: boolean;
  revoked: boolean;
}