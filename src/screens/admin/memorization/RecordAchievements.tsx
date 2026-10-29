// src/screens/admin/memorization/RecordAchievements.tsx
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useBranch } from '../../../context/BranchContext';
import { enqueue } from '../../../utils/offlineDb';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';

import {
  COLORS,
  TASHIIH_TOPICS,
  READING_WRITING_TOPICS,
  ACHIEVEMENT_TYPES,
  Achievement,
  AchievementFormState,
  Student,
  Halaqah,
  SubacGroup,
  GroupType,
  api,
  groupApi,
  getMaxAyah,
  getTypeInfo,
  getRangeDisplay,
  getStudentId,
  getStudentName,
  getTopicLabel,
} from './_shared';
import {
  SurahPicker,
  JuzPicker,
  QuarterPicker,
  FeedbackModal,
  FeedbackTone,
  FeedbackButton,
} from './_shared/pickers';
import { GroupsSection } from './GroupsSection';
import { BooksModal } from './BooksModal';
import { GroupRecordModal } from './GroupRecordModal';

// ============================================================
// HELPERS
// ============================================================
const getInitials = (name: string) => {
  const parts = (name || '').trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || '').substring(0, 2).toUpperCase();
};

const getHalaqahName = (s: Student) => {
  if (s.halaqahName) return s.halaqahName;
  if (typeof s.halaqah === 'object' && s.halaqah?.name) return s.halaqah.name;
  if (typeof s.halaqah === 'string') return s.halaqah;
  return '';
};

const getHalaqahId = (s: Student) => {
  if (typeof s.halaqah === 'object' && s.halaqah?._id) return s.halaqah._id;
  if (typeof s.halaqah === 'string') return s.halaqah;
  return '';
};

const getEmptyForm = (studentId: string): AchievementFormState => ({
  studentId,
  type: 'memorization',
  rangeType: 'surah',
  fromSurah: 1,
  fromAyah: 1,
  toSurah: 1,
  toAyah: 1,
  fromJuz: 1,
  fromQuarter: 1,
  toJuz: 1,
  toQuarter: 8,
  fromBookPage: '',
  toBookPage: '',
  bookId: '',
  bookName: '',
  score: '8',
  attempt: '1',
  comment: '',
  topic: '',
  customTopic: '',
  rwNote: '',
});

