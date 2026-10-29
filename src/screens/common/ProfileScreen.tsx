// src/screens/profile/ProfileScreen.tsx

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { authService } from '../../api/services/authService';
import {
  changeLanguage,
  getCurrentLanguage,
  SUPPORTED_LANGUAGES,
  LANGUAGE_BY_CODE,
  SupportedLanguage,
} from '../../i18n';

// ============================================================
// BRAND
// ============================================================
const COLORS = {
  primary: '#0A8E5A',
  primaryDark: '#063D2C',
  primaryLight: '#E9F8F0',
  gold: '#C9A227',
  goldLight: '#FFF7DF',
  blue: '#2878D0',
  blueLight: '#EAF3FF',
  red: '#DC2626',
  redLight: '#FEE9E9',
  white: '#FFFFFF',
  slate: '#18392D',
  slateMuted: '#718079',
  border: '#E4EBE7',
  background: '#F7FAF8',
  gray: '#8A9891',
};

// ============================================================
// HELPERS
// ============================================================
const initialsOf = (first?: string, last?: string, username?: string) => {
  const f = (first || '').trim();
  const l = (last || '').trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  if (f) return f.substring(0, 2).toUpperCase();
  if (username) return username.substring(0, 2).toUpperCase();
  return 'U';
};

// ============================================================
// ROLE HELPERS — normalize any role shape into a safe string
// ============================================================
const ADMIN_ROLES = [
  'admin',
  'super_admin',
  'superadmin',
  'school_admin',
  'schooladmin',
  'owner',
  'principal',
  'manager',
];

/** Turn any role value (string, object, array) into a lowercase slug. */
const normalizeRole = (role: any): string => {
  if (!role) return '';

  // Array of roles → use the first one (or the highest-priority one)
  if (Array.isArray(role)) {
    const flat = role
      .map((r) => normalizeRole(r))
      .filter(Boolean);
    if (flat.length === 0) return '';
    // Prefer admin-ish roles if any present
    const admin = flat.find((r) => ADMIN_ROLES.includes(r));
    return admin || flat[0];
  }

  // Object with a `name`, `slug`, `code`, `key`, or `role` field
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

  // Primitive (string / number)
  return String(role).trim().toLowerCase().replace(/\s+/g, '_');
};

