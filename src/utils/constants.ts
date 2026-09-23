export const ROLES = {
  ADMIN: 'admin',
  SCHOOL_ADMIN: 'school_admin',
  BRANCH_ADMIN: 'branch_admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
  PARENT: 'parent',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const ROLE_PATHS = {
  [ROLES.ADMIN]: '/admin',
  [ROLES.SCHOOL_ADMIN]: '/admin',
  [ROLES.BRANCH_ADMIN]: '/admin',
  [ROLES.TEACHER]: '/teacher',
  [ROLES.STUDENT]: '/student',
  [ROLES.PARENT]: '/parent',
};

export const ROLE_DISPLAY_NAMES = {
  [ROLES.ADMIN]: 'Super Admin',
  [ROLES.SCHOOL_ADMIN]: 'School Admin',
  [ROLES.BRANCH_ADMIN]: 'Branch Admin',
  [ROLES.TEACHER]: 'Teacher',
  [ROLES.STUDENT]: 'Student',
  [ROLES.PARENT]: 'Parent',
};

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://hufaad.com/api';
export const SUPER_ADMIN_KEY = process.env.EXPO_PUBLIC_SUPER_ADMIN_KEY || 'muscab2004';