// src/screens/teacher/TeacherAttendanceScreen.tsx
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
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { api as apiClient } from '../../api/client';

// ============================================================
// COLORS
// ============================================================
const COLORS = {
  primary: '#0A8E5A',
  primaryLight: '#E9F8F0',
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
type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Excused' | '';

interface AttendanceSlot {
  slotNumber: number;
  name: string;
  startTime: string;
  endTime: string;
}

interface Halaqah {
  _id: string;
  name: string;
}

interface StudentRow {
  _id: string;
  id?: string;
  name: string;
  regNo?: string;
  halaqahName?: string;
  timeType?: string;
  profilePicture?: string;
  attendanceStatus?: AttendanceStatus;
  comment?: string;
}

const STATUSES: Exclude<AttendanceStatus, ''>[] = [
  'Present',
  'Late',
  'Absent',
  'Excused',
];

const STATUS_KEY: Record<Exclude<AttendanceStatus, ''>, string> = {
  Present: 'present',
  Late: 'late',
  Absent: 'absent',
  Excused: 'excused',
};

const statusColor = (s: AttendanceStatus) => {
  switch (s) {
    case 'Present':
      return COLORS.primary;
    case 'Late':
      return COLORS.amber;
    case 'Absent':
      return COLORS.red;
    case 'Excused':
      return COLORS.blue;
    default:
      return '#94A3B8';
  }
};

const getInitials = (name: string) => {
  const parts = (name || '').trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || '').substring(0, 2).toUpperCase();
};

