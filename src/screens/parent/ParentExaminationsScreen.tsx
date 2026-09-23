// src/screens/parent/ParentExaminationsScreen.tsx
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
  purple: '#7C3AED',
  purpleLight: '#F3EFFF',
  indigo: '#4338CA',
  indigoLight: '#E0E7FF',
  red: '#DC2626',
  redLight: '#FEE2E2',
  amber: '#D97706',
  amberLight: '#FEF3C7',
  orange: '#EA580C',
  orangeLight: '#FFEDD5',
  green: '#16A34A',
  greenLight: '#DCFCE7',
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

interface ExamColumn {
  id: string;
  key: string;
  label: string;
  isVisible?: boolean;
  isAdditive?: boolean;
  order?: number;
}

interface Question {
  questionNumber?: number;
  page?: string;
  fathi?: number;
  lahni?: number;
  ruju?: number;
  tajwid?: number;
  performance?: number;
  customColumns?: Record<string, number>;
  [key: string]: any;
}

interface Exam {
  _id: string;
  studentName?: string;
  halaqah?: string;
  examType?: string;
  examScope?: 'surah' | 'juz';
  fromSurah?: number;
  fromSurahName?: string;
  fromSurahArabic?: string;
  toSurah?: number;
  toSurahName?: string;
  toSurahArabic?: string;
  fromJuz?: number;
  toJuz?: number;
  date?: string;
  dateGregorian?: string;
  percentage?: number;
  obtainedMarks?: number;
  totalMarks?: number;
  passingMark?: number;
  status?: string;
  teacher?: string;
  examiners?: string[];
  questions?: Question[];
  notes?: { positive?: string; negative?: string };
  marksPer?: Record<string, number>;
  settings?: { columns?: ExamColumn[] };
}

// ============================================================
// HELPERS
// ============================================================
const getScoreColor = (percentage: number) => {
  if (percentage >= 90) return '#059669';
  if (percentage >= 80) return '#2563EB';
  if (percentage >= 70) return '#D97706';
  if (percentage >= 60) return '#EA580C';
  return '#DC2626';
};

const getScoreBg = (percentage: number) => {
  if (percentage >= 90) return { bg: '#ECFDF5', border: '#A7F3D0' };
  if (percentage >= 80) return { bg: '#EFF6FF', border: '#BFDBFE' };
  if (percentage >= 70) return { bg: '#FFFBEB', border: '#FDE68A' };
  if (percentage >= 60) return { bg: '#FFF7ED', border: '#FED7AA' };
  return { bg: '#FEF2F2', border: '#FECACA' };
};

