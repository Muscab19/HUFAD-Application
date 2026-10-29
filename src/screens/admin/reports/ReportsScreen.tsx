// src/screens/admin/reports/ReportsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useBranch } from '../../../context/BranchContext';
import { useAuth } from '../../../context/AuthContext';

import {
  COLORS,
  ACHIEVEMENT_TYPES,
  TAB_KEYS,
  STATUS_KEY,
  Student,
  ReportData,
  MonthlyPerf,
  ReportPeriod,
  PrintSection,
  SchoolInfo,
  DEFAULT_SCHOOL_INFO,
  MONTH_SHORT,
  computeAttendanceRate,
  computeCombinedScore,
  formatRangeShort,
  formatShortDate,
  getDateLocale,
  getExamFormType,
  getHalaqahName,
  getMonthLabel,
  getMonthLabelLong,
  getSafeDate,
  initials,
  isRTLLanguage,
  reportsApi,
  round1,
  round0,
  schoolInfoStorage,
} from './_shared';

import { ReportSchoolSettingsModal } from './ReportSchoolSettingsModal';
import { ReportStudentSearchModal } from './ReportStudentSearchModal';
import { ReportMonthPickerModal } from './ReportMonthPickerModal';
import { ReportExamDetailsModal } from './ReportExamDetailsModal';
import { ReportPrintModal } from './ReportPrintModal';
import { printReportSheet, shareReportAsPdf } from './ReportPrintSheet';

