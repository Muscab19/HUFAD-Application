import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api as apiClient } from '../../api/client';
import { useBranch } from '../../context/BranchContext';
import { enqueue } from '../../utils/offlineDb';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

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

interface HalaqahStudentSessionRow {
  id: string;
  name: string;
  regNo?: string;
  profilePicture?: string;
  sessions: string[];
  parentContact?: string;
  guardianPhone?: string;
  remarks?: string;
}

interface DailyHalaqah {
  id: string;
  name: string;
  teacher?: string;
  time?: string;
  totalStudents?: number;
  present?: number;
  absent?: number;
  late?: number;
  excused?: number;
  students?: HalaqahStudentSessionRow[];
}

interface MonthlyStudentRow {
  id: string;
  name: string;
  regNo?: string;
  profilePicture?: string;
  totalSessions: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalExcused: number;
  totalExpectedSessions: number;
  weightedPct: number;
  hasAnyAttendance: boolean;
  dailyRecords: {
    date: string;
    day: string;
    statuses: string[];
    hasAttendance: boolean;
    comments: Record<number, string>;
  }[];
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

// ============================================================
// WEIGHTS
// ============================================================
const STATUS_WEIGHT: Record<string, number> = {
  Present: 1.0,
  Late: 0.7,
  Excused: 0.3,
  Absent: 0.0,
  'Not Recorded': 0.0,
};

const computeWeightedPct = (
  counts: { present: number; late: number; excused: number; absent: number },
  totalExpectedSessions: number,
): number => {
  if (!totalExpectedSessions || totalExpectedSessions <= 0) return 0;
  const weighted =
    counts.present * STATUS_WEIGHT.Present +
    counts.late * STATUS_WEIGHT.Late +
    counts.excused * STATUS_WEIGHT.Excused +
    counts.absent * STATUS_WEIGHT.Absent;
  return Math.round((weighted / totalExpectedSessions) * 1000) / 10;
};

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

const getDaysInMonth = (month: string): number => {
  const [y, mo] = month.split('-').map(Number);
  return new Date(y, mo, 0).getDate();
};

const formatDayShort = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
};

const getStatusPillStyle = (status: string) => {
  switch (status) {
    case 'Present':
      return { bg: COLORS.primaryLight, text: COLORS.primary };
    case 'Late':
      return { bg: COLORS.amberLight, text: COLORS.amber };
    case 'Absent':
      return { bg: COLORS.redLight, text: COLORS.red };
    case 'Excused':
      return { bg: COLORS.blueLight, text: COLORS.blue };
    case 'Not Recorded':
      return { bg: '#F8FAFC', text: '#CBD5E1' };
    default:
      return { bg: '#F1F5F9', text: '#94A3B8' };
  }
};

// ============================================================
// TOAST PROVIDER
// ============================================================
type ToastVariant = 'success' | 'error' | 'info' | 'warning';
interface ToastState {
  visible: boolean;
  variant: ToastVariant;
  title: string;
  message?: string;
}

const TOAST_VARIANTS: Record<
  ToastVariant,
  { bg: string; border: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string }
> = {
  success: {
    bg: '#ECFDF5',
    border: '#A7F3D0',
    icon: 'checkmark-circle',
    iconColor: '#059669',
  },
  error: {
    bg: '#FEF2F2',
    border: '#FECACA',
    icon: 'alert-circle',
    iconColor: '#DC2626',
  },
  info: {
    bg: '#EFF6FF',
    border: '#BFDBFE',
    icon: 'information-circle',
    iconColor: '#2563EB',
  },
  warning: {
    bg: '#FFFBEB',
    border: '#FDE68A',
    icon: 'warning',
    iconColor: '#D97706',
  },
};

interface ToastContextValue {
  show: (variant: ToastVariant, title: string, message?: string) => void;
}

