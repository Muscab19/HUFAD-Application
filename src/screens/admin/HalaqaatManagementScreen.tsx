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
  pink: '#DB2777',
  pinkLight: '#FCE7F3',
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
type HalaqahType =
  | 'Memorization and Revision'
  | 'Reading and Writing'
  | 'Tashis'
  | 'Ijazah'
  | 'Other';
type GenderCategory = 'Male' | 'Female' | 'Both';
type TimeType = 'Part-time' | 'Full-time';
type Status = 'Assigned' | 'Unassigned';

interface TeacherRef {
  _id: string;
  name: string;
  gender: 'Male' | 'Female';
}

interface ScheduleDay {
  day: string;
  active: boolean;
  from: string;
  to: string;
}

interface Halaqah {
  _id: string;
  name: string;
  type: HalaqahType;
  gender: GenderCategory;
  timeType: TimeType;
  price?: number;
  status: Status;
  teachers: TeacherRef[];
  studentCount: number;
  schedule: ScheduleDay[];
  createdAt: string;
}

interface FormState {
  name: string;
  type: HalaqahType;
  gender: GenderCategory;
  timeType: TimeType;
  teachers: TeacherRef[];
  schedule: ScheduleDay[];
}

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const HALAQA_TYPES: HalaqahType[] = [
  'Memorization and Revision',
  'Reading and Writing',
  'Tashis',
  'Ijazah',
  'Other',
];
const GENDER_CATEGORIES: GenderCategory[] = ['Male', 'Female', 'Both'];
const TIME_TYPES: TimeType[] = ['Part-time', 'Full-time'];

const getEmptyForm = (): FormState => ({
  name: '',
  type: 'Memorization and Revision',
  gender: 'Male',
  timeType: 'Part-time',
  teachers: [],
  schedule: DAYS.map((day) => ({ day, active: false, from: '', to: '' })),
});

// ============================================================
// TRANSLATION KEY MAPS
// ============================================================
const TYPE_KEY: Record<HalaqahType, string> = {
  'Memorization and Revision': 'memorization',
  'Reading and Writing': 'reading',
  Tashis: 'tashis',
  Ijazah: 'ijazah',
  Other: 'other',
};

const DAY_KEY: Record<string, string> = {
  Saturday: 'saturday',
  Sunday: 'sunday',
  Monday: 'monday',
  Tuesday: 'tuesday',
  Wednesday: 'wednesday',
  Thursday: 'thursday',
  Friday: 'friday',
};

const GENDER_KEY: Record<GenderCategory, string> = {
  Male: 'male',
  Female: 'female',
  Both: 'both',
};

const TIME_TYPE_KEY: Record<TimeType, string> = {
  'Part-time': 'partTime',
  'Full-time': 'fullTime',
};

const STATUS_KEY: Record<Status, string> = {
  Assigned: 'assigned',
  Unassigned: 'unassigned',
};

// ============================================================
// HELPERS (styles stay, translation through t)
// ============================================================
const getInitials = (name: string) => {
  const parts = (name || '').trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || '').substring(0, 2).toUpperCase();
};

const getTypeStyle = (type: HalaqahType) => {
  switch (type) {
    case 'Memorization and Revision':
      return { bg: COLORS.purpleLight, text: COLORS.purple };
    case 'Reading and Writing':
      return { bg: COLORS.blueLight, text: COLORS.blue };
    case 'Tashis':
      return { bg: COLORS.primaryLight, text: COLORS.primary };
    case 'Ijazah':
      return { bg: COLORS.goldLight, text: COLORS.gold };
    default:
      return { bg: '#F1F5F9', text: COLORS.gray };
  }
};

const getGenderStyle = (g: GenderCategory) => {
  if (g === 'Male') return { bg: COLORS.blueLight, text: COLORS.blue };
  if (g === 'Female') return { bg: COLORS.pinkLight, text: COLORS.pink };
  return { bg: '#F1F5F9', text: COLORS.gray };
};

