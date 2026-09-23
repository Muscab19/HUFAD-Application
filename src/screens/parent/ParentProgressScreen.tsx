// src/screens/parent/ParentProgressScreen.tsx
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
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { api as apiClient } from '../../api/client';

const { width } = Dimensions.get('window');

// ============================================================
// COLORS
// ============================================================
const COLORS = {
  primary: '#0A8E5A',
  primaryDark: '#063D2C',
  primaryLight: '#E9F8F0',
  blue: '#2878D0',
  blueLight: '#EAF3FF',
  purple: '#7C3AED',
  purpleLight: '#F3EFFF',
  indigo: '#4338CA',
  indigoLight: '#E0E7FF',
  pink: '#DB2777',
  pinkLight: '#FCE7F3',
  yellow: '#CA8A04',
  yellowLight: '#FEF9C3',
  green: '#16A34A',
  greenLight: '#DCFCE7',
  gray: '#64748B',
  grayLight: '#F1F5F9',
  red: '#DC2626',
  redLight: '#FEE2E2',
  amber: '#D97706',
  amberLight: '#FEF3C7',
  white: '#FFFFFF',
  slate: '#18392D',
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

interface Achievement {
  _id: string;
  id?: string;
  studentId?: string;
  type: string;
  date: string;
  score?: number;
  attempt?: number;
  comment?: string;
  teacher?: string;
  leader?: boolean;
  cycle?: number;
  rangeType?: 'surah' | 'juz' | 'page';
  fromSurah?: number;
  fromSurahName?: string;
  fromSurahArabic?: string;
  fromAyah?: number;
  toSurah?: number;
  toSurahName?: string;
  toSurahArabic?: string;
  toAyah?: number;
  fromJuz?: number;
  toJuz?: number;
  fromQuarter?: number;
  toQuarter?: number;
  fromPage?: number;
  toPage?: number;
  bookName?: string;
  bookType?: string;
  fromBookPage?: number;
  toBookPage?: number;
  fathi?: number[];
  lahni?: number[];
  tajwid?: number[];
  ada?: number[];
}

interface ProgressData {
  juzCompleted?: number;
  pagesMemorized?: number;
  daysActive?: number;
  averageScore?: number;
  memorizationPercentage?: number;
  teacherRemarks?: string;
  currentPosition?: {
    type?: 'surah' | 'juz';
    surahPosition?: number;
    surahName?: string;
    surahArabic?: string;
    juzPosition?: number;
  };
}

// ============================================================
// HELPERS
// ============================================================
const getTypeIcon = (type: string): keyof typeof Ionicons.glyphMap => {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    memorization: 'book-outline',
    major_review: 'locate-outline',
    minor_review: 'star-outline',
    subac: 'people-outline',
    ijazah: 'ribbon-outline',
    book_review: 'library-outline',
  };
  return icons[type] || 'book-outline';
};

const getTypeBadge = (type: string) => {
  const map: Record<string, { bg: string; text: string; color: string }> = {
    memorization: { bg: COLORS.blueLight, text: '#1D4ED8', color: COLORS.blue },
    major_review: { bg: COLORS.purpleLight, text: '#6D28D9', color: COLORS.purple },
    minor_review: { bg: COLORS.greenLight, text: '#15803D', color: COLORS.green },
    subac: { bg: COLORS.indigoLight, text: '#4338CA', color: COLORS.indigo },
    ijazah: { bg: COLORS.yellowLight, text: '#A16207', color: COLORS.yellow },
    book_review: { bg: COLORS.pinkLight, text: '#BE185D', color: COLORS.pink },
  };
  return (
    map[type] || { bg: COLORS.grayLight, text: COLORS.gray, color: COLORS.gray }
  );
};

const scoreStyle = (score?: number) => {
  if (!score || score < 0) return { bg: COLORS.grayLight, text: COLORS.gray };
  if (score >= 9) return { bg: '#ECFDF5', text: '#047857' };
  if (score >= 8) return { bg: '#EFF6FF', text: '#1D4ED8' };
  if (score >= 6) return { bg: '#FFFBEB', text: '#B45309' };
  return { bg: '#FEF2F2', text: '#B91C1C' };
};

const getMonthName = (month: number, language: string) => {
  const monthNames: Record<string, string[]> = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    so: ['Janaayo', 'Febraayo', 'Maarso', 'Abriil', 'Maayo', 'Juunyo', 'Luulyo', 'Agosto', 'Sebtembar', 'Oktoobar', 'Nofembar', 'Desembar'],
  };
  return monthNames[language]?.[month - 1] || monthNames.en[month - 1];
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