const getGradeKey = (percentage: number) => {
  if (percentage >= 90) return 'excellent';
  if (percentage >= 80) return 'veryGood';
  if (percentage >= 70) return 'good';
  if (percentage >= 60) return 'acceptable';
  return 'needsImprovement';
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
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const ordinalsMap: Record<string, string[]> = {
  en: ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'],
  ar: ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'],
  so: ['Koowaad', 'Labaad', 'Saddexaad', 'Afraad', 'Shanaad', 'Lixaad', 'Toddobaad', 'Sideedaad', 'Sagaalaad', 'Tobnaad'],
};

const getQuestionLabel = (
  index: number,
  language: string,
  t: (k: string) => string
) => {
  const list = ordinalsMap[language] || ordinalsMap.en;
  const label = index < list.length ? list[index] : `${index + 1}`;
  if (language === 'so') return `${t('parentExams.question')}sha ${label}`;
  if (language === 'ar') return `${t('parentExams.question')} ${label}`;
  return `${label} ${t('parentExams.question')}`;
};

// ============================================================
// SCREEN
// ============================================================
export const ParentExaminationsScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<any>();
  const currentLanguage = i18n.language;

  // State
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [examTypes, setExamTypes] = useState<string[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [showExamModal, setShowExamModal] = useState(false);
  const [loadingExams, setLoadingExams] = useState(false);

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
      setError(err?.message || t('parentExams.errors.fetchChildren'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  // ============================================================
  // FETCH EXAMS
  // ============================================================
  const fetchExams = useCallback(async () => {
    if (!selectedChildId) return;
    try {
      setLoadingExams(true);
      setError('');
      const res: any = await apiClient.get(
        `/parent/child/${selectedChildId}/exams`,
        { limit: 1000 }
      );
      let list: Exam[] = [];
      if (Array.isArray(res)) list = res;
      else if (res?._id) list = [res];
      else if (Array.isArray(res?.exams)) list = res.exams;
      else if (Array.isArray(res?.data)) list = res.data;

      list.sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });

      setExams(list);
      const types = Array.from(
        new Set(list.map((e) => e.examType).filter(Boolean))
      ) as string[];
      setExamTypes(types);
    } catch (err: any) {
      console.error('Fetch exams error:', err);
      setError(err?.message || t('parentExams.errors.loadData'));
      setExams([]);
    } finally {
      setLoadingExams(false);
    }
  }, [selectedChildId, t]);

  useEffect(() => {
    if (selectedChildId) {
      fetchExams();
      setFilterType('all');
    }
  }, [selectedChildId, fetchExams]);

  // ============================================================
  // FILTER
  // ============================================================
  const filteredExams = useMemo(() => {
    if (filterType === 'all') return exams;
    return exams.filter((e) => e.examType === filterType);
  }, [exams, filterType]);

  // ============================================================
  // STATS
  // ============================================================
  const examStats = useMemo(() => {
    if (exams.length === 0) {
      return {
        total: 0,
        passed: 0,
        failed: 0,
        pending: 0,
        passRate: 0,
        averageScore: 0,
        bestScore: 0,
        latestExam: null as Exam | null,
      };
    }

    const passed = exams.filter(
      (e) => e.status === 'Pass' || e.status === 'pass'
    ).length;
    const failed = exams.filter(
      (e) => e.status === 'Fail' || e.status === 'fail'
    ).length;
    const pending = exams.filter(
      (e) => !e.status || e.status === 'Pending' || e.status === 'pending'
    ).length;
    const passRate = Math.round((passed / exams.length) * 100);
    const scores = exams.map((e) => e.percentage || 0);
    const averageScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
    const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const sorted = [...exams].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    return {
      total: exams.length,
      passed,
      failed,
      pending,
      passRate,
      averageScore,
      bestScore,
      latestExam: sorted[0] || null,
    };
  }, [exams]);

  // ============================================================
  // SCOPE DISPLAY
  // ============================================================
  const getExamScopeDisplay = (exam: Exam) => {
    if (!exam) return t('parentExams.na');
    if (exam.examScope === 'surah') {
      const from =
        exam.fromSurahName || `${t('parentExams.surah')} ${exam.fromSurah}`;
      const to = exam.toSurahName || `${t('parentExams.surah')} ${exam.toSurah}`;
      const fromAr = exam.fromSurahArabic ? ` (${exam.fromSurahArabic})` : '';
      const toAr = exam.toSurahArabic ? ` (${exam.toSurahArabic})` : '';
      if (exam.fromSurah === exam.toSurah) return `${from}${fromAr}`;
      return `${from}${fromAr} → ${to}${toAr}`;
    }
    if (exam.examScope === 'juz') {
      return `${t('parentExams.juz')} ${exam.fromJuz} → ${t('parentExams.juz')} ${
        exam.toJuz
      }`;
    }
    return exam.examScope || t('parentExams.na');
  };

  // ============================================================
  // COLUMN HANDLING
  // ============================================================
  const getVisibleColumns = (exam: Exam): ExamColumn[] => {
    const defaults: ExamColumn[] = [
      { id: 'fathi', key: 'fathi', label: t('parentExams.fathi'), isAdditive: false },
      { id: 'lahni', key: 'lahni', label: t('parentExams.lahni'), isAdditive: false },
      { id: 'ruju', key: 'ruju', label: t('parentExams.ruju'), isAdditive: false },
      { id: 'tajwid', key: 'tajwid', label: t('parentExams.tajwid'), isAdditive: false },
    ];
    const cols = exam?.settings?.columns;
    if (!cols || cols.length === 0) return defaults;
    return cols
      .filter(
        (c) =>
          c.isVisible !== false &&
          c.key !== 'question' &&
          c.key !== 'page' &&
          c.key !== 'deduction'
      )
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  const getMarksPer = (exam: Exam): Record<string, number> =>
    exam?.marksPer || { fathi: 1.2, lahni: 0.5, ruju: 1.0, tajwid: 0.8 };

  const getQuestionContribution = (
    q: Question,
    col: ExamColumn,
    marksPer: Record<string, number>
  ) => {
    let fieldKey = col.key;
    let weightKey = col.key;
    if (col.key === 'rujuc') {
      fieldKey = 'ruju';
      weightKey = 'ruju';
    }
    const weight =
      marksPer[weightKey] !== undefined ? marksPer[weightKey] : 1.0;
    let value = 0;
    if (q.customColumns && q.customColumns[col.key] !== undefined) {
      value = q.customColumns[col.key];
    } else if (q[fieldKey] !== undefined) {
      value = q[fieldKey];
    }
    const isAdditive = col.isAdditive !== false;
    return isAdditive ? value * weight : -(value * weight);
  };

  const getQuestionTotal = (
    q: Question,
    cols: ExamColumn[],
    marksPer: Record<string, number>
  ) => {
    let total = 0;
    cols.forEach((col) => {
      total += getQuestionContribution(q, col, marksPer);
    });
    return total;
  };

  const getGrandTotal = (
    questions: Question[],
    cols: ExamColumn[],
    marksPer: Record<string, number>
  ) => {
    let total = 0;
    questions.forEach((q) => {
      total += getQuestionTotal(q, cols, marksPer);
    });
    return total;
  };

  // ============================================================
  // OPEN DETAIL
  // ============================================================
  const openExamDetail = (exam: Exam) => {
    setSelectedExam(exam);
    setShowExamModal(true);
  };

  // ============================================================
  // LOADING / EMPTY
  // ============================================================
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.purple} />
          <Text style={styles.loadingText}>{t('parentExams.loading')}</Text>
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
            {t('parentExams.noChildren.title')}
          </Text>
          <Text style={styles.emptyText}>
            {t('parentExams.noChildren.message')}
          </Text>
          <Text style={styles.emptyHint}>
            {t('parentExams.noChildren.contactAdmin')}
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.emptyBtnText}>
              {t('parentExams.noChildren.goDashboard')}
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
            {t('parentExams.header.badge')}
          </Text>
          <Text style={styles.headerTitle}>
            {t('parentExams.header.title')}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchExams}>
          <Ionicons name="refresh" size={18} color={COLORS.slate} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loadingExams}
            onRefresh={fetchExams}
            colors={[COLORS.purple]}
            tintColor={COLORS.purple}
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

        {/* IDENTITY + STATS */}
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
                  {selectedChild.studentType || t('parentExams.student')}
                </Text>
                <Text style={styles.identityMeta} numberOfLines={1}>
                  {selectedChild.halaqah || t('parentExams.notAssigned')}{' '}
                  {t('parentExams.halaqah')} •{' '}
                  {selectedChild.teacher || t('parentExams.noTeacher')}
                </Text>
                <Text style={styles.identityReg}>
                  {t('parentExams.registration')}:{' '}
                  {selectedChild.regNo || t('parentExams.na')}
                </Text>
              </View>
            </View>

            {/* Stats grid */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {t('parentExams.stats.totalExams')}
                </Text>
                <Text style={styles.statValue}>{examStats.total}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {t('parentExams.stats.passRate')}
                </Text>
                <Text style={[styles.statValue, { color: COLORS.green }]}>
                  {examStats.passRate}%
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {t('parentExams.stats.avgScore')}
                </Text>
                <Text style={[styles.statValue, { color: COLORS.blue }]}>
                  {examStats.averageScore}%
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {t('parentExams.stats.bestScore')}
                </Text>
                <Text style={[styles.statValue, { color: COLORS.amber }]}>
                  {examStats.bestScore}%
                </Text>
              </View>
              <View style={[styles.statItem, { borderRightWidth: 0 }]}>
                <Text style={styles.statLabel}>
                  {t('parentExams.stats.passed')}
                </Text>
                <Text style={[styles.statValue, { color: COLORS.green }]}>
                  {examStats.passed}
                </Text>
              </View>
            </View>

            {/* Dark latest-exam block */}
            <View style={styles.latestBlock}>
              <View style={styles.latestRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.latestLabel}>
                    {t('parentExams.latestExam.title')}
                  </Text>
                  {examStats.latestExam ? (
                    <>
                      <Text style={styles.latestValue}>
                        {examStats.latestExam.examType ||
                          t('parentExams.exam')}
                      </Text>
                      <Text style={styles.latestDate}>
                        {formatShortDate(
                          examStats.latestExam.date || '',
                          currentLanguage
                        )}
                      </Text>
                      <View style={styles.latestTagRow}>
                        <View
                          style={[
                            styles.latestTag,
                            {
                              backgroundColor:
                                examStats.latestExam.status === 'Pass' ||
                                examStats.latestExam.status === 'pass'
                                  ? 'rgba(34,197,94,0.2)'
                                  : examStats.latestExam.status === 'Fail' ||
                                    examStats.latestExam.status === 'fail'
                                  ? 'rgba(239,68,68,0.2)'
                                  : 'rgba(234,179,8,0.2)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.latestTagText,
                              {
                                color:
                                  examStats.latestExam.status === 'Pass' ||
                                  examStats.latestExam.status === 'pass'
                                    ? '#86EFAC'
                                    : examStats.latestExam.status === 'Fail' ||
                                      examStats.latestExam.status === 'fail'
                                    ? '#FCA5A5'
                                    : '#FDE047',
                              },
                            ]}
                          >
                            {examStats.latestExam.status ||
                              t('parentExams.status.pending')}
                          </Text>
                        </View>
                        <Text style={styles.latestScore}>
                          {examStats.latestExam.percentage || 0}%
                        </Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.latestEmpty}>
                      {t('parentExams.latestExam.noExams')}
                    </Text>
                  )}
                </View>

                {/* Pass-rate ring (approximated with circle) */}
                <View style={styles.ringWrap}>
                  <View style={styles.ringOuter}>
                    <View
                      style={[
                        styles.ringProgress,
                        {
                          borderTopColor: '#A78BFA',
                          transform: [
                            {
                              rotate: `${Math.min(
                                360,
                                (examStats.passRate / 100) * 360
                              )}deg`,
                            },
                          ],
                        },
                      ]}
                    />
                    <View style={styles.ringInner}>
                      <Text style={styles.ringValue}>
                        {examStats.passRate}%
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Mini stats */}
              <View style={styles.latestMiniRow}>
                <View style={styles.latestMini}>
                  <View
                    style={[styles.latestMiniDot, { backgroundColor: '#4ADE80' }]}
                  />
                  <Text style={styles.latestMiniLabel}>
                    {t('parentExams.latestExam.passed')}
                  </Text>
                  <Text style={styles.latestMiniValue}>{examStats.passed}</Text>
                </View>
                <View style={styles.latestMini}>
                  <View
                    style={[styles.latestMiniDot, { backgroundColor: '#F87171' }]}
                  />
                  <Text style={styles.latestMiniLabel}>
                    {t('parentExams.latestExam.failed')}
                  </Text>
                  <Text style={styles.latestMiniValue}>{examStats.failed}</Text>
                </View>
                <View style={styles.latestMini}>
                  <View
                    style={[styles.latestMiniDot, { backgroundColor: '#FACC15' }]}
                  />
                  <Text style={styles.latestMiniLabel}>
                    {t('parentExams.latestExam.pending')}
                  </Text>
                  <Text style={styles.latestMiniValue}>{examStats.pending}</Text>
                </View>
                <View style={styles.latestMini}>
                  <View
                    style={[styles.latestMiniDot, { backgroundColor: '#60A5FA' }]}
                  />
                  <Text style={styles.latestMiniLabel}>
                    {t('parentExams.latestExam.avg')}
                  </Text>
                  <Text style={styles.latestMiniValue}>
                    {examStats.averageScore}%
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* FILTERS + LIST HEADER */}
        <View style={styles.listHeaderBox}>
          <View style={{ marginBottom: 8 }}>
            <Text style={styles.sectionBadge}>
              {t('parentExams.allRecords.title')}
            </Text>
            <Text style={styles.listHeaderTitle}>
              {filteredExams.length}{' '}
              {filteredExams.length === 1
                ? t('parentExams.allRecords.exam')
                : t('parentExams.allRecords.exams')}{' '}
              {t('parentExams.allRecords.found')}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            <FilterChip
              label={t('parentExams.allRecords.allTypes')}
              active={filterType === 'all'}
              onPress={() => setFilterType('all')}
            />
            {examTypes.map((tp) => (
              <FilterChip
                key={tp}
                label={tp}
                active={filterType === tp}
                onPress={() => setFilterType(tp)}
              />
            ))}
          </ScrollView>
        </View>

        {/* EXAMS LIST */}
        {loadingExams ? (
          <View style={styles.miniLoaderWrap}>
            <ActivityIndicator color={COLORS.purple} />
            <Text style={styles.miniLoaderText}>
              {t('parentExams.loadingRecords')}
            </Text>
          </View>
        ) : filteredExams.length === 0 ? (
          <View style={styles.emptyListWrap}>
            <Ionicons name="document-text-outline" size={48} color={COLORS.gray} />
            <Text style={styles.emptyListTitle}>
              {t('parentExams.allRecords.noRecords')}
            </Text>
            <Text style={styles.emptyListHint}>
              {selectedChild
                ? `${selectedChild.name} ${t('parentExams.allRecords.hasNoRecords')}`
                : t('parentExams.allRecords.selectChild')}
            </Text>
          </View>
        ) : (
          filteredExams.map((exam, index) => (
            <ExamRow
              key={exam._id || index}
              exam={exam}
              index={index}
              currentLanguage={currentLanguage}
              onPress={() => openExamDetail(exam)}
            />
          ))
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* DETAIL MODAL */}
      <Modal
        visible={showExamModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExamModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {selectedExam ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalBadge}>
                      {t('parentExams.detailModal.title')}
                    </Text>
                    <View style={styles.modalTitleRow}>
                      <Text style={styles.modalTitle} numberOfLines={2}>
                        {selectedExam.examType || t('parentExams.exam')}
                      </Text>
                      <View
                        style={[
                          styles.modalStatus,
                          {
                            backgroundColor:
                              selectedExam.status === 'Pass' ||
                              selectedExam.status === 'pass'
                                ? 'rgba(34,197,94,0.2)'
                                : selectedExam.status === 'Fail' ||
                                  selectedExam.status === 'fail'
                                ? 'rgba(239,68,68,0.2)'
                                : 'rgba(234,179,8,0.2)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.modalStatusText,
                            {
                              color:
                                selectedExam.status === 'Pass' ||
                                selectedExam.status === 'pass'
                                  ? '#86EFAC'
                                  : selectedExam.status === 'Fail' ||
                                    selectedExam.status === 'fail'
                                  ? '#FCA5A5'
                                  : '#FDE047',
                            },
                          ]}
                        >
                          {selectedExam.status || t('parentExams.status.pending')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.modalSub}>
                      {selectedExam.date
                        ? formatFullDate(selectedExam.date, currentLanguage)
                        : t('parentExams.detailModal.dateNotAvailable')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setShowExamModal(false)}
                  >
                    <Ionicons name="close" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalBody}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Student info */}
                  <View style={styles.modalInfoRow}>
                    <View style={styles.modalInfoAvatar}>
                      <Text style={styles.modalInfoAvatarText}>
                        {selectedExam.studentName?.charAt(0) || 'S'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalInfoName}>
                        {selectedExam.studentName}
                      </Text>
                      <Text style={styles.modalInfoMeta} numberOfLines={1}>
                        {selectedExam.halaqah || t('parentExams.notAssigned')} •{' '}
                        {selectedExam.examType || t('parentExams.exam')}
                      </Text>
                    </View>
                  </View>

                  {/* Exam scope */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionLabel}>
                      {t('parentExams.detailModal.examScope')}
                    </Text>
                    <Text style={styles.modalSectionValue}>
                      {getExamScopeDisplay(selectedExam)}
                    </Text>
                  </View>

                  {/* Question breakdown */}
                  {selectedExam.questions && selectedExam.questions.length > 0 && (
                    <>
                      <Text style={styles.modalSectionLabel}>
                        {t('parentExams.detailModal.questionBreakdown')}
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ marginTop: 8 }}
                      >
                        <View style={styles.tableWrap}>
                          {/* Header */}
                          <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableCell, styles.tableHeadCell, { minWidth: 110 }]}>
                              {t('parentExams.detailModal.question')}
                            </Text>
                            <Text style={[styles.tableCell, styles.tableHeadCell, { minWidth: 60 }]}>
                              {t('parentExams.detailModal.page')}
                            </Text>
                            {getVisibleColumns(selectedExam).map((col) => (
                              <Text
                                key={col.id}
                                style={[styles.tableCell, styles.tableHeadCell, { minWidth: 60 }]}
                              >
                                {col.label}
                              </Text>
                            ))}
                            <Text style={[styles.tableCell, styles.tableHeadCell, { minWidth: 70 }]}>
                              {t('parentExams.detailModal.deduction')}
                            </Text>
                          </View>

                          {/* Rows */}
                          {selectedExam.questions.map((q, idx) => {
                            const cols = getVisibleColumns(selectedExam);
                            const marksPer = getMarksPer(selectedExam);
                            const qTotal = getQuestionTotal(q, cols, marksPer);
                            return (
                              <View key={idx} style={styles.tableRow}>
                                <Text style={[styles.tableCell, { minWidth: 110 }]}>
                                  {getQuestionLabel(idx, currentLanguage, t)}
                                </Text>
                                <Text
                                  style={[
                                    styles.tableCell,
                                    styles.tableCellCenter,
                                    { minWidth: 60 },
                                  ]}
                                >
                                  {q.page || '-'}
                                </Text>
                                {cols.map((col) => {
                                  let fieldKey = col.key;
                                  if (col.key === 'rujuc') fieldKey = 'ruju';
                                  let val = 0;
                                  if (
                                    q.customColumns &&
                                    q.customColumns[col.key] !== undefined
                                  ) {
                                    val = q.customColumns[col.key];
                                  } else if (q[fieldKey] !== undefined) {
                                    val = q[fieldKey];
                                  }
                                  return (
                                    <Text
                                      key={col.id}
                                      style={[
                                        styles.tableCell,
                                        styles.tableCellCenter,
                                        { minWidth: 60 },
                                      ]}
                                    >
                                      {val}
                                    </Text>
                                  );
                                })}
                                <Text
                                  style={[
                                    styles.tableCell,
                                    styles.tableCellCenter,
                                    {
                                      minWidth: 70,
                                      color:
                                        qTotal > 0
                                          ? COLORS.green
                                          : qTotal < 0
                                          ? COLORS.red
                                          : COLORS.gray,
                                      fontWeight: '800',
                                    },
                                  ]}
                                >
                                  {qTotal > 0 ? '+' : ''}
                                  {qTotal.toFixed(1)}
                                </Text>
                              </View>
                            );
                          })}

                          {/* Total row */}
                          <View style={[styles.tableRow, styles.tableTotalRow]}>
                            <Text
                              style={[
                                styles.tableCell,
                                styles.tableTotalCell,
                                { minWidth: 170 },
                              ]}
                            >
                              {t('parentExams.detailModal.totalDeduction')}
                            </Text>
                            {getVisibleColumns(selectedExam).map((col) => {
                              let fieldKey = col.key;
                              if (col.key === 'rujuc') fieldKey = 'ruju';
                              let weightKey = col.key;
                              if (col.key === 'rujuc') weightKey = 'ruju';
                              const marksPer = getMarksPer(selectedExam);
                              const weight =
                                marksPer[weightKey] !== undefined
                                  ? marksPer[weightKey]
                                  : 1.0;
                              const total = (selectedExam.questions || []).reduce(
                                (sum, q) => {
                                  let v = 0;
                                  if (
                                    q.customColumns &&
                                    q.customColumns[col.key] !== undefined
                                  ) {
                                    v = q.customColumns[col.key];
                                  } else if (q[fieldKey] !== undefined) {
                                    v = q[fieldKey];
                                  }
                                  return sum + v * weight;
                                },
                                0
                              );
                              const isAdditive = col.isAdditive !== false;
                              const displayTotal = isAdditive ? total : -total;
                              return (
                                <Text
                                  key={`total-${col.id}`}
                                  style={[
                                    styles.tableCell,
                                    styles.tableCellCenter,
                                    styles.tableTotalCell,
                                    {
                                      minWidth: 60,
                                      color:
                                        displayTotal > 0
                                          ? COLORS.green
                                          : displayTotal < 0
                                          ? COLORS.red
                                          : COLORS.gray,
                                    },
                                  ]}
                                >
                                  {displayTotal > 0 ? '+' : ''}
                                  {displayTotal.toFixed(1)}
                                </Text>
                              );
                            })}
                            <Text
                              style={[
                                styles.tableCell,
                                styles.tableCellCenter,
                                styles.tableTotalCell,
                                {
                                  minWidth: 70,
                                  color:
                                    getGrandTotal(
                                      selectedExam.questions,
                                      getVisibleColumns(selectedExam),
                                      getMarksPer(selectedExam)
                                    ) > 0
                                      ? COLORS.green
                                      : COLORS.red,
                                },
                              ]}
                            >
                              {(() => {
                                const gt = getGrandTotal(
                                  selectedExam.questions,
                                  getVisibleColumns(selectedExam),
                                  getMarksPer(selectedExam)
                                );
                                return (gt > 0 ? '+' : '') + gt.toFixed(1);
                              })()}
                            </Text>
                          </View>
                        </View>
                      </ScrollView>
                    </>
                  )}

                  {/* Notes */}
                  <View style={styles.notesGrid}>
                    <View style={[styles.noteBox, { backgroundColor: COLORS.greenLight, borderColor: '#A7F3D0' }]}>
                      <View style={styles.noteHeader}>
                        <Ionicons name="checkmark-circle" size={14} color={COLORS.green} />
                        <Text style={[styles.noteTitle, { color: '#15803D' }]}>
                          {t('parentExams.detailModal.positiveNotes')}
                        </Text>
                      </View>
                      <Text style={[styles.noteText, { color: '#15803D' }]}>
                        {selectedExam.notes?.positive ||
                          t('parentExams.detailModal.noPositiveNotes')}
                      </Text>
                    </View>
                    <View style={[styles.noteBox, { backgroundColor: COLORS.redLight, borderColor: '#FECACA' }]}>
                      <View style={styles.noteHeader}>
                        <Ionicons name="close-circle" size={14} color={COLORS.red} />
                        <Text style={[styles.noteTitle, { color: '#B91C1C' }]}>
                          {t('parentExams.detailModal.improvementNotes')}
                        </Text>
                      </View>
                      <Text style={[styles.noteText, { color: '#B91C1C' }]}>
                        {selectedExam.notes?.negative ||
                          t('parentExams.detailModal.noImprovementNotes')}
                      </Text>
                    </View>
                  </View>

                  {/* Committee */}
                  {selectedExam.examiners && selectedExam.examiners.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionLabel}>
                        {t('parentExams.detailModal.examCommittee')}
                      </Text>
                      {selectedExam.examiners.map((ex, idx) => (
                        <View key={idx} style={styles.committeeRow}>
                          <Text style={styles.committeeName}>{ex}</Text>
                          <View style={styles.committeeLine} />
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Result Summary (dark) */}
                  <View style={styles.resultSummary}>
                    <Text style={styles.resultLabel}>
                      {t('parentExams.detailModal.resultSummary')}
                    </Text>
                    <View style={styles.resultGrid}>
                      <View style={styles.resultTile}>
                        <Text style={styles.resultTileLabel}>
                          {t('parentExams.detailModal.totalMarks')}
                        </Text>
                        <Text style={styles.resultTileValue}>
                          {selectedExam.totalMarks || 100}
                        </Text>
                      </View>
                      <View style={styles.resultTile}>
                        <Text style={styles.resultTileLabel}>
                          {t('parentExams.detailModal.obtained')}
                        </Text>
                        <Text style={[styles.resultTileValue, { color: '#4ADE80' }]}>
                          {selectedExam.obtainedMarks || 0}
                        </Text>
                      </View>
                      <View style={styles.resultTile}>
                        <Text style={styles.resultTileLabel}>
                          {t('parentExams.detailModal.deduction')}
                        </Text>
                        <Text style={[styles.resultTileValue, { color: '#FCA5A5' }]}>
                          {getGrandTotal(
                            selectedExam.questions || [],
                            getVisibleColumns(selectedExam),
                            getMarksPer(selectedExam)
                          ).toFixed(1)}
                        </Text>
                      </View>
                      <View style={styles.resultTile}>
                        <Text style={styles.resultTileLabel}>
                          {t('parentExams.detailModal.status')}
                        </Text>
                        <Text
                          style={[
                            styles.resultTileValue,
                            {
                              color:
                                selectedExam.status === 'Pass' ||
                                selectedExam.status === 'pass'
                                  ? '#4ADE80'
                                  : '#FCA5A5',
                            },
                          ]}
                        >
                          {selectedExam.status === 'Pass' ||
                          selectedExam.status === 'pass'
                            ? t('parentExams.pass')
                            : t('parentExams.fail')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.perfRow}>
                      <Text style={styles.perfLabel}>
                        {t('parentExams.detailModal.performance')}
                      </Text>
                      <Text
                        style={[
                          styles.perfValue,
                          { color: getScoreColor(selectedExam.percentage || 0) },
                        ]}
                      >
                        {selectedExam.percentage || 0}%
                      </Text>
                    </View>
                    <View style={styles.perfBar}>
                      <View
                        style={[
                          styles.perfBarFill,
                          {
                            width: `${Math.min(100, selectedExam.percentage || 0)}%`,
                            backgroundColor:
                              (selectedExam.percentage || 0) >= 90
                                ? '#10B981'
                                : (selectedExam.percentage || 0) >= 80
                                ? '#3B82F6'
                                : (selectedExam.percentage || 0) >= 70
                                ? '#F59E0B'
                                : (selectedExam.percentage || 0) >= 60
                                ? '#EA580C'
                                : '#EF4444',
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.perfMetaRow}>
                      <Text style={styles.perfMeta}>0%</Text>
                      <Text style={styles.perfMeta}>
                        {t('parentExams.detailModal.passingMark')}:{' '}
                        {selectedExam.passingMark || 60}%
                      </Text>
                      <Text style={styles.perfMeta}>100%</Text>
                    </View>
                    <Text style={styles.gradeText}>
                      {t('parentExams.detailModal.grade')}:{' '}
                      <Text
                        style={{
                          color: getScoreColor(selectedExam.percentage || 0),
                          fontWeight: '800',
                        }}
                      >
                        {t(
                          `parentExams.grade.${getGradeKey(
                            selectedExam.percentage || 0
                          )}`
                        )}
                      </Text>
                    </Text>
                  </View>

                  <View style={{ height: 20 }} />
                </ScrollView>

                <TouchableOpacity
                  style={styles.modalCloseFullBtn}
                  onPress={() => setShowExamModal(false)}
                >
                  <Text style={styles.modalCloseFullBtnText}>
                    {t('parentExams.detailModal.closeDetails')}
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

const ExamRow: React.FC<{
  exam: Exam;
  index: number;
  currentLanguage: string;
  onPress: () => void;
}> = ({ exam, index, currentLanguage, onPress }) => {
  const { t } = useTranslation();
  const pct = exam.percentage || 0;
  const scoreStyle = getScoreBg(pct);
  const passStatus = exam.status === 'Pass' || exam.status === 'pass';

  const scopeDisplay = (() => {
    if (exam.examScope === 'surah') {
      const from =
        exam.fromSurahName || `${t('parentExams.surah')} ${exam.fromSurah}`;
      const to = exam.toSurahName || `${t('parentExams.surah')} ${exam.toSurah}`;
      if (exam.fromSurah === exam.toSurah) return from;
      return `${from} → ${to}`;
    }
    if (exam.examScope === 'juz') {
      return `${t('parentExams.juz')} ${exam.fromJuz} → ${t('parentExams.juz')} ${
        exam.toJuz
      }`;
    }
    return exam.examScope || t('parentExams.na');
  })();

  return (
    <TouchableOpacity style={styles.examCard} onPress={onPress}>
      <View style={styles.examCardTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.examTitleRow}>
            <Text style={styles.examTitle} numberOfLines={1}>
              {exam.examType || t('parentExams.exam')}
            </Text>
            <View
              style={[
                styles.statusTag,
                passStatus ? styles.statusPass : styles.statusFail,
              ]}
            >
              <Text
                style={[
                  styles.statusTagText,
                  passStatus ? { color: '#15803D' } : { color: '#B91C1C' },
                ]}
              >
                {exam.status || t('parentExams.status.pending')}
              </Text>
            </View>
            <Text style={styles.examIndex}>#{index + 1}</Text>
          </View>
          <View style={styles.examMetaRow}>
            <View style={styles.examMetaItem}>
              <Ionicons name="calendar-outline" size={11} color={COLORS.gray} />
              <Text style={styles.examMetaText}>
                {formatShortDate(exam.date || '', currentLanguage)}
              </Text>
            </View>
            <View style={styles.examMetaItem}>
              <Ionicons name="book-outline" size={11} color={COLORS.gray} />
              <Text style={styles.examMetaText} numberOfLines={1}>
                {scopeDisplay}
              </Text>
            </View>
            {exam.teacher && (
              <View style={styles.examMetaItem}>
                <Ionicons name="person-outline" size={11} color={COLORS.gray} />
                <Text style={styles.examMetaText} numberOfLines={1}>
                  {exam.teacher}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View
          style={[
            styles.scoreBox,
            { backgroundColor: scoreStyle.bg, borderColor: scoreStyle.border },
          ]}
        >
          <Text style={[styles.scoreBoxValue, { color: getScoreColor(pct) }]}>
            {pct}%
          </Text>
          <Text style={styles.scoreBoxLabel}>
            {t(`parentExams.grade.${getGradeKey(pct)}`)}
          </Text>
        </View>

        <View style={styles.eyeBtn}>
          <Ionicons name="eye-outline" size={18} color={COLORS.purple} />
        </View>
      </View>

      {exam.notes?.positive ? (
        <Text style={styles.examPositive} numberOfLines={1}>
          ✨ {exam.notes.positive}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
};

export default ParentExaminationsScreen;

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
    backgroundColor: COLORS.purple,
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
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statItem: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  statLabel: {
    fontSize: 9,
    color: COLORS.gray,
    fontWeight: '600',
    textAlign: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 4,
  },

  // LATEST EXAM DARK BLOCK
  latestBlock: {
    backgroundColor: COLORS.slate,
    padding: 16,
  },
  latestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  latestLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  latestValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  latestDate: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  latestTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  latestTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  latestTagText: { fontSize: 11, fontWeight: '800' },
  latestScore: { fontSize: 12, color: '#94A3B8', fontWeight: '700' },
  latestEmpty: { fontSize: 13, color: '#94A3B8', marginTop: 6 },

  // RING
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  ringOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 8,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringProgress: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 8,
    borderColor: 'transparent',
    borderLeftColor: '#A78BFA',
  },
  ringInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: { fontSize: 14, fontWeight: '800', color: '#fff' },

  // LATEST MINI STATS
  latestMiniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 8,
  },
  latestMini: { flex: 1, alignItems: 'center' },
  latestMiniDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
  latestMiniLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '700',
    textAlign: 'center',
  },
  latestMiniValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
  },

  // LIST HEADER
  listHeaderBox: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  sectionBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  listHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 4,
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

  // MINI LOADER
  miniLoaderWrap: { alignItems: 'center', paddingVertical: 30 },
  miniLoaderText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.slateMuted,
    fontWeight: '600',
  },

  // EMPTY LIST
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

  // EXAM CARD
  examCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
  },
  examCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  examTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  examTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: COLORS.slate,
    flexShrink: 1,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusPass: { backgroundColor: COLORS.greenLight },
  statusFail: { backgroundColor: COLORS.redLight },
  statusTagText: { fontSize: 10, fontWeight: '800' },
  examIndex: { fontSize: 10.5, color: COLORS.gray, fontWeight: '700' },
  examMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  examMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  examMetaText: { fontSize: 11, color: COLORS.slateMuted, fontWeight: '600' },

  scoreBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 70,
  },
  scoreBoxValue: { fontSize: 15, fontWeight: '800' },
  scoreBoxLabel: { fontSize: 9, color: COLORS.gray, marginTop: 2 },

  eyeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  examPositive: {
    fontSize: 11,
    color: COLORS.green,
    marginTop: 8,
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
    maxHeight: '94%',
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
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    flexShrink: 1,
  },
  modalStatus: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  modalStatusText: { fontSize: 11, fontWeight: '800' },
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

  // MODAL STUDENT INFO
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 14,
    marginBottom: 12,
  },
  modalInfoAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalInfoAvatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  modalInfoName: { fontSize: 15, fontWeight: '800', color: COLORS.slate },
  modalInfoMeta: {
    fontSize: 11.5,
    color: COLORS.slateMuted,
    marginTop: 3,
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
    marginTop: 4,
  },
  modalSectionValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate,
    marginTop: 4,
  },

  // TABLE
  tableWrap: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  tableTotalRow: { backgroundColor: COLORS.background },
  tableCell: {
    fontSize: 12,
    color: COLORS.slate,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tableCellCenter: { textAlign: 'center' },
  tableHeadCell: {
    fontWeight: '800',
    color: COLORS.slateMuted,
    fontSize: 10.5,
    textTransform: 'uppercase',
  },
  tableTotalCell: { fontWeight: '800', color: COLORS.slate },

  // NOTES
  notesGrid: { gap: 8, marginTop: 12 },
  noteBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  noteTitle: { fontSize: 12, fontWeight: '800' },
  noteText: { fontSize: 12.5, fontWeight: '600', lineHeight: 18 },

  // COMMITTEE
  committeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  committeeName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate,
  },
  committeeLine: {
    flex: 1,
    height: 1,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: COLORS.gray,
  },

  // RESULT SUMMARY
  resultSummary: {
    backgroundColor: COLORS.slate,
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
  },
  resultLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  resultGrid: { flexDirection: 'row', gap: 8 },
  resultTile: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 10,
    borderRadius: 10,
  },
  resultTileLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '700',
    textAlign: 'center',
  },
  resultTileValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginTop: 4,
  },
  perfRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  perfLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  perfValue: { fontSize: 15, fontWeight: '800' },
  perfBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 6,
  },
  perfBarFill: { height: '100%', borderRadius: 4 },
  perfMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  perfMeta: { fontSize: 10, color: '#94A3B8' },
  gradeText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 10,
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