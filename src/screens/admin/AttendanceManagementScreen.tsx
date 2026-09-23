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
  name: string;
  regNo: string;
  halaqahName?: string;
  timeType?: string;
  profilePicture?: string;
}

interface TeacherRow {
  _id: string;
  name: string;
  username?: string;
  specialization?: string;
  timeType?: string;
  profilePicture?: string;
}

interface DailyHalaqah {
  id: string;
  name: string;
  teacher?: string;
  totalStudents?: number;
  present?: number;
  absent?: number;
  late?: number;
  excused?: number;
  students?: any[];
}

interface TopStudent {
  id?: string;
  name: string;
  regNo?: string;
  halaqah?: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  totalSessions: number;
  attendance: number;
  rank?: number;
}

interface TopHalaqah {
  name: string;
  attendance?: number;
  totalStudents?: number;
  present?: number;
  absent?: number;
  late?: number;
  excused?: number;
  totalSessions?: number;
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

const getMonthLabel = (m: string) => {
  if (!m) return '';
  const [y, mo] = m.split('-').map(Number);
  if (!y || !mo) return m;
  const d = new Date(y, mo - 1, 1);
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

// ============================================================
// ROOT
// ============================================================
export const AttendanceManagementScreen: React.FC = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'menu' | 'take' | 'view'>('menu');

  if (mode === 'take') return <TakeAttendance onBack={() => setMode('menu')} />;
  if (mode === 'view') return <ViewAttendance onBack={() => setMode('menu')} />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('attendance.title')}</Text>
        <Text style={styles.headerSubtitle}>{t('attendance.subtitle')}</Text>
      </View>

      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => setMode('take')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: COLORS.primaryLight }]}>
            <Ionicons name="checkmark-done" size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.menuTitle}>{t('attendance.menu.takeTitle')}</Text>
          <Text style={styles.menuText}>{t('attendance.menu.takeText')}</Text>
          <View style={styles.menuArrow}>
            <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => setMode('view')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIcon, { backgroundColor: COLORS.blueLight }]}>
            <Ionicons name="stats-chart" size={32} color={COLORS.blue} />
          </View>
          <Text style={styles.menuTitle}>{t('attendance.menu.viewTitle')}</Text>
          <Text style={styles.menuText}>{t('attendance.menu.viewText')}</Text>
          <View style={styles.menuArrow}>
            <Ionicons name="arrow-forward" size={18} color={COLORS.blue} />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ============================================================