const ToastContext = React.createContext<ToastContextValue>({
  show: () => {},
});

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    variant: 'info',
    title: '',
  });
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-30)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (variant: ToastVariant, title: string, message?: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setToast({ visible: true, variant, title, message });
      opacity.setValue(0);
      translateY.setValue(-30);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();

      timeoutRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -30,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setToast((t) => ({ ...t, visible: false }));
        });
      }, 3000);
    },
    [opacity, translateY],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast.visible && (
        <Animated.View
          pointerEvents="none"
          style={[
            toastStyles.toast,
            {
              backgroundColor: TOAST_VARIANTS[toast.variant].bg,
              borderColor: TOAST_VARIANTS[toast.variant].border,
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <Ionicons
            name={TOAST_VARIANTS[toast.variant].icon}
            size={22}
            color={TOAST_VARIANTS[toast.variant].iconColor}
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={toastStyles.title} numberOfLines={1}>
              {toast.title}
            </Text>
            {toast.message ? (
              <Text style={toastStyles.message} numberOfLines={2}>
                {toast.message}
              </Text>
            ) : null}
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const useToast = () => React.useContext(ToastContext);

// ============================================================
// ROOT
// ============================================================
export const AttendanceManagementScreen: React.FC = () => {
  return (
    <ToastProvider>
      <AttendanceRoot />
    </ToastProvider>
  );
};

const AttendanceRoot: React.FC = () => {
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
  const toast = useToast();
  const { isOnline } = useNetworkStatus();
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
  const [studentComments, setStudentComments] = useState<Record<string, string>>({});
  const [editingComment, setEditingComment] = useState<{
    studentId: string;
    studentName: string;
    comment: string;
  } | null>(null);

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
      const nextComments: Record<string, string> = {};
      list.forEach((s) => {
        const id = s._id;
        const existing = (s as any).attendanceStatus as AttendanceStatus | undefined;
        next[id] = existing || '';
        nextComments[id] = (s as any).attendanceComments || '';
      });
      setStudentStatus(next);
      setStudentComments(nextComments);
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
    if (status === 'Present') {
      setStudentComments((prev) => ({ ...prev, [id]: '' }));
    }
  };

  const setTeacher = (id: string, status: AttendanceStatus) => {
    setTeacherStatus((prev) => ({ ...prev, [id]: status }));
    setTeacherHours((prev) => ({
      ...prev,
      [id]: status === 'Present' || status === 'Late' ? prev[id] || 4 : 0,
    }));
  };

  const markAllStudents = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = { ...studentStatus };
    filteredStudents.forEach((s) => {
      next[s._id] = status;
    });
    setStudentStatus(next);
    if (status === 'Present') {
      const nc = { ...studentComments };
      filteredStudents.forEach((s) => {
        nc[s._id] = '';
      });
      setStudentComments(nc);
    }
  };

  const markAllTeachers = (status: AttendanceStatus) => {
    const nextStatus: Record<string, AttendanceStatus> = { ...teacherStatus };
    const nextHours: Record<string, number> = { ...teacherHours };
    teachers.forEach((tt) => {
      nextStatus[tt._id] = status;
      nextHours[tt._id] =
        status === 'Present' || status === 'Late' ? nextHours[tt._id] || 4 : 0;
    });
    setTeacherStatus(nextStatus);
    setTeacherHours(nextHours);
  };

  const handleSave = async () => {
    if (!currentBranch?._id) {
      toast.show('warning', t('attendance.take.noBranchTitle'), t('attendance.take.noBranchMsg'));
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
        const comment = studentComments[id];
        if (comment && ['Late', 'Excused', 'Absent'].includes(status)) {
          record.comments = comment;
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
      toast.show('info', t('attendance.take.nothingTitle'), t('attendance.take.nothingMsg'));
      return;
    }

    setSaving(true);

    const payload: any = { records, branchId: currentBranch._id };
    if (attendanceCount > 1 && selectedSlot) {
      payload.slotNumber = selectedSlot.slotNumber;
      payload.slotName = selectedSlot.name;
    }

    // -------- OFFLINE PATH --------
    if (!isOnline) {
      try {
        await enqueue('attendance', currentBranch._id, payload);
        toast.show(
          'info',
          t('attendance.take.savedTitle'),
          'Saved offline — will sync automatically',
        );
        if (tab === 'students') await fetchStudents();
        else await fetchTeachers();
      } catch (e: any) {
        toast.show(
          'error',
          t('attendance.take.errorTitle'),
          e?.message || t('attendance.take.saveFailed'),
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    // -------- ONLINE PATH --------
    try {
      await apiClient.post('/attendance/bulk', payload);
      toast.show(
        'success',
        t('attendance.take.savedTitle'),
        t('attendance.take.savedMsg', { count: records.length, date }),
      );
      if (tab === 'students') await fetchStudents();
      else await fetchTeachers();
    } catch (err: any) {
      // Weak signal / timeout / server error → queue silently
      try {
        await enqueue('attendance', currentBranch._id, payload);
        toast.show(
          'info',
          t('attendance.take.savedTitle'),
          'Saved offline — will sync automatically',
        );
        if (tab === 'students') await fetchStudents();
        else await fetchTeachers();
      } catch (e: any) {
        toast.show(
          'error',
          t('attendance.take.errorTitle'),
          err?.message || t('attendance.take.saveFailed'),
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const exportToCSV = async () => {
    try {
      let lines: string[] = [];
      if (tab === 'students') {
        lines.push('Name,Reg No,Halaqah,Time Type,Status,Date,Comment');
        filteredStudents.forEach((s) => {
          const status = studentStatus[s._id] || 'Not Recorded';
          const comment = studentComments[s._id] || '';
          lines.push(
            `${s.name || ''},${s.regNo || ''},${s.halaqahName || ''},${s.timeType || ''},${status},${date},${comment}`,
          );
        });
      } else {
        lines.push('Name,Username,Specialization,Time Type,Status,Hours,Date');
        teachers.forEach((tt) => {
          const status = teacherStatus[tt._id] || 'Not Recorded';
          const hours = teacherHours[tt._id] || 0;
          lines.push(
            `${tt.name || ''},${tt.username || ''},${tt.specialization || ''},${tt.timeType || ''},${status},${hours},${date}`,
          );
        });
      }
      const csv = lines.join('\n');
      await Share.share({ message: csv, title: `attendance_${date}` });
      toast.show('success', t('attendance.take.savedTitle'), t('attendance.exportCSV'));
    } catch (err) {
      console.error('Export CSV error:', err);
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
          onPress={exportToCSV}
          accessibilityLabel={t('attendance.exportCSV')}
          accessibilityRole="button"
        >
          <Ionicons name="download-outline" size={18} color={COLORS.slate} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => setSettingsVisible(true)}
          accessibilityLabel={t('attendance.sessionSettings')}
          accessibilityRole="button"
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
            const hasComment = (studentComments[id] || '').trim() !== '';
            const showCommentBtn =
              !isTeacher && ['Late', 'Absent', 'Excused'].includes(status as string);

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
                  {showCommentBtn && (
                    <TouchableOpacity
                      onPress={() =>
                        setEditingComment({
                          studentId: id,
                          studentName: item.name,
                          comment: studentComments[id] || '',
                        })
                      }
                      style={[
                        styles.commentBtn,
                        hasComment && styles.commentBtnActive,
                      ]}
                    >
                      <Ionicons
                        name={hasComment ? 'chatbubble' : 'chatbubble-outline'}
                        size={16}
                        color={hasComment ? COLORS.primary : COLORS.slateMuted}
                      />
                    </TouchableOpacity>
                  )}
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

                {hasComment && (
                  <View style={styles.commentPreview}>
                    <Ionicons
                      name="chatbubble-outline"
                      size={12}
                      color={COLORS.slateMuted}
                    />
                    <Text style={styles.commentPreviewText} numberOfLines={2}>
                      {studentComments[id]}
                    </Text>
                  </View>
                )}

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

      {editingComment && (
        <CommentBoxModal
          studentName={editingComment.studentName}
          initialComment={editingComment.comment}
          onClose={() => setEditingComment(null)}
          onSave={(text) => {
            setStudentComments((prev) => ({
              ...prev,
              [editingComment.studentId]: text,
            }));
            setEditingComment(null);
          }}
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
// COMMENT BOX MODAL
// ============================================================
const CommentBoxModal: React.FC<{
  studentName: string;
  initialComment: string;
  onSave: (text: string) => void;
  onClose: () => void;
}> = ({ studentName, initialComment, onSave, onClose }) => {
  const { t } = useTranslation();
  const [text, setText] = useState(initialComment || '');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {t('attendance.comment')} · {studentName}
            </Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20 }}>
            <TextInput
              style={[styles.formInput, { height: 120, textAlignVertical: 'top' }]}
              multiline
              value={text}
              onChangeText={setText}
              placeholder={t('attendance.commentPlaceholder')}
              placeholderTextColor="#A0AAA5"
            />
            <View style={styles.modalActionsFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>{t('attendance.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={() => onSave(text)}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>{t('attendance.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  const toast = useToast();
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
      toast.show('success', t('attendance.settings.saveSuccess'));
      onSaved();
    } catch (err: any) {
      toast.show(
        'error',
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
  const [slots, setSlots] = useState<AttendanceSlot[]>([]);
  const [attendanceCount, setAttendanceCount] = useState(1);
  const [selectedHalaqah, setSelectedHalaqah] = useState<string>('');
  const [halaqat, setHalaqat] = useState<Halaqah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedHalaqahDetail, setSelectedHalaqahDetail] =
    useState<DailyHalaqah | null>(null);

  const loadSettingsAndHalaqat = useCallback(async () => {
    try {
      const [settingsRes, halaqatRes]: any = await Promise.all([
        apiClient.get('/attendance/settings'),
        apiClient.get('/attendance/halaqat'),
      ]);
      setAttendanceCount(settingsRes?.attendanceCount || 1);
      setSlots(settingsRes?.slots || []);
      const hList: Halaqah[] = Array.isArray(halaqatRes)
        ? halaqatRes
        : halaqatRes?.halaqaat || halaqatRes?.data || [];
      setHalaqat(hList);
    } catch (e) {
      console.warn('loadSettingsAndHalaqat error', e);
    }
  }, []);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res: any = await apiClient.get('/attendance/daily', { date });
      const raw = Array.isArray(res) ? res : res?.data || [];
      const slotCount = slots.length || 1;

      const normalized: DailyHalaqah[] = raw.map((h: any) => ({
        ...h,
        students: (h.students || []).map((s: any) => ({
          ...s,
          sessions:
            Array.isArray(s.sessions) && s.sessions.length === slotCount
              ? s.sessions
              : Array(slotCount).fill('Not Recorded'),
        })),
      }));

      setData(normalized);
    } catch (err: any) {
      setError(err?.message || t('attendance.daily.loadFailed'));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [date, slots.length, t]);

  useEffect(() => {
    loadSettingsAndHalaqat();
  }, [loadSettingsAndHalaqat]);

  useEffect(() => {
    load();
  }, [load]);

  const sessionPercent = (halaqah: DailyHalaqah, sessionIdx: number) => {
    const list = halaqah.students || [];
    if (list.length === 0) return 0;
    const present = list.filter((s) => s.sessions?.[sessionIdx] === 'Present').length;
    return Math.round((present / list.length) * 100);
  };

  const totals = useMemo(() => {
    const total = { students: 0, present: 0, absent: 0, late: 0, excused: 0 };
    data.forEach((h) => {
      total.students += h.totalStudents || 0;
      total.present += h.present || 0;
      total.absent += h.absent || 0;
      total.late += h.late || 0;
      total.excused += h.excused || 0;
    });
    const rate =
      total.students > 0 ? Math.round((total.present / total.students) * 100) : 0;
    return { ...total, rate };
  }, [data]);

  const filteredData = useMemo(() => {
    if (!selectedHalaqah || selectedHalaqah === 'all') return data;
    return data.filter((h) => h.id === selectedHalaqah);
  }, [data, selectedHalaqah]);

  const slotsToShow =
    slots.length > 0
      ? slots
      : [
          {
            slotNumber: 1,
            name: t('attendance.slots.session'),
            startTime: '',
            endTime: '',
          },
        ];

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

      {halaqat.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 44, marginTop: 8 }}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        >
          <TouchableOpacity
            style={[
              styles.halaqahChip,
              (!selectedHalaqah || selectedHalaqah === 'all') &&
                styles.halaqahChipActive,
            ]}
            onPress={() => setSelectedHalaqah('all')}
          >
            <Text
              style={[
                styles.halaqahChipText,
                (!selectedHalaqah || selectedHalaqah === 'all') &&
                  styles.halaqahChipTextActive,
              ]}
            >
              {t('attendance.allHalaqat')}
            </Text>
          </TouchableOpacity>
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
            <Text style={styles.reportStatLabel}>{t('attendance.daily.present')}</Text>
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
            <Text style={styles.reportStatLabel}>{t('attendance.daily.excused')}</Text>
          </View>
        </View>
        <View style={styles.rateRow}>
          <Text style={styles.rateLabel}>{t('attendance.daily.rate')}</Text>
          <Text style={styles.rateValue}>{totals.rate}%</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
      ) : filteredData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="stats-chart-outline" size={56} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>{t('attendance.daily.noDataTitle')}</Text>
          <Text style={styles.emptyText}>
            {t('attendance.daily.noDataMsg', { date })}
          </Text>
        </View>
      ) : (
        filteredData.map((h) => (
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

            {slotsToShow.length > 0 && (
              <View style={styles.sessionPctGrid}>
                {slotsToShow.map((slot, idx) => {
                  const pct = sessionPercent(h, idx);
                  const color =
                    pct >= 80
                      ? COLORS.primary
                      : pct >= 60
                      ? COLORS.amber
                      : COLORS.red;
                  return (
                    <View key={idx} style={styles.sessionPctCard}>
                      <Text style={styles.sessionPctLabel} numberOfLines={1}>
                        {slot.name}
                      </Text>
                      <Text style={[styles.sessionPctValue, { color }]}>{pct}%</Text>
                      {slot.startTime ? (
                        <Text style={styles.sessionPctTime}>
                          {slot.startTime}-{slot.endTime}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}

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
                <Text style={styles.miniStatLabel}>{t('attendance.daily.present')}</Text>
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
                <Text style={styles.miniStatLabel}>{t('attendance.daily.absent')}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.viewDetailsBtn}
              onPress={() => setSelectedHalaqahDetail(h)}
            >
              <Ionicons name="eye-outline" size={14} color={COLORS.blue} />
              <Text style={styles.viewDetailsBtnText}>
                {t('attendance.viewDetails')}
              </Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {selectedHalaqahDetail && (
        <SessionDetailsModal
          halaqah={selectedHalaqahDetail}
          slots={slotsToShow}
          date={date}
          onClose={() => setSelectedHalaqahDetail(null)}
        />
      )}
    </ScrollView>
  );
};

// ============================================================
// SESSION DETAILS MODAL — with functional status filter cards
// ============================================================
const SessionDetailsModal: React.FC<{
  halaqah: DailyHalaqah;
  slots: AttendanceSlot[];
  date: string;
  onClose: () => void;
}> = ({ halaqah, slots, date, onClose }) => {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<
    'Present' | 'Late' | 'Absent' | 'Excused' | null
  >(null);

  // Compute per-status student counts (a student is counted under the "worst"
  // status they have across sessions: Absent > Late > Excused > Present)
  const { present, late, absent, excused, statusByStudent } = useMemo(() => {
    const list = halaqah.students || [];
    let p = 0,
      l = 0,
      a = 0,
      e = 0;
    const map: Record<string, 'Present' | 'Late' | 'Absent' | 'Excused'> = {};
    list.forEach((s) => {
      const statuses = s.sessions || [];
      const has = (x: string) => statuses.includes(x);
      let effective: 'Present' | 'Late' | 'Absent' | 'Excused' = 'Present';
      if (has('Absent')) effective = 'Absent';
      else if (has('Late')) effective = 'Late';
      else if (has('Excused')) effective = 'Excused';
      else if (has('Present')) effective = 'Present';
      map[s.id] = effective;
      if (effective === 'Absent') a++;
      else if (effective === 'Late') l++;
      else if (effective === 'Excused') e++;
      else p++;
    });
    return { present: p, late: l, absent: a, excused: e, statusByStudent: map };
  }, [halaqah]);

  const displayedStudents = useMemo(() => {
    const list = halaqah.students || [];
    if (!activeFilter) return list;
    return list.filter((s) => statusByStudent[s.id] === activeFilter);
  }, [halaqah, activeFilter, statusByStudent]);

  const FilterCard: React.FC<{
    label: string;
    value: number;
    color: string;
    bg: string;
    filterKey: 'Present' | 'Late' | 'Absent' | 'Excused';
  }> = ({ label, value, color, bg, filterKey }) => {
    const active = activeFilter === filterKey;
    return (
      <TouchableOpacity
        onPress={() => setActiveFilter(active ? null : filterKey)}
        activeOpacity={0.7}
        style={[
          styles.detailStat,
          {
            backgroundColor: bg,
            borderWidth: active ? 2 : 1,
            borderColor: active ? color : 'transparent',
            transform: [{ scale: active ? 1.05 : 1 }],
          },
        ]}
      >
        <Text style={[styles.detailStatValue, { color }]}>{value}</Text>
        <Text style={styles.detailStatLabel}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { maxHeight: '92%' }]}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{halaqah.name}</Text>
              <Text style={styles.headerSubtitle}>
                {halaqah.teacher || '-'} · {date}
              </Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          {/* ✅ Functional filter cards — tap to filter students */}
          <View style={styles.detailStatsGrid}>
            <FilterCard
              label={t('attendance.daily.present')}
              value={present}
              color={COLORS.primary}
              bg={COLORS.primaryLight}
              filterKey="Present"
            />
            <FilterCard
              label={t('attendance.daily.late')}
              value={late}
              color={COLORS.amber}
              bg={COLORS.amberLight}
              filterKey="Late"
            />
            <FilterCard
              label={t('attendance.daily.absent')}
              value={absent}
              color={COLORS.red}
              bg={COLORS.redLight}
              filterKey="Absent"
            />
            <FilterCard
              label={t('attendance.daily.excused')}
              value={excused}
              color={COLORS.blue}
              bg={COLORS.blueLight}
              filterKey="Excused"
            />
          </View>

          {/* Active filter chip */}
          {activeFilter && (
            <View style={styles.activeFilterBar}>
              <Text style={styles.activeFilterText}>
                {t(`attendance.statuses.${STATUS_KEY[activeFilter]}`)} (
                {displayedStudents.length})
              </Text>
              <TouchableOpacity
                onPress={() => setActiveFilter(null)}
                style={styles.clearFilterBtn}
              >
                <Ionicons name="close-circle" size={16} color={COLORS.slateMuted} />
                <Text style={styles.clearFilterText}>
                  {t('attendance.clearFilter') || 'Clear'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView style={styles.modalBody} horizontal={false}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={styles.studentsHeaderRow}>
                  <Text
                    style={[
                      styles.studentsHeaderCell,
                      { width: 160, textAlign: 'left' },
                    ]}
                  >
                    {t('attendance.reports.name')}
                  </Text>
                  <Text style={[styles.studentsHeaderCell, { width: 90 }]}>
                    {t('attendance.reports.regNo')}
                  </Text>
                  {slots.map((slot, i) => (
                    <Text
                      key={i}
                      style={[styles.studentsHeaderCell, { width: 90 }]}
                      numberOfLines={1}
                    >
                      {slot.name}
                    </Text>
                  ))}
                  <Text style={[styles.studentsHeaderCell, { width: 140 }]}>
                    {t('attendance.reports.comment')}
                  </Text>
                </View>

                {displayedStudents.length === 0 ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={styles.emptyText}>
                      {activeFilter
                        ? `${t('attendance.noStudentsWithStatus') || 'No students with this status'}`
                        : t('attendance.daily.noDataMsg')}
                    </Text>
                  </View>
                ) : (
                  displayedStudents.map((s, rIdx) => (
                    <View
                      key={s.id || rIdx}
                      style={[
                        styles.studentsDataRow,
                        rIdx % 2 === 1 && { backgroundColor: '#FAFBFC' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.studentsDataCell,
                          { width: 160, textAlign: 'left' },
                        ]}
                        numberOfLines={1}
                      >
                        {s.name}
                      </Text>
                      <Text style={[styles.studentsDataCell, { width: 90 }]}>
                        {s.regNo || '-'}
                      </Text>
                      {slots.map((_, i) => {
                        const status = s.sessions?.[i] || 'Not Recorded';
                        const pill = getStatusPillStyle(status);
                        return (
                          <View
                            key={i}
                            style={[styles.statusPillWrap, { width: 90 }]}
                          >
                            <View
                              style={[styles.statusPill, { backgroundColor: pill.bg }]}
                            >
                              <Text
                                style={[styles.statusPillText, { color: pill.text }]}
                              >
                                {status === 'Not Recorded'
                                  ? t('attendance.none')
                                  : t(
                                      `attendance.statuses.${
                                        STATUS_KEY[
                                          status as Exclude<AttendanceStatus, ''>
                                        ]
                                      }`,
                                    ) || status}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                      <Text
                        style={[
                          styles.studentsDataCell,
                          { width: 140, textAlign: 'left' },
                        ]}
                        numberOfLines={2}
                      >
                        {s.remarks || '-'}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// MONTHLY REPORT (with weighted %)
// ============================================================
const MonthlyReport: React.FC = () => {
  const { t } = useTranslation();
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [halaqat, setHalaqat] = useState<Halaqah[]>([]);
  const [selectedHalaqah, setSelectedHalaqah] = useState<string>('');
  const [slots, setSlots] = useState<AttendanceSlot[]>([]);
  const [attendanceCount, setAttendanceCount] = useState(1);
  const [students, setStudents] = useState<MonthlyStudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedStudentDetails, setSelectedStudentDetails] =
    useState<MonthlyStudentRow | null>(null);

  const loadSetup = useCallback(async () => {
    try {
      const [settingsRes, halaqatRes]: any = await Promise.all([
        apiClient.get('/attendance/settings'),
        apiClient.get('/attendance/halaqat'),
      ]);
      setAttendanceCount(settingsRes?.attendanceCount || 1);
      setSlots(settingsRes?.slots || []);
      const hList: Halaqah[] = Array.isArray(halaqatRes)
        ? halaqatRes
        : halaqatRes?.halaqaat || halaqatRes?.data || [];
      setHalaqat(hList);
      if (hList.length > 0 && !selectedHalaqah) {
        setSelectedHalaqah(hList[0]._id);
      }
    } catch (e) {
      console.warn('Monthly setup error', e);
    }
  }, [selectedHalaqah]);

  const loadMonthlyData = useCallback(async () => {
    if (!selectedHalaqah) {
      setStudents([]);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const studentsRes: any = await apiClient.get('/attendance/students', {
        halaqah: selectedHalaqah,
        date: month + '-01',
      });
      const studentList: StudentRow[] = Array.isArray(studentsRes)
        ? studentsRes
        : studentsRes?.students || studentsRes?.data || [];

      const slotCount = slots.length || attendanceCount || 1;
      const daysInMonth = getDaysInMonth(month);
      const totalExpectedSessions = daysInMonth * slotCount;

      const results: MonthlyStudentRow[] = await Promise.all(
        studentList.map(async (student) => {
          try {
            const res: any = await apiClient.get(
              `/attendance/student/${student._id}`,
              { month },
            );
            const records: any[] = Array.isArray(res) ? res : res?.data || [];

            const dailyRecords: MonthlyStudentRow['dailyRecords'] = [];
            let totalPresent = 0,
              totalAbsent = 0,
              totalLate = 0,
              totalExcused = 0,
              totalSessions = 0;

            for (let d = 1; d <= daysInMonth; d++) {
              const dateStr = `${month}-${String(d).padStart(2, '0')}`;
              const statuses: string[] = Array(slotCount).fill('Not Recorded');
              const comments: Record<number, string> = {};

              records
                .filter((r) => {
                  const rd = new Date(r.date).toISOString().split('T')[0];
                  return rd === dateStr;
                })
                .forEach((r) => {
                  const slotNum = Number(r.slotNumber) || 1;
                  if (slotNum >= 1 && slotNum <= slotCount) {
                    statuses[slotNum - 1] = r.status || 'Not Recorded';
                    if (r.comments) comments[slotNum] = r.comments;
                  }
                });

              statuses.forEach((s) => {
                if (s !== 'Not Recorded') {
                  totalSessions++;
                  if (s === 'Present') totalPresent++;
                  else if (s === 'Absent') totalAbsent++;
                  else if (s === 'Late') totalLate++;
                  else if (s === 'Excused') totalExcused++;
                }
              });

              dailyRecords.push({
                date: dateStr,
                day: formatDayShort(dateStr),
                statuses,
                hasAttendance: statuses.some((x) => x !== 'Not Recorded'),
                comments,
              });
            }

            const weightedPct = computeWeightedPct(
              {
                present: totalPresent,
                late: totalLate,
                excused: totalExcused,
                absent: totalAbsent,
              },
              totalExpectedSessions,
            );

            return {
              id: student._id,
              name: student.name,
              regNo: student.regNo,
              profilePicture: student.profilePicture,
              totalSessions,
              totalPresent,
              totalAbsent,
              totalLate,
              totalExcused,
              totalExpectedSessions,
              weightedPct,
              hasAnyAttendance: totalSessions > 0,
              dailyRecords,
            };
          } catch (e) {
            console.warn(`Monthly fetch failed for ${student.name}`, e);
            return {
              id: student._id,
              name: student.name,
              regNo: student.regNo,
              profilePicture: student.profilePicture,
              totalSessions: 0,
              totalPresent: 0,
              totalAbsent: 0,
              totalLate: 0,
              totalExcused: 0,
              totalExpectedSessions,
              weightedPct: 0,
              hasAnyAttendance: false,
              dailyRecords: [],
            };
          }
        }),
      );

      setStudents(results);
    } catch (err: any) {
      setError(err?.message || t('attendance.monthly.loadFailed'));
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedHalaqah, month, slots.length, attendanceCount, t]);

  useEffect(() => {
    loadSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadMonthlyData();
  }, [loadMonthlyData]);

  // ✅ Halaqah-level weighted percentage (aggregate of all students)
  const halaqahTotals = useMemo(() => {
    const totalStudents = students.length;
    const totalPresent = students.reduce((a, b) => a + b.totalPresent, 0);
    const totalLate = students.reduce((a, b) => a + b.totalLate, 0);
    const totalExcused = students.reduce((a, b) => a + b.totalExcused, 0);
    const totalAbsent = students.reduce((a, b) => a + b.totalAbsent, 0);
    const totalExpected = students.reduce(
      (a, b) => a + (b.totalExpectedSessions || 0),
      0,
    );
    const weightedPct = computeWeightedPct(
      {
        present: totalPresent,
        late: totalLate,
        excused: totalExcused,
        absent: totalAbsent,
      },
      totalExpected,
    );
    return {
      totalStudents,
      totalPresent,
      totalLate,
      totalExcused,
      totalAbsent,
      totalExpected,
      weightedPct,
    };
  }, [students]);

  return (
    <ScrollView
      contentContainerStyle={styles.viewContent}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={loadMonthlyData}
          tintColor={COLORS.primary}
        />
      }
    >
      <View style={styles.controlRow}>
        <Ionicons name="calendar-outline" size={16} color={COLORS.slateMuted} />
        <TextInput
          style={styles.dateInput}
          value={month}
          onChangeText={setMonth}
          placeholder="YYYY-MM"
          placeholderTextColor="#A0AAA5"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 44, marginTop: 8 }}
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

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.reportCard}>
        <Text style={styles.reportTitle}>{getMonthLabel(month)}</Text>
        <View style={styles.reportGrid}>
          <View
            style={[styles.reportStat, { backgroundColor: COLORS.primaryLight }]}
          >
            <Text style={[styles.reportStatValue, { color: COLORS.primary }]}>
              {halaqahTotals.totalStudents}
            </Text>
            <Text style={styles.reportStatLabel}>
              {t('attendance.monthly.students')}
            </Text>
          </View>
          <View
            style={[styles.reportStat, { backgroundColor: COLORS.blueLight }]}
          >
            <Text style={[styles.reportStatValue, { color: COLORS.blue }]}>
              {halaqahTotals.weightedPct}%
            </Text>
            <Text style={styles.reportStatLabel}>
              {t('attendance.monthly.rate')}
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
      ) : students.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="stats-chart-outline" size={56} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>
            {t('attendance.monthly.noDataTitle')}
          </Text>
          <Text style={styles.emptyText}>
            {t('attendance.monthly.noDataMsg', { month: getMonthLabel(month) })}
          </Text>
        </View>
      ) : (
        students.map((s) => {
          const pct = s.weightedPct;
          const color =
            pct >= 80 ? COLORS.primary : pct >= 60 ? COLORS.amber : COLORS.red;

          return (
            <View key={s.id} style={styles.monthlyStudentCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.monthlyStudentName}>{s.name}</Text>
                <Text style={styles.monthlyStudentMeta}>{s.regNo || '-'}</Text>

                <View style={styles.monthlyStatsRow}>
                  <View style={styles.monthlyStat}>
                    <Text style={styles.monthlyStatLabel}>
                      {t('attendance.monthly.totalSessions')}
                    </Text>
                    <Text style={styles.monthlyStatValue}>
                      {s.totalSessions}/{s.totalExpectedSessions}
                    </Text>
                  </View>
                  <View style={styles.monthlyStat}>
                    <Text style={styles.monthlyStatLabel}>
                      {t('attendance.daily.present')}
                    </Text>
                    <Text
                      style={[styles.monthlyStatValue, { color: COLORS.primary }]}
                    >
                      {s.totalPresent}
                    </Text>
                  </View>
                  <View style={styles.monthlyStat}>
                    <Text style={styles.monthlyStatLabel}>
                      {t('attendance.daily.absent')}
                    </Text>
                    <Text style={[styles.monthlyStatValue, { color: COLORS.red }]}>
                      {s.totalAbsent}
                    </Text>
                  </View>
                  <View style={styles.monthlyStat}>
                    <Text style={styles.monthlyStatLabel}>
                      {t('attendance.daily.late')}
                    </Text>
                    <Text
                      style={[styles.monthlyStatValue, { color: COLORS.amber }]}
                    >
                      {s.totalLate}
                    </Text>
                  </View>
                  <View style={styles.monthlyStat}>
                    <Text style={styles.monthlyStatLabel}>
                      {t('attendance.daily.excused')}
                    </Text>
                    <Text
                      style={[styles.monthlyStatValue, { color: COLORS.blue }]}
                    >
                      {s.totalExcused}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.monthlyPct, { color }]}>{pct}%</Text>
                <TouchableOpacity
                  style={styles.viewDetailsBtn}
                  onPress={() => setSelectedStudentDetails(s)}
                >
                  <Ionicons name="eye-outline" size={14} color={COLORS.blue} />
                  <Text style={styles.viewDetailsBtnText}>
                    {t('attendance.viewDetails')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {selectedStudentDetails && (
        <StudentMonthlyDetailsModal
          student={selectedStudentDetails}
          month={month}
          slots={
            slots.length > 0
              ? slots
              : [
                  {
                    slotNumber: 1,
                    name: t('attendance.slots.session'),
                    startTime: '',
                    endTime: '',
                  },
                ]
          }
          onClose={() => setSelectedStudentDetails(null)}
        />
      )}
    </ScrollView>
  );
};

// ============================================================
// STUDENT MONTHLY DETAILS MODAL
// ============================================================
const StudentMonthlyDetailsModal: React.FC<{
  student: MonthlyStudentRow;
  month: string;
  slots: AttendanceSlot[];
  onClose: () => void;
}> = ({ student, month, slots, onClose }) => {
  const { t } = useTranslation();

  const handlePrint = async () => {
    const lines: string[] = [];
    lines.push(`${student.name} (${student.regNo || '-'}) - ${month}`);
    lines.push(
      `Total Sessions: ${student.totalSessions}/${student.totalExpectedSessions} | Present: ${student.totalPresent} | Absent: ${student.totalAbsent} | Late: ${student.totalLate} | Excused: ${student.totalExcused} | Weighted %: ${student.weightedPct}%`,
    );
    lines.push('');
    lines.push(['Date', 'Day', ...slots.map((s) => s.name)].join(','));
    student.dailyRecords.forEach((r) => {
      lines.push([r.date, r.day, ...r.statuses].join(','));
    });
    try {
      await Share.share({
        message: lines.join('\n'),
        title: `${student.name}_${month}`,
      });
    } catch {}
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { maxHeight: '92%' }]}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{student.name}</Text>
              <Text style={styles.headerSubtitle}>
                {student.regNo || '-'} · {month}
              </Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={handlePrint}>
              <Ionicons name="share-outline" size={20} color={COLORS.slate} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <View style={styles.detailStatsGrid}>
            <View style={[styles.detailStat, { backgroundColor: '#F1F5F9' }]}>
              <Text style={styles.detailStatValue}>
                {student.totalSessions}/{student.totalExpectedSessions}
              </Text>
              <Text style={styles.detailStatLabel}>
                {t('attendance.monthly.totalSessions')}
              </Text>
            </View>
            <View
              style={[styles.detailStat, { backgroundColor: COLORS.primaryLight }]}
            >
              <Text style={[styles.detailStatValue, { color: COLORS.primary }]}>
                {student.totalPresent}
              </Text>
              <Text style={styles.detailStatLabel}>
                {t('attendance.daily.present')}
              </Text>
            </View>
            <View style={[styles.detailStat, { backgroundColor: COLORS.redLight }]}>
              <Text style={[styles.detailStatValue, { color: COLORS.red }]}>
                {student.totalAbsent}
              </Text>
              <Text style={styles.detailStatLabel}>
                {t('attendance.daily.absent')}
              </Text>
            </View>
            <View
              style={[styles.detailStat, { backgroundColor: COLORS.amberLight }]}
            >
              <Text style={[styles.detailStatValue, { color: COLORS.amber }]}>
                {student.totalLate}
              </Text>
              <Text style={styles.detailStatLabel}>
                {t('attendance.daily.late')}
              </Text>
            </View>
            <View
              style={[styles.detailStat, { backgroundColor: COLORS.blueLight }]}
            >
              <Text style={[styles.detailStatValue, { color: COLORS.blue }]}>
                {student.totalExcused}
              </Text>
              <Text style={styles.detailStatLabel}>
                {t('attendance.daily.excused')}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.modalCaption}>
              {t('attendance.monthly.allDaysCaption', {
                count: student.dailyRecords.length,
                month,
              })}
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={styles.studentsHeaderRow}>
                  <Text
                    style={[
                      styles.studentsHeaderCell,
                      { width: 110, textAlign: 'left' },
                    ]}
                  >
                    {t('attendance.date')}
                  </Text>
                  <Text style={[styles.studentsHeaderCell, { width: 60 }]}>
                    {t('attendance.day')}
                  </Text>
                  {slots.map((slot, i) => (
                    <Text
                      key={i}
                      style={[styles.studentsHeaderCell, { width: 90 }]}
                      numberOfLines={1}
                    >
                      {slot.name}
                    </Text>
                  ))}
                  <Text style={[styles.studentsHeaderCell, { width: 140 }]}>
                    {t('attendance.comments')}
                  </Text>
                </View>

                {student.dailyRecords.map((r, rIdx) => {
                  const commentsText =
                    Object.values(r.comments)
                      .filter((c) => c && c.trim() !== '')
                      .join(', ') || '-';
                  return (
                    <View
                      key={rIdx}
                      style={[
                        styles.studentsDataRow,
                        !r.hasAttendance && {
                          backgroundColor: '#FAFBFC',
                          opacity: 0.85,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.studentsDataCell,
                          { width: 110, textAlign: 'left' },
                        ]}
                      >
                        {r.date}
                      </Text>
                      <Text style={[styles.studentsDataCell, { width: 60 }]}>
                        {r.day}
                      </Text>
                      {r.statuses.map((status, i) => {
                        const pill = getStatusPillStyle(status);
                        return (
                          <View
                            key={i}
                            style={[styles.statusPillWrap, { width: 90 }]}
                          >
                            <View
                              style={[
                                styles.statusPill,
                                { backgroundColor: pill.bg },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusPillText,
                                  { color: pill.text },
                                ]}
                              >
                                {status === 'Not Recorded'
                                  ? t('attendance.none')
                                  : t(
                                      `attendance.statuses.${
                                        STATUS_KEY[
                                          status as Exclude<
                                            AttendanceStatus,
                                            ''
                                          >
                                        ]
                                      }`,
                                    ) || status}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                      <Text
                        style={[
                          styles.studentsDataCell,
                          { width: 140, textAlign: 'left' },
                        ]}
                        numberOfLines={2}
                      >
                        {commentsText}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      </View>
    </Modal>
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
      const [topRes, halaqahRes]: any = await Promise.all([
        apiClient.get('/attendance/top-students', { month }),
        apiClient.get('/attendance/top-halaqah', { month }),
      ]);
      setTopStudents(topRes?.top || []);
      setBottomStudents(topRes?.bottom || []);
      setTopHalaqah(halaqahRes || null);
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
        <RefreshControl
          refreshing={loading}
          onRefresh={load}
          tintColor={COLORS.primary}
        />
      }
    >
      <View style={styles.controlRow}>
        <Ionicons name="calendar-outline" size={16} color={COLORS.slateMuted} />
        <TextInput
          style={styles.dateInput}
          value={month}
          onChangeText={setMonth}
          placeholder="YYYY-MM"
          placeholderTextColor="#A0AAA5"
        />
      </View>

      <View style={styles.weightedLegend}>
        <Text style={styles.weightedLegendTitle}>
          {t('attendance.weightedLegend') || 'Weighted Attendance Legend:'}
        </Text>
        <View style={styles.weightedLegendRow}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
          <Text style={styles.weightedLegendText}>
            {t('attendance.daily.present')} = 100%
          </Text>
        </View>
        <View style={styles.weightedLegendRow}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.amber }]} />
          <Text style={styles.weightedLegendText}>
            {t('attendance.daily.late')} = 70%
          </Text>
        </View>
        <View style={styles.weightedLegendRow}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.blue }]} />
          <Text style={styles.weightedLegendText}>
            {t('attendance.daily.excused')} = 30%
          </Text>
        </View>
        <View style={styles.weightedLegendRow}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.red }]} />
          <Text style={styles.weightedLegendText}>
            {t('attendance.daily.absent')} = 0%
          </Text>
        </View>
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
              <Ionicons name="trending-up" size={18} color={COLORS.primary} />
              <Text style={[styles.reportTitle, { marginBottom: 0, marginLeft: 6 }]}>
                {t('attendance.attendanceTopPerformers.topStudents')}
              </Text>
            </View>
            {topStudents.length === 0 ? (
              <Text style={styles.emptyText}>{t('attendance.top.noData')}</Text>
            ) : (
              topStudents.map((s, i) => (
                <TopStudentRow key={i} student={s} index={i} type="top" />
              ))
            )}
          </View>

          <View style={styles.reportCard}>
            <View style={styles.reportTitleRow}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={COLORS.red}
              />
              <Text style={[styles.reportTitle, { marginBottom: 0, marginLeft: 6 }]}>
                {t('attendance.attendanceTopPerformers.worstStudents')}
              </Text>
            </View>
            {bottomStudents.length === 0 ? (
              <Text style={styles.emptyText}>{t('attendance.top.noData')}</Text>
            ) : (
              bottomStudents.map((s, i) => (
                <TopStudentRow key={i} student={s} index={i} type="bottom" />
              ))
            )}
          </View>

          {topHalaqah && (
            <View style={styles.reportCard}>
              <View style={styles.reportTitleRow}>
                <Ionicons name="star" size={18} color={COLORS.gold} />
                <Text style={[styles.reportTitle, { marginBottom: 0, marginLeft: 6 }]}>
                  {t('attendance.attendanceTopPerformers.topHalaqahs')}
                </Text>
              </View>
              <View style={styles.topHalaqahCard}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <View style={styles.topHalaqahBadge}>
                    <Text style={{ fontSize: 20 }}>🏆</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.topHalaqahName}>{topHalaqah.name}</Text>
                    <Text style={styles.topHalaqahMeta}>
                      {topHalaqah.totalStudents || 0}{' '}
                      {t('attendance.attendanceTopPerformers.students')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.topHalaqahPct}>
                      {topHalaqah.attendance || 0}%
                    </Text>
                    <Text style={styles.topHalaqahPctLabel}>
                      {t('attendance.attendanceRate')}
                    </Text>
                  </View>
                </View>
                <View style={styles.topHalaqahGrid}>
                  <View style={styles.topHalaqahStat}>
                    <Text
                      style={[styles.topHalaqahStatVal, { color: COLORS.primary }]}
                    >
                      {topHalaqah.present || 0}
                    </Text>
                    <Text style={styles.topHalaqahStatLbl}>
                      {t('attendance.daily.present')}
                    </Text>
                  </View>
                  <View style={styles.topHalaqahStat}>
                    <Text
                      style={[styles.topHalaqahStatVal, { color: COLORS.amber }]}
                    >
                      {topHalaqah.late || 0}
                    </Text>
                    <Text style={styles.topHalaqahStatLbl}>
                      {t('attendance.daily.late')}
                    </Text>
                  </View>
                  <View style={styles.topHalaqahStat}>
                    <Text
                      style={[styles.topHalaqahStatVal, { color: COLORS.blue }]}
                    >
                      {topHalaqah.excused || 0}
                    </Text>
                    <Text style={styles.topHalaqahStatLbl}>
                      {t('attendance.daily.excused')}
                    </Text>
                  </View>
                  <View style={styles.topHalaqahStat}>
                    <Text
                      style={[styles.topHalaqahStatVal, { color: COLORS.red }]}
                    >
                      {topHalaqah.absent || 0}
                    </Text>
                    <Text style={styles.topHalaqahStatLbl}>
                      {t('attendance.daily.absent')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

const TopStudentRow: React.FC<{
  student: TopStudent;
  index: number;
  type: 'top' | 'bottom';
}> = ({ student, index, type }) => {
  const { t } = useTranslation();
  const pct = student.attendance || 0;
  const rank = student.rank || index + 1;
  const color =
    type === 'bottom'
      ? COLORS.red
      : pct >= 80
      ? COLORS.primary
      : pct >= 60
      ? COLORS.amber
      : COLORS.red;

  const getRankStyle = () => {
    if (type === 'bottom') return { bg: COLORS.redLight, text: COLORS.red };
    if (rank === 1) return { bg: '#FEF3C7', text: '#B45309' };
    if (rank === 2) return { bg: '#E5E7EB', text: '#374151' };
    if (rank === 3) return { bg: '#FDE68A', text: '#92400E' };
    return { bg: COLORS.primaryLight, text: COLORS.primary };
  };
  const rankStyle = getRankStyle();

  return (
    <View style={styles.topRow}>
      <View style={[styles.topRank, { backgroundColor: rankStyle.bg }]}>
        <Text style={[styles.topRankText, { color: rankStyle.text }]}>{rank}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.topName}>{student.name}</Text>
        <Text style={styles.topHalaqah}>{student.halaqah || '-'}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.topRate, { color }]}>{pct}%</Text>
        <Text style={styles.topMeta}>
          {t('attendance.daily.present')}: {student.present || 0}
        </Text>
      </View>
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================
const toastStyles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 9999,
  },
  title: { fontSize: 13, fontWeight: '800', color: COLORS.slate },
  message: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
});

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
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.slate },
  headerSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },

  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
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

  menuContainer: { padding: 16, gap: 12 },
  menuCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  menuTitle: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  menuText: {
    fontSize: 13,
    color: COLORS.slateMuted,
    marginTop: 4,
    lineHeight: 20,
  },
  menuArrow: { position: 'absolute', right: 20, top: 20 },

  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.slateMuted },
  tabTextActive: { color: '#fff' },

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
  dateInput: { flex: 1, fontSize: 14, color: COLORS.slate, paddingVertical: 0 },
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

  markAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    flexWrap: 'wrap',
  },
  markAllLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
    marginRight: 4,
  },
  markAllChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  markAllChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },

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
  attendanceCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  attendanceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  attendanceInfo: { flex: 1 },
  attendanceName: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  attendanceMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },

  commentBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  commentBtnActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },

  commentPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FAFBFC',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  commentPreviewText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.slateMuted,
    fontStyle: 'italic',
  },

  statusRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusChipText: { fontSize: 11, fontWeight: '700', color: COLORS.slateMuted },
  hoursRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  hoursLabel: { fontSize: 12, color: COLORS.slateMuted, fontWeight: '700' },
  hoursInput: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: 60,
    fontSize: 13,
    color: COLORS.slate,
    textAlign: 'center',
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

  viewContent: { padding: 16, gap: 12 },
  reportCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  reportTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.slate,
    marginBottom: 12,
  },
  reportTeacher: {
    fontSize: 12,
    color: COLORS.slateMuted,
    fontWeight: '600',
    marginBottom: 8,
  },
  reportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reportGridSmall: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  reportStat: {
    flex: 1,
    minWidth: '44%',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  reportStatValue: { fontSize: 22, fontWeight: '800' },
  reportStatLabel: {
    fontSize: 11,
    color: COLORS.slate,
    fontWeight: '700',
    marginTop: 4,
  },
  miniStat: { flex: 1, minWidth: '22%', alignItems: 'center', padding: 8 },
  miniStatValue: { fontSize: 16, fontWeight: '800', color: COLORS.slate },
  miniStatLabel: {
    fontSize: 10,
    color: COLORS.slateMuted,
    fontWeight: '700',
    marginTop: 2,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  rateLabel: { fontSize: 13, color: COLORS.slateMuted, fontWeight: '600' },
  rateValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },

  sessionPctGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  sessionPctCard: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sessionPctLabel: {
    fontSize: 10,
    color: COLORS.slateMuted,
    fontWeight: '700',
    textAlign: 'center',
  },
  sessionPctValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  sessionPctTime: { fontSize: 9, color: COLORS.gray, marginTop: 1 },

  viewDetailsBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.blueLight,
    borderRadius: 8,
  },
  viewDetailsBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.blue },

  studentsHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  studentsHeaderCell: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  studentsDataRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F5',
  },
  studentsDataCell: {
    fontSize: 12,
    color: COLORS.slate,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  statusPillWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillText: { fontSize: 10, fontWeight: '700' },

  detailStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 16,
    paddingBottom: 8,
  },
  detailStat: {
    flexGrow: 1,
    flexBasis: '22%',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  detailStatValue: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  detailStatLabel: {
    fontSize: 10,
    color: COLORS.slate,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },

  activeFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  activeFilterText: { fontSize: 13, fontWeight: '800', color: COLORS.slate },
  clearFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clearFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },

  monthlyStudentCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  monthlyStudentName: { fontSize: 15, fontWeight: '800', color: COLORS.slate },
  monthlyStudentMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  monthlyStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  monthlyStat: { alignItems: 'center', minWidth: 50 },
  monthlyStatLabel: {
    fontSize: 9,
    color: COLORS.slateMuted,
    fontWeight: '700',
  },
  monthlyStatValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 2,
  },
  monthlyPct: { fontSize: 22, fontWeight: '800' },

  weightedLegend: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  weightedLegendTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slate,
    marginBottom: 4,
  },
  weightedLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  weightedLegendText: { fontSize: 11, color: COLORS.slateMuted },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  topRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRankText: { fontSize: 13, fontWeight: '800' },
  topName: { fontSize: 13, fontWeight: '700', color: COLORS.slate },
  topHalaqah: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  topRate: { fontSize: 16, fontWeight: '800' },
  topMeta: { fontSize: 10, color: COLORS.slateMuted, marginTop: 2 },

  topHalaqahCard: {
    backgroundColor: COLORS.blueLight,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CFE3FA',
  },
  topHalaqahBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  topHalaqahName: { fontSize: 15, fontWeight: '800', color: COLORS.slate },
  topHalaqahMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  topHalaqahPct: { fontSize: 24, fontWeight: '800', color: COLORS.blue },
  topHalaqahPctLabel: {
    fontSize: 10,
    color: COLORS.slateMuted,
    fontWeight: '700',
  },
  topHalaqahGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#CFE3FA',
  },
  topHalaqahStat: {
    flexGrow: 1,
    flexBasis: '22%',
    alignItems: 'center',
    padding: 6,
    backgroundColor: COLORS.white,
    borderRadius: 8,
  },
  topHalaqahStatVal: { fontSize: 16, fontWeight: '800' },
  topHalaqahStatLbl: {
    fontSize: 10,
    color: COLORS.slateMuted,
    fontWeight: '700',
    marginTop: 2,
  },

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
    gap: 10,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.slate },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { paddingHorizontal: 16, paddingTop: 12 },
  modalCaption: {
    fontSize: 11,
    color: COLORS.slateMuted,
    fontStyle: 'italic',
    marginBottom: 10,
    paddingHorizontal: 2,
  },

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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: COLORS.slateMuted },
  chipTextActive: { color: '#fff' },

  slotCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    backgroundColor: COLORS.background,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  slotNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotNumberText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  slotTitle: { fontSize: 14, fontWeight: '800', color: COLORS.slate },
  twoCol: { flexDirection: 'row', gap: 10, marginTop: 4 },

  modalActionsFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 20,
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
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

export default AttendanceManagementScreen;

// const payload: any = { records, branchId: currentBranch._id };