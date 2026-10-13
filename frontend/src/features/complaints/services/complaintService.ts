import { api } from '../../../lib/api';
import { Complaint, ComplaintSummary } from '../types/complaint';

export const complaintService = {
  // User Feedback Methods (Role 'user' / 'viewer')
  async getUserFeedback(status?: string): Promise<{
    data: Complaint[];
    meta: any;
    summary: ComplaintSummary;
  }> {
    const res = await api.get('/user/feedback', { params: { status } });
    return res.data;
  },

  async submitUserFeedback(formData: FormData): Promise<Complaint> {
    const res = await api.post('/user/feedback', formData);
    return res.data.data;
  },

  // Employee Portal Methods (Legacy / Standby)
  async getEmployeeComplaints(status?: string): Promise<{
    data: Complaint[];
    meta: any;
    summary: ComplaintSummary;
  }> {
    const res = await api.get('/employee/complaints', { params: { status } });
    return res.data;
  },

  async submitComplaint(formData: FormData): Promise<Complaint> {
    const res = await api.post('/employee/complaints', formData);
    return res.data.data;
  },

  async getEmployeeComplaint(id: number): Promise<Complaint> {
    const res = await api.get(`/employee/complaints/${id}`);
    return res.data.data;
  },

  // Admin Portal Methods
  async getAdminComplaints(params?: {
    page?: number;
    search?: string;
    status?: string;
    category?: string;
    company?: string;
  }): Promise<{
    data: Complaint[];
    meta: any;
  }> {
    const res = await api.get('/admin/complaints', { params });
    return res.data;
  },

  async getAdminComplaintsSummary(company?: string): Promise<ComplaintSummary> {
    const res = await api.get('/admin/complaints/summary', { params: { company } });
    return res.data.data;
  },

  async updateComplaint(
    id: number,
    data: {
      status: string;
      admin_notes?: string;
    }
  ): Promise<Complaint> {
    const res = await api.put(`/admin/complaints/${id}`, data);
    return res.data.data;
  },

  async deleteComplaint(id: number): Promise<void> {
    await api.delete(`/admin/complaints/${id}`);
  },
};