// ============================================================
// MAIN
// ============================================================
export const RecordAchievements: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { t } = useTranslation();
  const { currentBranch } = useBranch();
  const { isOnline } = useNetworkStatus();

  // List state
  const [halaqat, setHalaqat] = useState<Halaqah[]>([]);
  const [selectedHalaqah, setSelectedHalaqah] = useState<Halaqah | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [todayAchievements, setTodayAchievements] = useState<Achievement[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Groups
  const [groups, setGroups] = useState<SubacGroup[]>([]);
  const [recordGroup, setRecordGroup] = useState<SubacGroup | null>(null);

  // Books
  const [books, setBooks] = useState<any[]>([]);
  const [booksOpen, setBooksOpen] = useState(false);

  // Add/Edit modal
  const [formVisible, setFormVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [form, setForm] = useState<AchievementFormState>(getEmptyForm(''));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // ============================================================
  // FEEDBACK POPUP (replaces Alert.alert)
  // ============================================================
  const [feedback, setFeedback] = useState<{
    visible: boolean;
    tone: FeedbackTone;
    title: string;
    message?: string;
    buttons?: FeedbackButton[];
  }>({ visible: false, tone: 'info', title: '' });

  const notify = (
    tone: FeedbackTone,
    title: string,
    message?: string,
    buttons?: FeedbackButton[]
  ) => setFeedback({ visible: true, tone, title, message, buttons });

  // ============================================================
  // LOAD HALAQAAT + BOOKS (once)
  // ============================================================
  useEffect(() => {
    (async () => {
      try {
        const list = await api.getHalaqat();
        const withAll: Halaqah[] = [
          { _id: 'all', name: t('memorization.record.allHalaqaat'), isAll: true },
          ...list,
        ];
        setHalaqat(withAll);
        if (!selectedHalaqah && withAll.length > 0) setSelectedHalaqah(withAll[0]);
      } catch (err: any) {
        console.error('Load halaqat error:', err);
        setError(err?.message || t('memorization.record.loadHalaqatFailed'));
      }
    })();

    (async () => {
      try {
        const list = await api.getBooks();
        setBooks(list);
      } catch {
        setBooks([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // LOAD GROUPS from the server (same source as the web app)
  // Re-fetch when the branch changes.
  // ============================================================
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await groupApi.list();
        if (!cancelled) setGroups(list);
      } catch (e) {
        console.warn('Failed to load groups:', e);
        if (!cancelled) setGroups([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentBranch?._id]);

  // ============================================================
  // LOAD STUDENTS + TODAY'S ACHIEVEMENTS
  // ============================================================
  const loadData = useCallback(async () => {
    if (!selectedHalaqah) return;
    setError('');
    try {
      const halaqahId = selectedHalaqah.isAll ? 'all' : selectedHalaqah._id;
      const [studentsList, achievementsList] = await Promise.all([
        api.getStudents(halaqahId),
        api.getTodayAchievements({ halaqahId, date }),
      ]);
      setStudents(studentsList);
      setTodayAchievements(achievementsList);
    } catch (err: any) {
      console.error('Load data error:', err);
      setError(err?.message || t('memorization.record.loadDataFailed'));
      setStudents([]);
      setTodayAchievements([]);
    }
  }, [selectedHalaqah, date, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadData();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ============================================================
  // GROUPS: server-backed create / update / delete
  // ============================================================
  const handleCreateGroup = async (input: {
    name: string;
    type: GroupType;
    members: string[];
    halaqahId?: string;
    halaqahName?: string;
  }) => {
    try {
      const created = await groupApi.create(input);
      setGroups((prev) => [created, ...prev]);
      notify(
        'success',
        t('memorization.group_created') || 'Group created',
        created.name
      );
    } catch (e: any) {
      console.error('Create group failed', e);
      notify(
        'error',
        t('memorization.failed_to_save') || 'Failed to save',
        e?.message || ''
      );
    }
  };

  const handleUpdateGroup = async (g: SubacGroup) => {
    try {
      const updated = await groupApi.update(g.id, {
        name: g.name,
        type: g.type,
        members: g.members,
        halaqahId: g.halaqahId,
        halaqahName: g.halaqahName,
      });
      setGroups((prev) =>
        prev.map((x) => (x.id === updated.id ? updated : x))
      );
      notify(
        'success',
        t('memorization.group_updated') || 'Group updated',
        updated.name
      );
    } catch (e: any) {
      console.error('Update group failed', e);
      notify(
        'error',
        t('memorization.failed_to_update') || 'Failed to update',
        e?.message || ''
      );
    }
  };

  const handleDeleteGroup = (g: SubacGroup) => {
    notify(
      'warning',
      t('memorization.delete_confirm') || 'Delete this group?',
      g.name,
      [
        { text: t('memorization.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('memorization.delete') || 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await groupApi.remove(g.id);
              setGroups((prev) => prev.filter((x) => x.id !== g.id));
              notify(
                'success',
                t('memorization.group_deleted') || 'Group deleted'
              );
            } catch (e: any) {
              console.error('Delete group failed', e);
              notify(
                'error',
                t('memorization.failed_to_delete') || 'Failed to delete',
                e?.message || ''
              );
            }
          },
        },
      ]
    );
  };

  // ============================================================
  // FILTER
  // ============================================================
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return students;
    const q = searchTerm.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.regNo || '').toLowerCase().includes(q) ||
        getHalaqahName(s).toLowerCase().includes(q)
    );
  }, [students, searchTerm]);

  const getTodayCount = useCallback(
    (studentId: string): number =>
      todayAchievements.filter((a) => getStudentId(a) === studentId).length,
    [todayAchievements]
  );

  // ============================================================
  // LAST ACHIEVEMENTS (bulk fetch from server, cached)
  // ============================================================
  const [lastMap, setLastMap] = useState<Record<string, Achievement>>({});

  useEffect(() => {
    if (!students.length) {
      setLastMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const map = await api.getLastAchievements(students.map((s) => s._id));
        if (!cancelled) setLastMap(map || {});
      } catch (e) {
        console.warn('Failed to load last achievements', e);
        if (!cancelled) setLastMap({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [students]);

  const getLastAchievement = useCallback(
    (studentId: string): Achievement | null => lastMap[studentId] || null,
    [lastMap]
  );

  // ============================================================
  // OPEN ADD MODAL
  // ============================================================
  const openAdd = (student: Student) => {
    const last = getLastAchievement(student._id);
    const base = getEmptyForm(student._id);

    if (last) {
      base.type = last.type;
      base.rangeType = last.rangeType || 'surah';
      base.fromSurah = last.toSurah || 1;
      base.fromAyah = last.toAyah ? last.toAyah + 1 : 1;
      if (
        last.rangeType === 'surah' &&
        base.fromAyah > getMaxAyah(base.fromSurah)
      ) {
        base.fromSurah = Math.min(114, base.fromSurah + 1);
        base.fromAyah = 1;
      }
      base.toSurah = base.fromSurah;
      base.toAyah = Math.min(base.fromAyah + 4, getMaxAyah(base.fromSurah));
      base.fromJuz = last.toJuz || 1;
      base.fromQuarter = last.toQuarter || 1;
      base.toJuz = last.toJuz || 1;
      base.toQuarter = last.toQuarter || 8;
      base.score = String(last.score || 8);
      base.attempt = String((last.attempt || 0) + 1);
      base.topic = last.topic || '';
    }

    setForm(base);
    setSelectedStudent(student);
    setIsEditing(false);
    setEditingId(null);
    setFormError('');
    setFormVisible(true);
  };

  // ============================================================
  // OPEN EDIT MODAL
  // ============================================================
  const openEdit = (achievement: Achievement) => {
    const studentId = getStudentId(achievement);
    const student = students.find((s) => s._id === studentId) || null;

    const base: AchievementFormState = {
      studentId,
      type: achievement.type,
      rangeType: achievement.rangeType || 'surah',
      fromSurah: achievement.fromSurah || 1,
      fromAyah: achievement.fromAyah || 1,
      toSurah: achievement.toSurah || 1,
      toAyah: achievement.toAyah || 1,
      fromJuz: achievement.fromJuz || 1,
      fromQuarter: achievement.fromQuarter || 1,
      toJuz: achievement.toJuz || 1,
      toQuarter: achievement.toQuarter || 8,
      fromBookPage: achievement.fromBookPage
        ? String(achievement.fromBookPage)
        : '',
      toBookPage: achievement.toBookPage ? String(achievement.toBookPage) : '',
      bookId: achievement.bookId || '',
      bookName: achievement.bookName || '',
      score: String(achievement.score || 8),
      attempt: String(achievement.attempt || 1),
      comment: achievement.comment || '',
      topic: achievement.topic || '',
      customTopic: '',
      rwNote: achievement.rwNote || '',
    };

    setForm(base);
    setSelectedStudent(student);
    setIsEditing(true);
    setEditingId(achievement._id);
    setFormError('');
    setFormVisible(true);
  };

  // ============================================================
  // FORM: SAVE
  // ============================================================
  const handleSave = async () => {
    if (!selectedStudent) return;
    if (!currentBranch?._id) {
      setFormError(t('memorization.modal.errors.noBranch'));
      return;
    }
    if (form.type === 'tashiih' && !form.topic) {
      setFormError(t('memorization.modal.errors.selectTopic'));
      return;
    }
    if (form.type === 'reading_writing' && !form.topic) {
      setFormError(t('memorization.modal.errors.selectTopic'));
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const totalMarks = form.type === 'subac' ? 100 : 10;
      const rawScore =
        parseInt(form.score, 10) || (form.type === 'subac' ? 80 : 8);
      const score = Math.min(totalMarks, Math.max(0, rawScore));

      const payload: any = {
        studentId: form.studentId,
        studentName: selectedStudent.name,
        halaqahId:
          getHalaqahId(selectedStudent) ||
          (selectedHalaqah?.isAll ? undefined : selectedHalaqah?._id),
        halaqahName:
          getHalaqahName(selectedStudent) ||
          (selectedHalaqah?.isAll ? undefined : selectedHalaqah?.name),
        date,
        type: form.type,
        score,
        totalMarks,
        comment: form.comment || '',
        branchId: currentBranch._id,
      };

      if (form.type === 'tashiih') {
        let topic = form.topic;
        if (topic === 'Other') topic = form.customTopic || 'Other';
        payload.topic = topic;
      } else if (form.type === 'reading_writing') {
        let topic = form.topic;
        if (topic === 'Other') topic = form.customTopic || 'Other';
        payload.topic = topic;
        payload.rwNote = form.rwNote || '';
        payload.comment = form.comment || '';
      } else if (form.type === 'book_review') {
        if (form.bookId) payload.bookId = form.bookId;
        payload.bookName = form.bookName;
        payload.bookType = 'pages';
        payload.fromBookPage = parseInt(form.fromBookPage, 10) || 0;
        payload.toBookPage = parseInt(form.toBookPage, 10) || 0;
        payload.rangeType = 'surah';
      } else {
        payload.rangeType = form.rangeType;
        payload.attempt = parseInt(form.attempt, 10) || 1;
        if (form.rangeType === 'surah') {
          payload.fromSurah = form.fromSurah;
          payload.fromAyah = form.fromAyah;
          payload.toSurah = form.toSurah;
          payload.toAyah = form.toAyah;
        } else {
          payload.fromJuz = form.fromJuz;
          payload.fromQuarter = form.fromQuarter;
          payload.toJuz = form.toJuz;
          payload.toQuarter = form.toQuarter;
        }
      }

      // Edits need a live server (they upsert by _id already).
      // Only NEW records go into the offline queue.
      if (isEditing && editingId) {
        if (!isOnline) {
          setFormError(
            'You must be online to edit an existing record.'
          );
          setSaving(false);
          return;
        }
        await api.updateAchievement(editingId, payload);
        notify(
          'success',
          t('memorization.modal.updatedTitle'),
          t('memorization.modal.updatedMsg')
        );
        setFormVisible(false);
        await loadData();
        return;
      }

      // -------- OFFLINE PATH (new record only) --------
      if (!isOnline) {
        await enqueue('memorization', currentBranch._id, payload);
        setFormVisible(false);
        notify(
          'success',
          t('memorization.modal.savedTitle'),
          'Saved offline — will sync automatically'
        );
        await loadData();
        return;
      }

      // -------- ONLINE PATH (new record) --------
      try {
        await api.createAchievement(payload);
        notify(
          'success',
          t('memorization.modal.savedTitle'),
          t('memorization.modal.savedMsg', { name: selectedStudent.name })
        );
        setFormVisible(false);
        await loadData();
      } catch (err: any) {
        // Weak signal / timeout / server error → queue silently
        await enqueue('memorization', currentBranch._id, payload);
        setFormVisible(false);
        notify(
          'success',
          t('memorization.modal.savedTitle'),
          'Saved offline — will sync automatically'
        );
        await loadData();
      }
    } catch (err: any) {
      console.error('Save achievement error:', err);
      setFormError(
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('memorization.modal.saveFailed')
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // DELETE
  // ============================================================
  const handleDelete = (achievement: Achievement) => {
    const typeLabel = getTypeInfo(achievement.type, t).label;
    notify(
      'warning',
      t('memorization.modal.deleteTitle'),
      t('memorization.modal.deleteConfirm', { type: typeLabel }),
      [
        { text: t('memorization.modal.deleteCancel'), style: 'cancel' },
        {
          text: t('memorization.modal.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteAchievement(achievement._id);
              await loadData();
            } catch (err: any) {
              notify(
                'error',
                t('memorization.modal.errorTitle'),
                err?.message || t('memorization.modal.deleteFailed')
              );
            }
          },
        },
      ]
    );
  };

  // ============================================================
  // RENDER STUDENT CARD
  // ============================================================
  const renderStudent = ({ item }: { item: Student }) => {
    const count = getTodayCount(item._id);
    const last = getLastAchievement(item._id);
    return (
      <View style={styles.studentCard}>
        <View style={styles.studentRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
          </View>
          <View style={styles.studentInfo}>
            <Text style={styles.studentName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.studentMeta} numberOfLines={1}>
              {item.regNo || t('memorization.record.studentRegNA')} ·{' '}
              {getHalaqahName(item) || t('memorization.record.noHalaqah')}
            </Text>
            {last && (
              <Text style={styles.studentLast} numberOfLines={1}>
                {t('memorization.record.lastPrefix')} {getRangeDisplay(last, t)} (
                {last.score}/
                {last.type === 'subac' ? last.totalMarks || 100 : 10})
              </Text>
            )}
          </View>
          <View style={styles.todayBadge}>
            <Text style={styles.todayBadgeValue}>{count}</Text>
            <Text style={styles.todayBadgeLabel}>
              {t('memorization.record.today')}
            </Text>
          </View>
        </View>

        <View style={styles.studentActions}>
          <TouchableOpacity
            style={styles.actionBtnPrimary}
            onPress={() => openAdd(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle" size={16} color="#fff" />
            <Text style={styles.actionBtnPrimaryText}>
              {t('memorization.record.addAchievement')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color={COLORS.slate} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {t('memorization.record.title')}
          </Text>
          <Text style={styles.headerSubtitle}>
            {t('memorization.record.subtitle', {
              date,
              count: todayAchievements.length,
            })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => setBooksOpen(true)}
        >
          <Ionicons name="library-outline" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* CONTROLS */}
      <View style={styles.controlsBlock}>
        <View style={styles.controlRow}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.slateMuted} />
          <TextInput
            style={styles.dateInput}
            value={date}
            onChangeText={setDate}
            placeholder={t('memorization.record.datePlaceholder')}
            placeholderTextColor="#A0AAA5"
          />
        </View>

        {halaqat.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 44 }}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {halaqat.map((h) => {
              const active = selectedHalaqah?._id === h._id;
              return (
                <TouchableOpacity
                  key={h._id}
                  style={[styles.halaqahChip, active && styles.halaqahChipActive]}
                  onPress={() => setSelectedHalaqah(h)}
                >
                  <Text
                    style={[
                      styles.halaqahChipText,
                      active && styles.halaqahChipTextActive,
                    ]}
                  >
                    {h.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* GROUPS SECTION */}
      <GroupsSection
        groups={groups}
        students={students}
        halaqat={halaqat}
        onCreate={handleCreateGroup}
        onUpdate={handleUpdateGroup}
        onDelete={handleDeleteGroup}
        onRecord={(g) => setRecordGroup(g)}
      />

      {/* SEARCH */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('memorization.record.searchPlaceholder')}
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

      {/* ERROR */}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* LIST */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('memorization.record.loading')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredStudents}
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
              <Ionicons name="book-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>
                {t('memorization.record.noResultsTitle')}
              </Text>
              <Text style={styles.emptyText}>
                {searchTerm
                  ? t('memorization.record.noResultsSearch')
                  : t('memorization.record.noResultsNoHalaqah')}
              </Text>
            </View>
          }
        />
      )}

      {/* TODAY'S ACHIEVEMENTS LIST */}
      {todayAchievements.length > 0 && (
        <View style={styles.todaySection}>
          <View style={styles.todayHeader}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
            <Text style={styles.todayTitle}>
              {t('memorization.record.todayRecords', {
                count: todayAchievements.length,
              })}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {todayAchievements.slice(0, 20).map((a) => {
              const typeInfo = getTypeInfo(a.type, t);
              return (
                <TouchableOpacity
                  key={a._id}
                  style={[styles.achievementChip, { backgroundColor: typeInfo.bg }]}
                  onPress={() => openEdit(a)}
                >
                  <Text
                    style={[styles.achievementChipText, { color: typeInfo.color }]}
                  >
                    {getStudentName(a, t).split(' ')[0]} · {a.score}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* BOOKS MODAL */}
      <BooksModal
        visible={booksOpen}
        books={books}
        onClose={() => setBooksOpen(false)}
        onChange={setBooks}
        branchId={currentBranch?._id}
      />

      {/* GROUP RECORD MODAL */}
      <GroupRecordModal
        visible={!!recordGroup}
        group={recordGroup}
        students={students}
        defaultDate={date}
        onClose={() => setRecordGroup(null)}
        onSaved={async () => {
          await loadData();
        }}
        branchId={currentBranch?._id}
      />

      {/* ============ ADD / EDIT MODAL ============ */}
      <Modal
        visible={formVisible}
        animationType="slide"
        transparent
        onRequestClose={() => !saving && setFormVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {isEditing
                    ? t('memorization.modal.editTitle')
                    : t('memorization.modal.addTitle')}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {selectedStudent?.name} · {date}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => !saving && setFormVisible(false)}
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

              {/* Type chips */}
              <Text style={styles.formLabel}>
                {t('memorization.modal.achievementType')}
              </Text>
              <View style={styles.chipRow}>
                {ACHIEVEMENT_TYPES.map((type) => {
                  const active = form.type === type.value;
                  return (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.typeChip,
                        active && { backgroundColor: type.bg, borderColor: type.color },
                      ]}
                      onPress={() =>
                        setForm((prev) => ({ ...prev, type: type.value }))
                      }
                    >
                      <Ionicons
                        name={type.icon}
                        size={14}
                        color={active ? type.color : COLORS.slateMuted}
                      />
                      <Text
                        style={[
                          styles.typeChipText,
                          active && { color: type.color, fontWeight: '800' },
                        ]}
                      >
                        {t(type.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Tashiih topics */}
              {form.type === 'tashiih' && (
                <>
                  <Text style={styles.formLabel}>
                    {t('memorization.modal.topic')}
                  </Text>
                  <View style={styles.chipRow}>
                    {TASHIIH_TOPICS.map((topic) => {
                      const active = form.topic === topic;
                      return (
                        <TouchableOpacity
                          key={topic}
                          style={[styles.topicChip, active && styles.topicChipActive]}
                          onPress={() => setForm((prev) => ({ ...prev, topic }))}
                        >
                          <Text
                            style={[
                              styles.topicChipText,
                              active && styles.topicChipTextActive,
                            ]}
                          >
                            {getTopicLabel(topic, t, 'tashiih')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {form.topic === 'Other' && (
                    <TextInput
                      style={styles.formInput}
                      value={form.customTopic}
                      onChangeText={(v) =>
                        setForm((prev) => ({ ...prev, customTopic: v }))
                      }
                      placeholder={t('memorization.modal.topicCustomPlaceholder')}
                      placeholderTextColor="#A0AAA5"
                    />
                  )}
                </>
              )}

              {/* Reading & Writing topics + note */}
              {form.type === 'reading_writing' && (
                <>
                  <Text style={styles.formLabel}>
                    {t('memorization.modal.topic')}
                  </Text>
                  <View style={styles.chipRow}>
                    {READING_WRITING_TOPICS.map((topic) => {
                      const active = form.topic === topic;
                      return (
                        <TouchableOpacity
                          key={topic}
                          style={[styles.topicChip, active && styles.topicChipActive]}
                          onPress={() => setForm((prev) => ({ ...prev, topic }))}
                        >
                          <Text
                            style={[
                              styles.topicChipText,
                              active && styles.topicChipTextActive,
                            ]}
                          >
                            {getTopicLabel(topic, t, 'rw')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {form.topic === 'Other' && (
                    <TextInput
                      style={styles.formInput}
                      value={form.customTopic}
                      onChangeText={(v) =>
                        setForm((prev) => ({ ...prev, customTopic: v }))
                      }
                      placeholder={t('memorization.modal.topicCustomPlaceholder')}
                      placeholderTextColor="#A0AAA5"
                    />
                  )}
                  <Text style={styles.formLabel}>
                    {t('memorization.modal.rwNote') || 'Note'}
                  </Text>
                  <TextInput
                    style={[styles.formInput, styles.textArea]}
                    value={form.rwNote}
                    onChangeText={(v) => setForm((prev) => ({ ...prev, rwNote: v }))}
                    multiline
                    numberOfLines={3}
                    placeholder={t('memorization.modal.rwNotePlaceholder') || '...'}
                    placeholderTextColor="#A0AAA5"
                  />
                </>
              )}

              {/* Range type */}
              {form.type !== 'tashiih' &&
                form.type !== 'book_review' &&
                form.type !== 'reading_writing' && (
                  <>
                    <Text style={styles.formLabel}>
                      {t('memorization.modal.rangeType')}
                    </Text>
                    <View style={styles.chipRow}>
                      {(['surah', 'juz'] as const).map((rt) => {
                        const active = form.rangeType === rt;
                        return (
                          <TouchableOpacity
                            key={rt}
                            style={[
                              styles.rangeChip,
                              active && styles.rangeChipActive,
                            ]}
                            onPress={() =>
                              setForm((prev) => ({ ...prev, rangeType: rt }))
                            }
                          >
                            <Text
                              style={[
                                styles.rangeChipText,
                                active && styles.rangeChipTextActive,
                              ]}
                            >
                              {rt === 'surah'
                                ? t('memorization.modal.surah')
                                : t('memorization.modal.juz')}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {form.rangeType === 'surah' ? (
                      <>
                        <SurahPicker
                          value={form.fromSurah}
                          onChange={(id) =>
                            setForm((prev) => ({ ...prev, fromSurah: id }))
                          }
                          showAyah
                          ayahValue={form.fromAyah}
                          onAyahChange={(a) =>
                            setForm((prev) => ({ ...prev, fromAyah: a }))
                          }
                          label={t('memorization.modal.from')}
                        />
                        <SurahPicker
                          value={form.toSurah}
                          onChange={(id) =>
                            setForm((prev) => ({ ...prev, toSurah: id }))
                          }
                          showAyah
                          ayahValue={form.toAyah}
                          onAyahChange={(a) =>
                            setForm((prev) => ({ ...prev, toAyah: a }))
                          }
                          label={t('memorization.modal.to')}
                        />
                      </>
                    ) : (
                      <>
                        <JuzPicker
                          value={form.fromJuz}
                          onChange={(id) =>
                            setForm((prev) => ({ ...prev, fromJuz: id }))
                          }
                          label={t('memorization.modal.from')}
                        />
                        <QuarterPicker
                          value={form.fromQuarter}
                          onChange={(v) =>
                            setForm((prev) => ({ ...prev, fromQuarter: v }))
                          }
                          label={t('memorization.modal.quarterLabel')}
                        />
                        <JuzPicker
                          value={form.toJuz}
                          onChange={(id) =>
                            setForm((prev) => ({ ...prev, toJuz: id }))
                          }
                          label={t('memorization.modal.to')}
                        />
                        <QuarterPicker
                          value={form.toQuarter}
                          onChange={(v) =>
                            setForm((prev) => ({ ...prev, toQuarter: v }))
                          }
                          label={t('memorization.modal.quarterLabel')}
                        />
                      </>
                    )}

                    <Text style={styles.formLabel}>
                      {t('memorization.modal.attempt')}
                    </Text>
                    <View style={styles.chipRow}>
                      {['1', '2', '3', '4', '5'].map((a) => {
                        const active = form.attempt === a;
                        return (
                          <TouchableOpacity
                            key={a}
                            style={[
                              styles.attemptChip,
                              active && styles.attemptChipActive,
                            ]}
                            onPress={() =>
                              setForm((prev) => ({ ...prev, attempt: a }))
                            }
                          >
                            <Text
                              style={[
                                styles.attemptChipText,
                                active && styles.attemptChipTextActive,
                              ]}
                            >
                              {a}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}

              {/* Book review fields */}
              {form.type === 'book_review' && (
                <>
                  <Text style={styles.formLabel}>
                    {t('memorization.modal.bookName')}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={form.bookName}
                    onChangeText={(v) =>
                      setForm((prev) => ({ ...prev, bookName: v }))
                    }
                    placeholder={t('memorization.modal.bookNamePlaceholder')}
                    placeholderTextColor="#A0AAA5"
                  />

                  <Text style={styles.formLabel}>
                    {t('memorization.modal.pages')}
                  </Text>
                  <View style={styles.twoCol}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniLabel}>
                        {t('memorization.modal.from')}
                      </Text>
                      <TextInput
                        style={styles.formInput}
                        value={form.fromBookPage}
                        onChangeText={(v) =>
                          setForm((prev) => ({
                            ...prev,
                            fromBookPage: v.replace(/[^0-9]/g, ''),
                          }))
                        }
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniLabel}>
                        {t('memorization.modal.to')}
                      </Text>
                      <TextInput
                        style={styles.formInput}
                        value={form.toBookPage}
                        onChangeText={(v) =>
                          setForm((prev) => ({
                            ...prev,
                            toBookPage: v.replace(/[^0-9]/g, ''),
                          }))
                        }
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </>
              )}

              {/* Score */}
              <Text style={styles.formLabel}>
                {t('memorization.modal.scoreLabel', {
                  max: form.type === 'subac' ? '100' : '10',
                })}
              </Text>
              <TextInput
                style={styles.formInput}
                value={form.score}
                onChangeText={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    score: v.replace(/[^0-9]/g, ''),
                  }))
                }
                keyboardType="numeric"
                placeholder={form.type === 'subac' ? '80' : '8'}
                placeholderTextColor="#A0AAA5"
              />

              {/* Comment */}
              <Text style={styles.formLabel}>
                {t('memorization.modal.commentLabel')}
              </Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={form.comment}
                onChangeText={(v) => setForm((prev) => ({ ...prev, comment: v }))}
                placeholder={t('memorization.modal.commentPlaceholder')}
                placeholderTextColor="#A0AAA5"
                multiline
                numberOfLines={3}
              />

              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => !saving && setFormVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>
                  {t('memorization.modal.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>
                      {isEditing
                        ? t('memorization.modal.update')
                        : t('memorization.modal.save')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Professional feedback popup (replaces Alert.alert) */}
      <FeedbackModal
        visible={feedback.visible}
        tone={feedback.tone}
        title={feedback.title}
        message={feedback.message}
        buttons={feedback.buttons}
        onClose={() => setFeedback((p) => ({ ...p, visible: false }))}
      />
    </SafeAreaView>
  );
};

export default RecordAchievements;

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.slate },
  headerSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },

  controlsBlock: { paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  dateInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.slate,
    paddingVertical: 0,
  },
  halaqahChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  halaqahChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  halaqahChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },
  halaqahChipTextActive: { color: COLORS.primary },

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
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: COLORS.blue },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '700', color: COLORS.slate },
  studentMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  studentLast: {
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  todayBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  todayBadgeValue: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  todayBadgeLabel: { fontSize: 9, fontWeight: '700', color: COLORS.primary },
  studentActions: { flexDirection: 'row', gap: 8 },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnPrimaryText: { color: '#fff', fontSize: 12, fontWeight: '700' },

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

  todaySection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  todayTitle: { fontSize: 12, fontWeight: '800', color: COLORS.slate },
  achievementChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  achievementChipText: { fontSize: 11, fontWeight: '700' },

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
  modalBody: { paddingHorizontal: 20, paddingTop: 16 },

  formLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  miniLabel: {
    fontSize: 10,
    color: COLORS.slateMuted,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
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
    fontSize: 10,
    color: COLORS.gray,
    marginTop: 4,
    fontStyle: 'italic',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },

  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    gap: 4,
  },
  typeChipText: { fontSize: 11, fontWeight: '700', color: COLORS.slateMuted },

  topicChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  topicChipActive: {
    backgroundColor: COLORS.tealLight,
    borderColor: COLORS.teal,
  },
  topicChipText: { fontSize: 11, fontWeight: '700', color: COLORS.slateMuted },
  topicChipTextActive: { color: COLORS.teal },

  rangeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  rangeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  rangeChipText: { fontSize: 12, fontWeight: '700', color: COLORS.slateMuted },
  rangeChipTextActive: { color: '#fff' },

  attemptChip: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attemptChipActive: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  attemptChipText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slateMuted,
  },
  attemptChipTextActive: { color: '#fff' },

  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.redLight,
    borderWidth: 1,
    borderColor: '#F6C8C8',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  modalErrorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.red,
  },

  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
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
    backgroundColor: COLORS.primary,
    gap: 6,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

// t('memorization.modal.savedMsg', { name: selectedStudent.name })