export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  tenantId: string;
  branchId: string | null;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  profilePhoto?: string;
  permissions: string[];
  preferences: UserPreferences;
  associatedStudent?: string;
  associatedTeacher?: string;
  associatedParent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  language: 'en' | 'ar' | 'so';
  defaultBranch: string | null;
}

export type UserRole = 'admin' | 'school_admin' | 'branch_admin' | 'teacher' | 'student' | 'parent';

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}