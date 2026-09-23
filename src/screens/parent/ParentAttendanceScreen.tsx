// src/screens/parent/ParentAttendanceScreen.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { api as apiClient } from '../../api/client';

// ============================================================
// COLORS
// ============================================================
const COLORS = {
  primary: '#0A8E5A',
  primaryLight: '#E9F8F0',
  blue: '#2878D0',
  blueLight: '#EAF3FF',
  blueDark: '#1E40AF',
  indigo: '#4338CA',
  indigoLight: '#E0E7FF',
  red: '#DC2626',
  redLight: '#FEE2E2',
  amber: '#D97706',
  amberLight: '#FEF3C7',
  yellow: '#CA8A04',
  yellowLight: '#FEF9C3',
  green: '#16A34A',
  greenLight: '#DCFCE7',
  purple: '#7C3AED',
  purpleLight: '#F3EFFF',
  gray: '#64748B',
  grayLight: '#F1F5F9',
  white: '#FFFFFF',
  slate: '#18392D',
  slateDark: '#0F172A',
  slateMuted: '#718079',
  border: '#E4EBE7',
  background: '#F7FAF8',
};

// ============================================================
// TYPES
// ============================================================
interface Child {
  _id: string;
  name: string;
  regNo?: string;
  halaqah?: string;
  teacher?: string;
  studentType?: string;
}

interface AttendanceSession {
  status?: string;
  checkIn?: string;
  checkOut?: string;
  hours?: number;
  remarks?: string;
}

interface AttendanceSlot {
  slotNumber: number;
  name: string;
  startTime?: string;
  endTime?: string;
}

interface DailyAttendance {
  date: string;
  day?: string;
  sessions?: Record<string, AttendanceSession>;
  comment?: string;
}

// ============================================================
// HELPERS
// ============================================================
const STATUS_COLORS: Record<string, { bg: string; text: string; color: string }> = {
  present: { bg: '#DCFCE7', text: '#15803D', color: '#22C55E' },
  late: { bg: '#FEF9C3', text: '#A16207', color: '#EAB308' },
  absent: { bg: '#FEE2E2', text: '#B91C1C', color: '#EF4444' },
  excused: { bg: '#EDE9FE', text: '#6D28D9', color: '#8B5CF6' },
  'not recorded': { bg: '#F1F5F9', text: '#64748B', color: '#94A3B8' },
};

const getStatusStyle = (status: string) => {
  const key = (status || '').toLowerCase();
  // Also handle Arabic / Somali input from backend
  if (key === 'present' || status === 'حاضر' || status === 'Joogo')
    return STATUS_COLORS.present;
  if (key === 'late' || status === 'متأخر' || status === 'Daahay')
    return STATUS_COLORS.late;
  if (key === 'excused' || status === 'معذور' || status === 'Cudur daar')
    return STATUS_COLORS.excused;
  if (key === 'absent' || status === 'غائب' || status === 'Maqan')
    return STATUS_COLORS.absent;
  return STATUS_COLORS['not recorded'];
};

// Weighted scoring: Present=100, Late=75, Excused=50, Absent=0
const getSessionScore = (status: string): number => {
  const key = (status || '').toLowerCase();
  if (key === 'present' || status === 'حاضر' || status === 'Joogo') return 100;
  if (key === 'late' || status === 'متأخر' || status === 'Daahay') return 75;
  if (key === 'excused' || status === 'معذور' || status === 'Cudur daar')
    return 50;
  if (key === 'absent' || status === 'غائب' || status === 'Maqan') return 0;
  return 0;
};

const getMonthName = (month: number, language: string) => {
  const map: Record<string, string[]> = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    so: ['Janaayo', 'Febraayo', 'Maarso', 'Abriil', 'Maayo', 'Juunyo', 'Luulyo', 'Agosto', 'Sebtembar', 'Oktoobar', 'Nofembar', 'Desembar'],
  };
  return map[language]?.[month - 1] || map.en[month - 1];
};

