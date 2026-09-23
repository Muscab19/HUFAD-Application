// src/screens/admin/examinations/ExamFormScreen.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useBranch } from '../../../context/BranchContext';
import {
  COLORS,
  Exam,
  ExamFormType,
  ExamFormState,
  ExamQuestion,
  ExamSettings,
  Halaqah,
  MarksPer,
  ReadingWritingHeader,
  ReadingWritingWeights,
  StudentLite,
  DEFAULT_COLUMNS,
  DEFAULT_EXAM_TYPES,
  DEFAULT_MARKS_PER,
  DEFAULT_READING_HEADERS,
  DEFAULT_READING_WEIGHTS,
  api,
  getExamFormType,
  getVisibleColumns,
  getJuzName,
  getSurahName,
  round2,
  SURAH_LIST,
  JUZ_NAMES,
} from './_shared';

// ============================================================
// HELPERS
// ============================================================
const getEmptyQuestion = (n: number): ExamQuestion => ({
  questionNumber: n,
  page: '',
  fathi: 0,
  lahni: 0,
  ruju: 0,
  tajwid: 0,
  customColumns: {},
});

const buildEmptyForm = (settings: ExamSettings | null): ExamFormState => {
  const qCount = settings?.defaultQuestionCount || 3;
  return {
    studentId: '',
    studentName: '',
    halaqah: '',
    examType: '',
    examScope: 'surah',
    fromSurah: '',
    toSurah: '',
    fromJuz: '',
    toJuz: '',
    examiners: [''],
    dateGregorian: new Date().toISOString().split('T')[0],
    dateHijri: '',
    questions: Array.from({ length: qCount }, (_, i) => getEmptyQuestion(i + 1)),
    notes: { positive: '', negative: '' },
    readingWritingScores: {},
    totalMarks: 100,
  };
};

const ORDINAL_KEYS = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
];

