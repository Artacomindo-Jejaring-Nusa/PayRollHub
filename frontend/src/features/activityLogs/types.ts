export interface ActivityLogItem {
  id: number;
  user_id?: number | null;
  user_name: string;
  user_email: string;
  user_role: string;
  company?: string | null;
  action: string;
  module: string;
  description: string;
  details?: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ActivityLogStats {
  today_count: number;
  this_week_count: number;
  total_count: number;
  top_actions: Array<{ action: string; count: number }>;
  active_admins: Array<{ user_name: string; user_email: string; user_role: string; count: number }>;
}

export interface ActivityLogListResponse {
  status: string;
  data: ActivityLogItem[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface ActivityLogParams {
  search?: string;
  module?: string;
  action?: string;
  company?: string;
  user_id?: number;
  start_date?: string;
  end_date?: string;
  page?: number;
  per_page?: number;
}
