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
  deviceId?: string;
}

export interface OtpVerifyPayload {
  otp: string;
  tempToken?: string;
  email?: string;
  type?: 'LOGIN' | 'FORGOT_PASSWORD';
  deviceId?: string;
}

export interface OtpVerifyResponse {
  resetToken: string;
  message: string;
}
