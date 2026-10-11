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

    // Kunci aktif tenant ke perusahaannya masing-masing jika bukan super_admin
    if (user.role !== 'super_admin' && user.company) {
      const compLower = user.company.toLowerCase();
      const tenantId = compLower.includes('riama') || compLower.includes('rimamandiri') ? 'rimamandiri' : 'rbs';
      localStorage.setItem('payrollhub_active_tenant', tenantId);
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', tenantId);
      }
    }

    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('payrollhub_token');
    localStorage.removeItem('payrollhub_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  setUser: (user: User) => {
    localStorage.setItem('payrollhub_user', JSON.stringify(user));
    if (user.role !== 'super_admin' && user.company) {
      const compLower = user.company.toLowerCase();
      const tenantId = compLower.includes('riama') || compLower.includes('rimamandiri') ? 'rimamandiri' : 'rbs';
      localStorage.setItem('payrollhub_active_tenant', tenantId);
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', tenantId);
      }
    }
    set({ user });
  },
}));
