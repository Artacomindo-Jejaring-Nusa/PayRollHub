export type UserRole = 'super_admin' | 'admin' | 'user' | 'viewer' | 'karyawan';

export interface User {
  id: number;
  name: string;
  email: string;
  nik?: string;
  phone?: string;
  company?: string;
  school_unit?: string | null;
  bank_name?: string;
  bank_account?: string;
  address?: string;
  avatar?: string;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  status: string;
  message: string;
  data: {
    user: User;
    token: string;
    role: UserRole;
  };
}

export interface LoginPayload {
  identifier: string;
  password: string;
  remember_me?: boolean;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  category: string;
  company: 'all' | 'rbs' | 'rimamandiri';
  author_id?: number;
  author?: {
    id: number;
    name: string;
  };
  is_pinned: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface WorkReportActivity {
  key: 'absen' | 'kegiatan1' | 'kegiatan2' | 'kegiatan_lain';
  title: string;
  subtitle?: string;
  description?: string | null;
  photo?: string | null;
  required?: boolean;
}

export interface WorkReport {
  id: number;
  user_id: number;
  nik: string;
  report_date: string;
  title: string;
  description: string;
  attachment_path?: string | null;
  photo_absen?: string | null;
  desc_absen?: string | null;
  photo_kegiatan1?: string | null;
  desc_kegiatan1?: string | null;
  photo_kegiatan2?: string | null;
  desc_kegiatan2?: string | null;
  photo_kegiatan_lain?: string | null;
  desc_kegiatan_lain?: string | null;
  activities?: WorkReportActivity[];
  status: 'pending' | 'approved' | 'rejected';
  feedback?: string | null;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  user?: {
    id: number;
    name: string;
    nik?: string;
    company?: string;
    phone?: string;
  };
  reviewer?: {
    id: number;
    name: string;
  };
  created_at: string;
  updated_at: string;
}

