// src/navigation/RoleNavigator.tsx
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../utils/constants';
import { AdminNavigator } from './AdminNavigator';
import { TeacherNavigator } from './TeacherNavigator';
import { StudentNavigator } from './StudentNavigator';
import { ParentNavigator } from './ParentNavigator';

// ============================================================
// ROLE NORMALIZATION — same logic as ProfileScreen
// ============================================================
const ADMIN_ROLE_SLUGS = [
  'admin',
  'super_admin',
  'superadmin',
  'school_admin',
  'schooladmin',
  'owner',
  'principal',
  'manager',
];

const normalizeRole = (role: any): string => {
  if (!role) return '';

  // Array of roles → prefer the highest-privilege one
  if (Array.isArray(role)) {
    const flat = role.map(normalizeRole).filter(Boolean);
    if (flat.length === 0) return '';
    return flat.find((r) => ADMIN_ROLE_SLUGS.includes(r)) || flat[0];
  }

  // Object with a name / slug / code / key / role field
  if (typeof role === 'object') {
    return (
      normalizeRole(role.name) ||
      normalizeRole(role.slug) ||
      normalizeRole(role.code) ||
      normalizeRole(role.key) ||
      normalizeRole(role.role) ||
      normalizeRole(role.value) ||
      ''
    );
  }

  // Primitive (string / number) — lowercase + collapse spaces to underscores
  return String(role).trim().toLowerCase().replace(/\s+/g, '_');
};

// ============================================================
// Also normalize ROLES.* constants into slugs so both sides match
// regardless of how the constants file defines them
// ============================================================
const ROLE_SLUGS = {
  ADMIN: normalizeRole(ROLES.ADMIN),
  SCHOOL_ADMIN: normalizeRole(ROLES.SCHOOL_ADMIN),
  BRANCH_ADMIN: normalizeRole(ROLES.BRANCH_ADMIN),
  TEACHER: normalizeRole(ROLES.TEACHER),
  STUDENT: normalizeRole(ROLES.STUDENT),
  PARENT: normalizeRole(ROLES.PARENT),
};

// ============================================================
// COMPONENT
// ============================================================
export const RoleNavigator: React.FC = () => {
  const { user, isLoading } = useAuth();

  // Still hydrating — show spinner instead of falling through to "unknown"
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0A8E5A" />
      </View>
    );
  }

  if (!user) {
    return null;
  }

  // Some code paths store { message, user: {...} } by mistake. Unwrap safely.
const rawUser: any = user;
const effectiveUser: any =
  rawUser?.user && typeof rawUser.user === 'object'
    ? rawUser.user
    : rawUser;

const role = normalizeRole(effectiveUser?.role);

  // User exists but role hasn't arrived yet — spinner, not "unknown"
  if (!role) {
    return <RoleLoadingWatchdog />;
  }

  // Route by normalized slug
  if (ADMIN_ROLE_SLUGS.includes(role)) return <AdminNavigator />;
  if (role === ROLE_SLUGS.TEACHER) return <TeacherNavigator />;
  if (role === ROLE_SLUGS.STUDENT) return <StudentNavigator />;
  if (role === ROLE_SLUGS.PARENT) return <ParentNavigator />;

  // Genuinely unrecognized — friendly fallback (also includes the raw role
  // so it's obvious in dev, but doesn't block navigation)
  return (
    <View style={styles.center}>
      <Text style={styles.title}>Account not ready</Text>
      <Text style={styles.hint}>
        We couldn't determine your role ({String(role)}). Please sign out and
        sign in again, or contact support.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7FAF8',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#18392D',
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: '#718079',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 19,
  },
});

// Small watchdog: if the role still isn't ready after 3 seconds, show a
// friendly screen instead of spinning forever.
const RoleLoadingWatchdog: React.FC = () => {
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, []);

  if (!timedOut) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0A8E5A" />
        <Text style={styles.hint}>Loading your account…</Text>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Text style={styles.title}>Account not ready</Text>
      <Text style={styles.hint}>
        We couldn't determine your role. Please sign out and sign in again.
        If this keeps happening, contact your administrator.
      </Text>
    </View>
  );
};