/** Human-readable label for any role shape. */
const displayRole = (role: any): string => {
  const s = normalizeRole(role);
  if (!s) return '';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

/** True if the role matches one of the admin-ish buckets. */
const isAdminRole = (role: any): boolean => {
  const s = normalizeRole(role);
  if (!s) return false;
  return ADMIN_ROLES.includes(s);
};

// ============================================================
// SCREEN
// ============================================================
export const ProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout, updateUser } = useAuth();
  const {
    branches,
    currentBranch,
    switchBranch,
    isLoading: branchesLoading,
  } = useBranch();

  const [refreshing, setRefreshing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  const [pwdModalVisible, setPwdModalVisible] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Language
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(getCurrentLanguage());

  // Branch switcher
  const [branchModalVisible, setBranchModalVisible] = useState(false);

  // ============================================================
  // RBAC — Only admin / school_admin see branch switcher
  // ============================================================
  const roleSlug = useMemo(() => normalizeRole((user as any)?.role), [user]);
  const isAdmin = isAdminRole((user as any)?.role);
  const hasAssignedBranch = !!(user as any)?.branchId;

  const canSwitchBranches = isAdmin && !hasAssignedBranch;

  // Compose the list — real branches + virtual "All Branches"
  const branchOptions = useMemo(() => {
    const list = Array.isArray(branches) ? [...branches] : [];
    const allOption = {
      _id: 'all-branches',
      name: t('branches.switcher.allBranches'),
      code: 'ALL',
      isAllBranches: true,
    };
    return [allOption, ...list];
  }, [branches, t]);

  const currentBranchLabel = currentBranch
    ? (currentBranch as any).isAllBranches
      ? t('branches.switcher.allBranches')
      : (currentBranch as any).name
    : t('branches.switcher.noBranches');

  // ============================================================
  // Pull to refresh
  // ============================================================
  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const fresh = await authService.getProfile();
      if (fresh && updateUser) {
        await updateUser(fresh as any);
      }
    } catch (e) {
      // Silent
    } finally {
      setRefreshing(false);
    }
  }, [updateUser]);

  // ============================================================
  // Photo upload
  // ============================================================
  const pickAndUploadPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('photo.permissionTitle'), t('photo.permissionMsg'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      const uri = result.assets[0].uri;
      setUploadingPhoto(true);

      await authService.uploadProfilePhoto(uri);

      const fresh = await authService.getProfile();
      if (fresh && updateUser) await updateUser(fresh as any);

      Alert.alert(t('photo.successTitle'), t('photo.successMsg'));
    } catch (err: any) {
      Alert.alert(t('photo.failTitle'), err?.message || t('photo.failMsg'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ============================================================
  // Change password
  // ============================================================
  const resetPwdForm = () => {
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  };

  const submitPasswordChange = async () => {
    if (!currentPwd.trim() || !newPwd.trim() || !confirmPwd.trim()) {
      Alert.alert(t('password.missingFieldsTitle'), t('password.missingFieldsMsg'));
      return;
    }
    if (newPwd.length < 6) {
      Alert.alert(t('password.weakTitle'), t('password.weakMsg'));
      return;
    }
    if (newPwd !== confirmPwd) {
      Alert.alert(t('password.mismatchTitle'), t('password.mismatchMsg'));
      return;
    }
    if (newPwd === currentPwd) {
      Alert.alert(t('password.noChangeTitle'), t('password.noChangeMsg'));
      return;
    }

    try {
      setChangingPwd(true);
      await authService.changePassword(currentPwd.trim(), newPwd.trim());
      setPwdModalVisible(false);
      resetPwdForm();
      Alert.alert(t('password.successTitle'), t('password.successMsg'));
    } catch (err: any) {
      Alert.alert(t('password.failTitle'), err?.message || t('password.failMsg'));
    } finally {
      setChangingPwd(false);
    }
  };

  // ============================================================
  // Change language
  // ============================================================
  const handleLanguageSelect = async (code: SupportedLanguage) => {
    if (code === currentLang) {
      setLangModalVisible(false);
      return;
    }
    try {
      const { needsRestart } = await changeLanguage(code);
      setCurrentLang(code);
      setLangModalVisible(false);

      if (needsRestart) {
        Alert.alert(t('language.restartTitle'), t('language.restartMsg'), [
          { text: t('common.ok') },
        ]);
      } else {
        Alert.alert(t('language.changedTitle'), t('language.changedMsg'));
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not change language.');
    }
  };

  // ============================================================
  // Change branch
  // ============================================================
  const handleBranchSelect = async (branchId: string) => {
    try {
      if (currentBranch && (currentBranch as any)._id === branchId) {
        setBranchModalVisible(false);
        return;
      }
      await switchBranch(branchId);
      setBranchModalVisible(false);
      Alert.alert(
        t('branches.switcher.modalTitle'),
        t('branches.switcher.rowLabel') + ' ✓'
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not switch branch.');
    }
  };

  // ============================================================
  // Sign out
  // ============================================================
  const confirmLogout = () => {
    Alert.alert(
      t('profile.signOutConfirmTitle'),
      t('profile.signOutConfirmMsg'),
      [
        { text: t('profile.cancel'), style: 'cancel' },
        {
          text: t('profile.signOut'),
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (e) {}
          },
        },
      ],
    );
  };

  // ============================================================
  // Not logged in
  // ============================================================
  if (!user) {
    return (
      <View style={styles.notLoggedInContainer}>
        <Ionicons name="person-circle-outline" size={48} color={COLORS.gray} />
        <Text style={styles.notLoggedInText}>{t('profile.notLoggedIn')}</Text>
      </View>
    );
  }

  // ============================================================
  // Render
  // ============================================================
  const fullName =
    `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;

  const currentLangObj = LANGUAGE_BY_CODE[currentLang];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.avatarContainer}
            activeOpacity={0.85}
            onPress={pickAndUploadPhoto}
            disabled={uploadingPhoto}
          >
            {user.profilePhoto ? (
              <Image
                source={{
                  uri: user.profilePhoto.startsWith('http')
                    ? user.profilePhoto
                    : `http://10.30.101.81:7000${user.profilePhoto}`,
                }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>
                {initialsOf(user.firstName, user.lastName, user.username)}
              </Text>
            )}

            <View style={styles.avatarBadge}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Ionicons name="camera" size={14} color={COLORS.white} />
              )}
            </View>
          </TouchableOpacity>

          <Text style={styles.userName}>{fullName}</Text>
          {(() => {
            const label = displayRole((user as any)?.role);
            if (!label) return null;
            return (
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>{label}</Text>
              </View>
            );
          })()}
          {!!user.email && <Text style={styles.userEmail}>{user.email}</Text>}
        </View>

        {/* ACCOUNT INFO */}
        <Text style={styles.sectionLabel}>{t('profile.accountInfo')}</Text>
        <View style={styles.infoCard}>
          <InfoRow icon="person-outline" label={t('profile.username')} value={user.username} />
          <InfoRow
            icon="mail-outline"
            label={t('profile.email')}
            value={user.email || t('profile.notSet')}
          />
          <InfoRow
            icon="call-outline"
            label={t('profile.phone')}
            value={user.phone || t('profile.notSet')}
          />
          <InfoRow
            icon="calendar-outline"
            label={t('profile.joined')}
            value={
              user.createdAt
                ? new Date(user.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : t('profile.na')
            }
            isLast
          />
        </View>

        {/* ============================================================
            BRANCH SWITCHER — ADMIN ONLY
            ============================================================ */}
        {canSwitchBranches && (
          <>
            <Text style={styles.sectionLabel}>
              {t('branches.switcher.sectionLabel')}
            </Text>
            <ActionRow
              icon="git-branch-outline"
              iconColor={COLORS.blue}
              iconBg={COLORS.blueLight}
              label={t('branches.switcher.rowLabel')}
              sublabel={currentBranchLabel}
              onPress={() => setBranchModalVisible(true)}
              disabled={branchesLoading}
            />
          </>
        )}

        {/* LANGUAGE */}
        <Text style={styles.sectionLabel}>{t('language.section')}</Text>
        <ActionRow
          icon="language-outline"
          iconColor={COLORS.gold}
          iconBg={COLORS.goldLight}
          label={t('language.title')}
          sublabel={currentLangObj?.nativeLabel || currentLangObj?.label}
          onPress={() => setLangModalVisible(true)}
        />

        {/* SECURITY & PROFILE */}
        <Text style={styles.sectionLabel}>{t('profile.securityProfile')}</Text>

        <ActionRow
          icon="key-outline"
          iconColor={COLORS.primary}
          iconBg={COLORS.primaryLight}
          label={t('profile.changePassword')}
          sublabel={t('profile.changePasswordSub')}
          onPress={() => setPwdModalVisible(true)}
        />

        <ActionRow
          icon="image-outline"
          iconColor={COLORS.blue}
          iconBg={COLORS.blueLight}
          label={t('profile.updatePhoto')}
          sublabel={uploadingPhoto ? t('profile.uploading') : t('profile.updatePhotoSub')}
          onPress={pickAndUploadPhoto}
          disabled={uploadingPhoto}
        />

        {/* SIGN OUT */}
        <TouchableOpacity
          style={styles.signOutButton}
          activeOpacity={0.85}
          onPress={confirmLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.red} />
          <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ============================================================
          BRANCH SWITCHER MODAL
          ============================================================ */}
      <Modal
        visible={branchModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBranchModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalGrabber} />

            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {t('branches.switcher.modalTitle')}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {t('branches.switcher.modalSubtitle')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setBranchModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={COLORS.slateMuted} />
              </TouchableOpacity>
            </View>

            {branchesLoading ? (
              <View style={styles.branchLoadingWrap}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.branchLoadingText}>
                  {t('branches.switcher.loading')}
                </Text>
              </View>
            ) : branchOptions.length === 0 ? (
              <View style={styles.branchLoadingWrap}>
                <Ionicons name="business-outline" size={32} color={COLORS.gray} />
                <Text style={styles.branchLoadingText}>
                  {t('branches.switcher.noBranches')}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: 420 }}
                showsVerticalScrollIndicator={false}
              >
                {branchOptions.map((b: any) => {
                  const isActive =
                    (currentBranch as any)?._id === b._id;
                  const isAll = !!b.isAllBranches;
                  const isMain = !!b.isMainBranch;

                  return (
                    <TouchableOpacity
                      key={b._id}
                      style={[styles.branchRow, isActive && styles.branchRowActive]}
                      activeOpacity={0.85}
                      onPress={() => handleBranchSelect(b._id)}
                    >
                      <View
                        style={[
                          styles.branchIconWrap,
                          isActive && styles.branchIconWrapActive,
                        ]}
                      >
                        <Ionicons
                          name={
                            isAll
                              ? 'globe-outline'
                              : isMain
                              ? 'star-outline'
                              : 'business-outline'
                          }
                          size={20}
                          color={isActive ? COLORS.primary : COLORS.gray}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.branchLabelRow}>
                          <Text
                            style={[
                              styles.branchLabel,
                              isActive && styles.branchLabelActive,
                            ]}
                            numberOfLines={1}
                          >
                            {b.name}
                          </Text>
                          {isMain && (
                            <View style={styles.branchMainTag}>
                              <Text style={styles.branchMainTagText}>MAIN</Text>
                            </View>
                          )}
                        </View>
                        {!!b.code && !isAll && (
                          <Text style={styles.branchSub} numberOfLines={1}>
                            {b.code}
                          </Text>
                        )}
                      </View>
                      {isActive ? (
                        <View style={styles.currentPill}>
                          <Text style={styles.currentPillText}>
                            {t('branches.switcher.current')}
                          </Text>
                        </View>
                      ) : (
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={COLORS.gray}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.modalCancelBtn}
              activeOpacity={0.85}
              onPress={() => setBranchModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>
                {t('branches.switcher.cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================================
          LANGUAGE MODAL
          ============================================================ */}
      <Modal
        visible={langModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setLangModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalGrabber} />

            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{t('language.title')}</Text>
                <Text style={styles.modalSubtitle}>{t('language.subtitle')}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setLangModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={COLORS.slateMuted} />
              </TouchableOpacity>
            </View>

            {SUPPORTED_LANGUAGES.map((lang) => {
              const isActive = currentLang === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langRow, isActive && styles.langRowActive]}
                  activeOpacity={0.85}
                  onPress={() => handleLanguageSelect(lang.code)}
                >
                  <View style={[styles.langIconWrap, isActive && styles.langIconWrapActive]}>
                    <Ionicons
                      name={isActive ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={isActive ? COLORS.primary : COLORS.gray}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.langLabel, isActive && styles.langLabelActive]}>
                      {lang.nativeLabel}
                    </Text>
                    <Text style={styles.langSub}>{lang.label}</Text>
                  </View>
                  {isActive && (
                    <View style={styles.currentPill}>
                      <Text style={styles.currentPillText}>{t('language.current')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.modalCancelBtn}
              activeOpacity={0.85}
              onPress={() => setLangModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>{t('profile.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================================
          CHANGE PASSWORD MODAL
          ============================================================ */}
      <Modal
        visible={pwdModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!changingPwd) {
            setPwdModalVisible(false);
            resetPwdForm();
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalGrabber} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('password.modalTitle')}</Text>
              <TouchableOpacity
                onPress={() => {
                  if (!changingPwd) {
                    setPwdModalVisible(false);
                    resetPwdForm();
                  }
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={COLORS.slateMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>{t('password.modalSub')}</Text>

            <PasswordField
              label={t('password.current')}
              value={currentPwd}
              onChangeText={setCurrentPwd}
              visible={showCurrent}
              toggle={() => setShowCurrent((v) => !v)}
              editable={!changingPwd}
            />

            <PasswordField
              label={t('password.new')}
              value={newPwd}
              onChangeText={setNewPwd}
              visible={showNew}
              toggle={() => setShowNew((v) => !v)}
              editable={!changingPwd}
            />

            <PasswordField
              label={t('password.confirm')}
              value={confirmPwd}
              onChangeText={setConfirmPwd}
              visible={showConfirm}
              toggle={() => setShowConfirm((v) => !v)}
              editable={!changingPwd}
            />

            {newPwd.length > 0 && (
              <View style={styles.pwdHintRow}>
                <View
                  style={[
                    styles.pwdHintDot,
                    {
                      backgroundColor:
                        newPwd.length >= 8
                          ? COLORS.primary
                          : newPwd.length >= 6
                          ? COLORS.gold
                          : COLORS.red,
                    },
                  ]}
                />
                <Text style={styles.pwdHintText}>
                  {newPwd.length >= 8
                    ? t('password.strengthStrong')
                    : newPwd.length >= 6
                    ? t('password.strengthOk')
                    : t('password.strengthWeak')}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.modalSubmit, changingPwd && styles.modalSubmitDisabled]}
              activeOpacity={0.85}
              onPress={submitPasswordChange}
              disabled={changingPwd}
            >
              {changingPwd ? (
                <View style={styles.modalSubmitInner}>
                  <ActivityIndicator size="small" color={COLORS.white} />
                  <Text style={styles.modalSubmitText}>{t('password.updating')}</Text>
                </View>
              ) : (
                <Text style={styles.modalSubmitText}>{t('password.update')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

// ============================================================
// SUB-COMPONENTS
// ============================================================
interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
}
const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value, isLast }) => (
  <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
    <View style={styles.infoIconWrap}>
      <Ionicons name={icon} size={16} color={COLORS.slateMuted} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  </View>
);

interface ActionRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  disabled?: boolean;
}
const ActionRow: React.FC<ActionRowProps> = ({
  icon,
  iconColor,
  iconBg,
  label,
  sublabel,
  onPress,
  disabled,
}) => (
  <TouchableOpacity
    style={[styles.actionRow, disabled && { opacity: 0.6 }]}
    activeOpacity={0.85}
    onPress={onPress}
    disabled={disabled}
  >
    <View style={[styles.actionIconWrap, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.actionLabel}>{label}</Text>
      {!!sublabel && (
        <Text style={styles.actionSublabel} numberOfLines={1}>
          {sublabel}
        </Text>
      )}
    </View>
    <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
  </TouchableOpacity>
);

interface PasswordFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  visible: boolean;
  toggle: () => void;
  editable?: boolean;
}
const PasswordField: React.FC<PasswordFieldProps> = ({
  label,
  value,
  onChangeText,
  visible,
  toggle,
  editable = true,
}) => (
  <View style={styles.pwdFieldGroup}>
    <Text style={styles.pwdFieldLabel}>{label}</Text>
    <View style={styles.pwdFieldWrapper}>
      <Ionicons name="lock-closed-outline" size={18} color={COLORS.gray} />
      <TextInput
        style={styles.pwdInput}
        value={value}
        onChangeText={onChangeText}
        placeholder="••••••••"
        placeholderTextColor={COLORS.gray}
        secureTextEntry={!visible}
        editable={editable}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity
        onPress={toggle}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name={visible ? 'eye-outline' : 'eye-off-outline'}
          size={18}
          color={COLORS.gray}
        />
      </TouchableOpacity>
    </View>
  </View>
);

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  notLoggedInContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  notLoggedInText: { color: COLORS.gray, fontSize: 14 },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },

  header: { alignItems: 'center', marginBottom: 26 },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    position: 'relative',
    overflow: 'visible',
  },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarText: { color: COLORS.primary, fontSize: 32, fontWeight: '800' },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.background,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.slate,
    letterSpacing: -0.3,
  },
  rolePill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 20,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.4,
  },
  userEmail: { color: COLORS.slateMuted, fontSize: 12, marginTop: 6 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slateMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 8,
  },

  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F4F7F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: COLORS.slateMuted,
    letterSpacing: 0.3,
  },
  infoValue: { fontSize: 13.5, color: COLORS.slate, fontWeight: '600', marginTop: 2 },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionLabel: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  actionSublabel: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },

  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 12,
    backgroundColor: COLORS.redLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F6C8C8',
  },
  signOutText: { color: COLORS.red, fontSize: 14, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 61, 44, 0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 28,
  },
  modalGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D9D4',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  modalSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginBottom: 18, marginTop: 2 },

  // Language rows
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    marginBottom: 10,
  },
  langRowActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  langIconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langIconWrapActive: {},
  langLabel: { fontSize: 15, fontWeight: '700', color: COLORS.slate },
  langLabelActive: { color: COLORS.primary },
  langSub: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  currentPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  currentPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  modalCancelBtn: {
    marginTop: 4,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: COLORS.slateMuted },

  // Branch rows
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    marginBottom: 10,
  },
  branchRowActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  branchIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F4F7F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchIconWrapActive: {
    backgroundColor: COLORS.white,
  },
  branchLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  branchLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.slate,
    flexShrink: 1,
  },
  branchLabelActive: { color: COLORS.primary },
  branchSub: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  branchMainTag: {
    backgroundColor: COLORS.blueLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  branchMainTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.blue,
    letterSpacing: 0.5,
  },
  branchLoadingWrap: {
    paddingVertical: 30,
    alignItems: 'center',
    gap: 8,
  },
  branchLoadingText: {
    fontSize: 12,
    color: COLORS.slateMuted,
    fontWeight: '600',
  },

  // Password fields
  pwdFieldGroup: { marginBottom: 14 },
  pwdFieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.slateMuted,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  pwdFieldWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F7FAF8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  pwdInput: { flex: 1, fontSize: 14.5, color: COLORS.slate, paddingVertical: 10 },

  pwdHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    marginTop: -4,
  },
  pwdHintDot: { width: 6, height: 6, borderRadius: 3 },
  pwdHintText: { fontSize: 11, color: COLORS.slateMuted, fontWeight: '500' },

  modalSubmit: {
    marginTop: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitDisabled: { backgroundColor: '#7FC5A6' },
  modalSubmitInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalSubmitText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default ProfileScreen;

// onPress: async () => {