const getStatusStyle = (s: Status) => {
  if (s === 'Assigned') return { bg: COLORS.primaryLight, text: COLORS.primary };
  return { bg: COLORS.amberLight, text: COLORS.amber };
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
export const HalaqaatManagementScreen: React.FC = () => {
  const { t } = useTranslation();
  const { currentBranch } = useBranch();

  const [halaqaat, setHalaqaat] = useState<Halaqah[]>([]);
  const [allTeachers, setAllTeachers] = useState<TeacherRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedType, setSelectedType] = useState<'All' | HalaqahType>('All');
  const [selectedStatus, setSelectedStatus] = useState<'All' | Status>('All');

  const [selectedHalaqah, setSelectedHalaqah] = useState<Halaqah | null>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormState>(getEmptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedTeachers, setSelectedTeachers] = useState<TeacherRef[]>([]);

  const [copyScheduleVisible, setCopyScheduleVisible] = useState(false);

  useEffect(() => {
    const tmr = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(tmr);
  }, [searchTerm]);

  // ============================================================
  // FETCH
  // ============================================================
  const fetchHalaqaat = useCallback(async () => {
    setError('');
    try {
      const params: Record<string, any> = {};
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (selectedType !== 'All') params.type = selectedType;
      if (selectedStatus !== 'All') params.status = selectedStatus;

      const res: any = await apiClient.get('/halaqaat', params);
      const list: Halaqah[] = res?.halaqaat || res?.halaqat || res?.data || [];
      setHalaqaat(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Fetch halaqaat error:', err);
      setError(err?.message || 'Failed to load halaqaat.');
      setHalaqaat([]);
    }
  }, [debouncedSearch, selectedType, selectedStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchHalaqaat();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchHalaqaat]);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await apiClient.get('/teachers', {
          status: 'Active',
          limit: 1000,
        });
        const list = res?.teachers || res?.data || [];
        setAllTeachers(Array.isArray(list) ? list : []);
      } catch (err) {
        console.warn('Failed to load teachers:', err);
      }
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHalaqaat();
    setRefreshing(false);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedType('All');
    setSelectedStatus('All');
  };

  const hasActiveFilters =
    !!searchTerm || selectedType !== 'All' || selectedStatus !== 'All';

  const stats = useMemo(() => {
    const totalStudents = halaqaat.reduce(
      (sum, h) => sum + (h.studentCount || 0),
      0
    );
    const assignedCount = halaqaat.filter((h) => h.status === 'Assigned').length;
    return { totalStudents, assignedCount, total: halaqaat.length };
  }, [halaqaat]);

  // ============================================================
  // FORM
  // ============================================================
  const openAddForm = () => {
    setIsEditing(false);
    setFormData(getEmptyForm());
    setFormError('');
    setFormModalVisible(true);
  };

  const openEditForm = (h: Halaqah) => {
    setIsEditing(true);
    setFormData({
      name: h.name || '',
      type: h.type || 'Memorization and Revision',
      gender: h.gender || 'Male',
      timeType: h.timeType || 'Part-time',
      teachers: (h.teachers || []).map((t) => ({
        _id: typeof t === 'string' ? t : t._id,
        name: typeof t === 'string' ? '' : t.name,
        gender: typeof t === 'string' ? 'Male' : t.gender,
      })),
      schedule:
        h.schedule && h.schedule.length === 7
          ? h.schedule
          : DAYS.map((day) => ({ day, active: false, from: '', to: '' })),
    });
    setFormError('');
    setViewModalVisible(false);
    setFormModalVisible(true);
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTeacherInForm = (teacher: TeacherRef) => {
    setFormData((prev) => {
      const exists = prev.teachers.some((t) => t._id === teacher._id);
      return {
        ...prev,
        teachers: exists
          ? prev.teachers.filter((t) => t._id !== teacher._id)
          : [...prev.teachers, teacher],
      };
    });
  };

  const updateScheduleDay = (
    index: number,
    field: keyof ScheduleDay,
    value: any
  ) => {
    setFormData((prev) => {
      const next = [...prev.schedule];
      next[index] = { ...next[index], [field]: value };
      if (field === 'active' && value === false) {
        next[index].from = '';
        next[index].to = '';
      }
      return { ...prev, schedule: next };
    });
  };

  const copyToAllDays = () => {
    const firstActive = formData.schedule.find((d) => d.active);
    if (!firstActive) {
      Alert.alert(t('halaqaat.noActiveDayTitle'), t('halaqaat.noActiveDayMsg'));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      schedule: prev.schedule.map((d) => ({
        ...d,
        active: true,
        from: firstActive.from,
        to: firstActive.to,
      })),
    }));
  };

  const copyScheduleFrom = (h: Halaqah) => {
    if (!h.schedule || h.schedule.length !== 7) return;
    setFormData((prev) => ({
      ...prev,
      schedule: h.schedule.map((d) => ({ ...d })),
    }));
    setCopyScheduleVisible(false);
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return t('halaqaat.validation.nameRequired');
    return null;
  };

  const handleSave = async () => {
    if (!currentBranch?._id) {
      setFormError(t('halaqaat.branchRequired'));
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
      const payload = {
        name: formData.name.trim(),
        type: formData.type,
        gender: formData.gender,
        timeType: formData.timeType,
        teachers: formData.teachers.map((t) => ({
          _id: t._id,
          name: t.name,
          gender: t.gender,
        })),
        schedule: formData.schedule,
        branchId: currentBranch._id,
      };

      if (isEditing && selectedHalaqah) {
        await apiClient.put(`/halaqaat/${selectedHalaqah._id}`, payload);
      } else {
        await apiClient.post('/halaqaat', payload);
      }

      setFormModalVisible(false);
      setSelectedHalaqah(null);
      await fetchHalaqaat();
      Alert.alert(
        t('halaqaat.successTitle'),
        isEditing ? t('halaqaat.updatedMsg') : t('halaqaat.createdMsg'),
      );
    } catch (err: any) {
      console.error('Save halaqah error:', err);
      setFormError(
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to save halaqah.'
      );
    } finally {
      setSaving(false);
    }
  };

  const openViewModal = (h: Halaqah) => {
    setSelectedHalaqah(h);
    setViewModalVisible(true);
  };

  const handleDelete = (h: Halaqah) => {
    Alert.alert(
      t('halaqaat.deleteTitle'),
      t('halaqaat.deleteMsg', { name: h.name }),
      [
        { text: t('halaqaat.cancel'), style: 'cancel' },
        {
          text: t('halaqaat.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/halaqaat/${h._id}`);
              setViewModalVisible(false);
              await fetchHalaqaat();
              Alert.alert(t('halaqaat.deletedTitle'), t('halaqaat.deletedMsg'));
            } catch (err: any) {
              Alert.alert(t('halaqaat.errorTitle'), err?.message || 'Failed to delete.');
            }
          },
        },
      ]
    );
  };

  const openAssignModal = (h: Halaqah) => {
    setSelectedHalaqah(h);
    setSelectedTeachers(
      (h.teachers || []).map((t) => ({
        _id: typeof t === 'string' ? t : t._id,
        name: typeof t === 'string' ? '' : t.name,
        gender: typeof t === 'string' ? 'Male' : t.gender,
      }))
    );
    setAssignModalVisible(true);
  };

  const toggleSelectedTeacher = (teacher: TeacherRef) => {
    setSelectedTeachers((prev) => {
      const exists = prev.some((t) => t._id === teacher._id);
      return exists
        ? prev.filter((t) => t._id !== teacher._id)
        : [...prev, teacher];
    });
  };

  const handleAssignTeachers = async () => {
    if (!selectedHalaqah) return;
    try {
      setSaving(true);
      await apiClient.patch(
        `/halaqaat/${selectedHalaqah._id}/assign-teachers`,
        { teachers: selectedTeachers }
      );
      setAssignModalVisible(false);
      await fetchHalaqaat();
      Alert.alert(t('halaqaat.successTitle'), t('halaqaat.teachersAssigned'));
    } catch (err: any) {
      Alert.alert(t('halaqaat.errorTitle'), err?.message || 'Failed to assign teachers.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTeacher = (h: Halaqah, teacherId: string) => {
    Alert.alert(t('halaqaat.removeTeacherTitle'), t('halaqaat.removeTeacherMsg'), [
      { text: t('halaqaat.cancel'), style: 'cancel' },
      {
        text: t('halaqaat.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.patch(
              `/halaqaat/${h._id}/remove-teacher/${teacherId}`
            );
            const fresh: any = await apiClient.get('/halaqaat');
            const list = fresh?.halaqaat || fresh?.data || [];
            const updated = (list as Halaqah[]).find((x) => x._id === h._id);
            if (updated) setSelectedHalaqah(updated);
            await fetchHalaqaat();
          } catch (err: any) {
            Alert.alert(t('halaqaat.errorTitle'), err?.message || 'Failed to remove teacher.');
          }
        },
      },
    ]);
  };

  // ============================================================
  // RENDER
  // ============================================================
  const renderHalaqah = ({ item }: { item: Halaqah }) => {
    const typeStyle = getTypeStyle(item.type);
    const statusStyle = getStatusStyle(item.status);
    const typeLabel = t(`halaqaat.types.${TYPE_KEY[item.type]}`);

    return (
      <TouchableOpacity
        style={styles.halaqahCard}
        activeOpacity={0.7}
        onPress={() => openViewModal(item)}
      >
        <View style={styles.halaqahRow}>
          <View style={[styles.halaqahIcon, { backgroundColor: typeStyle.bg }]}>
            <Ionicons name="book" size={22} color={typeStyle.text} />
          </View>

          <View style={styles.halaqahInfo}>
            <Text style={styles.halaqahName} numberOfLines={1}>
              {item.name}
            </Text>

            <View style={styles.halaqahMetaRow}>
              <View style={[styles.typeTag, { backgroundColor: typeStyle.bg }]}>
                <Text style={[styles.typeText, { color: typeStyle.text }]}>
                  {typeLabel}
                </Text>
              </View>
              <View
                style={[
                  styles.genderTag,
                  { backgroundColor: getGenderStyle(item.gender).bg },
                ]}
              >
                <Text
                  style={[
                    styles.genderText,
                    { color: getGenderStyle(item.gender).text },
                  ]}
                >
                  {t(`halaqaat.genders.${GENDER_KEY[item.gender]}`)}
                </Text>
              </View>
            </View>

            <View style={styles.halaqahMetaRow2}>
              <Ionicons name="people-outline" size={11} color={COLORS.slateMuted} />
              <Text style={styles.metaText}>
                {t('halaqaat.studentsCount', { count: item.studentCount || 0 })}
              </Text>
              <View style={styles.metaDot} />
              <Ionicons name="person-outline" size={11} color={COLORS.slateMuted} />
              <Text style={styles.metaText}>
                {t('halaqaat.teachersCount', { count: (item.teachers || []).length })}
              </Text>
            </View>
          </View>

          <View style={styles.halaqahRight}>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {t(`halaqaat.statuses.${STATUS_KEY[item.status]}`)}
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('halaqaat.headerTitle')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('halaqaat.headerSubtitle', { count: halaqaat.length })}
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

      {/* SUMMARY */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: COLORS.purpleLight }]}>
            <Ionicons name="book" size={16} color={COLORS.purple} />
          </View>
          <Text style={styles.summaryValue}>{stats.total}</Text>
          <Text style={styles.summaryLabel}>{t('halaqaat.summary.halaqaat')}</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: COLORS.primaryLight }]}>
            <Ionicons name="people" size={16} color={COLORS.primary} />
          </View>
          <Text style={styles.summaryValue}>{stats.totalStudents}</Text>
          <Text style={styles.summaryLabel}>{t('halaqaat.summary.students')}</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: COLORS.amberLight }]}>
            <Ionicons name="person-add" size={16} color={COLORS.amber} />
          </View>
          <Text style={styles.summaryValue}>
            {stats.assignedCount}/{stats.total}
          </Text>
          <Text style={styles.summaryLabel}>{t('halaqaat.summary.assigned')}</Text>
        </View>
      </View>

      {/* SEARCH */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('halaqaat.searchPlaceholder')}
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

      {/* ACTIVE FILTERS */}
      {hasActiveFilters && (
        <View style={styles.activeFiltersRow}>
          {selectedType !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {t(`halaqaat.types.${TYPE_KEY[selectedType]}`)}
              </Text>
              <TouchableOpacity onPress={() => setSelectedType('All')}>
                <Ionicons name="close" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
          {selectedStatus !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {t(`halaqaat.statuses.${STATUS_KEY[selectedStatus]}`)}
              </Text>
              <TouchableOpacity onPress={() => setSelectedStatus('All')}>
                <Ionicons name="close" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearFiltersText}>{t('halaqaat.clearAll')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ERROR BANNER */}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError('')}>
            <Ionicons name="close" size={16} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* LIST */}
      {loading && halaqaat.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('halaqaat.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={halaqaat}
          keyExtractor={(item) => item._id}
          renderItem={renderHalaqah}
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
              <Ionicons name="book-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>{t('halaqaat.noResultsTitle')}</Text>
              <Text style={styles.emptyText}>
                {hasActiveFilters
                  ? t('halaqaat.noResultsFiltered')
                  : t('halaqaat.noResultsEmpty')}
              </Text>
              {hasActiveFilters ? (
                <TouchableOpacity style={styles.emptyButton} onPress={clearFilters}>
                  <Text style={styles.emptyButtonText}>
                    {t('halaqaat.clearFilters')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.emptyButton} onPress={openAddForm}>
                  <Text style={styles.emptyButtonText}>
                    {t('halaqaat.addHalaqah')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* ============ VIEW MODAL ============ */}
      <Modal
        visible={viewModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('halaqaat.details')}</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setViewModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            {selectedHalaqah && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.modalProfile}>
                  <View
                    style={[
                      styles.modalAvatar,
                      { backgroundColor: getTypeStyle(selectedHalaqah.type).text },
                    ]}
                  >
                    <Ionicons name="book" size={36} color={COLORS.white} />
                  </View>
                  <Text style={styles.modalName}>{selectedHalaqah.name}</Text>
                  <View style={styles.modalBadgeRow}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusStyle(selectedHalaqah.status).bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusStyle(selectedHalaqah.status).text },
                        ]}
                      >
                        {t(`halaqaat.statuses.${STATUS_KEY[selectedHalaqah.status]}`)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getTypeStyle(selectedHalaqah.type).bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getTypeStyle(selectedHalaqah.type).text },
                        ]}
                      >
                        {t(`halaqaat.types.${TYPE_KEY[selectedHalaqah.type]}`)}
                      </Text>
                    </View>
                  </View>
                </View>

                <InfoRow
                  label={t('halaqaat.infoLabels.category')}
                  value={t(`halaqaat.genders.${GENDER_KEY[selectedHalaqah.gender]}`)}
                  icon="people-outline"
                />
                <InfoRow
                  label={t('halaqaat.infoLabels.timeType')}
                  value={t(`halaqaat.timeTypes.${TIME_TYPE_KEY[selectedHalaqah.timeType]}`)}
                  icon="time-outline"
                />
                <InfoRow
                  label={t('halaqaat.infoLabels.students')}
                  value={t('halaqaat.enrolled', { count: selectedHalaqah.studentCount || 0 })}
                  icon="school-outline"
                />
                <InfoRow
                  label={t('halaqaat.infoLabels.created')}
                  value={
                    selectedHalaqah.createdAt
                      ? new Date(selectedHalaqah.createdAt).toLocaleDateString()
                      : '—'
                  }
                  icon="calendar-outline"
                />

                {/* Teachers */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>
                      {t('halaqaat.teachersSection', {
                        count: (selectedHalaqah.teachers || []).length,
                      })}
                    </Text>
                    <TouchableOpacity
                      style={styles.assignBtn}
                      onPress={() => {
                        setViewModalVisible(false);
                        openAssignModal(selectedHalaqah);
                      }}
                    >
                      <Ionicons name="person-add-outline" size={14} color={COLORS.primary} />
                      <Text style={styles.assignBtnText}>{t('halaqaat.assign')}</Text>
                    </TouchableOpacity>
                  </View>

                  {(selectedHalaqah.teachers || []).length === 0 ? (
                    <Text style={styles.emptySmall}>
                      {t('halaqaat.noTeachersAssigned')}
                    </Text>
                  ) : (
                    (selectedHalaqah.teachers || []).map((tt) => {
                      const teacherId = typeof tt === 'string' ? tt : tt._id;
                      const teacherName = typeof tt === 'string' ? '—' : tt.name;
                      const teacherGender = typeof tt === 'string' ? 'Male' : tt.gender;
                      return (
                        <View key={teacherId} style={styles.teacherCard}>
                          <View style={styles.teacherAvatar}>
                            <Text style={styles.teacherAvatarText}>
                              {getInitials(teacherName)}
                            </Text>
                          </View>
                          <Text style={styles.teacherName}>{teacherName}</Text>
                          <View
                            style={[
                              styles.genderTag,
                              { backgroundColor: getGenderStyle(teacherGender).bg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.genderText,
                                { color: getGenderStyle(teacherGender).text },
                              ]}
                            >
                              {t(`halaqaat.genders.${GENDER_KEY[teacherGender]}`)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() =>
                              handleRemoveTeacher(selectedHalaqah, teacherId)
                            }
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="close-circle" size={18} color={COLORS.red} />
                          </TouchableOpacity>
                        </View>
                      );
                    })
                  )}
                </View>

                {/* Schedule */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{t('halaqaat.weeklySchedule')}</Text>
                  {(selectedHalaqah.schedule || []).map((day) => (
                    <View key={day.day} style={styles.scheduleRow}>
                      <Text style={styles.scheduleDay}>
                        {t(`halaqaat.days.${DAY_KEY[day.day]}`)}
                      </Text>
                      {day.active ? (
                        <Text style={styles.scheduleTime}>
                          {day.from || '—'} - {day.to || '—'}
                        </Text>
                      ) : (
                        <Text style={styles.scheduleOff}>{t('halaqaat.off')}</Text>
                      )}
                    </View>
                  ))}
                </View>

                {/* Actions */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.actionBtnOutline}
                    onPress={() => openEditForm(selectedHalaqah)}
                  >
                    <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.actionBtnOutlineText}>
                      {t('halaqaat.buttons.edit')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtnDanger}
                    onPress={() => handleDelete(selectedHalaqah)}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                    <Text style={styles.actionBtnDangerText}>
                      {t('halaqaat.buttons.delete')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ============ FILTER MODAL ============ */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '70%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('halaqaat.filterTitle')}</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.filterSectionTitle}>{t('halaqaat.filterType')}</Text>
              <View style={styles.filterChipsRow}>
                {(['All', ...HALAQA_TYPES] as const).map((tp) => (
                  <TouchableOpacity
                    key={tp}
                    style={[
                      styles.filterChip,
                      selectedType === tp && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedType(tp as any)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedType === tp && styles.filterChipTextActive,
                      ]}
                    >
                      {tp === 'All'
                        ? t('halaqaat.all')
                        : t(`halaqaat.types.${TYPE_KEY[tp as HalaqahType]}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.filterSectionTitle, { marginTop: 20 }]}>
                {t('halaqaat.filterStatus')}
              </Text>
              <View style={styles.filterChipsRow}>
                {(['All', 'Assigned', 'Unassigned'] as const).map((s) => (
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
                      {s === 'All'
                        ? t('halaqaat.all')
                        : t(`halaqaat.statuses.${STATUS_KEY[s as Status]}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.filterResetBtn} onPress={clearFilters}>
                <Text style={styles.filterResetBtnText}>{t('halaqaat.reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.filterApplyBtnText}>{t('halaqaat.apply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============ FORM MODAL ============ */}
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
                {isEditing ? t('halaqaat.editTitle') : t('halaqaat.addTitle')}
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

              <Text style={styles.formLabel}>{t('halaqaat.fields.name')} *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.name}
                onChangeText={(v) => updateField('name', v)}
                placeholder={t('halaqaat.placeholders.name')}
                placeholderTextColor="#A0AAA5"
              />

              <Text style={styles.formLabel}>{t('halaqaat.fields.type')} *</Text>
              <View style={styles.chipRow}>
                {HALAQA_TYPES.map((tp) => (
                  <TouchableOpacity
                    key={tp}
                    style={[styles.chip, formData.type === tp && styles.chipActive]}
                    onPress={() => updateField('type', tp)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        formData.type === tp && styles.chipTextActive,
                      ]}
                    >
                      {t(`halaqaat.types.${TYPE_KEY[tp]}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>{t('halaqaat.fields.category')} *</Text>
              <View style={styles.chipRow}>
                {GENDER_CATEGORIES.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.chip, formData.gender === g && styles.chipActive]}
                    onPress={() => updateField('gender', g)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        formData.gender === g && styles.chipTextActive,
                      ]}
                    >
                      {t(`halaqaat.genders.${GENDER_KEY[g]}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>{t('halaqaat.fields.timeType')} *</Text>
              <View style={styles.chipRow}>
                {TIME_TYPES.map((tp) => (
                  <TouchableOpacity
                    key={tp}
                    style={[styles.chip, formData.timeType === tp && styles.chipActive]}
                    onPress={() => updateField('timeType', tp)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        formData.timeType === tp && styles.chipTextActive,
                      ]}
                    >
                      {t(`halaqaat.timeTypes.${TIME_TYPE_KEY[tp]}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>{t('halaqaat.fields.teachers')}</Text>
              <View style={styles.teacherPicker}>
                {allTeachers
                  .filter(
                    (tt) =>
                      formData.gender === 'Both' || tt.gender === formData.gender
                  )
                  .map((tt) => {
                    const selected = formData.teachers.some(
                      (x) => x._id === tt._id
                    );
                    return (
                      <TouchableOpacity
                        key={tt._id}
                        style={styles.pickerRow}
                        onPress={() => toggleTeacherInForm(tt)}
                      >
                        <Ionicons
                          name={selected ? 'checkbox' : 'square-outline'}
                          size={18}
                          color={selected ? COLORS.primary : COLORS.gray}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pickerName}>{tt.name}</Text>
                          <Text style={styles.pickerMeta}>
                            {t(`halaqaat.genders.${GENDER_KEY[tt.gender]}`)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                {allTeachers.length === 0 && (
                  <Text style={styles.formHint}>
                    {t('halaqaat.noTeachersAvailable')}
                  </Text>
                )}
              </View>

              {/* Schedule */}
              <View style={styles.scheduleHeaderRow}>
                <Text style={styles.formLabel}>{t('halaqaat.weeklySchedule')}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.smallOutlineBtn}
                    onPress={copyToAllDays}
                  >
                    <Ionicons name="copy-outline" size={12} color={COLORS.primary} />
                    <Text style={styles.smallOutlineBtnText}>
                      {t('halaqaat.copyToAll')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.smallOutlineBtn}
                    onPress={() => setCopyScheduleVisible(true)}
                  >
                    <Ionicons name="albums-outline" size={12} color={COLORS.primary} />
                    <Text style={styles.smallOutlineBtnText}>
                      {t('halaqaat.copyFromAnother')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {formData.schedule.map((d, i) => (
                <View key={d.day} style={styles.scheduleEditorRow}>
                  <TouchableOpacity
                    style={styles.scheduleDayToggle}
                    onPress={() => updateScheduleDay(i, 'active', !d.active)}
                  >
                    <Ionicons
                      name={d.active ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={d.active ? COLORS.primary : COLORS.gray}
                    />
                    <Text
                      style={[
                        styles.scheduleEditorDay,
                        d.active && { color: COLORS.primary, fontWeight: '800' },
                      ]}
                    >
                      {t(`halaqaat.days.${DAY_KEY[d.day]}`)}
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.scheduleTimeInput, !d.active && { opacity: 0.4 }]}
                    placeholder={t('halaqaat.placeholders.timeFrom')}
                    placeholderTextColor="#A0AAA5"
                    value={d.from}
                    onChangeText={(v) => updateScheduleDay(i, 'from', v)}
                    editable={d.active}
                  />
                  <Text style={{ color: COLORS.gray }}>—</Text>
                  <TextInput
                    style={[styles.scheduleTimeInput, !d.active && { opacity: 0.4 }]}
                    placeholder={t('halaqaat.placeholders.timeTo')}
                    placeholderTextColor="#A0AAA5"
                    value={d.to}
                    onChangeText={(v) => updateScheduleDay(i, 'to', v)}
                    editable={d.active}
                  />
                </View>
              ))}

              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalActionsFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => !saving && setFormModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>{t('halaqaat.cancel')}</Text>
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
                      {isEditing ? t('halaqaat.update') : t('halaqaat.save')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============ ASSIGN TEACHERS MODAL ============ */}
      <Modal
        visible={assignModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('halaqaat.assignTeachersTitle')}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setAssignModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>
                {t('halaqaat.assignSelected', { count: selectedTeachers.length })}
              </Text>
              {allTeachers
                .filter(
                  (tt) =>
                    !selectedHalaqah ||
                    selectedHalaqah.gender === 'Both' ||
                    tt.gender === selectedHalaqah.gender
                )
                .map((tt) => {
                  const sel = selectedTeachers.some((x) => x._id === tt._id);
                  return (
                    <TouchableOpacity
                      key={tt._id}
                      style={styles.pickerRow}
                      onPress={() => toggleSelectedTeacher(tt)}
                    >
                      <Ionicons
                        name={sel ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={sel ? COLORS.primary : COLORS.gray}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerName}>{tt.name}</Text>
                        <Text style={styles.pickerMeta}>
                          {t(`halaqaat.genders.${GENDER_KEY[tt.gender]}`)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
            <View style={styles.modalActionsFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setAssignModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>{t('halaqaat.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, saving && { opacity: 0.7 }]}
                onPress={handleAssignTeachers}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.submitBtnText}>{t('halaqaat.save')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============ COPY SCHEDULE MODAL ============ */}
      <Modal
        visible={copyScheduleVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCopyScheduleVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '70%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('halaqaat.copyScheduleTitle')}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setCopyScheduleVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {halaqaat
                .filter((x) => x._id !== selectedHalaqah?._id)
                .map((x) => (
                  <TouchableOpacity
                    key={x._id}
                    style={styles.pickerRow}
                    onPress={() => copyScheduleFrom(x)}
                  >
                    <View
                      style={[
                        styles.halaqahIconSmall,
                        { backgroundColor: getTypeStyle(x.type).bg },
                      ]}
                    >
                      <Ionicons
                        name="book"
                        size={14}
                        color={getTypeStyle(x.type).text}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerName}>{x.name}</Text>
                      <Text style={styles.pickerMeta}>
                        {t(`halaqaat.types.${TYPE_KEY[x.type]}`)} •{' '}
                        {t(`halaqaat.genders.${GENDER_KEY[x.gender]}`)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
                  </TouchableOpacity>
                ))}
              {halaqaat.filter((x) => x._id !== selectedHalaqah?._id).length === 0 && (
                <Text style={styles.formHint}>
                  {t('halaqaat.noCopyTargets')}
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default HalaqaatManagementScreen;

// ============================================================
// STYLES (unchanged)
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16,
    paddingTop: 12, paddingBottom: 8,
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
    backgroundColor: COLORS.white, borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1, borderColor: COLORS.border, height: 44,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: COLORS.slate },

  activeFiltersRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8, gap: 8, flexWrap: 'wrap',
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

  halaqahCard: {
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  halaqahRow: { flexDirection: 'row', alignItems: 'center' },
  halaqahIcon: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  halaqahIconSmall: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  halaqahInfo: { flex: 1 },
  halaqahName: {
    fontSize: 15, fontWeight: '700',
    color: COLORS.slate, marginBottom: 5,
  },
  halaqahMetaRow: {
    flexDirection: 'row', gap: 5,
    marginBottom: 5, flexWrap: 'wrap',
  },
  typeTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeText: { fontSize: 10, fontWeight: '700' },
  genderTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  genderText: { fontSize: 10, fontWeight: '700' },
  halaqahMetaRow2: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 10, color: COLORS.slateMuted, fontWeight: '600' },
  metaDot: {
    width: 3, height: 3, borderRadius: 2,
    backgroundColor: COLORS.gray, marginHorizontal: 4,
  },
  halaqahRight: { alignItems: 'flex-end', marginLeft: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },

  emptyContainer: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 60, paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.slate, marginTop: 16 },
  emptyText: {
    fontSize: 13, color: COLORS.slateMuted,
    textAlign: 'center', marginTop: 8, lineHeight: 20,
  },
  emptyButton: {
    marginTop: 20, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: COLORS.primary, borderRadius: 10,
  },
  emptyButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  emptySmall: {
    fontSize: 12, color: COLORS.slateMuted,
    fontStyle: 'italic', paddingVertical: 8,
  },

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
  modalCloseBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { paddingHorizontal: 20 },
  modalProfile: { alignItems: 'center', paddingVertical: 20 },
  modalAvatar: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  modalName: {
    fontSize: 20, fontWeight: '800',
    color: COLORS.slate, textAlign: 'center',
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
  infoValue: {
    fontSize: 14, color: COLORS.slate,
    fontWeight: '600', marginTop: 2,
  },

  section: { marginTop: 20 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: COLORS.slate },
  assignBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  assignBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  teacherCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 10, backgroundColor: COLORS.background,
    borderRadius: 12, marginBottom: 8, gap: 8,
  },
  teacherAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  teacherAvatarText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  teacherName: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.slate },

  scheduleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: COLORS.background,
    borderRadius: 10, marginBottom: 6,
  },
  scheduleDay: { fontSize: 13, fontWeight: '700', color: COLORS.slate },
  scheduleTime: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  scheduleOff: {
    fontSize: 12, fontWeight: '600',
    color: COLORS.gray, fontStyle: 'italic',
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
  formHint: { fontSize: 11, color: COLORS.gray, fontStyle: 'italic', paddingVertical: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.slateMuted },
  chipTextActive: { color: '#fff' },

  teacherPicker: {
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 8, maxHeight: 220,
    backgroundColor: COLORS.white,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  pickerName: { fontSize: 13, fontWeight: '700', color: COLORS.slate },
  pickerMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },

  scheduleHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 14, marginBottom: 8,
  },
  smallOutlineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  smallOutlineBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  scheduleEditorRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, gap: 8,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  scheduleDayToggle: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, width: 110,
  },
  scheduleEditorDay: {
    fontSize: 13, fontWeight: '600', color: COLORS.slateMuted,
  },
  scheduleTimeInput: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6,
    fontSize: 13, color: COLORS.slate, textAlign: 'center',
  },

  modalErrorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.redLight,
    borderWidth: 1, borderColor: '#F6C8C8',
    borderRadius: 10, padding: 10, marginTop: 12,
  },
  modalErrorText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.red },

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