import { api } from '../../../lib/api';
import {
  ActivityLogItem,
  ActivityLogListResponse,
  ActivityLogParams,
  ActivityLogStats,
} from '../types';

export const activityLogService = {
  getLogs: async (params?: ActivityLogParams): Promise<ActivityLogListResponse> => {
    const response = await api.get<ActivityLogListResponse>('/admin/activity-logs', {
      params,
    });
    return response.data;
  },

  getStats: async (company?: string): Promise<ActivityLogStats> => {
    const response = await api.get<{ status: string; data: ActivityLogStats }>(
      '/admin/activity-logs/stats',
      {
        params: company ? { company } : undefined,
      }
    );
    return response.data.data;
  },

  getUserLogins: async (params?: import('../types').UserLoginParams): Promise<import('../types').UserLoginTrackingResponse> => {
    const response = await api.get<import('../types').UserLoginTrackingResponse>(
      '/admin/activity-logs/user-logins',
      { params }
    );
    return response.data;
  },
};