// ============================================================
// MAIN SCREEN
// ============================================================
export const ReportsScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { currentBranch } = useBranch();
  const { user } = useAuth();

  const branchId =
    (currentBranch as any)?._id ||
    (currentBranch as any)?.id ||
    (user as any)?.branchId ||
    '';

  const language = i18n.language || 'en';
  const isRTL = isRTLLanguage(language);

  // ----------------------------------------------------------------
  // State
  // ----------------------------------------------------------------
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [period, setPeriod] = useState<ReportPeriod>({
    mode: 'month',
    month: getCurrentMonthKey(),
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [memFilter, setMemFilter] = useState('all');

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [monthlyPerf, setMonthlyPerf] = useState<MonthlyPerf[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
    ...DEFAULT_SCHOOL_INFO,
  });

  const [showStudentSearch, setShowStudentSearch] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showSchoolSettings, setShowSchoolSettings] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState<any>(null);

  // ----------------------------------------------------------------
  // Load school info
  // ----------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const info = await schoolInfoStorage.load();
      setSchoolInfo(info);
    })();
  }, []);

  const handleSaveSchoolInfo = async (info: SchoolInfo) => {
    setSchoolInfo(info);
    await schoolInfoStorage.save(info);
    setShowSchoolSettings(false);
  };

  // ----------------------------------------------------------------
  // Flash error
  // ----------------------------------------------------------------
  const flashError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 6000);
  };

  // ----------------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------------
  const buildReportParams = (p: ReportPeriod) =>
    p.mode === 'range'
      ? { startDate: p.startDate, endDate: p.endDate }
      : { month: p.month };

  const fetchReport = useCallback(
    async (studentId: string, p: ReportPeriod, silent = false) => {
      if (!branchId) {
        setReportData(null);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const data = await reportsApi.getStudentReport(
          studentId,
          buildReportParams(p)
        );
        setReportData(data);
        setError('');
      } catch (err: any) {
        console.warn('Fetch student report error:', err);
        flashError(
          err?.response?.data?.message ||
            err?.message ||
            t('reports.loadFailed') ||
            'Failed to load report'
        );
        setReportData(null);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [branchId, t]
  );

  const fetchMonthlyPerf = useCallback(
    async (studentId: string) => {
      if (!branchId) return;
      try {
        const data = await reportsApi.getMonthlyPerformance(studentId, 12);
        setMonthlyPerf(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn('Fetch monthly performance error:', err);
        setMonthlyPerf([]);
      }
    },
    [branchId]
  );

  useEffect(() => {
    if (selectedStudent?._id && branchId) {
      fetchReport(selectedStudent._id, period);
    } else {
      setReportData(null);
    }
  }, [selectedStudent, period, branchId, fetchReport]);

  useEffect(() => {
    if (selectedStudent?._id && branchId) {
      fetchMonthlyPerf(selectedStudent._id);
    } else {
      setMonthlyPerf([]);
    }
  }, [selectedStudent, branchId, fetchMonthlyPerf]);

  const onRefresh = async () => {
    if (!selectedStudent) return;
    setRefreshing(true);
    await fetchReport(selectedStudent._id, period, true);
    await fetchMonthlyPerf(selectedStudent._id);
    setRefreshing(false);
  };

  // ----------------------------------------------------------------
  // Derived
  // ----------------------------------------------------------------
  const student = reportData?.student || selectedStudent;
  const attendance = reportData?.attendance;
  const memorization = reportData?.memorization;
  const exams = Array.isArray(reportData?.exams) ? reportData!.exams! : [];
  const behavior = Array.isArray(reportData?.behavior)
    ? reportData!.behavior!
    : [];
  const finance = reportData?.finance;

  const attendanceRate = computeAttendanceRate(attendance?.summary);

  const memStats = {
    total: memorization?.summary?.total ?? 0,
    avgScore: memorization?.summary?.avgScore ?? 0,
    bestScore: memorization?.summary?.bestScore ?? 0,
  };

  const examAvg = exams.length
    ? round0(
        exams.reduce((s, e) => s + (e.percentage || 0), 0) / exams.length
      )
    : 0;

  const behaviorPoints = behavior.reduce(
    (s, b) => s + (b.points || 0),
    0
  );

  const currentMonthScore = useMemo(
    () =>
      computeCombinedScore(
        attendanceRate,
        memStats.avgScore,
        behaviorPoints
      ),
    [attendanceRate, memStats.avgScore, behaviorPoints]
  );

  const filteredRecords = useMemo(() => {
    if (!memorization) return [];
    if (memFilter === 'all') return memorization.allRecords || [];
    return memorization.byType?.[memFilter] || [];
  }, [memorization, memFilter]);

  // ----------------------------------------------------------------
  // Print / Share
  // ----------------------------------------------------------------
  const handlePrintAction = async (
    sections: PrintSection[],
    action: 'print' | 'share'
  ) => {
    if (!selectedStudent || !reportData) {
      Alert.alert(
        t('reports.noStudentTitle') || 'No student selected',
        t('reports.noStudentSubtitle') ||
          'Please choose a student first.'
      );
      return;
    }

    const options = {
      student,
      reportData,
      monthlyPerf,
      period,
      sections,
      schoolInfo,
      language,
      currentMonthScore,
    };

    if (action === 'print') {
      await printReportSheet(options);
    } else {
      await shareReportAsPdf(options);
    }
  };

  // ----------------------------------------------------------------
  // Header period label
  // ----------------------------------------------------------------
  const periodLabel = useMemo(() => {
    if (period.mode === 'range') {
      return `${period.startDate} → ${period.endDate}`;
    }
    return getMonthLabelLong(period.month || '', getDateLocale(language));
  }, [period, language]);

  // ============================================================
  // RENDER — TABS
  // ============================================================
  const renderOverview = () => {
    const chartMonths = monthlyPerf.length > 0 ? monthlyPerf : [];
    const maxCombined = Math.max(
      ...chartMonths.map((m) => m.combined || 0),
      100
    );

    return (
      <>
        {/* Stat tiles */}
        <View style={styles.statsGrid}>
          <StatTile
            label={t('reports.overview.attendance') || 'Attendance'}
            value={`${attendanceRate}%`}
            icon="calendar"
            color={COLORS.blue}
            bg={COLORS.blueLight}
            subtitle={`${attendance?.summary?.present || 0}/${
              attendance?.summary?.total || 0
            }`}
          />
          <StatTile
            label={t('reports.overview.memorization') || 'Memorization'}
            value={`${memStats.total}`}
            icon="book"
            color={COLORS.primary}
            bg={COLORS.primaryLight}
            subtitle={`${memStats.avgScore}/10`}
          />
          <StatTile
            label={t('reports.overview.exams') || 'Exams'}
            value={`${exams.length}`}
            icon="trophy"
            color={COLORS.purple}
            bg={COLORS.purpleLight}
            subtitle={`${examAvg}%`}
          />
          <StatTile
            label={t('reports.overview.behavior') || 'Behavior'}
            value={`${behaviorPoints > 0 ? '+' : ''}${behaviorPoints}`}
            icon="heart"
            color={behaviorPoints >= 0 ? COLORS.primary : COLORS.red}
            bg={behaviorPoints >= 0 ? COLORS.primaryLight : COLORS.redLight}
            subtitle={t('reports.overview.goodCount', {
              count: behavior.filter((b) => b.type === 'good').length,
            })}
          />
        </View>

        {/* Chart card */}
        <View style={styles.card}>
          <SectionHeader
            title={
              t('reports.overview.performanceTrend') || 'Performance Trend'
            }
            subtitle={
              t('reports.overview.performanceTrendSub') ||
              'Combined monthly score'
            }
            icon="trending-up"
          />

          {chartMonths.length === 0 ? (
            <Text style={styles.emptyText}>
              {t('reports.overview.noTrendData') ||
                'No historical data yet.'}
            </Text>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chartScrollContent}
              >
                <View style={styles.chart}>
                  {chartMonths.map((m) => {
                    const combined = m.combined || 0;
                    const heightPct = Math.max(
                      4,
                      Math.min(100, (combined / maxCombined) * 100)
                    );
                    const color =
                      combined >= 80
                        ? COLORS.primary
                        : combined >= 60
                        ? COLORS.amber
                        : combined > 0
                        ? COLORS.red
                        : '#E2E8F0';
                    const isActive =
                      period.mode === 'month' && period.month === m.month;
                    return (
                      <TouchableOpacity
                        key={m.month}
                        style={styles.chartCol}
                        onPress={() =>
                          setPeriod({ mode: 'month', month: m.month })
                        }
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.chartValue,
                            isActive && { color: COLORS.primary },
                          ]}
                        >
                          {combined}%
                        </Text>
                        <View style={styles.chartBarWrap}>
                          <View
                            style={[
                              styles.chartBar,
                              {
                                height: `${heightPct}%`,
                                backgroundColor: color,
                              },
                              isActive && styles.chartBarActive,
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.chartMonth,
                            isActive && { color: COLORS.primary },
                          ]}
                        >
                          {MONTH_SHORT[getSafeDate(m.month).getMonth()]}
                        </Text>
                        <Text style={styles.chartYear}>
                          {`${getSafeDate(m.month).getFullYear()}`.slice(2)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={styles.chartLegend}>
                <Text style={styles.chartLegendText}>
                  {t('reports.overview.weightsLegend') ||
                    'Combined = 45% attendance + 45% memorization + 10% behavior'}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Breakdown card */}
        <View style={styles.card}>
          <SectionHeader
            title={t('reports.overview.breakdownByType') || 'By type'}
            subtitle={t('reports.overview.breakdownSub', {
              count: memStats.total,
            })}
            icon="pie-chart"
          />
          <View style={styles.breakdownGrid}>
            {ACHIEVEMENT_TYPES.map((type) => {
              const count = memorization?.byType?.[type.value]?.length || 0;
              return (
                <View
                  key={type.value}
                  style={[styles.breakdownTile, { backgroundColor: type.bg }]}
                >
                  <Text
                    style={[styles.breakdownCount, { color: type.color }]}
                  >
                    {count}
                  </Text>
                  <Text
                    style={styles.breakdownLabel}
                    numberOfLines={1}
                  >
                    {t(`reports.achievementTypes.${type.labelKey}`)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Exam summary card */}
        <View style={styles.card}>
          <SectionHeader
            title={t('reports.overview.examSummary') || 'Exam summary'}
            subtitle={t('reports.overview.examSummarySub', {
              count: exams.length,
            })}
            icon="trophy"
          />
          <View style={styles.examSummaryGrid}>
            <View style={styles.examSummaryTile}>
              <Text style={styles.examSummaryValue}>{exams.length}</Text>
              <Text style={styles.examSummaryLabel}>
                {t('reports.overview.total') || 'Total'}
              </Text>
            </View>
            <View style={styles.examSummaryTile}>
              <Text
                style={[styles.examSummaryValue, { color: COLORS.primary }]}
              >
                {exams.filter((e) => e.status === 'Pass').length}
              </Text>
              <Text style={styles.examSummaryLabel}>
                {t('reports.overview.passed') || 'Passed'}
              </Text>
            </View>
            <View style={styles.examSummaryTile}>
              <Text
                style={[styles.examSummaryValue, { color: COLORS.blue }]}
              >
                {examAvg}%
              </Text>
              <Text style={styles.examSummaryLabel}>
                {t('reports.overview.average') || 'Average'}
              </Text>
            </View>
            <View style={styles.examSummaryTile}>
              <Text
                style={[styles.examSummaryValue, { color: COLORS.gold }]}
              >
                {exams.length
                  ? `${Math.max(...exams.map((e) => e.percentage || 0))}%`
                  : '-'}
              </Text>
              <Text style={styles.examSummaryLabel}>
                {t('reports.overview.best') || 'Best'}
              </Text>
            </View>
          </View>
        </View>
      </>
    );
  };

  const renderAttendance = () => {
    const sessions = attendance?.sessions || [];

    // Only days with at least one recorded status
    const daysWithRecords = (() => {
      if (!sessions.length) return [] as {
        date: string;
        weekday: string;
        statuses: Record<number, string>;
        comments: string[];
      }[];

      const map: Record<
        string,
        { statuses: Record<number, string>; comments: string[] }
      > = {};

      sessions.forEach((s) => {
        (s.daily || []).forEach((entry) => {
          const dateKey = entry.date ? entry.date.split('T')[0] : null;
          if (!dateKey) return;
          if (!map[dateKey]) map[dateKey] = { statuses: {}, comments: [] };
          map[dateKey].statuses[s.slotNumber] = entry.status;
          if (entry.comments) map[dateKey].comments.push(entry.comments);
        });
      });

      return Object.keys(map)
        .sort()
        .map((dateKey) => {
          const d = getSafeDate(dateKey);
          const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          return {
            date: dateKey,
            weekday: weekdays[d.getDay()],
            statuses: map[dateKey].statuses,
            comments: map[dateKey].comments,
          };
        })
        .filter((r) => Object.keys(r.statuses).length > 0);
    })();

    return (
      <>
        <View style={styles.statsGrid}>
          <StatTile
            label={t('reports.attendance.total') || 'Total'}
            value={`${attendance?.summary?.total || 0}`}
            icon="albums"
            color={COLORS.slate}
            bg="#F1F5F9"
          />
          <StatTile
            label={t('reports.attendance.present') || 'Present'}
            value={`${attendance?.summary?.present || 0}`}
            icon="checkmark-circle"
            color={COLORS.primary}
            bg={COLORS.primaryLight}
          />
          <StatTile
            label={t('reports.attendance.absent') || 'Absent'}
            value={`${attendance?.summary?.absent || 0}`}
            icon="close-circle"
            color={COLORS.red}
            bg={COLORS.redLight}
          />
          <StatTile
            label={t('reports.attendance.late') || 'Late'}
            value={`${attendance?.summary?.late || 0}`}
            icon="time"
            color={COLORS.amber}
            bg={COLORS.amberLight}
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            title={t('reports.attendance.dailyRecords') || 'Daily records'}
            subtitle={periodLabel}
            icon="calendar"
          />

          {daysWithRecords.length === 0 ? (
            <Text style={styles.emptyText}>
              {t('reports.attendance.noSessionData') ||
                'No attendance data for this period.'}
            </Text>
          ) : (
            daysWithRecords.map((day) => {
              const slots = Object.keys(day.statuses)
                .map(Number)
                .sort((a, b) => a - b);
              return (
                <View key={day.date} style={styles.dayRow}>
                  <View style={styles.dayLeft}>
                    <Text style={styles.dayDate}>
                      {formatShortDate(day.date)}
                    </Text>
                    <Text style={styles.dayName}>{day.weekday}</Text>
                  </View>
                  <View style={styles.dayStatuses}>
                    {slots.map((slot) => {
                      const status = day.statuses[slot];
                      const c = getStatusColorLocal(status);
                      const key = STATUS_KEY[status];
                      return (
                        <View
                          key={slot}
                          style={[
                            styles.sessionPill,
                            { backgroundColor: c.bg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.sessionPillText,
                              { color: c.text },
                            ]}
                          >
                            S{slot}:{' '}
                            {key
                              ? t(`reports.statusBadges.${key}`)
                              : status}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </>
    );
  };

  const renderMemorization = () => (
    <>
      <View style={styles.statsGrid}>
        <StatTile
          label={t('reports.memorization.records') || 'Records'}
          value={`${memStats.total}`}
          icon="book"
          color={COLORS.primary}
          bg={COLORS.primaryLight}
        />
        <StatTile
          label={t('reports.memorization.average') || 'Average'}
          value={`${memStats.avgScore}/10`}
          icon="star"
          color={COLORS.gold}
          bg={COLORS.goldLight}
        />
        <StatTile
          label={t('reports.memorization.best') || 'Best'}
          value={`${memStats.bestScore}/10`}
          icon="trophy"
          color={COLORS.purple}
          bg={COLORS.purpleLight}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      >
        <TouchableOpacity
          style={[styles.chip, memFilter === 'all' && styles.chipActive]}
          onPress={() => setMemFilter('all')}
        >
          <Text
            style={[
              styles.chipText,
              memFilter === 'all' && styles.chipTextActive,
            ]}
          >
            {t('reports.memorization.all', {
              count: memorization?.allRecords?.length || 0,
            })}
          </Text>
        </TouchableOpacity>
        {ACHIEVEMENT_TYPES.map((type) => {
          const active = memFilter === type.value;
          const count = memorization?.byType?.[type.value]?.length || 0;
          return (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.chip,
                active && {
                  backgroundColor: type.color,
                  borderColor: type.color,
                },
              ]}
              onPress={() => setMemFilter(type.value)}
            >
              <Text
                style={[styles.chipText, active && styles.chipTextActive]}
              >
                {t(`reports.achievementTypes.${type.labelKey}`)} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.card}>
        {filteredRecords.length === 0 ? (
          <Text style={styles.emptyText}>
            {t('reports.noRecordsForFilter') || 'No records.'}
          </Text>
        ) : (
          filteredRecords.map((r) => {
            const typeInfo = ACHIEVEMENT_TYPES.find(
              (tp) => tp.value === r.type
            );
            const isSubac = r.type === 'subac';
            const isTashiih = r.type === 'tashiih';
            const showAttempt = !isSubac && !isTashiih;
            const scoreText = isSubac
              ? `${r.score}/${r.totalMarks || 100}`
              : `${r.score}/10`;
            const scoreGood = isSubac ? r.score >= 80 : r.score >= 9;
            const scoreMid = isSubac ? r.score >= 50 : r.score >= 7;
            return (
              <View
                key={r._id || `${r.date}-${r.type}-${r.score}`}
                style={styles.memRow}
              >
                <View
                  style={[
                    styles.memIcon,
                    { backgroundColor: typeInfo?.bg || '#F1F5F9' },
                  ]}
                >
                  <Ionicons
                    name="book"
                    size={16}
                    color={typeInfo?.color || COLORS.slate}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.memTopRow}>
                    <Text
                      style={[styles.memType, { color: typeInfo?.color }]}
                    >
                      {typeInfo
                        ? t(`reports.achievementTypes.${typeInfo.labelKey}`)
                        : r.type}
                    </Text>
                    {showAttempt && (
                      <Text style={styles.memAttempt}>
                        {t('reports.attempt', { n: r.attempt || 1 })}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.memRange} numberOfLines={1}>
                    {formatRangeShort(r)}
                  </Text>
                  <Text style={styles.memDate}>
                    {formatShortDate(r.date)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.memScore,
                    {
                      backgroundColor: scoreGood
                        ? COLORS.primaryLight
                        : scoreMid
                        ? COLORS.amberLight
                        : COLORS.redLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.memScoreText,
                      {
                        color: scoreGood
                          ? COLORS.primary
                          : scoreMid
                          ? COLORS.amber
                          : COLORS.red,
                      },
                    ]}
                  >
                    {scoreText}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </>
  );

  const renderExams = () => (
    <View style={styles.card}>
      <SectionHeader
        title={t('reports.exams.title') || 'Exams'}
        subtitle={t('reports.exams.subtitle', { count: exams.length })}
        icon="trophy"
      />
      {exams.length === 0 ? (
        <Text style={styles.emptyText}>
          {t('reports.noExamsRecorded') || 'No exams recorded.'}
        </Text>
      ) : (
        exams.map((exam, i) => {
          const isReading = getExamFormType(exam as any) === 'reading';
          return (
            <TouchableOpacity
              key={exam._id || `exam-${i}`}
              style={styles.examRow}
              onPress={() => setSelectedExam(exam)}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.examIconWrap,
                  {
                    backgroundColor:
                      exam.status === 'Pass'
                        ? COLORS.primaryLight
                        : COLORS.redLight,
                  },
                ]}
              >
                <Ionicons
                  name="trophy"
                  size={18}
                  color={exam.status === 'Pass' ? COLORS.primary : COLORS.red}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.examTopRow}>
                  <Text style={styles.examType} numberOfLines={1}>
                    {exam.type || t('reports.exams.monthly')}
                  </Text>
                  <View
                    style={[
                      styles.examFormTag,
                      {
                        backgroundColor: isReading
                          ? COLORS.purpleLight
                          : COLORS.blueLight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.examFormTagText,
                        {
                          color: isReading
                            ? COLORS.purple
                            : COLORS.blue,
                        },
                      ]}
                    >
                      {isReading
                        ? t('reports.exams.reading') || 'Reading'
                        : t('reports.exams.memorization') || 'Memorization'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.examMeta}>
                  {formatShortDate(exam.date)} • {exam.halaqah || '-'}
                </Text>
              </View>
              <View style={styles.examRight}>
                <Text style={styles.examScoreMini}>
                  {round1(exam.score || 0)}/
                  {exam.total || exam.totalMarks || 100}
                </Text>
                <Badge status={exam.status || 'Pass'} />
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={COLORS.gray}
              />
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );

  const renderBehavior = () => (
    <>
      <View style={styles.statsGrid}>
        <StatTile
          label={t('reports.behavior.good') || 'Good'}
          value={`${behavior.filter((b) => b.type === 'good').length}`}
          icon="thumbs-up"
          color={COLORS.primary}
          bg={COLORS.primaryLight}
        />
        <StatTile
          label={t('reports.behavior.bad') || 'Bad'}
          value={`${behavior.filter((b) => b.type === 'bad').length}`}
          icon="thumbs-down"
          color={COLORS.red}
          bg={COLORS.redLight}
        />
        <StatTile
          label={t('reports.behavior.netPoints') || 'Net points'}
          value={`${behaviorPoints > 0 ? '+' : ''}${behaviorPoints}`}
          icon="star"
          color={behaviorPoints >= 0 ? COLORS.primary : COLORS.red}
          bg={behaviorPoints >= 0 ? COLORS.primaryLight : COLORS.redLight}
        />
      </View>

      <View style={styles.card}>
        <SectionHeader
          title={t('reports.behavior.title') || 'Behavior'}
          subtitle={periodLabel}
          icon="heart"
        />
        {behavior.length === 0 ? (
          <Text style={styles.emptyText}>
            {t('reports.noBehaviorRecords') || 'No behavior records.'}
          </Text>
        ) : (
          behavior.map((b, i) => (
            <View
              key={b._id || `beh-${i}`}
              style={[
                styles.behaviorRow,
                {
                  backgroundColor:
                    b.type === 'good'
                      ? COLORS.primaryLight
                      : COLORS.redLight,
                },
              ]}
            >
              <View
                style={[
                  styles.behaviorIcon,
                  {
                    backgroundColor:
                      b.type === 'good' ? COLORS.primary : COLORS.red,
                  },
                ]}
              >
                <Ionicons
                  name={b.type === 'good' ? 'thumbs-up' : 'thumbs-down'}
                  size={16}
                  color="#fff"
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.behaviorDesc} numberOfLines={2}>
                  {b.description}
                </Text>
                <Text style={styles.behaviorMeta} numberOfLines={1}>
                  {formatShortDate(b.date)}
                  {b.category ? ` • ${b.category}` : ''}
                  {b.severity ? ` • ${b.severity}` : ''}
                  {b.recordedBy
                    ? ` • ${t('reports.by', { name: b.recordedBy })}`
                    : ''}
                </Text>
              </View>
              <Text
                style={[
                  styles.behaviorPoints,
                  { color: b.type === 'good' ? COLORS.primary : COLORS.red },
                ]}
              >
                {b.points > 0 ? '+' : ''}
                {b.points}
              </Text>
            </View>
          ))
        )}
      </View>
    </>
  );

  const renderFinance = () => (
    <>
      <View style={styles.statsGrid}>
        <StatTile
          label={t('reports.finance.billed') || 'Billed'}
          value={`$${(finance?.summary?.totalDue || 0).toFixed(2)}`}
          icon="document-text"
          color={COLORS.blue}
          bg={COLORS.blueLight}
        />
        <StatTile
          label={t('reports.finance.paid') || 'Paid'}
          value={`$${(finance?.summary?.totalPaid || 0).toFixed(2)}`}
          icon="checkmark-circle"
          color={COLORS.primary}
          bg={COLORS.primaryLight}
        />
        <StatTile
          label={t('reports.finance.balance') || 'Balance'}
          value={`$${(finance?.summary?.balance || 0).toFixed(2)}`}
          icon="wallet"
          color={
            (finance?.summary?.balance || 0) > 0 ? COLORS.red : COLORS.primary
          }
          bg={
            (finance?.summary?.balance || 0) > 0
              ? COLORS.redLight
              : COLORS.primaryLight
          }
        />
      </View>

      <View style={styles.card}>
        <SectionHeader
          title={t('reports.finance.feeBreakdown') || 'Fee breakdown'}
          icon="list"
        />
        {(finance?.breakdown || []).length === 0 ? (
          <Text style={styles.emptyText}>
            {t('reports.noFeeRecords') || 'No fee records.'}
          </Text>
        ) : (
          finance!.breakdown!.map((item, i) => (
            <View key={item._id || `fee-${i}`} style={styles.financeRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.financeDesc} numberOfLines={1}>
                  {item.description}
                </Text>
                <Text style={styles.financeMeta}>
                  {formatShortDate(item.date)}
                  {item.dueDate
                    ? ` • ${t('reports.finance.due', {
                        date: formatShortDate(item.dueDate),
                      })}`
                    : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.financeAmount}>
                  ${(item.amount || 0).toFixed(2)}
                </Text>
                <Badge status={item.status || 'Unpaid'} />
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <SectionHeader
          title={
            t('reports.finance.paymentHistory') || 'Payment history'
          }
          icon="cash"
        />
        {(finance?.payments || []).length === 0 ? (
          <Text style={styles.emptyText}>
            {t('reports.noPaymentsRecorded') || 'No payments recorded.'}
          </Text>
        ) : (
          finance!.payments!.map((p, i) => (
            <View key={p._id || `pay-${i}`} style={styles.financeRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.financeDesc}>
                  {p.method || t('reports.paymentFallback') || 'Payment'}
                </Text>
                <Text style={styles.financeMeta}>
                  {formatShortDate(p.date)}
                  {p.reference ? ` • ${p.reference}` : ''}
                </Text>
              </View>
              <Text
                style={[styles.financeAmount, { color: COLORS.primary }]}
              >
                +${(p.amount || 0).toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </View>
    </>
  );

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {t('reports.headerTitle') || 'Reports'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {t('reports.headerSubtitle') || 'Student performance reports'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowSchoolSettings(true)}
          >
            <Ionicons
              name="settings-outline"
              size={20}
              color={COLORS.slate}
            />
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
          <TouchableOpacity onPress={() => setError('')}>
            <Ionicons name="close" size={14} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* STUDENT SELECTOR */}
      <TouchableOpacity
        style={styles.studentSelector}
        onPress={() => setShowStudentSearch(true)}
        activeOpacity={0.75}
      >
        <View style={styles.studentSelectorIcon}>
          <Ionicons name="person" size={18} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.studentSelectorLabel}>
            {t('reports.student') || 'Student'}
          </Text>
          <Text
            style={styles.studentSelectorValue}
            numberOfLines={1}
          >
            {selectedStudent
              ? selectedStudent.name
              : t('reports.tapToSelectStudent') || 'Tap to select a student'}
          </Text>
        </View>
        <Ionicons
          name="chevron-down"
          size={18}
          color={COLORS.slateMuted}
        />
      </TouchableOpacity>

      {/* PERIOD + PRINT ROW */}
      {selectedStudent && (
        <View style={styles.periodRow}>
          <TouchableOpacity
            style={styles.periodChip}
            onPress={() => setShowMonthPicker(true)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={period.mode === 'range' ? 'calendar-outline' : 'calendar'}
              size={14}
              color={COLORS.primary}
            />
            <Text style={styles.periodText} numberOfLines={1}>
              {periodLabel}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={COLORS.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.printBtn}
            onPress={() => setShowPrintModal(true)}
            disabled={!reportData}
            activeOpacity={0.85}
          >
            <Ionicons name="print" size={14} color="#fff" />
            <Text style={styles.printBtnText}>
              {t('reports.print.button') || 'Print'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* EMPTY STATE — no student */}
      {!selectedStudent && (
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIcon}>
            <Ionicons
              name="people-outline"
              size={42}
              color={COLORS.primary}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {t('reports.noStudentTitle') || 'No student selected'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t('reports.noStudentSubtitle') ||
              'Search for a student to view their report.'}
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => setShowStudentSearch(true)}
          >
            <Ionicons name="search" size={16} color="#fff" />
            <Text style={styles.emptyBtnText}>
              {t('reports.selectStudent') || 'Select student'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* LOADING */}
      {selectedStudent && loading && !reportData && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('reports.loadingReport') || 'Loading report…'}
          </Text>
        </View>
      )}

      {/* REPORT CONTENT */}
      {selectedStudent && reportData && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        >
          {/* Profile card */}
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {initials(student?.name)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.profileName} numberOfLines={1}>
                {student?.name || t('reports.unknownStudent') || 'Unknown'}
              </Text>
              <Text style={styles.profileMeta} numberOfLines={1}>
                {student?.regNo || t('reports.na')} •{' '}
                {getHalaqahName(student?.halaqah)}
              </Text>
            </View>
            <View style={styles.profileScore}>
              <Text style={styles.profileScoreValue}>
                {currentMonthScore.combined}%
              </Text>
              <Text style={styles.profileScoreLabel}>
                {t('reports.overall') || 'Overall'}
              </Text>
            </View>
          </View>

          {/* Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}
          >
            {TAB_KEYS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={tab.icon}
                    size={14}
                    color={active ? '#fff' : COLORS.slateMuted}
                  />
                  <Text
                    style={[styles.tabText, active && styles.tabTextActive]}
                  >
                    {t(`reports.tabs.${tab.labelKey}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'attendance' && renderAttendance()}
          {activeTab === 'memorization' && renderMemorization()}
          {activeTab === 'exams' && renderExams()}
          {activeTab === 'behavior' && renderBehavior()}
          {activeTab === 'finance' && renderFinance()}
        </ScrollView>
      )}

      {/* MODALS */}
      <ReportStudentSearchModal
        visible={showStudentSearch}
        onClose={() => setShowStudentSearch(false)}
        selectedStudent={selectedStudent}
        onSelect={(s) => {
          setSelectedStudent(s);
          setReportData(null);
          setActiveTab('overview');
          setMemFilter('all');
        }}
      />

      <ReportMonthPickerModal
        visible={showMonthPicker}
        period={period}
        onClose={() => setShowMonthPicker(false)}
        onChange={setPeriod}
      />

      <ReportSchoolSettingsModal
        visible={showSchoolSettings}
        schoolInfo={schoolInfo}
        onClose={() => setShowSchoolSettings(false)}
        onSave={handleSaveSchoolInfo}
      />

      <ReportPrintModal
        visible={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        onAction={handlePrintAction}
      />

      <ReportExamDetailsModal
        visible={!!selectedExam}
        exam={selectedExam}
        student={student || null}
        onClose={() => setSelectedExam(null)}
      />
    </SafeAreaView>
  );
};

// ============================================================
// SUBCOMPONENTS
// ============================================================
const StatTile: React.FC<{
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  subtitle?: string;
}> = ({ label, value, icon, color, bg, subtitle }) => (
  <View style={styles.statTile}>
    <View style={[styles.statIconWrap, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel} numberOfLines={1}>
      {label}
    </Text>
    {subtitle ? (
      <Text style={styles.statSubtitle} numberOfLines={1}>
        {subtitle}
      </Text>
    ) : null}
  </View>
);

const SectionHeader: React.FC<{
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = ({ title, subtitle, icon }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionIcon}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.sectionTitle} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.sectionSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  </View>
);

const Badge: React.FC<{ status?: string }> = ({ status }) => {
  const { t } = useTranslation();
  if (!status) return null;
  const c = getStatusColorLocal(status);
  const key = STATUS_KEY[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>
        {key ? t(`reports.statusBadges.${key}`) : status}
      </Text>
    </View>
  );
};

// ============================================================
// HELPERS
// ============================================================
const getCurrentMonthKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getStatusColorLocal = (status?: string) => {
  switch (status) {
    case 'Present':
    case 'Pass':
    case 'Paid':
    case 'Published':
      return { bg: COLORS.primaryLight, text: COLORS.primary };
    case 'Absent':
    case 'Fail':
    case 'Unpaid':
      return { bg: COLORS.redLight, text: COLORS.red };
    case 'Late':
    case 'Partial':
      return { bg: COLORS.amberLight, text: COLORS.amber };
    case 'Excused':
      return { bg: COLORS.blueLight, text: COLORS.blue };
    default:
      return { bg: '#F1F5F9', text: COLORS.slateMuted };
  }
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
  },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 6,
    padding: 10,
    backgroundColor: COLORS.redLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F6C8C8',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.red,
    fontWeight: '600',
  },

  // Student selector
  studentSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  studentSelectorIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentSelectorLabel: {
    fontSize: 10,
    color: COLORS.slateMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  studentSelectorValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate,
    marginTop: 2,
  },

  // Period + print row
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
  },
  periodChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  periodText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  printBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Empty / loading
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyStateIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.slateMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  loadingWrap: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: COLORS.slateMuted, fontSize: 13 },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { color: '#fff', fontWeight: '800', fontSize: 22 },
  profileName: { fontSize: 16, fontWeight: '800', color: COLORS.slate },
  profileMeta: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
  profileScore: { alignItems: 'flex-end' },
  profileScoreValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
  },
  profileScoreLabel: {
    fontSize: 9,
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },

  // Tabs
  tabsScroll: { marginTop: 14, maxHeight: 44 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.slateMuted },
  tabTextActive: { color: '#fff' },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginTop: 14,
    gap: 8,
  },
  statTile: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  statLabel: {
    fontSize: 10,
    color: COLORS.slateMuted,
    marginTop: 2,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statSubtitle: { fontSize: 10, color: COLORS.gray, marginTop: 4 },

  // Card
  card: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.slate },
  sectionSubtitle: { fontSize: 11, color: COLORS.slateMuted, marginTop: 1 },

  // Chart
  chartScrollContent: { paddingVertical: 4 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    minHeight: 180,
  },
  chartCol: {
    alignItems: 'center',
    width: 52,
  },
  chartValue: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.slate,
    marginBottom: 4,
  },
  chartBarWrap: {
    width: 24,
    height: 120,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    borderRadius: 6,
  },
  chartBarActive: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  chartMonth: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slate,
    marginTop: 6,
  },
  chartYear: { fontSize: 9, color: COLORS.slateMuted },
  chartLegend: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  chartLegendText: {
    fontSize: 10,
    color: COLORS.slateMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Breakdown
  breakdownGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  breakdownTile: {
    width: '31%',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  breakdownCount: { fontSize: 18, fontWeight: '800' },
  breakdownLabel: {
    fontSize: 10,
    color: COLORS.slateMuted,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '600',
  },

  // Exam summary
  examSummaryGrid: { flexDirection: 'row', gap: 8 },
  examSummaryTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  examSummaryValue: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  examSummaryLabel: {
    fontSize: 10,
    color: COLORS.slateMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },

  // Attendance rows
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dayLeft: { width: 78 },
  dayDate: { fontSize: 12, fontWeight: '700', color: COLORS.slate },
  dayName: { fontSize: 10, color: COLORS.slateMuted, marginTop: 1 },
  dayStatuses: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  sessionPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  sessionPillText: { fontSize: 10, fontWeight: '700' },

  // Memorization chips
  chipScroll: { marginTop: 12, maxHeight: 42 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.slateMuted },
  chipTextActive: { color: '#fff' },

  // Memorization rows
  memRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  memIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memType: { fontSize: 12, fontWeight: '700' },
  memAttempt: {
    fontSize: 10,
    color: COLORS.slateMuted,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  memRange: {
    fontSize: 12,
    color: COLORS.slate,
    marginTop: 2,
    fontWeight: '600',
  },
  memDate: { fontSize: 10, color: COLORS.slateMuted, marginTop: 1 },
  memScore: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  memScoreText: { fontSize: 13, fontWeight: '800' },

  // Exams rows
  examRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  examIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  examType: { fontSize: 13, fontWeight: '700', color: COLORS.slate },
  examFormTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  examFormTagText: { fontSize: 9, fontWeight: '800' },
  examMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  examRight: { alignItems: 'flex-end', gap: 4 },
  examScoreMini: { fontSize: 12, fontWeight: '700', color: COLORS.slate },

  // Behavior
  behaviorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  behaviorIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  behaviorDesc: { fontSize: 13, fontWeight: '600', color: COLORS.slate },
  behaviorMeta: { fontSize: 10, color: COLORS.slateMuted, marginTop: 2 },
  behaviorPoints: { fontSize: 16, fontWeight: '800' },

  // Finance
  financeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  financeDesc: { fontSize: 13, fontWeight: '600', color: COLORS.slate },
  financeMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  financeAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slate,
    marginBottom: 4,
  },

  // Badge
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  // Empty
  emptyText: {
    fontSize: 13,
    color: COLORS.gray,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default ReportsScreen;