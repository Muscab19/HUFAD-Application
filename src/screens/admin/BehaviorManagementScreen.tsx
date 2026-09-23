// src/screens/admin/BehaviorManagementScreen.tsx
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

// ============================================================
// COLORS
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
type BehaviorType = 'good' | 'bad';
type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
type Location = 'inside' | 'outside';
type Status = 'pending' | 'archived';

interface Behavior {
  _id: string;
  studentId: string | { _id: string; name: string };
  studentName?: string;
  halaqah?: string;
  type: BehaviorType;
  severity: Severity;
  description: string;
  points: number;
  location: Location;
  locationDetails?: string;
  date: string;
  recordedByName?: string;
  recordedBy?: string | { name: string };
  notes?: string;
  status: Status;
}

interface Student {
  _id: string;
  name: string;
  studentId?: string;
  class?: string;
  halaqah?: { _id: string; name: string } | string;
  halaqahId?: string;
}

interface Halaqah {
  _id: string;
  name: string;
}

const SEVERITIES: Severity[] = ['Low', 'Medium', 'High', 'Critical'];
const LOCATIONS: Location[] = ['inside', 'outside'];

// ============================================================
// TRANSLATION KEY MAPS
// ============================================================
const TYPE_KEY: Record<BehaviorType, string> = {
  good: 'good',
  bad: 'bad',
};
const SEVERITY_KEY: Record<Severity, string> = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical',
};
const LOCATION_KEY: Record<Location, string> = {
  inside: 'inside',
  outside: 'outside',
};
const STATUS_KEY: Record<Status, string> = {
  pending: 'pending',
  archived: 'archived',
};

// ============================================================
// HELPERS
// ============================================================
const getInitials = (name: string) => {
  const parts = (name || '').trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || '').substring(0, 2).toUpperCase();
};

const getStudentName = (
  b: Behavior,
  students: Student[],
  fallback: string
): string => {
  const sid = typeof b.studentId === 'object' ? b.studentId?._id : b.studentId;
  const found = students.find((s) => s._id === sid);
  if (found) return found.name;
  if (b.studentName) return b.studentName;
  if (typeof b.studentId === 'object' && b.studentId?.name) return b.studentId.name;
  return fallback;
};

const getStudentHalaqah = (student: Student): string => {
  if (typeof student.halaqah === 'object' && student.halaqah?.name)
    return student.halaqah.name;
  if (typeof student.halaqah === 'string') return student.halaqah;
  return '';
};

const getStudentHalaqahId = (student: Student): string => {
  if (typeof student.halaqah === 'object' && student.halaqah?._id)
    return student.halaqah._id;
  if (student.halaqahId) return student.halaqahId;
  return '';
};

const getRecordedByName = (b: Behavior, fallback: string): string => {
  if (!b.recordedBy) return b.recordedByName || fallback;
  if (typeof b.recordedBy === 'object') return b.recordedBy.name || fallback;
  return b.recordedBy;
};

const getSeverityStyle = (s: Severity) => {
  switch (s) {
    case 'Low':
      return { bg: COLORS.blueLight, text: COLORS.blue };
    case 'Medium':
      return { bg: COLORS.amberLight, text: COLORS.amber };
    case 'High':
      return { bg: '#FED7AA', text: '#C2410C' };
    case 'Critical':
      return { bg: COLORS.redLight, text: COLORS.red };
    default:
      return { bg: COLORS.background, text: COLORS.slateMuted };
  }
};

const getTypeStyle = (t: BehaviorType) => {
  if (t === 'good') return { bg: COLORS.primaryLight, text: COLORS.primary };
  return { bg: COLORS.redLight, text: COLORS.red };
};

const formatDate = (d: string | undefined, fallback: string) => {
  if (!d) return fallback;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return fallback;
  return dt.toLocaleDateString();
};

const formatDateTime = (d: string | undefined, fallback: string) => {
  if (!d) return fallback;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return fallback;
  return dt.toLocaleString();
};

