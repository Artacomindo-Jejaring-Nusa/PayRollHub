import { api } from '../../../lib/api';
import { WorkReport } from '../../../types/auth';
import { PayrollPaginationMeta } from '../../../types/payroll';

export const workReportService = {
  async getAdminWorkReports(params?: {
    status?: string;
    search?: string;
    date?: string;
    page?: number;
    per_page?: number;
  }): Promise<{ data: WorkReport[]; meta: PayrollPaginationMeta }> {
    const res = await api.get('/admin/work-reports', { params });
    return { data: res.data.data, meta: res.data.meta };
  },

  async updateReportStatus(
    id: number,
    data: { status: 'approved' | 'rejected' | 'pending'; feedback?: string }
  ): Promise<WorkReport> {
    const res = await api.put(`/admin/work-reports/${id}/status`, data);
    return res.data.data;
  },

  async exportReports(
    params?: {
      status?: string;
      search?: string;
      date?: string;
      start_date?: string;
      end_date?: string;
      company?: string;
      ids?: number[] | string;
    },
    format: 'xlsx' | 'pdf' = 'xlsx'
  ): Promise<void> {
    const queryParams: any = { ...params, format };
    if (Array.isArray(params?.ids)) {
      queryParams.ids = params.ids.join(',');
    }

    const res = await api.get('/admin/work-reports/export', {
      params: queryParams,
      responseType: 'blob',
    });

    const blob = new Blob([res.data], {
      type:
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const selectedSuffix =
      params?.ids && (Array.isArray(params.ids) ? params.ids.length > 0 : String(params.ids).length > 0)
        ? '_terpilih'
        : '';
    link.download = `rekap_laporan_kerja_${new Date().toISOString().slice(0, 10)}${selectedSuffix}.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async downloadSinglePdf(id: number, employeeName: string, date: string): Promise<void> {
    const res = await api.get(`/admin/work-reports/${id}/pdf`, {
      responseType: 'blob',
    });

    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanName = employeeName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.download = `Laporan_Kerja_${cleanName}_${date}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
