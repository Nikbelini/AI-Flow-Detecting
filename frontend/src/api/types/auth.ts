export type UserRoles = 'USER' | 'ADMIN' | 'MODERATOR';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRoles;
}

export interface AuthResponse {
  accessToken?: string;
  refreshToken?: string;
  requireOtp?: boolean;
  tempToken?: string;
  email?: string;
  message?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface OtpVerifyPayload {
  otp: string;
  tempToken?: string;
  email?: string;
  type?: 'LOGIN' | 'FORGOT_PASSWORD';
}