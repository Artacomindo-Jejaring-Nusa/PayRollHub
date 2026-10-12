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

export interface UserLoginTrackingItem {
  id: number;
  name: string;
  email: string;
  role: string;
  company: string;
  nik?: string | null;
  phone?: string | null;
  last_login_at?: string | null;
  last_login_human: string;
  last_login_ip?: string | null;
  days_since_login?: number | null;
  status_label: 'active' | 'inactive_7' | 'inactive_30' | 'never';
  last_activity?: {
    action: string;
    description: string;
    created_at: string;
    human: string;
  } | null;
}

export interface UserLoginTrackingResponse {
  status: string;
  data: UserLoginTrackingItem[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  summary: {
    total_users: number;
    active_recently: number;
    inactive_over_7_days: number;
    never_logged_in: number;
  };
}

export interface UserLoginParams {
  search?: string;
  role?: string;
  status?: string;
  company?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

