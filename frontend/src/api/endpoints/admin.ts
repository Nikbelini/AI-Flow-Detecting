import { Api } from '../services';
import type { UserGetResponse, PolicyUpdate, SecurityPolicyDto, UserListResponse, UserCreateRequest } from '../types/user';

export const adminGetUsers = (role: string, search?: string, page = 0, size = 10) => {
  const params = new URLSearchParams({ role: role.toUpperCase(), page: String(page), size: String(size) });
  if (search) params.append('search', search);
  return Api.get<UserListResponse>(`/api/admin/users?${params}`).then(res => res.data);
};

export const adminGetUser = (id: number) => 
  Api.get<UserGetResponse>(`/api/admin/users/${id}`).then(res => res.data);

export const adminCreateUser = (data: UserCreateRequest): Promise<UserGetResponse> => 
  Api.post<UserGetResponse>('/api/admin/users', data).then(res => res.data);

export const adminDeleteUser = (id: number) => 
  Api.delete(`/api/admin/users/${id}`);

export const adminLockUser = (id: number) => 
  Api.post(`/api/admin/users/${id}/lock`);

export const adminUnlockUser = (id: number) => 
  Api.post(`/api/admin/users/${id}/unlock`);

export const adminChangeRole = (id: number, role: string) => 
  Api.post(`/api/admin/users/${id}/role?role=${role}`);

export const adminResetPassword = (id: number, password: string) => 
  Api.post(`/api/admin/users/${id}/reset-password?password=${encodeURIComponent(password)}`);

export const adminGetPolicy = (userId: number) => 
  Api.get<SecurityPolicyDto>(`/api/admin/policy/${userId}`).then(res => res.data);

export const adminUpdatePolicy = (userId: number, data: PolicyUpdate) => 
  Api.put<SecurityPolicyDto>(`/api/admin/policy/${userId}`, data).then(res => res.data);