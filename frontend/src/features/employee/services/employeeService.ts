import { api } from '../../../lib/api';
import { Announcement, User, WorkReport } from '../../../types/auth';
import { PayrollItem } from '../../../types/payroll';
import { Complaint, ComplaintSummary } from '../../complaints/types/complaint';

export interface EmployeeDashboardData {
  user: User;
  latest_payroll: PayrollItem | null;
  total_payrolls: number;
  work_reports_summary: {
    total: number;
    pending: number;
    approved: number;
  };
  recent_announcements: Announcement[];
  complaints_summary?: ComplaintSummary;
  recent_complaints?: Complaint[];
}

export interface EmployeeProfileData {
  user: User;
  job_details?: {
    position?: string;
    school_unit?: string;
    province?: string;
    status?: string;
    join_date?: string;
    company?: string;
  } | null;
}

export const employeeService = {
  async getDashboard(): Promise<EmployeeDashboardData> {
    const res = await api.get('/employee/dashboard');
    return res.data.data;
  },

  async getPayrolls(params?: {
    period?: string;
    start_period?: string;
    end_period?: string;
  }): Promise<PayrollItem[]> {
    const res = await api.get('/employee/payrolls', { params });
    return res.data.data;
  },

  async getPayrollDetail(id: number): Promise<PayrollItem> {
    const res = await api.get(`/employee/payrolls/${id}`);
    return res.data.data;
  },

  async downloadSlipPdf(id: number, employeeName: string, period: string): Promise<void> {
    const response = await api.get(`/employee/payrolls/${id}/slip-pdf`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Slip_Gaji_${employeeName.replace(/\s+/g, '_')}_${period}.pdf`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    }, 2000);
  },

  async getProfile(): Promise<EmployeeProfileData> {
    const res = await api.get('/employee/profile');
    return res.data.data;
  },

  async updateProfile(data: {
    nik?: string;
    phone?: string;
    birth_date?: string | null;
    gender?: string | null;
    email?: string;
    bank_name?: string;
    bank_account?: string;
    address?: string;
    current_password?: string;
    new_password?: string;
  }): Promise<User> {
    const res = await api.put('/employee/profile', data);
    return res.data.data;
  },

  async getWorkReports(page: number = 1, perPage: number = 15): Promise<{ data: WorkReport[]; meta: any }> {
    const res = await api.get(`/employee/work-reports?page=${page}&per_page=${perPage}`);
    return { data: res.data.data, meta: res.data.meta };
  },

  async submitWorkReport(formData: FormData): Promise<WorkReport> {
    const res = await api.post('/employee/work-reports', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.data;
  },

  async getAnnouncements(page: number = 1): Promise<{ data: Announcement[]; meta: any }> {
    const res = await api.get(`/employee/announcements?page=${page}`);
    return { data: res.data.data, meta: res.data.meta };
  },
};