// ============================================================
// MAIN FORM SCREEN
// ============================================================
export const ExamFormScreen: React.FC<{
  exam: Exam | null;
  settings: ExamSettings | null;
  onBack: () => void;
  onSaved: () => void;
}> = ({ exam, settings, onBack, onSaved }) => {
  const { t } = useTranslation();
  const { currentBranch } = useBranch();
  const isEditing = !!exam;

  const [formType, setFormType] = useState<ExamFormType>('memorization');
  const [form, setForm] = useState<ExamFormState>(() => buildEmptyForm(settings));
  const [marksPer, setMarksPer] = useState<MarksPer>(
    settings ? { ...DEFAULT_MARKS_PER } : DEFAULT_MARKS_PER
  );
  const [readingHeaders, setReadingHeaders] = useState<ReadingWritingHeader[]>(
    settings?.readingWritingHeaders || DEFAULT_READING_HEADERS
  );
  const [readingWeights, setReadingWeights] = useState<ReadingWritingWeights>(
    settings?.readingWritingWeights || DEFAULT_READING_WEIGHTS
  );
  const [dateType, setDateType] = useState<'gregorian' | 'hijri' | 'both'>('gregorian');

  const [halaqat, setHalaqat] = useState<Halaqah[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.getHalaqat();
        setHalaqat(list);
      } catch (err) {
        console.warn('Load halaqat error:', err);
      }
    })();
  }, []);

  useEffect(() => {
    if (!exam) {
      setForm(buildEmptyForm(settings));
      setMarksPer(settings ? { ...DEFAULT_MARKS_PER } : DEFAULT_MARKS_PER);
      setReadingHeaders(settings?.readingWritingHeaders || DEFAULT_READING_HEADERS);
      setReadingWeights(settings?.readingWritingWeights || DEFAULT_READING_WEIGHTS);
      setFormType('memorization');
      setDateType('gregorian');
      return;
    }

    const formTypeRaw: ExamFormType = getExamFormType(exam);
    setFormType(formTypeRaw);

    let gregorian = exam.dateGregorian || '';
    let hijri = exam.dateHijri || '';
    let dtype: 'gregorian' | 'hijri' | 'both' = exam.dateType || 'gregorian';

    if (!gregorian && !hijri && exam.date) {
      if (typeof exam.date === 'object' && exam.date !== null) {
        gregorian = exam.date.gregorian || '';
        hijri = exam.date.hijri || '';
        dtype = 'both';
      } else if (typeof exam.date === 'string') {
        if (/^14\d{2}-/.test(exam.date)) {
          hijri = exam.date;
          dtype = 'hijri';
        } else {
          gregorian = exam.date.split('T')[0];
          dtype = 'gregorian';
        }
      }
    }
    if (!gregorian && dtype !== 'hijri') {
      gregorian = new Date().toISOString().split('T')[0];
    }
    setDateType(dtype);

    const questions: ExamQuestion[] = (exam.questions || []).map((q) => {
      if (q.customColumns && typeof q.customColumns === 'object') {
        return { ...q };
      }
      const standardFields = [
        'questionNumber',
        'page',
        'fathi',
        'lahni',
        'tajwid',
        'performance',
        'customColumns',
        '_id',
        'ruju',
      ];
      const cc: Record<string, number> = {};
      Object.keys(q).forEach((k) => {
        if (!standardFields.includes(k)) {
          cc[k] = (q as any)[k];
        }
      });
      return Object.keys(cc).length > 0 ? { ...q, customColumns: cc } : q;
    });

    setForm({
      studentId: exam.studentId || '',
      studentName: exam.studentName || '',
      halaqah: exam.halaqah || '',
      examType: exam.examType || '',
      examScope: exam.examScope || 'surah',
      fromSurah: exam.fromSurah || '',
      toSurah: exam.toSurah || '',
      fromJuz: exam.fromJuz || '',
      toJuz: exam.toJuz || '',
      examiners:
        exam.examiners && exam.examiners.length > 0
          ? exam.examiners
          : exam.examiner
          ? [exam.examiner]
          : [''],
      dateGregorian: gregorian,
      dateHijri: hijri,
      questions: questions.length > 0 ? questions : buildEmptyForm(settings).questions,
      notes: exam.notes || { positive: '', negative: '' },
      readingWritingScores: exam.readingWritingScores || {},
      totalMarks: exam.totalMarks || 100,
    });

    setMarksPer(exam.marksPer || settings?.passingMark ? { ...DEFAULT_MARKS_PER } : DEFAULT_MARKS_PER);
    if (exam.marksPer) setMarksPer(exam.marksPer);
    if (exam.readingWritingHeaders) setReadingHeaders(exam.readingWritingHeaders);
    if (exam.readingWritingWeights) setReadingWeights(exam.readingWritingWeights);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam]);

  useEffect(() => {
    const halaqah = form.halaqah;
    if (!halaqah) {
      setStudents([]);
      return;
    }
    (async () => {
      setLoadingStudents(true);
      try {
        const list = await api.getStudentsByHalaqah(halaqah);
        setStudents(list);
      } catch (err: any) {
        console.error('Load students error:', err);
        try {
          const list2 = await api.getStudents();
          setStudents(list2);
        } catch {
          setStudents([]);
        }
      } finally {
        setLoadingStudents(false);
      }
    })();
  }, [form.halaqah]);

  const update = <K extends keyof ExamFormState>(
    key: K,
    value: ExamFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateNotes = (field: 'positive' | 'negative', value: string) => {
    setForm((prev) => ({ ...prev, notes: { ...prev.notes, [field]: value } }));
  };

  const updateExaminer = (idx: number, value: string) => {
    setForm((prev) => {
      const next = [...prev.examiners];
      next[idx] = value;
      return { ...prev, examiners: next };
    });
  };

  const addExaminer = () => {
    setForm((prev) => ({ ...prev, examiners: [...prev.examiners, ''] }));
  };

  const removeExaminer = (idx: number) => {
    setForm((prev) => {
      if (prev.examiners.length <= 1) return prev;
      return { ...prev, examiners: prev.examiners.filter((_, i) => i !== idx) };
    });
  };

  const setQuestionValue = (
    idx: number,
    field: keyof ExamQuestion | string,
    value: any
  ) => {
    setForm((prev) => {
      const next = [...prev.questions];
      const q = { ...next[idx] };
      const standardFields = [
        'page',
        'fathi',
        'lahni',
        'tajwid',
        'performance',
        'ruju',
        'questionNumber',
      ];
      if (standardFields.includes(field as string)) {
        (q as any)[field] = value;
      } else {
        q.customColumns = { ...(q.customColumns || {}), [field as string]: value };
      }
      next[idx] = q;
      return { ...prev, questions: next };
    });
  };

  const addQuestion = () => {
    setForm((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        getEmptyQuestion(prev.questions.length + 1),
      ],
    }));
  };

  const removeQuestion = (idx: number) => {
    if (form.questions.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      questions: prev.questions
        .filter((_, i) => i !== idx)
        .map((q, i) => ({ ...q, questionNumber: i + 1 })),
    }));
  };

  const updateMarksPer = (key: string, value: number) => {
    setMarksPer((prev) => ({ ...prev, [key]: value }));
  };

  const updateReadingWeight = (
    key: keyof ReadingWritingWeights,
    value: number
  ) => {
    setReadingWeights((prev) => {
      const totalWithoutCurrent = Object.entries(prev)
        .filter(([k]) => k !== key)
        .reduce((sum, [, v]) => sum + (v || 0), 0);
      const maxTotal = form.totalMarks || 100;
      if (totalWithoutCurrent + value > maxTotal) {
        const clamped = Math.max(0, maxTotal - totalWithoutCurrent);
        return { ...prev, [key]: clamped };
      }
      return { ...prev, [key]: value };
    });
  };

  const updateReadingScore = (
    key: string,
    value: number | string,
    maxVal: number
  ) => {
    setForm((prev) => {
      if (value === '') {
        return {
          ...prev,
          readingWritingScores: { ...prev.readingWritingScores, [key]: '' },
        };
      }
      const num = parseFloat(String(value));
      if (isNaN(num)) return prev;
      const clamped = Math.max(0, Math.min(num, maxVal));
      const rounded = Math.round(clamped * 10) / 10;
      return {
        ...prev,
        readingWritingScores: {
          ...prev.readingWritingScores,
          [key]: rounded,
        },
      };
    });
  };

  const visibleColumns = useMemo(() => getVisibleColumns(settings), [settings]);

  const totalDeduction = useMemo(() => {
    let total = 0;
    form.questions.forEach((q) => {
      visibleColumns.forEach((col) => {
        let fieldKey: string = col.key;
        let weightKey: string = col.key;
        if (col.key === 'rujuc') {
          fieldKey = 'ruju';
          weightKey = 'ruju';
        }
        const weight =
          marksPer[weightKey] !== undefined ? marksPer[weightKey] : 1.0;
        const value =
          q.customColumns && q.customColumns[col.key] !== undefined
            ? q.customColumns[col.key]
            : (q as any)[fieldKey] || 0;
        const isAdditive = col.isAdditive !== false;
        total += isAdditive ? value * weight : -(value * weight);
      });
    });
    return total;
  }, [form.questions, visibleColumns, marksPer]);

  const obtainedMarks = useMemo(() => {
    const totalMarks = form.totalMarks || 100;
    const obtained = Math.max(0, totalMarks - totalDeduction);
    return round2(obtained);
  }, [form.totalMarks, totalDeduction]);

  const readingTotals = useMemo(() => {
    const skillHeaders = readingHeaders.filter(
      (h) =>
        h.id !== 'total' &&
        h.id !== 'estimation' &&
        h.id !== 'readingScore' &&
        h.id !== 'writingScore' &&
        h.id !== 'hijaa' &&
        h.id !== 'ayahs'
    );
    let readingTotal = 0,
      writingTotal = 0,
      hijaaTotal = 0,
      ayahsTotal = 0;
    skillHeaders.forEach((h) => {
      readingTotal +=
        parseFloat(String(form.readingWritingScores[`${h.id}_reading`] ?? 0)) || 0;
      writingTotal +=
        parseFloat(String(form.readingWritingScores[`${h.id}_writing`] ?? 0)) || 0;
      hijaaTotal +=
        parseFloat(String(form.readingWritingScores[`${h.id}_hijaa`] ?? 0)) || 0;
      ayahsTotal +=
        parseFloat(String(form.readingWritingScores[`${h.id}_ayahs`] ?? 0)) || 0;
    });
    const grandTotal = readingTotal + writingTotal + hijaaTotal + ayahsTotal;
    const maxTotal =
      (readingWeights.readingScore || 0) +
      (readingWeights.writingScore || 0) +
      (readingWeights.hijaa || 0) +
      (readingWeights.ayahs || 0);
    const pct = maxTotal > 0 ? (grandTotal / maxTotal) * 100 : 0;
    return {
      readingTotal: round2(readingTotal),
      writingTotal: round2(writingTotal),
      hijaaTotal: round2(hijaaTotal),
      ayahsTotal: round2(ayahsTotal),
      grandTotal: round2(grandTotal),
      maxTotal: round2(maxTotal),
      percentage: round2(pct),
    };
  }, [readingHeaders, form.readingWritingScores, readingWeights]);

  const handleSave = async () => {
    if (!form.halaqah) {
      Alert.alert(
        t('examinations.form.errors.missingFieldTitle'),
        t('examinations.form.errors.selectHalaqah')
      );
      return;
    }
    if (!form.studentId) {
      Alert.alert(
        t('examinations.form.errors.missingFieldTitle'),
        t('examinations.form.errors.selectStudent')
      );
      return;
    }
    if (!form.examType) {
      Alert.alert(
        t('examinations.form.errors.missingFieldTitle'),
        t('examinations.form.errors.selectExamType')
      );
      return;
    }
    if (!currentBranch?._id) {
      Alert.alert(
        t('examinations.form.errors.noBranchTitle'),
        t('examinations.form.errors.selectBranch')
      );
      return;
    }

    setSaving(true);
    try {
      let computedTotalMarks = form.totalMarks || 100;
      let computedObtained = obtainedMarks;

      if (formType === 'reading') {
        const max =
          readingWeights.readingScore +
          readingWeights.writingScore +
          readingWeights.hijaa +
          readingWeights.ayahs;
        computedTotalMarks = max || 100;
        computedObtained = readingTotals.grandTotal;
      }

      const pct =
        computedTotalMarks > 0
          ? round2((computedObtained / computedTotalMarks) * 100)
          : 0;
      const passingMark =
        formType === 'reading'
          ? settings?.passingMarkReadingWriting ?? 60
          : settings?.passingMark ?? 60;
      const status = pct >= passingMark ? 'Pass' : 'Fail';

      let datePayload: any = form.dateGregorian;
      if (dateType === 'hijri') {
        datePayload = form.dateHijri;
      } else if (dateType === 'both') {
        datePayload = {
          gregorian: form.dateGregorian,
          hijri: form.dateHijri,
        };
      }

      const cleanQuestions = form.questions.map((q) => ({
        questionNumber: q.questionNumber,
        page: q.page || '',
        fathi: q.fathi || 0,
        lahni: q.lahni || 0,
        ruju: q.ruju || 0,
        tajwid: q.tajwid || 0,
        performance: q.performance || 0,
        ...(q.customColumns && Object.keys(q.customColumns).length > 0
          ? { customColumns: q.customColumns }
          : {}),
      }));

      const cleanReadingScores: Record<string, number> = {};
      if (formType === 'reading') {
        Object.keys(form.readingWritingScores).forEach((key) => {
          const v = form.readingWritingScores[key];
          if (v !== '' && v !== null && v !== undefined) {
            const n = parseFloat(String(v));
            if (!isNaN(n)) cleanReadingScores[key] = n;
          }
        });
      }

      const examData: any = {
        studentId: form.studentId,
        studentName: form.studentName,
        halaqah: form.halaqah,
        examType: form.examType,
        examScope: form.examScope,
        fromSurah: form.fromSurah || undefined,
        toSurah: form.toSurah || undefined,
        fromJuz: form.fromJuz || undefined,
        toJuz: form.toJuz || undefined,
        examiners: form.examiners.filter((e) => e.trim()),
        date: datePayload,
        dateType,
        dateGregorian: form.dateGregorian,
        dateHijri: form.dateHijri,
        branchId: currentBranch._id,
        settings: settings || undefined,
        examFormType: formType,
        marksPer,
        readingWritingHeaders:
          formType === 'reading' ? readingHeaders : undefined,
        readingWritingScores:
          formType === 'reading' ? cleanReadingScores : undefined,
        readingWritingWeights:
          formType === 'reading' ? readingWeights : undefined,
        totalMarks: computedTotalMarks,
        passingMark,
        notes: form.notes,
        questions: cleanQuestions,
        isPublished: exam?.isPublished ?? false,
        publishedAt: exam?.publishedAt ?? null,
      };

      if (isEditing && exam) {
        await api.update(exam._id, examData);
        Alert.alert(
          t('examinations.form.errors.updatedTitle'),
          t('examinations.form.errors.updatedMsg')
        );
      } else {
        await api.create(examData);
        Alert.alert(
          t('examinations.form.errors.savedTitle'),
          t('examinations.form.errors.savedMsg')
        );
      }
      onSaved();
    } catch (err: any) {
      console.error('Save exam error:', err);
      Alert.alert(
        t('examinations.errorTitle'),
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('examinations.form.errors.saveFailed')
      );
    } finally {
      setSaving(false);
    }
  };

  const getQuestionLabel = (idx: number) => {
    const key = ORDINAL_KEYS[idx];
    const ordinal = key
      ? t(`examinations.form.ordinals.${key}`)
      : t('examinations.form.ordinals.default', { n: idx + 1 });
    return t('examinations.form.question', { ordinal });
  };

  const getGradeLabel = (pct: number) => {
    if (pct >= 90) return t('examinations.form.grades.excellent');
    if (pct >= 80) return t('examinations.form.grades.veryGood');
    if (pct >= 70) return t('examinations.form.grades.good');
    if (pct >= 60) return t('examinations.form.grades.acceptable');
    return t('examinations.form.grades.poor');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color={COLORS.slate} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {isEditing
              ? t('examinations.form.titleEdit')
              : t('examinations.form.titleCreate')}
          </Text>
          <Text style={styles.headerSubtitle}>
            {formType === 'reading'
              ? t('examinations.formTypes.reading')
              : t('examinations.formTypes.memorization')}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* FORM TYPE */}
          <Text style={styles.sectionTitle}>
            {t('examinations.form.sectionFormType')}
          </Text>
          <View style={styles.formTypeRow}>
            {(['memorization', 'reading'] as ExamFormType[]).map((ft) => {
              const active = formType === ft;
              return (
                <TouchableOpacity
                  key={ft}
                  style={[styles.formTypeBtn, active && styles.formTypeBtnActive]}
                  onPress={() => setFormType(ft)}
                >
                  <Ionicons
                    name={ft === 'reading' ? 'book' : 'school'}
                    size={18}
                    color={active ? COLORS.blue : COLORS.slateMuted}
                  />
                  <Text
                    style={[
                      styles.formTypeBtnText,
                      active && styles.formTypeBtnTextActive,
                    ]}
                  >
                    {ft === 'reading'
                      ? t('examinations.formTypes.reading')
                      : t('examinations.formTypes.memorization')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* BASIC INFO */}
          <Text style={styles.sectionTitle}>
            {t('examinations.form.sectionBasic')}
          </Text>

          <Text style={styles.label}>{t('examinations.form.halaqah')}</Text>
          <View style={styles.chipRow}>
            {halaqat.map((h) => {
              const active = form.halaqah === h.name;
              return (
                <TouchableOpacity
                  key={h._id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    update('halaqah', h.name);
                    update('studentId', '');
                    update('studentName', '');
                  }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {h.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {halaqat.length === 0 && (
              <Text style={styles.hint}>
                {t('examinations.form.loadingHalaqaat')}
              </Text>
            )}
          </View>

          {form.halaqah ? (
            <>
              <Text style={styles.label}>{t('examinations.form.student')}</Text>
              {loadingStudents ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : students.length === 0 ? (
                <Text style={styles.hint}>{t('examinations.form.noStudents')}</Text>
              ) : (
                <View style={styles.chipRow}>
                  {students.map((s) => {
                    const active = form.studentId === s._id;
                    return (
                      <TouchableOpacity
                        key={s._id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => {
                          update('studentId', s._id);
                          update('studentName', s.name);
                        }}
                      >
                        <Text
                          style={[styles.chipText, active && styles.chipTextActive]}
                        >
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          ) : null}

          <Text style={styles.label}>{t('examinations.form.examType')}</Text>
          <View style={styles.chipRow}>
            {(settings?.examTypes || DEFAULT_EXAM_TYPES).map((typ) => {
              const active = form.examType === typ;
              return (
                <TouchableOpacity
                  key={typ}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => update('examType', typ)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {typ}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>{t('examinations.form.totalMarks')}</Text>
          <TextInput
            style={styles.input}
            value={String(form.totalMarks || 100)}
            onChangeText={(v) => {
              const n = parseInt(v.replace(/[^0-9]/g, ''), 10) || 100;
              update('totalMarks', n);
            }}
            keyboardType="numeric"
          />

          <Text style={styles.label}>{t('examinations.form.dateType')}</Text>
          <View style={styles.chipRow}>
            {(['gregorian', 'hijri', 'both'] as const).map((d) => {
              const active = dateType === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setDateType(d)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {t(`examinations.form.dateTypes.${d}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {dateType !== 'hijri' && (
            <>
              <Text style={styles.label}>
                {t('examinations.form.dateGregorian')}
              </Text>
              <TextInput
                style={styles.input}
                value={form.dateGregorian}
                onChangeText={(v) => update('dateGregorian', v)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#A0AAA5"
                autoCapitalize="none"
              />
            </>
          )}

          {dateType !== 'gregorian' && (
            <>
              <Text style={styles.label}>{t('examinations.form.dateHijri')}</Text>
              <TextInput
                style={styles.input}
                value={form.dateHijri}
                onChangeText={(v) => update('dateHijri', v)}
                placeholder="1446-01-01"
                placeholderTextColor="#A0AAA5"
                autoCapitalize="none"
              />
            </>
          )}

          {/* EXAMINERS */}
          <Text style={styles.sectionTitle}>
            {t('examinations.form.sectionExaminers')}
          </Text>
          {form.examiners.map((ex, idx) => (
            <View key={idx} style={styles.examinerRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={ex}
                onChangeText={(v) => updateExaminer(idx, v)}
                placeholder={t('examinations.form.examiner', { n: idx + 1 })}
                placeholderTextColor="#A0AAA5"
              />
              {idx === form.examiners.length - 1 && (
                <TouchableOpacity style={styles.iconBtn} onPress={addExaminer}>
                  <Ionicons name="add" size={18} color={COLORS.purple} />
                </TouchableOpacity>
              )}
              {form.examiners.length > 1 && (
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: COLORS.redLight }]}
                  onPress={() => removeExaminer(idx)}
                >
                  <Ionicons name="trash-outline" size={16} color={COLORS.red} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {/* SCOPE (memorization only) */}
          {formType === 'memorization' && (
            <>
              <Text style={styles.sectionTitle}>
                {t('examinations.form.sectionScope')}
              </Text>
              <View style={styles.chipRow}>
                {(['surah', 'juz'] as const).map((scope) => {
                  const active = form.examScope === scope;
                  return (
                    <TouchableOpacity
                      key={scope}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => update('examScope', scope)}
                    >
                      <Text
                        style={[styles.chipText, active && styles.chipTextActive]}
                      >
                        {scope === 'surah'
                          ? t('examinations.form.surah')
                          : t('examinations.form.juz')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {form.examScope === 'surah' ? (
                <View style={styles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>
                      {t('examinations.form.fromSurah')}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={String(form.fromSurah)}
                      onChangeText={(v) => {
                        const n = Math.max(1, Math.min(114, parseInt(v, 10) || 1));
                        update('fromSurah', n);
                      }}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor="#A0AAA5"
                    />
                    <Text style={styles.hint} numberOfLines={1}>
                      {getSurahName(Number(form.fromSurah))}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>
                      {t('examinations.form.toSurah')}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={String(form.toSurah)}
                      onChangeText={(v) => {
                        const n = Math.max(1, Math.min(114, parseInt(v, 10) || 1));
                        update('toSurah', n);
                      }}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor="#A0AAA5"
                    />
                    <Text style={styles.hint} numberOfLines={1}>
                      {getSurahName(Number(form.toSurah))}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.twoCol}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>
                      {t('examinations.form.fromJuz')}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={String(form.fromJuz)}
                      onChangeText={(v) => {
                        const n = Math.max(1, Math.min(30, parseInt(v, 10) || 1));
                        update('fromJuz', n);
                      }}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor="#A0AAA5"
                    />
                    <Text style={styles.hint} numberOfLines={1}>
                      {getJuzName(Number(form.fromJuz))}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>
                      {t('examinations.form.toJuz')}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={String(form.toJuz)}
                      onChangeText={(v) => {
                        const n = Math.max(1, Math.min(30, parseInt(v, 10) || 1));
                        update('toJuz', n);
                      }}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor="#A0AAA5"
                    />
                    <Text style={styles.hint} numberOfLines={1}>
                      {getJuzName(Number(form.toJuz))}
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}

          {/* MEMORIZATION: QUESTION BREAKDOWN */}
          {formType === 'memorization' && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                  {t('examinations.form.sectionQuestions')}
                </Text>
                <TouchableOpacity style={styles.smallAddBtn} onPress={addQuestion}>
                  <Ionicons name="add" size={14} color={COLORS.purple} />
                  <Text style={styles.smallAddBtnText}>
                    {t('examinations.form.add')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.weightsCard}>
                <Text style={styles.weightsTitle}>
                  {t('examinations.form.weightPerError')}
                </Text>
                <View style={styles.weightsGrid}>
                  {['fathi', 'lahni', 'ruju', 'tajwid'].map((k) => (
                    <View key={k} style={styles.weightItem}>
                      <Text style={styles.weightLabel}>
                        {k.charAt(0).toUpperCase() + k.slice(1)}
                      </Text>
                      <TextInput
                        style={styles.weightInput}
                        value={String(marksPer[k] ?? 0)}
                        onChangeText={(v) => {
                          const n = parseFloat(v.replace(/[^0-9.\-]/g, '')) || 0;
                          updateMarksPer(k, n);
                        }}
                        keyboardType="numeric"
                      />
                    </View>
                  ))}
                </View>
              </View>

              {form.questions.map((q, idx) => {
                let rowTotal = 0;
                const cols = visibleColumns;
                return (
                  <View key={idx} style={styles.questionCard}>
                    <View style={styles.questionHeader}>
                      <Text style={styles.questionTitle}>
                        {getQuestionLabel(idx)}
                      </Text>
                      <View style={styles.questionHeaderRight}>
                        <TextInput
                          style={styles.pageInput}
                          value={q.page}
                          onChangeText={(v) => setQuestionValue(idx, 'page', v)}
                          placeholder={t('examinations.form.pagePlaceholder')}
                          placeholderTextColor="#A0AAA5"
                        />
                        <TouchableOpacity
                          style={styles.deleteQBtn}
                          onPress={() => removeQuestion(idx)}
                          disabled={form.questions.length <= 1}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={14}
                            color={
                              form.questions.length <= 1
                                ? COLORS.gray
                                : COLORS.red
                            }
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {cols.map((col) => {
                      let fieldKey: string = col.key;
                      let weightKey: string = col.key;
                      if (col.key === 'rujuc') {
                        fieldKey = 'ruju';
                        weightKey = 'ruju';
                      }
                      const weight =
                        marksPer[weightKey] !== undefined
                          ? marksPer[weightKey]
                          : 1.0;
                      const value =
                        q.customColumns && q.customColumns[col.key] !== undefined
                          ? q.customColumns[col.key]
                          : (q as any)[fieldKey] || 0;
                      const isAdditive = col.isAdditive !== false;
                      const contribution = isAdditive
                        ? value * weight
                        : -(value * weight);
                      rowTotal += contribution;

                      return (
                        <View key={col.id} style={styles.counterRow}>
                          <Text style={styles.counterLabel}>
                            {col.label}
                            <Text
                              style={{
                                color: isAdditive
                                  ? COLORS.primary
                                  : COLORS.red,
                                fontWeight: '700',
                              }}
                            >
                              {'  '}
                              {isAdditive ? '+' : '−'}
                            </Text>
                            <Text style={styles.counterWeight}>
                              {' '}
                              ×{weight}
                            </Text>
                          </Text>
                          <View style={styles.counterControls}>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => {
                                const nv = Math.max(0, (value || 0) - 1);
                                setQuestionValue(idx, col.key, nv);
                              }}
                            >
                              <Ionicons
                                name="remove"
                                size={14}
                                color={COLORS.slate}
                              />
                            </TouchableOpacity>
                            <Text style={styles.counterValue}>{value}</Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => {
                                const nv = (value || 0) + 1;
                                setQuestionValue(idx, col.key, nv);
                              }}
                            >
                              <Ionicons
                                name="add"
                                size={14}
                                color={COLORS.slate}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}

                    <View style={styles.questionTotal}>
                      <Text style={styles.questionTotalLabel}>
                        {t('examinations.form.questionDeduction')}
                      </Text>
                      <Text
                        style={[
                          styles.questionTotalValue,
                          {
                            color:
                              rowTotal > 0
                                ? COLORS.primary
                                : rowTotal < 0
                                ? COLORS.red
                                : COLORS.slateMuted,
                          },
                        ]}
                      >
                        {rowTotal > 0 ? '+' : ''}
                        {round2(rowTotal)}
                      </Text>
                    </View>
                  </View>
                );
              })}

              <View style={styles.grandTotalCard}>
                <View style={styles.grandRow}>
                  <Text style={styles.grandLabel}>
                    {t('examinations.form.totalDeduction')}
                  </Text>
                  <Text
                    style={[
                      styles.grandValue,
                      {
                        color:
                          totalDeduction > 0
                            ? COLORS.red
                            : COLORS.primary,
                      },
                    ]}
                  >
                    {round2(totalDeduction)}
                  </Text>
                </View>
                <View style={styles.grandRow}>
                  <Text style={styles.grandLabel}>
                    {t('examinations.form.obtainedMarks')}
                  </Text>
                  <Text style={styles.grandValuePrimary}>
                    {obtainedMarks} / {form.totalMarks || 100}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* READING & WRITING */}
          {formType === 'reading' && (
            <>
              <Text style={styles.sectionTitle}>
                {t('examinations.form.sectionReading')}
              </Text>

              <View style={styles.weightsCard}>
                <Text style={styles.weightsTitle}>
                  {t('examinations.form.categoryWeights')}
                </Text>
                <View style={styles.weightsGrid}>
                  {(
                    [
                      'readingScore',
                      'writingScore',
                      'hijaa',
                      'ayahs',
                    ] as (keyof ReadingWritingWeights)[]
                  ).map((k) => (
                    <View key={k} style={styles.weightItem}>
                      <Text style={styles.weightLabel}>
                        {k.replace('Score', '')}
                      </Text>
                      <TextInput
                        style={styles.weightInput}
                        value={String(readingWeights[k] ?? 0)}
                        onChangeText={(v) => {
                          const n = parseFloat(v.replace(/[^0-9.]/g, '')) || 0;
                          updateReadingWeight(k, n);
                        }}
                        keyboardType="numeric"
                      />
                    </View>
                  ))}
                </View>
                <Text style={styles.weightsHint}>
                  {t('examinations.form.weightsHint', {
                    total: form.totalMarks || 100,
                  })}
                </Text>
              </View>

              {readingHeaders
                .filter(
                  (h) =>
                    h.id !== 'total' &&
                    h.id !== 'estimation' &&
                    h.id !== 'readingScore' &&
                    h.id !== 'writingScore' &&
                    h.id !== 'hijaa' &&
                    h.id !== 'ayahs'
                )
                .map((h) => {
                  const skillHeaders = readingHeaders.filter(
                    (x) =>
                      x.id !== 'total' &&
                      x.id !== 'estimation' &&
                      x.id !== 'readingScore' &&
                      x.id !== 'writingScore' &&
                      x.id !== 'hijaa' &&
                      x.id !== 'ayahs'
                  );
                  const count = skillHeaders.length || 1;
                  const readingMax = (readingWeights.readingScore || 0) / count;
                  const writingMax = (readingWeights.writingScore || 0) / count;
                  const hijaaMax = (readingWeights.hijaa || 0) / count;
                  const ayahsMax = (readingWeights.ayahs || 0) / count;

                  const readingVal = form.readingWritingScores[`${h.id}_reading`] ?? 0;
                  const writingVal = form.readingWritingScores[`${h.id}_writing`] ?? 0;
                  const hijaaVal = form.readingWritingScores[`${h.id}_hijaa`] ?? 0;
                  const ayahsVal = form.readingWritingScores[`${h.id}_ayahs`] ?? 0;

                  return (
                    <View key={h.id} style={styles.skillCard}>
                      <Text style={styles.skillLabel}>{h.label}</Text>
                      {(
                        [
                          [
                            t('examinations.reading.reading').toLowerCase(),
                            readingVal,
                            readingMax,
                            COLORS.blue,
                          ],
                          [
                            t('examinations.reading.writing').toLowerCase(),
                            writingVal,
                            writingMax,
                            COLORS.primary,
                          ],
                          [
                            t('examinations.reading.hijaa').toLowerCase(),
                            hijaaVal,
                            hijaaMax,
                            COLORS.amber,
                          ],
                          [
                            t('examinations.reading.ayahs').toLowerCase(),
                            ayahsVal,
                            ayahsMax,
                            COLORS.pink,
                          ],
                        ] as [string, any, number, string][]
                      ).map(([cat, val, max, color]) => (
                        <View key={cat} style={styles.counterRow}>
                          <Text style={[styles.counterLabel, { color }]}>
                            {cat.charAt(0).toUpperCase() + cat.slice(1)} (
                            {round2(max)} max)
                          </Text>
                          <View style={styles.counterControls}>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => {
                                const current =
                                  typeof val === 'number'
                                    ? val
                                    : parseFloat(String(val)) || 0;
                                const nv = Math.max(0, round2(current - 0.1));
                                updateReadingScore(`${h.id}_${cat}`, nv, max);
                              }}
                            >
                              <Ionicons
                                name="remove"
                                size={14}
                                color={COLORS.slate}
                              />
                            </TouchableOpacity>
                            <TextInput
                              style={styles.counterInput}
                              value={String(val)}
                              onChangeText={(v) =>
                                updateReadingScore(`${h.id}_${cat}`, v, max)
                              }
                              keyboardType="numeric"
                            />
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => {
                                const current =
                                  typeof val === 'number'
                                    ? val
                                    : parseFloat(String(val)) || 0;
                                const nv = Math.min(max, round2(current + 0.1));
                                updateReadingScore(`${h.id}_${cat}`, nv, max);
                              }}
                            >
                              <Ionicons
                                name="add"
                                size={14}
                                color={COLORS.slate}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })}

              <View style={styles.grandTotalCard}>
                <View style={styles.grandRow}>
                  <Text style={styles.grandLabel}>
                    {t('examinations.reading.reading')}
                  </Text>
                  <Text style={[styles.grandValue, { color: COLORS.blue }]}>
                    {readingTotals.readingTotal} / {readingWeights.readingScore}
                  </Text>
                </View>
                <View style={styles.grandRow}>
                  <Text style={styles.grandLabel}>
                    {t('examinations.reading.writing')}
                  </Text>
                  <Text style={[styles.grandValue, { color: COLORS.primary }]}>
                    {readingTotals.writingTotal} / {readingWeights.writingScore}
                  </Text>
                </View>
                <View style={styles.grandRow}>
                  <Text style={styles.grandLabel}>
                    {t('examinations.reading.hijaa')}
                  </Text>
                  <Text style={[styles.grandValue, { color: COLORS.amber }]}>
                    {readingTotals.hijaaTotal} / {readingWeights.hijaa}
                  </Text>
                </View>
                <View style={styles.grandRow}>
                  <Text style={styles.grandLabel}>
                    {t('examinations.reading.ayahs')}
                  </Text>
                  <Text style={[styles.grandValue, { color: COLORS.pink }]}>
                    {readingTotals.ayahsTotal} / {readingWeights.ayahs}
                  </Text>
                </View>
                <View style={[styles.grandRow, styles.grandRowTop]}>
                  <Text style={styles.grandLabelBold}>
                    {t('examinations.form.grandTotal')}
                  </Text>
                  <Text style={styles.grandValuePrimary}>
                    {readingTotals.grandTotal} / {readingTotals.maxTotal}
                  </Text>
                </View>
                <View style={styles.grandRow}>
                  <Text style={styles.grandLabel}>
                    {t('examinations.form.grade')}
                  </Text>
                  <Text style={styles.grandValue}>
                    {getGradeLabel(readingTotals.percentage)} (
                    {readingTotals.percentage}%)
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* NOTES */}
          <Text style={styles.sectionTitle}>
            {t('examinations.form.sectionNotes')}
          </Text>
          <Text style={styles.label}>
            {t('examinations.form.positiveNotes')}
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.notes.positive}
            onChangeText={(v) => updateNotes('positive', v)}
            placeholder={t('examinations.form.positivePlaceholder')}
            placeholderTextColor="#A0AAA5"
            multiline
          />
          <Text style={styles.label}>
            {t('examinations.form.negativeNotes')}
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.notes.negative}
            onChangeText={(v) => updateNotes('negative', v)}
            placeholder={t('examinations.form.negativePlaceholder')}
            placeholderTextColor="#A0AAA5"
            multiline
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onBack}
            disabled={saving}
          >
            <Text style={styles.cancelBtnText}>
              {t('examinations.form.cancel')}
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
                <Ionicons name="save" size={16} color="#fff" />
                <Text style={styles.saveBtnText}>
                  {isEditing
                    ? t('examinations.form.update')
                    : t('examinations.form.save')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

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
  body: { flex: 1, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  smallAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.purpleLight,
    borderRadius: 10,
  },
  smallAddBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.purple },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.slate,
    backgroundColor: COLORS.white,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  hint: { fontSize: 11, color: COLORS.gray, fontStyle: 'italic', marginTop: 4 },
  twoCol: { flexDirection: 'row', gap: 10, marginTop: 4 },
  formTypeRow: { flexDirection: 'row', gap: 8 },
  formTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  formTypeBtnActive: {
    backgroundColor: COLORS.blueLight,
    borderColor: COLORS.blue,
  },
  formTypeBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.slateMuted },
  formTypeBtnTextActive: { color: COLORS.blue, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: COLORS.slateMuted },
  chipTextActive: { color: COLORS.primary },
  examinerRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightsCard: {
    backgroundColor: COLORS.purpleLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  weightsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.purple,
    marginBottom: 8,
  },
  weightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weightItem: { flex: 1, minWidth: '22%', alignItems: 'center' },
  weightLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slateMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  weightInput: {
    width: '100%',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.purple,
    backgroundColor: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.purple,
    textAlign: 'center',
  },
  weightsHint: {
    fontSize: 11,
    color: COLORS.slateMuted,
    marginTop: 8,
    fontStyle: 'italic',
  },
  questionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  questionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.slate },
  questionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageInput: {
    width: 70,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 12,
    textAlign: 'center',
    color: COLORS.slate,
    backgroundColor: COLORS.background,
  },
  deleteQBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.redLight,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  counterLabel: { fontSize: 12, fontWeight: '700', color: COLORS.slate, flex: 1 },
  counterWeight: { fontSize: 11, fontWeight: '400', color: COLORS.slateMuted },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    minWidth: 30,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
  },
  counterInput: {
    width: 60,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 13,
    textAlign: 'center',
    color: COLORS.slate,
    backgroundColor: COLORS.background,
    fontWeight: '700',
  },
  questionTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  questionTotalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
  },
  questionTotalValue: { fontSize: 14, fontWeight: '800' },
  grandTotalCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 20,
  },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  grandRowTop: {
    borderTopWidth: 1,
    borderTopColor: COLORS.primary,
    marginTop: 6,
    paddingTop: 8,
  },
  grandLabel: { fontSize: 12, fontWeight: '700', color: COLORS.slateMuted },
  grandLabelBold: { fontSize: 13, fontWeight: '800', color: COLORS.slate },
  grandValue: { fontSize: 14, fontWeight: '800' },
  grandValuePrimary: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  skillCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  skillLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
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
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});