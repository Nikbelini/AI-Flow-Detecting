import { Api } from '../services';
import type { AuthResponse, LoginCredentials, OtpVerifyPayload, OtpVerifyResponse } from '../types/auth';
import type { RegisterRequest, RegisterResponse, User } from '../types/user';

export const login = (credentials: LoginCredentials) => {
  const payload = {
    ...credentials,
    deviceId: localStorage.getItem('flowdetect_device_id') || undefined,
  };

  return Api.post<AuthResponse>('/api/auth/login', payload).then(res => res.data);
}

export const verifyOtpForToken = (payload: OtpVerifyPayload) => {
  const enriched = {
    ...payload,
    deviceId: localStorage.getItem('flowdetect_device_id') || undefined,
  };
  return Api.post<AuthResponse>('/api/auth/token', enriched).then(res => res.data);
}

export const resendOtp = (email: string) =>
  Api.post('/api/auth/resend-otp', { email }).then(res => res.data);

export const forgotPassword = (email: string) =>
  Api.post('/api/auth/forgot-password', { email }).then(res => res.data);

export const verifyOtpForPasswordReset = (payload: { email: string; otp: string }) =>
  Api.post<OtpVerifyResponse>('/api/v1/auth/verify-otp-forgot-password', payload)
    .then(res => res.data);

export const verifyOtpForResetToken = (payload: { email: string; otp: string }) =>
  Api.post<{ resetToken: string; message: string }>('/api/auth/verify-otp-forgot-password/token', payload)
    .then(res => res.data);

export const resetPassword = (payload: { token: string; newPassword: string }) =>
  Api.post('/api/auth/reset-password', payload).then(res => res.data);

export const resetPasswordByToken = (payload: { resetToken: string; newPassword: string }) =>
  Api.post<Map<string, string>>('/api/auth/reset-password/by-token', payload)
    .then(res => res.data);

export const getCurrentUser = () =>
  Api.get<User>('/api/user/me').then(res => res.data);

export const logout = () =>
  Api.post('/api/auth/logout').then(res => res.data);

export const validateToken = (token: string) =>
  Api.get(`/api/auth/valid-token?token=${encodeURIComponent(token)}`).then(res => res.data);

export const register = (payload: RegisterRequest) =>
  Api.post<RegisterResponse>('/api/auth/register', payload).then(res => res.data);
