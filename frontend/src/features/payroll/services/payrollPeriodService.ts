import { api } from '../../../lib/api';
import { PayrollPeriodItem } from '../../../types/payroll';

export const payrollPeriodService = {
  /**
   * Get all active periods (for employee or admin).
   */
  getPeriods: async (params?: { company?: string }): Promise<PayrollPeriodItem[]> => {
    const res = await api.get<{ status: string; data: PayrollPeriodItem[] }>(
      '/admin/payroll-periods',
      { params }
    );
    return res.data.data;
  },

  /**
   * Public / employee read of active periods.
   */
  getPublicPeriods: async (params?: { company?: string }): Promise<PayrollPeriodItem[]> => {
    const res = await api.get<{ status: string; data: PayrollPeriodItem[] }>(
      '/payroll-periods',
      { params }
    );
    return res.data.data;
  },

  /**
   * Create new custom period or target SP (Point 17).
   */
  createPeriod: async (data: {
    code: string;
    name: string;
    company?: string;
    is_sp?: boolean;
    is_visible_to_user?: boolean;
    description?: string;
  }): Promise<PayrollPeriodItem> => {
    const res = await api.post<{ status: string; message: string; data: PayrollPeriodItem }>(
      '/admin/payroll-periods',
      data
    );
    return res.data.data;
  },

  /**
   * Update period details / visibility toggle.
   */
  updatePeriod: async (
    id: number,
    data: {
      name?: string;
      company?: string;
      is_sp?: boolean;
      is_visible_to_user?: boolean;
      description?: string;
      sync_payrolls?: boolean;
    }
  ): Promise<PayrollPeriodItem> => {
    const res = await api.put<{ status: string; message: string; data: PayrollPeriodItem }>(
      `/admin/payroll-periods/${id}`,
      data
    );
    return res.data.data;
  },

  /**
   * Delete custom period (SP 1 - SP 12 protected).
   */
  deletePeriod: async (id: number, force = false): Promise<void> => {
    await api.delete(`/admin/payroll-periods/${id}`, {
      params: force ? { force: 1 } : undefined,
    });
  },
};