const formatFullDate = (dateStr: string, language: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const locale = language === 'ar' ? 'ar-EG' : language === 'so' ? 'so-SO' : 'en-US';
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatShortDate = (dateStr: string, language: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const locale = language === 'ar' ? 'ar-EG' : language === 'so' ? 'so-SO' : 'en-US';
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
};

// ============================================================
// SCREEN
// ============================================================
export const ParentAttendanceScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<any>();
  const currentLanguage = i18n.language;

  // State
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [attendanceSlots, setAttendanceSlots] = useState<AttendanceSlot[]>([]);
  const [attendanceCount, setAttendanceCount] = useState(1);
  const [dailyData, setDailyData] = useState<DailyAttendance[]>([]);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());

  const todayStr = new Date().toISOString().split('T')[0];

  // ============================================================
  // FETCH CHILDREN
  // ============================================================
  const fetchChildren = useCallback(async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/parent/children');
      const data = res?.children || res?.data || (Array.isArray(res) ? res : []);
      setChildren(data);
      if (data.length > 0) {
        setSelectedChildId(data[0]._id);
        setSelectedChild(data[0]);
      }
    } catch (err: any) {
      console.error('Fetch children error:', err);
      setError(err?.message || t('parentAttendance.errors.fetchChildren'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  // ============================================================
  // FETCH MONTHLY ATTENDANCE
  // ============================================================
  const fetchMonthlyAttendance = useCallback(async () => {
    if (!selectedChildId) return;
    try {
      setLoadingRecords(true);
      setError('');
      const res: any = await apiClient.get(
        `/parent/child/${selectedChildId}/attendance/monthly`,
        { year: viewYear, month: viewMonth }
      );
      const data = res || {};
      const daily: DailyAttendance[] = data.dailyData || [];
      setDailyData(daily);
      if (Array.isArray(data.slots) && data.slots.length > 0) {
        setAttendanceSlots(data.slots);
        setAttendanceCount(data.attendanceCount || 1);
      } else {
        setAttendanceSlots([]);
        setAttendanceCount(1);
      }
    } catch (err: any) {
      console.error('Fetch monthly attendance error:', err);
      setError(err?.message || t('parentAttendance.errors.loadData'));
      setDailyData([]);
    } finally {
      setLoadingRecords(false);
    }
  }, [selectedChildId, viewMonth, viewYear, t]);

  useEffect(() => {
    if (selectedChildId) {
      fetchMonthlyAttendance();
    }
  }, [selectedChildId, viewMonth, viewYear, fetchMonthlyAttendance]);

  // ============================================================
  // STATS
  // ============================================================
  const attendanceStats = useMemo(() => {
    const sessionsPerDay = Math.max(1, attendanceCount);
    if (dailyData.length === 0) {
      return {
        total: 0,
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        rate: 0,
        daysWithAttendance: 0,
        totalPossibleSessions: 0,
        completedSessions: 0,
      };
    }

    let present = 0,
      late = 0,
      absent = 0,
      excused = 0,
      totalSessions = 0,
      daysWithAttendance = 0,
      totalScore = 0;
    const totalPossibleSessions = dailyData.length * sessionsPerDay;
    const totalPossibleScore = totalPossibleSessions * 100;

    dailyData.forEach((day) => {
      let dayHasAttendance = false;
      if (day.sessions) {
        Object.keys(day.sessions).forEach((slotKey) => {
          const session = day.sessions![slotKey];
          if (session) {
            const status =
              session.status || t('parentAttendance.status.notRecorded');
            totalSessions++;
            totalScore += getSessionScore(status);

            const key = status.toLowerCase();
            if (key === 'present' || status === 'حاضر' || status === 'Joogo') {
              present++;
              dayHasAttendance = true;
            } else if (
              key === 'late' ||
              status === 'متأخر' ||
              status === 'Daahay'
            ) {
              late++;
              dayHasAttendance = true;
            } else if (
              key === 'excused' ||
              status === 'معذور' ||
              status === 'Cudur daar'
            ) {
              excused++;
              dayHasAttendance = true;
            } else if (
              key === 'absent' ||
              status === 'غائب' ||
              status === 'Maqan'
            ) {
              absent++;
              dayHasAttendance = true;
            }
          }
        });
      }
      if (dayHasAttendance) daysWithAttendance++;
    });

    const rate =
      totalPossibleScore > 0
        ? Math.round((totalScore / totalPossibleScore) * 100)
        : 0;

    return {
      total: totalSessions,
      present,
      late,
      absent,
      excused,
      rate,
      daysWithAttendance,
      totalPossibleSessions,
      completedSessions: totalSessions,
    };
  }, [dailyData, attendanceCount, t]);

  // ============================================================
  // SESSION COLUMNS
  // ============================================================
  const sessionColumns: AttendanceSlot[] = useMemo(() => {
    if (attendanceSlots.length > 0) return attendanceSlots;
    return [{ slotNumber: 1, name: t('parentAttendance.attendance') }];
  }, [attendanceSlots, t]);

  // ============================================================
  // NAVIGATION
  // ============================================================
  const navigateMonth = (direction: number) => {
    let newMonth = viewMonth + direction;
    let newYear = viewYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    setViewMonth(newMonth);
    setViewYear(newYear);
  };

  const goToToday = () => {
    const now = new Date();
    setViewMonth(now.getMonth() + 1);
    setViewYear(now.getFullYear());
  };

  const isToday = (dateStr: string) => dateStr === todayStr;

  const getTeacherName = () => {
    if (
      selectedChild?.teacher &&
      selectedChild.teacher !== 'Not assigned' &&
      selectedChild.teacher !== 'Not Assigned'
    ) {
      return selectedChild.teacher;
    }
    return t('parentAttendance.notAssigned');
  };

  // ============================================================
  // LOADING / EMPTY
  // ============================================================
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.blue} />
          <Text style={styles.loadingText}>{t('parentAttendance.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (children.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerWrap}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="people-outline" size={40} color={COLORS.gray} />
          </View>
          <Text style={styles.emptyTitle}>
            {t('parentAttendance.noChildren.title')}
          </Text>
          <Text style={styles.emptyText}>
            {t('parentAttendance.noChildren.message')}
          </Text>
          <Text style={styles.emptyHint}>
            {t('parentAttendance.noChildren.contactAdmin')}
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.emptyBtnText}>
              {t('parentAttendance.noChildren.goDashboard')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.headerBadge}>
            {t('parentAttendance.header.badge')}
          </Text>
          <Text style={styles.headerTitle}>
            {t('parentAttendance.header.title')}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={fetchMonthlyAttendance}
        >
          <Ionicons name="refresh" size={18} color={COLORS.slate} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loadingRecords}
            onRefresh={fetchMonthlyAttendance}
            colors={[COLORS.blue]}
            tintColor={COLORS.blue}
          />
        }
      >
        {/* CHILD SELECTOR */}
        {children.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
          >
            {children.map((child) => {
              const active = selectedChildId === child._id;
              return (
                <TouchableOpacity
                  key={child._id}
                  style={[styles.childChip, active && styles.childChipActive]}
                  onPress={() => {
                    setSelectedChildId(child._id);
                    setSelectedChild(child);
                  }}
                >
                  <Text
                    style={[
                      styles.childChipText,
                      active && styles.childChipTextActive,
                    ]}
                  >
                    {child.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* IDENTITY CARD */}
        {selectedChild && (
          <View style={styles.identityCard}>
            <View style={styles.identityTop}>
              <View style={styles.identityAvatar}>
                <Text style={styles.identityAvatarText}>
                  {selectedChild.name?.charAt(0) || 'S'}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.identityName} numberOfLines={1}>
                  {selectedChild.name}
                </Text>
                <Text style={styles.identityType}>
                  {selectedChild.studentType || t('parentAttendance.student')}
                </Text>
                <Text style={styles.identityMeta} numberOfLines={1}>
                  {selectedChild.halaqah || t('parentAttendance.notAssigned')}{' '}
                  {t('parentAttendance.halaqah')} •{' '}
                  {selectedChild.teacher || t('parentAttendance.noTeacher')}
                </Text>
                <Text style={styles.identityReg}>
                  {t('parentAttendance.registration')}:{' '}
                  {selectedChild.regNo || t('parentAttendance.na')}
                </Text>
              </View>
            </View>

            {/* Stats grid — 6 columns on 2 rows */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {t('parentAttendance.stats.rate')}
                </Text>
                <Text style={[styles.statValue, { color: COLORS.blue }]}>
                  {attendanceStats.rate}%
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {t('parentAttendance.stats.present')}
                </Text>
                <Text style={[styles.statValue, { color: COLORS.green }]}>
                  {attendanceStats.present}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {t('parentAttendance.stats.late')}
                </Text>
                <Text style={[styles.statValue, { color: COLORS.yellow }]}>
                  {attendanceStats.late}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {t('parentAttendance.stats.absent')}
                </Text>
                <Text style={[styles.statValue, { color: COLORS.red }]}>
                  {attendanceStats.absent}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {t('parentAttendance.stats.excused')}
                </Text>
                <Text style={[styles.statValue, { color: COLORS.purple }]}>
                  {attendanceStats.excused}
                </Text>
              </View>
              <View style={[styles.statItem, { borderRightWidth: 0 }]}>
                <Text style={styles.statLabel}>
                  {t('parentAttendance.stats.activeDays')}
                </Text>
                <Text style={[styles.statValue, { color: COLORS.amber }]}>
                  {attendanceStats.daysWithAttendance}
                </Text>
              </View>
            </View>

            {/* Dark overview block */}
            <View style={styles.overviewBlock}>
              <View style={styles.overviewRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.overviewLabel}>
                    {t('parentAttendance.overview.title')}
                  </Text>
                  <Text style={styles.overviewValue}>
                    {attendanceStats.rate}%
                  </Text>
                  <Text style={styles.overviewSub}>
                    {attendanceStats.completedSessions}{' '}
                    {t('parentAttendance.overview.of')}{' '}
                    {attendanceStats.totalPossibleSessions}{' '}
                    {t('parentAttendance.overview.sessions')}
                  </Text>
                  <Text style={styles.overviewHint}>
                    {attendanceStats.daysWithAttendance}{' '}
                    {t('parentAttendance.overview.daysActive')}
                  </Text>
                </View>
                {/* Simple circle indicator */}
                <View style={styles.ringWrap}>
                  <View style={styles.ring}>
                    <Text style={styles.ringValue}>{attendanceStats.rate}%</Text>
                  </View>
                </View>
              </View>

              <View style={styles.overviewMiniRow}>
                <MiniStat
                  label={t('parentAttendance.overview.present')}
                  value={attendanceStats.present}
                  color="#4ADE80"
                />
                <MiniStat
                  label={t('parentAttendance.overview.late')}
                  value={attendanceStats.late}
                  color="#FACC15"
                />
                <MiniStat
                  label={t('parentAttendance.overview.excused')}
                  value={attendanceStats.excused}
                  color="#A78BFA"
                />
                <MiniStat
                  label={t('parentAttendance.overview.absent')}
                  value={attendanceStats.absent}
                  color="#F87171"
                />
                <MiniStat
                  label={t('parentAttendance.overview.active')}
                  value={attendanceStats.daysWithAttendance}
                  color="#FB923C"
                />
              </View>
            </View>
          </View>
        )}

        {/* MONTH NAVIGATOR */}
        <View style={styles.monthNavBox}>
          <Text style={styles.sectionBadge}>
            {t('parentAttendance.monthlyView.title')}
          </Text>
          <View style={styles.monthNavRow}>
            <TouchableOpacity
              style={styles.monthNavBtn}
              onPress={() => navigateMonth(-1)}
            >
              <Ionicons name="chevron-back" size={16} color={COLORS.slate} />
            </TouchableOpacity>
            <Text style={styles.monthNavTitle}>
              {getMonthName(viewMonth, currentLanguage)} {viewYear}
            </Text>
            <TouchableOpacity
              style={styles.monthNavBtn}
              onPress={() => navigateMonth(1)}
            >
              <Ionicons name="chevron-forward" size={16} color={COLORS.slate} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.todayBtn} onPress={goToToday}>
              <Text style={styles.todayBtnText}>
                {t('parentAttendance.monthlyView.today')}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.monthMetaRow}>
            <Text style={styles.monthMetaText}>
              {attendanceCount}{' '}
              {attendanceCount > 1
                ? t('parentAttendance.monthlyView.sessions')
                : t('parentAttendance.monthlyView.session')}
            </Text>
            <Text style={styles.monthMetaDivider}>|</Text>
            <Text style={styles.monthMetaText}>
              {attendanceStats.daysWithAttendance}{' '}
              {t('parentAttendance.monthlyView.activeDays')}
            </Text>
          </View>
        </View>

        {/* MONTHLY STATS SUMMARY */}
        <View style={styles.monthStatsRow}>
          <StatMini
            label={t('parentAttendance.monthlyStats.rate')}
            value={`${attendanceStats.rate}%`}
            color={COLORS.blue}
          />
          <StatMini
            label={t('parentAttendance.monthlyStats.present')}
            value={String(attendanceStats.present)}
            color={COLORS.green}
          />
          <StatMini
            label={t('parentAttendance.monthlyStats.late')}
            value={String(attendanceStats.late)}
            color={COLORS.yellow}
          />
          <StatMini
            label={t('parentAttendance.monthlyStats.excused')}
            value={String(attendanceStats.excused)}
            color={COLORS.purple}
          />
          <StatMini
            label={t('parentAttendance.monthlyStats.absent')}
            value={String(attendanceStats.absent)}
            color={COLORS.red}
          />
          <StatMini
            label={t('parentAttendance.monthlyStats.activeDays')}
            value={String(attendanceStats.daysWithAttendance)}
            color={COLORS.amber}
          />
        </View>

        {/* MONTHLY TABLE */}
        {loadingRecords ? (
          <View style={styles.miniLoaderWrap}>
            <ActivityIndicator color={COLORS.blue} />
            <Text style={styles.miniLoaderText}>
              {t('parentAttendance.loadingRecords')}
            </Text>
          </View>
        ) : dailyData.length === 0 ? (
          <View style={styles.emptyListWrap}>
            <Ionicons name="calendar-outline" size={48} color={COLORS.gray} />
            <Text style={styles.emptyListTitle}>
              {t('parentAttendance.table.noRecords')}
            </Text>
            <Text style={styles.emptyListHint}>
              {t('parentAttendance.table.noRecordsForMonth', {
                month: getMonthName(viewMonth, currentLanguage),
                year: viewYear,
              })}
            </Text>
          </View>
        ) : (
          <View style={styles.tableWrap}>
            {/* Header row */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, { width: 90 }]}>
                {t('parentAttendance.table.date')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
              >
                <View style={{ flexDirection: 'row' }}>
                  {sessionColumns.map((slot) => (
                    <Text
                      key={slot.slotNumber}
                      style={[styles.tableHeaderCell, { minWidth: 100, textAlign: 'center' }]}
                    >
                      {slot.name}
                      {slot.startTime && slot.endTime ? (
                        <Text style={styles.tableHeaderSub}>
                          {' '}
                          {slot.startTime}-{slot.endTime}
                        </Text>
                      ) : null}
                    </Text>
                  ))}
                </View>
              </ScrollView>
              <Text style={[styles.tableHeaderCell, { width: 70, textAlign: 'center' }]}>
                {t('parentAttendance.table.dayPercent')}
              </Text>
            </View>

            {/* Rows */}
            {dailyData.map((day, idx) => {
              const isTodayDate = isToday(day.date);
              const dateLabel = formatShortDate(day.date, currentLanguage);
              const dayOfWeek = day.date
                ? new Date(day.date).toLocaleDateString(
                    currentLanguage === 'ar'
                      ? 'ar-EG'
                      : currentLanguage === 'so'
                      ? 'so-SO'
                      : 'en-US',
                    { weekday: 'short' }
                  )
                : '';

              // compute day %
              let dayScore = 0;
              let dayPossible = 0;
              if (day.sessions) {
                Object.keys(day.sessions).forEach((k) => {
                  const s = day.sessions![k];
                  if (s) {
                    dayPossible += 100;
                    dayScore += getSessionScore(
                      s.status || t('parentAttendance.status.notRecorded')
                    );
                  }
                });
              }
              const dayPct =
                dayPossible > 0 ? Math.round((dayScore / dayPossible) * 100) : 0;
              const dayPctColor =
                dayPct >= 80
                  ? COLORS.green
                  : dayPct >= 50
                  ? COLORS.yellow
                  : dayPct > 0
                  ? COLORS.red
                  : COLORS.gray;

              return (
                <View
                  key={day.date || idx}
                  style={[styles.tableRow, isTodayDate && styles.tableRowToday]}
                >
                  <View style={{ width: 90 }}>
                    <Text style={styles.tableDate}>{dateLabel}</Text>
                    <Text style={styles.tableDay}>
                      {dayOfWeek}
                      {isTodayDate ? ' • ' + t('parentAttendance.table.today') : ''}
                    </Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ flex: 1 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {sessionColumns.map((slot) => {
                        const session = day.sessions?.[slot.slotNumber];
                        const status =
                          session?.status ||
                          t('parentAttendance.status.notRecorded');
                        const st = getStatusStyle(status);
                        const clickable =
                          status !==
                          t('parentAttendance.status.notRecorded') && !!session;
                        return (
                          <TouchableOpacity
                            key={slot.slotNumber}
                            disabled={!clickable}
                            onPress={() => {
                              if (!clickable || !session) return;
                              setSelectedRecord({
                                ...session,
                                date: day.date,
                                status,
                                remarks: day.comment || '',
                                slotName: slot.name,
                                slotNumber: slot.slotNumber,
                              });
                            }}
                            style={[styles.tableSessionCell, { minWidth: 100 }]}
                          >
                            <View
                              style={[
                                styles.statusPill,
                                { backgroundColor: st.bg },
                              ]}
                            >
                              <View
                                style={[
                                  styles.statusDot,
                                  { backgroundColor: st.color },
                                ]}
                              />
                              <Text
                                style={[styles.statusPillText, { color: st.text }]}
                                numberOfLines={1}
                              >
                                {status}
                              </Text>
                            </View>
                            {session?.checkIn && session.checkIn !== '--' && (
                              <Text style={styles.tableCheckIn}>
                                🕐 {session.checkIn}
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>

                  <View style={{ width: 70, alignItems: 'center' }}>
                    <View style={styles.dayPctBar}>
                      <View
                        style={[
                          styles.dayPctFill,
                          { width: `${dayPct}%`, backgroundColor: dayPctColor },
                        ]}
                      />
                    </View>
                    <Text
                      style={[styles.dayPctText, { color: dayPctColor }]}
                    >
                      {dayPct}%
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* DETAIL MODAL */}
      <Modal
        visible={!!selectedRecord}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRecord(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {selectedRecord ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalBadge}>
                      {t('parentAttendance.detailModal.attendanceRecord')}
                    </Text>
                    <View style={styles.modalTitleRow}>
                      <View
                        style={[
                          styles.modalStatus,
                          {
                            backgroundColor: getStatusStyle(selectedRecord.status).bg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.modalStatusText,
                            { color: getStatusStyle(selectedRecord.status).text },
                          ]}
                        >
                          {selectedRecord.status ||
                            t('parentAttendance.detailModal.unknown')}
                        </Text>
                      </View>
                      {selectedRecord.slotName && (
                        <View style={styles.modalSlotTag}>
                          <Text style={styles.modalSlotTagText}>
                            {selectedRecord.slotName}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.modalSub}>
                      {selectedRecord.date
                        ? formatFullDate(selectedRecord.date, currentLanguage)
                        : t('parentAttendance.detailModal.dateNotAvailable')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setSelectedRecord(null)}
                  >
                    <Ionicons name="close" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalBody}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Status card */}
                  <View style={styles.modalStatusCard}>
                    <View>
                      <Text style={styles.modalSectionLabel}>
                        {t('parentAttendance.detailModal.status')}
                      </Text>
                      <Text
                        style={[
                          styles.modalStatusValue,
                          { color: getStatusStyle(selectedRecord.status).text },
                        ]}
                      >
                        {selectedRecord.status ||
                          t('parentAttendance.detailModal.unknown')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.modalSectionLabel}>
                        {t('parentAttendance.detailModal.hours')}
                      </Text>
                      <Text style={styles.modalHoursValue}>
                        {selectedRecord.hours ?? '--'}
                      </Text>
                    </View>
                  </View>

                  {/* Check-in / Check-out */}
                  <View style={styles.modalGrid}>
                    <View style={styles.modalGridItem}>
                      <Text style={styles.modalSectionLabel}>
                        {t('parentAttendance.detailModal.checkIn')}
                      </Text>
                      <Text style={styles.modalGridValue}>
                        {selectedRecord.checkIn || '--'}
                      </Text>
                    </View>
                    <View style={styles.modalGridItem}>
                      <Text style={styles.modalSectionLabel}>
                        {t('parentAttendance.detailModal.checkOut')}
                      </Text>
                      <Text style={styles.modalGridValue}>
                        {selectedRecord.checkOut || '--'}
                      </Text>
                    </View>
                  </View>

                  {/* Session info */}
                  {selectedRecord.slotName && (
                    <View style={styles.modalSessionBox}>
                      <Text style={styles.modalSessionLabel}>
                        {t('parentAttendance.detailModal.session')}
                      </Text>
                      <Text style={styles.modalSessionValue}>
                        {selectedRecord.slotName}
                        {selectedRecord.slotNumber ? (
                          <Text style={styles.modalSessionNumber}>
                            {' '}
                            ({t('parentAttendance.detailModal.sessionNumber')} #
                            {selectedRecord.slotNumber})
                          </Text>
                        ) : null}
                      </Text>
                    </View>
                  )}

                  {/* Remarks */}
                  {(selectedRecord.remarks || selectedRecord.comment) && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionLabel}>
                        {t('parentAttendance.detailModal.teachersNote')}
                      </Text>
                      <Text style={styles.modalRemarks}>
                        "{selectedRecord.remarks || selectedRecord.comment}"
                      </Text>
                    </View>
                  )}

                  {/* Teacher */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionLabel}>
                      {t('parentAttendance.detailModal.teacher')}
                    </Text>
                    <Text style={styles.modalGridValue}>{getTeacherName()}</Text>
                  </View>

                  <View style={{ height: 20 }} />
                </ScrollView>

                <TouchableOpacity
                  style={styles.modalCloseFullBtn}
                  onPress={() => setSelectedRecord(null)}
                >
                  <Text style={styles.modalCloseFullBtnText}>
                    {t('parentAttendance.detailModal.closeRecord')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ============================================================
// SUB-COMPONENTS
// ============================================================
const MiniStat: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => (
  <View style={styles.miniStat}>
    <View style={[styles.miniStatDot, { backgroundColor: color }]} />
    <Text style={styles.miniStatLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={styles.miniStatValue}>{value}</Text>
  </View>
);

const StatMini: React.FC<{ label: string; value: string; color: string }> = ({
  label,
  value,
  color,
}) => (
  <View style={styles.statMini}>
    <Text style={styles.statMiniLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={[styles.statMiniValue, { color }]} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

export default ParentAttendanceScreen;

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 24 },

  // LOADING / EMPTY
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.slateMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.slate,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.slateMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  emptyHint: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 12,
  },
  emptyBtn: {
    marginTop: 20,
    backgroundColor: COLORS.blue,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // HEADER
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
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
  headerBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 2,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // CHILD CHIPS
  childChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  childChipActive: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },
  childChipText: { fontSize: 12, fontWeight: '700', color: COLORS.slateMuted },
  childChipTextActive: { color: '#fff' },

  // IDENTITY CARD
  identityCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  identityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  identityAvatar: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: COLORS.slate,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityAvatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  identityName: { fontSize: 17, fontWeight: '800', color: COLORS.slate },
  identityType: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.gray,
    backgroundColor: COLORS.grayLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  identityMeta: { fontSize: 12, color: COLORS.slateMuted, marginTop: 6 },
  identityReg: { fontSize: 11, color: COLORS.gray, marginTop: 2 },

  // STATS ROW
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statItem: {
    width: '33.33%',
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: {
    fontSize: 9,
    color: COLORS.gray,
    fontWeight: '600',
    textAlign: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 4,
  },

  // OVERVIEW DARK BLOCK
  overviewBlock: {
    backgroundColor: COLORS.slate,
    padding: 16,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  overviewLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  overviewValue: { fontSize: 26, fontWeight: '800', color: '#fff' },
  overviewSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  overviewHint: { fontSize: 10, color: '#64748B', marginTop: 4 },
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 8,
    borderColor: 'rgba(255,255,255,0.15)',
    borderTopColor: '#60A5FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // OVERVIEW MINI STATS
  overviewMiniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 6,
  },
  miniStat: { flex: 1, alignItems: 'center' },
  miniStatDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
  miniStatLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '700',
    textAlign: 'center',
  },
  miniStatValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
  },

  // MONTH NAV
  monthNavBox: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  sectionBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.blue,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  monthNavTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.slate,
    textAlign: 'center',
  },
  todayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.blueLight,
  },
  todayBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.blue,
  },
  monthMetaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  monthMetaText: { fontSize: 11, color: COLORS.gray, fontWeight: '600' },
  monthMetaDivider: { fontSize: 11, color: COLORS.border },

  // MONTH STATS
  monthStatsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    marginBottom: 12,
  },
  statMini: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  statMiniLabel: {
    fontSize: 9,
    color: COLORS.gray,
    fontWeight: '700',
    textAlign: 'center',
  },
  statMiniValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },

  // TABLE
  tableWrap: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
  },
  tableHeaderCell: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
  },
  tableHeaderSub: {
    fontSize: 9,
    fontWeight: '500',
    color: COLORS.gray,
    textTransform: 'none',
  },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRowToday: { backgroundColor: 'rgba(59,130,246,0.08)' },
  tableDate: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.slate,
    paddingHorizontal: 8,
  },
  tableDay: {
    fontSize: 10,
    color: COLORS.gray,
    paddingHorizontal: 8,
    marginTop: 2,
  },
  tableSessionCell: {
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 10.5, fontWeight: '800' },
  tableCheckIn: {
    fontSize: 9,
    color: COLORS.gray,
    marginTop: 3,
  },
  dayPctBar: {
    height: 4,
    width: 44,
    borderRadius: 2,
    backgroundColor: COLORS.grayLight,
    overflow: 'hidden',
    marginBottom: 4,
  },
  dayPctFill: { height: '100%', borderRadius: 2 },
  dayPctText: { fontSize: 10.5, fontWeight: '800' },

  // MINI LOADER / EMPTY
  miniLoaderWrap: { alignItems: 'center', paddingVertical: 30 },
  miniLoaderText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.slateMuted,
    fontWeight: '600',
  },
  emptyListWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyListTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.slateMuted,
    marginTop: 12,
  },
  emptyListHint: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
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
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: COLORS.slate,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 10,
  },
  modalBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  modalStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  modalStatusText: { fontSize: 12, fontWeight: '800' },
  modalSlotTag: {
    backgroundColor: 'rgba(96,165,250,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  modalSlotTagText: { fontSize: 10, color: '#93C5FD', fontWeight: '800' },
  modalSub: { fontSize: 12, color: '#94A3B8', marginTop: 6 },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { paddingHorizontal: 20, paddingTop: 14 },

  modalSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalStatusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 16,
    borderRadius: 16,
  },
  modalStatusValue: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
  },
  modalHoursValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 4,
  },

  modalGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modalGridItem: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
  },
  modalGridValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate,
    marginTop: 4,
  },

  modalSessionBox: {
    backgroundColor: COLORS.indigoLight,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
  modalSessionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.indigo,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalSessionValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#3730A3',
    marginTop: 4,
  },
  modalSessionNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#818CF8',
  },

  modalSection: {
    backgroundColor: COLORS.background,
    padding: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  modalRemarks: {
    fontSize: 13,
    color: COLORS.slateMuted,
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 19,
  },

  modalCloseFullBtn: {
    margin: 20,
    backgroundColor: COLORS.slate,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalCloseFullBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});