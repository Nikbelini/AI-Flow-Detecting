import { Api } from '../services';
import type { AuthResponse, LoginCredentials, OtpVerifyPayload, User } from '../types/auth';
import type { RegisterRequest, RegisterResponse } from '../types/user';

export const login = (credentials: LoginCredentials) =>
  Api.post<AuthResponse>('/api/auth/login', credentials).then(res => res.data);

export const verifyOtpForToken = (payload: OtpVerifyPayload) =>
  Api.post<AuthResponse>('/api/auth/token', payload).then(res => res.data);

export const resendOtp = (email: string) =>
  Api.post('/api/auth/resend-otp', { email }).then(res => res.data);

export const forgotPassword = (email: string) =>
  Api.post('/api/auth/forgot-password', { email }).then(res => res.data);

export const verifyOtpForPasswordReset = (payload: { email: string; otp: string }) =>
  Api.post('/api/auth/verify-otp-forgot-password', payload).then(res => res.data);

export const resetPassword = (payload: { token: string; newPassword: string }) =>
  Api.post('/api/auth/reset-password', payload).then(res => res.data);

export const getCurrentUser = () =>
  Api.get<User>('/api/user/me').then(res => res.data);

export const logout = () =>
  Api.post('/api/auth/logout').then(res => res.data);

export const validateToken = (token: string) =>
  Api.get(`/api/auth/valid-token?token=${encodeURIComponent(token)}`).then(res => res.data);

export const register = (payload: RegisterRequest) =>
  Api.post<RegisterResponse>('/api/auth/register', payload).then(res => res.data);
