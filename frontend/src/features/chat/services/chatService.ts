import { api } from '../../../lib/api';
import { ChatSession, ChatMessage, Contact360, ChatStats, ChatQuickReply } from '../types/chat';

export const chatService = {
  // ==========================================
  // USER & KARYAWAN ENDPOINTS
  // ==========================================

  async getActiveSession(): Promise<{
    success: boolean;
    is_new: boolean;
    session: ChatSession;
    messages: ChatMessage[];
  }> {
    const res = await api.get('/chat/active-session');
    return res.data;
  },

  async sendMessage(data: {
    session_id: number;
    message?: string;
    photo?: File;
    action_code?: string;
  }): Promise<{
    success: boolean;
    session: ChatSession;
    user_message: ChatMessage;
    bot_message?: ChatMessage | null;
  }> {
    const formData = new FormData();
    formData.append('session_id', data.session_id.toString());
    if (data.message) formData.append('message', data.message);
    if (data.photo) formData.append('photo', data.photo);
    if (data.action_code) formData.append('action_code', data.action_code);

    const res = await api.post('/chat/messages', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async requestAgent(sessionId: number): Promise<{
    success: boolean;
    session: ChatSession;
    system_message: ChatMessage;
  }> {
    const res = await api.post('/chat/request-agent', { session_id: sessionId });
    return res.data;
  },

  async pollUserMessages(sessionId: number, lastId: number): Promise<{
    success: boolean;
    status: string;
    assigned_agent?: { id: number; name: string } | null;
    messages: ChatMessage[];
  }> {
    const res = await api.get(`/chat/poll/${sessionId}?last_id=${lastId}`);
    return res.data;
  },

  async closeUserSession(sessionId: number): Promise<{ success: boolean; message: string }> {
    const res = await api.post('/chat/close', { session_id: sessionId });
    return res.data;
  },

  // ==========================================
  // ADMIN & CS AGENT ENDPOINTS
  // ==========================================

  async getAdminSessions(params?: {
    status?: string;
    company?: string;
    search?: string;
    page?: number;
  }): Promise<{
    success: boolean;
    counters: {
      all: number;
      waiting_agent: number;
      active_agent: number;
      bot: number;
      closed: number;
    };
    data: ChatSession[];
    meta: {
      current_page: number;
      last_page: number;
      total: number;
    };
  }> {
    const res = await api.get('/admin/chat/sessions', { params });
    return res.data;
  },

  async getAdminSessionDetail(id: number): Promise<{
    success: boolean;
    session: ChatSession;
    contact360?: Contact360 | null;
    messages: ChatMessage[];
  }> {
    const res = await api.get(`/admin/chat/sessions/${id}`);
    return res.data;
  },

  async claimSession(id: number): Promise<{
    success: boolean;
    session: ChatSession;
    message: ChatMessage;
  }> {
    const res = await api.post(`/admin/chat/sessions/${id}/claim`);
    return res.data;
  },

  async replySession(id: number, data: { message?: string; photo?: File }): Promise<{
    success: boolean;
    session: ChatSession;
    message: ChatMessage;
  }> {
    const formData = new FormData();
    if (data.message) formData.append('message', data.message);
    if (data.photo) formData.append('photo', data.photo);

    const res = await api.post(`/admin/chat/sessions/${id}/reply`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async closeAdminSession(id: number, reason?: string): Promise<{
    success: boolean;
    message: string;
    session: ChatSession;
  }> {
    const res = await api.post(`/admin/chat/sessions/${id}/close`, { reason });
    return res.data;
  },

  async deleteSession(id: number): Promise<{ success: boolean; message: string }> {
    const res = await api.delete(`/admin/chat/sessions/${id}`);
    return res.data;
  },

  async getAdminStats(): Promise<ChatStats> {
    const res = await api.get('/admin/chat/stats');
    return res.data;
  },

  async getQuickReplies(): Promise<{
    success: boolean;
    templates: ChatQuickReply[];
  }> {
    const res = await api.get('/admin/chat/quick-replies');
    return res.data;
  },
};
