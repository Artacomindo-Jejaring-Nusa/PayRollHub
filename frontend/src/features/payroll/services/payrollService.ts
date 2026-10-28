import { api } from '../../../lib/api';
import { detectInitialTenant } from '../../../lib/theme';
import {
  PayrollFormData,
  PayrollImportPreviewData,
  PayrollImportResult,
  PayrollItem,
  PayrollListResponse,
  ProvincePayrollSetting,
  EmployeeReplacement,
  OffEmployeeItem,
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
    marital_status?: string;
    company?: string;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: string;
    duplicate_account?: boolean;
    visibility?: string;
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
    setTimeout(() => {
      link.remove();
      window.URL.revokeObjectURL(url);
    }, 2000);
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

  // --------------------------------------------------------------------------
  // Pengaturan Perhitungan Gaji per Provinsi (UMP & BPJS TK/Kes)
  // --------------------------------------------------------------------------
  getProvinceSettings: async (company?: string): Promise<ProvincePayrollSetting[]> => {
    const activeTenant = detectInitialTenant();
    const response = await api.get<{ status: string; data: ProvincePayrollSetting[] }>(
      '/province-settings',
      { params: { company: company || activeTenant } }
    );
    return response.data.data;
  },

  updateProvinceSetting: async (
    identifier: string | number,
    data: {
      ump: number;
      bpjs_kes: number;
      bpjs_tk_jht: number;
      bpjs_tk_jp: number;
      notes?: string;
      apply_to_employees?: boolean;
      company?: string;
    }
  ): Promise<{ status: string; message: string; data: ProvincePayrollSetting; affected_employees: number }> => {
    const response = await api.put<{
      status: string;
      message: string;
      data: ProvincePayrollSetting;
      affected_employees: number;
    }>(`/province-settings/${encodeURIComponent(identifier)}`, data);
    return response.data;
  },

  applyProvinceSettingToEmployees: async (
    identifier: string | number,
    company?: string
  ): Promise<{ status: string; message: string; affected_employees: number }> => {
    const activeTenant = detectInitialTenant();
    const response = await api.post<{
      status: string;
      message: string;
      affected_employees: number;
    }>(`/province-settings/${encodeURIComponent(identifier)}/apply`, null, {
      params: { company: company || activeTenant },
    });
    return response.data;
  },

  deleteProvinceSetting: async (
    identifier: string | number
  ): Promise<{ status: string; message: string }> => {
    const response = await api.delete<{ status: string; message: string }>(
      `/province-settings/${encodeURIComponent(identifier)}`
    );
    return response.data;
  },

  // --------------------------------------------------------------------------
  // Rekam Jejak Pergantian Karyawan (Penggantian Karyawan Off)
  // --------------------------------------------------------------------------
  getEmployeeReplacements: async (params?: {
    search?: string;
    company?: string;
    page?: number;
    per_page?: number;
  }): Promise<{
    status: string;
    data: EmployeeReplacement[];
    meta: { current_page: number; last_page: number; total: number };
  }> => {
    const activeTenant = detectInitialTenant();
    const response = await api.get<{
      status: string;
      data: EmployeeReplacement[];
      meta: { current_page: number; last_page: number; total: number };
    }>('/employee-replacements', {
      params: { company: params?.company || activeTenant, ...params },
    });
    return response.data;
  },

  getOffEmployees: async (search?: string, company?: string): Promise<OffEmployeeItem[]> => {
    const activeTenant = detectInitialTenant();
    const response = await api.get<{ status: string; data: OffEmployeeItem[] }>(
      '/employee-replacements/off-employees',
      { params: { search, company: company || activeTenant } }
    );
    return response.data.data;
  },

  createEmployeeReplacement: async (data: {
    new_payroll_id: number;
    old_payroll_id?: number | null;
    old_employee_name?: string;
    replacement_date: string;
    reason?: string;
    notes?: string;
  }): Promise<EmployeeReplacement> => {
    const response = await api.post<{
      status: string;
      message: string;
      data: EmployeeReplacement;
    }>('/employee-replacements', data);
    return response.data.data;
  },

  deleteEmployeeReplacement: async (id: number): Promise<void> => {
    await api.delete(`/employee-replacements/${id}`);
  },
  generatePeriod: async (payload: {
    target_period: string;
    source_period?: string;
    company?: string;
    sync_attendance?: boolean;
    is_visible_to_user?: boolean;
    duplicate_action?: 'update' | 'skip';
    start_date?: string;
    end_date?: string;
  }): Promise<{
    status: string;
    message: string;
    data: {
      target_period: string;
      source_period: string;
      total_processed: number;
      created_count: number;
      updated_count: number;
      skipped_count: number;
      date_range: [string, string] | null;
      is_visible_to_user: boolean;
    };
  }> => {
    const response = await api.post('/payrolls/generate-period', payload);
    return response.data;
  },
};
