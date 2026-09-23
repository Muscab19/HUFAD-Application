import React, { useState, useEffect, useCallback } from 'react';
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
type Status = 'Active' | 'On Leave' | 'Inactive';
type EmploymentType = 'Full-time' | 'Part-time';

interface HalaqahRef {
  _id: string;
  name: string;
}

interface Teacher {
  _id: string;
  name: string;
  gender: 'Male' | 'Female';
  email: string;
  phone: string;
  halaqas: HalaqahRef[] | string[];
  status: Status;
  employmentType: EmploymentType;
  specialization: string;
  teachingSince: string;
  profilePic?: string;
  notes?: string;
  cvFile?: string;
  certificates?: { name: string }[];
  username?: string;
}

interface FormState {
  name: string;
  gender: 'Male' | 'Female';
  email: string;
  phone: string;
  halaqas: string[];
  status: Status;
  employmentType: EmploymentType;
  specialization: string;
  teachingSince: string;
  notes: string;
}

const SPECIALIZATIONS = ['Tajweed', 'Memorization', 'Tafseer', 'Arabic Language', 'Fiqh'];
const STATUSES: Status[] = ['Active', 'On Leave', 'Inactive'];
const EMPLOYMENT_TYPES: EmploymentType[] = ['Full-time', 'Part-time'];

const getEmptyForm = (): FormState => ({
  name: '',
  gender: 'Male',
  email: '',
  phone: '',
  halaqas: [],
  status: 'Active',
  employmentType: 'Full-time',
  specialization: '',
  teachingSince: new Date().toISOString().split('T')[0],
  notes: '',
});

// ============================================================
// HELPERS
// ============================================================
const getInitials = (name: string) => {
  const parts = (name || '').trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || '').substring(0, 2).toUpperCase();
};

const getHalaqahName = (h: HalaqahRef | string) => {
  if (!h) return '';
  if (typeof h === 'string') return h;
  return h.name || '';
};