const getRangeDisplay = (record: Achievement, t: (k: string) => string): string => {
  if (!record) return t('parentProgress.range.na');

  if (record.type === 'book_review') {
    const book = record.bookName || t('parentProgress.range.bookReview');
    if (record.fromBookPage && record.toBookPage) {
      return `${book} • ${t('parentProgress.range.pages')} ${record.fromBookPage}–${record.toBookPage}`;
    }
    return book;
  }

  if (record.rangeType === 'surah') {
    const from = record.fromSurahName || `${t('parentProgress.range.surah')} ${record.fromSurah}`;
    const to = record.toSurahName || `${t('parentProgress.range.surah')} ${record.toSurah}`;
    const fromAr = record.fromSurahArabic ? ` (${record.fromSurahArabic})` : '';
    const toAr = record.toSurahArabic ? ` (${record.toSurahArabic})` : '';
    if (record.fromSurah === record.toSurah) {
      return `${from}${fromAr} • ${t('parentProgress.range.ayah')} ${record.fromAyah}–${record.toAyah}`;
    }
    return `${from}${fromAr}:${record.fromAyah} → ${to}${toAr}:${record.toAyah}`;
  }

  if (record.rangeType === 'juz') {
    return `${t('parentProgress.range.juz')} ${record.fromJuz} • ${t('parentProgress.range.quarter')} ${record.fromQuarter}/8 → ${record.toQuarter}/8`;
  }

  if (record.rangeType === 'page') {
    return `${t('parentProgress.range.pages')} ${record.fromPage}–${record.toPage}`;
  }

  return record.type || t('parentProgress.range.record');
};

