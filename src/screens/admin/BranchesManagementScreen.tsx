// src/screens/admin/BranchesManagementScreen.tsx
import React, { useState, useMemo } from 'react';
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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
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
  create: '/branches',
};

// ============================================================
// TYPES
// ============================================================
interface BranchAddress {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

interface BranchContact {
  phone?: string;
  email?: string;
}

interface Branch {
  _id: string;
  name: string;
  code: string;
  address?: BranchAddress;
  contact?: BranchContact;
  status?: 'active' | 'inactive';
  isMainBranch?: boolean;
}

interface FormState {
  name: string;
  code: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  contact: {
    phone: string;
    email: string;
  };
}

// ============================================================
// HELPERS
// ============================================================
const getLocationLabel = (
  branch: Branch,
  fallback: string
): string => {
  const city = branch.address?.city;
  const state = branch.address?.state;
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return fallback;
};

// ============================================================
// MAIN SCREEN
// ============================================================
export const BranchesManagementScreen: React.FC = () => {
  const { t } = useTranslation();
  const { branches, refreshBranches } = useBranch();

  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<FormState>({
    name: '',
    code: '',
    address: { street: '', city: '', state: '', zipCode: '' },
    contact: { phone: '', email: '' },
  });

  const branchList: Branch[] = useMemo(() => {
    return Array.isArray(branches) ? (branches as Branch[]) : [];
  }, [branches]);

  const totalBranches = branchList.length;
  const activeBranches = branchList.filter((b) => b.status === 'active').length;
  const mainBranches = branchList.filter((b) => b.isMainBranch).length;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshBranches?.();
    } catch (e) {
      console.warn('Refresh branches failed', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    if (key.includes('.')) {
      const [parent, child] = key.split('.') as ['address' | 'contact', string];
      setFormData((prev) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [key]: value }));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      address: { street: '', city: '', state: '', zipCode: '' },
      contact: { phone: '', email: '' },
    });
    setError('');
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError(t('branches.validationName'));
      return;
    }
    if (!formData.code.trim()) {
      setError(t('branches.validationCode'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res: any = await apiClient.post(ENDPOINTS.create, {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        address: formData.address,
        contact: formData.contact,
      });

      void res;

      await refreshBranches?.();
      setShowForm(false);
      resetForm();
      Alert.alert(
        t('common.success') || 'Success',
        t('branches.branchCreatedMsg')
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        t('branches.branchCreateFailed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const renderBranch = ({ item }: { item: Branch }) => {
    const isActive = item.status === 'active';

    return (
      <View style={styles.branchCard}>
        <View style={styles.branchTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.branchName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.branchCode}>{item.code}</Text>
          </View>

          <View style={styles.branchBadges}>
            {item.isMainBranch && (
              <View style={styles.mainBadge}>
                <Text style={styles.mainBadgeText}>
                  {t('branches.mainBadge')}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isActive
                    ? COLORS.primaryLight
                    : COLORS.redLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: isActive ? COLORS.primary : COLORS.red },
                ]}
              >
                {isActive
                  ? t('branches.statusActive')
                  : t('branches.statusInactive')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.branchMetaBlock}>
          {item.contact?.phone ? (
            <View style={styles.metaRow}>
              <Ionicons name="call-outline" size={14} color={COLORS.gray} />
              <Text style={styles.metaText}>{item.contact.phone}</Text>
            </View>
          ) : null}

          {item.contact?.email ? (
            <View style={styles.metaRow}>
              <Ionicons name="mail-outline" size={14} color={COLORS.gray} />
              <Text style={styles.metaText} numberOfLines={1}>
                {item.contact.email}
              </Text>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.gray} />
            <Text
              style={[
                styles.metaText,
                !item.address?.city &&
                  !item.address?.state &&
                  styles.metaTextMuted,
              ]}
            >
              {getLocationLabel(item, t('branches.unspecifiedLocation'))}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            {t('branches.headerTitle')}
          </Text>
          <Text style={styles.headerSubtitle}>
            {t('branches.headerSubtitle')}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            <Ionicons name="add" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <View
            style={[styles.summaryIcon, { backgroundColor: COLORS.blueLight }]}
          >
            <Ionicons name="business" size={16} color={COLORS.blue} />
          </View>
          <Text style={styles.summaryValue}>{totalBranches}</Text>
          <Text style={styles.summaryLabel}>
            {t('branches.summaryTotal')}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <View
            style={[
              styles.summaryIcon,
              { backgroundColor: COLORS.primaryLight },
            ]}
          >
            <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
          </View>
          <Text style={styles.summaryValue}>{activeBranches}</Text>
          <Text style={styles.summaryLabel}>
            {t('branches.summaryActive')}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <View
            style={[
              styles.summaryIcon,
              { backgroundColor: COLORS.purpleLight },
            ]}
          >
            <Ionicons name="star" size={16} color={COLORS.purple} />
          </View>
          <Text style={styles.summaryValue}>{mainBranches}</Text>
          <Text style={styles.summaryLabel}>
            {t('branches.summaryMain')}
          </Text>
        </View>
      </View>

      {error && !showForm ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError('')}>
            <Ionicons name="close" size={16} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={branchList}
        keyExtractor={(item) => item._id}
        renderItem={renderBranch}
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
            <Ionicons name="business-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>
              {t('branches.noBranchesTitle')}
            </Text>
            <Text style={styles.emptyText}>
              {t('branches.noBranchesText')}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Text style={styles.emptyButtonText}>
                {t('branches.createFirstBranch')}
              </Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!loading) {
            setShowForm(false);
            resetForm();
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('branches.createBranchTitle')}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  if (!loading) {
                    setShowForm(false);
                    resetForm();
                  }
                }}
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
                  <Ionicons name="alert-circle" size={16} color={COLORS.red} />
                  <Text style={styles.modalErrorText}>{error}</Text>
                </View>
              ) : null}

              <Text style={styles.formLabel}>
                {t('branches.form.name')} *
              </Text>
              <TextInput
                style={styles.formInput}
                placeholder={t('branches.form.namePlaceholder')}
                placeholderTextColor="#A0AAA5"
                value={formData.name}
                onChangeText={(v) => handleChange('name', v)}
                editable={!loading}
              />

              <Text style={[styles.formLabel, { marginTop: 14 }]}>
                {t('branches.form.code')} *
              </Text>
              <TextInput
                style={[styles.formInput, { textTransform: 'uppercase' }]}
                placeholder={t('branches.form.codePlaceholder')}
                placeholderTextColor="#A0AAA5"
                value={formData.code}
                onChangeText={(v) => handleChange('code', v)}
                autoCapitalize="characters"
                editable={!loading}
              />
              <Text style={styles.formHint}>
                {t('branches.form.codeHint')}
              </Text>

              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>
                    {t('branches.form.phone')}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder={t('branches.form.phonePlaceholder')}
                    placeholderTextColor="#A0AAA5"
                    value={formData.contact.phone}
                    onChangeText={(v) => handleChange('contact.phone', v)}
                    keyboardType="phone-pad"
                    editable={!loading}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>
                    {t('branches.form.email')}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder={t('branches.form.emailPlaceholder')}
                    placeholderTextColor="#A0AAA5"
                    value={formData.contact.email}
                    onChangeText={(v) => handleChange('contact.email', v)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>
              </View>

              <Text style={[styles.formLabel, { marginTop: 14 }]}>
                {t('branches.form.street')}
              </Text>
              <TextInput
                style={styles.formInput}
                placeholder={t('branches.form.streetPlaceholder')}
                placeholderTextColor="#A0AAA5"
                value={formData.address.street}
                onChangeText={(v) => handleChange('address.street', v)}
                editable={!loading}
              />

              <View style={[styles.twoCol, { marginTop: 14 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>
                    {t('branches.form.city')}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder={t('branches.form.cityPlaceholder')}
                    placeholderTextColor="#A0AAA5"
                    value={formData.address.city}
                    onChangeText={(v) => handleChange('address.city', v)}
                    editable={!loading}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>
                    {t('branches.form.state')}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder={t('branches.form.statePlaceholder')}
                    placeholderTextColor="#A0AAA5"
                    value={formData.address.state}
                    onChangeText={(v) => handleChange('address.state', v)}
                    editable={!loading}
                  />
                </View>
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  if (!loading) {
                    setShowForm(false);
                    resetForm();
                  }
                }}
                disabled={loading}
              >
                <Text style={styles.cancelBtnText}>
                  {t('branches.form.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.submitBtnText}>
                      {t('branches.form.createBranch')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default BranchesManagementScreen;

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

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

  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'flex-start',
  },
  summaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  summaryValue: { fontSize: 16, fontWeight: '800', color: COLORS.slate },
  summaryLabel: { fontSize: 10, color: COLORS.slateMuted, fontWeight: '600' },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: COLORS.redLight,
    borderWidth: 1,
    borderColor: '#F6C8C8',
    borderRadius: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.red,
  },

  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },

  branchCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  branchTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  branchName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.slate,
  },
  branchCode: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.slateMuted,
    marginTop: 2,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
  },
  branchBadges: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  mainBadge: {
    backgroundColor: COLORS.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  mainBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.blue,
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: { fontSize: 10, fontWeight: '700' },

  branchMetaBlock: { gap: 6 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.slate,
    fontWeight: '500',
    flex: 1,
  },
  metaTextMuted: {
    color: COLORS.gray,
    fontStyle: 'italic',
    fontWeight: '400',
  },

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
  emptyButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },

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
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { paddingHorizontal: 20, paddingTop: 16 },

  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
    marginBottom: 6,
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
  formHint: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 4,
    fontStyle: 'italic',
  },
  twoCol: { flexDirection: 'row', gap: 10 },

  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.redLight,
    borderWidth: 1,
    borderColor: '#F6C8C8',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  modalErrorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.red,
  },

  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});