// ============================================================
// SCREEN
// ============================================================
export const TeacherAttendanceScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { currentBranch } = useBranch();

  // List state
  const [halaqat, setHalaqat] = useState<Halaqah[]>([]);
  const [selectedHalaqah, setSelectedHalaqah] = useState<string>('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  // Attendance state
  const [studentStatus, setStudentStatus] = useState<Record<string, AttendanceStatus>>({});
  const [studentComments, setStudentComments] = useState<Record<string, string>>({});

  // Slots
  const [attendanceCount, setAttendanceCount] = useState(1);
  const [slots, setSlots] = useState<AttendanceSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AttendanceSlot | null>(null);

  // UI
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Comment modal
  const [commentModal, setCommentModal] = useState<{
    visible: boolean;
    studentId: string;
    studentName: string;
  }>({ visible: false, studentId: '', studentName: '' });
  const [commentDraft, setCommentDraft] = useState('');

  // ============================================================
  // BOOT: settings + teacher halaqahs
  // ============================================================
  useEffect(() => {
    (async () => {
      try {
        const [settingsRes, halaqatRes]: any = await Promise.all([
          apiClient.get('/attendance/settings').catch(() => null),
          apiClient.get('/teacher/attendance/halaqat'),
        ]);

        const count = settingsRes?.attendanceCount || 1;
        const slotList: AttendanceSlot[] = settingsRes?.slots || [];
        setAttendanceCount(count);
        setSlots(slotList);
        setSelectedSlot(slotList[0] || null);

        const list: Halaqah[] = Array.isArray(halaqatRes)
          ? halaqatRes
          : halaqatRes?.data || [];
        setHalaqat(list);

        if (list.length > 0) {
          setSelectedHalaqah(list[0]._id);
        }
      } catch (err: any) {
        console.warn('Load teacher attendance setup error:', err);
        setError(err?.message || t('teacher.attendance.errors.loadHalaqatFailed'));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // FETCH STUDENTS
  // ============================================================
  const fetchStudents = useCallback(async () => {
    if (!selectedHalaqah) {
      setStudents([]);
      setStudentStatus({});
      setStudentComments({});
      return;
    }
    setError('');
    try {
      const params: any = { halaqah: selectedHalaqah, date };
      if (attendanceCount > 1 && selectedSlot) {
        params.slotNumber = selectedSlot.slotNumber;
      }
      const res: any = await apiClient.get('/teacher/attendance/students', params);
      const list: StudentRow[] = Array.isArray(res)
        ? res
        : res?.students || res?.data || [];
      setStudents(list);

      const nextStatus: Record<string, AttendanceStatus> = {};
      const nextComments: Record<string, string> = {};
      list.forEach((s) => {
        const id = s._id || s.id || '';
        if (!id) return;
        nextStatus[id] = (s.attendanceStatus as AttendanceStatus) || '';
        if (s.comment) nextComments[id] = s.comment;
      });
      setStudentStatus(nextStatus);
      setStudentComments(nextComments);
    } catch (err: any) {
      console.error('Fetch students error:', err);
      setError(err?.message || t('teacher.attendance.errors.loadStudentsFailed'));
      setStudents([]);
    }
  }, [selectedHalaqah, date, attendanceCount, selectedSlot, t]);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStudents();
    setRefreshing(false);
  };

  // ============================================================
  // FILTER
  // ============================================================
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return students;
    const q = searchTerm.toLowerCase();
    return students.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        (s.regNo || '').toLowerCase().includes(q) ||
        (s.halaqahName || '').toLowerCase().includes(q) ||
        (s.timeType || '').toLowerCase().includes(q)
    );
  }, [students, searchTerm]);

  // ============================================================
  // STATUS + COMMENT HANDLERS
  // ============================================================
  const setStudent = (id: string, status: AttendanceStatus) => {
    setStudentStatus((prev) => ({ ...prev, [id]: status }));
    if (status === 'Present') {
      setStudentComments((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const markAllVisible = (status: AttendanceStatus) => {
    if (!selectedHalaqah) {
      setError(t('teacher.attendance.errors.selectHalaqah'));
      setTimeout(() => setError(''), 3000);
      return;
    }
    Alert.alert(
      t('teacher.attendance.markAllTitle'),
      t('teacher.attendance.markAllConfirm', {
        count: filteredStudents.length,
        status: t(`teacher.attendance.statuses.${STATUS_KEY[status as Exclude<AttendanceStatus, ''>]}`),
      }),
      [
        { text: t('teacher.attendance.buttons.cancel'), style: 'cancel' },
        {
          text: t('teacher.attendance.buttons.save'),
          onPress: () => {
            const next = { ...studentStatus };
            filteredStudents.forEach((s) => {
              const id = s._id || s.id || '';
              if (!id) return;
              next[id] = status;
            });
            setStudentStatus(next);
            if (status === 'Present') {
              setStudentComments((prev) => {
                const copy = { ...prev };
                filteredStudents.forEach((s) => {
                  const id = s._id || s.id || '';
                  delete copy[id];
                });
                return copy;
              });
            }
          },
        },
      ]
    );
  };

  const openComment = (student: StudentRow) => {
    const id = student._id || student.id || '';
    setCommentModal({ visible: true, studentId: id, studentName: student.name });
    setCommentDraft(studentComments[id] || '');
  };

  const saveComment = () => {
    setStudentComments((prev) => ({
      ...prev,
      [commentModal.studentId]: commentDraft,
    }));
    setCommentModal({ visible: false, studentId: '', studentName: '' });
    setCommentDraft('');
  };

  // ============================================================
  // SAVE
  // ============================================================
  const handleSave = async () => {
    if (!currentBranch?._id) {
      Alert.alert(
        t('teacher.attendance.errors.noBranchTitle'),
        t('teacher.attendance.errors.noBranchMsg')
      );
      return;
    }

    const records: any[] = [];
    Object.entries(studentStatus).forEach(([id, status]) => {
      if (!status) return;
      const record: any = {
        userId: id,
        userType: 'Student',
        status,
        hours: 0,
        date,
        branchId: currentBranch._id,
        recordedBy: (user as any)?._id || (user as any)?.userId,
      };
      if (attendanceCount > 1 && selectedSlot) {
        record.slotNumber = selectedSlot.slotNumber;
        record.slotName = selectedSlot.name;
      }
      const comment = studentComments[id];
      if (
        comment &&
        comment.trim() &&
        ['Late', 'Excused', 'Absent'].includes(status)
      ) {
        record.comments = comment;
      }
      records.push(record);
    });

    if (records.length === 0) {
      Alert.alert(
        t('teacher.attendance.status.noRecords'),
        t('teacher.attendance.status.noRecords')
      );
      return;
    }

    setSaving(true);
    try {
      const payload: any = { records, branchId: currentBranch._id };
      if (attendanceCount > 1 && selectedSlot) {
        payload.slotNumber = selectedSlot.slotNumber;
        payload.slotName = selectedSlot.name;
      }
      await apiClient.post('/teacher/attendance/bulk', payload);
      Alert.alert(
        t('teacher.attendance.alerts.savedTitle'),
        t('teacher.attendance.alerts.savedMsg', {
          count: records.length,
          date,
        })
      );
      await fetchStudents();
    } catch (err: any) {
      Alert.alert(
        t('teacher.attendance.errors.noBranchTitle'),
        err?.message || t('teacher.attendance.errors.saveFailed')
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // RENDER: student card
  // ============================================================
  const renderStudent = ({ item }: { item: StudentRow }) => {
    const id = item._id || item.id || '';
    const status = studentStatus[id] || '';
    const comment = studentComments[id] || '';
    const showComment = ['Late', 'Excused', 'Absent'].includes(status);

    return (
      <View style={styles.studentCard}>
        {/* Top row: avatar + info */}
        <View style={styles.studentRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
          </View>
          <View style={styles.studentInfo}>
            <Text style={styles.studentName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.studentMeta} numberOfLines={1}>
              {item.regNo || '—'}
              {item.halaqahName ? ` · ${item.halaqahName}` : ''}
              {item.timeType ? ` · ${item.timeType}` : ''}
            </Text>
          </View>
        </View>

        {/* Status chips */}
        <View style={styles.statusRow}>
          {STATUSES.map((s) => {
            const active = status === s;
            const color = statusColor(s);
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusChip,
                  active && { backgroundColor: color, borderColor: color },
                ]}
                onPress={() => setStudent(id, s)}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    active && { color: '#fff', fontWeight: '800' },
                  ]}
                >
                  {t(`teacher.attendance.statuses.${STATUS_KEY[s]}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Comment button for Late/Absent/Excused */}
        {showComment && (
          <TouchableOpacity
            style={styles.commentRow}
            onPress={() => openComment(item)}
          >
            <Ionicons
              name={comment ? 'chatbubble-ellipses' : 'chatbubble-outline'}
              size={14}
              color={comment ? COLORS.blue : COLORS.slateMuted}
            />
            <Text
              style={[
                styles.commentText,
                comment && { color: COLORS.blue, fontWeight: '600' },
              ]}
              numberOfLines={1}
            >
              {comment
                ? comment
                : t('teacher.attendance.comment.addTitle')}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.gray} />
          </TouchableOpacity>
        )}
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
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.slate} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {t('teacher.attendance.title')}
          </Text>
          <Text style={styles.headerSubtitle}>
            {date}
            {attendanceCount > 1 && selectedSlot
              ? ` · ${selectedSlot.name}`
              : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="save" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>
                {t('teacher.attendance.buttons.save')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* CONTROLS */}
      <View style={styles.controlsBlock}>
        {/* Date */}
        <View style={styles.controlRow}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.slateMuted} />
          <TextInput
            style={styles.dateInput}
            value={date}
            onChangeText={setDate}
            placeholder={t('teacher.attendance.datePlaceholder')}
            placeholderTextColor="#A0AAA5"
          />
        </View>

        {/* Halaqah chips */}
        {halaqat.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 44 }}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {halaqat.map((h) => {
              const active = selectedHalaqah === h._id;
              return (
                <TouchableOpacity
                  key={h._id}
                  style={[styles.halaqahChip, active && styles.halaqahChipActive]}
                  onPress={() => setSelectedHalaqah(h._id)}
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

        {/* Slot chips */}
        {attendanceCount > 1 && slots.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 44 }}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {slots.map((slot) => {
              const active = selectedSlot?.slotNumber === slot.slotNumber;
              return (
                <TouchableOpacity
                  key={slot.slotNumber}
                  style={[
                    styles.slotChip,
                    active && styles.slotChipActive,
                  ]}
                  onPress={() => setSelectedSlot(slot)}
                >
                  <Text
                    style={[
                      styles.slotChipText,
                      active && styles.slotChipTextActive,
                    ]}
                  >
                    {slot.name} ({slot.startTime}-{slot.endTime})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* SEARCH */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('teacher.attendance.searchPlaceholder')}
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

      {/* MARK ALL */}
      <View style={styles.markAllRow}>
        <Text style={styles.markAllLabel}>
          {t('teacher.attendance.markAllLabel')}
        </Text>
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.markAllChip, { backgroundColor: statusColor(s) }]}
            onPress={() => markAllVisible(s)}
          >
            <Text style={styles.markAllChipText}>
              {t(`teacher.attendance.statuses.${STATUS_KEY[s]}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ERROR */}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* COUNT */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {t('teacher.attendance.studentsCount', {
            count: filteredStudents.length,
          })}
          {searchTerm ? ` · ${t('teacher.attendance.searchResults')}` : ''}
        </Text>
      </View>

      {/* LIST */}
      {loading && students.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('teacher.attendance.loading')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item._id || item.id || item.name}
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
              <Text style={styles.emptyTitle}>
                {t('teacher.attendance.noStudentsFound')}
              </Text>
              <Text style={styles.emptyText}>
                {searchTerm
                  ? t('teacher.attendance.tryDifferentSearch')
                  : t('teacher.attendance.noStudentsHint')}
              </Text>
            </View>
          }
        />
      )}

      {/* COMMENT MODAL */}
      <Modal
        visible={commentModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setCommentModal({ visible: false, studentId: '', studentName: '' })
        }
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {studentComments[commentModal.studentId]
                    ? t('teacher.attendance.comment.editTitle')
                    : t('teacher.attendance.comment.addTitle')}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {commentModal.studentName}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() =>
                  setCommentModal({
                    visible: false,
                    studentId: '',
                    studentName: '',
                  })
                }
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.formLabel}>
                {t('teacher.attendance.comment.label')}
              </Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={commentDraft}
                onChangeText={setCommentDraft}
                placeholder={t('teacher.attendance.comment.placeholder')}
                placeholderTextColor="#A0AAA5"
                multiline
                numberOfLines={4}
              />
              <Text style={styles.formHint}>
                {t('teacher.attendance.comment.hint')}
              </Text>
              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() =>
                  setCommentModal({
                    visible: false,
                    studentId: '',
                    studentName: '',
                  })
                }
              >
                <Text style={styles.cancelBtnText}>
                  {t('teacher.attendance.buttons.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={saveComment}>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>
                  {studentComments[commentModal.studentId]
                    ? t('teacher.attendance.comment.update')
                    : t('teacher.attendance.comment.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default TeacherAttendanceScreen;

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
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.slate },
  headerSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // CONTROLS
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
  slotChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  slotChipActive: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },
  slotChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },
  slotChipTextActive: { color: '#fff' },

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

  // MARK ALL
  markAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 6,
    flexWrap: 'wrap',
  },
  markAllLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
    marginRight: 4,
  },
  markAllChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  markAllChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // ERROR
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

  // COUNT
  countRow: { paddingHorizontal: 16, paddingBottom: 6 },
  countText: { fontSize: 12, color: COLORS.slateMuted, fontWeight: '600' },

  // LIST
  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },

  // STUDENT CARD
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
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '700', color: COLORS.slate },
  studentMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },

  // STATUS CHIPS
  statusRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },

  // COMMENT
  commentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  commentText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.slateMuted,
    fontWeight: '600',
  },

  // LOADING
  loadingWrap: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: COLORS.slateMuted, fontSize: 13 },

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
    maxHeight: '90%',
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
  modalBody: { paddingHorizontal: 20, paddingTop: 12 },

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
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  formHint: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 6,
    fontStyle: 'italic',
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
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});