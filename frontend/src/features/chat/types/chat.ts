export type ChatStatus = 'bot' | 'waiting_agent' | 'active_agent' | 'closed';

export type SenderType = 'user' | 'bot' | 'agent' | 'system';

export interface SuggestedAction {
  label: string;
  action: string;
}

export interface ChatMessage {
  id: number;
  chat_session_id: number;
  sender_type: SenderType;
  sender_id?: number | null;
  sender_name: string;
  message: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  suggested_actions?: SuggestedAction[] | null;
  is_read_by_user: boolean;
  is_read_by_agent: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssignedAgent {
  id: number;
  name: string;
  role: string;
}

export interface ChatSession {
  id: number;
  session_code: string;
  user_id?: number | null;
  role: string;
  company_name: string;
  user_name: string;
  user_nik?: string | null;
  user_email?: string | null;
  user_phone?: string | null;
  status: ChatStatus;
  assigned_agent_id?: number | null;
  assigned_agent?: AssignedAgent | null;
  subject?: string | null;
  last_message_text?: string | null;
  last_message_sender?: string | null;
  last_message_at?: string | null;
  unread_user_count: number;
  unread_agent_count: number;
  bot_tokens_used: number;
  agent_joined_at?: string | null;
  closed_at?: string | null;
  closed_by?: number | null;
  close_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact360 {
  user_id: number;
  name: string;
  nik: string;
  email: string;
  phone: string;
  role: string;
  school_unit: string;
  position: string;
  status: string;
  latest_thp: number;
  latest_period: string | null;
  today_check_in: string | null;
  today_check_out: string | null;
  complaints_count: number;
}

export interface TokenAiStats {
  package_name: string;
  package_price: number;
  package_price_formatted: string;
  total_quota_tokens: number;
  used_tokens: number;
  remaining_tokens: number;
  percent_used: number;
}

export interface ChatStats {
  token_ai: TokenAiStats;
  sessions: {
    waiting_agent: number;
    active_agent: number;
    bot_handled: number;
    closed_today: number;
    total_all: number;
  };
}

export interface ChatQuickReply {
  id: number;
  title: string;
  text: string;
}
