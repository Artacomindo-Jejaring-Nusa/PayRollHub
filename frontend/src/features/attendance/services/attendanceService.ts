import { api } from '../../../lib/api';
import {
  TodayAttendanceData,
  AttendanceRecord,
  OfficeSetting,
  AttendanceSummary,
} from '../types/attendance';

export const attendanceService = {
  // Employee Portal APIs
  getTodayAttendance: async (): Promise<TodayAttendanceData> => {
    const response = await api.get('/employee/attendance/today');
    return response.data.data;
  },

  checkIn: async (coords: { latitude: number; longitude: number; notes?: string }): Promise<any> => {
    const response = await api.post('/employee/attendance/check-in', coords);
    return response.data;
  },

  checkOut: async (coords: { latitude: number; longitude: number; notes?: string }): Promise<any> => {
    const response = await api.post('/employee/attendance/check-out', coords);
    return response.data;
  },

  getEmployeeHistory: async (month?: string, page = 1): Promise<any> => {
    const response = await api.get('/employee/attendance/history', {
      params: { month, page },
    });
    return response.data.data;
  },

  // Admin Portal APIs
  getAdminAttendances: async (params?: {
    date?: string;
    month?: string;
    search?: string;
    status?: string;
    page?: number;
    per_page?: number;
  }): Promise<any> => {
    const response = await api.get('/admin/attendances', { params });
    return response.data.data;
  },

  getAdminSummary: async (date?: string): Promise<AttendanceSummary> => {
    const response = await api.get('/admin/attendances/summary', {
      params: { date },
    });
    return response.data.data;
  },

  getSettings: async (): Promise<OfficeSetting> => {
    const response = await api.get('/admin/attendance-settings');
    return response.data.data;
  },

  updateSettings: async (settings: Partial<OfficeSetting>): Promise<OfficeSetting> => {
    const response = await api.put('/admin/attendance-settings', settings);
    return response.data.data;
  },

  exportCsvUrl: (date?: string, month?: string): string => {
    const baseUrl = api.defaults.baseURL || '/api';
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (month) params.append('month', month);
    return `${baseUrl}/admin/attendances/export?${params.toString()}`;
  },
};

/**
 * Formula Haversine di client side untuk kalkulasi live distance meter real-time.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius bumi dalam meter
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}
