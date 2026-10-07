import { create } from 'zustand';
import { User } from '../types/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

const getStoredAuth = () => {
  try {
    const token = localStorage.getItem('payrollhub_token');
    const userStr = localStorage.getItem('payrollhub_user');
    if (token && userStr) {
      const user = JSON.parse(userStr) as User;
      return { user, token, isAuthenticated: true };
    }
  } catch {
    localStorage.removeItem('payrollhub_token');
    localStorage.removeItem('payrollhub_user');
  }
  return { user: null, token: null, isAuthenticated: false };
};

export const useAuthStore = create<AuthState>((set) => ({
  ...getStoredAuth(),

  login: (user: User, token: string) => {
    localStorage.setItem('payrollhub_token', token);
    localStorage.setItem('payrollhub_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('payrollhub_token');
    localStorage.removeItem('payrollhub_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  setUser: (user: User) => {
    localStorage.setItem('payrollhub_user', JSON.stringify(user));
    set({ user });
  },
}));
