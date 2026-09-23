import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api as apiClient } from '../../api/client';
import { useBranch } from '../../context/BranchContext';

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
  white: '#FFFFFF',
  slate: '#18392D',
  slateMuted: '#718079',
  border: '#E4EBE7',
  background: '#F7FAF8',
  gray: '#8A9891',
};

// ============================================================
// TYPES
// ============================================================
type EmployeeStatus = 'Active' | 'On Leave' | 'Inactive';

interface Employee {
  _id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  hireDate: string;
  salary: number;
  status: EmployeeStatus;
  residence: string;
  emergencyContact: string;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  position: string;
  hireDate: string;
  salary: string;
  status: EmployeeStatus;
  residence: string;
  emergencyContact: string;
}

const STATUSES: EmployeeStatus[] = ['Active', 'On Leave', 'Inactive'];

const getEmptyForm = (): FormState => ({
  name: '',
  email: '',
  phone: '',
  position: '',
  hireDate: new Date().toISOString().split('T')[0],
  salary: '',
  status: 'Active',
  residence: '',
  emergencyContact: '',
});

// ============================================================
// HELPERS
// ============================================================
const getInitials = (name: string) => {
  const parts = (name || '').trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || '').substring(0, 2).toUpperCase();
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'Active':
      return { bg: COLORS.primaryLight, text: COLORS.primary };
    case 'On Leave':
      return { bg: COLORS.amberLight, text: COLORS.amber };
    case 'Inactive':
      return { bg: '#F1F5F9', text: COLORS.gray };
    default:
      return { bg: '#F1F5F9', text: COLORS.gray };
  }
};

const formatMoney = (n?: number) => `$${(Number(n) || 0).toLocaleString()}`;

// ============================================================
// INFO ROW
// ============================================================
const InfoRow: React.FC<{
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = ({ label, value, icon }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIcon}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  </View>
);

