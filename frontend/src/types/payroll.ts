export interface PayrollItem {
  id: number;
  row_no?: string | number | null;
  employee_name: string;
  nik: string | null;
  province: string;
  school_unit?: string | null;
  position?: string | null;
  join_date?: string | null;
  period: string;
  basic_salary: number;
  allowance: number;
  deduction: number;
  take_home_pay: number;
  bank_account?: string | null;
  bank_name?: string | null;
  formatted_basic_salary: string;
  formatted_allowance: string;
  formatted_deduction: string;
  formatted_take_home_pay: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollPaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface PayrollMetrics {
  total_employees: number;
  total_basic_salary: number;
  total_allowance: number;
  total_deduction: number;
  total_take_home_pay: number;
}

export interface PayrollFilterOptions {
  provinces: string[];
  periods: string[];
  positions?: string[];
}

export interface PayrollListResponse {
  status: string;
  data: PayrollItem[];
  meta: PayrollPaginationMeta;
  metrics: PayrollMetrics;
  filters: PayrollFilterOptions;
}

export interface PayrollFormData {
  row_no?: string;
  employee_name: string;
  nik?: string;
  province: string;
  school_unit?: string;
  position?: string;
  join_date?: string;
  period: string;
  basic_salary: number | string;
  allowance?: number | string;
  deduction?: number | string;
  bank_account?: string;
  bank_name?: string;
}

export interface PayrollImportResult {
  imported_count: number;
  updated_count: number;
  errors: string[];
}
