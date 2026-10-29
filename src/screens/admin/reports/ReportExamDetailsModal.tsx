// src/screens/admin/reports/ReportExamDetailsModal.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  COLORS,
  Exam,
  ExamColumn,
  Student,
  getExamFormType,
  getVisibleExamColumns,
  computeQuestionContribution,
  formatShortDate,
  getHalaqahName,
  getJuzName,
  getSurahArabic,
  getSurahName,
  round1,
} from './_shared';

// ============================================================
// TYPES
// ============================================================
interface ReportExamDetailsModalProps {
  visible: boolean;
  exam: Exam | null;
  student: Student | null;
  onClose: () => void;
}

// ============================================================
// HELPERS
// ============================================================
const initials = (name?: string): string => {
  const s = (name || '').trim();
  if (!s) return '?';
  const parts = s.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.substring(0, 2).toUpperCase();
};

const ORDINAL_KEYS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
];

// ============================================================
// MAIN
// ============================================================
export const ReportExamDetailsModal: React.FC<
  ReportExamDetailsModalProps
> = ({ visible, exam, student, onClose }) => {
  const { t } = useTranslation();

  // ----------------------------------------------------------------
  // Derived — safe when exam is null
  // ----------------------------------------------------------------
  const derived = useMemo(() => {
    if (!exam) {
      return {
        formType: 'memorization' as const,
        visibleColumns: [] as ExamColumn[],
        marksPer: {} as Record<string, number>,
        totalDeduction: 0,
        obtained: 0,
        totalMarks: 100,
        percentage: 0,
        passingMark: 60,
        status: 'Pass' as 'Pass' | 'Fail',
        positiveNotes: '',
        negativeNotes: '',
        examiners: [] as string[],
        scopeLabel: null as string | null,
        questions: [],
      };
    }

    const formType = getExamFormType(exam);
    const visibleColumns = getVisibleExamColumns(exam);
    const marksPer =
      exam.marksPer || { fathi: 1, lahni: 1, tajwid: 1, ruju: 1 };
    const questions = exam.questions || [];

    const totalDeduction = questions.reduce(
      (sum, q) => sum + computeQuestionContribution(q, visibleColumns, marksPer),
      0
    );

    const totalMarks = exam.totalMarks || exam.total || 100;
    const obtained = round1(
      exam.obtainedMarks != null
        ? exam.obtainedMarks
        : Math.max(0, totalMarks - totalDeduction)
    );
    const percentage = round1(
      exam.percentage != null
        ? exam.percentage
        : totalMarks > 0
        ? (obtained / totalMarks) * 100
        : 0
    );
    const passingMark = exam.passingMark || 60;
    const status: 'Pass' | 'Fail' =
      exam.status || (percentage >= passingMark ? 'Pass' : 'Fail');

    const positiveNotes =
      typeof exam.notes === 'string'
        ? exam.notes
        : exam.notes?.positive || '';
    const negativeNotes =
      typeof exam.notes === 'object'
        ? exam.notes?.negative || ''
        : '';

    const examiners =
      exam.examiners && exam.examiners.length > 0
        ? exam.examiners
        : exam.examiner
        ? [exam.examiner]
        : [];

    // Scope for memorization exams
    let scopeLabel: string | null = null;
    if (formType === 'memorization') {
      if (exam.examScope === 'juz' || exam.fromJuz) {
        const from = exam.fromJuz
          ? `Juz ${exam.fromJuz} (${getJuzName(exam.fromJuz)})`
          : '';
        const to = exam.toJuz
          ? `Juz ${exam.toJuz} (${getJuzName(exam.toJuz)})`
          : '';
        scopeLabel = [from, to].filter(Boolean).join(' → ') || null;
      } else if (exam.fromSurah) {
        const from = `${getSurahName(exam.fromSurah)}${
          getSurahArabic(exam.fromSurah) ? ` (${getSurahArabic(exam.fromSurah)})` : ''
        }`;
        const to =
          exam.toSurah && exam.toSurah !== exam.fromSurah
            ? `${getSurahName(exam.toSurah)}${
                getSurahArabic(exam.toSurah)
                  ? ` (${getSurahArabic(exam.toSurah)})`
                  : ''
              }`
            : '';
        scopeLabel = to ? `${from} → ${to}` : from;
      }
    }

    return {
      formType,
      visibleColumns,
      marksPer,
      totalDeduction,
      obtained,
      totalMarks,
      percentage,
      passingMark,
      status,
      positiveNotes,
      negativeNotes,
      examiners,
      scopeLabel,
      questions,
    };
  }, [exam]);

  // ----------------------------------------------------------------
  // Guard — but AFTER the memo
  // ----------------------------------------------------------------
  if (!exam) return null;

  const {
    formType,
    visibleColumns,
    marksPer,
    totalDeduction,
    obtained,
    totalMarks,
    percentage,
    passingMark,
    status,
    positiveNotes,
    negativeNotes,
    examiners,
    scopeLabel,
    questions,
  } = derived;

  const isReading = formType === 'reading';
  const displayStudentName = student?.name || exam.studentName || '';
  const displayHalaqah =
    exam.halaqah || getHalaqahName(student?.halaqah) || '-';

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {t('reports.examDetails.title') || 'Exam Details'}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {displayStudentName}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* ---------- PROFILE ---------- */}
            <View style={styles.profile}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {initials(displayStudentName)}
                </Text>
              </View>
              <Text style={styles.profileName}>{displayStudentName}</Text>
              <View style={styles.profileMetaRow}>
                <View style={styles.tagRow}>
                  <View
                    style={[
                      styles.tag,
                      {
                        backgroundColor: isReading
                          ? COLORS.purpleLight
                          : COLORS.blueLight,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isReading ? 'book' : 'school'}
                      size={10}
                      color={isReading ? COLORS.purple : COLORS.blue}
                    />
                    <Text
                      style={[
                        styles.tagText,
                        {
                          color: isReading ? COLORS.purple : COLORS.blue,
                        },
                      ]}
                    >
                      {isReading
                        ? t('reports.exams.reading') || 'Reading'
                        : t('reports.exams.memorization') || 'Memorization'}
                    </Text>
                  </View>
                  {exam.isPublished ? (
                    <View
                      style={[
                        styles.tag,
                        { backgroundColor: COLORS.primaryLight },
                      ]}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={10}
                        color={COLORS.primary}
                      />
                      <Text
                        style={[styles.tagText, { color: COLORS.primary }]}
                      >
                        {t('reports.exams.published') || 'Published'}
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={[styles.tag, { backgroundColor: '#F1F5F9' }]}
                    >
                      <Ionicons name="eye-off" size={10} color={COLORS.gray} />
                      <Text
                        style={[styles.tagText, { color: COLORS.gray }]}
                      >
                        {t('reports.exams.draft') || 'Draft'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.profileMetaText}>
                  {exam.type || t('reports.exams.monthly') || 'Monthly'} ·{' '}
                  {formatShortDate(exam.date)}
                </Text>
                <Text style={styles.profileMetaText}>{displayHalaqah}</Text>
              </View>
            </View>

            {/* ---------- SCORE CARD ---------- */}
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>
                {t('reports.examDetails.score') || 'Score'}
              </Text>
              <Text style={styles.scoreValue}>
                {obtained}
                <Text style={styles.scoreTotal}>/{totalMarks}</Text>
              </Text>
              <Text
                style={[
                  styles.scorePct,
                  {
                    color:
                      percentage >= passingMark ? COLORS.primary : COLORS.red,
                  },
                ]}
              >
                {percentage}%
              </Text>

              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(percentage, 100)}%`,
                      backgroundColor:
                        percentage >= passingMark
                          ? COLORS.primary
                          : COLORS.red,
                    },
                  ]}
                />
              </View>

              <View style={styles.scoreMiniRow}>
                <View style={styles.scoreMiniTile}>
                  <Text style={styles.scoreMiniLabel}>
                    {t('reports.examDetails.totalMarks') || 'Total'}
                  </Text>
                  <Text style={styles.scoreMiniValue}>{totalMarks}</Text>
                </View>
                <View style={styles.scoreMiniDivider} />
                <View style={styles.scoreMiniTile}>
                  <Text style={styles.scoreMiniLabel}>
                    {t('reports.examDetails.totalDeduction') || 'Deduction'}
                  </Text>
                  <Text
                    style={[
                      styles.scoreMiniValue,
                      {
                        color:
                          totalDeduction > 0 ? COLORS.red : COLORS.primary,
                      },
                    ]}
                  >
                    {round1(totalDeduction)}
                  </Text>
                </View>
                <View style={styles.scoreMiniDivider} />
                <View style={styles.scoreMiniTile}>
                  <Text style={styles.scoreMiniLabel}>
                    {t('reports.examDetails.status') || 'Status'}
                  </Text>
                  <Text
                    style={[
                      styles.scoreMiniValue,
                      {
                        color:
                          status === 'Pass' ? COLORS.primary : COLORS.red,
                      },
                    ]}
                  >
                    {status === 'Pass'
                      ? t('reports.statusBadges.pass') || 'Pass'
                      : t('reports.statusBadges.fail') || 'Fail'}
                  </Text>
                </View>
              </View>
            </View>

            {/* ---------- SCOPE (memorization only) ---------- */}
            {!isReading && scopeLabel ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>
                  {t('reports.examDetails.examScope') || 'Exam scope'}
                </Text>
                <View style={styles.scopeBox}>
                  <Ionicons
                    name="book-outline"
                    size={16}
                    color={COLORS.primary}
                  />
                  <Text style={styles.scopeText} numberOfLines={2}>
                    {scopeLabel}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* ---------- PER-QUESTION TABLE (memorization) ---------- */}
            {!isReading && questions.length > 0 ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>
                  {t('reports.examDetails.questionWise') ||
                    'Question-wise breakdown'}
                </Text>

                <View style={styles.table}>
                  {/* Header */}
                  <View style={[styles.tableRow, styles.tableHeaderRow]}>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableHeaderText,
                        styles.colQ,
                      ]}
                    >
                      {t('reports.examDetails.question') || 'Q'}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableHeaderText,
                        styles.colPage,
                      ]}
                    >
                      {t('reports.examDetails.page') || 'Page'}
                    </Text>
                    {visibleColumns.map((col) => (
                      <Text
                        key={col.id}
                        style={[
                          styles.tableCell,
                          styles.tableHeaderText,
                          { color: '#fff' },
                        ]}
                        numberOfLines={1}
                      >
                        {col.label}
                        <Text
                          style={{
                            fontSize: 9,
                            color: 'rgba(255,255,255,0.75)',
                          }}
                        >
                          {col.isAdditive === false ? ' −' : ' +'}
                        </Text>
                      </Text>
                    ))}
                    <Text
                      style={[
                        styles.tableCell,
                        styles.tableHeaderText,
                        styles.colDeduct,
                      ]}
                    >
                      {t('reports.examDetails.deduction') || 'Δ'}
                    </Text>
                  </View>

                  {/* Rows */}
                  {questions.map((q, idx) => {
                    const total = computeQuestionContribution(
                      q,
                      visibleColumns,
                      marksPer
                    );
                    const label =
                      idx < ORDINAL_KEYS.length
                        ? t(
                            `reports.examDetails.ordinals.${ORDINAL_KEYS[idx]}`
                          ) || `Q${idx + 1}`
                        : `${idx + 1}`;
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.tableRow,
                          idx % 2 === 1 && styles.tableRowAlt,
                        ]}
                      >
                        <Text
                          style={[
                            styles.tableCell,
                            styles.cellText,
                            styles.colQ,
                          ]}
                          numberOfLines={1}
                        >
                          {label}
                        </Text>
                        <Text
                          style={[
                            styles.tableCell,
                            styles.cellText,
                            styles.colPage,
                          ]}
                        >
                          {q.page || '-'}
                        </Text>
                        {visibleColumns.map((col) => {
                          let fieldKey: string = col.key;
                          if (col.key === 'rujuc') fieldKey = 'ruju';
                          const value =
                            q.customColumns &&
                            q.customColumns[col.key] !== undefined
                              ? q.customColumns[col.key]
                              : (q as any)[fieldKey] || 0;
                          return (
                            <Text
                              key={col.id}
                              style={[styles.tableCell, styles.cellText]}
                            >
                              {value}
                            </Text>
                          );
                        })}
                        <Text
                          style={[
                            styles.tableCell,
                            styles.cellText,
                            styles.colDeduct,
                            {
                              color:
                                total > 0
                                  ? COLORS.primary
                                  : total < 0
                                  ? COLORS.red
                                  : COLORS.slateMuted,
                              fontWeight: '800',
                            },
                          ]}
                        >
                          {total > 0 ? '+' : ''}
                          {round1(total)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* ---------- NOTES ---------- */}
            <View style={styles.notesGrid}>
              <View
                style={[
                  styles.notesCard,
                  { backgroundColor: COLORS.primaryLight },
                ]}
              >
                <Text
                  style={[styles.notesLabel, { color: COLORS.primary }]}
                >
                  {t('reports.examDetails.positiveNotes') || 'Positive'}
                </Text>
                <Text style={styles.notesText}>
                  {positiveNotes ||
                    t('reports.examDetails.noPositiveNotes') || '—'}
                </Text>
              </View>
              <View
                style={[
                  styles.notesCard,
                  { backgroundColor: COLORS.amberLight },
                ]}
              >
                <Text
                  style={[styles.notesLabel, { color: COLORS.amber }]}
                >
                  {t('reports.examDetails.negativeNotes') ||
                    'Improvements'}
                </Text>
                <Text style={styles.notesText}>
                  {negativeNotes ||
                    t('reports.examDetails.noNegativeNotes') || '—'}
                </Text>
              </View>
            </View>

            {/* ---------- COMMITTEE ---------- */}
            {examiners.length > 0 ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>
                  {t('reports.examDetails.committee') || 'Exam committee'}
                </Text>
                {examiners.map((ex, i) => (
                  <View key={i} style={styles.committeeRow}>
                    <Ionicons
                      name="person-outline"
                      size={14}
                      color={COLORS.purple}
                    />
                    <Text style={styles.committeeName}>{ex}</Text>
                    <View style={styles.committeeLine} />
                  </View>
                ))}
              </View>
            ) : null}

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '94%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  subtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 20, paddingTop: 12 },

  // Profile
  profile: { alignItems: 'center', marginBottom: 14 },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  profileAvatarText: { fontSize: 26, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  profileMetaRow: { alignItems: 'center', marginTop: 6, gap: 4 },
  profileMetaText: { fontSize: 12, color: COLORS.slateMuted },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagText: { fontSize: 10, fontWeight: '700' },

  // Score card
  scoreCard: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 4,
  },
  scoreTotal: { fontSize: 18, color: COLORS.slateMuted, fontWeight: '600' },
  scorePct: { fontSize: 14, fontWeight: '800', marginTop: 4 },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: { height: '100%', borderRadius: 4 },
  scoreMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  scoreMiniTile: { flex: 1, alignItems: 'center' },
  scoreMiniLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
  },
  scoreMiniValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 2,
  },
  scoreMiniDivider: { width: 1, height: 24, backgroundColor: COLORS.border },

  // Blocks
  block: { marginTop: 4, marginBottom: 14 },
  blockTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },

  // Scope
  scopeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scopeText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.slate,
    fontWeight: '600',
  },

  // Table
  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowAlt: { backgroundColor: '#FAFBFC' },
  tableHeaderRow: {
    backgroundColor: COLORS.primaryDark,
    borderBottomColor: COLORS.primaryDark,
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
  },
  tableCell: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cellText: {
    fontSize: 12,
    color: COLORS.slate,
  },
  colQ: { flex: 0.9 },
  colPage: { flex: 0.8 },
  colDeduct: { flex: 1.1 },

  // Notes
  notesGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  notesCard: { flex: 1, borderRadius: 10, padding: 10 },
  notesLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  notesText: { fontSize: 12, color: COLORS.slate, lineHeight: 16 },

  // Committee
  committeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  committeeName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.slate,
  },
  committeeLine: {
    flex: 1,
    height: 1,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: COLORS.gray,
  },
});