const getHalaqahId = (h: HalaqahRef | string) => {
  if (!h) return '';
  if (typeof h === 'string') return h;
  return h._id || '';
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
export const TeachersManagementScreen: React.FC = () => {
  const { t } = useTranslation();
  const { currentBranch } = useBranch();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'All' | Status>('All');
  const [selectedEmploymentType, setSelectedEmploymentType] = useState<'All' | EmploymentType>('All');
  const [selectedHalaqah, setSelectedHalaqah] = useState<string>('All');
  const [sortConfig] = useState({ key: 'name', direction: 'asc' as 'asc' | 'desc' });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const teachersPerPage = 10;

  const [halaqat, setHalaqat] = useState<HalaqahRef[]>([]);

  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
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
  }, [debouncedSearch, selectedStatus, selectedEmploymentType, selectedHalaqah]);

  // ============================================================
  // FETCH
  // ============================================================
  const fetchTeachers = useCallback(async () => {
    setError('');
    try {
      const params: Record<string, any> = {
        page: currentPage,
        limit: teachersPerPage,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
      };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (selectedHalaqah !== 'All') params.halaqah = selectedHalaqah;
      if (selectedStatus !== 'All') params.status = selectedStatus;
      if (selectedEmploymentType !== 'All') params.employmentType = selectedEmploymentType;

      const res: any = await apiClient.get('/teachers', params);
      const list = Array.isArray(res?.teachers) ? res.teachers : [];
      setTeachers(list);
      setTotalPages(Number(res?.totalPages) || 1);
    } catch (err: any) {
      console.error('Fetch teachers error:', err);
      setError(err?.message || 'Failed to load teachers.');
      setTeachers([]);
    }
  }, [currentPage, debouncedSearch, selectedHalaqah, selectedStatus, selectedEmploymentType, sortConfig]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchTeachers();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchTeachers]);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await apiClient.get('/halaqaat');
        const list = res?.halaqaat || res?.halaqat || res?.data || [];
        setHalaqat(Array.isArray(list) ? list : []);
      } catch (err) {
        console.warn('Failed to load halaqat:', err);
      }
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTeachers();
    setRefreshing(false);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('All');
    setSelectedEmploymentType('All');
    setSelectedHalaqah('All');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    !!searchTerm ||
    selectedStatus !== 'All' ||
    selectedEmploymentType !== 'All' ||
    selectedHalaqah !== 'All';

  // ============================================================
  // FORM
  // ============================================================
  const openAddForm = () => {
    setIsEditing(false);
    setFormData(getEmptyForm());
    setFormStep(1);
    setFormError('');
    setFormModalVisible(true);
  };

  const openEditForm = (teacher: Teacher) => {
    setIsEditing(true);
    setFormData({
      name: teacher.name || '',
      gender: teacher.gender || 'Male',
      email: teacher.email || '',
      phone: teacher.phone || '',
      halaqas: (teacher.halaqas || []).map(getHalaqahId).filter(Boolean),
      status: teacher.status || 'Active',
      employmentType: teacher.employmentType || 'Full-time',
      specialization: teacher.specialization || '',
      teachingSince: teacher.teachingSince
        ? teacher.teachingSince.split('T')[0]
        : new Date().toISOString().split('T')[0],
      notes: teacher.notes || '',
    });
    setFormStep(1);
    setFormError('');
    setViewModalVisible(false);
    setFormModalVisible(true);
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleHalaqah = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      halaqas: prev.halaqas.includes(id)
        ? prev.halaqas.filter((h) => h !== id)
        : [...prev.halaqas, id],
    }));
  };

  const validateStep = (step: 1 | 2 | 3): string | null => {
    if (step === 1) {
      if (!formData.name.trim()) return t('teachers.validation.nameRequired');
      if (!formData.email.trim()) return t('teachers.validation.emailRequired');
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(formData.email.trim())) return t('teachers.validation.emailInvalid');
      if (!formData.phone.trim()) return t('teachers.validation.phoneRequired');
      if (formData.halaqas.length === 0) return t('teachers.validation.halaqasRequired');
    }
    if (step === 3) {
      if (!formData.specialization) return t('teachers.validation.specializationRequired');
    }
    return null;
  };

  const handleSave = async () => {
    if (!currentBranch?._id) {
      setFormError(t('teachers.branchRequired'));
      return;
    }
    for (const step of [1, 2, 3] as const) {
      const err = validateStep(step);
      if (err) {
        setFormStep(step);
        setFormError(err);
        return;
      }
    }

    setSaving(true);
    setFormError('');

    try {
      const fd = new FormData();
      fd.append('name', formData.name.trim());
      fd.append('email', formData.email.trim());
      fd.append('phone', formData.phone.trim());
      fd.append('gender', formData.gender);
      fd.append('status', formData.status);
      fd.append('employmentType', formData.employmentType);
      fd.append('specialization', formData.specialization);
      fd.append('teachingSince', formData.teachingSince);
      fd.append('notes', formData.notes || '');
      fd.append('branchId', currentBranch._id);

      formData.halaqas.forEach((id) => {
        fd.append('halaqas', id);
      });

      if (isEditing && selectedTeacher) {
        await apiClient.put(`/teachers/${selectedTeacher._id}`, fd);
      } else {
        const response: any = await apiClient.post('/teachers', fd);
        if (response?.loginCredentials) {
          Alert.alert(
            t('teachers.teacherAddedTitle'),
            t('teachers.teacherAddedMsg', {
              username: response.loginCredentials.username,
              password: response.loginCredentials.temporaryPassword,
            }),
          );
        }
      }

      setFormModalVisible(false);
      setSelectedTeacher(null);
      await fetchTeachers();
    } catch (err: any) {
      console.error('Save teacher error:', err);
      const msg =
        err?.data?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save teacher.';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const openViewModal = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setViewModalVisible(true);
  };

  const handleDelete = (teacher: Teacher) => {
    Alert.alert(
      t('teachers.deleteTitle'),
      t('teachers.deleteMsg', { name: teacher.name }),
      [
        { text: t('teachers.cancel'), style: 'cancel' },
        {
          text: t('teachers.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/teachers/${teacher._id}`);
              setViewModalVisible(false);
              await fetchTeachers();
              Alert.alert(t('teachers.deletedTitle'), t('teachers.deletedMsg'));
            } catch (err: any) {
              Alert.alert(t('teachers.errorTitle'), err?.message || 'Failed to delete teacher.');
            }
          },
        },
      ]
    );
  };

  // ============================================================
  // RENDER TEACHER
  // ============================================================
  const renderTeacher = ({ item }: { item: Teacher }) => {
    const statusStyle = getStatusStyle(item.status);
    const halaqas = item.halaqas || [];
    return (
      <TouchableOpacity
        style={styles.teacherCard}
        activeOpacity={0.7}
        onPress={() => openViewModal(item)}
      >
        <View style={styles.teacherRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
          </View>

          <View style={styles.teacherInfo}>
            <Text style={styles.teacherName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.teacherSpecialization} numberOfLines={1}>
              {item.specialization || t('teachers.noSpecialization')}
            </Text>
            <View style={styles.teacherTags}>
              {halaqas.slice(0, 2).map((h, idx) => (
                <View key={getHalaqahId(h) || idx} style={styles.halaqahTag}>
                  <Ionicons name="book-outline" size={10} color={COLORS.primary} />
                  <Text style={styles.halaqahText}>{getHalaqahName(h)}</Text>
                </View>
              ))}
              {halaqas.length > 2 && (
                <View style={[styles.halaqahTag, { backgroundColor: '#F1F5F9' }]}>
                  <Text style={[styles.halaqahText, { color: COLORS.gray }]}>
                    +{halaqas.length - 2}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.teacherRight}>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {item.status}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color="#B7C3BD"
              style={{ marginTop: 8 }}
            />
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
          <Text style={styles.headerTitle}>{t('teachers.headerTitle')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('teachers.headerSubtitle', {
              count: teachers.length,
              page: currentPage,
              total: totalPages,
            })}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setFilterModalVisible(true)}
          >
            <Ionicons name="filter-outline" size={20} color={COLORS.slate} />
            {hasActiveFilters && <View style={styles.filterDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={openAddForm}>
            <Ionicons name="add" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('teachers.searchPlaceholder')}
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

      {hasActiveFilters && (
        <View style={styles.activeFiltersRow}>
          {selectedStatus !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>{selectedStatus}</Text>
              <TouchableOpacity onPress={() => setSelectedStatus('All')}>
                <Ionicons name="close" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
          {selectedEmploymentType !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>{selectedEmploymentType}</Text>
              <TouchableOpacity onPress={() => setSelectedEmploymentType('All')}>
                <Ionicons name="close" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
          {selectedHalaqah !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {halaqat.find((h) => h._id === selectedHalaqah)?.name || 'Halaqah'}
              </Text>
              <TouchableOpacity onPress={() => setSelectedHalaqah('All')}>
                <Ionicons name="close" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearFiltersText}>{t('teachers.clearAll')}</Text>
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

      {loading && teachers.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('teachers.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={teachers}
          keyExtractor={(item) => item._id}
          renderItem={renderTeacher}
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
              <Ionicons name="school-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>{t('teachers.noResultsTitle')}</Text>
              <Text style={styles.emptyText}>
                {hasActiveFilters
                  ? t('teachers.noResultsFiltered')
                  : t('teachers.noResultsEmpty')}
              </Text>
              {hasActiveFilters ? (
                <TouchableOpacity style={styles.emptyButton} onPress={clearFilters}>
                  <Text style={styles.emptyButtonText}>{t('teachers.clearFilters')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.emptyButton} onPress={openAddForm}>
                  <Text style={styles.emptyButtonText}>{t('teachers.addTeacher')}</Text>
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
                  {t('teachers.pageOf', { page: currentPage, total: totalPages })}
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
              <Text style={styles.modalTitle}>{t('teachers.details')}</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setViewModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            {selectedTeacher && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.modalProfile}>
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>
                      {getInitials(selectedTeacher.name)}
                    </Text>
                  </View>
                  <Text style={styles.modalName}>{selectedTeacher.name}</Text>
                  <Text style={styles.modalSpecialization}>
                    {selectedTeacher.specialization || t('teachers.noSpecialization')}
                  </Text>
                  <View style={styles.modalBadgeRow}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusStyle(selectedTeacher.status).bg }]}>
                      <Text style={[styles.statusText, { color: getStatusStyle(selectedTeacher.status).text }]}>
                        {selectedTeacher.status}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, {
                      backgroundColor: selectedTeacher.employmentType === 'Full-time' ? COLORS.blueLight : COLORS.purpleLight,
                    }]}>
                      <Text style={[styles.statusText, {
                        color: selectedTeacher.employmentType === 'Full-time' ? COLORS.blue : COLORS.purple,
                      }]}>
                        {selectedTeacher.employmentType}
                      </Text>
                    </View>
                  </View>
                </View>

                <InfoRow
                  label={t('teachers.infoLabels.gender')}
                  value={selectedTeacher.gender}
                  icon="person-outline"
                />
                <InfoRow
                  label={t('teachers.infoLabels.email')}
                  value={selectedTeacher.email}
                  icon="mail-outline"
                />
                <InfoRow
                  label={t('teachers.infoLabels.phone')}
                  value={selectedTeacher.phone}
                  icon="call-outline"
                />
                <InfoRow
                  label={t('teachers.infoLabels.teachingSince')}
                  value={
                    selectedTeacher.teachingSince
                      ? new Date(selectedTeacher.teachingSince).toLocaleDateString()
                      : '—'
                  }
                  icon="calendar-outline"
                />

                <View style={styles.halaqasSection}>
                  <Text style={styles.sectionLabel}>{t('teachers.assignedHalaqas')}</Text>
                  <View style={styles.halaqasList}>
                    {(selectedTeacher.halaqas || []).length === 0 ? (
                      <Text style={styles.halaqahBadgeText}>
                        {t('teachers.noHalaqasAssigned')}
                      </Text>
                    ) : (
                      (selectedTeacher.halaqas || []).map((h, idx) => (
                        <View key={getHalaqahId(h) || idx} style={styles.halaqahBadge}>
                          <Ionicons name="book-outline" size={12} color={COLORS.primary} />
                          <Text style={styles.halaqahBadgeText}>{getHalaqahName(h)}</Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>

                {selectedTeacher.notes ? (
                  <View style={styles.notesSection}>
                    <Text style={styles.sectionLabel}>{t('teachers.notes')}</Text>
                    <Text style={styles.notesText}>{selectedTeacher.notes}</Text>
                  </View>
                ) : null}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.actionBtnOutline}
                    onPress={() => openEditForm(selectedTeacher)}
                  >
                    <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.actionBtnOutlineText}>
                      {t('teachers.buttons.edit')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtnOutline}>
                    <Ionicons name="call-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.actionBtnOutlineText}>
                      {t('teachers.buttons.contact')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtnDanger}
                    onPress={() => handleDelete(selectedTeacher)}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                    <Text style={styles.actionBtnDangerText}>
                      {t('teachers.buttons.delete')}
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
          <View style={[styles.modalContainer, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('teachers.filterTitle')}</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.filterSectionTitle}>{t('teachers.filterStatus')}</Text>
              <View style={styles.filterChipsRow}>
                {(['All', ...STATUSES] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.filterChip, selectedStatus === s && styles.filterChipActive]}
                    onPress={() => setSelectedStatus(s as any)}
                  >
                    <Text style={[styles.filterChipText, selectedStatus === s && styles.filterChipTextActive]}>
                      {s === 'All' ? t('teachers.all') : s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.filterSectionTitle, { marginTop: 20 }]}>
                {t('teachers.filterEmploymentType')}
              </Text>
              <View style={styles.filterChipsRow}>
                {(['All', ...EMPLOYMENT_TYPES] as const).map((tp) => (
                  <TouchableOpacity
                    key={tp}
                    style={[styles.filterChip, selectedEmploymentType === tp && styles.filterChipActive]}
                    onPress={() => setSelectedEmploymentType(tp as any)}
                  >
                    <Text style={[styles.filterChipText, selectedEmploymentType === tp && styles.filterChipTextActive]}>
                      {tp === 'All' ? t('teachers.all') : tp}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.filterSectionTitle, { marginTop: 20 }]}>
                {t('teachers.filterHalaqah')}
              </Text>
              <View style={styles.filterChipsRow}>
                <TouchableOpacity
                  style={[styles.filterChip, selectedHalaqah === 'All' && styles.filterChipActive]}
                  onPress={() => setSelectedHalaqah('All')}
                >
                  <Text style={[styles.filterChipText, selectedHalaqah === 'All' && styles.filterChipTextActive]}>
                    {t('teachers.all')}
                  </Text>
                </TouchableOpacity>
                {halaqat.map((h) => (
                  <TouchableOpacity
                    key={h._id}
                    style={[styles.filterChip, selectedHalaqah === h._id && styles.filterChipActive]}
                    onPress={() => setSelectedHalaqah(h._id)}
                  >
                    <Text style={[styles.filterChipText, selectedHalaqah === h._id && styles.filterChipTextActive]}>
                      {h.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.filterResetBtn} onPress={clearFilters}>
                <Text style={styles.filterResetBtnText}>{t('teachers.reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.filterApplyBtnText}>{t('teachers.applyFilters')}</Text>
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
              <View>
                <Text style={styles.modalTitle}>
                  {isEditing ? t('teachers.editTitle') : t('teachers.addTitle')}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {t('teachers.step', { current: formStep, total: 3 })} •{' '}
                  {formStep === 1
                    ? t('teachers.stepNames.info')
                    : formStep === 2
                    ? t('teachers.stepNames.documents')
                    : t('teachers.stepNames.additional')}
                </Text>
              </View>
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

              {formStep === 1 && (
                <>
                  <Text style={styles.formLabel}>{t('teachers.fields.fullName')} *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.name}
                    onChangeText={(v) => updateField('name', v)}
                    placeholder={t('teachers.placeholders.fullName')}
                    placeholderTextColor="#A0AAA5"
                  />

                  <Text style={styles.formLabel}>{t('teachers.fields.gender')} *</Text>
                  <View style={styles.chipRow}>
                    {(['Male', 'Female'] as const).map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[styles.chip, formData.gender === g && styles.chipActive]}
                        onPress={() => updateField('gender', g)}
                      >
                        <Text style={[styles.chipText, formData.gender === g && styles.chipTextActive]}>
                          {g}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.formLabel}>{t('teachers.fields.email')} *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.email}
                    onChangeText={(v) => updateField('email', v)}
                    placeholder={t('teachers.placeholders.email')}
                    placeholderTextColor="#A0AAA5"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />

                  <Text style={styles.formLabel}>{t('teachers.fields.phone')} *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.phone}
                    onChangeText={(v) => updateField('phone', v)}
                    placeholder={t('teachers.placeholders.phone')}
                    placeholderTextColor="#A0AAA5"
                    keyboardType="phone-pad"
                  />

                  <Text style={styles.formLabel}>{t('teachers.fields.status')} *</Text>
                  <View style={styles.chipRow}>
                    {STATUSES.map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.chip, formData.status === s && styles.chipActive]}
                        onPress={() => updateField('status', s)}
                      >
                        <Text style={[styles.chipText, formData.status === s && styles.chipTextActive]}>
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.formLabel}>{t('teachers.fields.employmentType')} *</Text>
                  <View style={styles.chipRow}>
                    {EMPLOYMENT_TYPES.map((tp) => (
                      <TouchableOpacity
                        key={tp}
                        style={[styles.chip, formData.employmentType === tp && styles.chipActive]}
                        onPress={() => updateField('employmentType', tp)}
                      >
                        <Text style={[styles.chipText, formData.employmentType === tp && styles.chipTextActive]}>
                          {tp}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.formLabel}>{t('teachers.fields.halaqas')} *</Text>
                  <View style={styles.chipRow}>
                    {halaqat.length === 0 ? (
                      <Text style={styles.formHint}>No halaqat available</Text>
                    ) : (
                      halaqat.map((h) => {
                        const active = formData.halaqas.includes(h._id);
                        return (
                          <TouchableOpacity
                            key={h._id}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => toggleHalaqah(h._id)}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                              {h.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                </>
              )}

              {formStep === 2 && (
                <>
                  <View style={styles.uploadPlaceholder}>
                    <Ionicons name="document-text-outline" size={32} color={COLORS.gray} />
                    <Text style={styles.uploadPlaceholderTitle}>
                      {t('teachers.upload.cvTitle')}
                    </Text>
                    <Text style={styles.uploadPlaceholderText}>
                      {t('teachers.upload.placeholder')}
                    </Text>
                  </View>
                  <View style={[styles.uploadPlaceholder, { marginTop: 12 }]}>
                    <Ionicons name="ribbon-outline" size={32} color={COLORS.gray} />
                    <Text style={styles.uploadPlaceholderTitle}>
                      {t('teachers.upload.certificatesTitle')}
                    </Text>
                    <Text style={styles.uploadPlaceholderText}>
                      {t('teachers.upload.placeholder')}
                    </Text>
                  </View>
                </>
              )}

              {formStep === 3 && (
                <>
                  <Text style={styles.formLabel}>{t('teachers.fields.specialization')} *</Text>
                  <View style={styles.chipRow}>
                    {SPECIALIZATIONS.map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.chip, formData.specialization === s && styles.chipActive]}
                        onPress={() => updateField('specialization', s)}
                      >
                        <Text style={[styles.chipText, formData.specialization === s && styles.chipTextActive]}>
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.formLabel}>{t('teachers.fields.teachingSince')} *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.teachingSince}
                    onChangeText={(v) => updateField('teachingSince', v)}
                    placeholder={t('teachers.placeholders.date')}
                    placeholderTextColor="#A0AAA5"
                    autoCapitalize="none"
                  />

                  <Text style={styles.formLabel}>{t('teachers.fields.notes')}</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextarea]}
                    value={formData.notes}
                    onChangeText={(v) => updateField('notes', v)}
                    placeholder={t('teachers.placeholders.notes')}
                    placeholderTextColor="#A0AAA5"
                    multiline
                    numberOfLines={4}
                  />
                </>
              )}

              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalActionsFooter}>
              {formStep === 1 ? (
                <>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => !saving && setFormModalVisible(false)}
                    disabled={saving}
                  >
                    <Text style={styles.cancelBtnText}>{t('teachers.buttons.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={() => {
                      const err = validateStep(1);
                      if (err) {
                        setFormError(err);
                        return;
                      }
                      setFormError('');
                      setFormStep(2);
                    }}
                  >
                    <Text style={styles.submitBtnText}>{t('teachers.buttons.next')}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </TouchableOpacity>
                </>
              ) : formStep === 2 ? (
                <>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setFormStep(1)}
                    disabled={saving}
                  >
                    <Text style={styles.cancelBtnText}>{t('teachers.buttons.back')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.submitBtn} onPress={() => setFormStep(3)}>
                    <Text style={styles.submitBtnText}>{t('teachers.buttons.next')}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setFormStep(2)}
                    disabled={saving}
                  >
                    <Text style={styles.cancelBtnText}>{t('teachers.buttons.back')}</Text>
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
                            ? t('teachers.buttons.update')
                            : t('teachers.buttons.save')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default TeachersManagementScreen;

// ============================================================
// STYLES (unchanged)
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
    shadowOpacity: 0.25, shadowRadius: 8,
    elevation: 4,
  },

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
    gap: 8, flexWrap: 'wrap',
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
    marginHorizontal: 16, marginBottom: 8,
    padding: 12,
    backgroundColor: COLORS.redLight,
    borderWidth: 1, borderColor: '#F6C8C8',
    borderRadius: 12,
  },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.red },

  loadingWrap: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: COLORS.slateMuted, fontSize: 13 },

  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },

  teacherCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16, padding: 14,
    marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  teacherRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  teacherInfo: { flex: 1 },
  teacherName: { fontSize: 15, fontWeight: '700', color: COLORS.slate, marginBottom: 3 },
  teacherSpecialization: {
    fontSize: 11, color: COLORS.slateMuted,
    fontWeight: '600', marginBottom: 6,
  },
  teacherTags: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  halaqahTag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, gap: 4,
  },
  halaqahText: { fontSize: 10, fontWeight: '600', color: COLORS.primary },
  teacherRight: { alignItems: 'flex-end', marginLeft: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },

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
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  modalSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
  modalCloseBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { paddingHorizontal: 20 },

  modalProfile: { alignItems: 'center', paddingVertical: 20 },
  modalAvatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12,
    elevation: 6,
  },
  modalAvatarText: { fontSize: 32, fontWeight: '800', color: COLORS.white },
  modalName: {
    fontSize: 20, fontWeight: '800', color: COLORS.slate,
    textAlign: 'center',
  },
  modalSpecialization: {
    fontSize: 13, color: COLORS.slateMuted,
    marginTop: 4, fontWeight: '600',
  },
  modalBadgeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },

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
  infoValue: { fontSize: 14, color: COLORS.slate, fontWeight: '600', marginTop: 2 },

  halaqasSection: { marginTop: 20 },
  sectionLabel: {
    fontSize: 13, fontWeight: '800',
    color: COLORS.slate, marginBottom: 10,
  },
  halaqasList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  halaqahBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 12, gap: 6,
  },
  halaqahBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  notesSection: {
    marginTop: 20, backgroundColor: COLORS.background,
    borderRadius: 14, padding: 16,
  },
  notesText: {
    fontSize: 13, color: COLORS.slate,
    lineHeight: 20, marginTop: 8,
  },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  actionBtnOutline: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.primary, gap: 6,
  },
  actionBtnOutlineText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  actionBtnDanger: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.red, gap: 6,
  },
  actionBtnDangerText: { fontSize: 13, fontWeight: '700', color: COLORS.red },

  filterSectionTitle: {
    fontSize: 13, fontWeight: '800',
    color: COLORS.slate, marginTop: 20, marginBottom: 10,
  },
  filterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
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
  formTextarea: {
    minHeight: 90, textAlignVertical: 'top',
  },
  formHint: { fontSize: 11, color: COLORS.gray, fontStyle: 'italic' },
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
    borderWidth: 1, borderColor: '#F6C8C8',
    borderRadius: 10, padding: 10, marginTop: 12,
  },
  modalErrorText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.red },

  modalActionsFooter: {
    flexDirection: 'row', gap: 10,
    padding: 20,
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

  uploadPlaceholder: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.border,
    borderRadius: 14, padding: 24, alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  uploadPlaceholderTitle: {
    fontSize: 14, fontWeight: '700', color: COLORS.slate, marginTop: 10,
  },
  uploadPlaceholderText: {
    fontSize: 12, color: COLORS.slateMuted,
    textAlign: 'center', marginTop: 6,
  },
});