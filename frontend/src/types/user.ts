import { User, UserRole } from './auth';

export interface UserListResponse {
  status: string;
  data: User[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from?: number | null;
    to?: number | null;
  };
}

export interface UserFormData {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  company?: string | null;
  nik?: string | null;
  school_unit?: string | null;
  marital_status?: string | null;
}
