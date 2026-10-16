import { api } from '../../../lib/api';

export interface ValidatedRow {
  row_no: string | number;
  excel_row?: number;
  name: string;
  nik?: string | null;
  recovered_nik?: string | null;
  effective_nik?: string | null;
  province?: string | null;
  school_unit?: string | null;
  position?: string | null;
  basic_salary?: number;
  take_home_pay?: number;
  status: 'BARU' | 'PERPANJANGAN_SP' | 'MUTASI_SEKOLAH' | 'DUPLIKAT_PERIODE' | 'DUPLIKAT_FILE' | 'REVIEW_MIRIP';
  badge_color: 'emerald' | 'blue' | 'purple' | 'red' | 'amber';
  matched_by: 'none' | 'nik' | 'name' | 'fuzzy';
  recommendation: string;
  history_periods?: string[];
  history_schools?: string[];
}

export interface ValidationSummary {
  total_rows: number;
  new_count: number;
  renewal_count: number;
  transfer_count: number;
  duplicate_count: number;
  review_count: number;
  recovered_nik_count: number;
  health_score: number;
  company: string;
  target_period?: string | null;
}

export interface QuickCheckResult {
  input: {
    name: string;
    province?: string | null;
    school_unit?: string | null;
    nik?: string | null;
    company: string;
  };
  classification: 'BARU' | 'PERPANJANGAN_SP' | 'MUTASI_SEKOLAH' | 'DUPLIKAT_PERIODE' | 'REVIEW_MIRIP';
  recommendation: string;
  recovered_nik?: string | null;
  exact_matches_count: number;
  similar_matches_count: number;
  exact_payrolls: Array<{
    id: number;
    employee_name: string;
    nik?: string;
    province?: string;
    school_unit?: string;
    position?: string;
    period: string;
    status: string;
    basic_salary?: number;
  }>;
  similar_payrolls: Array<{
    payroll: {
      id: number;
      employee_name: string;
      nik?: string;
      school_unit?: string;
      period: string;
    };
    similarity: number;
  }>;
  user_accounts: Array<{
    id: number;
    name: string;
    nik?: string;
    role: string;
    school_unit?: string;
    status?: string;
  }>;
}

export const validationService = {
  uploadAndValidate: async (
    file: File,
    targetPeriod?: string,
    company?: string
  ): Promise<{ summary: ValidationSummary; rows: ValidatedRow[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (targetPeriod) formData.append('target_period', targetPeriod);
    if (company) formData.append('company', company);

    const res = await api.post('/admin/validation/upload', formData);
    return res.data.data;
  },

  quickCheck: async (params: {
    name: string;
    province?: string;
    school_unit?: string;
    nik?: string;
    company?: string;
  }): Promise<QuickCheckResult> => {
    const res = await api.post('/admin/validation/quick-check', params);
    return res.data.data;
  },

  exportReport: async (rows: ValidatedRow[], summary: ValidationSummary): Promise<void> => {
    const res = await api.post(
      '/admin/validation/export',
      { rows, summary },
      { responseType: 'blob' }
    );
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `hasil_validasi_data_${new Date().toISOString().slice(0, 10)}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  commitToPayroll: async (params: {
    rows: ValidatedRow[];
    target_period: string;
    company?: string;
  }): Promise<{ inserted_count: number; skipped_count: number; period: string }> => {
    const res = await api.post('/admin/validation/commit', params);
    return res.data.data;
  },
};
