import { api } from '../../../lib/api';
import { User } from '../../../types/auth';
import { UserFormData, UserListResponse } from '../../../types/user';

export const userService = {
  getUsers: async (params?: { search?: string; role?: string; page?: number }): Promise<UserListResponse> => {
    const response = await api.get<UserListResponse>('/users', { params });
    return response.data;
  },

  createUser: async (data: UserFormData): Promise<User> => {
    const response = await api.post<{ status: string; data: User }>('/users', data);
    return response.data.data;
  },

  updateUser: async (id: number, data: UserFormData): Promise<User> => {
    const response = await api.put<{ status: string; data: User }>(`/users/${id}`, data);
    return response.data.data;
  },

  deleteUser: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};