// TAKE ATTENDANCE
// ============================================================
const TakeAttendance: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { t } = useTranslation();
  const { currentBranch } = useBranch();
  const [tab, setTab] = useState<'students' | 'teachers'>('students');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [halaqat, setHalaqat] = useState<Halaqah[]>([]);
  const [selectedHalaqah, setSelectedHalaqah] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [studentStatus, setStudentStatus] = useState<Record<string, AttendanceStatus>>({});
  const [teacherStatus, setTeacherStatus] = useState<Record<string, AttendanceStatus>>({});
  const [teacherHours, setTeacherHours] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [attendanceCount, setAttendanceCount] = useState(1);
  const [slots, setSlots] = useState<AttendanceSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AttendanceSlot | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [settingsRes, halaqatRes]: any = await Promise.all([
          apiClient.get('/attendance/settings'),
          apiClient.get('/attendance/halaqat'),
        ]);

        const count = settingsRes?.attendanceCount || 1;
        const slotList: AttendanceSlot[] = settingsRes?.slots || [];
        setAttendanceCount(count);
        setSlots(slotList);
        setSelectedSlot(slotList[0] || null);

        const hList: Halaqah[] = Array.isArray(halaqatRes)
          ? halaqatRes
          : halaqatRes?.halaqaat || halaqatRes?.data || [];
        setHalaqat(hList);
        if (hList.length > 0 && !selectedHalaqah) {
          setSelectedHalaqah(hList[0]._id);
        }
      } catch (err) {
        console.warn('Load attendance setup error:', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStudents = useCallback(async () => {
    if (!selectedHalaqah) {
      setStudents([]);
      return;
    }
    setError('');
    try {
      const params: any = { halaqah: selectedHalaqah, date };
      if (attendanceCount > 1 && selectedSlot) {
        params.slotNumber = selectedSlot.slotNumber;
      }
      const res: any = await apiClient.get('/attendance/students', params);
      const list: StudentRow[] = Array.isArray(res) ? res : res?.students || res?.data || [];
      setStudents(list);

      const next: Record<string, AttendanceStatus> = {};
      list.forEach((s) => {
        const id = s._id;
        const existing = (s as any).attendanceStatus as AttendanceStatus | undefined;
        next[id] = existing || '';
      });
      setStudentStatus(next);
    } catch (err: any) {
      console.error('Fetch students error:', err);
      setError(err?.message || t('attendance.take.loadStudentsFailed'));
      setStudents([]);
    }
  }, [selectedHalaqah, date, attendanceCount, selectedSlot, t]);

  const fetchTeachers = useCallback(async () => {
    setError('');
    try {
      const params: any = { date };
      if (attendanceCount > 1 && selectedSlot) {
        params.slotNumber = selectedSlot.slotNumber;
      }
      const res: any = await apiClient.get('/attendance/teachers', params);
      const list: TeacherRow[] = Array.isArray(res) ? res : res?.teachers || res?.data || [];
      setTeachers(list);

      const nextStatus: Record<string, AttendanceStatus> = {};
      const nextHours: Record<string, number> = {};
      list.forEach((tt) => {
        nextStatus[tt._id] = ((tt as any).attendanceStatus as AttendanceStatus) || '';
        nextHours[tt._id] = Number((tt as any).attendanceHours) || 4;
      });
      setTeacherStatus(nextStatus);
      setTeacherHours(nextHours);
    } catch (err: any) {
      console.error('Fetch teachers error:', err);
      setError(err?.message || t('attendance.take.loadTeachersFailed'));
      setTeachers([]);
    }
  }, [date, attendanceCount, selectedSlot, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (tab === 'students') await fetchStudents();
      else await fetchTeachers();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, fetchStudents, fetchTeachers]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (tab === 'students') await fetchStudents();
    else await fetchTeachers();
    setRefreshing(false);
  };

  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return students;
    const q = searchTerm.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.regNo || '').toLowerCase().includes(q) ||
        (s.halaqahName || '').toLowerCase().includes(q)
    );
  }, [students, searchTerm]);

  const setStudent = (id: string, status: AttendanceStatus) => {
    setStudentStatus((prev) => ({ ...prev, [id]: status }));
  };

  const setTeacher = (id: string, status: AttendanceStatus) => {
    setTeacherStatus((prev) => ({ ...prev, [id]: status }));
    setTeacherHours((prev) => ({
      ...prev,
      [id]:
        status === 'Present' || status === 'Late'
          ? prev[id] || 4
          : 0,
    }));
  };

  const markAllStudents = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = { ...studentStatus };
    filteredStudents.forEach((s) => {
      next[s._id] = status;
    });
    setStudentStatus(next);
  };

  const markAllTeachers = (status: AttendanceStatus) => {
    const nextStatus: Record<string, AttendanceStatus> = { ...teacherStatus };
    const nextHours: Record<string, number> = { ...teacherHours };
    teachers.forEach((tt) => {
      nextStatus[tt._id] = status;
      nextHours[tt._id] =
        status === 'Present' || status === 'Late'
          ? nextHours[tt._id] || 4
          : 0;
    });
    setTeacherStatus(nextStatus);
    setTeacherHours(nextHours);
  };

  const handleSave = async () => {
    if (!currentBranch?._id) {
      Alert.alert(t('attendance.take.noBranchTitle'), t('attendance.take.noBranchMsg'));
      return;
    }

    const records: any[] = [];
    if (tab === 'students') {
      Object.entries(studentStatus).forEach(([id, status]) => {
        if (!status) return;
        const record: any = {
          userId: id,
          userType: 'Student',
          status,
          hours: 0,
          date,
          branchId: currentBranch._id,
        };
        if (attendanceCount > 1 && selectedSlot) {
          record.slotNumber = selectedSlot.slotNumber;
          record.slotName = selectedSlot.name;
        }
        records.push(record);
      });
    } else {
      Object.entries(teacherStatus).forEach(([id, status]) => {
        if (!status) return;
        const record: any = {
          userId: id,
          userType: 'Teacher',
          status,
          hours: teacherHours[id] || 0,
          date,
          branchId: currentBranch._id,
        };
        if (attendanceCount > 1 && selectedSlot) {
          record.slotNumber = selectedSlot.slotNumber;
          record.slotName = selectedSlot.name;
        }
        records.push(record);
      });
    }

    if (records.length === 0) {
      Alert.alert(t('attendance.take.nothingTitle'), t('attendance.take.nothingMsg'));
      return;
    }

    setSaving(true);
    try {
      const payload: any = { records, branchId: currentBranch._id };
      if (attendanceCount > 1 && selectedSlot) {
        payload.slotNumber = selectedSlot.slotNumber;
        payload.slotName = selectedSlot.name;
      }
      await apiClient.post('/attendance/bulk', payload);
      Alert.alert(
        t('attendance.take.savedTitle'),
        t('attendance.take.savedMsg', { count: records.length, date }),
      );
      if (tab === 'students') await fetchStudents();
      else await fetchTeachers();
    } catch (err: any) {
      Alert.alert(
        t('attendance.take.errorTitle'),
        err?.message || t('attendance.take.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.slate} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('attendance.take.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {date}
            {attendanceCount > 1 && selectedSlot ? ` · ${selectedSlot.name}` : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => setSettingsVisible(true)}
        >
          <Ionicons name="settings-outline" size={18} color={COLORS.slate} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="save" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>{t('attendance.take.save')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'students' && styles.tabActive]}
          onPress={() => setTab('students')}
        >
          <Ionicons
            name="people"
            size={14}
            color={tab === 'students' ? '#fff' : COLORS.slateMuted}
          />
          <Text style={[styles.tabText, tab === 'students' && styles.tabTextActive]}>
            {t('attendance.take.students')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'teachers' && styles.tabActive]}
          onPress={() => setTab('teachers')}
        >
          <Ionicons
            name="person"
            size={14}
            color={tab === 'teachers' ? '#fff' : COLORS.slateMuted}
          />
          <Text style={[styles.tabText, tab === 'teachers' && styles.tabTextActive]}>
            {t('attendance.take.teachers')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controlsBlock}>
        <View style={styles.controlRow}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.slateMuted} />
          <TextInput
            style={styles.dateInput}
            value={date}
            onChangeText={setDate}
            placeholder={t('attendance.view.datePlaceholder')}
            placeholderTextColor="#A0AAA5"
          />
        </View>

        {tab === 'students' && halaqat.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 44 }}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {halaqat.map((h) => (
              <TouchableOpacity
                key={h._id}
                style={[
                  styles.halaqahChip,
                  selectedHalaqah === h._id && styles.halaqahChipActive,
                ]}
                onPress={() => setSelectedHalaqah(h._id)}
              >
                <Text
                  style={[
                    styles.halaqahChipText,
                    selectedHalaqah === h._id && styles.halaqahChipTextActive,
                  ]}
                >
                  {h.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {attendanceCount > 1 && slots.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 44 }}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {slots.map((slot) => (
              <TouchableOpacity
                key={slot.slotNumber}
                style={[
                  styles.halaqahChip,
                  selectedSlot?.slotNumber === slot.slotNumber && {
                    backgroundColor: COLORS.blue,
                    borderColor: COLORS.blue,
                  },
                ]}
                onPress={() => setSelectedSlot(slot)}
              >
                <Text
                  style={[
                    styles.halaqahChipText,
                    selectedSlot?.slotNumber === slot.slotNumber && {
                      color: '#fff',
                    },
                  ]}
                >
                  {slot.name} ({slot.startTime}-{slot.endTime})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {tab === 'students' && (
        <View style={styles.searchContainer}>
          <View style={styles.searchWrapper}>
            <Ionicons name="search-outline" size={18} color={COLORS.gray} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('attendance.take.searchStudents')}
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
      )}

      <View style={styles.markAllRow}>
        <Text style={styles.markAllLabel}>{t('attendance.take.markAll')}</Text>
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.markAllChip, { backgroundColor: statusColor(s) }]}
            onPress={() =>
              tab === 'students' ? markAllStudents(s) : markAllTeachers(s)
            }
          >
            <Text style={styles.markAllChipText}>
              {t(`attendance.statuses.${STATUS_KEY[s]}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && students.length === 0 && teachers.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('attendance.take.loading')}</Text>
        </View>
      ) : (
        <FlatList<any>
          data={tab === 'students' ? filteredStudents : teachers}
          keyExtractor={(item) => item._id}
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
          renderItem={({ item }) => {
            const id = item._id;
            const status =
              tab === 'students' ? studentStatus[id] : teacherStatus[id];
            const isTeacher = tab === 'teachers';
            const hours = isTeacher ? teacherHours[id] ?? 0 : 0;

            return (
              <View style={styles.attendanceCard}>
                <View style={styles.attendanceRow}>
                  <View
                    style={[
                      styles.avatar,
                      isTeacher && { backgroundColor: COLORS.blueLight },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        isTeacher && { color: COLORS.blue },
                      ]}
                    >
                      {getInitials(item.name)}
                    </Text>
                  </View>
                  <View style={styles.attendanceInfo}>
                    <Text style={styles.attendanceName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.attendanceMeta} numberOfLines={1}>
                      {isTeacher
                        ? `${(item as TeacherRow).specialization || ''} · ${(item as TeacherRow).timeType || ''}`
                        : `${(item as StudentRow).regNo || ''} · ${(item as StudentRow).halaqahName || ''}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.statusRow}>
                  {STATUSES.map((s) => {
                    const active = status === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.statusChip,
                          active && {
                            backgroundColor: statusColor(s),
                            borderColor: statusColor(s),
                          },
                        ]}
                        onPress={() =>
                          tab === 'students'
                            ? setStudent(id, s)
                            : setTeacher(id, s)
                        }
                      >
                        <Text
                          style={[
                            styles.statusChipText,
                            active && { color: '#fff', fontWeight: '800' },
                          ]}
                        >
                          {t(`attendance.statuses.${STATUS_KEY[s]}`)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {isTeacher && (status === 'Present' || status === 'Late') && (
                  <View style={styles.hoursRow}>
                    <Text style={styles.hoursLabel}>
                      {t('attendance.take.hours')}
                    </Text>
                    <TextInput
                      style={styles.hoursInput}
                      value={String(hours)}
                      onChangeText={(v) =>
                        setTeacherHours((prev) => ({
                          ...prev,
                          [id]: Number(v.replace(/[^0-9.]/g, '')) || 0,
                        }))
                      }
                      keyboardType="numeric"
                    />
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-done-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>
                {tab === 'students' && !selectedHalaqah
                  ? t('attendance.take.selectHalaqah')
                  : t('attendance.take.noRecords')}
              </Text>
              <Text style={styles.emptyText}>
                {tab === 'students' && !selectedHalaqah
                  ? t('attendance.take.selectHalaqahHint')
                  : t('attendance.take.noRecordsHint')}
              </Text>
            </View>
          }
        />
      )}

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        initialCount={attendanceCount}
        initialSlots={slots}
        onSaved={async () => {
          try {
            const res: any = await apiClient.get('/attendance/settings');
            setAttendanceCount(res?.attendanceCount || 1);
            setSlots(res?.slots || []);
            setSelectedSlot((res?.slots && res.slots[0]) || null);
          } catch {}
          setSettingsVisible(false);
        }}
      />
    </SafeAreaView>
  );
};

// ============================================================
// SETTINGS MODAL
// ============================================================
const SettingsModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  initialCount: number;
  initialSlots: AttendanceSlot[];
  onSaved: () => void;
}> = ({ visible, onClose, initialCount, initialSlots, onSaved }) => {
  const { t } = useTranslation();
  const { currentBranch } = useBranch();
  const [count, setCount] = useState(initialCount);
  const [slots, setSlots] = useState<AttendanceSlot[]>(initialSlots);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setCount(initialCount);
      setSlots(initialSlots);
    }
  }, [visible, initialCount, initialSlots]);

  const updateCount = (n: number) => {
    setCount(n);
    const next: AttendanceSlot[] = [...slots];
    if (next.length > n) next.length = n;
    while (next.length < n) {
      const i = next.length + 1;
      next.push({
        slotNumber: i,
        name: `${t('attendance.settings.session', { n: i })}`,
        startTime: '09:00',
        endTime: '12:00',
      });
    }
    setSlots(next);
  };

  const updateSlot = (
    idx: number,
    field: keyof AttendanceSlot,
    value: string | number
  ) => {
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value } as AttendanceSlot;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/attendance/settings', {
        attendanceCount: count,
        slots,
        branchId: currentBranch?._id,
      });
      onSaved();
    } catch (err: any) {
      Alert.alert(
        t('attendance.take.errorTitle'),
        err?.message || t('attendance.settings.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => !saving && onClose()}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('attendance.settings.title')}</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={onClose}
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
            <Text style={styles.formLabel}>
              {t('attendance.settings.sessionsPerDay')}
            </Text>
            <View style={styles.chipRow}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.chip, count === n && styles.chipActive]}
                  onPress={() => updateCount(n)}
                >
                  <Text
                    style={[styles.chipText, count === n && styles.chipTextActive]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {slots.map((slot, idx) => (
              <View key={idx} style={styles.slotCard}>
                <View style={styles.slotHeader}>
                  <View style={styles.slotNumber}>
                    <Text style={styles.slotNumberText}>{slot.slotNumber}</Text>
                  </View>
                  <Text style={styles.slotTitle}>
                    {t('attendance.settings.session', { n: slot.slotNumber })}
                  </Text>
                </View>

                <Text style={styles.formLabel}>{t('attendance.settings.name')}</Text>
                <TextInput
                  style={styles.formInput}
                  value={slot.name}
                  onChangeText={(v) => updateSlot(idx, 'name', v)}
                  placeholder={t('attendance.settings.namePlaceholder')}
                  placeholderTextColor="#A0AAA5"
                />

                <View style={styles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>
                      {t('attendance.settings.start')}
                    </Text>
                    <TextInput
                      style={styles.formInput}
                      value={slot.startTime}
                      onChangeText={(v) => updateSlot(idx, 'startTime', v)}
                      placeholder={t('attendance.settings.startPlaceholder')}
                      placeholderTextColor="#A0AAA5"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>
                      {t('attendance.settings.end')}
                    </Text>
                    <TextInput
                      style={styles.formInput}
                      value={slot.endTime}
                      onChangeText={(v) => updateSlot(idx, 'endTime', v)}
                      placeholder={t('attendance.settings.endPlaceholder')}
                      placeholderTextColor="#A0AAA5"
                    />
                  </View>
                </View>
              </View>
            ))}

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.modalActionsFooter}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>
                {t('attendance.settings.cancel')}
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
                    {t('attendance.settings.save')}
                  </Text>
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
// VIEW ATTENDANCE
// ============================================================
const ViewAttendance: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'daily' | 'monthly' | 'top'>('daily');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.slate} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('attendance.view.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {tab === 'daily'
              ? t('attendance.view.subtitleDaily')
              : tab === 'monthly'
              ? t('attendance.view.subtitleMonthly')
              : t('attendance.view.subtitleTop')}
          </Text>
        </View>
      </View>

      <View style={styles.tabsRow}>
        {(['daily', 'monthly', 'top'] as const).map((tp) => (
          <TouchableOpacity
            key={tp}
            style={[styles.tab, tab === tp && styles.tabActive]}
            onPress={() => setTab(tp)}
          >
            <Text style={[styles.tabText, tab === tp && styles.tabTextActive]}>
              {tp === 'daily'
                ? t('attendance.view.daily')
                : tp === 'monthly'
                ? t('attendance.view.monthly')
                : t('attendance.view.top')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'daily' && <DailyReport />}
      {tab === 'monthly' && <MonthlyReport />}
      {tab === 'top' && <TopPerformers />}
    </SafeAreaView>
  );
};

// ============================================================
// DAILY REPORT
// ============================================================
const DailyReport: React.FC = () => {
  const { t } = useTranslation();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<DailyHalaqah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res: any = await apiClient.get('/attendance/daily', { date });
      const list: DailyHalaqah[] = Array.isArray(res) ? res : res?.data || [];
      setData(list);
    } catch (err: any) {
      setError(err?.message || t('attendance.daily.loadFailed'));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [date, t]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const total = { students: 0, present: 0, absent: 0, late: 0, excused: 0 };
    data.forEach((h) => {
      total.students += h.totalStudents || 0;
      total.present += h.present || 0;
      total.absent += h.absent || 0;
      total.late += h.late || 0;
      total.excused += h.excused || 0;
    });
    const rate = total.students > 0 ? Math.round((total.present / total.students) * 100) : 0;
    return { ...total, rate };
  }, [data]);

  return (
    <ScrollView
      contentContainerStyle={styles.viewContent}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.primary} />
      }
    >
      <View style={styles.controlRow}>
        <Ionicons name="calendar-outline" size={16} color={COLORS.slateMuted} />
        <TextInput
          style={styles.dateInput}
          value={date}
          onChangeText={setDate}
          placeholder={t('attendance.view.datePlaceholder')}
          placeholderTextColor="#A0AAA5"
        />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.reportCard}>
        <Text style={styles.reportTitle}>{date}</Text>
        <View style={styles.reportGrid}>
          <View style={[styles.reportStat, { backgroundColor: COLORS.primaryLight }]}>
            <Text style={[styles.reportStatValue, { color: COLORS.primary }]}>
              {totals.present}
            </Text>
            <Text style={styles.reportStatLabel}>
              {t('attendance.daily.present')}
            </Text>
          </View>
          <View style={[styles.reportStat, { backgroundColor: COLORS.amberLight }]}>
            <Text style={[styles.reportStatValue, { color: COLORS.amber }]}>
              {totals.late}
            </Text>
            <Text style={styles.reportStatLabel}>{t('attendance.daily.late')}</Text>
          </View>
          <View style={[styles.reportStat, { backgroundColor: COLORS.redLight }]}>
            <Text style={[styles.reportStatValue, { color: COLORS.red }]}>
              {totals.absent}
            </Text>
            <Text style={styles.reportStatLabel}>{t('attendance.daily.absent')}</Text>
          </View>
          <View style={[styles.reportStat, { backgroundColor: COLORS.blueLight }]}>
            <Text style={[styles.reportStatValue, { color: COLORS.blue }]}>
              {totals.excused}
            </Text>
            <Text style={styles.reportStatLabel}>
              {t('attendance.daily.excused')}
            </Text>
          </View>
        </View>
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>{t('attendance.daily.rate')}</Text>
          <Text style={styles.rateValue}>{totals.rate}%</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
      ) : data.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="stats-chart-outline" size={56} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>{t('attendance.daily.noDataTitle')}</Text>
          <Text style={styles.emptyText}>
            {t('attendance.daily.noDataMsg', { date })}
          </Text>
        </View>
      ) : (
        data.map((h) => (
          <View key={h.id} style={styles.reportCard}>
            <View style={styles.reportTitleRow}>
              <Ionicons name="book-outline" size={16} color={COLORS.primary} />
              <Text style={[styles.reportTitle, { marginBottom: 0, marginLeft: 6 }]}>
                {h.name}
              </Text>
            </View>
            {h.teacher ? (
              <Text style={styles.reportTeacher}>
                {t('attendance.daily.teacher', { name: h.teacher })}
              </Text>
            ) : null}
            <View style={styles.reportGridSmall}>
              <View style={styles.miniStat}>
                <Text style={styles.miniStatValue}>{h.totalStudents || 0}</Text>
                <Text style={styles.miniStatLabel}>
                  {t('attendance.daily.students')}
                </Text>
              </View>
              <View style={styles.miniStat}>
                <Text style={[styles.miniStatValue, { color: COLORS.primary }]}>
                  {h.present || 0}
                </Text>
                <Text style={styles.miniStatLabel}>
                  {t('attendance.daily.present')}
                </Text>
              </View>
              <View style={styles.miniStat}>
                <Text style={[styles.miniStatValue, { color: COLORS.amber }]}>
                  {h.late || 0}
                </Text>
                <Text style={styles.miniStatLabel}>{t('attendance.daily.late')}</Text>
              </View>
              <View style={styles.miniStat}>
                <Text style={[styles.miniStatValue, { color: COLORS.red }]}>
                  {h.absent || 0}
                </Text>
                <Text style={styles.miniStatLabel}>
                  {t('attendance.daily.absent')}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

// ============================================================
// MONTHLY REPORT
// ============================================================
const MonthlyReport: React.FC = () => {
  const { t } = useTranslation();
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [data, setData] = useState<{
    weeklyData: any[];
    halaqahPerformance: any[];
  }>({ weeklyData: [], halaqahPerformance: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res: any = await apiClient.get('/attendance/monthly', { month });
      setData({
        weeklyData: res?.weeklyData || [],
        halaqahPerformance: res?.halaqahPerformance || [],
      });
    } catch (err: any) {
      setError(err?.message || t('attendance.monthly.loadFailed'));
      setData({ weeklyData: [], halaqahPerformance: [] });
    } finally {
      setLoading(false);
    }
  }, [month, t]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    let present = 0, total = 0;
    data.weeklyData.forEach((w) => {
      (w.days || []).forEach((d: any) => {
        present += d.present || 0;
        total += d.total || 0;
      });
    });
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, total, rate };
  }, [data]);

  return (
    <ScrollView
      contentContainerStyle={styles.viewContent}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.primary} />
      }
    >
      <View style={styles.controlRow}>
        <Ionicons name="calendar-outline" size={16} color={COLORS.slateMuted} />
        <TextInput
          style={styles.dateInput}
          value={month}
          onChangeText={setMonth}
          placeholder={t('attendance.view.monthPlaceholder')}
          placeholderTextColor="#A0AAA5"
        />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.reportCard}>
        <Text style={styles.reportTitle}>{getMonthLabel(month)}</Text>
        <View style={styles.reportGrid}>
          <View style={[styles.reportStat, { backgroundColor: COLORS.primaryLight }]}>
            <Text style={[styles.reportStatValue, { color: COLORS.primary }]}>
              {totals.present}
            </Text>
            <Text style={styles.reportStatLabel}>
              {t('attendance.monthly.totalPresent')}
            </Text>
          </View>
          <View style={[styles.reportStat, { backgroundColor: COLORS.blueLight }]}>
            <Text style={[styles.reportStatValue, { color: COLORS.blue }]}>
              {totals.rate}%
            </Text>
            <Text style={styles.reportStatLabel}>
              {t('attendance.monthly.rate')}
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
      ) : data.weeklyData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="stats-chart-outline" size={56} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>{t('attendance.monthly.noDataTitle')}</Text>
          <Text style={styles.emptyText}>
            {t('attendance.monthly.noDataMsg', { month: getMonthLabel(month) })}
          </Text>
        </View>
      ) : (
        data.weeklyData.map((w, i) => (
          <View key={i} style={styles.reportCard}>
            <Text style={styles.reportTitle}>
              {t('attendance.monthly.week', { n: i + 1 })}
            </Text>
            {(w.days || []).map((d: any, j: number) => (
              <View key={j} style={styles.dayRow}>
                <Text style={styles.dayLabel}>
                  {d.date || t('attendance.monthly.day', { n: j + 1 })}
                </Text>
                <Text style={styles.dayValue}>
                  {d.present || 0}/{d.total || 0}
                </Text>
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
};

// ============================================================
// TOP PERFORMERS
// ============================================================
const TopPerformers: React.FC = () => {
  const { t } = useTranslation();
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [topStudents, setTopStudents] = useState<TopStudent[]>([]);
  const [bottomStudents, setBottomStudents] = useState<TopStudent[]>([]);
  const [topHalaqah, setTopHalaqah] = useState<TopHalaqah | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [top, halaqah] = await Promise.all([
        apiClient.get('/attendance/top-students', { month }),
        apiClient.get('/attendance/top-halaqah', { month }),
      ]);
      const tt: any = top;
      const hh: any = halaqah;
      setTopStudents(tt?.top || []);
      setBottomStudents(tt?.bottom || []);
      setTopHalaqah(hh || null);
    } catch (err: any) {
      setError(err?.message || t('attendance.top.loadFailed'));
      setTopStudents([]);
      setBottomStudents([]);
      setTopHalaqah(null);
    } finally {
      setLoading(false);
    }
  }, [month, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView
      contentContainerStyle={styles.viewContent}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.primary} />
      }
    >
      <View style={styles.controlRow}>
        <Ionicons name="calendar-outline" size={16} color={COLORS.slateMuted} />
        <TextInput
          style={styles.dateInput}
          value={month}
          onChangeText={setMonth}
          placeholder={t('attendance.view.monthPlaceholder')}
          placeholderTextColor="#A0AAA5"
        />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
      ) : (
        <>
          <View style={styles.reportCard}>
            <View style={styles.reportTitleRow}>
              <Ionicons name="trophy-outline" size={18} color={COLORS.gold} />
              <Text style={[styles.reportTitle, { marginBottom: 0, marginLeft: 6 }]}>
                {t('attendance.top.topStudents')}
              </Text>
            </View>
            {topStudents.length === 0 ? (
              <Text style={styles.emptyText}>{t('attendance.top.noData')}</Text>
            ) : (
              topStudents.slice(0, 10).map((s, i) => (
                <View key={i} style={styles.topRow}>
                  <View
                    style={[
                      styles.topRank,
                      i === 0 && { backgroundColor: COLORS.gold },
                      i === 1 && { backgroundColor: COLORS.gray },
                      i === 2 && { backgroundColor: '#B45309' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.topRankText,
                        i < 3 && { color: '#fff' },
                      ]}
                    >
                      {s.rank || i + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.topName}>{s.name}</Text>
                    <Text style={styles.topHalaqah}>{s.halaqah || '-'}</Text>
                  </View>
                  <Text style={styles.topRate}>{s.attendance || 0}%</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.reportCard}>
            <View style={styles.reportTitleRow}>
              <Ionicons name="alert-circle-outline" size={18} color={COLORS.red} />
              <Text style={[styles.reportTitle, { marginBottom: 0, marginLeft: 6 }]}>
                {t('attendance.top.needsAttention')}
              </Text>
            </View>
            {bottomStudents.length === 0 ? (
              <Text style={styles.emptyText}>{t('attendance.top.noData')}</Text>
            ) : (
              bottomStudents.slice(0, 10).map((s, i) => (
                <View key={i} style={styles.topRow}>
                  <View
                    style={[styles.topRank, { backgroundColor: COLORS.redLight }]}
                  >
                    <Text style={[styles.topRankText, { color: COLORS.red }]}>
                      {s.rank || i + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.topName}>{s.name}</Text>
                    <Text style={styles.topHalaqah}>{s.halaqah || '-'}</Text>
                  </View>
                  <Text style={[styles.topRate, { color: COLORS.red }]}>
                    {s.attendance || 0}%
                  </Text>
                </View>
              ))
            )}
          </View>

          {topHalaqah && (
            <View style={styles.reportCard}>
              <View style={styles.reportTitleRow}>
                <Ionicons name="star" size={18} color={COLORS.blue} />
                <Text
                  style={[styles.reportTitle, { marginBottom: 0, marginLeft: 6 }]}
                >
                  {t('attendance.top.topHalaqah')}
                </Text>
              </View>
              <Text style={styles.topName}>{topHalaqah.name}</Text>
              <Text style={styles.topHalaqah}>
                {t('attendance.top.studentsCount', {
                  count: topHalaqah.totalStudents || 0,
                })}
              </Text>
              <View style={styles.reportGridSmall}>
                <View style={styles.miniStat}>
                  <Text style={[styles.miniStatValue, { color: COLORS.primary }]}>
                    {topHalaqah.present || 0}
                  </Text>
                  <Text style={styles.miniStatLabel}>
                    {t('attendance.daily.present')}
                  </Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={[styles.miniStatValue, { color: COLORS.amber }]}>
                    {topHalaqah.late || 0}
                  </Text>
                  <Text style={styles.miniStatLabel}>
                    {t('attendance.daily.late')}
                  </Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={[styles.miniStatValue, { color: COLORS.blue }]}>
                    {topHalaqah.excused || 0}
                  </Text>
                  <Text style={styles.miniStatLabel}>
                    {t('attendance.daily.excused')}
                  </Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={[styles.miniStatValue, { color: COLORS.red }]}>
                    {topHalaqah.absent || 0}
                  </Text>
                  <Text style={styles.miniStatLabel}>
                    {t('attendance.daily.absent')}
                  </Text>
                </View>
              </View>
              <View style={styles.rateRow}>
                <Text style={styles.rateLabel}>{t('attendance.daily.rate')}</Text>
                <Text style={styles.rateValue}>
                  {topHalaqah.attendance || 0}%
                </Text>
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

export default AttendanceManagementScreen;

// ============================================================
// STYLES (unchanged)
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
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.slate },
  headerSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },

  settingsBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, gap: 6,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  menuContainer: { padding: 16, gap: 12 },
  menuCard: {
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: COLORS.border,
  },
  menuIcon: {
    width: 60, height: 60, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  menuTitle: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  menuText: {
    fontSize: 13, color: COLORS.slateMuted,
    marginTop: 4, lineHeight: 20,
  },
  menuArrow: { position: 'absolute', right: 20, top: 20 },

  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8, marginBottom: 8,
  },
  tab: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.border, gap: 6,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.slateMuted },
  tabTextActive: { color: '#fff' },

  controlsBlock: { paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  controlRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, height: 44, gap: 8,
  },
  dateInput: { flex: 1, fontSize: 14, color: COLORS.slate, paddingVertical: 0 },
  halaqahChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.border,
  },
  halaqahChipActive: {
    backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary,
  },
  halaqahChipText: { fontSize: 12, fontWeight: '700', color: COLORS.slateMuted },
  halaqahChipTextActive: { color: COLORS.primary },

  searchContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 12,
    paddingHorizontal: 12, borderWidth: 1,
    borderColor: COLORS.border, height: 44, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.slate },

  markAllRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    gap: 6, flexWrap: 'wrap',
  },
  markAllLabel: {
    fontSize: 12, fontWeight: '700',
    color: COLORS.slateMuted, marginRight: 4,
  },
  markAllChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  markAllChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },

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
  attendanceCard: {
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  attendanceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  attendanceInfo: { flex: 1 },
  attendanceName: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  attendanceMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  statusRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statusChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, backgroundColor: '#F1F5F9',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  statusChipText: { fontSize: 11, fontWeight: '700', color: COLORS.slateMuted },
  hoursRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  hoursLabel: { fontSize: 12, color: COLORS.slateMuted, fontWeight: '700' },
  hoursInput: {
    backgroundColor: COLORS.background, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 10, paddingVertical: 6,
    width: 60, fontSize: 13, color: COLORS.slate, textAlign: 'center',
  },

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

  viewContent: { padding: 16, gap: 12 },
  reportCard: {
    backgroundColor: COLORS.white, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 12,
  },
  reportTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reportTitle: {
    fontSize: 15, fontWeight: '800',
    color: COLORS.slate, marginBottom: 12,
  },
  reportTeacher: {
    fontSize: 12, color: COLORS.slateMuted,
    fontWeight: '600', marginBottom: 8,
  },
  reportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reportGridSmall: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 8, marginTop: 12,
  },
  reportStat: {
    flex: 1, minWidth: '44%',
    padding: 14, borderRadius: 12, alignItems: 'center',
  },
  reportStatValue: { fontSize: 22, fontWeight: '800' },
  reportStatLabel: {
    fontSize: 11, color: COLORS.slate,
    fontWeight: '700', marginTop: 4,
  },
  miniStat: {
    flex: 1, minWidth: '22%', alignItems: 'center',
    padding: 8,
  },
  miniStatValue: { fontSize: 16, fontWeight: '800', color: COLORS.slate },
  miniStatLabel: {
    fontSize: 10, color: COLORS.slateMuted,
    fontWeight: '700', marginTop: 2,
  },
  rateRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  rateLabel: { fontSize: 13, color: COLORS.slateMuted, fontWeight: '600' },
  rateValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },

  dayRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  dayLabel: { fontSize: 12, color: COLORS.slate, fontWeight: '600' },
  dayValue: { fontSize: 12, color: COLORS.slateMuted, fontWeight: '700' },

  topRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9', gap: 12,
  },
  topRank: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.goldLight,
    alignItems: 'center', justifyContent: 'center',
  },
  topRankText: { fontSize: 13, fontWeight: '800', color: COLORS.gold },
  topName: { fontSize: 13, fontWeight: '700', color: COLORS.slate },
  topHalaqah: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  topRate: { fontSize: 14, fontWeight: '800', color: COLORS.primary },

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
    padding: 20, borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  modalCloseBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { paddingHorizontal: 20, paddingTop: 12 },

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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: COLORS.slateMuted },
  chipTextActive: { color: '#fff' },

  slotCard: {
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 14, marginTop: 14,
    backgroundColor: COLORS.background,
  },
  slotHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 8,
  },
  slotNumber: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  slotNumberText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  slotTitle: { fontSize: 14, fontWeight: '800', color: COLORS.slate },
  twoCol: { flexDirection: 'row', gap: 10, marginTop: 4 },

  modalActionsFooter: {
    flexDirection: 'row', gap: 10, padding: 20,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.background, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  submitBtn: {
    flex: 2, flexDirection: 'row', gap: 6,
    paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});