// ============================================================
// MAIN SCREEN
// ============================================================
export const EmployeesManagementScreen: React.FC = () => {
  const { t } = useTranslation();
  const { currentBranch } = useBranch();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'All' | EmployeeStatus>('All');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const employeesPerPage = 10;

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormState>(getEmptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Debounce
  useEffect(() => {
    const tmr = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(tmr);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedStatus]);

  // ============================================================
  // FETCH
  // ============================================================
  const fetchEmployees = useCallback(async () => {
    setError('');
    try {
      const params: Record<string, any> = {
        page: currentPage,
        limit: employeesPerPage,
      };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res: any = await apiClient.get('/employees', params);
      const list = Array.isArray(res?.employees) ? res.employees : [];
      setEmployees(list);
      const total = Number(res?.totalEmployees) || list.length;
      setTotalPages(Math.max(1, Math.ceil(total / employeesPerPage)));
    } catch (err: any) {
      console.error('Fetch employees error:', err);
      setError(err?.message || 'Failed to load employees.');
      setEmployees([]);
    }
  }, [currentPage, debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchEmployees();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchEmployees]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEmployees();
    setRefreshing(false);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('All');
    setCurrentPage(1);
  };

  const hasActiveFilters = !!searchTerm || selectedStatus !== 'All';

  const visibleEmployees = useMemo(() => {
    if (selectedStatus === 'All') return employees;
    return employees.filter((e) => e.status === selectedStatus);
  }, [employees, selectedStatus]);

  const stats = useMemo(() => {
    const activeCount = employees.filter((e) => e.status === 'Active').length;
    const payroll = employees
      .filter((e) => e.status === 'Active')
      .reduce((sum, e) => sum + (Number(e.salary) || 0), 0);
    return { activeCount, payroll, total: employees.length };
  }, [employees]);

  // ============================================================
  // FORM
  // ============================================================
  const openAddForm = () => {
    setIsEditing(false);
    setFormData(getEmptyForm());
    setFormError('');
    setFormModalVisible(true);
  };

  const openEditForm = (emp: Employee) => {
    setIsEditing(true);
    setFormData({
      name: emp.name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      position: emp.position || '',
      hireDate: emp.hireDate
        ? emp.hireDate.split('T')[0]
        : new Date().toISOString().split('T')[0],
      salary: emp.salary != null ? String(emp.salary) : '',
      status: emp.status || 'Active',
      residence: emp.residence || '',
      emergencyContact: emp.emergencyContact || '',
    });
    setFormError('');
    setViewModalVisible(false);
    setFormModalVisible(true);
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return t('employees.validation.nameRequired');
    if (!formData.email.trim()) return t('employees.validation.emailRequired');
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(formData.email.trim())) return t('employees.validation.emailInvalid');
    if (!formData.phone.trim()) return t('employees.validation.phoneRequired');
    if (!formData.position.trim()) return t('employees.validation.positionRequired');
    return null;
  };

  const handleSave = async () => {
    if (!currentBranch?._id) {
      setFormError(t('employees.branchRequired'));
      return;
    }
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const payload: Record<string, any> = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        position: formData.position.trim(),
        hireDate: formData.hireDate,
        salary: formData.salary ? Number(formData.salary) : 0,
        status: formData.status,
        residence: formData.residence.trim(),
        emergencyContact: formData.emergencyContact.trim(),
        branchId: currentBranch._id,
      };

      if (isEditing && selectedEmployee) {
        await apiClient.put(`/employees/${selectedEmployee._id}`, payload);
      } else {
        await apiClient.post('/employees', payload);
      }

      setFormModalVisible(false);
      setSelectedEmployee(null);
      await fetchEmployees();
      Alert.alert(
        t('employees.successTitle'),
        isEditing ? t('employees.updatedMsg') : t('employees.createdMsg'),
      );
    } catch (err: any) {
      console.error('Save employee error:', err);
      setFormError(
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to save employee.'
      );
    } finally {
      setSaving(false);
    }
  };

  const openViewModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setViewModalVisible(true);
  };

  const handleDelete = (emp: Employee) => {
    Alert.alert(
      t('employees.deleteTitle'),
      t('employees.deleteMsg', { name: emp.name }),
      [
        { text: t('employees.cancel'), style: 'cancel' },
        {
          text: t('employees.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/employees/${emp._id}`);
              setViewModalVisible(false);
              await fetchEmployees();
              Alert.alert(t('employees.deletedTitle'), t('employees.deletedMsg'));
            } catch (err: any) {
              Alert.alert(
                t('employees.errorTitle'),
                err?.message || 'Failed to delete employee.'
              );
            }
          },
        },
      ]
    );
  };

  // ============================================================
  // RENDER EMPLOYEE
  // ============================================================
  const renderEmployee = ({ item }: { item: Employee }) => {
    const statusStyle = getStatusStyle(item.status);
    return (
      <TouchableOpacity
        style={styles.employeeCard}
        activeOpacity={0.7}
        onPress={() => openViewModal(item)}
      >
        <View style={styles.employeeRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
          </View>

          <View style={styles.employeeInfo}>
            <Text style={styles.employeeName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.employeePosition} numberOfLines={1}>
              {item.position || '—'}
            </Text>
            <View style={styles.employeeMeta}>
              <Ionicons name="mail-outline" size={11} color={COLORS.slateMuted} />
              <Text style={styles.employeeMetaText} numberOfLines={1}>
                {item.email}
              </Text>
            </View>
          </View>

          <View style={styles.employeeRight}>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {item.status}
              </Text>
            </View>
            <Text style={styles.salaryText}>${item.salary ?? 0}</Text>
            <Ionicons name="chevron-forward" size={14} color="#B7C3BD" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('employees.headerTitle')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('employees.headerSubtitle', {
              count: visibleEmployees.length,
              total: stats.total,
            })}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setFilterModalVisible(true)}
          >
            <Ionicons name="filter-outline" size={20} color={COLORS.slate} />
            {selectedStatus !== 'All' && <View style={styles.filterDot} />}
          </TouchableOpacity>

          <TouchableOpacity style={styles.addButton} onPress={openAddForm}>
            <Ionicons name="add" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: COLORS.blueLight }]}>
            <Ionicons name="briefcase" size={16} color={COLORS.blue} />
          </View>
          <Text style={styles.summaryValue}>{stats.total}</Text>
          <Text style={styles.summaryLabel}>{t('employees.summary.total')}</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: COLORS.primaryLight }]}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
          </View>
          <Text style={styles.summaryValue}>{stats.activeCount}</Text>
          <Text style={styles.summaryLabel}>{t('employees.summary.active')}</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: COLORS.purpleLight }]}>
            <Ionicons name="wallet" size={16} color={COLORS.purple} />
          </View>
          <Text style={styles.summaryValue}>{formatMoney(stats.payroll)}</Text>
          <Text style={styles.summaryLabel}>{t('employees.summary.payroll')}</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('employees.searchPlaceholder')}
            placeholderTextColor="#A0AAA5"
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCapitalize="none"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.gray} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {selectedStatus !== 'All' && (
        <View style={styles.activeFiltersRow}>
          <View style={styles.activeFilter}>
            <Text style={styles.activeFilterText}>{selectedStatus}</Text>
            <TouchableOpacity onPress={() => setSelectedStatus('All')}>
              <Ionicons name="close" size={14} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearFiltersText}>{t('employees.clearAll')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError('')}>
            <Ionicons name="close" size={16} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && employees.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('employees.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={visibleEmployees}
          keyExtractor={(item) => item._id}
          renderItem={renderEmployee}
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
              <Ionicons name="briefcase-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>{t('employees.noResultsTitle')}</Text>
              <Text style={styles.emptyText}>
                {hasActiveFilters
                  ? t('employees.noResultsFiltered')
                  : t('employees.noResultsEmpty')}
              </Text>
              {hasActiveFilters ? (
                <TouchableOpacity style={styles.emptyButton} onPress={clearFilters}>
                  <Text style={styles.emptyButtonText}>
                    {t('employees.clearFilters')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.emptyButton} onPress={openAddForm}>
                  <Text style={styles.emptyButtonText}>
                    {t('employees.addEmployee')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[
                    styles.paginationBtn,
                    currentPage === 1 && styles.paginationBtnDisabled,
                  ]}
                  disabled={currentPage === 1}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={currentPage === 1 ? COLORS.gray : COLORS.slate}
                  />
                </TouchableOpacity>
                <Text style={styles.paginationText}>
                  {t('employees.pageOf', { page: currentPage, total: totalPages })}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.paginationBtn,
                    currentPage === totalPages && styles.paginationBtnDisabled,
                  ]}
                  disabled={currentPage === totalPages}
                  onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={currentPage === totalPages ? COLORS.gray : COLORS.slate}
                  />
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}

      {/* VIEW MODAL */}
      <Modal
        visible={viewModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('employees.details')}</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setViewModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            {selectedEmployee && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.modalProfile}>
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>
                      {getInitials(selectedEmployee.name)}
                    </Text>
                  </View>
                  <Text style={styles.modalName}>{selectedEmployee.name}</Text>
                  <Text style={styles.modalPosition}>
                    {selectedEmployee.position || '—'}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: getStatusStyle(selectedEmployee.status).bg,
                        marginTop: 10,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusStyle(selectedEmployee.status).text },
                      ]}
                    >
                      {selectedEmployee.status}
                    </Text>
                  </View>
                </View>

                <InfoRow
                  label={t('employees.infoLabels.email')}
                  value={selectedEmployee.email}
                  icon="mail-outline"
                />
                <InfoRow
                  label={t('employees.infoLabels.phone')}
                  value={selectedEmployee.phone}
                  icon="call-outline"
                />
                <InfoRow
                  label={t('employees.infoLabels.hireDate')}
                  value={
                    selectedEmployee.hireDate
                      ? new Date(selectedEmployee.hireDate).toLocaleDateString()
                      : '—'
                  }
                  icon="calendar-outline"
                />
                <InfoRow
                  label={t('employees.infoLabels.salary')}
                  value={t('employees.salaryPerMonth', {
                    amount: `$${selectedEmployee.salary || 0}`,
                  })}
                  icon="cash-outline"
                />
                <InfoRow
                  label={t('employees.infoLabels.residence')}
                  value={selectedEmployee.residence}
                  icon="location-outline"
                />
                <InfoRow
                  label={t('employees.infoLabels.emergencyContact')}
                  value={selectedEmployee.emergencyContact}
                  icon="alert-circle-outline"
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.actionBtnOutline}
                    onPress={() => openEditForm(selectedEmployee)}
                  >
                    <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.actionBtnOutlineText}>
                      {t('employees.buttons.edit')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtnOutline}>
                    <Ionicons name="call-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.actionBtnOutlineText}>
                      {t('employees.buttons.call')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtnDanger}
                    onPress={() => handleDelete(selectedEmployee)}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                    <Text style={styles.actionBtnDangerText}>
                      {t('employees.buttons.delete')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* FILTER MODAL */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '50%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('employees.filterTitle')}</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.filterSectionTitle}>
                {t('employees.filterStatus')}
              </Text>
              <View style={styles.filterChipsRow}>
                {(['All', ...STATUSES] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.filterChip,
                      selectedStatus === s && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedStatus(s as any)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedStatus === s && styles.filterChipTextActive,
                      ]}
                    >
                      {s === 'All' ? t('employees.all') : s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.filterResetBtn} onPress={clearFilters}>
                <Text style={styles.filterResetBtnText}>{t('employees.reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.filterApplyBtnText}>
                  {t('employees.applyFilters')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ADD / EDIT MODAL */}
      <Modal
        visible={formModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => !saving && setFormModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditing ? t('employees.editTitle') : t('employees.addTitle')}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => !saving && setFormModalVisible(false)}
                disabled={saving}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {formError ? (
                <View style={styles.modalErrorBox}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.red} />
                  <Text style={styles.modalErrorText}>{formError}</Text>
                </View>
              ) : null}

              <Text style={styles.formLabel}>{t('employees.fields.fullName')} *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.name}
                onChangeText={(v) => updateField('name', v)}
                placeholder={t('employees.placeholders.fullName')}
                placeholderTextColor="#A0AAA5"
              />

              <Text style={styles.formLabel}>{t('employees.fields.email')} *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.email}
                onChangeText={(v) => updateField('email', v)}
                placeholder={t('employees.placeholders.email')}
                placeholderTextColor="#A0AAA5"
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.formLabel}>{t('employees.fields.phone')} *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.phone}
                onChangeText={(v) => updateField('phone', v)}
                placeholder={t('employees.placeholders.phone')}
                placeholderTextColor="#A0AAA5"
                keyboardType="phone-pad"
              />

              <Text style={styles.formLabel}>{t('employees.fields.position')} *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.position}
                onChangeText={(v) => updateField('position', v)}
                placeholder={t('employees.placeholders.position')}
                placeholderTextColor="#A0AAA5"
              />

              <Text style={styles.formLabel}>{t('employees.fields.status')} *</Text>
              <View style={styles.chipRow}>
                {STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, formData.status === s && styles.chipActive]}
                    onPress={() => updateField('status', s)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        formData.status === s && styles.chipTextActive,
                      ]}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>{t('employees.fields.hireDate')} *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.hireDate}
                onChangeText={(v) => updateField('hireDate', v)}
                placeholder={t('employees.placeholders.date')}
                placeholderTextColor="#A0AAA5"
                autoCapitalize="none"
              />

              <Text style={styles.formLabel}>{t('employees.fields.salary')}</Text>
              <TextInput
                style={styles.formInput}
                value={formData.salary}
                onChangeText={(v) => updateField('salary', v)}
                placeholder={t('employees.placeholders.salary')}
                placeholderTextColor="#A0AAA5"
                keyboardType="numeric"
              />

              <Text style={styles.formLabel}>{t('employees.fields.residence')}</Text>
              <TextInput
                style={styles.formInput}
                value={formData.residence}
                onChangeText={(v) => updateField('residence', v)}
                placeholder={t('employees.placeholders.residence')}
                placeholderTextColor="#A0AAA5"
              />

              <Text style={styles.formLabel}>
                {t('employees.fields.emergencyContact')}
              </Text>
              <TextInput
                style={styles.formInput}
                value={formData.emergencyContact}
                onChangeText={(v) => updateField('emergencyContact', v)}
                placeholder={t('employees.placeholders.emergency')}
                placeholderTextColor="#A0AAA5"
                keyboardType="phone-pad"
              />

              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalActionsFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => !saving && setFormModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>
                  {t('employees.buttons.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.submitBtnText}>
                      {isEditing
                        ? t('employees.buttons.update')
                        : t('employees.buttons.save')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default EmployeesManagementScreen;

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.slate },
  headerSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerIconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    position: 'relative',
  },
  filterDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.primary,
    borderWidth: 1.5, borderColor: COLORS.white,
  },
  addButton: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },

  summaryRow: {
    flexDirection: 'row', paddingHorizontal: 16,
    paddingBottom: 12, gap: 8,
  },
  summaryCard: {
    flex: 1, backgroundColor: COLORS.white,
    borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  summaryIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  summaryValue: { fontSize: 16, fontWeight: '800', color: COLORS.slate },
  summaryLabel: { fontSize: 10, color: COLORS.slateMuted, fontWeight: '600' },

  searchContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: COLORS.border,
    height: 44,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: COLORS.slate },

  activeFiltersRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
    gap: 8,
  },
  activeFilter: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, gap: 4,
  },
  activeFilterText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  clearFiltersText: {
    fontSize: 11, fontWeight: '600',
    color: COLORS.gray, textDecorationLine: 'underline',
  },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8, padding: 12,
    backgroundColor: COLORS.redLight,
    borderWidth: 1, borderColor: '#F6C8C8', borderRadius: 12,
  },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.red },

  loadingWrap: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: COLORS.slateMuted, fontSize: 13 },

  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },

  employeeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16, padding: 14,
    marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  employeeRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.blueLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: COLORS.blue },
  employeeInfo: { flex: 1 },
  employeeName: {
    fontSize: 15, fontWeight: '700',
    color: COLORS.slate, marginBottom: 2,
  },
  employeePosition: {
    fontSize: 12, color: COLORS.slateMuted,
    fontWeight: '600', marginBottom: 4,
  },
  employeeMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  employeeMetaText: {
    fontSize: 11, color: COLORS.slateMuted, flex: 1,
  },
  employeeRight: { alignItems: 'flex-end', marginLeft: 8, gap: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },
  salaryText: { fontSize: 13, fontWeight: '800', color: COLORS.purple },

  paginationRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 16, paddingVertical: 16,
  },
  paginationBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  paginationBtnDisabled: { opacity: 0.4 },
  paginationText: { fontSize: 13, fontWeight: '600', color: COLORS.slate },

  emptyContainer: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 60, paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17, fontWeight: '700',
    color: COLORS.slate, marginTop: 16,
  },
  emptyText: {
    fontSize: 13, color: COLORS.slateMuted,
    textAlign: 'center', marginTop: 8, lineHeight: 20,
  },
  emptyButton: {
    marginTop: 20, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: COLORS.primary, borderRadius: 10,
  },
  emptyButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  modalCloseBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { paddingHorizontal: 20 },
  modalProfile: { alignItems: 'center', paddingVertical: 20 },
  modalAvatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: COLORS.blue,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  modalAvatarText: { fontSize: 32, fontWeight: '800', color: COLORS.white },
  modalName: { fontSize: 20, fontWeight: '800', color: COLORS.slate },
  modalPosition: {
    fontSize: 13, color: COLORS.slateMuted,
    marginTop: 4, fontWeight: '600',
  },

  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  infoIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: COLORS.slateMuted, fontWeight: '600' },
  infoValue: {
    fontSize: 14, color: COLORS.slate,
    fontWeight: '600', marginTop: 2,
  },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  actionBtnOutline: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.primary, gap: 6,
  },
  actionBtnOutlineText: {
    fontSize: 13, fontWeight: '700', color: COLORS.primary,
  },
  actionBtnDanger: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.red, gap: 6,
  },
  actionBtnDangerText: {
    fontSize: 13, fontWeight: '700', color: COLORS.red,
  },

  filterSectionTitle: {
    fontSize: 13, fontWeight: '800', color: COLORS.slate,
    marginTop: 20, marginBottom: 10,
  },
  filterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary, borderColor: COLORS.primary,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: COLORS.slateMuted },
  filterChipTextActive: { color: COLORS.white },
  filterActions: {
    flexDirection: 'row', padding: 20, gap: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  filterResetBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterResetBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  filterApplyBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.primary, alignItems: 'center',
  },
  filterApplyBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  formLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.slateMuted,
    marginTop: 14, marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.3,
  },
  formInput: {
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: COLORS.slate, backgroundColor: COLORS.white,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.slateMuted },
  chipTextActive: { color: '#fff' },

  modalErrorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.redLight,
    borderWidth: 1, borderColor: '#F6C8C8', borderRadius: 10,
    padding: 10, marginTop: 12,
  },
  modalErrorText: {
    flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.red,
  },

  modalActionsFooter: {
    flexDirection: 'row', gap: 10, padding: 20,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  submitBtn: {
    flex: 2, flexDirection: 'row', gap: 6,
    paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});