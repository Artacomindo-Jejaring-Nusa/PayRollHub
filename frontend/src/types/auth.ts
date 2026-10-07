export type UserRole = 'admin' | 'user' | 'viewer' | 'karyawan';

export interface User {
  id: number;
  name: string;
  email: string;
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
