import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const api = axios.create({
  baseURL,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach Bearer token & Developer Access Key
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const devKey = localStorage.getItem('dev_report_key');
    if (devKey) {
      config.headers['X-Dev-Key'] = devKey;
    }

    // Attach active tenant as safe query parameter (avoids CORS preflight header blockage)
    const isAuthRoute = config.url?.includes('/login') || config.url?.includes('/register');
    if (!isAuthRoute) {
      const activeTenant = localStorage.getItem('payrollhub_active_tenant');
      if (activeTenant) {
        config.params = {
          ...config.params,
          company: activeTenant,
        };
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
