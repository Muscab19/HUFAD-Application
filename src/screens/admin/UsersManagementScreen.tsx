// src/screens/admin/UserManagementScreen.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  Share,
  Platform,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { api as apiClient } from '../../api/client';

// ============================================================
// BRAND COLORS
// ============================================================
const COLORS = {
  primary: '#0A8E5A',
  primaryDark: '#063D2C',
  primaryLight: '#E9F8F0',
  gold: '#C9A227',
  goldLight: '#FFF7DF',
  blue: '#2878D0',
  blueLight: '#EAF3FF',
  purple: '#7C3AED',
  purpleLight: '#F3EFFF',
  red: '#DC2626',
  redLight: '#FEE9E9',
  amber: '#D97706',
  amberLight: '#FEF3C7',
  teal: '#0D9488',
  tealLight: '#CCFBF1',
  whatsapp: '#25D366',
  whatsappLight: '#E7F8EE',
  white: '#FFFFFF',
  slate: '#18392D',
  slateMuted: '#718079',
  border: '#E4EBE7',
  background: '#F7FAF8',
  gray: '#8A9891',
};

// ============================================================
// ENDPOINTS
// ============================================================
const ENDPOINTS = {
  list: '/admin/users',
  create: '/admin/users',
  update: (id: string) => `/admin/users/${id}`,
  remove: (id: string) => `/admin/users/${id}`,
};

// ============================================================
// TYPES
// ============================================================
type UserRole =
  | 'admin'
  | 'school_admin'
  | 'branch_admin'
  | 'teacher'
  | 'student'
  | 'parent';

interface BranchRef {
  _id: string;
  name?: string;
  isMainBranch?: boolean;
}

interface ManagedUser {
  _id: string;
  username: string;
  email?: string;
  associatedName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  parentPhone?: string;
  role: UserRole;
  branchId?: BranchRef | string | null;
  permissions?: string[];
  temporaryPassword?: string;
  createdAt: string;
}

interface FormState {
  username: string;
  role: 'school_admin' | 'branch_admin';
  branchId: string;
  password: string;
  confirmPassword: string;
  generatePassword: boolean;
  permissions: string[];
}

// ============================================================
// CONSTANTS
// ============================================================
const AVAILABLE_PAGE_IDS = [
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
] as const;

type PageId = typeof AVAILABLE_PAGE_IDS[number];

const ROLE_VALUES: (UserRole | 'all')[] = [
  'all',
  'admin',
  'school_admin',
  'branch_admin',
  'teacher',
  'student',
  'parent',
];

// Default WhatsApp message template (editable by the admin)
const DEFAULT_WHATSAPP_TEMPLATE = `Hello {name},

Your HUFAD account is ready.

Username: {username}
Password: {password}
Role: {role}
Branch: {branch}

Please keep these credentials safe.`;

// Roles that CAN receive a share (students do NOT)
const SHARABLE_ROLES: UserRole[] = [
  'admin',
  'school_admin',
  'branch_admin',
  'teacher',
  'parent',
];

// ============================================================
// WHATSAPP HELPERS
// ============================================================
const normalizePhoneForWhatsApp = (raw?: string): string | null => {
  if (!raw) return null;
  // Strip everything except digits and +
  let cleaned = raw.replace(/[^\d+]/g, '');
  if (!cleaned) return null;
  // Remove leading +
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  // Must be a plausible international number
  if (cleaned.length < 8) return null;
  return cleaned;
};

const applyTemplate = (
  template: string,
  vars: Record<string, string>
): string => {
  let out = template;
  Object.entries(vars).forEach(([k, v]) => {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), v ?? '');
  });
  return out;
};

const openWhatsApp = async (
  phone: string,
  message: string
): Promise<boolean> => {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return false;

  const url = `whatsapp://send?phone=${normalized}&text=${encodeURIComponent(
    message
  )}`;
  const fallbackUrl = `https://wa.me/${normalized}?text=${encodeURIComponent(
    message
  )}`;

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
  } catch {
    // ignore
  }

  try {
    await Linking.openURL(fallbackUrl);
    return true;
  } catch (e) {
    console.warn('WhatsApp open failed', e);
    return false;
  }
};

// ============================================================
// HELPERS
// ============================================================
const unwrap = (res: any): any => {
  if (res && typeof res === 'object' && 'data' in res) return (res as any).data;
  return res;
};

const parseList = (res: any): ManagedUser[] => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.users)) return res.users;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.results)) return res.results;
  return [];
};

const parseOne = (res: any): ManagedUser | null => {
  if (!res) return null;
  if (res._id) return res as ManagedUser;
  if (res.user?._id) return res.user as ManagedUser;
  if (res.data?._id) return res.data as ManagedUser;
  return null;
};

const extractTempPassword = (res: any): string | undefined => {
  if (!res) return undefined;
  if (typeof res.temporaryPassword === 'string') return res.temporaryPassword;
  if (typeof res.data?.temporaryPassword === 'string')
    return res.data.temporaryPassword;
  if (typeof res.user?.temporaryPassword === 'string')
    return res.user.temporaryPassword;
  return undefined;
};

const getBranchId = (user: ManagedUser): string | undefined => {
  if (!user.branchId) return undefined;
  if (typeof user.branchId === 'string') return user.branchId;
  return user.branchId._id;
};

const getBranchName = (user: ManagedUser, t: (k: string) => string) => {
  if (user.branchId && typeof user.branchId === 'object' && user.branchId.name) {
    return user.branchId.name;
  }
  if (user.role === 'school_admin' || user.role === 'admin')
    return t('userManagement.branch.schoolAdmin');
  if (user.role === 'branch_admin')
    return t('userManagement.branch.noBranchAssigned');
  return t('userManagement.branch.noBranch');
};

const getRoleColor = (role: UserRole) => {
  switch (role) {
    case 'admin':
      return { bg: '#E9D5FF', text: '#6B21A8' };
    case 'school_admin':
      return { bg: '#DDD6FE', text: '#5B21B6' };
    case 'branch_admin':
      return { bg: '#C7D2FE', text: '#3730A3' };
    case 'teacher':
      return { bg: COLORS.blueLight, text: COLORS.blue };
    case 'student':
      return { bg: COLORS.primaryLight, text: COLORS.primary };
    case 'parent':
      return { bg: COLORS.amberLight, text: COLORS.amber };
    default:
      return { bg: '#F1F5F9', text: COLORS.slateMuted };
  }
};

const getRoleLabel = (role: UserRole, t: (k: string) => string) =>
  t(`userManagement.roleLabels.${role}`);

