import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const api = axios.create({
  baseURL,
  headers: {
    'Accept': 'application/json',
  },
});

// Request interceptor to attach Bearer token & Developer Access Key
api.interceptors.request.use(
  (config) => {
    // If request payload is FormData, remove Content-Type so browser can set multipart boundary
    if (config.data instanceof FormData) {
      if (config.headers) {
        if (typeof (config.headers as any).delete === 'function') {
          (config.headers as any).delete('Content-Type');
          (config.headers as any).delete('content-type');
        }
        delete (config.headers as any)['Content-Type'];
        delete (config.headers as any)['content-type'];
      }
    }

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
      const user = useAuthStore.getState().user;
      let activeCompany = localStorage.getItem('payrollhub_active_tenant');
      if (user && user.role !== 'super_admin' && user.company) {
        activeCompany = user.company.toLowerCase().includes('riama') ? 'rimamandiri' : 'rbs';
      }
      if (activeCompany) {
        config.params = {
          ...config.params,
          company: activeCompany,
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
