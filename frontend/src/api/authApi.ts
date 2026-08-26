import api from './axiosClient';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@/types';

export const authApi = {
  login:    (data: LoginRequest):    Promise<AuthResponse> =>
    api.post<AuthResponse>('/auth/login', data).then((r) => r.data),

  register: (data: RegisterRequest): Promise<AuthResponse> =>
    api.post<AuthResponse>('/auth/register', data).then((r) => r.data),
};
