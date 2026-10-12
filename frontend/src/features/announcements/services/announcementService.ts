import { api } from '../../../lib/api';
import { Announcement } from '../../../types/auth';

export const announcementService = {
  async getAnnouncements(params?: { company?: string; search?: string; page?: number }): Promise<{
    data: Announcement[];
    meta: any;
  }> {
    const res = await api.get('/announcements', { params });
    return { data: res.data.data, meta: res.data.meta };
  },

  async createAnnouncement(data: FormData | {
    title: string;
    content: string;
    category: string;
    company: 'all' | 'rbs' | 'rimamandiri';
    is_pinned?: boolean;
    attachment?: File | null;
  }): Promise<Announcement> {
    const res = await api.post('/announcements', data);
    return res.data.data;
  },

  async updateAnnouncement(
    id: number,
    data: FormData | {
      title: string;
      content: string;
      category: string;
      company: 'all' | 'rbs' | 'rimamandiri';
      is_pinned?: boolean;
      attachment?: File | null;
      remove_attachment?: boolean;
    }
  ): Promise<Announcement> {
    const res = await api.post(`/announcements/${id}`, data);
    return res.data.data;
  },

  async deleteAnnouncement(id: number): Promise<void> {
    await api.delete(`/announcements/${id}`);
  },
};
