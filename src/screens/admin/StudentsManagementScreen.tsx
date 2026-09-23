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
  Platform,
  KeyboardAvoidingView,
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
// TYPES
// ============================================================
interface Halaqah {
  _id: string;
  name: string;
}

interface Student {
  _id: string;
  name: string;
  regNo: string;
  gender: 'Male' | 'Female';
  dob?: string;
  residence: string;
  parentContact: string;
  guardianName: string;
  guardianPhone?: string;
  guardianEmail?: string;
  guardianRelationship?: string;
  tertiaryPhone?: string;
  bloodType?: string;
  complaints?: string;
  diseases?: string;
  fatherStatus?: 'Alive' | 'Deceased';
  motherStatus?: 'Alive' | 'Deceased';
  halaqah: { _id: string; name: string } | string;
  studentType: 'Full-time' | 'Part-time';
  status: 'Active' | 'Inactive' | 'Graduated' | 'Transferred';
  enrollDate: string;
  profilePic?: string;
  fee?: number;
  scholarship?: number;
  feeFrequency?: string;
}

interface FormState {
  name: string;
  gender: 'Male' | 'Female';
  dob: string;
  halaqah: string;
  regNo: string;
  enrollDate: string;
  residence: string;
  parentContact: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianRelationship: string;
  tertiaryPhone: string;
  bloodType: string;
  complaints: string;
  diseases: string;
  fatherStatus: 'Alive' | 'Deceased';
  motherStatus: 'Alive' | 'Deceased';
  studentType: 'Full-time' | 'Part-time';
  status: 'Active' | 'Inactive' | 'Graduated' | 'Transferred';
  fee: string;
  scholarship: string;
  feeFrequency: string;
}

const RELATIONSHIPS = [
  'Father', 'Mother', 'Uncle', 'Aunt', 'Brother', 'Sister',
  'Grandfather', 'Grandmother', 'Other',
];

const getEmptyForm = (): FormState => ({
  name: '',
  gender: 'Male',
  dob: '',
  halaqah: '',
  regNo: '',
  enrollDate: new Date().toISOString().split('T')[0],
  residence: '',
  parentContact: '',
  guardianName: '',
  guardianPhone: '',
  guardianEmail: '',
  guardianRelationship: 'Father',
  tertiaryPhone: '',
  bloodType: '',
  complaints: '',
  diseases: '',
  fatherStatus: 'Alive',
  motherStatus: 'Alive',
  studentType: 'Full-time',
  status: 'Active',
  fee: '',
  scholarship: '',
  feeFrequency: 'Monthly',
});

// ============================================================
// HELPERS
// ============================================================
const getHalaqahName = (h: Student['halaqah']) => {
  if (!h) return '—';
  if (typeof h === 'string') return h;
  return h.name || '—';
};

const getHalaqahId = (h: Student['halaqah']) => {
  if (!h) return '';
  if (typeof h === 'string') return h;
  return h._id || '';
};

