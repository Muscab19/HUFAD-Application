// src/screens/admin/examinations/ExamDetailsModal.tsx
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
  ExamSettings,
  ReadingWritingHeader,
  ReadingWritingWeights,
  ReadingCategory,
  READING_CATEGORIES,
  DEFAULT_READING_HEADERS,
  DEFAULT_READING_WEIGHTS,
  round2,
  getExamFormType,
  getSurahName,
  getJuzName,
  getEnabledSkillHeaders,
  getEnabledCategories,
  getEffectiveWeights,
  getEffectiveMaxTotal,
  calculateExactSkillMaxes,
  calculateCategoryTotal,
  calculateGrandTotal,
} from './_shared';

// ============================================================
// TYPES
// ============================================================
interface ExamDetailsModalProps {
  visible: boolean;
  exam: Exam | null;
  settings: ExamSettings | null;
  onClose: () => void;
  onEdit: (exam: Exam) => void;
  onTogglePublish: (exam: Exam) => void;
  onDelete: (exam: Exam) => void;
}

// ============================================================
// MAIN
// ============================================================
export const ExamDetailsModal: React.FC<ExamDetailsModalProps> = ({
  visible,
  exam,
  settings,
  onClose,
  onEdit,
  onTogglePublish,
  onDelete,
}) => {
  const { t } = useTranslation();

  // ----------------------------------------------------------------
  // ⚠️  ALL hooks must run unconditionally, BEFORE any early return.
  // Every hook below guards against `exam === null` internally.
  // ----------------------------------------------------------------

  const formType = useMemo(
    () => (exam ? getExamFormType(exam) : 'memorization'),
    [exam]
  );

  const examiners = useMemo(
    () =>
      exam
        ? exam.examiners && exam.examiners.length > 0
          ? exam.examiners
          : exam.examiner
          ? [exam.examiner]
          : []
        : [],
    [exam]
  );

  // ----------------------------------------------------------------
  // Reading context — safe when exam/settings are null
  // ----------------------------------------------------------------
  const readingContext = useMemo(() => {
    if (!exam || formType !== 'reading') return null;

    const headers: ReadingWritingHeader[] =
      exam.readingWritingHeaders ||
      settings?.readingWritingHeaders ||
      DEFAULT_READING_HEADERS;

    const weights: ReadingWritingWeights =
      exam.readingWritingWeights ||
      settings?.readingWritingWeights ||
      DEFAULT_READING_WEIGHTS;

    const enabledSkills = exam.enabledSkills || null;
    const enabledCategories = exam.enabledCategories || null;

    const enabledSkillsList = getEnabledSkillHeaders(headers, enabledSkills);
    const enabledCatsList = getEnabledCategories(enabledCategories);
    const effectiveWeights = getEffectiveWeights(weights, enabledCategories);

    const exactMaxes = calculateExactSkillMaxes(
      enabledSkillsList,
      effectiveWeights
    );

    const scores = exam.readingWritingScores || {};

    const readingTotal = calculateCategoryTotal(
      scores,
      enabledSkillsList,
      'readingScore'
    );
    const writingTotal = calculateCategoryTotal(
      scores,
      enabledSkillsList,
      'writingScore'
    );
    const hijaaTotal = calculateCategoryTotal(
      scores,
      enabledSkillsList,
      'hijaa'
    );
    const ayahsTotal = calculateCategoryTotal(
      scores,
      enabledSkillsList,
      'ayahs'
    );
    const grandTotal = calculateGrandTotal(
      scores,
      enabledSkillsList,
      enabledCatsList
    );
    const maxTotal = getEffectiveMaxTotal(weights, enabledCategories);
    const percentage =
      maxTotal > 0 ? round2((grandTotal / maxTotal) * 100) : 0;

    return {
      headers,
      weights,
      enabledSkillsList,
      enabledCatsList,
      effectiveWeights,
      exactMaxes,
      scores,
      readingTotal,
      writingTotal,
      hijaaTotal,
      ayahsTotal,
      grandTotal,
      maxTotal,
      percentage,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam, settings, formType]);

  // ----------------------------------------------------------------
  // Dynamic actual total marks
  // ----------------------------------------------------------------
  const actualTotalMarks = useMemo(() => {
    if (!exam) return 100;
    if (formType === 'reading' && readingContext) {
      return readingContext.maxTotal;
    }
    return exam.totalMarks || 100;
  }, [formType, readingContext, exam]);

  // ----------------------------------------------------------------
  // Derived numbers — safe when exam is null
  // ----------------------------------------------------------------
  const derived = useMemo(() => {
    if (!exam) {
      return {
        obtained: 0,
        deduction: 0,
        pct: 0,
        passingMark: 60,
        formTypeLabel: '',
        dateLabel: '—',
        scopeLabel: null as string | null,
      };
    }

    const obtained = round2(exam.obtainedMarks || 0);
    const deduction = round2(Math.max(0, actualTotalMarks - obtained));
    const pct =
      actualTotalMarks > 0
        ? round2((obtained / actualTotalMarks) * 100)
        : 0;
    const passingMark =
      exam.passingMark ||
      (formType === 'reading'
        ? settings?.passingMarkReadingWriting ?? 60
        : settings?.passingMark ?? 60);

    const formTypeLabel =
      formType === 'reading'
        ? t('examinations.formTypes.reading')
        : t('examinations.formTypes.memorization');

    const raw = exam.dateGregorian || exam.date;
    let dateLabel = t('examinations.details.notAvailable');
    if (raw) {
      try {
        dateLabel = new Date(raw).toLocaleDateString();
      } catch {
        dateLabel = String(raw);
      }
    }

    const scopeLabel = exam.examScope
      ? exam.examScope === 'surah'
        ? `${getSurahName(exam.fromSurah)} → ${getSurahName(exam.toSurah)}`
        : `${getJuzName(exam.fromJuz)} → ${getJuzName(exam.toJuz)}`
      : null;

    return {
      obtained,
      deduction,
      pct,
      passingMark,
      formTypeLabel,
      dateLabel,
      scopeLabel,
    };
  }, [exam, formType, settings, actualTotalMarks, t]);

  // ----------------------------------------------------------------
  // ⚠️  EARLY RETURN — must be AFTER all hook calls above.
  // ----------------------------------------------------------------
  if (!exam) return null;

  const {
    obtained,
    deduction,
    pct,
    passingMark,
    formTypeLabel,
    dateLabel,
    scopeLabel,
  } = derived;

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
                {t('examinations.details.title') || 'Exam Details'}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {exam.studentName}
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
            {/* ============ SUMMARY CARD ============ */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryAvatar}>
                <Text style={styles.summaryAvatarText}>
                  {exam.studentName?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
              <Text style={styles.summaryName}>{exam.studentName}</Text>
              <Text style={styles.summaryMeta}>
                {exam.halaqah} · {exam.examType}
              </Text>

              <View style={styles.summaryScoreBox}>
                <Text style={styles.summaryScoreValue}>{obtained}</Text>
                <Text style={styles.summaryScoreTotal}>
                  / {actualTotalMarks}
                </Text>
              </View>

              <View style={styles.summaryProgress}>
                <View
                  style={[
                    styles.summaryProgressFill,
                    {
                      width: `${Math.min(pct, 100)}%`,
                      backgroundColor:
                        pct >= passingMark ? COLORS.primary : COLORS.red,
                    },
                  ]}
                />
              </View>
              <Text style={styles.summaryPct}>
                {pct}% ·{' '}
                <Text
                  style={{
                    color: pct >= passingMark ? COLORS.primary : COLORS.red,
                    fontWeight: '800',
                  }}
                >
                  {pct >= passingMark
                    ? t('examinations.status.pass') || 'Pass'
                    : t('examinations.status.fail') || 'Fail'}
                </Text>
              </Text>

              <View style={styles.summaryDeductionRow}>
                <View style={styles.summaryDeductionItem}>
                  <Text style={styles.summaryDeductionLabel}>
                    {t('examinations.details.totalMarks') || 'Total'}
                  </Text>
                  <Text style={styles.summaryDeductionValue}>
                    {actualTotalMarks}
                  </Text>
                </View>
                <View style={styles.summaryDeductionDivider} />
                <View style={styles.summaryDeductionItem}>
                  <Text style={styles.summaryDeductionLabel}>
                    {t('examinations.details.deduction') || 'Deduction'}
                  </Text>
                  <Text
                    style={[
                      styles.summaryDeductionValue,
                      {
                        color:
                          deduction > 0 ? COLORS.red : COLORS.primary,
                      },
                    ]}
                  >
                    {deduction}
                  </Text>
                </View>
                <View style={styles.summaryDeductionDivider} />
                <View style={styles.summaryDeductionItem}>
                  <Text style={styles.summaryDeductionLabel}>
                    {t('examinations.details.passing') || 'Passing'}
                  </Text>
                  <Text style={styles.summaryDeductionValue}>
                    {passingMark}%
                  </Text>
                </View>
              </View>
            </View>

            {/* ============ INFO ROWS ============ */}
            <InfoRow
              label={t('examinations.details.formType') || 'Form'}
              value={formTypeLabel}
              icon="book-outline"
            />
            <InfoRow
              label={t('examinations.details.date') || 'Date'}
              value={dateLabel}
              icon="calendar-outline"
            />
            <InfoRow
              label={t('examinations.details.publish') || 'Publish'}
              value={
                exam.isPublished
                  ? t('examinations.status.published') || 'Published'
                  : t('examinations.status.draft') || 'Draft'
              }
              icon={
                exam.isPublished
                  ? 'checkmark-circle-outline'
                  : 'eye-off-outline'
              }
            />
            {scopeLabel ? (
              <InfoRow
                label={t('examinations.details.scope') || 'Scope'}
                value={scopeLabel}
                icon="list-outline"
              />
            ) : null}

            {/* ==================================================
                MEMORIZATION — QUESTION BREAKDOWN TABLE
            ================================================== */}
            {formType === 'memorization' &&
              (exam.questions || []).length > 0 && (
                <View style={styles.block}>
                  <Text style={styles.blockTitle}>
                    {t('examinations.details.questionBreakdown') ||
                      'Question Breakdown'}
                  </Text>
                  <View style={styles.table}>
                    <View style={[styles.tableRow, styles.tableHeader]}>
                      <Text
                        style={[
                          styles.tableCell,
                          styles.tableHeaderText,
                          styles.cellNarrow,
                        ]}
                      >
                        {t('examinations.table.q') || 'Q'}
                      </Text>
                      <Text
                        style={[
                          styles.tableCell,
                          styles.tableHeaderText,
                          styles.cellNarrow,
                        ]}
                      >
                        {t('examinations.table.page') || 'Page'}
                      </Text>
                      <Text
                        style={[styles.tableCell, styles.tableHeaderText]}
                      >
                        {t('examinations.table.fathi') || 'Fathi'}
                      </Text>
                      <Text
                        style={[styles.tableCell, styles.tableHeaderText]}
                      >
                        {t('examinations.table.lahni') || 'Lahni'}
                      </Text>
                      <Text
                        style={[styles.tableCell, styles.tableHeaderText]}
                      >
                        {t('examinations.table.ruju') || 'Ruju'}
                      </Text>
                      <Text
                        style={[styles.tableCell, styles.tableHeaderText]}
                      >
                        {t('examinations.table.tajwid') || 'Tajwid'}
                      </Text>
                    </View>
                    {(exam.questions || []).map((q, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.tableRow,
                          idx % 2 === 1 && styles.tableRowAlt,
                        ]}
                      >
                        <Text
                          style={[styles.tableCell, styles.cellNarrow]}
                        >
                          {idx + 1}
                        </Text>
                        <Text
                          style={[styles.tableCell, styles.cellNarrow]}
                        >
                          {q.page || '-'}
                        </Text>
                        <Text style={styles.tableCell}>{q.fathi}</Text>
                        <Text style={styles.tableCell}>{q.lahni}</Text>
                        <Text style={styles.tableCell}>{q.ruju || 0}</Text>
                        <Text style={styles.tableCell}>{q.tajwid}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

            {/* ==================================================
                READING — PER-SKILL TABLE
            ================================================== */}
            {formType === 'reading' && readingContext && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>
                  {t('examinations.details.readingBreakdown') ||
                    'Reading & Writing Breakdown'}
                </Text>

                {readingContext.enabledSkillsList.length === 0 ? (
                  <Text style={styles.emptyText}>
                    {t('examinations.details.noSkillsEnabled') ||
                      'No skills were enabled for this exam.'}
                  </Text>
                ) : (
                  <View style={styles.table}>
                    {/* Header row */}
                    <View style={[styles.tableRow, styles.tableHeader]}>
                      <Text
                        style={[
                          styles.tableCell,
                          styles.tableHeaderText,
                          styles.cellSkillName,
                        ]}
                      >
                        {t('examinations.details.skill') || 'Skill'}
                      </Text>
                      {readingContext.enabledCatsList.includes(
                        'readingScore'
                      ) && (
                        <Text
                          style={[
                            styles.tableCell,
                            styles.tableHeaderText,
                            { color: COLORS.blue },
                          ]}
                        >
                          {t('examinations.reading.reading') || 'Reading'}
                        </Text>
                      )}
                      {readingContext.enabledCatsList.includes(
                        'writingScore'
                      ) && (
                        <Text
                          style={[
                            styles.tableCell,
                            styles.tableHeaderText,
                            { color: COLORS.primary },
                          ]}
                        >
                          {t('examinations.reading.writing') || 'Writing'}
                        </Text>
                      )}
                      {readingContext.enabledCatsList.includes('hijaa') && (
                        <Text
                          style={[
                            styles.tableCell,
                            styles.tableHeaderText,
                            { color: COLORS.amber },
                          ]}
                        >
                          {t('examinations.reading.hijaa') || 'Hijaa'}
                        </Text>
                      )}
                      {readingContext.enabledCatsList.includes('ayahs') && (
                        <Text
                          style={[
                            styles.tableCell,
                            styles.tableHeaderText,
                            { color: COLORS.pink },
                          ]}
                        >
                          {t('examinations.reading.ayahs') || 'Ayahs'}
                        </Text>
                      )}
                      <Text
                        style={[styles.tableCell, styles.tableHeaderText]}
                      >
                        {t('examinations.details.rowTotal') || 'Total'}
                      </Text>
                    </View>

                    {/* Skill rows */}
                    {readingContext.enabledSkillsList.map((h, idx) => {
                      const rVal =
                        parseFloat(
                          String(
                            readingContext.scores[`${h.id}_reading`] ?? 0
                          )
                        ) || 0;
                      const wVal =
                        parseFloat(
                          String(
                            readingContext.scores[`${h.id}_writing`] ?? 0
                          )
                        ) || 0;
                      const hjVal =
                        parseFloat(
                          String(
                            readingContext.scores[`${h.id}_hijaa`] ?? 0
                          )
                        ) || 0;
                      const ayVal =
                        parseFloat(
                          String(
                            readingContext.scores[`${h.id}_ayahs`] ?? 0
                          )
                        ) || 0;

                      const rMax = readingContext.enabledCatsList.includes(
                        'readingScore'
                      )
                        ? readingContext.exactMaxes.reading[idx] || 0
                        : 0;
                      const wMax = readingContext.enabledCatsList.includes(
                        'writingScore'
                      )
                        ? readingContext.exactMaxes.writing[idx] || 0
                        : 0;
                      const hjMax = readingContext.enabledCatsList.includes(
                        'hijaa'
                      )
                        ? readingContext.exactMaxes.hijaa[idx] || 0
                        : 0;
                      const ayMax = readingContext.enabledCatsList.includes(
                        'ayahs'
                      )
                        ? readingContext.exactMaxes.ayahs[idx] || 0
                        : 0;

                      let rowTotal = 0;
                      if (
                        readingContext.enabledCatsList.includes(
                          'readingScore'
                        )
                      )
                        rowTotal += rVal;
                      if (
                        readingContext.enabledCatsList.includes(
                          'writingScore'
                        )
                      )
                        rowTotal += wVal;
                      if (readingContext.enabledCatsList.includes('hijaa'))
                        rowTotal += hjVal;
                      if (readingContext.enabledCatsList.includes('ayahs'))
                        rowTotal += ayVal;

                      const rowMax = round2(rMax + wMax + hjMax + ayMax);

                      return (
                        <View
                          key={h.id}
                          style={[
                            styles.tableRow,
                            idx % 2 === 1 && styles.tableRowAlt,
                          ]}
                        >
                          <Text
                            style={[
                              styles.tableCell,
                              styles.cellSkillName,
                              {
                                textAlign: 'left',
                                paddingHorizontal: 8,
                              },
                            ]}
                            numberOfLines={2}
                          >
                            {h.label}
                          </Text>
                          {readingContext.enabledCatsList.includes(
                            'readingScore'
                          ) && (
                            <Text style={styles.tableCell}>
                              {round2(rVal)}
                              <Text style={styles.tableCellMuted}>
                                {' '}
                                / {round2(rMax)}
                              </Text>
                            </Text>
                          )}
                          {readingContext.enabledCatsList.includes(
                            'writingScore'
                          ) && (
                            <Text style={styles.tableCell}>
                              {round2(wVal)}
                              <Text style={styles.tableCellMuted}>
                                {' '}
                                / {round2(wMax)}
                              </Text>
                            </Text>
                          )}
                          {readingContext.enabledCatsList.includes(
                            'hijaa'
                          ) && (
                            <Text style={styles.tableCell}>
                              {round2(hjVal)}
                              <Text style={styles.tableCellMuted}>
                                {' '}
                                / {round2(hjMax)}
                              </Text>
                            </Text>
                          )}
                          {readingContext.enabledCatsList.includes(
                            'ayahs'
                          ) && (
                            <Text style={styles.tableCell}>
                              {round2(ayVal)}
                              <Text style={styles.tableCellMuted}>
                                {' '}
                                / {round2(ayMax)}
                              </Text>
                            </Text>
                          )}
                          <Text
                            style={[
                              styles.tableCell,
                              styles.tableCellBold,
                            ]}
                          >
                            {round2(rowTotal)}
                            <Text style={styles.tableCellMuted}>
                              {' '}
                              / {rowMax}
                            </Text>
                          </Text>
                        </View>
                      );
                    })}

                    {/* Footer — per-category totals + grand total */}
                    <View style={[styles.tableRow, styles.tableFooter]}>
                      <Text
                        style={[
                          styles.tableCell,
                          styles.cellSkillName,
                          styles.tableFooterText,
                          {
                            textAlign: 'left',
                            paddingHorizontal: 8,
                          },
                        ]}
                      >
                        {t('examinations.details.grandTotal') || 'Total'}
                      </Text>
                      {readingContext.enabledCatsList.includes(
                        'readingScore'
                      ) && (
                        <Text
                          style={[
                            styles.tableCell,
                            styles.tableFooterText,
                          ]}
                        >
                          {round2(readingContext.readingTotal)}
                          <Text style={styles.tableCellMuted}>
                            {' '}
                            /{' '}
                            {round2(
                              readingContext.effectiveWeights.readingScore
                            )}
                          </Text>
                        </Text>
                      )}
                      {readingContext.enabledCatsList.includes(
                        'writingScore'
                      ) && (
                        <Text
                          style={[
                            styles.tableCell,
                            styles.tableFooterText,
                          ]}
                        >
                          {round2(readingContext.writingTotal)}
                          <Text style={styles.tableCellMuted}>
                            {' '}
                            /{' '}
                            {round2(
                              readingContext.effectiveWeights.writingScore
                            )}
                          </Text>
                        </Text>
                      )}
                      {readingContext.enabledCatsList.includes('hijaa') && (
                        <Text
                          style={[
                            styles.tableCell,
                            styles.tableFooterText,
                          ]}
                        >
                          {round2(readingContext.hijaaTotal)}
                          <Text style={styles.tableCellMuted}>
                            {' '}
                            /{' '}
                            {round2(
                              readingContext.effectiveWeights.hijaa
                            )}
                          </Text>
                        </Text>
                      )}
                      {readingContext.enabledCatsList.includes('ayahs') && (
                        <Text
                          style={[
                            styles.tableCell,
                            styles.tableFooterText,
                          ]}
                        >
                          {round2(readingContext.ayahsTotal)}
                          <Text style={styles.tableCellMuted}>
                            {' '}
                            /{' '}
                            {round2(
                              readingContext.effectiveWeights.ayahs
                            )}
                          </Text>
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.tableCell,
                          styles.tableFooterText,
                          { color: COLORS.purple, fontSize: 13 },
                        ]}
                      >
                        {round2(readingContext.grandTotal)}
                        <Text style={styles.tableCellMuted}>
                          {' '}
                          / {round2(readingContext.maxTotal)}
                        </Text>
                      </Text>
                    </View>
                  </View>
                )}

                {/* Grade card under the table */}
                <View style={styles.gradeCard}>
                  <Text style={styles.gradeLabel}>
                    {t('examinations.form.grade') || 'Grade'}
                  </Text>
                  <Text style={styles.gradeValue}>
                    {getGradeLabel(readingContext.percentage, t)}
                  </Text>
                  <Text style={styles.gradePct}>
                    {readingContext.percentage}%
                  </Text>
                </View>
              </View>
            )}

            {/* ============ NOTES ============ */}
            {(exam.notes?.positive || exam.notes?.negative) && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>
                  {t('examinations.details.notes') || 'Notes'}
                </Text>
                {exam.notes?.positive ? (
                  <View
                    style={[
                      styles.noteBox,
                      { backgroundColor: COLORS.primaryLight },
                    ]}
                  >
                    <Text
                      style={[
                        styles.noteLabel,
                        { color: COLORS.primary },
                      ]}
                    >
                      {t('examinations.details.positive') ||
                        'Positive notes'}
                    </Text>
                    <Text style={styles.noteText}>
                      {exam.notes.positive}
                    </Text>
                  </View>
                ) : null}
                {exam.notes?.negative ? (
                  <View
                    style={[
                      styles.noteBox,
                      {
                        backgroundColor: COLORS.amberLight,
                        marginTop: 6,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.noteLabel,
                        { color: COLORS.amber },
                      ]}
                    >
                      {t('examinations.details.areasToImprove') ||
                        'Areas to improve'}
                    </Text>
                    <Text style={styles.noteText}>
                      {exam.notes.negative}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* ============ EXAMINERS ============ */}
            {examiners.length > 0 && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>
                  {t('examinations.details.committee') || 'Exam Committee'}
                </Text>
                {examiners.map((ex, idx) => (
                  <View key={idx} style={styles.committeeRow}>
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
            )}

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* ACTIONS */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtnOutline}
              onPress={() => onEdit(exam)}
            >
              <Ionicons
                name="create-outline"
                size={16}
                color={COLORS.primary}
              />
              <Text style={styles.actionBtnOutlineText}>
                {t('examinations.details.edit') || 'Edit'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionBtnOutline,
                {
                  borderColor: exam.isPublished
                    ? COLORS.amber
                    : COLORS.primary,
                },
              ]}
              onPress={() => onTogglePublish(exam)}
            >
              <Ionicons
                name={exam.isPublished ? 'eye-off' : 'checkmark-circle'}
                size={16}
                color={exam.isPublished ? COLORS.amber : COLORS.primary}
              />
              <Text
                style={[
                  styles.actionBtnOutlineText,
                  {
                    color: exam.isPublished
                      ? COLORS.amber
                      : COLORS.primary,
                  },
                ]}
              >
                {exam.isPublished
                  ? t('examinations.bulk.unpublish') || 'Unpublish'
                  : t('examinations.bulk.publish') || 'Publish'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtnDanger}
              onPress={() => onDelete(exam)}
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color={COLORS.red}
              />
              <Text style={styles.actionBtnDangerText}>
                {t('examinations.details.delete') || 'Delete'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// SUBCOMPONENTS
// ============================================================
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
// HELPERS
// ============================================================
const getGradeLabel = (
  pct: number,
  t: (k: string) => string
): string => {
  if (pct >= 90)
    return t('examinations.form.grades.excellent') || 'Excellent';
  if (pct >= 80)
    return t('examinations.form.grades.veryGood') || 'Very Good';
  if (pct >= 70) return t('examinations.form.grades.good') || 'Good';
  if (pct >= 60)
    return t('examinations.form.grades.acceptable') || 'Acceptable';
  return t('examinations.form.grades.poor') || 'Poor';
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '94%',
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

  // Summary card
  summaryCard: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 12,
    backgroundColor: COLORS.background,
    borderRadius: 14,
  },
  summaryAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  summaryAvatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  summaryName: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  summaryMeta: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
  summaryScoreBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 12,
  },
  summaryScoreValue: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.slate,
  },
  summaryScoreTotal: {
    fontSize: 16,
    color: COLORS.slateMuted,
    marginLeft: 4,
  },
  summaryProgress: {
    width: '80%',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginTop: 10,
  },
  summaryProgressFill: { height: '100%', borderRadius: 4 },
  summaryPct: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate,
    marginTop: 8,
  },
  summaryDeductionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    width: '100%',
  },
  summaryDeductionItem: { alignItems: 'center', flex: 1 },
  summaryDeductionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  summaryDeductionValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.slate,
  },
  summaryDeductionDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.border,
  },

  // Info rows
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
  infoLabel: {
    fontSize: 11,
    color: COLORS.slateMuted,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.slate,
    fontWeight: '600',
    marginTop: 2,
  },

  // Blocks
  block: { marginTop: 20 },
  blockTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slate,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.slateMuted,
    fontStyle: 'italic',
    paddingVertical: 12,
    textAlign: 'center',
  },

  // Table
  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
  },
  tableHeader: { backgroundColor: COLORS.primaryLight },
  tableHeaderText: { fontWeight: '800', color: COLORS.primary },
  tableFooter: { backgroundColor: COLORS.purpleLight },
  tableFooterText: { fontWeight: '800', color: COLORS.purple },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowAlt: { backgroundColor: '#FAFBFC' },
  tableCell: {
    flex: 1,
    fontSize: 11,
    color: COLORS.slate,
    paddingVertical: 8,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  tableCellMuted: {
    fontSize: 9,
    color: COLORS.slateMuted,
    fontWeight: '500',
  },
  tableCellBold: { fontWeight: '800', color: COLORS.purple },
  cellNarrow: { flex: 0.6 },
  cellSkillName: { flex: 1.6 },

  // Grade card
  gradeCard: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.goldLight,
    borderWidth: 1,
    borderColor: COLORS.gold + '55',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gradeLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
  },
  gradeValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.gold,
    flex: 1,
    textAlign: 'center',
  },
  gradePct: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
  },

  // Notes
  noteBox: { padding: 12, borderRadius: 10, marginTop: 6 },
  noteLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  noteText: { fontSize: 13, color: COLORS.slate, lineHeight: 18 },

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

  // Actions
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexWrap: 'wrap',
  },
  actionBtnOutline: {
    flex: 1,
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    gap: 6,
  },
  actionBtnOutlineText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  actionBtnDanger: {
    flex: 1,
    minWidth: 90,
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
});