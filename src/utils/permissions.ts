// src/utils/permissions.ts
import type { User } from '../types/user.types';

// ============================================================
// PAGE KEYS — must match the ids used on the web admin creation form
// and the `permissions[]` array sent by the backend.
// ============================================================
export const PAGE_KEYS = [
  'dashboard',
  'users',
  'students',
  'teachers',
  'parents',
  'halaqaat',
  'attendance',
  'memorization',
  'examinations',
  'reports',
  'financial',
  'golden-register',
  'student-cards',
  'employees',
  'messages',
  'planning',
  'branches',
  // Optional ids used by some admin dashboards:
  'behavior',
  'goal-setting',
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

// ============================================================
// Normalize role strings the same way RoleNavigator does
// ============================================================
const normalizeRole = (role: any): string => {
  if (!role) return '';
  if (Array.isArray(role)) {
    return role.map(normalizeRole).find(Boolean) || '';
  }
  if (typeof role === 'object') {
    return (
      normalizeRole(role.name) ||
      normalizeRole(role.slug) ||
      normalizeRole(role.code) ||
      normalizeRole(role.role) ||
      ''
    );
  }
  return String(role).trim().toLowerCase().replace(/\s+/g, '_');
};

const ADMIN_ROLES = new Set([
  'admin',
  'super_admin',
  'superadmin',
  'school_admin',
  'schooladmin',
  'branch_admin',
  'branchadmin',
  'owner',
  'principal',
  'manager',
]);

// ============================================================
// The set of pages a FULL admin is expected to have. Used to detect
// "legacy / unrestricted" accounts where permissions is missing or
// exactly equals the full list.
// ============================================================
const FULL_SCHOOL_ADMIN_PAGES: PageKey[] = [
  'dashboard',
  'users',
  'students',
  'teachers',
  'parents',
  'halaqaat',
  'attendance',
  'memorization',
  'examinations',
  'reports',
  'financial',
  'golden-register',
  'student-cards',
  'employees',
  'messages',
  'planning',
  'branches',
];

const FULL_BRANCH_ADMIN_PAGES: PageKey[] = FULL_SCHOOL_ADMIN_PAGES.filter(
  (p) => p !== 'branches'
);

// ============================================================
// hasPermission
// ============================================================
export function hasPermission(user: any, page: PageKey | string): boolean {
  if (!user) return false;

  // Unwrap { user: {...} } shape (some flows store it that way)
  const u: any =
    user.user && typeof user.user === 'object' ? user.user : user;

  const role = normalizeRole(u.role);

  // Super admin / plain admin always has everything
  if (role === 'admin' || role === 'super_admin' || role === 'superadmin') {
    return true;
  }

  // Restricted admins → driven by permissions[]
  if (role === 'school_admin' || role === 'schooladmin' || role === 'owner' || role === 'principal' || role === 'manager') {
    return arrayHas(u.permissions, page, FULL_SCHOOL_ADMIN_PAGES);
  }

  if (role === 'branch_admin' || role === 'branchadmin') {
    return arrayHas(u.permissions, page, FULL_BRANCH_ADMIN_PAGES);
  }

  // Non-admins: this helper is only for admin menus
  return false;
}

function arrayHas(
  perms: any,
  page: string,
  fullList: PageKey[]
): boolean {
  // Missing/undefined/null → treat as full access (legacy accounts)
  if (!Array.isArray(perms)) return true;

  // Explicit empty array → restricted to nothing
  if (perms.length === 0) return false;

  // If the array is EXACTLY the full list (order-independent), treat
  // as unrestricted (some backends store the full list explicitly)
  const set = new Set(perms.map((p) => String(p)));
  const fullSet = new Set(fullList as string[]);
  if (set.size === fullSet.size && [...set].every((p) => fullSet.has(p))) {
    return true;
  }

  return set.has(page);
}

// ============================================================
// Convenience helpers
// ============================================================
export function isAdminLike(user: any): boolean {
  const u: any =
    user?.user && typeof user.user === 'object' ? user.user : user;
  return ADMIN_ROLES.has(normalizeRole(u?.role));
}

export function isRestrictedAdmin(user: any): boolean {
  if (!isAdminLike(user)) return false;
  const u: any =
    user?.user && typeof user.user === 'object' ? user.user : user;
  const perms = u?.permissions;
  if (!Array.isArray(perms)) return false;           // legacy → unrestricted
  if (perms.length === 0) return true;               // restricted to nothing
  const role = normalizeRole(u?.role);
  const full =
    role === 'branch_admin' || role === 'branchadmin'
      ? FULL_BRANCH_ADMIN_PAGES
      : FULL_SCHOOL_ADMIN_PAGES;
  const fullSet = new Set(full as string[]);
  const set = new Set(perms.map((p) => String(p)));
  const isFull = set.size === fullSet.size && [...set].every((p) => fullSet.has(p));
  return !isFull;
}