// ============================================================
// SCREEN
// ============================================================
export const ParentProgressScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<any>();
  const currentLanguage = i18n.language;

  // State
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<Achievement | null>(null);
  const [filter, setFilter] = useState('all');
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [monthRecords, setMonthRecords] = useState<Achievement[]>([]);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(false);

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
      setError(err?.message || t('parentProgress.errors.fetchChildren'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  // ============================================================
  // FETCH PROGRESS DATA
  // ============================================================
  const fetchProgressData = useCallback(async () => {
    if (!selectedChildId) return;
    try {
      const res: any = await apiClient.get(
        `/parent/child/${selectedChildId}/progress`
      );
      setProgressData(res || null);
    } catch (err) {
      console.error('Fetch progress error:', err);
    }
  }, [selectedChildId]);

  // ============================================================
  // FETCH MONTH RECORDS
  // ============================================================
  const fetchMonthRecords = useCallback(async () => {
    if (!selectedChildId) return;
    try {
      setLoadingRecords(true);
      const startDate = `${viewYear}-${String(viewMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(viewYear, viewMonth, 0).getDate();
      const endDate = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const res: any = await apiClient.get(
        `/parent/child/${selectedChildId}/achievements`,
        { startDate, endDate, limit: 100 }
      );
      const list = res?.achievements || res?.data || (Array.isArray(res) ? res : []);
      setMonthRecords(list);
    } catch (err) {
      console.error('Fetch month records error:', err);
      setMonthRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, [selectedChildId, viewMonth, viewYear]);

  useEffect(() => {
    if (selectedChildId) {
      fetchProgressData();
      fetchMonthRecords();
    }
  }, [selectedChildId, viewMonth, viewYear, fetchProgressData, fetchMonthRecords]);

  // ============================================================
  // TODAY'S RECORDS
  // ============================================================
  const todayRecords = useMemo(() => {
    return monthRecords.filter((r) => {
      const d = r.date ? new Date(r.date).toISOString().split('T')[0] : '';
      return d === todayStr;
    });
  }, [monthRecords, todayStr]);

  // ============================================================
  // FILTERED RECORDS
  // ============================================================
  const filteredRecords = useMemo(() => {
    if (filter === 'all') return monthRecords;
    return monthRecords.filter((r) => r.type === filter);
  }, [monthRecords, filter]);

  // ============================================================
  // GROUPED BY DATE
  // ============================================================
  const groupedByDate = useMemo(() => {
    const grouped: Record<string, Achievement[]> = {};
    filteredRecords.forEach((r) => {
      const dateStr = r.date
        ? new Date(r.date).toISOString().split('T')[0]
        : '';
      if (dateStr) {
        if (!grouped[dateStr]) grouped[dateStr] = [];
        grouped[dateStr].push(r);
      }
    });
    return grouped;
  }, [filteredRecords]);

  const sortedDates = useMemo(
    () =>
      Object.keys(groupedByDate).sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime()
      ),
    [groupedByDate]
  );

  // ============================================================
  // MONTH DAYS
  // ============================================================
  const monthDays = useMemo(() => {
    const days: { date: string; day: number; records: Achievement[] }[] = [];
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        date: dateStr,
        day: d,
        records: groupedByDate[dateStr] || [],
      });
    }
    return days;
  }, [viewYear, viewMonth, groupedByDate]);

  // ============================================================
  // NAVIGATE MONTH
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

  const handleChildSelect = (child: Child) => {
    setSelectedChildId(child._id);
    setSelectedChild(child);
    setFilter('all');
  };

  // ============================================================
  // LOADING / NO CHILDREN
  // ============================================================
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('parentProgress.loading')}</Text>
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
            {t('parentProgress.noChildren.title')}
          </Text>
          <Text style={styles.emptyText}>
            {t('parentProgress.noChildren.message')}
          </Text>
          <Text style={styles.emptyHint}>
            {t('parentProgress.noChildren.contactAdmin')}
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.emptyBtnText}>
              {t('parentProgress.noChildren.goDashboard')}
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
            {t('parentProgress.header.badge')}
          </Text>
          <Text style={styles.headerTitle}>
            {t('parentProgress.header.title')}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => {
            fetchProgressData();
            fetchMonthRecords();
          }}
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
            onRefresh={() => {
              fetchProgressData();
              fetchMonthRecords();
            }}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
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
                  onPress={() => handleChildSelect(child)}
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

        {/* STUDENT IDENTITY CARD */}
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
                  {selectedChild.studentType || t('parentProgress.student')}
                </Text>
                <Text style={styles.identityMeta} numberOfLines={1}>
                  {selectedChild.halaqah || t('parentProgress.notAssigned')}{' '}
                  {t('parentProgress.halaqah')} •{' '}
                  {selectedChild.teacher || t('parentProgress.noTeacher')}
                </Text>
                <Text style={styles.identityReg}>
                  {t('parentProgress.registration')}:{' '}
                  {selectedChild.regNo || t('parentProgress.na')}
                </Text>
              </View>
            </View>

            {/* Mini stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {t('parentProgress.stats.juzCompleted')}
                </Text>
                <Text style={styles.statValue}>
                  {progressData?.juzCompleted || 0}
                  <Text style={styles.statValueTotal}>/30</Text>
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {t('parentProgress.stats.pages')}
                </Text>
                <Text style={styles.statValue}>
                  {progressData?.pagesMemorized || 0}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {t('parentProgress.stats.activeDays')}
                </Text>
                <Text style={styles.statValue}>
                  {progressData?.daysActive || 0}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {t('parentProgress.stats.avgScore')}
                </Text>
                <Text style={styles.statValue}>
                  {progressData?.averageScore || 0}
                  <Text style={styles.statValueTotal}>/10</Text>
                </Text>
              </View>
            </View>

            {/* Current position dark block */}
            <View style={styles.currentPosition}>
              <View style={styles.currentPositionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.currentPositionLabel}>
                    {t('parentProgress.currentPosition.title')}
                  </Text>
                  {progressData?.currentPosition?.type === 'surah' ? (
                    <>
                      <Text style={styles.currentPositionValue}>
                        {t('parentProgress.currentPosition.surah')}{' '}
                        {progressData.currentPosition.surahPosition || '?'}
                      </Text>
                      {progressData.currentPosition.surahName && (
                        <Text style={styles.currentPositionSub}>
                          {progressData.currentPosition.surahName}
                          {progressData.currentPosition.surahArabic
                            ? ` (${progressData.currentPosition.surahArabic})`
                            : ''}
                        </Text>
                      )}
                    </>
                  ) : progressData?.currentPosition?.type === 'juz' ? (
                    <>
                      <Text style={styles.currentPositionValue}>
                        {t('parentProgress.currentPosition.juz')}{' '}
                        {progressData.currentPosition.juzPosition || '?'}
                      </Text>
                      <Text style={styles.currentPositionSub}>
                        {t('parentProgress.currentPosition.fromEnd')}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.currentPositionValue}>
                        {t('parentProgress.currentPosition.notStarted')}
                      </Text>
                      <Text style={styles.currentPositionSub}>
                        {t('parentProgress.currentPosition.currentlyMemorizing')}
                      </Text>
                    </>
                  )}
                </View>
                <View style={styles.progressCircle}>
                  <Text style={styles.progressCircleValue}>
                    {progressData?.memorizationPercentage || 0}%
                  </Text>
                  <Text style={styles.progressCircleLabel}>
                    {t('parentProgress.currentPosition.complete')}
                  </Text>
                </View>
              </View>

              <View style={styles.progressBarWrap}>
                <View style={styles.progressBarHeader}>
                  <Text style={styles.progressBarLabel}>
                    {t('parentProgress.currentPosition.quranCompletion')}
                  </Text>
                  <Text style={styles.progressBarValue}>
                    {progressData?.memorizationPercentage || 0}%
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(100, progressData?.memorizationPercentage || 0)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* TODAY'S ACHIEVEMENTS */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionBadge}>
                {t('parentProgress.todayAchievements.title')}
              </Text>
              <Text style={styles.sectionDate}>
                {formatFullDate(todayStr, currentLanguage)}
              </Text>
            </View>
            <View style={styles.todayCountBadge}>
              <Text style={styles.todayCountText}>
                {todayRecords.length}{' '}
                {todayRecords.length === 1
                  ? t('parentProgress.todayAchievements.record')
                  : t('parentProgress.todayAchievements.records')}
              </Text>
            </View>
          </View>

          {loadingRecords ? (
            <View style={styles.miniLoaderWrap}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.miniLoaderText}>
                {t('parentProgress.loadingRecords')}
              </Text>
            </View>
          ) : todayRecords.length === 0 ? (
            <View style={styles.emptyTodayWrap}>
              <Ionicons name="book-outline" size={36} color={COLORS.gray} />
              <Text style={styles.emptyTodayTitle}>
                {t('parentProgress.todayAchievements.noRecords')}
              </Text>
              <Text style={styles.emptyTodayHint}>
                {t('parentProgress.todayAchievements.checkLater')}
              </Text>
            </View>
          ) : (
            todayRecords.map((record) => (
              <TodayRecordCard
                key={record._id || record.id}
                record={record}
                onPress={() => setSelectedRecord(record)}
              />
            ))
          )}
        </View>

        {/* MONTH NAVIGATOR */}
        <View style={styles.monthNavBox}>
          <Text style={styles.sectionBadge}>
            {t('parentProgress.monthlyProgress.title')}
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
                {t('parentProgress.monthlyProgress.today')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Type filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, marginTop: 10 }}
          >
            <FilterChip
              label={t('parentProgress.monthlyProgress.allTypes')}
              active={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            {[
              'memorization',
              'major_review',
              'minor_review',
              'subac',
              'ijazah',
              'book_review',
            ].map((tp) => (
              <FilterChip
                key={tp}
                label={t(`parentProgress.types.${tp === 'major_review' ? 'majorReview' : tp === 'minor_review' ? 'minorReview' : tp === 'book_review' ? 'bookReview' : tp}`)}
                active={filter === tp}
                onPress={() => setFilter(tp)}
              />
            ))}
          </ScrollView>
        </View>

        {/* MONTHLY STATS SUMMARY */}
        <View style={styles.monthStatsRow}>
          <StatMini
            label={t('parentProgress.monthlyStats.totalRecords')}
            value={String(filteredRecords.length)}
            color={COLORS.slate}
          />
          <StatMini
            label={t('parentProgress.monthlyStats.activeDays')}
            value={String(sortedDates.length)}
            color={COLORS.green}
          />
          <StatMini
            label={t('parentProgress.monthlyStats.averageScore')}
            value={
              filteredRecords.length > 0
                ? `${Math.round(
                    (filteredRecords.reduce((s, r) => s + (r.score || 0), 0) /
                      filteredRecords.length) *
                      10
                  ) / 10}/10`
                : '0/10'
            }
            color={COLORS.blue}
          />
          <StatMini
            label={t('parentProgress.monthlyStats.completion')}
            value={`${Math.round(
              (sortedDates.length /
                new Date(viewYear, viewMonth, 0).getDate()) *
                100
            )}%`}
            color={COLORS.purple}
          />
        </View>

        {/* DAILY LIST */}
        {loadingRecords ? (
          <View style={styles.miniLoaderWrap}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.miniLoaderText}>
              {t('parentProgress.loadingRecords')}
            </Text>
          </View>
        ) : (
          monthDays.map((day) => (
            <DayBlock
              key={day.date}
              day={day}
              isToday={isToday(day.date)}
              onPressRecord={(r) => setSelectedRecord(r)}
              currentLanguage={currentLanguage}
            />
          ))
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
                      {t('parentProgress.detailModal.learningRecord')}
                    </Text>
                    <View style={styles.modalTitleRow}>
                      <View
                        style={[
                          styles.modalTypeBadge,
                          { backgroundColor: getTypeBadge(selectedRecord.type).bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.modalTypeText,
                            { color: getTypeBadge(selectedRecord.type).text },
                          ]}
                        >
                          {t(
                            `parentProgress.types.${
                              selectedRecord.type === 'major_review'
                                ? 'majorReview'
                                : selectedRecord.type === 'minor_review'
                                ? 'minorReview'
                                : selectedRecord.type === 'book_review'
                                ? 'bookReview'
                                : selectedRecord.type
                            }`
                          )}
                        </Text>
                      </View>
                      {selectedRecord.leader && (
                        <View style={styles.leaderTag}>
                          <Ionicons name="star" size={11} color="#F59E0B" />
                          <Text style={styles.leaderTagText}>
                            {t('parentProgress.leader')}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.modalSub}>
                      {selectedRecord.date
                        ? formatFullDate(selectedRecord.date, currentLanguage)
                        : t('parentProgress.detailModal.dateNotAvailable')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setSelectedRecord(null)}
                  >
                    <Ionicons name="close" size={22} color={COLORS.slate} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalBody}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Score */}
                  <View style={styles.modalScoreCard}>
                    <View>
                      <Text style={styles.modalScoreLabel}>
                        {t('parentProgress.detailModal.assessmentScore')}
                      </Text>
                      <Text style={styles.modalScoreValue}>
                        {selectedRecord.score || 0}
                        <Text style={styles.modalScoreTotal}>/10</Text>
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.modalScoreLabel}>
                        {t('parentProgress.detailModal.attempt')}
                      </Text>
                      <Text style={styles.modalScoreAttempt}>
                        #{selectedRecord.attempt || 1}
                      </Text>
                    </View>
                  </View>

                  {/* Range */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionLabel}>
                      {t('parentProgress.detailModal.range')}
                    </Text>
                    <Text style={styles.modalSectionValue}>
                      {getRangeDisplay(selectedRecord, t)}
                    </Text>
                  </View>

                  {/* Details Grid */}
                  <View style={styles.modalGrid}>
                    <View style={styles.modalGridItem}>
                      <Text style={styles.modalSectionLabel}>
                        {t('parentProgress.detailModal.recordType')}
                      </Text>
                      <Text style={styles.modalGridValue}>
                        {t(
                          `parentProgress.types.${
                            selectedRecord.type === 'major_review'
                              ? 'majorReview'
                              : selectedRecord.type === 'minor_review'
                              ? 'minorReview'
                              : selectedRecord.type === 'book_review'
                              ? 'bookReview'
                              : selectedRecord.type
                          }`
                        )}
                      </Text>
                    </View>
                    <View style={styles.modalGridItem}>
                      <Text style={styles.modalSectionLabel}>
                        {t('parentProgress.detailModal.teacher')}
                      </Text>
                      <Text style={styles.modalGridValue} numberOfLines={1}>
                        {selectedRecord.teacher ||
                          selectedChild?.teacher ||
                          t('parentProgress.notAssigned')}
                      </Text>
                    </View>
                  </View>

                  {/* Subac Assessment */}
                  {selectedRecord.type === 'subac' && (
                    <View style={styles.subacBox}>
                      <Text style={styles.subacBoxTitle}>
                        {t('parentProgress.detailModal.subacAssessment')}
                      </Text>
                      <View style={styles.subacRow}>
                        {[
                          [
                            t('parentProgress.detailModal.fathi'),
                            selectedRecord.fathi?.length || 0,
                          ],
                          [
                            t('parentProgress.detailModal.lahni'),
                            selectedRecord.lahni?.length || 0,
                          ],
                          [
                            t('parentProgress.detailModal.tajwid'),
                            selectedRecord.tajwid?.length || 0,
                          ],
                          [
                            t('parentProgress.detailModal.ada'),
                            selectedRecord.ada?.length || 0,
                          ],
                        ].map(([label, value]) => (
                          <View key={String(label)} style={styles.subacTile}>
                            <Text style={styles.subacTileLabel}>{label}</Text>
                            <Text
                              style={[
                                styles.subacTileValue,
                                value === 0
                                  ? { color: COLORS.green }
                                  : { color: COLORS.amber },
                              ]}
                            >
                              {value === 0 ? '✓' : String(value)}
                            </Text>
                          </View>
                        ))}
                      </View>
                      {selectedRecord.cycle && (
                        <Text style={styles.subacCycleText}>
                          {t('parentProgress.detailModal.cycle')}{' '}
                          {selectedRecord.cycle}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Comment */}
                  {selectedRecord.comment && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionLabel}>
                        {t('parentProgress.detailModal.teachersNote')}
                      </Text>
                      <Text style={styles.modalComment}>
                        "{selectedRecord.comment}"
                      </Text>
                    </View>
                  )}

                  <View style={{ height: 20 }} />
                </ScrollView>

                <TouchableOpacity
                  style={styles.modalCloseFullBtn}
                  onPress={() => setSelectedRecord(null)}
                >
                  <Text style={styles.modalCloseFullBtnText}>
                    {t('parentProgress.detailModal.closeRecord')}
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
const FilterChip: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
}> = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.filterChip, active && styles.filterChipActive]}
    onPress={onPress}
  >
    <Text
      style={[styles.filterChipText, active && styles.filterChipTextActive]}
      numberOfLines={1}
    >
      {label}
    </Text>
  </TouchableOpacity>
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

const TodayRecordCard: React.FC<{
  record: Achievement;
  onPress: () => void;
}> = ({ record, onPress }) => {
  const { t } = useTranslation();
  const badge = getTypeBadge(record.type);
  const score = scoreStyle(record.score);
  const typeKey =
    record.type === 'major_review'
      ? 'majorReview'
      : record.type === 'minor_review'
      ? 'minorReview'
      : record.type === 'book_review'
      ? 'bookReview'
      : record.type;

  return (
    <TouchableOpacity style={styles.todayCard} onPress={onPress}>
      <View style={styles.todayCardHeader}>
        <View style={[styles.todayIconBox, { backgroundColor: badge.bg }]}>
          <Ionicons name={getTypeIcon(record.type)} size={18} color={badge.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={[styles.typePill, { backgroundColor: badge.bg }]}>
            <Text style={[styles.typePillText, { color: badge.text }]}>
              {t(`parentProgress.types.${typeKey}`)}
            </Text>
          </View>
          <Text style={styles.todayRange} numberOfLines={1}>
            {getRangeDisplay(record, t)}
          </Text>
        </View>
        <View style={[styles.scorePill, { backgroundColor: score.bg }]}>
          <Text style={[styles.scorePillText, { color: score.text }]}>
            {record.score}/10
          </Text>
        </View>
      </View>

      {record.comment ? (
        <Text style={styles.todayComment} numberOfLines={2}>
          "{record.comment}"
        </Text>
      ) : null}

      <View style={styles.todayMeta}>
        <View style={styles.todayMetaItem}>
          <Ionicons name="time-outline" size={11} color={COLORS.gray} />
          <Text style={styles.todayMetaText}>
            {t('parentProgress.attempt')} {record.attempt || 1}
          </Text>
        </View>
        {record.leader && (
          <View style={[styles.todayMetaItem, { backgroundColor: COLORS.amberLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }]}>
            <Ionicons name="star" size={11} color={COLORS.amber} />
            <Text style={[styles.todayMetaText, { color: COLORS.amber }]}>
              {t('parentProgress.leader')}
            </Text>
          </View>
        )}
        {record.type === 'subac' && record.cycle && (
          <View style={styles.todayMetaItem}>
            <Text style={styles.todayMetaText}>
              {t('parentProgress.cycle')} {record.cycle}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

interface DayBlockProps {
  day: { date: string; day: number; records: Achievement[] };
  isToday: boolean;
  onPressRecord: (r: Achievement) => void;
  currentLanguage: string;
}

const DayBlock: React.FC<DayBlockProps> = ({
  day,
  isToday,
  onPressRecord,
  currentLanguage,
}) => {
  const { t } = useTranslation();
  const dateObj = new Date(day.date);
  const dayOfWeek = dateObj.toLocaleDateString(
    currentLanguage === 'ar' ? 'ar-EG' : currentLanguage === 'so' ? 'so-SO' : 'en-US',
    { weekday: 'short' }
  );
  const hasRecords = day.records.length > 0;

  return (
    <View
      style={[
        styles.dayBlock,
        isToday && styles.dayBlockToday,
        !hasRecords && styles.dayBlockEmpty,
      ]}
    >
      <View style={styles.dayHeader}>
        <View style={styles.dayHeaderLeft}>
          <Text
            style={[
              styles.dayDate,
              !hasRecords && styles.dayDateEmpty,
            ]}
          >
            {formatShortDate(day.date, currentLanguage)}
          </Text>
          <Text style={styles.dayOfWeek}>{dayOfWeek}</Text>
          {isToday && (
            <View style={styles.todayPill}>
              <Text style={styles.todayPillText}>
                {t('parentProgress.today')}
              </Text>
            </View>
          )}
          <Text
            style={[
              styles.dayRecordCount,
              !hasRecords && styles.dayRecordCountEmpty,
            ]}
          >
            {hasRecords
              ? `${day.records.length} ${
                  day.records.length === 1
                    ? t('parentProgress.record')
                    : t('parentProgress.records')
                }`
              : t('parentProgress.noRecord')}
          </Text>
        </View>
        {hasRecords && (
          <Text style={styles.dayAvg}>
            {t('parentProgress.avg')}:{' '}
            {Math.round(
              (day.records.reduce((s, r) => s + (r.score || 0), 0) /
                day.records.length) *
                10
            ) / 10}
            /10
          </Text>
        )}
      </View>

      {hasRecords ? (
        day.records.map((record) => {
          const badge = getTypeBadge(record.type);
          const score = scoreStyle(record.score);
          const typeKey =
            record.type === 'major_review'
              ? 'majorReview'
              : record.type === 'minor_review'
              ? 'minorReview'
              : record.type === 'book_review'
              ? 'bookReview'
              : record.type;

          return (
            <TouchableOpacity
              key={record._id || record.id}
              style={styles.dayRecordRow}
              onPress={() => onPressRecord(record)}
            >
              <View style={styles.dayRecordIcon}>
                <Ionicons
                  name={getTypeIcon(record.type)}
                  size={16}
                  color={COLORS.gray}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.dayRecordTop}>
                  <View style={[styles.typePill, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.typePillText, { color: badge.text }]}>
                      {t(`parentProgress.types.${typeKey}`)}
                    </Text>
                  </View>
                  <Text style={styles.dayRecordAttempt}>
                    {t('parentProgress.attempt')} {record.attempt || 1}
                  </Text>
                  {record.leader && (
                    <View style={styles.leaderMini}>
                      <Ionicons name="star" size={10} color={COLORS.amber} />
                      <Text style={styles.leaderMiniText}>
                        {t('parentProgress.leader')}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.dayRecordRange} numberOfLines={1}>
                  {getRangeDisplay(record, t)}
                </Text>
                {record.comment ? (
                  <Text style={styles.dayRecordComment} numberOfLines={1}>
                    "{record.comment}"
                  </Text>
                ) : null}
              </View>
              <View style={[styles.scorePill, { backgroundColor: score.bg }]}>
                <Text style={[styles.scorePillText, { color: score.text }]}>
                  {record.score}/10
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={COLORS.gray}
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={styles.emptyDayRow}>
          <Ionicons name="book-outline" size={14} color={COLORS.gray} />
          <Text style={styles.emptyDayText}>
            {t('parentProgress.noRecordForDay')}
          </Text>
        </View>
      )}
    </View>
  );
};

export default ParentProgressScreen;

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
    backgroundColor: COLORS.purple,
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
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purple,
  },
  childChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },
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
  identityAvatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  identityName: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.slate,
  },
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
  identityMeta: {
    fontSize: 12,
    color: COLORS.slateMuted,
    marginTop: 6,
  },
  identityReg: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 2,
  },

  // STATS
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statItem: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  statLabel: {
    fontSize: 9.5,
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
  statValueTotal: { fontSize: 11, color: COLORS.gray, fontWeight: '600' },

  // CURRENT POSITION DARK BLOCK
  currentPosition: {
    backgroundColor: COLORS.slate,
    padding: 16,
  },
  currentPositionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentPositionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  currentPositionValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  currentPositionSub: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
  },
  progressCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 6,
    borderColor: 'rgba(255,255,255,0.2)',
    borderTopColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  progressCircleLabel: {
    fontSize: 8,
    color: '#94A3B8',
    marginTop: 1,
  },
  progressBarWrap: { marginTop: 14 },
  progressBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressBarLabel: { fontSize: 11, color: '#94A3B8' },
  progressBarValue: { fontSize: 11, color: '#fff', fontWeight: '700' },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },

  // SECTION
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 14,
  },
  sectionHeaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.purple,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionDate: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 4,
  },
  todayCountBadge: {
    backgroundColor: COLORS.purple,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  todayCountText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // TODAY RECORD CARD
  todayCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    backgroundColor: COLORS.white,
  },
  todayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  todayIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typePillText: { fontSize: 10, fontWeight: '800' },
  todayRange: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate,
    marginTop: 4,
  },
  scorePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  scorePillText: { fontSize: 13, fontWeight: '800' },
  todayComment: {
    fontSize: 12,
    color: COLORS.slateMuted,
    fontStyle: 'italic',
    marginTop: 8,
  },
  todayMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  todayMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  todayMetaText: { fontSize: 11, color: COLORS.gray, fontWeight: '600' },

  emptyTodayWrap: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTodayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slateMuted,
    marginTop: 8,
  },
  emptyTodayHint: {
    fontSize: 12,
    color: COLORS.gray,
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
    backgroundColor: COLORS.purpleLight,
  },
  todayBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.purple,
  },

  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purple,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },
  filterChipTextActive: { color: '#fff' },

  // MONTH STATS
  monthStatsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    marginBottom: 12,
  },
  statMini: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statMiniLabel: {
    fontSize: 9,
    color: COLORS.gray,
    fontWeight: '700',
    textAlign: 'center',
  },
  statMiniValue: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },

  // DAY BLOCK
  dayBlock: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  dayBlockToday: {
    borderColor: COLORS.purple,
    borderWidth: 1.5,
  },
  dayBlockEmpty: { opacity: 0.75 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    flexWrap: 'wrap',
    gap: 6,
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  dayDate: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
  },
  dayDateEmpty: { color: COLORS.gray },
  dayOfWeek: { fontSize: 11, color: COLORS.gray, fontWeight: '600' },
  todayPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: COLORS.purple,
  },
  todayPillText: { fontSize: 9, color: '#fff', fontWeight: '800' },
  dayRecordCount: {
    fontSize: 11,
    color: COLORS.slateMuted,
    fontWeight: '600',
  },
  dayRecordCountEmpty: { color: COLORS.gray, fontStyle: 'italic' },
  dayAvg: {
    fontSize: 11,
    color: COLORS.slateMuted,
    fontWeight: '700',
  },
  dayRecordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  dayRecordIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayRecordTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  dayRecordAttempt: {
    fontSize: 10,
    color: COLORS.gray,
    fontWeight: '700',
  },
  leaderMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  leaderMiniText: {
    fontSize: 10,
    color: COLORS.amber,
    fontWeight: '700',
  },
  dayRecordRange: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.slate,
    marginTop: 3,
  },
  dayRecordComment: {
    fontSize: 11,
    color: COLORS.gray,
    fontStyle: 'italic',
    marginTop: 3,
  },

  emptyDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  emptyDayText: {
    fontSize: 12,
    color: COLORS.gray,
    fontStyle: 'italic',
  },

  // MINI LOADER
  miniLoaderWrap: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  miniLoaderText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.slateMuted,
    fontWeight: '600',
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
    maxHeight: '92%',
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
  modalTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modalTypeText: { fontSize: 11, fontWeight: '800' },
  leaderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  leaderTagText: { fontSize: 10, color: '#FCD34D', fontWeight: '800' },
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

  modalScoreCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 16,
    borderRadius: 16,
  },
  modalScoreLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalScoreValue: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 4,
  },
  modalScoreTotal: { fontSize: 16, color: COLORS.gray, fontWeight: '700' },
  modalScoreAttempt: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 4,
  },

  modalSection: {
    backgroundColor: COLORS.background,
    padding: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  modalSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalSectionValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate,
    marginTop: 4,
  },
  modalComment: {
    fontSize: 13,
    color: COLORS.slateMuted,
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 19,
  },

  modalGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
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

  subacBox: {
    backgroundColor: COLORS.indigoLight,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  subacBoxTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.indigo,
    marginBottom: 10,
  },
  subacRow: {
    flexDirection: 'row',
    gap: 6,
  },
  subacTile: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  subacTileLabel: {
    fontSize: 9,
    color: COLORS.gray,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  subacTileValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  subacCycleText: {
    fontSize: 11,
    color: COLORS.indigo,
    marginTop: 10,
    fontWeight: '700',
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