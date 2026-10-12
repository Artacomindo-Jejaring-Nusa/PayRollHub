import { api } from '../../../lib/api';
import { detectInitialTenant } from '../../../lib/theme';
import {
  PayrollFormData,
  PayrollImportPreviewData,
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
    start_period?: string;
    end_period?: string;
    status?: string;
    company?: string;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: string;
  }): Promise<PayrollListResponse> => {
    const activeTenant = detectInitialTenant();
    const finalParams = {
      company: params?.company || activeTenant,
      ...params,
    };
    const response = await api.get<PayrollListResponse>('/payrolls', { params: finalParams });
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

  updateStatus: async (
    id: number,
    status: 'active' | 'off',
    resignDate?: string | null
  ): Promise<PayrollItem> => {
    const response = await api.put<{ status: string; data: PayrollItem }>(
      `/payrolls/${id}/status`,
      { status, resign_date: resignDate }
    );
    return response.data.data;
  },

  deletePayroll: async (id: number): Promise<void> => {
    await api.delete(`/payrolls/${id}`);
  },

  clearAllPayrolls: async (params?: { period?: string; company?: string }): Promise<{ deleted_count: number; message: string }> => {
    const activeTenant = detectInitialTenant();
    const finalParams = {
      company: params?.company || activeTenant,
      ...params,
    };
    const response = await api.delete<{ status: string; message: string; data: { deleted_count: number } }>(
      '/payrolls/clear/all',
      { params: finalParams }
    );
    return {
      deleted_count: response.data.data.deleted_count,
      message: response.data.message,
    };
  },

  exportFile: async (
    format: 'xlsx' | 'csv' | 'pdf',
    params?: {
      search?: string;
      province?: string;
      position?: string;
      period?: string;
      status?: string;
      company?: string;
    }
  ): Promise<void> => {
    const activeTenant = detectInitialTenant();
    const finalParams = {
      company: params?.company || activeTenant,
      ...params,
      format,
    };
    const response = await api.get('/payrolls/export', {
      params: finalParams,
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

  downloadTemplate: async (format: 'xlsx' | 'csv' = 'xlsx'): Promise<void> => {
    const response = await api.get('/payrolls/template', {
      params: { format },
      responseType: 'blob',
    });

    const blob = new Blob([response.data], {
      type:
        format === 'csv'
          ? 'text/csv;charset=utf-8;'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `template_import_payrollhub.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  previewImport: async (file: File, period?: string, company?: string): Promise<PayrollImportPreviewData> => {
    const formData = new FormData();
    formData.append('file', file);
    if (period) {
      formData.append('period', period);
    }
    if (company) {
      formData.append('company', company);
    }

    const response = await api.post<{
      status: string;
      message: string;
      data: PayrollImportPreviewData;
    }>('/payrolls/import/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.data;
  },

  importFile: async (file: File, period?: string, company?: string): Promise<PayrollImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    if (period) {
      formData.append('period', period);
    }
    if (company) {
      formData.append('company', company);
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