const formatDate = (d?: string) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString();
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'Active':
      return { bg: COLORS.primaryLight, text: COLORS.primary };
    case 'Inactive':
      return { bg: '#F1F5F9', text: COLORS.gray };
    case 'Graduated':
      return { bg: COLORS.blueLight, text: COLORS.blue };
    case 'Transferred':
      return { bg: COLORS.goldLight, text: COLORS.gold };
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
export const StudentsManagementScreen: React.FC = () => {
  const { t } = useTranslation();
  const { currentBranch } = useBranch();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedType, setSelectedType] = useState<'All' | 'Full-time' | 'Part-time'>('All');
  const [selectedHalaqah, setSelectedHalaqah] = useState<string>('All');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const studentsPerPage = 10;

  const [halaqat, setHalaqat] = useState<Halaqah[]>([]);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormState>(getEmptyForm());
  const [formStep, setFormStep] = useState<'student' | 'guardian'>('student');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Debounce
  useEffect(() => {
    const tmr = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(tmr);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedType, selectedHalaqah, sortConfig]);

  // ============================================================
  // FETCH
  // ============================================================
  const fetchStudents = useCallback(async () => {
    setError('');
    try {
      const params: Record<string, any> = {
        page: currentPage,
        limit: studentsPerPage,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
        search: debouncedSearch,
        halaqah: selectedHalaqah,
        studentType: selectedType,
      };

      const res: any = await apiClient.get('/students', params);
      const list: Student[] = res?.students || res?.data || [];
      const pages: number = res?.totalPages || 1;

      setStudents(list);
      setTotalPages(pages);
    } catch (err: any) {
      console.error('Fetch students error:', err);
      setError(err?.message || 'Failed to load students.');
      setStudents([]);
    }
  }, [currentPage, debouncedSearch, selectedHalaqah, selectedType, sortConfig]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchStudents();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchStudents]);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await apiClient.get('/halaqat');
        const list: Halaqah[] =
          res?.halaqaat || res?.halaqat || res?.data || [];
        setHalaqat(Array.isArray(list) ? list : []);
      } catch (err) {
        console.warn('Failed to load halaqat:', err);
      }
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStudents();
    setRefreshing(false);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedType('All');
    setSelectedHalaqah('All');
    setSortConfig({ key: 'name', direction: 'asc' });
    setCurrentPage(1);
  };

  const hasActiveFilters =
    !!searchTerm ||
    selectedType !== 'All' ||
    selectedHalaqah !== 'All';

  const requestSort = (key: string) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  // ============================================================
  // FORM
  // ============================================================
  const openAddForm = () => {
    setIsEditing(false);
    setFormData(getEmptyForm());
    setFormStep('student');
    setFormError('');
    setFormModalVisible(true);
  };

  const openEditForm = (student: Student) => {
    setIsEditing(true);
    setFormData({
      name: student.name || '',
      gender: student.gender || 'Male',
      dob: student.dob ? student.dob.split('T')[0] : '',
      halaqah: getHalaqahId(student.halaqah),
      regNo: student.regNo || '',
      enrollDate: student.enrollDate
        ? student.enrollDate.split('T')[0]
        : new Date().toISOString().split('T')[0],
      residence: student.residence || '',
      parentContact: student.parentContact || '',
      guardianName: student.guardianName || '',
      guardianPhone: student.guardianPhone || '',
      guardianEmail: student.guardianEmail || '',
      guardianRelationship: student.guardianRelationship || 'Father',
      tertiaryPhone: student.tertiaryPhone || '',
      bloodType: student.bloodType || '',
      complaints: student.complaints || '',
      diseases: student.diseases || '',
      fatherStatus: student.fatherStatus || 'Alive',
      motherStatus: student.motherStatus || 'Alive',
      studentType: student.studentType || 'Full-time',
      status: student.status || 'Active',
      fee: student.fee != null ? String(student.fee) : '',
      scholarship: student.scholarship != null ? String(student.scholarship) : '',
      feeFrequency: student.feeFrequency || 'Monthly',
    });
    setFormStep('student');
    setFormError('');
    setViewModalVisible(false);
    setFormModalVisible(true);
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const validateStep = (step: 'student' | 'guardian'): string | null => {
    if (step === 'student') {
      if (!formData.name.trim()) return t('students.validation.nameRequired');
      if (!formData.halaqah) return t('students.validation.halaqahRequired');
      if (!formData.residence.trim()) return t('students.validation.residenceRequired');
    } else {
      if (!formData.parentContact.trim()) return t('students.validation.parentContactRequired');
      if (!formData.guardianName.trim()) return t('students.validation.guardianNameRequired');
      if (formData.guardianEmail.trim()) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!re.test(formData.guardianEmail.trim()))
          return t('students.validation.emailInvalid');
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!currentBranch?._id) {
      setFormError(t('students.branchRequired'));
      return;
    }

    const stepError = validateStep('guardian');
    if (stepError) {
      setFormError(stepError);
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const payload: Record<string, any> = {
        name: formData.name.trim(),
        gender: formData.gender,
        halaqah: formData.halaqah,
        residence: formData.residence.trim(),
        parentContact: formData.parentContact.trim(),
        guardianName: formData.guardianName.trim(),
        guardianRelationship: formData.guardianRelationship,
        studentType: formData.studentType,
        status: formData.status,
        enrollDate: formData.enrollDate,
        branchId: currentBranch._id,
        useCurrentIdConfig: true,
      };

      if (formData.dob) payload.dob = formData.dob;
      if (formData.guardianPhone.trim()) payload.guardianPhone = formData.guardianPhone.trim();
      if (formData.tertiaryPhone.trim()) payload.tertiaryPhone = formData.tertiaryPhone.trim();
      if (formData.guardianEmail.trim()) payload.guardianEmail = formData.guardianEmail.trim();
      if (formData.bloodType) payload.bloodType = formData.bloodType;
      if (formData.complaints.trim()) payload.complaints = formData.complaints.trim();
      if (formData.diseases.trim()) payload.diseases = formData.diseases.trim();
      if (formData.fatherStatus) payload.fatherStatus = formData.fatherStatus;
      if (formData.motherStatus) payload.motherStatus = formData.motherStatus;
      if (formData.fee !== '') payload.fee = Number(formData.fee);
      if (formData.scholarship !== '') payload.scholarship = Number(formData.scholarship);
      if (formData.feeFrequency) payload.feeFrequency = formData.feeFrequency;
      if (isEditing && formData.regNo) payload.regNo = formData.regNo;

      if (isEditing && selectedStudent) {
        await apiClient.put(`/students/${selectedStudent._id}`, payload);
      } else {
        await apiClient.post('/students', payload);
      }

      setFormModalVisible(false);
      setSelectedStudent(null);
      await fetchStudents();
      Alert.alert(
        t('students.successTitle'),
        isEditing ? t('students.updatedMsg') : t('students.createdMsg'),
      );
    } catch (err: any) {
      console.error('Save student error:', err);
      const msg =
        err?.data?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save student.';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const openViewModal = async (student: Student) => {
    setSelectedStudent(student);
    setViewModalVisible(true);
    try {
      const fresh: any = await apiClient.get(`/students/${student._id}`);
      const s = fresh?.student || fresh?.data || fresh;
      if (s && s._id) setSelectedStudent(s);
    } catch (err) {
      // silent
    }
  };

  const handleDelete = (student: Student) => {
    Alert.alert(
      t('students.deleteTitle'),
      t('students.deleteMsg', { name: student.name }),
      [
        { text: t('students.cancel'), style: 'cancel' },
        {
          text: t('students.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/students/${student._id}`);
              setViewModalVisible(false);
              await fetchStudents();
              Alert.alert(t('students.deletedTitle'), t('students.deletedMsg'));
            } catch (err: any) {
              Alert.alert(
                t('students.errorTitle'),
                err?.message || 'Failed to delete student.'
              );
            }
          },
        },
      ]
    );
  };

  // ============================================================
  // RENDER STUDENT
  // ============================================================
  const renderStudent = ({ item }: { item: Student }) => {
    const statusStyle = getStatusStyle(item.status);

    return (
      <TouchableOpacity
        style={styles.studentCard}
        activeOpacity={0.7}
        onPress={() => openViewModal(item)}
      >
        <View style={styles.studentRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.name?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>

          <View style={styles.studentInfo}>
            <Text style={styles.studentName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.studentMetaRow}>
              <Text style={styles.studentReg}>{item.regNo || '—'}</Text>
              <View style={styles.metaDot} />
              <Text style={styles.studentGender}>{item.gender}</Text>
            </View>
            <View style={styles.studentTags}>
              <View style={styles.halaqahTag}>
                <Ionicons name="book-outline" size={10} color={COLORS.primary} />
                <Text style={styles.halaqahText}>{getHalaqahName(item.halaqah)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.studentRight}>
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
          <Text style={styles.headerTitle}>{t('students.headerTitle')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('students.headerSubtitle', {
              count: students.length,
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
            placeholder={t('students.searchPlaceholder')}
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
          {selectedType !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>{selectedType}</Text>
              <TouchableOpacity onPress={() => setSelectedType('All')}>
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
            <Text style={styles.clearFiltersText}>{t('students.clearAll')}</Text>
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

      {loading && students.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('students.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item._id}
          renderItem={renderStudent}
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
              <Text style={styles.emptyTitle}>{t('students.noResultsTitle')}</Text>
              <Text style={styles.emptyText}>
                {hasActiveFilters
                  ? t('students.noResultsFiltered')
                  : t('students.noResultsEmpty')}
              </Text>
              {hasActiveFilters ? (
                <TouchableOpacity style={styles.emptyButton} onPress={clearFilters}>
                  <Text style={styles.emptyButtonText}>{t('students.clearFilters')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.emptyButton} onPress={openAddForm}>
                  <Text style={styles.emptyButtonText}>{t('students.addStudent')}</Text>
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
                  {t('students.pageOf', { page: currentPage, total: totalPages })}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.paginationBtn,
                    currentPage === totalPages && styles.paginationBtnDisabled,
                  ]}
                  disabled={currentPage === totalPages}
                  onPress={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={
                      currentPage === totalPages ? COLORS.gray : COLORS.slate
                    }
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
              <Text style={styles.modalTitle}>{t('students.details')}</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setViewModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            {selectedStudent && (
              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalProfile}>
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>
                      {selectedStudent.name?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                  <Text style={styles.modalName}>{selectedStudent.name}</Text>
                  <Text style={styles.modalRegNo}>
                    {selectedStudent.regNo || '—'}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: getStatusStyle(selectedStudent.status).bg,
                        marginTop: 8,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusStyle(selectedStudent.status).text },
                      ]}
                    >
                      {selectedStudent.status}
                    </Text>
                  </View>
                </View>

                <InfoRow
                  label={t('students.infoLabels.gender')}
                  value={selectedStudent.gender}
                  icon="person-outline"
                />
                <InfoRow
                  label={t('students.infoLabels.dob')}
                  value={formatDate(selectedStudent.dob)}
                  icon="calendar-outline"
                />
                <InfoRow
                  label={t('students.infoLabels.halaqah')}
                  value={getHalaqahName(selectedStudent.halaqah)}
                  icon="book-outline"
                />
                <InfoRow
                  label={t('students.infoLabels.studentType')}
                  value={selectedStudent.studentType}
                  icon="school-outline"
                />
                <InfoRow
                  label={t('students.infoLabels.residence')}
                  value={selectedStudent.residence}
                  icon="location-outline"
                />
                <InfoRow
                  label={t('students.infoLabels.parentContact')}
                  value={selectedStudent.parentContact}
                  icon="call-outline"
                />
                <InfoRow
                  label={t('students.infoLabels.guardian')}
                  value={selectedStudent.guardianName}
                  icon="people-outline"
                />
                <InfoRow
                  label={t('students.infoLabels.enrolled')}
                  value={formatDate(selectedStudent.enrollDate)}
                  icon="time-outline"
                />

                <View style={styles.feeSection}>
                  <Text style={styles.feeSectionTitle}>{t('students.feeInfo')}</Text>
                  <View style={styles.feeGrid}>
                    <View style={styles.feeItem}>
                      <Text style={styles.feeLabel}>{t('students.feeFee')}</Text>
                      <Text style={styles.feeValue}>
                        ${selectedStudent.fee ?? 0}
                      </Text>
                    </View>
                    <View style={styles.feeItem}>
                      <Text style={styles.feeLabel}>{t('students.feeScholarship')}</Text>
                      <Text style={[styles.feeValue, { color: COLORS.primary }]}>
                        ${selectedStudent.scholarship ?? 0}
                      </Text>
                    </View>
                    <View style={styles.feeItem}>
                      <Text style={styles.feeLabel}>{t('students.feeNet')}</Text>
                      <Text style={[styles.feeValue, { color: COLORS.blue }]}>
                        $
                        {Math.max(
                          0,
                          (selectedStudent.fee || 0) -
                            (selectedStudent.scholarship || 0)
                        )}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.actionBtnOutline}
                    onPress={() => openEditForm(selectedStudent)}
                  >
                    <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.actionBtnOutlineText}>
                      {t('students.buttons.edit')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtnOutline}
                    onPress={() =>
                      Alert.alert(
                        t('students.printComingSoonTitle'),
                        t('students.printComingSoonMsg')
                      )
                    }
                  >
                    <Ionicons name="print-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.actionBtnOutlineText}>
                      {t('students.buttons.print')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtnDanger}
                    onPress={() => handleDelete(selectedStudent)}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                    <Text style={styles.actionBtnDangerText}>
                      {t('students.buttons.delete')}
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
          <View style={[styles.modalContainer, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('students.filterTitle')}</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.filterSectionTitle}>{t('students.filterType')}</Text>
              <View style={styles.filterChipsRow}>
                {(['All', 'Full-time', 'Part-time'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.filterChip,
                      selectedType === type && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedType(type)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedType === type && styles.filterChipTextActive,
                      ]}
                    >
                      {type === 'All' ? t('students.all') : type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.filterSectionTitle, { marginTop: 20 }]}>
                {t('students.filterHalaqah')}
              </Text>
              <View style={styles.filterChipsRow}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    selectedHalaqah === 'All' && styles.filterChipActive,
                  ]}
                  onPress={() => setSelectedHalaqah('All')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedHalaqah === 'All' && styles.filterChipTextActive,
                    ]}
                  >
                    {t('students.all')}
                  </Text>
                </TouchableOpacity>
                {halaqat.map((h) => (
                  <TouchableOpacity
                    key={h._id}
                    style={[
                      styles.filterChip,
                      selectedHalaqah === h._id && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedHalaqah(h._id)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedHalaqah === h._id && styles.filterChipTextActive,
                      ]}
                    >
                      {h.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.filterSectionTitle, { marginTop: 20 }]}>
                {t('students.filterSort')}
              </Text>
              <View style={styles.filterChipsRow}>
                {[
                  { key: 'name', label: t('students.sortName') },
                  { key: 'regNo', label: t('students.sortRegNo') },
                  { key: 'enrollDate', label: t('students.sortEnrollDate') },
                ].map((s) => {
                  const active = sortConfig.key === s.key;
                  return (
                    <TouchableOpacity
                      key={s.key}
                      style={[
                        styles.filterChip,
                        active && styles.filterChipActive,
                      ]}
                      onPress={() => requestSort(s.key)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          active && styles.filterChipTextActive,
                        ]}
                      >
                        {s.label} {active ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.filterResetBtn} onPress={clearFilters}>
                <Text style={styles.filterResetBtnText}>{t('students.reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.filterApplyBtnText}>
                  {t('students.applyFilters')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ADD / EDIT FORM MODAL */}
      <Modal
        visible={formModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!saving) setFormModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {isEditing ? t('students.editTitle') : t('students.addTitle')}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {t('students.step', {
                    current: formStep === 'student' ? 1 : 2,
                    total: 2,
                  })}
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
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {formError ? (
                <View style={styles.modalErrorBox}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.red} />
                  <Text style={styles.modalErrorText}>{formError}</Text>
                </View>
              ) : null}

              {formStep === 'student' && (
                <>
                  <Text style={styles.formLabel}>
                    {t('students.fields.fullName')} *
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.name}
                    onChangeText={(v) => updateField('name', v)}
                    placeholder={t('students.placeholders.fullName')}
                    placeholderTextColor="#A0AAA5"
                  />

                  <Text style={styles.formLabel}>
                    {t('students.fields.gender')} *
                  </Text>
                  <View style={styles.chipRow}>
                    {(['Male', 'Female'] as const).map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.chip,
                          formData.gender === g && styles.chipActive,
                        ]}
                        onPress={() => updateField('gender', g)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            formData.gender === g && styles.chipTextActive,
                          ]}
                        >
                          {g}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.formLabel}>
                    {t('students.fields.studentType')} *
                  </Text>
                  <View style={styles.chipRow}>
                    {(['Full-time', 'Part-time'] as const).map((tp) => (
                      <TouchableOpacity
                        key={tp}
                        style={[
                          styles.chip,
                          formData.studentType === tp && styles.chipActive,
                        ]}
                        onPress={() => updateField('studentType', tp)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            formData.studentType === tp && styles.chipTextActive,
                          ]}
                        >
                          {tp}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.formLabel}>
                    {t('students.fields.halaqah')} *
                  </Text>
                  <View style={styles.chipRow}>
                    {halaqat.length === 0 ? (
                      <Text style={styles.formHint}>No halaqat available</Text>
                    ) : (
                      halaqat.map((h) => (
                        <TouchableOpacity
                          key={h._id}
                          style={[
                            styles.chip,
                            formData.halaqah === h._id && styles.chipActive,
                          ]}
                          onPress={() => updateField('halaqah', h._id)}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              formData.halaqah === h._id && styles.chipTextActive,
                            ]}
                          >
                            {h.name}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>

                  <Text style={styles.formLabel}>
                    {t('students.fields.residence')} *
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.residence}
                    onChangeText={(v) => updateField('residence', v)}
                    placeholder={t('students.placeholders.residence')}
                    placeholderTextColor="#A0AAA5"
                  />

                  <Text style={styles.formLabel}>{t('students.fields.dob')}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.dob}
                    onChangeText={(v) => updateField('dob', v)}
                    placeholder={t('students.placeholders.date')}
                    placeholderTextColor="#A0AAA5"
                    autoCapitalize="none"
                  />

                  <Text style={styles.formLabel}>
                    {t('students.fields.enrollDate')} *
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.enrollDate}
                    onChangeText={(v) => updateField('enrollDate', v)}
                    placeholder={t('students.placeholders.date')}
                    placeholderTextColor="#A0AAA5"
                    autoCapitalize="none"
                  />

                  {isEditing && (
                    <>
                      <Text style={styles.formLabel}>
                        {t('students.fields.regNo')}
                      </Text>
                      <TextInput
                        style={styles.formInput}
                        value={formData.regNo}
                        onChangeText={(v) => updateField('regNo', v)}
                        placeholder={t('students.placeholders.regNo')}
                        placeholderTextColor="#A0AAA5"
                      />
                    </>
                  )}
                </>
              )}

              {formStep === 'guardian' && (
                <>
                  <Text style={styles.formLabel}>
                    {t('students.fields.guardianName')} *
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.guardianName}
                    onChangeText={(v) => updateField('guardianName', v)}
                    placeholder={t('students.placeholders.guardianName')}
                    placeholderTextColor="#A0AAA5"
                  />

                  <Text style={styles.formLabel}>
                    {t('students.fields.relationship')}
                  </Text>
                  <View style={styles.chipRow}>
                    {RELATIONSHIPS.slice(0, 6).map((r) => (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.chip,
                          formData.guardianRelationship === r && styles.chipActive,
                        ]}
                        onPress={() => updateField('guardianRelationship', r)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            formData.guardianRelationship === r &&
                              styles.chipTextActive,
                          ]}
                        >
                          {r}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.formLabel}>
                    {t('students.fields.parentContact')} *
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.parentContact}
                    onChangeText={(v) => updateField('parentContact', v)}
                    placeholder={t('students.placeholders.phone')}
                    placeholderTextColor="#A0AAA5"
                    keyboardType="phone-pad"
                  />

                  <Text style={styles.formLabel}>
                    {t('students.fields.guardianPhone')}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.guardianPhone}
                    onChangeText={(v) => updateField('guardianPhone', v)}
                    placeholder={t('students.placeholders.phone')}
                    placeholderTextColor="#A0AAA5"
                    keyboardType="phone-pad"
                  />

                  <Text style={styles.formLabel}>
                    {t('students.fields.tertiaryPhone')}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.tertiaryPhone}
                    onChangeText={(v) => updateField('tertiaryPhone', v)}
                    placeholder={t('students.placeholders.phone')}
                    placeholderTextColor="#A0AAA5"
                    keyboardType="phone-pad"
                  />

                  <Text style={styles.formLabel}>
                    {t('students.fields.guardianEmail')}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.guardianEmail}
                    onChangeText={(v) => updateField('guardianEmail', v)}
                    placeholder={t('students.placeholders.email')}
                    placeholderTextColor="#A0AAA5"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />

                  <Text style={styles.formLabel}>
                    {t('students.fields.status')} *
                  </Text>
                  <View style={styles.chipRow}>
                    {(['Active', 'Inactive', 'Graduated', 'Transferred'] as const).map(
                      (s) => (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.chip,
                            formData.status === s && styles.chipActive,
                          ]}
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
                      )
                    )}
                  </View>

                  <Text style={styles.formLabel}>{t('students.fields.fee')}</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.fee}
                    onChangeText={(v) => updateField('fee', v)}
                    placeholder={t('students.placeholders.amount')}
                    placeholderTextColor="#A0AAA5"
                    keyboardType="numeric"
                  />

                  <Text style={styles.formLabel}>
                    {t('students.fields.scholarship')}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.scholarship}
                    onChangeText={(v) => updateField('scholarship', v)}
                    placeholder={t('students.placeholders.amount')}
                    placeholderTextColor="#A0AAA5"
                    keyboardType="numeric"
                  />
                </>
              )}

              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalActions}>
              {formStep === 'student' ? (
                <>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => !saving && setFormModalVisible(false)}
                    disabled={saving}
                  >
                    <Text style={styles.cancelBtnText}>
                      {t('students.buttons.cancel')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={() => {
                      const err = validateStep('student');
                      if (err) {
                        setFormError(err);
                        return;
                      }
                      setFormError('');
                      setFormStep('guardian');
                    }}
                  >
                    <Text style={styles.submitBtnText}>
                      {t('students.buttons.next')}
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setFormStep('student')}
                    disabled={saving}
                  >
                    <Text style={styles.cancelBtnText}>
                      {t('students.buttons.back')}
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
                            ? t('students.buttons.update')
                            : t('students.buttons.save')}
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

