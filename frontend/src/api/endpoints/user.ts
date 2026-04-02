import { Api } from '../services';
import type { 
  UserGetResponse, UserUpdate, 
  ChangePassword, PolicyUpdate, SecurityPolicyDto, DeviceSessionDto 
} from '../types/user';

export const getMe = () => 
  Api.get<UserGetResponse>('/api/user/me').then(res => res.data);

export const updateProfile = (data: UserUpdate) => 
  Api.put<UserGetResponse>('/api/user/update', data).then(res => res.data);

export const requestConfirmation = () => 
  Api.post('/api/user/confirm/request').then(res => res.data);

export const confirmEmailAndEnable2fa = (otp: string) => 
  Api.post('/api/user/confirm', { otp }).then(res => res.data);

export const disableTwoFactor = (otp: string) => 
  Api.post('/api/user/2fa/disable', { otp }).then(res => res.data);

export const changePassword = (data: ChangePassword) => 
  Api.put('/api/user/change-password', data).then(res => res.data);

export const deleteAccount = () => 
  Api.delete('/api/user').then(res => res.data);

export const getSecurityPolicy = () => 
  Api.get<SecurityPolicyDto>('/api/user/policy').then(res => res.data);

export const updateSecurityPolicy = (data: PolicyUpdate) => 
  Api.put<SecurityPolicyDto>('/api/user/policy', data).then(res => res.data);

export const getDeviceSessions = () => {
  return Api.get<DeviceSessionDto[]>('/api/user/sessions')
    .then(res => res.data);
};

export const revokeSession = (sessionId: string) => {
  return Api.delete(`/api/user/sessions/${sessionId}`);
};

export const revokeAllOtherSessions = () => {
  return Api.delete('/api/user/sessions/all-other');
};

export const logoutAllSessions = () => 
  Api.delete('/api/user/sessions/logout-all');