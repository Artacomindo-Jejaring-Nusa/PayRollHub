export interface CustomDeductionItem {
  name: string;
  amount: number;
}

export interface PayrollItem {
  id: number;
  row_no?: string | number | null;
  employee_name: string;
  nik: string | null;
  province: string;
  school_unit?: string | null;
  position?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  join_date?: string | null;
  resign_date?: string | null;
  status: 'active' | 'off';
  company?: string;
  period: string;

  // New salary formula fields based on Excel
  net_base_price: number; // Harga Dasar di potong PPh & Fee manajemen
  bpjs_kes: number;       // BPJS KES 5%
  bpjs_tk: number;        // BPJS TK 9,24%
  basic_salary: number;   // Gaji Pokok = net_base_price - bpjs_kes - bpjs_tk
  allowance: number;
  deduction: number;
  custom_deductions?: CustomDeductionItem[] | null;
  pph21?: number;         // PPh 21

  // Absence deduction fields
  absence_count: number;    // Multiplier (1x, 2x, 3x...)
  absence_rate: number;     // Tarif per absensi
  absence_deduction: number;// Total Potongan Absensi
  absence_note?: string | null;

  take_home_pay: number;
  bank_account?: string | null;
  bank_name?: string | null;

  is_duplicate_bank_account?: boolean;
  duplicate_account_count?: number;

  replaced_payroll_id?: number | null;
  replaced_employee_name?: string | null;
  replacement_note?: string | null;
  replacement_date?: string | null;

  bpjs_tk_jht?: number;
  bpjs_tk_jp?: number;
  formatted_bpjs_tk_jht?: string;
  formatted_bpjs_tk_jp?: string;

  formatted_pph21?: string;

  formatted_net_base_price?: string;
  formatted_bpjs_kes?: string;
  formatted_bpjs_tk?: string;
  formatted_basic_salary: string;
  formatted_allowance: string;
  formatted_deduction: string;
  formatted_absence_deduction?: string;
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
  total_active_employees?: number;
  total_off_employees?: number;
  total_net_base_price?: number;
  total_bpjs_kes?: number;
  total_bpjs_tk?: number;
  total_absence_deduction?: number;
  total_basic_salary: number;
  total_allowance: number;
  total_deduction: number;
  total_take_home_pay: number;
  total_provinces?: number;
  total_locations?: number;
  total_duplicate_accounts?: number;
}

export interface PayrollFilterOptions {
  provinces: string[];
  periods: string[];
  positions?: string[];
  statuses?: string[];
  companies?: string[];
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
  resign_date?: string;
  status?: 'active' | 'off';
  company?: string;
  period: string;

  net_base_price?: number | string;
  bpjs_kes?: number | string;
  bpjs_tk?: number | string;
  basic_salary: number | string;
  allowance?: number | string;
  deduction?: number | string;
  custom_deductions?: Array<{ name: string; amount: number | string }>;

  absence_count?: number | string;
  absence_rate?: number | string;
  absence_deduction?: number | string;
  absence_note?: string;

  bank_account?: string;
  bank_name?: string;

  bpjs_tk_jht?: number | string;
  bpjs_tk_jp?: number | string;

  replaced_payroll_id?: number | null;
  replaced_employee_name?: string | null;
  replacement_note?: string | null;
  replacement_date?: string | null;
}

export interface PayrollImportResult {
  imported_count: number;
  updated_count: number;
  active_count?: number;
  off_count?: number;
  total_estimated_thp?: number;
  errors: string[];
  warnings?: string[];
}

export interface PayrollImportPreviewRow {
  row_no?: string | number | null;
  employee_name: string;
  nik: string | null;
  province: string;
  school_unit?: string | null;
  position?: string | null;
  join_date?: string | null;
  resign_date?: string | null;
  status: 'active' | 'off';
  company?: string;
  period: string;
  net_base_price: number;
  bpjs_kes: number;
  bpjs_tk: number;
  basic_salary: number;
  allowance: number;
  deduction: number;
  absence_deduction: number;
  absence_note?: string | null;
  take_home_pay: number;
  bank_account?: string | null;
  bank_name?: string | null;
  is_existing?: boolean;
  existing_id?: number | null;
}

export interface PayrollImportPreviewData {
  filename: string;
  file_size: number;
  total_rows: number;
  active_count: number;
  off_count: number;
  total_estimated_thp: number;
  rows: PayrollImportPreviewRow[];
  warnings: string[];
  errors: string[];
}

export interface ProvincePayrollSetting {
  id: number;
  company: string;
  province: string;
  ump: number;
  bpjs_kes: number;
  bpjs_tk_jht: number;
  bpjs_tk_jp: number;
  bpjs_tk: number;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeReplacement {
  id: number;
  company: string;
  new_payroll_id: number;
  new_employee_name: string;
  new_nik?: string | null;
  old_payroll_id?: number | null;
  old_employee_name: string;
  old_nik?: string | null;
  school_unit?: string | null;
  position?: string | null;
  replacement_date: string;
  reason?: string | null;
  notes?: string | null;
  created_by?: number | null;
  creator?: {
    id: number;
    name: string;
  } | null;
  new_payroll?: PayrollItem | null;
  old_payroll?: PayrollItem | null;
  created_at: string;
  updated_at: string;
}

export interface OffEmployeeItem {
  id: number;
  employee_name: string;
  nik: string | null;
  school_unit?: string | null;
  position?: string | null;
  resign_date?: string | null;
  company?: string | null;
}