export default StudentsManagementScreen;

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
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: COLORS.slate },

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
  activeFilterText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  clearFiltersText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray,
    textDecorationLine: 'underline',
  },

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
  errorText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.red },

  loadingWrap: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: COLORS.slateMuted, fontSize: 13 },

  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },

  studentCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  studentRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  studentInfo: { flex: 1 },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.slate,
    marginBottom: 3,
  },
  studentMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  studentReg: { fontSize: 11, color: COLORS.slateMuted, fontWeight: '600' },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.gray,
    marginHorizontal: 6,
  },
  studentGender: { fontSize: 11, color: COLORS.slateMuted },
  studentTags: { flexDirection: 'row', gap: 6 },
  halaqahTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  halaqahText: { fontSize: 10, fontWeight: '600', color: COLORS.primary },
  studentRight: { alignItems: 'flex-end', marginLeft: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },

  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 16,
  },
  paginationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  paginationBtnDisabled: { opacity: 0.4 },
  paginationText: { fontSize: 13, fontWeight: '600', color: COLORS.slate },

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
  modalSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
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
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  modalAvatarText: { fontSize: 34, fontWeight: '800', color: COLORS.white },
  modalName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.slate,
    textAlign: 'center',
  },
  modalRegNo: { fontSize: 13, color: COLORS.slateMuted, marginTop: 4 },

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
  infoValue: { fontSize: 14, color: COLORS.slate, fontWeight: '600', marginTop: 2 },

  feeSection: {
    marginTop: 20,
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 16,
  },
  feeSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
    marginBottom: 12,
  },
  feeGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  feeItem: { alignItems: 'center' },
  feeLabel: {
    fontSize: 10,
    color: COLORS.slateMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  feeValue: { fontSize: 18, fontWeight: '800', color: COLORS.slate },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
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
  },
  actionBtnOutlineText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
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
  },
  actionBtnDangerText: { fontSize: 13, fontWeight: '700', color: COLORS.red },

  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 20,
    marginBottom: 10,
  },
  filterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
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
  filterChipText: { fontSize: 12, fontWeight: '600', color: COLORS.slateMuted },
  filterChipTextActive: { color: COLORS.white },
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
  filterResetBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  filterApplyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  filterApplyBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
    marginTop: 14,
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
  formHint: { fontSize: 11, color: COLORS.gray, fontStyle: 'italic' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.slateMuted },
  chipTextActive: { color: '#fff' },

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
  },
  modalErrorText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.red },

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