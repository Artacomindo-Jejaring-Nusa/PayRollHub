import { api } from '../../../lib/api';
import {
  TodayAttendanceData,
  AttendanceRecord,
  OfficeSetting,
  AttendanceSummary,
  AttendanceLocation,
  SchoolUnitOption,
  Shift,
} from '../types/attendance';

export const attendanceService = {
  // Employee Portal APIs
  getTodayAttendance: async (): Promise<TodayAttendanceData> => {
    const response = await api.get('/employee/attendance/today', {
      params: { _t: Date.now() },
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    return response.data.data;
  },

  checkIn: async (payload: {
    attendance_type?: 'masuk' | 'libur' | 'dinas_luar' | 'sakit' | 'izin';
    latitude?: number;
    longitude?: number;
    location_id?: number;
    shift_id?: number;
    notes?: string;
    photo?: File | string | null;
  }): Promise<any> => {
    if (payload.photo instanceof File) {
      const formData = new FormData();
      if (payload.attendance_type) formData.append('attendance_type', payload.attendance_type);
      if (payload.latitude !== undefined && payload.latitude !== null) {
        formData.append('latitude', String(payload.latitude));
      }
      if (payload.longitude !== undefined && payload.longitude !== null) {
        formData.append('longitude', String(payload.longitude));
      }
      if (payload.location_id) formData.append('location_id', String(payload.location_id));
      if (payload.shift_id) formData.append('shift_id', String(payload.shift_id));
      if (payload.notes) formData.append('notes', payload.notes);
      formData.append('photo', payload.photo);

      const response = await api.post('/employee/attendance/check-in', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    }

    const response = await api.post('/employee/attendance/check-in', payload);
    return response.data;
  },

  selectShift: async (shiftId: number): Promise<any> => {
    const response = await api.post('/employee/attendance/shift/select', { shift_id: shiftId });
    return response.data;
  },

  checkOut: async (payload?: { latitude?: number; longitude?: number; notes?: string }): Promise<any> => {
    const response = await api.post('/employee/attendance/check-out', payload || {});
    return response.data;
  },

  cancelHoliday: async (): Promise<any> => {
    const response = await api.post('/employee/attendance/cancel-holiday');
    return response.data;
  },

  getEmployeeHistory: async (month?: string, page = 1): Promise<any> => {
    const response = await api.get('/employee/attendance/history', {
      params: { month, page },
    });
    return response.data.data;
  },

  // Locations APIs (100+ Master Lokasi Radius)
  getActiveLocations: async (company?: string): Promise<AttendanceLocation[]> => {
    const response = await api.get('/attendance/locations', { params: { company } });
    return response.data.data;
  },

  getAdminLocations: async (params?: {
    search?: string;
    type?: string;
    company?: string;
    page?: number;
    per_page?: number;
  }): Promise<{ data: AttendanceLocation[]; meta: any }> => {
    const response = await api.get('/admin/attendance-locations', { params });
    return { data: response.data.data, meta: response.data.meta };
  },

  createLocation: async (data: Partial<AttendanceLocation>): Promise<AttendanceLocation> => {
    const response = await api.post('/admin/attendance-locations', data);
    return response.data.data;
  },

  updateLocation: async (id: number, data: Partial<AttendanceLocation>): Promise<AttendanceLocation> => {
    const response = await api.put(`/admin/attendance-locations/${id}`, data);
    return response.data.data;
  },

  deleteLocation: async (id: number): Promise<void> => {
    await api.delete(`/admin/attendance-locations/${id}`);
  },

  getSchoolUnits: async (company?: string): Promise<SchoolUnitOption[]> => {
    const response = await api.get('/admin/attendance-locations/school-units', {
      params: { company },
    });
    return response.data.data;
  },

  syncFromSchoolUnits: async (company?: string): Promise<any> => {
    const response = await api.post('/admin/attendance-locations/sync-from-school-units', {
      company,
    });
    return response.data;
  },

  getLocationEmployees: async (locationId: number): Promise<{
    location: AttendanceLocation;
    assigned_employees: any[];
    all_employees: any[];
  }> => {
    const response = await api.get(`/admin/attendance-locations/${locationId}/employees`);
    return response.data.data;
  },

  assignLocationEmployees: async (locationId: number, userIds: number[]): Promise<any> => {
    const response = await api.post(`/admin/attendance-locations/${locationId}/assign-employees`, {
      user_ids: userIds,
    });
    return response.data;
  },

  // Master Shift & Penugasan Shift APIs (Point 9 Multi-tenant)
  getShifts: async (company?: string): Promise<Shift[]> => {
    const response = await api.get('/admin/shifts', { params: { company } });
    return response.data.data;
  },

  createShift: async (data: Partial<Shift>): Promise<Shift> => {
    const response = await api.post('/admin/shifts', data);
    return response.data.data;
  },

  updateShift: async (id: number, data: Partial<Shift>): Promise<Shift> => {
    const response = await api.put(`/admin/shifts/${id}`, data);
    return response.data.data;
  },

  deleteShift: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/admin/shifts/${id}`);
    return response.data;
  },

  assignShift: async (payload: {
    shift_id: number;
    user_ids?: number[];
    school_unit?: string;
    company?: string;
  }): Promise<{ message: string; updated_count: number }> => {
    const response = await api.post('/admin/shifts/assign', payload);
    return response.data;
  },

  getShiftEmployees: async (params?: {
    search?: string;
    shift_id?: number | string;
    school_unit?: string;
    company?: string;
    page?: number;
    per_page?: number;
  }): Promise<{ data: any[]; current_page: number; last_page: number; total: number }> => {
    const response = await api.get('/admin/shifts/employees', { params });
    return response.data.data;
  },

  downloadLocationTemplate: async (): Promise<void> => {
    const response = await api.get('/admin/attendance-locations/template', {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template_import_lokasi_absensi.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  downloadLocationTemplateUrl: (): string => {
    const baseUrl = api.defaults.baseURL || '/api';
    return `${baseUrl}/attendance-locations/template`;
  },

  previewImportLocations: async (file: File, company?: string): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    if (company) formData.append('company', company);
    const response = await api.post('/admin/attendance-locations/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  importLocations: async (file: File, company?: string): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    if (company) formData.append('company', company);
    const response = await api.post('/admin/attendance-locations/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  exportLocations: async (company?: string): Promise<void> => {
    const response = await api.get('/admin/attendance-locations/export', {
      params: { company },
      responseType: 'blob',
    });

    const blob = new Blob([response.data], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `master_lokasi_absensi_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  exportLocationsUrl: (company?: string): string => {
    const baseUrl = api.defaults.baseURL || '/api';
    const params = new URLSearchParams();
    if (company) params.append('company', company);
    return `${baseUrl}/admin/attendance-locations/export?${params.toString()}`;
  },

  clearAllLocations: async (company?: string): Promise<any> => {
    const response = await api.delete('/admin/attendance-locations/clear-all', {
      data: { company },
    });
    return response.data;
  },

  // Admin Portal APIs
  getAdminAttendances: async (params?: {
    date?: string;
    sp_period?: string;
    month?: string;
    search?: string;
    status?: string;
    role?: string;
    page?: number;
    per_page?: number;
  }): Promise<any> => {
    const response = await api.get('/admin/attendances', { params });
    return response.data.data;
  },

  getAdminSummary: async (date?: string, sp_period?: string, role?: string): Promise<AttendanceSummary> => {
    const response = await api.get('/admin/attendances/summary', {
      params: { date, sp_period, role },
    });
    return response.data.data;
  },

  getRecapByEmployee: async (params?: {
    sp_period?: string;
    search?: string;
    company?: string;
    role?: string;
    month?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{ sp_period: string; date_range: string[]; items: any[]; total_employees: number }> => {
    const response = await api.get('/admin/attendances/recap-by-employee', { params });
    return response.data.data;
  },

  createAdminAttendance: async (data: {
    user_id: number;
    date: string;
    attendance_type: 'masuk' | 'dinas_luar' | 'libur' | 'sakit' | 'izin';
    check_in_time?: string | null;
    check_out_time?: string | null;
    check_in_status?: 'on_time' | 'late';
    status?: string;
    approval_status?: 'pending' | 'approved' | 'rejected';
    location_name?: string;
    notes?: string;
  }): Promise<AttendanceRecord> => {
    const response = await api.post('/admin/attendances', data);
    return response.data.data;
  },

  updateAdminAttendance: async (
    id: number,
    data: {
      date: string;
      attendance_type: 'masuk' | 'dinas_luar' | 'libur' | 'sakit' | 'izin';
      check_in_time?: string | null;
      check_out_time?: string | null;
      check_in_status?: 'on_time' | 'late';
      status?: string;
      approval_status?: 'pending' | 'approved' | 'rejected';
      location_name?: string;
      notes?: string;
    }
  ): Promise<AttendanceRecord> => {
    const response = await api.put(`/admin/attendances/${id}`, data);
    return response.data.data;
  },

  verifyAttendance: async (
    id: number,
    actionOrPayload: 'approve' | 'reject' | { action?: 'approve' | 'reject'; approval_status?: string; rejection_reason?: string },
    rejection_reason?: string
  ): Promise<any> => {
    let act = 'approve';
    let reason = rejection_reason;
    if (typeof actionOrPayload === 'string') {
      act = actionOrPayload;
    } else if (typeof actionOrPayload === 'object' && actionOrPayload !== null) {
      act = actionOrPayload.action || (actionOrPayload.approval_status === 'rejected' ? 'reject' : 'approve');
      reason = actionOrPayload.rejection_reason || reason;
    }
    const response = await api.put(`/admin/attendances/${id}/verify`, {
      action: act,
      rejection_reason: reason,
    });
    return response.data;
  },

  deleteAdminAttendance: async (id: number): Promise<void> => {
    await api.delete(`/admin/attendances/${id}`);
  },

  getSettings: async (): Promise<OfficeSetting> => {
    const response = await api.get('/admin/attendance-settings');
    return response.data.data;
  },

  updateSettings: async (settings: Partial<OfficeSetting>): Promise<OfficeSetting> => {
    const response = await api.put('/admin/attendance-settings', settings);
    return response.data.data;
  },

  exportCsvUrl: (date?: string, month?: string, sp_period?: string, mode?: 'detail' | 'employee_recap', role?: string): string => {
    const baseUrl = api.defaults.baseURL || '/api';
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (month) params.append('month', month);
    if (sp_period) params.append('sp_period', sp_period);
    if (mode) params.append('mode', mode);
    if (role) params.append('role', role);
    return `${baseUrl}/admin/attendances/export?${params.toString()}`;
  },

  downloadAttendanceExport: async (params: {
    format: 'xlsx' | 'csv';
    mode: 'detail' | 'employee_recap';
    sp_period?: string;
    date?: string;
    month?: string;
    status?: string;
    search?: string;
    company?: string;
    role?: string;
    user_ids?: number[] | string;
    attendance_ids?: number[] | string;
  }): Promise<void> => {
    const queryParams: any = { ...params };
    if (Array.isArray(params.user_ids)) {
      queryParams.user_ids = params.user_ids.join(',');
    }
    if (Array.isArray(params.attendance_ids)) {
      queryParams.attendance_ids = params.attendance_ids.join(',');
    }

    const response = await api.get('/admin/attendances/export', {
      params: queryParams,
      responseType: 'blob',
    });

    const isExcel = params.format === 'xlsx';
    const mimeType = isExcel
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv;charset=utf-8;';

    const blob = new Blob([response.data], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const ext = isExcel ? 'xlsx' : 'csv';
    const cleanSp = params.sp_period ? params.sp_period.replace(/\s+/g, '_') : '';
    const datePart = params.date || cleanSp || new Date().toISOString().slice(0, 10);
    const modePart = params.mode === 'employee_recap' ? 'rekap_karyawan' : 'log_detail';
    const statusPart = params.status && params.status !== 'all' ? `_${params.status}` : '';
    const hasSelection = (params.attendance_ids && (Array.isArray(params.attendance_ids) ? params.attendance_ids.length > 0 : String(params.attendance_ids).length > 0)) ||
      (params.user_ids && (Array.isArray(params.user_ids) ? params.user_ids.length > 0 : String(params.user_ids).length > 0));
    const selectedPart = hasSelection ? '_terpilih' : '';

    link.download = `rekap_absensi_${modePart}_${datePart}${statusPart}${selectedPart}.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
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