const getUserInitials = (user: ManagedUser) => {
  const display = user.associatedName || user.firstName || user.username;
  const parts = display.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return display.substring(0, 2).toUpperCase();
};

const getUserAvatarBg = (role: UserRole) => {
  switch (role) {
    case 'parent':
      return COLORS.purple;
    case 'student':
      return COLORS.primary;
    case 'teacher':
      return COLORS.gold;
    case 'branch_admin':
      return COLORS.blue;
    case 'school_admin':
      return '#6366F1';
    default:
      return COLORS.gray;
  }
};

const generateUsernameForRole = (role: 'school_admin' | 'branch_admin') => {
  const prefix = role === 'school_admin' ? 'SA' : 'BA';
  const year = new Date().getFullYear().toString().slice(-2);
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${year}${randomNum}`;
};

// ============================================================
// WHATSAPP SETTINGS — AsyncStorage wrapper
// ============================================================
const WHATSAPP_SETTINGS_PREFIX = '@userManagement/whatsappTemplate';

const whatsappSettingsKey = (tenantId: string, branchId: string) =>
  `${WHATSAPP_SETTINGS_PREFIX}_${tenantId || 'global'}_${
    branchId || 'global'
  }`;

const loadWhatsAppTemplate = async (
  tenantId: string,
  branchId: string
): Promise<string> => {
  try {
    const raw = await AsyncStorage.getItem(
      whatsappSettingsKey(tenantId, branchId)
    );
    if (raw && raw.trim()) return raw;
    return DEFAULT_WHATSAPP_TEMPLATE;
  } catch {
    return DEFAULT_WHATSAPP_TEMPLATE;
  }
};

const saveWhatsAppTemplate = async (
  tenantId: string,
  branchId: string,
  template: string
): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      whatsappSettingsKey(tenantId, branchId),
      template
    );
  } catch (e) {
    console.warn('Failed to save WhatsApp template', e);
  }
};

// ============================================================
// FILTER MODAL
// ============================================================
const FilterModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  roleFilter: string;
  branchFilter: string;
  branches: BranchRef[];
  onApply: (role: string, branch: string) => void;
}> = ({ visible, onClose, roleFilter, branchFilter, branches, onApply }) => {
  const { t } = useTranslation();
  const [localRole, setLocalRole] = useState(roleFilter);
  const [localBranch, setLocalBranch] = useState(branchFilter);

  useEffect(() => {
    if (visible) {
      setLocalRole(roleFilter);
      setLocalBranch(branchFilter);
    }
  }, [visible, roleFilter, branchFilter]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { maxHeight: '75%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {t('userManagement.filter.title')}
            </Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.filterSectionTitle}>
              {t('userManagement.filter.role')}
            </Text>
            <View style={styles.filterChipsRow}>
              {ROLE_VALUES.map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.filterChip,
                    localRole === value && styles.filterChipActive,
                  ]}
                  onPress={() => setLocalRole(value)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      localRole === value && styles.filterChipTextActive,
                    ]}
                  >
                    {t(`userManagement.roles.${value}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.filterSectionTitle, { marginTop: 20 }]}>
              {t('userManagement.filter.branch')}
            </Text>
            <View style={styles.filterChipsRow}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  localBranch === 'all' && styles.filterChipActive,
                ]}
                onPress={() => setLocalBranch('all')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    localBranch === 'all' && styles.filterChipTextActive,
                  ]}
                >
                  {t('userManagement.branch.allBranches')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  localBranch === 'school-admin' && styles.filterChipActive,
                ]}
                onPress={() => setLocalBranch('school-admin')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    localBranch === 'school-admin' &&
                      styles.filterChipTextActive,
                  ]}
                >
                  {t('userManagement.branch.schoolAdmins')}
                </Text>
              </TouchableOpacity>
              {branches.map((b) => (
                <TouchableOpacity
                  key={b._id}
                  style={[
                    styles.filterChip,
                    localBranch === b._id && styles.filterChipActive,
                  ]}
                  onPress={() => setLocalBranch(b._id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      localBranch === b._id && styles.filterChipTextActive,
                    ]}
                  >
                    {b.name}
                    {b.isMainBranch
                      ? ` (${t('userManagement.branch.main')})`
                      : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.filterResetBtn}
              onPress={() => {
                setLocalRole('all');
                setLocalBranch('all');
              }}
            >
              <Text style={styles.filterResetBtnText}>
                {t('userManagement.filter.reset')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterApplyBtn}
              onPress={() => {
                onApply(localRole, localBranch);
                onClose();
              }}
            >
              <Text style={styles.filterApplyBtnText}>
                {t('userManagement.filter.apply')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// WHATSAPP TEMPLATE SETTINGS MODAL
// ============================================================
const WhatsAppSettingsModal: React.FC<{
  visible: boolean;
  initialTemplate: string;
  onClose: () => void;
  onSave: (template: string) => void;
}> = ({ visible, initialTemplate, onClose, onSave }) => {
  const { t } = useTranslation();
  const [template, setTemplate] = useState(initialTemplate);

  useEffect(() => {
    if (visible) setTemplate(initialTemplate);
  }, [visible, initialTemplate]);

  const insertPlaceholder = (key: string) => {
    setTemplate((prev) => `${prev}{${key}}`);
  };

  const handleReset = () => {
    setTemplate(DEFAULT_WHATSAPP_TEMPLATE);
  };

  const handleSave = () => {
    if (!template.trim()) {
      Alert.alert(
        t('userManagement.whatsapp.errors.emptyTemplate') ||
          'Template cannot be empty'
      );
      return;
    }
    onSave(template);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>
                {t('userManagement.whatsapp.title')}
              </Text>
              <Text style={styles.modalSubtitle}>
                {t('userManagement.whatsapp.subtitle')}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={onClose}
            >
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.formLabel}>
              {t('userManagement.whatsapp.templateLabel')}
            </Text>
            <TextInput
              style={[styles.formInput, styles.templateArea]}
              value={template}
              onChangeText={setTemplate}
              multiline
              numberOfLines={8}
              placeholder={DEFAULT_WHATSAPP_TEMPLATE}
              placeholderTextColor="#A0AAA5"
            />

            <Text style={styles.formLabel}>
              {t('userManagement.whatsapp.placeholders')}
            </Text>
            <View style={styles.placeholderRow}>
              {[
                { key: 'name', label: t('userManagement.whatsapp.ph.name') },
                {
                  key: 'username',
                  label: t('userManagement.whatsapp.ph.username'),
                },
                {
                  key: 'password',
                  label: t('userManagement.whatsapp.ph.password'),
                },
                { key: 'role', label: t('userManagement.whatsapp.ph.role') },
                {
                  key: 'branch',
                  label: t('userManagement.whatsapp.ph.branch'),
                },
              ].map((ph) => (
                <TouchableOpacity
                  key={ph.key}
                  style={styles.placeholderChip}
                  onPress={() => insertPlaceholder(ph.key)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.placeholderChipText}>
                    {`{${ph.key}}`}
                  </Text>
                  <Text style={styles.placeholderChipSub}>{ph.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formHint}>
              {t('userManagement.whatsapp.hint')}
            </Text>

            <Text style={[styles.formLabel, { marginTop: 16 }]}>
              {t('userManagement.whatsapp.preview')}
            </Text>
            <View style={styles.previewBox}>
              <Text style={styles.previewText} numberOfLines={8}>
                {applyTemplate(template, {
                  name: 'Ahmed Mohamed',
                  username: 'SA251234',
                  password: 'TempPass123',
                  role: 'Teacher',
                  branch: 'Main Branch',
                })}
              </Text>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.actionBtnGhost}
              onPress={handleReset}
              activeOpacity={0.75}
            >
              <Ionicons name="refresh-outline" size={16} color={COLORS.slate} />
              <Text style={styles.actionBtnGhostText}>
                {t('userManagement.whatsapp.reset')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtnPrimary}
              onPress={handleSave}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.actionBtnPrimaryText}>
                {t('userManagement.whatsapp.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// USER DETAILS MODAL
// ============================================================
const UserDetailsModal: React.FC<{
  visible: boolean;
  user: ManagedUser | null;
  showPassword: boolean;
  onTogglePassword: () => void;
  onClose: () => void;
  onShare: () => void;
  onWhatsApp: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({
  visible,
  user,
  showPassword,
  onTogglePassword,
  onClose,
  onShare,
  onWhatsApp,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  if (!user) return null;
  const rc = getRoleColor(user.role);
  const isSystemUser = user.role === 'parent' || user.role === 'student';
  const canManage = ['admin', 'school_admin', 'branch_admin'].includes(
    user.role
  );
  const canWhatsApp = SHARABLE_ROLES.includes(user.role);
  const phone =
    user.role === 'student'
      ? user.parentPhone || user.phone
      : user.phone;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {t('userManagement.details.title')}
            </Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalProfile}>
              <View
                style={[
                  styles.modalAvatar,
                  { backgroundColor: getUserAvatarBg(user.role) },
                ]}
              >
                <Text style={styles.modalAvatarText}>{getUserInitials(user)}</Text>
              </View>
              <Text style={styles.modalName}>
                {user.associatedName || user.username}
              </Text>
              <Text style={styles.modalEmail}>{user.email || '—'}</Text>
              <View
                style={[
                  styles.roleBadgeLg,
                  { backgroundColor: rc.bg, marginTop: 10 },
                ]}
              >
                <Text style={[styles.roleBadgeLgText, { color: rc.text }]}>
                  {getRoleLabel(user.role, t)}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="person-outline"
                  size={16}
                  color={COLORS.primary}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>
                  {t('userManagement.details.username')}
                </Text>
                <Text style={styles.infoValue}>{user.username}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="key-outline" size={16} color={COLORS.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>
                  {t('userManagement.details.password')}
                </Text>
                <View style={styles.passwordRow}>
                  <Text style={styles.infoValue}>
                    {showPassword
                      ? user.temporaryPassword ||
                        t('userManagement.details.notSet')
                      : '••••••••'}
                  </Text>
                  <TouchableOpacity
                    onPress={onTogglePassword}
                    style={styles.iconBtnSmall}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={16}
                      color={COLORS.slateMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {!!phone && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons
                    name="call-outline"
                    size={16}
                    color={COLORS.primary}
                  />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>
                    {t('userManagement.details.phone') || 'Phone'}
                  </Text>
                  <Text style={styles.infoValue}>{phone}</Text>
                </View>
              </View>
            )}

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={COLORS.primary}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>
                  {t('userManagement.details.branch')}
                </Text>
                <Text style={styles.infoValue}>{getBranchName(user, t)}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="shield-outline"
                  size={16}
                  color={COLORS.primary}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>
                  {t('userManagement.details.permissions')}
                </Text>
                <Text style={styles.infoValue}>
                  {t('userManagement.details.pagesCount', {
                    count: (user.permissions || []).length,
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={COLORS.primary}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>
                  {t('userManagement.details.created')}
                </Text>
                <Text style={styles.infoValue}>
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : '—'}
                </Text>
              </View>
            </View>

            {(user.permissions || []).length > 0 && (
              <View style={styles.permBlock}>
                <Text style={styles.permBlockLabel}>
                  {t('userManagement.details.accessiblePages')}
                </Text>
                <View style={styles.permWrap}>
                  {(user.permissions || []).map((p) => (
                    <View key={p} style={styles.permPill}>
                      <Text style={styles.permPillText}>
                        {t(`userManagement.permissions.${p}`)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.modalActions}>
            {canWhatsApp && (
              <TouchableOpacity
                style={styles.actionBtnWhatsApp}
                onPress={onWhatsApp}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="logo-whatsapp"
                  size={16}
                  color={COLORS.white}
                />
                <Text style={styles.actionBtnWhatsAppText}>
                  {t('userManagement.actions.whatsapp')}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionBtnOutline}
              onPress={onShare}
            >
              <Ionicons
                name="share-outline"
                size={16}
                color={COLORS.primary}
              />
              <Text style={styles.actionBtnOutlineText}>
                {t('userManagement.actions.share')}
              </Text>
            </TouchableOpacity>
            {canManage ? (
              <>
                <TouchableOpacity
                  style={styles.actionBtnOutline}
                  onPress={onEdit}
                >
                  <Ionicons
                    name="create-outline"
                    size={16}
                    color={COLORS.primary}
                  />
                  <Text style={styles.actionBtnOutlineText}>
                    {t('userManagement.actions.edit')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtnDanger}
                  onPress={onDelete}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={COLORS.red}
                  />
                  <Text style={styles.actionBtnDangerText}>
                    {t('userManagement.actions.delete')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.autoCreatedPill}>
                <Ionicons
                  name="information-circle-outline"
                  size={14}
                  color={COLORS.slateMuted}
                />
                <Text style={styles.autoCreatedText}>
                  {isSystemUser
                    ? t('userManagement.details.autoCreated')
                    : t('userManagement.details.readOnly')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// CREATE / EDIT MODAL
// ============================================================
const UserFormModal: React.FC<{
  visible: boolean;
  isEditing: boolean;
  initialUser: ManagedUser | null;
  availableBranches: BranchRef[];
  currentUserRole?: string;
  onClose: () => void;
  onSubmit: (
    data: FormState
  ) => Promise<{ generatedPassword?: string } | void>;
}> = ({
  visible,
  isEditing,
  initialUser,
  availableBranches,
  currentUserRole,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();

  const blank: FormState = {
    username: '',
    role: 'school_admin',
    branchId: '',
    password: '',
    confirmPassword: '',
    generatePassword: true,
    permissions: [],
  };

  const [form, setForm] = useState<FormState>(blank);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');

  const defaultsFor = (role: 'school_admin' | 'branch_admin') =>
    role === 'school_admin'
      ? [...AVAILABLE_PAGE_IDS]
      : AVAILABLE_PAGE_IDS.filter((p) => p !== 'branches');

  useEffect(() => {
    if (!visible) return;
    setError('');
    setGeneratedPassword('');

    if (isEditing && initialUser) {
      setForm({
        username: initialUser.username,
        role:
          initialUser.role === 'branch_admin'
            ? 'branch_admin'
            : 'school_admin',
        branchId: getBranchId(initialUser) || '',
        password: '',
        confirmPassword: '',
        generatePassword: true,
        permissions: initialUser.permissions || [],
      });
      return;
    }

    setForm({
      ...blank,
      permissions: defaultsFor('school_admin'),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isEditing, initialUser]);

  const handleRoleChange = (role: 'school_admin' | 'branch_admin') => {
    setForm((prev) => ({
      ...prev,
      role,
      branchId: role === 'school_admin' ? '' : prev.branchId,
      permissions: defaultsFor(role),
    }));
  };

  const handleTogglePermission = (id: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(id)
        ? prev.permissions.filter((p) => p !== id)
        : [...prev.permissions, id],
    }));
  };

  const handleSelectAll = () => {
    const all = AVAILABLE_PAGE_IDS.filter(
      (p) => !(p === 'branches' && form.role === 'branch_admin')
    );
    setForm((prev) => ({ ...prev, permissions: [...all] }));
  };

  const handleClearAll = () => {
    setForm((prev) => ({ ...prev, permissions: [] }));
  };

  const handleSave = async () => {
    setError('');
    if (!form.username.trim()) {
      setError(t('userManagement.form.errors.usernameRequired'));
      return;
    }
    if (form.role === 'branch_admin' && !form.branchId) {
      setError(t('userManagement.form.errors.branchRequired'));
      return;
    }
    if (!isEditing && !form.generatePassword) {
      if (form.password.length < 8) {
        setError(t('userManagement.form.errors.passwordTooShort'));
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError(t('userManagement.form.errors.passwordMismatch'));
        return;
      }
    }

    setLoading(true);
    try {
      const result = await onSubmit(form);
      if (result?.generatedPassword) {
        setGeneratedPassword(result.generatedPassword);
      } else {
        onClose();
      }
    } catch (e: any) {
      setError(e?.message || t('userManagement.form.errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const visibleBranches = useMemo(() => availableBranches, [availableBranches]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isEditing
                ? t('userManagement.form.editTitle')
                : t('userManagement.form.createTitle')}
            </Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={onClose}
              disabled={loading}
            >
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
          >
            {error ? (
              <View style={styles.modalErrorBox}>
                <Ionicons
                  name="alert-circle"
                  size={16}
                  color={COLORS.red}
                />
                <Text style={styles.modalErrorText}>{error}</Text>
              </View>
            ) : null}

            {generatedPassword ? (
              <View style={styles.successBox}>
                <Text style={styles.successTitle}>
                  {t('userManagement.form.successTitle')}
                </Text>
                <View style={styles.credRow}>
                  <Text style={styles.credLabel}>
                    {t('userManagement.details.username')}:
                  </Text>
                  <Text style={styles.credValue}>{form.username}</Text>
                </View>
                <View style={styles.credRow}>
                  <Text style={styles.credLabel}>
                    {t('userManagement.details.password')}:
                  </Text>
                  <Text style={styles.credValue}>{generatedPassword}</Text>
                </View>
                <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={() =>
                    Share.share({
                      message: `${t(
                        'userManagement.messages.shareCredentialsHeader'
                      )}\n${t('userManagement.details.username')}: ${
                        form.username
                      }\n${t(
                        'userManagement.details.password'
                      )}: ${generatedPassword}`,
                    })
                  }
                >
                  <Ionicons
                    name="share-outline"
                    size={14}
                    color={COLORS.primary}
                  />
                  <Text style={styles.shareBtnText}>
                    {t('userManagement.form.shareCredentials')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                  <Text style={styles.doneBtnText}>
                    {t('userManagement.form.done')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {!generatedPassword && (
              <>
                <Text style={styles.formLabel}>
                  {t('userManagement.form.adminType')}
                </Text>
                <View style={styles.filterChipsRow}>
                  {(['school_admin', 'branch_admin'] as const).map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.filterChip,
                        form.role === r && styles.filterChipActive,
                        isEditing && { opacity: 0.5 },
                      ]}
                      onPress={() => !isEditing && handleRoleChange(r)}
                      disabled={isEditing}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          form.role === r && styles.filterChipTextActive,
                        ]}
                      >
                        {r === 'school_admin'
                          ? t('userManagement.form.schoolAdmin')
                          : t('userManagement.form.branchAdmin')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.formHint}>
                  {form.role === 'school_admin'
                    ? t('userManagement.form.schoolAdminHint')
                    : t('userManagement.form.branchAdminHint')}
                </Text>

                <Text style={[styles.formLabel, { marginTop: 14 }]}>
                  {t('userManagement.branch.assignTo')}
                </Text>
                <View style={styles.filterChipsRow}>
                  {visibleBranches.length === 0 ? (
                    <Text style={styles.formHint}>
                      {t('userManagement.branch.noBranchesAvailable')}
                    </Text>
                  ) : (
                    visibleBranches.map((b) => {
                      const disabled =
                        form.role === 'school_admin' || isEditing;
                      return (
                        <TouchableOpacity
                          key={b._id}
                          style={[
                            styles.filterChip,
                            form.branchId === b._id &&
                              styles.filterChipActive,
                            disabled && { opacity: 0.5 },
                          ]}
                          onPress={() =>
                            !disabled &&
                            setForm({ ...form, branchId: b._id })
                          }
                          disabled={disabled}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              form.branchId === b._id &&
                                styles.filterChipTextActive,
                            ]}
                          >
                            {b.name}
                            {b.isMainBranch
                              ? ` (${t('userManagement.branch.main')})`
                              : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>

                <Text style={[styles.formLabel, { marginTop: 14 }]}>
                  {t('userManagement.form.username')}
                </Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.formInput, { flex: 1 }]}
                    placeholder={t(
                      'userManagement.form.usernamePlaceholder'
                    )}
                    placeholderTextColor="#A0AAA5"
                    value={form.username}
                    onChangeText={(v) =>
                      setForm({ ...form, username: v })
                    }
                    autoCapitalize="none"
                    editable={!isEditing && !loading}
                  />
                  {!isEditing && (
                    <TouchableOpacity
                      style={styles.genBtn}
                      onPress={() =>
                        setForm({
                          ...form,
                          username: generateUsernameForRole(form.role),
                        })
                      }
                    >
                      <Ionicons
                        name="refresh"
                        size={16}
                        color={COLORS.primary}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.permHeaderRow}>
                  <Text style={[styles.formLabel, { marginBottom: 0 }]}>
                    {t('userManagement.form.permissionsTitle')}
                  </Text>
                  <View style={styles.permHeaderActions}>
                    <TouchableOpacity onPress={handleSelectAll}>
                      <Text style={styles.linkPrimary}>
                        {t('userManagement.form.selectAll')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleClearAll}>
                      <Text style={styles.linkDanger}>
                        {t('userManagement.form.clear')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.permGrid}>
                  {AVAILABLE_PAGE_IDS.map((pageId) => {
                    if (pageId === 'branches' && form.role === 'branch_admin')
                      return null;
                    const checked = form.permissions.includes(pageId);
                    return (
                      <TouchableOpacity
                        key={pageId}
                        style={[
                          styles.permTile,
                          checked && styles.permTileActive,
                        ]}
                        onPress={() => handleTogglePermission(pageId)}
                      >
                        <Ionicons
                          name={checked ? 'checkbox' : 'square-outline'}
                          size={16}
                          color={
                            checked ? COLORS.primary : COLORS.slateMuted
                          }
                        />
                        <Text
                          style={[
                            styles.permTileText,
                            checked && styles.permTileTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {t(`userManagement.permissions.${pageId}`)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.permCountText}>
                  {t('userManagement.form.selectedCount', {
                    count: form.permissions.length,
                    total: AVAILABLE_PAGE_IDS.filter(
                      (p) =>
                        !(p === 'branches' && form.role === 'branch_admin')
                    ).length,
                  })}
                </Text>

                {!isEditing && (
                  <>
                    <TouchableOpacity
                      style={styles.checkboxRow}
                      onPress={() =>
                        setForm({
                          ...form,
                          generatePassword: !form.generatePassword,
                        })
                      }
                    >
                      <Ionicons
                        name={
                          form.generatePassword
                            ? 'checkbox'
                            : 'square-outline'
                        }
                        size={20}
                        color={COLORS.primary}
                      />
                      <Text style={styles.checkboxLabel}>
                        {t('userManagement.form.generatePassword')}
                      </Text>
                    </TouchableOpacity>

                    {!form.generatePassword && (
                      <>
                        <Text
                          style={[
                            styles.formLabel,
                            { marginTop: 10 },
                          ]}
                        >
                          {t('userManagement.form.password')}
                        </Text>
                        <TextInput
                          style={styles.formInput}
                          placeholder={t(
                            'userManagement.form.passwordPlaceholder'
                          )}
                          placeholderTextColor="#A0AAA5"
                          value={form.password}
                          onChangeText={(v) =>
                            setForm({ ...form, password: v })
                          }
                          secureTextEntry
                        />

                        <Text
                          style={[
                            styles.formLabel,
                            { marginTop: 12 },
                          ]}
                        >
                          {t('userManagement.form.confirmPassword')}
                        </Text>
                        <TextInput
                          style={styles.formInput}
                          placeholder={t(
                            'userManagement.form.confirmPasswordPlaceholder'
                          )}
                          placeholderTextColor="#A0AAA5"
                          value={form.confirmPassword}
                          onChangeText={(v) =>
                            setForm({ ...form, confirmPassword: v })
                          }
                          secureTextEntry
                        />
                      </>
                    )}
                  </>
                )}

                <View style={{ height: 20 }} />
              </>
            )}
          </ScrollView>

          {!generatedPassword && (
            <View style={styles.filterActions}>
              <TouchableOpacity
                style={styles.filterResetBtn}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.filterResetBtnText}>
                  {t('userManagement.form.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterApplyBtn,
                  loading && { opacity: 0.7 },
                ]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.filterApplyBtnText}>
                    {isEditing
                      ? t('userManagement.form.update')
                      : t('userManagement.form.create')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// MAIN SCREEN
// ============================================================
export const UserManagementScreen: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { branches, currentBranch } = useBranch();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);

  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPasswordInModal, setShowPasswordInModal] = useState(false);

  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);

  // WhatsApp
  const [whatsappTemplate, setWhatsappTemplate] = useState(
    DEFAULT_WHATSAPP_TEMPLATE
  );
  const [showWhatsAppSettings, setShowWhatsAppSettings] = useState(false);

  // Tenant + branch keys for per-tenant template
  const tenantId =
    (currentUser as any)?.tenantId ||
    (currentBranch as any)?.tenantId ||
    'global';
  const branchKey = (currentBranch as any)?._id || 'global';

  // ============================================================
  // BANNERS
  // ============================================================
  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };
  const flashError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };

  // ============================================================
  // BRANCHES AVAILABLE
  // ============================================================
  const availableBranches: BranchRef[] = useMemo(() => {
    const list: BranchRef[] = Array.isArray(branches) ? branches : [];
    if (
      currentUser?.role === 'school_admin' ||
      currentUser?.role === 'admin'
    ) {
      return list;
    }
    if ((currentUser as any)?.branchId) {
      return list.filter((b) => b._id === (currentUser as any).branchId);
    }
    return [];
  }, [branches, currentUser]);

  // ============================================================
  // LOAD TEMPLATE
  // ============================================================
  useEffect(() => {
    (async () => {
      const saved = await loadWhatsAppTemplate(tenantId, branchKey);
      setWhatsappTemplate(saved);
    })();
  }, [tenantId, branchKey]);

  // ============================================================
  // FETCH USERS
  // ============================================================
  const fetchUsers = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      try {
        const res: any = await apiClient.get(ENDPOINTS.list);
        const list = parseList(unwrap(res));
        setUsers(list);
        setError('');
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401) {
          flashError(t('userManagement.banners.authFailed'));
        } else if (status === 403) {
          flashError(t('userManagement.banners.accessDenied'));
        } else {
          flashError(
            err?.response?.data?.message ||
              err?.message ||
              t('userManagement.banners.loadFailed')
          );
        }
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (!currentUser) return;
    if (
      !['admin', 'school_admin', 'branch_admin'].includes(
        currentUser.role as string
      )
    ) {
      setLoading(false);
      return;
    }
    fetchUsers(true);
  }, [currentUser, fetchUsers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUsers(false);
    setRefreshing(false);
  };

  // ============================================================
  // FILTERING
  // ============================================================
  const filteredUsers = useMemo(() => {
    let result = [...users];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (u.associatedName || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q)
      );
    }

    if (roleFilter !== 'all') {
      result = result.filter((u) => u.role === roleFilter);
    }

    if (branchFilter !== 'all') {
      if (branchFilter === 'school-admin') {
        result = result.filter((u) => !getBranchId(u));
      } else {
        result = result.filter((u) => getBranchId(u) === branchFilter);
      }
    }

    return result;
  }, [users, searchTerm, roleFilter, branchFilter]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (roleFilter !== 'all') count++;
    if (branchFilter !== 'all') count++;
    return count;
  }, [roleFilter, branchFilter]);

  // ============================================================
  // SHARE HELPERS
  // ============================================================
  const buildMessageForUser = (user: ManagedUser) => {
    const name =
      user.associatedName ||
      `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
      user.username;

    return applyTemplate(whatsappTemplate, {
      name,
      username: user.username,
      password: user.temporaryPassword || '',
      role: getRoleLabel(user.role, t),
      branch: getBranchName(user, t),
    });
  };

  const getRecipientPhone = (user: ManagedUser): string | undefined => {
    if (user.role === 'student') {
      return user.parentPhone || user.phone;
    }
    return user.phone;
  };

  const shareCredentials = async (user: ManagedUser) => {
    const msg = buildMessageForUser(user);
    try {
      await Share.share({ message: msg });
    } catch {
      Alert.alert(
        t('userManagement.banners.shareFailedTitle'),
        t('userManagement.banners.shareFailedMsg')
      );
    }
  };

  const shareToWhatsApp = async (user: ManagedUser) => {
    const phone = getRecipientPhone(user);
    if (!phone) {
      Alert.alert(
        t('userManagement.whatsapp.noPhoneTitle') || 'No phone number',
        t('userManagement.whatsapp.noPhoneMsg') ||
          'This user does not have a phone number on file.'
      );
      return;
    }
    const msg = buildMessageForUser(user);
    const ok = await openWhatsApp(phone, msg);
    if (!ok) {
      Alert.alert(
        t('userManagement.whatsapp.failedTitle') || 'WhatsApp not available',
        t('userManagement.whatsapp.failedMsg') ||
          'Could not open WhatsApp. Falling back to system share.'
      );
      await shareCredentials(user);
    }
  };

  const handleOpenDetails = (user: ManagedUser) => {
    setSelectedUser(user);
    setShowPasswordInModal(false);
    setShowDetailsModal(true);
  };

  const handleOpenEdit = (user: ManagedUser) => {
    setEditingUser(user);
    setIsEditing(true);
    setShowDetailsModal(false);
    setShowFormModal(true);
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setIsEditing(false);
    setShowFormModal(true);
  };

  const handleDelete = (user: ManagedUser) => {
    Alert.alert(
      t('userManagement.delete.title'),
      t('userManagement.delete.confirmMsg', {
        name: user.associatedName || user.username,
      }),
      [
        { text: t('userManagement.delete.cancel'), style: 'cancel' },
        {
          text: t('userManagement.delete.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(ENDPOINTS.remove(user._id));
              setUsers((prev) => prev.filter((u) => u._id !== user._id));
              setShowDetailsModal(false);
              flashSuccess(t('userManagement.messages.userDeleted'));
            } catch (err: any) {
              flashError(
                err?.response?.data?.message ||
                  err?.message ||
                  t('userManagement.messages.deleteFailed')
              );
            }
          },
        },
      ]
    );
  };

  const handleSubmitForm = async (
    data: FormState
  ): Promise<{ generatedPassword?: string } | void> => {
    let branchId: string | null = null;
    if (data.role === 'branch_admin') {
      branchId =
        currentUser?.role === 'branch_admin'
          ? (currentUser as any)?.branchId || data.branchId
          : data.branchId;
    }

    // ----- EDIT -----
    if (isEditing && editingUser) {
      const payload = {
        username: data.username,
        role: data.role,
        branchId,
        permissions: data.permissions,
      };

      const res: any = await apiClient.put(
        ENDPOINTS.update(editingUser._id),
        payload
      );
      const updated = parseOne(unwrap(res));

      setUsers((prev) =>
        prev.map((u) =>
          u._id === editingUser._id
            ? updated ||
              ({
                ...u,
                ...payload,
                branchId: branchId
                  ? {
                      _id: branchId,
                      name: availableBranches.find(
                        (b) => b._id === branchId
                      )?.name,
                    }
                  : null,
              } as ManagedUser)
            : u
        )
      );
      setIsEditing(false);
      setEditingUser(null);
      setShowFormModal(false);
      flashSuccess(t('userManagement.messages.userUpdated'));
      return;
    }

    // ----- CREATE -----
    const payload: any = {
      username: data.username.trim(),
      role: data.role,
      branchId,
      permissions: data.permissions,
    };

    if (!data.generatePassword) {
      payload.password = data.password;
    }

    const res: any = await apiClient.post(ENDPOINTS.create, payload);
    const unwrapped = unwrap(res);
    const serverTemp = extractTempPassword(unwrapped);
    const created = parseOne(unwrapped);

    if (created?._id) {
      const merged: ManagedUser = {
        ...created,
        temporaryPassword: serverTemp || created.temporaryPassword,
      };
      setUsers((prev) => [merged, ...prev]);
    } else {
      await fetchUsers(false);
    }

    if (data.generatePassword) {
      if (serverTemp) {
        return { generatedPassword: serverTemp };
      }
      setShowFormModal(false);
      flashSuccess(t('userManagement.messages.userCreated'));
      return;
    }

    setShowFormModal(false);
    flashSuccess(t('userManagement.messages.userCreated'));
  };

  // ============================================================
  // WHATSAPP SETTINGS SAVE
  // ============================================================
  const handleSaveWhatsAppTemplate = async (template: string) => {
    setWhatsappTemplate(template);
    await saveWhatsAppTemplate(tenantId, branchKey, template);
    setShowWhatsAppSettings(false);
    flashSuccess(
      t('userManagement.whatsapp.saved') || 'Template saved successfully'
    );
  };

  // ============================================================
  // ACCESS GATE
  // ============================================================
  const canAccess =
    currentUser &&
    ['admin', 'school_admin', 'branch_admin'].includes(
      currentUser.role as string
    );

  if (!canAccess) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.accessDeniedWrap}>
          <View style={styles.accessDeniedIcon}>
            <Ionicons name="lock-closed" size={38} color={COLORS.red} />
          </View>
          <Text style={styles.accessDeniedTitle}>
            {t('userManagement.accessDenied.title')}
          </Text>
          <Text style={styles.accessDeniedText}>
            {t('userManagement.accessDenied.message')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================
  // RENDER USER CARD
  // ============================================================
  const renderUser = ({ item }: { item: ManagedUser }) => {
    const rc = getRoleColor(item.role);
    const isSystemUser = item.role === 'parent' || item.role === 'student';
    const canWhatsApp = SHARABLE_ROLES.includes(item.role);
    const phone = getRecipientPhone(item);

    return (
      <TouchableOpacity
        style={styles.userCard}
        activeOpacity={0.7}
        onPress={() => handleOpenDetails(item)}
      >
        <View style={styles.userRow}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: getUserAvatarBg(item.role) },
            ]}
          >
            <Text style={styles.avatarText}>{getUserInitials(item)}</Text>
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.associatedName || item.username}
            </Text>
            <Text style={styles.userUsername} numberOfLines={1}>
              @{item.username}
            </Text>

            <View style={styles.userTags}>
              <View style={[styles.tag, { backgroundColor: rc.bg }]}>
                <Text style={[styles.tagText, { color: rc.text }]}>
                  {getRoleLabel(item.role, t)}
                </Text>
              </View>
              <View style={styles.branchTag}>
                <Ionicons
                  name="location-outline"
                  size={10}
                  color={COLORS.slateMuted}
                />
                <Text style={styles.branchTagText} numberOfLines={1}>
                  {getBranchName(item, t)}
                </Text>
              </View>
            </View>

            {item.permissions && (
              <Text style={styles.permCountInline}>
                <Ionicons
                  name="shield-outline"
                  size={10}
                  color={COLORS.slateMuted}
                />{' '}
                {item.permissions.length > 0
                  ? t('userManagement.details.pagesCount', {
                      count: item.permissions.length,
                    })
                  : t('userManagement.details.noAccess')}
              </Text>
            )}
          </View>

          {/* Share actions */}
          <View style={styles.cardActions}>
            {canWhatsApp && (
              <TouchableOpacity
                style={[
                  styles.cardIconBtn,
                  { backgroundColor: COLORS.whatsappLight },
                  !phone && styles.cardIconBtnDisabled,
                ]}
                onPress={() => shareToWhatsApp(item)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons
                  name="logo-whatsapp"
                  size={16}
                  color={phone ? COLORS.whatsapp : COLORS.gray}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.cardIconBtn}
              onPress={() => shareCredentials(item)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name="share-outline"
                size={16}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {isSystemUser && (
          <View style={styles.autoCreatedRow}>
            <Ionicons
              name="information-circle-outline"
              size={12}
              color={COLORS.slateMuted}
            />
            <Text style={styles.autoCreatedInline}>
              {item.role === 'parent'
                ? t('userManagement.details.parentAccount')
                : t('userManagement.details.studentAccount')}{' '}
              — {t('userManagement.details.systemAccountSuffix')}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            {t('userManagement.headerTitle')}
          </Text>
          <Text style={styles.headerSubtitle}>
            {t('userManagement.headerSubtitle', {
              count: filteredUsers.length,
              total: users.length,
            })}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowWhatsAppSettings(true)}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={20}
              color={COLORS.slate}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons
              name="filter-outline"
              size={20}
              color={COLORS.slate}
            />
            {activeFilterCount > 0 && <View style={styles.filterDot} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addButton}
            onPress={handleOpenCreate}
          >
            <Ionicons name="person-add" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* BANNERS */}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={COLORS.red} />
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
          <TouchableOpacity onPress={() => setError('')}>
            <Ionicons name="close" size={16} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      ) : null}
      {success ? (
        <View style={styles.successBanner}>
          <Ionicons
            name="checkmark-circle"
            size={18}
            color={COLORS.primary}
          />
          <Text style={styles.successText} numberOfLines={2}>
            {success}
          </Text>
        </View>
      ) : null}

      {/* SEARCH */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('userManagement.searchPlaceholder')}
            placeholderTextColor="#A0AAA5"
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCapitalize="none"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons
                name="close-circle"
                size={18}
                color={COLORS.gray}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ACTIVE FILTERS */}
      {activeFilterCount > 0 && (
        <View style={styles.activeFiltersRow}>
          {roleFilter !== 'all' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {t(`userManagement.roles.${roleFilter}`)}
              </Text>
              <TouchableOpacity onPress={() => setRoleFilter('all')}>
                <Ionicons name="close" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
          {branchFilter !== 'all' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {branchFilter === 'school-admin'
                  ? t('userManagement.branch.schoolAdmins')
                  : availableBranches.find((b) => b._id === branchFilter)
                      ?.name || t('userManagement.filter.branch')}
              </Text>
              <TouchableOpacity onPress={() => setBranchFilter('all')}>
                <Ionicons name="close" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            onPress={() => {
              setRoleFilter('all');
              setBranchFilter('all');
            }}
          >
            <Text style={styles.clearFiltersText}>
              {t('userManagement.clearAll')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* LIST */}
      {loading && users.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('userManagement.loading')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item._id}
          renderItem={renderUser}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>
                {t('userManagement.noResultsTitle')}
              </Text>
              <Text style={styles.emptyText}>
                {searchTerm || activeFilterCount > 0
                  ? t('userManagement.noResultsFiltered')
                  : t('userManagement.noResultsEmpty')}
              </Text>
              {searchTerm || activeFilterCount > 0 ? (
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => {
                    setSearchTerm('');
                    setRoleFilter('all');
                    setBranchFilter('all');
                  }}
                >
                  <Text style={styles.emptyButtonText}>
                    {t('userManagement.clearFilters')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={handleOpenCreate}
                >
                  <Text style={styles.emptyButtonText}>
                    {t('userManagement.createUser')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* MODALS */}
      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        roleFilter={roleFilter}
        branchFilter={branchFilter}
        branches={availableBranches}
        onApply={(role, branch) => {
          setRoleFilter(role);
          setBranchFilter(branch);
        }}
      />

      <WhatsAppSettingsModal
        visible={showWhatsAppSettings}
        initialTemplate={whatsappTemplate}
        onClose={() => setShowWhatsAppSettings(false)}
        onSave={handleSaveWhatsAppTemplate}
      />

      <UserDetailsModal
        visible={showDetailsModal}
        user={selectedUser}
        showPassword={showPasswordInModal}
        onTogglePassword={() => setShowPasswordInModal((v) => !v)}
        onClose={() => setShowDetailsModal(false)}
        onShare={() => selectedUser && shareCredentials(selectedUser)}
        onWhatsApp={() => selectedUser && shareToWhatsApp(selectedUser)}
        onEdit={() => selectedUser && handleOpenEdit(selectedUser)}
        onDelete={() => selectedUser && handleDelete(selectedUser)}
      />

      <UserFormModal
        visible={showFormModal}
        isEditing={isEditing}
        initialUser={editingUser}
        availableBranches={availableBranches}
        currentUserRole={currentUser?.role as string | undefined}
        onClose={() => {
          setShowFormModal(false);
          setEditingUser(null);
          setIsEditing(false);
        }}
        onSubmit={handleSubmitForm}
      />
    </SafeAreaView>
  );
};

export default UserManagementScreen;

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  accessDeniedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  accessDeniedIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.redLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  accessDeniedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.slate,
  },
  accessDeniedText: {
    fontSize: 14,
    color: COLORS.slateMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.slate },
  headerSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.redLight,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F6C8C8',
  },
  errorText: { flex: 1, fontSize: 12, color: COLORS.red, fontWeight: '600' },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primaryLight,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFE9D4',
  },
  successText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },

  searchContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.slate,
  },

  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  activeFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  clearFiltersText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray,
    textDecorationLine: 'underline',
  },

  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.slateMuted,
    fontWeight: '600',
  },

  userCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.slate,
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 12,
    color: COLORS.slateMuted,
    fontWeight: '600',
    marginBottom: 6,
    fontFamily: Platform.select({
      ios: 'Courier',
      android: 'monospace',
    }),
  },
  userTags: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontSize: 10, fontWeight: '700' },
  branchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: '70%',
  },
  branchTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.slateMuted,
  },
  permCountInline: {
    fontSize: 10,
    color: COLORS.slateMuted,
    fontWeight: '600',
  },
  autoCreatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  autoCreatedInline: {
    fontSize: 10,
    color: COLORS.slateMuted,
    fontStyle: 'italic',
  },

  cardActions: {
    flexDirection: 'column',
    gap: 6,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardIconBtnDisabled: { opacity: 0.55 },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.slate,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.slateMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.slateMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { paddingHorizontal: 20 },

  modalProfile: { alignItems: 'center', paddingVertical: 20 },
  modalAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalAvatarText: { fontSize: 30, fontWeight: '800', color: '#fff' },
  modalName: { fontSize: 20, fontWeight: '800', color: COLORS.slate },
  modalEmail: { fontSize: 13, color: COLORS.slateMuted, marginTop: 4 },
  roleBadgeLg: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  roleBadgeLgText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: COLORS.slateMuted, fontWeight: '600' },
  infoValue: {
    fontSize: 14,
    color: COLORS.slate,
    fontWeight: '600',
    marginTop: 2,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtnSmall: { padding: 4 },

  permBlock: {
    marginTop: 16,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 14,
  },
  permBlockLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  permWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  permPill: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  permPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.slate,
  },

  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexWrap: 'wrap',
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    gap: 6,
    minWidth: 90,
  },
  actionBtnOutlineText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  actionBtnDanger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.red,
    gap: 6,
    minWidth: 90,
  },
  actionBtnDangerText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.red,
  },
  actionBtnWhatsApp: {
    flexBasis: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.whatsapp,
    gap: 6,
  },
  actionBtnWhatsAppText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  actionBtnGhost: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionBtnGhostText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate,
  },
  actionBtnPrimary: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    gap: 6,
  },
  actionBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },

  autoCreatedPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    minWidth: 90,
  },
  autoCreatedText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.slateMuted,
  },

  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  formInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.slate,
    backgroundColor: COLORS.white,
  },
  templateArea: {
    minHeight: 160,
    textAlignVertical: 'top',
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
    }),
    fontSize: 13,
    lineHeight: 19,
  },
  formHint: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 6,
    fontStyle: 'italic',
  },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  genBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  placeholderChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
  },
  placeholderChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
    }),
  },
  placeholderChipSub: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.slateMuted,
    marginTop: 2,
  },

  previewBox: {
    marginTop: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewText: {
    fontSize: 13,
    color: COLORS.slate,
    lineHeight: 19,
  },

  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 8,
    marginBottom: 10,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.slateMuted,
  },
  filterChipTextActive: { color: '#fff' },

  permHeaderRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  permHeaderActions: { flexDirection: 'row', gap: 12 },
  linkPrimary: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  linkDanger: { fontSize: 12, fontWeight: '700', color: COLORS.red },
  permGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 8,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  permTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: '47%',
  },
  permTileActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  permTileText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.slateMuted,
  },
  permTileTextActive: { color: COLORS.primary },
  permCountText: {
    fontSize: 11,
    color: COLORS.slateMuted,
    marginTop: 8,
    fontStyle: 'italic',
  },

  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  checkboxLabel: {
    fontSize: 13,
    color: COLORS.slate,
    fontWeight: '600',
  },

  successBox: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#BFE9D4',
  },
  successTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 12,
  },
  credRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  credLabel: {
    fontSize: 12,
    color: COLORS.slateMuted,
    fontWeight: '600',
  },
  credValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
    fontFamily: Platform.select({
      ios: 'Courier',
      android: 'monospace',
    }),
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  doneBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.redLight,
    borderWidth: 1,
    borderColor: '#F6C8C8',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    marginBottom: 12,
  },
  modalErrorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.red,
  },

  filterActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  filterResetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterResetBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate,
  },
  filterApplyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterApplyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
});
