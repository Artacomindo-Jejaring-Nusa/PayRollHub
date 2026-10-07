import { User, UserRole } from './auth';

export interface UserListResponse {
  status: string;
  data: User[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface UserFormData {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
}
