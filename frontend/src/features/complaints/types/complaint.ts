export type ComplaintCategory = 'sistem' | 'saran' | 'gaji' | 'absensi' | 'fasilitas' | 'teknis' | 'lainnya';

export type ComplaintStatus = 'pending' | 'in_progress' | 'resolved' | 'rejected';

export interface Complaint {
  id: number;
  ticket_number: string;
  user_id: number;
  company: string;
  school_unit?: string | null;
  title: string;
  category: ComplaintCategory;
  category_label?: string;
  description: string;
  photo_path?: string | null;
  photo_name?: string | null;
  photo_full_url?: string | null;
  status: ComplaintStatus;
  status_label?: string;
  admin_notes?: string | null;
  resolved_by?: number | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    name: string;
    nik?: string;
    email?: string;
    role?: string;
    school_unit?: string;
    company?: string;
  };
  resolver?: {
    id: number;
    name: string;
  };
}

export interface ComplaintSummary {
  total: number;
  pending: number;
  in_progress: number;
  resolved: number;
  rejected?: number;
}