// ============================================================
// SCREEN
// ============================================================
export const BehaviorManagementScreen: React.FC = () => {
  const { t } = useTranslation();
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [halaqat, setHalaqat] = useState<Halaqah[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'All' | BehaviorType>('All');
  const [filterSeverity, setFilterSeverity] = useState<'All' | Severity>('All');
  const [filterLocation, setFilterLocation] = useState<'All' | Location>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | Status>('All');
  const [filterStudent, setFilterStudent] = useState<string>('All');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [addVisible, setAddVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [selectedBehavior, setSelectedBehavior] = useState<Behavior | null>(null);

  const [form, setForm] = useState({
    _id: null as string | null,
    studentId: '',
    type: 'good' as BehaviorType,
    severity: 'Medium' as Severity,
    description: '',
    points: 1,
    location: 'inside' as Location,
    locationDetails: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    status: 'pending' as Status,
  });

  const [formHalaqahId, setFormHalaqahId] = useState<string>('');

  // ============================================================
  // FETCHES
  // ============================================================
  const fetchBehaviors = useCallback(async () => {
    setError('');
    try {
      const res: any = await apiClient.get('/behaviors');
      const data = res?.data?.behaviors || res?.data || res?.behaviors || res || [];
      setBehaviors(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Fetch behaviors error:', err);
      setError(err?.message || 'Failed to load behaviors.');
      setBehaviors([]);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      const res: any = await apiClient.get('/students', { limit: 1000 });
      const data = res?.students || res?.data || res || [];
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Fetch students error:', err);
      setStudents([]);
    }
  }, []);

  const fetchHalaqat = useCallback(async () => {
    try {
      const res: any = await apiClient.get('/halaqaat', { limit: 1000 });
      const data = res?.halaqaat || res?.halaqat || res?.data || res || [];
      setHalaqat(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Fetch halaqat error:', err);
      setHalaqat([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([fetchBehaviors(), fetchStudents(), fetchHalaqat()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchBehaviors, fetchStudents, fetchHalaqat]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchBehaviors(), fetchStudents(), fetchHalaqat()]);
    setRefreshing(false);
  };

  // ============================================================
  // FILTER
  // ============================================================
  const filteredBehaviors = useMemo(() => {
    let filtered = [...behaviors];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.description?.toLowerCase().includes(q) ||
          b.studentName?.toLowerCase().includes(q) ||
          getRecordedByName(b, 'unknown').toLowerCase().includes(q)
      );
    }

    if (filterType !== 'All')
      filtered = filtered.filter((b) => b.type === filterType);
    if (filterSeverity !== 'All')
      filtered = filtered.filter((b) => b.severity === filterSeverity);
    if (filterLocation !== 'All')
      filtered = filtered.filter((b) => b.location === filterLocation);
    if (filterStatus !== 'All')
      filtered = filtered.filter((b) => b.status === filterStatus);
    if (filterStudent !== 'All') {
      filtered = filtered.filter((b) => {
        const id = typeof b.studentId === 'object' ? b.studentId?._id : b.studentId;
        return id === filterStudent;
      });
    }

    return filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [
    behaviors,
    searchTerm,
    filterType,
    filterSeverity,
    filterLocation,
    filterStatus,
    filterStudent,
  ]);

  const stats = useMemo(
    () => ({
      total: behaviors.length,
      good: behaviors.filter((b) => b.type === 'good').length,
      bad: behaviors.filter((b) => b.type === 'bad').length,
      archived: behaviors.filter((b) => b.status === 'archived').length,
    }),
    [behaviors]
  );

  const activeFilterCount = useMemo(
    () =>
      [
        filterType !== 'All',
        filterSeverity !== 'All',
        filterLocation !== 'All',
        filterStatus !== 'All',
        filterStudent !== 'All',
      ].filter(Boolean).length,
    [filterType, filterSeverity, filterLocation, filterStatus, filterStudent]
  );

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('All');
    setFilterSeverity('All');
    setFilterLocation('All');
    setFilterStatus('All');
    setFilterStudent('All');
  };

  const resetForm = () => {
    setForm({
      _id: null,
      studentId: '',
      type: 'good',
      severity: 'Medium',
      description: '',
      points: 1,
      location: 'inside',
      locationDetails: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      status: 'pending',
    });
    setFormHalaqahId('');
  };

  const openAdd = () => {
    resetForm();
    setAddVisible(true);
  };

  const openEdit = (b: Behavior) => {
    const sid = typeof b.studentId === 'object' ? b.studentId?._id : b.studentId;
    const student = students.find((s) => s._id === sid);
    setForm({
      _id: b._id,
      studentId: sid || '',
      type: b.type,
      severity: b.severity,
      description: b.description,
      points: b.points || 1,
      location: b.location || 'inside',
      locationDetails: b.locationDetails || '',
      date: b.date
        ? new Date(b.date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      notes: b.notes || '',
      status: b.status || 'pending',
    });
    setFormHalaqahId(student ? getStudentHalaqahId(student) : '');
    setEditVisible(true);
  };

  // ============================================================
  // SAVE / UPDATE / DELETE
  // ============================================================
  const handleCreate = async () => {
    if (!form.studentId) {
      Alert.alert(t('behavior.requiredTitle'), t('behavior.requiredStudent'));
      return;
    }
    if (!form.description.trim()) {
      Alert.alert(t('behavior.requiredTitle'), t('behavior.requiredDescription'));
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        studentId: form.studentId,
        type: form.type,
        severity: form.severity,
        description: form.description.trim(),
        points: form.points,
        location: form.location,
        locationDetails: form.locationDetails,
        date: form.date,
        notes: form.notes,
        status: form.status,
      };
      await apiClient.post('/behaviors', payload);
      setAddVisible(false);
      resetForm();
      setSuccess(t('behavior.createdMsg'));
      setTimeout(() => setSuccess(''), 3000);
      await fetchBehaviors();
    } catch (err: any) {
      Alert.alert(
        t('behavior.errorTitle'),
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('behavior.createFailed')
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdate = async () => {
    if (!form._id) return;
    if (!form.studentId) {
      Alert.alert(t('behavior.requiredTitle'), t('behavior.requiredStudent'));
      return;
    }
    if (!form.description.trim()) {
      Alert.alert(t('behavior.requiredTitle'), t('behavior.requiredDescription'));
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        studentId: form.studentId,
        type: form.type,
        severity: form.severity,
        description: form.description.trim(),
        points: form.points,
        location: form.location,
        locationDetails: form.locationDetails,
        date: form.date,
        notes: form.notes,
        status: form.status,
      };
      await apiClient.put(`/behaviors/${form._id}`, payload);
      setEditVisible(false);
      resetForm();
      setSuccess(t('behavior.updatedMsg'));
      setTimeout(() => setSuccess(''), 3000);
      await fetchBehaviors();
    } catch (err: any) {
      Alert.alert(
        t('behavior.errorTitle'),
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('behavior.updateFailed')
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBehavior) return;
    setProcessing(true);
    try {
      await apiClient.delete(`/behaviors/${selectedBehavior._id}`);
      setDeleteVisible(false);
      setDetailsVisible(false);
      setSelectedBehavior(null);
      setSuccess(t('behavior.deletedMsg'));
      setTimeout(() => setSuccess(''), 3000);
      await fetchBehaviors();
    } catch (err: any) {
      Alert.alert(
        t('behavior.errorTitle'),
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('behavior.deleteFailed')
      );
    } finally {
      setProcessing(false);
    }
  };

  // ============================================================
  // RENDER — Behavior Card
  // ============================================================
  const renderBehaviorCard = ({ item }: { item: Behavior }) => {
    const typeStyle = getTypeStyle(item.type);
    const severityStyle = getSeverityStyle(item.severity);
    const studentName = getStudentName(
      item,
      students,
      t('behavior.details.unknownStudent')
    );
    const student = students.find(
      (s) =>
        s._id ===
        (typeof item.studentId === 'object'
          ? item.studentId?._id
          : item.studentId)
    );

    return (
      <TouchableOpacity
        style={styles.behaviorCard}
        activeOpacity={0.7}
        onPress={() => {
          setSelectedBehavior(item);
          setDetailsVisible(true);
        }}
      >
        {/* Header badges */}
        <View style={styles.cardHeaderRow}>
          <View style={[styles.typeTag, { backgroundColor: typeStyle.bg }]}>
            <Ionicons
              name={item.type === 'good' ? 'thumbs-up' : 'thumbs-down'}
              size={11}
              color={typeStyle.text}
            />
            <Text style={[styles.typeTagText, { color: typeStyle.text }]}>
              {t(`behavior.types.${TYPE_KEY[item.type]}`)}
            </Text>
          </View>
          <View style={[styles.typeTag, { backgroundColor: severityStyle.bg }]}>
            <Text style={[styles.typeTagText, { color: severityStyle.text }]}>
              {t(`behavior.severities.${SEVERITY_KEY[item.severity]}`)}
            </Text>
          </View>
          <View style={[styles.typeTag, { backgroundColor: COLORS.purpleLight }]}>
            <Ionicons
              name={item.location === 'inside' ? 'home' : 'globe'}
              size={11}
              color={COLORS.purple}
            />
            <Text style={[styles.typeTagText, { color: COLORS.purple }]}>
              {t(`behavior.locations.${LOCATION_KEY[item.location]}`)}
            </Text>
          </View>
          {item.status === 'archived' && (
            <View style={[styles.typeTag, { backgroundColor: '#F1F5F9' }]}>
              <Text style={[styles.typeTagText, { color: COLORS.gray }]}>
                {t('behavior.statuses.archived')}
              </Text>
            </View>
          )}
        </View>

        {/* Student */}
        <View style={styles.cardStudentRow}>
          <View style={[styles.cardAvatar, { backgroundColor: typeStyle.bg }]}>
            <Text style={[styles.cardAvatarText, { color: typeStyle.text }]}>
              {getInitials(studentName)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardStudentName} numberOfLines={1}>
              {studentName}
            </Text>
            <Text style={styles.cardStudentMeta} numberOfLines={1}>
              {student
                ? getStudentHalaqah(student) || t('behavior.noHalaqah')
                : item.halaqah || ''}
            </Text>
          </View>
          <View style={styles.pointsBox}>
            <Text
              style={[
                styles.pointsValue,
                { color: item.type === 'good' ? COLORS.primary : COLORS.red },
              ]}
            >
              {item.type === 'good' ? '+' : '-'}
              {item.points || 0}
            </Text>
            <Text style={styles.pointsLabel}>{t('behavior.points')}</Text>
          </View>
        </View>

        {/* Description */}
        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.description}
        </Text>

        {/* Meta */}
        <View style={styles.cardMetaRow}>
          <View style={styles.cardMetaItem}>
            <Ionicons name="calendar-outline" size={11} color={COLORS.slateMuted} />
            <Text style={styles.cardMetaText}>
              {formatDate(item.date, t('behavior.details.notAvailable'))}
            </Text>
          </View>
          <View style={styles.cardMetaItem}>
            <Ionicons name="person-outline" size={11} color={COLORS.slateMuted} />
            <Text style={styles.cardMetaText} numberOfLines={1}>
              {getRecordedByName(item, t('behavior.details.unknown'))}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => {
              setSelectedBehavior(item);
              setDetailsVisible(true);
            }}
          >
            <Ionicons name="eye-outline" size={14} color={COLORS.blue} />
            <Text style={[styles.cardActionText, { color: COLORS.blue }]}>
              {t('behavior.cardActions.view')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => openEdit(item)}
          >
            <Ionicons name="create-outline" size={14} color={COLORS.purple} />
            <Text style={[styles.cardActionText, { color: COLORS.purple }]}>
              {t('behavior.cardActions.edit')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => {
              setSelectedBehavior(item);
              setDeleteVisible(true);
            }}
          >
            <Ionicons name="trash-outline" size={14} color={COLORS.red} />
            <Text style={[styles.cardActionText, { color: COLORS.red }]}>
              {t('behavior.cardActions.delete')}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('behavior.headerTitle')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('behavior.headerSubtitle', {
              count: filteredBehaviors.length,
              total: behaviors.length,
            })}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            <Ionicons
              name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
              size={18}
              color={COLORS.slate}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setFilterModalVisible(true)}
          >
            <Ionicons name="filter-outline" size={18} color={COLORS.slate} />
            {activeFilterCount > 0 && <View style={styles.filterDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={openAdd}>
            <Ionicons name="add" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* STATS */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: COLORS.purpleLight }]}>
            <Ionicons name="heart" size={16} color={COLORS.purple} />
          </View>
          <Text style={styles.summaryValue}>{stats.total}</Text>
          <Text style={styles.summaryLabel}>{t('behavior.summary.total')}</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: COLORS.primaryLight }]}>
            <Ionicons name="thumbs-up" size={16} color={COLORS.primary} />
          </View>
          <Text style={styles.summaryValue}>{stats.good}</Text>
          <Text style={styles.summaryLabel}>{t('behavior.summary.good')}</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: COLORS.redLight }]}>
            <Ionicons name="thumbs-down" size={16} color={COLORS.red} />
          </View>
          <Text style={styles.summaryValue}>{stats.bad}</Text>
          <Text style={styles.summaryLabel}>{t('behavior.summary.bad')}</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: '#F1F5F9' }]}>
            <Ionicons name="archive-outline" size={16} color={COLORS.gray} />
          </View>
          <Text style={styles.summaryValue}>{stats.archived}</Text>
          <Text style={styles.summaryLabel}>{t('behavior.summary.archived')}</Text>
        </View>
      </View>

      {/* SEARCH */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('behavior.searchPlaceholder')}
            placeholderTextColor="#A0AAA5"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.gray} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* BANNERS */}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError('')}>
            <Ionicons name="close" size={16} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      ) : null}
      {success ? (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
          <Text style={styles.successText}>{success}</Text>
        </View>
      ) : null}

      {/* ACTIVE FILTERS */}
      {activeFilterCount > 0 && (
        <View style={styles.activeFiltersRow}>
          {filterType !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {t(`behavior.types.${TYPE_KEY[filterType]}`)}
              </Text>
              <TouchableOpacity onPress={() => setFilterType('All')}>
                <Ionicons name="close" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
          {filterSeverity !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {t(`behavior.severities.${SEVERITY_KEY[filterSeverity]}`)}
              </Text>
              <TouchableOpacity onPress={() => setFilterSeverity('All')}>
                <Ionicons name="close" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
          {filterLocation !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {t(`behavior.locations.${LOCATION_KEY[filterLocation]}`)}
              </Text>
              <TouchableOpacity onPress={() => setFilterLocation('All')}>
                <Ionicons name="close" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
          {filterStatus !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {t(`behavior.statuses.${STATUS_KEY[filterStatus]}`)}
              </Text>
              <TouchableOpacity onPress={() => setFilterStatus('All')}>
                <Ionicons name="close" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
          {filterStudent !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText} numberOfLines={1}>
                {students.find((s) => s._id === filterStudent)?.name ||
                  t('behavior.fields.student')}
              </Text>
              <TouchableOpacity onPress={() => setFilterStudent('All')}>
                <Ionicons name="close" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearFiltersText}>{t('behavior.clearAll')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* LIST */}
      {loading && behaviors.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.purple} />
          <Text style={styles.loadingText}>{t('behavior.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBehaviors}
          keyExtractor={(item) => item._id}
          renderItem={renderBehaviorCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.purple]}
              tintColor={COLORS.purple}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>{t('behavior.noResultsTitle')}</Text>
              <Text style={styles.emptyText}>
                {searchTerm || activeFilterCount > 0
                  ? t('behavior.noResultsFiltered')
                  : t('behavior.noResultsEmpty')}
              </Text>
              {activeFilterCount > 0 || searchTerm ? (
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={clearFilters}
                >
                  <Text style={styles.emptyButtonText}>
                    {t('behavior.clearFilters')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.emptyButton} onPress={openAdd}>
                  <Text style={styles.emptyButtonText}>
                    {t('behavior.recordBehavior')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* ============ ADD MODAL ============ */}
      <BehaviorFormModal
        visible={addVisible}
        title={t('behavior.addModalTitle')}
        form={form}
        setForm={setForm}
        halaqat={halaqat}
        students={students}
        formHalaqahId={formHalaqahId}
        setFormHalaqahId={setFormHalaqahId}
        onClose={() => setAddVisible(false)}
        onSubmit={handleCreate}
        submitting={processing}
        submitLabel={t('behavior.record')}
        submitIcon="add"
      />

      {/* ============ EDIT MODAL ============ */}
      <BehaviorFormModal
        visible={editVisible}
        title={t('behavior.editModalTitle')}
        form={form}
        setForm={setForm}
        halaqat={halaqat}
        students={students}
        formHalaqahId={formHalaqahId}
        setFormHalaqahId={setFormHalaqahId}
        onClose={() => setEditVisible(false)}
        onSubmit={handleUpdate}
        submitting={processing}
        submitLabel={t('behavior.update')}
        submitIcon="checkmark"
      />

      {/* ============ DETAILS MODAL ============ */}
      <BehaviorDetailsModal
        visible={detailsVisible}
        behavior={selectedBehavior}
        students={students}
        onClose={() => {
          setDetailsVisible(false);
          setSelectedBehavior(null);
        }}
        onEdit={(b) => {
          setDetailsVisible(false);
          openEdit(b);
        }}
        onDelete={(b) => {
          setDetailsVisible(false);
          setSelectedBehavior(b);
          setDeleteVisible(true);
        }}
      />

      {/* ============ DELETE MODAL ============ */}
      <Modal
        visible={deleteVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('behavior.deleteModalTitle')}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setDeleteVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.deleteIconWrap}>
                <Ionicons name="trash-outline" size={32} color={COLORS.red} />
              </View>
              <Text style={styles.deleteText}>
                {t('behavior.deleteConfirmMsg')}
              </Text>
              <Text style={styles.deleteHint}>
                {t('behavior.deleteCannotUndo')}
              </Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setDeleteVisible(false)}
                disabled={processing}
              >
                <Text style={styles.cancelBtnText}>{t('behavior.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerBtn, processing && { opacity: 0.7 }]}
                onPress={handleDelete}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                    <Text style={styles.dangerBtnText}>{t('behavior.delete')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============ FILTER MODAL ============ */}
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filterType={filterType}
        setFilterType={setFilterType}
        filterSeverity={filterSeverity}
        setFilterSeverity={setFilterSeverity}
        filterLocation={filterLocation}
        setFilterLocation={setFilterLocation}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        filterStudent={filterStudent}
        setFilterStudent={setFilterStudent}
        students={students}
        onReset={clearFilters}
      />
    </SafeAreaView>
  );
};

export default BehaviorManagementScreen;

// ============================================================
// BEHAVIOR FORM MODAL
// ============================================================
interface FormState {
  _id: string | null;
  studentId: string;
  type: BehaviorType;
  severity: Severity;
  description: string;
  points: number;
  location: Location;
  locationDetails: string;
  date: string;
  notes: string;
  status: Status;
}

const BehaviorFormModal: React.FC<{
  visible: boolean;
  title: string;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  halaqat: Halaqah[];
  students: Student[];
  formHalaqahId: string;
  setFormHalaqahId: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
  submitIcon: keyof typeof Ionicons.glyphMap;
}> = ({
  visible,
  title,
  form,
  setForm,
  halaqat,
  students,
  formHalaqahId,
  setFormHalaqahId,
  onClose,
  onSubmit,
  submitting,
  submitLabel,
  submitIcon,
}) => {
  const { t } = useTranslation();
  const filteredStudents = useMemo(() => {
    if (!formHalaqahId) return students;
    return students.filter((s) => getStudentHalaqahId(s) === formHalaqahId);
  }, [students, formHalaqahId]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={onClose}
              disabled={submitting}
            >
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Halaqah */}
            <Text style={styles.fieldLabel}>
              {t('behavior.fields.halaqah')} *
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            >
              {halaqat.map((h) => {
                const active = formHalaqahId === h._id;
                return (
                  <TouchableOpacity
                    key={h._id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => {
                      setFormHalaqahId(h._id);
                      setForm((prev) => ({ ...prev, studentId: '' }));
                    }}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {h.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.chip, formHalaqahId === '' && styles.chipActive]}
                onPress={() => {
                  setFormHalaqahId('');
                  setForm((prev) => ({ ...prev, studentId: '' }));
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    formHalaqahId === '' && styles.chipTextActive,
                  ]}
                >
                  {t('behavior.fields.allHalaqaat')}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Student */}
            <Text style={styles.fieldLabel}>
              {t('behavior.fields.student')} *
            </Text>
            {filteredStudents.length === 0 ? (
              <Text style={styles.hint}>{t('behavior.noStudentsFound')}</Text>
            ) : (
              <View style={styles.studentWrap}>
                {filteredStudents.map((s) => {
                  const active = form.studentId === s._id;
                  return (
                    <TouchableOpacity
                      key={s._id}
                      style={[
                        styles.studentChip,
                        active && styles.studentChipActive,
                      ]}
                      onPress={() =>
                        setForm((prev) => ({ ...prev, studentId: s._id }))
                      }
                    >
                      <View
                        style={[
                          styles.studentAvatar,
                          active && { backgroundColor: COLORS.white },
                        ]}
                      >
                        <Text
                          style={[
                            styles.studentAvatarText,
                            active && { color: COLORS.primary },
                          ]}
                        >
                          {s.name?.charAt(0)?.toUpperCase() || '?'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.studentChipName,
                            active && { color: COLORS.primary },
                          ]}
                          numberOfLines={1}
                        >
                          {s.name}
                        </Text>
                        <Text
                          style={[
                            styles.studentChipMeta,
                            active && { color: COLORS.primary },
                          ]}
                          numberOfLines={1}
                        >
                          {getStudentHalaqah(s) || '—'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Type */}
            <Text style={styles.fieldLabel}>
              {t('behavior.fields.type')} *
            </Text>
            <View style={styles.twoCol}>
              <TouchableOpacity
                style={[
                  styles.typeBtn,
                  form.type === 'good' && {
                    backgroundColor: COLORS.primaryLight,
                    borderColor: COLORS.primary,
                  },
                ]}
                onPress={() =>
                  setForm((prev) => ({ ...prev, type: 'good', points: 1 }))
                }
              >
                <Ionicons
                  name="thumbs-up"
                  size={18}
                  color={
                    form.type === 'good' ? COLORS.primary : COLORS.slateMuted
                  }
                />
                <Text
                  style={[
                    styles.typeBtnText,
                    form.type === 'good' && {
                      color: COLORS.primary,
                      fontWeight: '800',
                    },
                  ]}
                >
                  {t('behavior.types.good')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeBtn,
                  form.type === 'bad' && {
                    backgroundColor: COLORS.redLight,
                    borderColor: COLORS.red,
                  },
                ]}
                onPress={() =>
                  setForm((prev) => ({ ...prev, type: 'bad', points: 1 }))
                }
              >
                <Ionicons
                  name="thumbs-down"
                  size={18}
                  color={form.type === 'bad' ? COLORS.red : COLORS.slateMuted}
                />
                <Text
                  style={[
                    styles.typeBtnText,
                    form.type === 'bad' && {
                      color: COLORS.red,
                      fontWeight: '800',
                    },
                  ]}
                >
                  {t('behavior.types.bad')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Severity */}
            <Text style={styles.fieldLabel}>
              {t('behavior.fields.severity')}
            </Text>
            <View style={styles.chipRow}>
              {SEVERITIES.map((s) => {
                const sStyle = getSeverityStyle(s);
                const active = form.severity === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.chip,
                      active && {
                        backgroundColor: sStyle.bg,
                        borderColor: sStyle.text,
                      },
                    ]}
                    onPress={() =>
                      setForm((prev) => ({ ...prev, severity: s }))
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && { color: sStyle.text, fontWeight: '800' },
                      ]}
                    >
                      {t(`behavior.severities.${SEVERITY_KEY[s]}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Location */}
            <Text style={styles.fieldLabel}>
              {t('behavior.fields.location')} *
            </Text>
            <View style={styles.twoCol}>
              <TouchableOpacity
                style={[
                  styles.typeBtn,
                  form.location === 'inside' && {
                    backgroundColor: COLORS.purpleLight,
                    borderColor: COLORS.purple,
                  },
                ]}
                onPress={() =>
                  setForm((prev) => ({ ...prev, location: 'inside' }))
                }
              >
                <Ionicons
                  name="home"
                  size={18}
                  color={
                    form.location === 'inside'
                      ? COLORS.purple
                      : COLORS.slateMuted
                  }
                />
                <Text
                  style={[
                    styles.typeBtnText,
                    form.location === 'inside' && {
                      color: COLORS.purple,
                      fontWeight: '800',
                    },
                  ]}
                >
                  {t('behavior.locations.inside')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeBtn,
                  form.location === 'outside' && {
                    backgroundColor: COLORS.purpleLight,
                    borderColor: COLORS.purple,
                  },
                ]}
                onPress={() =>
                  setForm((prev) => ({ ...prev, location: 'outside' }))
                }
              >
                <Ionicons
                  name="globe"
                  size={18}
                  color={
                    form.location === 'outside'
                      ? COLORS.purple
                      : COLORS.slateMuted
                  }
                />
                <Text
                  style={[
                    styles.typeBtnText,
                    form.location === 'outside' && {
                      color: COLORS.purple,
                      fontWeight: '800',
                    },
                  ]}
                >
                  {t('behavior.locations.outside')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Location details */}
            <Text style={styles.fieldLabel}>
              {t('behavior.fields.locationDetails')}
            </Text>
            <TextInput
              style={styles.input}
              value={form.locationDetails}
              onChangeText={(v) =>
                setForm((prev) => ({ ...prev, locationDetails: v }))
              }
              placeholder={t('behavior.placeholders.locationDetails')}
              placeholderTextColor="#A0AAA5"
            />

            {/* Description */}
            <Text style={styles.fieldLabel}>
              {t('behavior.fields.description')} *
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.description}
              onChangeText={(v) =>
                setForm((prev) => ({ ...prev, description: v }))
              }
              placeholder={t('behavior.placeholders.description')}
              placeholderTextColor="#A0AAA5"
              multiline
            />

            {/* Points */}
            <Text style={styles.fieldLabel}>
              {t('behavior.fields.points')}
            </Text>
            <View style={styles.pointsRow}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => {
                const active = form.points === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.pointsChip,
                      active && styles.pointsChipActive,
                    ]}
                    onPress={() =>
                      setForm((prev) => ({ ...prev, points: p }))
                    }
                  >
                    <Text
                      style={[
                        styles.pointsChipText,
                        active && styles.pointsChipTextActive,
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Status */}
            <Text style={styles.fieldLabel}>
              {t('behavior.fields.status')}
            </Text>
            <View style={styles.chipRow}>
              {(['pending', 'archived'] as Status[]).map((s) => {
                const active = form.status === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setForm((prev) => ({ ...prev, status: s }))}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {t(`behavior.statuses.${STATUS_KEY[s]}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Notes */}
            <Text style={styles.fieldLabel}>
              {t('behavior.fields.notes')}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.notes}
              onChangeText={(v) => setForm((prev) => ({ ...prev, notes: v }))}
              placeholder={t('behavior.placeholders.notes')}
              placeholderTextColor="#A0AAA5"
              multiline
            />

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.cancelBtnText}>{t('behavior.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, submitting && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name={submitIcon} size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>{submitLabel}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ============================================================
// BEHAVIOR DETAILS MODAL
// ============================================================
const BehaviorDetailsModal: React.FC<{
  visible: boolean;
  behavior: Behavior | null;
  students: Student[];
  onClose: () => void;
  onEdit: (b: Behavior) => void;
  onDelete: (b: Behavior) => void;
}> = ({ visible, behavior, students, onClose, onEdit, onDelete }) => {
  const { t } = useTranslation();
  if (!behavior) return null;
  const typeStyle = getTypeStyle(behavior.type);
  const severityStyle = getSeverityStyle(behavior.severity);
  const studentName = getStudentName(
    behavior,
    students,
    t('behavior.details.unknownStudent')
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>
                {t('behavior.detailsTitle')}
              </Text>
              <Text style={styles.modalSubtitle}>{studentName}</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.detailsProfile}>
              <View
                style={[
                  styles.detailsAvatar,
                  { backgroundColor: typeStyle.bg },
                ]}
              >
                <Text
                  style={[
                    styles.detailsAvatarText,
                    { color: typeStyle.text },
                  ]}
                >
                  {getInitials(studentName)}
                </Text>
              </View>
              <Text style={styles.detailsName}>{studentName}</Text>

              <View style={styles.detailsBadgeRow}>
                <View
                  style={[styles.typeTag, { backgroundColor: typeStyle.bg }]}
                >
                  <Ionicons
                    name={
                      behavior.type === 'good' ? 'thumbs-up' : 'thumbs-down'
                    }
                    size={11}
                    color={typeStyle.text}
                  />
                  <Text
                    style={[styles.typeTagText, { color: typeStyle.text }]}
                  >
                    {t(`behavior.types.${TYPE_KEY[behavior.type]}`)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.typeTag,
                    { backgroundColor: severityStyle.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeTagText,
                      { color: severityStyle.text },
                    ]}
                  >
                    {t(
                      `behavior.severities.${
                        SEVERITY_KEY[behavior.severity]
                      }`
                    )}
                  </Text>
                </View>
                <View
                  style={[
                    styles.typeTag,
                    { backgroundColor: COLORS.purpleLight },
                  ]}
                >
                  <Ionicons
                    name={behavior.location === 'inside' ? 'home' : 'globe'}
                    size={11}
                    color={COLORS.purple}
                  />
                  <Text
                    style={[styles.typeTagText, { color: COLORS.purple }]}
                  >
                    {t(
                      `behavior.locations.${
                        LOCATION_KEY[behavior.location]
                      }`
                    )}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionLabel}>
                {t('behavior.details.description')}
              </Text>
              <View style={styles.detailDescriptionBox}>
                <Text style={styles.detailDescriptionText}>
                  {behavior.description}
                </Text>
              </View>
            </View>

            <View style={styles.detailPointsBox}>
              <Text style={styles.detailPointsLabel}>
                {t('behavior.details.points')}
              </Text>
              <Text
                style={[
                  styles.detailPointsValue,
                  {
                    color:
                      behavior.type === 'good'
                        ? COLORS.primary
                        : COLORS.red,
                  },
                ]}
              >
                {behavior.type === 'good' ? '+' : '-'}
                {behavior.points || 0}
              </Text>
            </View>

            <InfoRow
              label={t('behavior.details.location')}
              value={
                behavior.location === 'inside'
                  ? t('behavior.locations.insideSchool')
                  : t('behavior.locations.outsideSchool')
              }
              icon={
                behavior.location === 'inside'
                  ? 'home-outline'
                  : 'globe-outline'
              }
            />
            {behavior.locationDetails ? (
              <InfoRow
                label={t('behavior.details.locationDetails')}
                value={behavior.locationDetails}
                icon="location-outline"
              />
            ) : null}
            <InfoRow
              label={t('behavior.details.date')}
              value={formatDateTime(
                behavior.date,
                t('behavior.details.notAvailable')
              )}
              icon="calendar-outline"
            />
            <InfoRow
              label={t('behavior.details.recordedBy')}
              value={getRecordedByName(
                behavior,
                t('behavior.details.unknown')
              )}
              icon="person-outline"
            />
            <InfoRow
              label={t('behavior.details.status')}
              value={t(`behavior.statuses.${STATUS_KEY[behavior.status]}`)}
              icon="information-circle-outline"
            />
            {behavior.notes ? (
              <InfoRow
                label={t('behavior.details.notes')}
                value={behavior.notes}
                icon="document-text-outline"
              />
            ) : null}

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.actionBtnOutline}
              onPress={() => onEdit(behavior)}
            >
              <Ionicons
                name="create-outline"
                size={16}
                color={COLORS.purple}
              />
              <Text
                style={[
                  styles.actionBtnOutlineText,
                  { color: COLORS.purple },
                ]}
              >
                {t('behavior.cardActions.edit')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtnDanger}
              onPress={() => onDelete(behavior)}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.red} />
              <Text style={styles.actionBtnDangerText}>
                {t('behavior.cardActions.delete')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

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
// FILTER MODAL
// ============================================================
const FilterModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  filterType: 'All' | BehaviorType;
  setFilterType: (v: 'All' | BehaviorType) => void;
  filterSeverity: 'All' | Severity;
  setFilterSeverity: (v: 'All' | Severity) => void;
  filterLocation: 'All' | Location;
  setFilterLocation: (v: 'All' | Location) => void;
  filterStatus: 'All' | Status;
  setFilterStatus: (v: 'All' | Status) => void;
  filterStudent: string;
  setFilterStudent: (v: string) => void;
  students: Student[];
  onReset: () => void;
}> = ({
  visible,
  onClose,
  filterType,
  setFilterType,
  filterSeverity,
  setFilterSeverity,
  filterLocation,
  setFilterLocation,
  filterStatus,
  setFilterStatus,
  filterStudent,
  setFilterStudent,
  students,
  onReset,
}) => {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { maxHeight: '85%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('behavior.filterTitle')}</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Type */}
            <Text style={styles.filterSectionTitle}>
              {t('behavior.filterType')}
            </Text>
            <View style={styles.chipRow}>
              {(['All', 'good', 'bad'] as const).map((tp) => {
                const active = filterType === tp;
                return (
                  <TouchableOpacity
                    key={tp}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFilterType(tp)}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {tp === 'All'
                        ? t('behavior.allTypes')
                        : t(`behavior.types.${TYPE_KEY[tp as BehaviorType]}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Severity */}
            <Text style={[styles.filterSectionTitle, { marginTop: 16 }]}>
              {t('behavior.filterSeverity')}
            </Text>
            <View style={styles.chipRow}>
              {(['All', ...SEVERITIES] as const).map((s) => {
                const active = filterSeverity === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFilterSeverity(s as any)}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {s === 'All'
                        ? t('behavior.allTypes')
                        : t(
                            `behavior.severities.${
                              SEVERITY_KEY[s as Severity]
                            }`
                          )}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Location */}
            <Text style={[styles.filterSectionTitle, { marginTop: 16 }]}>
              {t('behavior.filterLocation')}
            </Text>
            <View style={styles.chipRow}>
              {(['All', ...LOCATIONS] as const).map((l) => {
                const active = filterLocation === l;
                return (
                  <TouchableOpacity
                    key={l}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFilterLocation(l as any)}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {l === 'All'
                        ? t('behavior.locations.allLocations')
                        : t(
                            `behavior.locations.${
                              LOCATION_KEY[l as Location]
                            }`
                          )}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Status */}
            <Text style={[styles.filterSectionTitle, { marginTop: 16 }]}>
              {t('behavior.filterStatus')}
            </Text>
            <View style={styles.chipRow}>
              {(['All', 'pending', 'archived'] as const).map((s) => {
                const active = filterStatus === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFilterStatus(s as any)}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {s === 'All'
                        ? t('behavior.statuses.allStatus')
                        : t(`behavior.statuses.${STATUS_KEY[s as Status]}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Student */}
            <Text style={[styles.filterSectionTitle, { marginTop: 16 }]}>
              {t('behavior.filterStudent')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            >
              <TouchableOpacity
                style={[
                  styles.chip,
                  filterStudent === 'All' && styles.chipActive,
                ]}
                onPress={() => setFilterStudent('All')}
              >
                <Text
                  style={[
                    styles.chipText,
                    filterStudent === 'All' && styles.chipTextActive,
                  ]}
                >
                  {t('behavior.allStudents')}
                </Text>
              </TouchableOpacity>
              {students.map((s) => {
                const active = filterStudent === s._id;
                return (
                  <TouchableOpacity
                    key={s._id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFilterStudent(s._id)}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </ScrollView>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.filterResetBtn}
              onPress={() => {
                onReset();
                onClose();
              }}
            >
              <Text style={styles.filterResetBtnText}>
                {t('behavior.reset')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterApplyBtn} onPress={onClose}>
              <Text style={styles.filterApplyBtnText}>
                {t('behavior.applyFilters')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // HEADER
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.slate },
  headerSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    backgroundColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // SUMMARY
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

  // SEARCH
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
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.slate },

  // BANNERS
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
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: '#BFE9D4',
    borderRadius: 12,
  },
  successText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // ACTIVE FILTERS
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
    maxWidth: 200,
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

  // LOADING
  loadingWrap: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: COLORS.slateMuted, fontSize: 13 },

  // LIST
  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },

  // BEHAVIOR CARD
  behaviorCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  typeTagText: { fontSize: 10, fontWeight: '800' },

  cardStudentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  cardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAvatarText: { fontSize: 15, fontWeight: '800' },
  cardStudentName: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  cardStudentMeta: {
    fontSize: 11,
    color: COLORS.slateMuted,
    marginTop: 2,
  },
  pointsBox: { alignItems: 'flex-end' },
  pointsValue: { fontSize: 18, fontWeight: '800' },
  pointsLabel: { fontSize: 9, color: COLORS.slateMuted },

  cardDescription: {
    fontSize: 13,
    color: COLORS.slate,
    lineHeight: 18,
    marginBottom: 8,
  },

  cardMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cardMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText: { fontSize: 11, color: COLORS.slateMuted },

  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cardActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardActionText: { fontSize: 12, fontWeight: '700' },

  // EMPTY
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
    backgroundColor: COLORS.purple,
    borderRadius: 10,
  },
  emptyButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },

  // MODAL
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
  modalBody: { paddingHorizontal: 20, paddingTop: 12 },

  // FORM
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.slate,
    backgroundColor: COLORS.white,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  hint: {
    fontSize: 11,
    color: COLORS.gray,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  twoCol: { flexDirection: 'row', gap: 8 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: COLORS.slateMuted },
  chipTextActive: { color: COLORS.primary },

  // STUDENT CHIPS
  studentWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
  },
  studentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 160,
    maxWidth: '100%',
  },
  studentChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  studentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  studentChipName: { fontSize: 12, fontWeight: '700', color: COLORS.slate },
  studentChipMeta: { fontSize: 10, color: COLORS.slateMuted, marginTop: 2 },

  // TYPE BUTTONS
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 6,
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },

  // POINTS
  pointsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pointsChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsChipActive: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purple,
  },
  pointsChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },
  pointsChipTextActive: { color: COLORS.white },

  // FOOTER
  modalFooter: {
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
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.purple,
    gap: 6,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  dangerBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.red,
    gap: 6,
  },
  dangerBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // DELETE
  deleteIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.redLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  deleteText: {
    fontSize: 14,
    color: COLORS.slate,
    textAlign: 'center',
    lineHeight: 20,
  },
  deleteHint: {
    fontSize: 12,
    color: COLORS.slateMuted,
    textAlign: 'center',
    marginTop: 6,
    fontStyle: 'italic',
  },

  // DETAILS
  detailsProfile: { alignItems: 'center', paddingVertical: 16 },
  detailsAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  detailsAvatarText: { fontSize: 24, fontWeight: '800' },
  detailsName: { fontSize: 20, fontWeight: '800', color: COLORS.slate },
  detailsBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  detailSection: { marginTop: 12 },
  detailSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slate,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  detailDescriptionBox: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
  },
  detailDescriptionText: {
    fontSize: 14,
    color: COLORS.slate,
    lineHeight: 20,
  },

  detailPointsBox: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  detailPointsLabel: {
    fontSize: 12,
    color: COLORS.slateMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailPointsValue: { fontSize: 32, fontWeight: '800', marginTop: 4 },

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

  modalActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.purple,
    gap: 6,
  },
  actionBtnOutlineText: { fontSize: 13, fontWeight: '700' },
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
  actionBtnDangerText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.red,
  },

  // FILTER MODAL
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 12,
    marginBottom: 8,
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
  },
  filterApplyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});