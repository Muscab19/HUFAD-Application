// src/utils/resolveRole.ts
import { ROLES } from './constants';

// Slugs we accept as admin
const ADMIN_SLUGS = [
  'admin',
  'super_admin',
  'superadmin',
  'school_admin',
  'schooladmin',
  'owner',
  'principal',
  'manager',
];

// Every role we recognize
const KNOWN_SLUGS = [
  ...ADMIN_SLUGS,
  'teacher',
  'student',
  'parent',
];

/** Normalize any value into a lowercase snake_case role slug. */
export const normalizeRole = (role: any): string => {
  if (!role) return '';

  if (Array.isArray(role)) {
    const flat = role.map((r: any) => normalizeRole(r)).filter(Boolean);
    if (flat.length === 0) return '';
    return flat.find((r) => KNOWN_SLUGS.includes(r)) || flat[0];
  }

  if (typeof role === 'object') {
    return (
      normalizeRole(role.name) ||
      normalizeRole(role.slug) ||
      normalizeRole(role.code) ||
      normalizeRole(role.key) ||
      normalizeRole(role.role) ||
      normalizeRole(role.value) ||
      normalizeRole(role.type) ||
      ''
    );
  }

  return String(role).trim().toLowerCase().replace(/\s+/g, '_');
};

/** True if the slug is one of the roles we recognize. */
export const isKnownRole = (slug: string): boolean =>
  KNOWN_SLUGS.includes(slug);

export const isAdminSlug = (slug: string): boolean =>
  ADMIN_SLUGS.includes(slug);

/**
 * Minimal JWT payload decoder — works in RN without extra deps.
 * Returns the parsed payload or null if the token is malformed.
 */
export const decodeJwtPayload = (token?: string | null): any | null => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    // base64url → base64
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    // pad to a multiple of 4
    while (base64.length % 4 !== 0) base64 += '=';

    // Hermes and JSC both provide a global atob
    const decoded =
      typeof globalThis !== 'undefined' && (globalThis as any).atob
        ? (globalThis as any).atob(base64)
        : // Very old runtimes — try the RN global scope
        typeof atob === 'function'
        ? atob(base64)
        : null;

    if (!decoded) return null;

    // Handle UTF-8 safely
    const utf8 = decodeURIComponent(
      decoded
        .split('')
        .map((c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(utf8);
  } catch {
    return null;
  }
};

/**
 * Best-effort extraction of a usable role.
 * Order of precedence:
 *   1. user.role               (any shape)
 *   2. user.roles              (array)
 *   3. user.userRole           (legacy field names)
 *   4. user.roleName
 *   5. JWT payload.role / .roles / .userRole / .user.role
 *   6. ROLES.* constants — if any match (rare)
 */
export const resolveRole = (user: any, token?: string | null): string => {
  // 1-4: read from user object
  const fromUser =
    normalizeRole(user?.role) ||
    normalizeRole(user?.roles) ||
    normalizeRole(user?.userRole) ||
    normalizeRole(user?.roleName) ||
    normalizeRole(user?.type);

  if (fromUser && isKnownRole(fromUser)) return fromUser;

  // 5: decode the token and look for a role claim
  const payload = decodeJwtPayload(token);
  if (payload) {
    const fromToken =
      normalizeRole(payload.role) ||
      normalizeRole(payload.roles) ||
      normalizeRole(payload.userRole) ||
      normalizeRole(payload.roleName) ||
      normalizeRole(payload.user?.role);
    if (fromToken && isKnownRole(fromToken)) return fromToken;
  }

  // 6: give up — return whatever we found (may be empty)
  return fromUser || '';
};

/** Convenience: is the user an admin (any admin-ish role)? */
export const isAdminUser = (user: any, token?: string | null): boolean =>
  isAdminSlug(resolveRole(user, token));

export const ROLE_CONSTANTS = ROLES;

// export const decodeJwtPayload = (token?: string | null): any | null => {