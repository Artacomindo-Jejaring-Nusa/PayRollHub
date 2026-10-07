import { api } from '../../../lib/api';
import { AuthResponse, LoginPayload, User } from '../../../types/auth';

export const authService = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/login', payload);
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/logout');
    } catch {
      // Continue client-side logout even if network fails
    }
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get<{ status: string; data: User }>('/me');
    return response.data.data;
  },
};
