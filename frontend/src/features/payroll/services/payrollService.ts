import { api } from '../../../lib/api';
import {
  PayrollFormData,
  PayrollImportResult,
  PayrollItem,
  PayrollListResponse,
} from '../../../types/payroll';

export const payrollService = {
  getPayrolls: async (params?: {
    search?: string;
    province?: string;
    position?: string;
    period?: string;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: string;
  }): Promise<PayrollListResponse> => {
    const response = await api.get<PayrollListResponse>('/payrolls', { params });
    return response.data;
  },

  getPayroll: async (id: number): Promise<PayrollItem> => {
    const response = await api.get<{ status: string; data: PayrollItem }>(`/payrolls/${id}`);
    return response.data.data;
  },

  createPayroll: async (data: PayrollFormData): Promise<PayrollItem> => {
    const response = await api.post<{ status: string; data: PayrollItem }>('/payrolls', data);
    return response.data.data;
  },

  updatePayroll: async (id: number, data: PayrollFormData): Promise<PayrollItem> => {
    const response = await api.put<{ status: string; data: PayrollItem }>(`/payrolls/${id}`, data);
    return response.data.data;
  },

  deletePayroll: async (id: number): Promise<void> => {
    await api.delete(`/payrolls/${id}`);
  },

  exportFile: async (
    format: 'xlsx' | 'csv' | 'pdf',
    params?: { search?: string; province?: string; position?: string; period?: string }
  ): Promise<void> => {
    const response = await api.get('/payrolls/export', {
      params: { ...params, format },
      responseType: 'blob',
    });

    const blob = new Blob([response.data], {
      type:
        format === 'pdf'
          ? 'application/pdf'
          : format === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rekap_payroll_${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  downloadSlipPdf: async (id: number, employeeName: string, period: string): Promise<void> => {
    const response = await api.get(`/payrolls/${id}/slip-pdf`, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = employeeName.replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `slip_gaji_${safeName}_${period}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  importFile: async (file: File, period?: string): Promise<PayrollImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    if (period) {
      formData.append('period', period);
    }

    const response = await api.post<{
      status: string;
      message: string;
      data: PayrollImportResult;
    }>('/payrolls/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.data;
  },
};
