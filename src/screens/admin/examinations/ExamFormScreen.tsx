// src/screens/admin/examinations/ExamFormScreen.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { KeyboardAwareScreen } from '../../../components/common/KeyboardAwareScreen';
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
  ReadingCategory,
  StudentLite,
  READING_CATEGORIES,
  DEFAULT_COLUMNS,
  DEFAULT_EXAM_TYPES,
  DEFAULT_MARKS_PER,
  DEFAULT_READING_HEADERS,
  DEFAULT_READING_WEIGHTS,
  DEFAULT_ENABLED_CATEGORIES,
  api,
  getExamFormType,
  getVisibleColumns,
  getJuzName,
  getSurahName,
  round2,
  getEnabledSkillHeaders,
  getEnabledCategories,
  getEffectiveWeights,
  getEffectiveMaxTotal,
  calculateExactSkillMaxes,
  calculateCategoryTotal,
  calculateGrandTotal,
  SURAH_LIST,
  JUZ_NAMES,
} from './_shared';

// ============================================================
// MODULE-LEVEL HELPERS
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

const ORDINAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

/** Build a fresh "everything enabled" toggles object from a header list. */
const buildDefaultEnabledSkills = (
  headers: ReadingWritingHeader[]
): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  headers.forEach((h) => {
    if (
      h.id !== 'total' &&
      h.id !== 'estimation' &&
      h.id !== 'readingScore' &&
      h.id !== 'writingScore' &&
      h.id !== 'hijaa' &&
      h.id !== 'ayahs'
    ) {
      out[h.id] = true;
    }
  });
  return out;
};

/** "Abdullah Ahmed" → "AA"; single-word "Maryam" → "MA". */
const getInitials = (name?: string): string => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

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
  const [enabledSkills, setEnabledSkills] = useState<Record<string, boolean>>(
    buildDefaultEnabledSkills(
      settings?.readingWritingHeaders || DEFAULT_READING_HEADERS
    )
  );
  const [enabledCategories, setEnabledCategories] = useState<
    Partial<Record<ReadingCategory, boolean>>
  >({ ...DEFAULT_ENABLED_CATEGORIES });
  const [dateType, setDateType] = useState<'gregorian' | 'hijri' | 'both'>(
    'gregorian'
  );

  const [halaqat, setHalaqat] = useState<Halaqah[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // -------- NEW: student search --------
  const [studentSearch, setStudentSearch] = useState('');

  // ----------------------------------------------------------------
  // Load halaqat once
  // ----------------------------------------------------------------
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

  // ----------------------------------------------------------------
  // Hydrate from exam (edit) or reset (create)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!exam) {
      setForm(buildEmptyForm(settings));
      setMarksPer(settings ? { ...DEFAULT_MARKS_PER } : DEFAULT_MARKS_PER);
      const headers = settings?.readingWritingHeaders || DEFAULT_READING_HEADERS;
      setReadingHeaders(headers);
      setReadingWeights(settings?.readingWritingWeights || DEFAULT_READING_WEIGHTS);
      setEnabledSkills(buildDefaultEnabledSkills(headers));
      setEnabledCategories({ ...DEFAULT_ENABLED_CATEGORIES });
      setFormType('memorization');
      setDateType('gregorian');
      setStudentSearch('');
      return;
    }

    const formTypeRaw: ExamFormType = getExamFormType(exam);
    setFormType(formTypeRaw);

    // Date hydration
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

    // Normalize questions' customColumns
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

    // Hydrate marksPer
    if (exam.marksPer) setMarksPer(exam.marksPer);
    else setMarksPer(DEFAULT_MARKS_PER);

    // Hydrate headers / weights
    const headers =
      exam.readingWritingHeaders ||
      settings?.readingWritingHeaders ||
      DEFAULT_READING_HEADERS;
    setReadingHeaders(headers);

    if (exam.readingWritingWeights) setReadingWeights(exam.readingWritingWeights);
    else if (settings?.readingWritingWeights)
      setReadingWeights(settings.readingWritingWeights);
    else setReadingWeights(DEFAULT_READING_WEIGHTS);

    // Hydrate toggles
    if (exam.enabledSkills) {
      const merged: Record<string, boolean> = buildDefaultEnabledSkills(headers);
      Object.keys(exam.enabledSkills).forEach((k) => {
        merged[k] = exam.enabledSkills![k];
      });
      setEnabledSkills(merged);
    } else {
      setEnabledSkills(buildDefaultEnabledSkills(headers));
    }

    if (exam.enabledCategories) {
      setEnabledCategories({
        ...DEFAULT_ENABLED_CATEGORIES,
        ...exam.enabledCategories,
      });
    } else {
      setEnabledCategories({ ...DEFAULT_ENABLED_CATEGORIES });
    }

    setStudentSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam]);

  // ----------------------------------------------------------------
  // Load students when halaqah changes
  // ----------------------------------------------------------------
  useEffect(() => {
    const halaqah = form.halaqah;
    if (!halaqah) {
      setStudents([]);
      setStudentSearch('');
      return;
    }
    (async () => {
      setLoadingStudents(true);
      setStudentSearch('');
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

  // ----------------------------------------------------------------
  // Basic updaters
  // ----------------------------------------------------------------
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

  // ----------------------------------------------------------------
  // Reading toggles
  // ----------------------------------------------------------------
  const toggleSkill = (skillId: string) => {
    setEnabledSkills((prev) => ({ ...prev, [skillId]: !prev[skillId] }));
  };

  const toggleCategory = (category: ReadingCategory) => {
    setEnabledCategories((prev) => ({
      ...prev,
      [category]: !(prev[category] !== false),
    }));
  };

  // ----------------------------------------------------------------
  // Reading weights — clamp against ENABLED categories only
  // ----------------------------------------------------------------
  const updateReadingWeight = (
    key: keyof ReadingWritingWeights,
    rawValue: number
  ) => {
    setReadingWeights((prev) => {
      const totalMarks = form.totalMarks || 100;
      const otherEnabledTotal = READING_CATEGORIES.filter(
        (cat) => cat !== key && enabledCategories[cat] !== false
      ).reduce((sum, cat) => sum + (prev[cat] || 0), 0);

      const maxForThis = Math.max(0, round2(totalMarks - otherEnabledTotal));
      const clamped = Math.max(0, Math.min(rawValue, maxForThis));
      return { ...prev, [key]: round2(clamped) };
    });
  };

  // ----------------------------------------------------------------
  // Reading per-skill score updates
  // ----------------------------------------------------------------
  const updateReadingScore = (
    key: string,
    rawValue: number | string,
    maxVal: number
  ) => {
    setForm((prev) => {
      if (rawValue === '') {
        return {
          ...prev,
          readingWritingScores: { ...prev.readingWritingScores, [key]: '' },
        };
      }
      const num = parseFloat(String(rawValue));
      if (isNaN(num)) return prev;
      const clamped = Math.max(0, Math.min(num, maxVal));
      const rounded = Math.round(clamped * 100) / 100;
      return {
        ...prev,
        readingWritingScores: {
          ...prev.readingWritingScores,
          [key]: rounded,
        },
      };
    });
  };

  const incrementReadingScore = (key: string, maxVal: number) => {
    const cur = parseFloat(String(form.readingWritingScores[key] ?? 0)) || 0;
    updateReadingScore(key, round2(Math.min(cur + 0.1, maxVal)), maxVal);
  };

  const decrementReadingScore = (key: string, maxVal: number) => {
    const cur = parseFloat(String(form.readingWritingScores[key] ?? 0)) || 0;
    updateReadingScore(key, round2(Math.max(cur - 0.1, 0)), maxVal);
  };

  // ----------------------------------------------------------------
  // "Fill All Scores" — set every enabled skill/category to its exact max
  // ----------------------------------------------------------------
  const handleFillAllScores = () => {
    const enabledSkillsList = getEnabledSkillHeaders(readingHeaders, enabledSkills);
    const effectiveWeights = getEffectiveWeights(readingWeights, enabledCategories);
    const exact = calculateExactSkillMaxes(enabledSkillsList, effectiveWeights);

    const next: Record<string, number | string> = {
      ...form.readingWritingScores,
    };

    enabledSkillsList.forEach((h, idx) => {
      const rMax =
        enabledCategories.readingScore !== false ? exact.reading[idx] || 0 : 0;
      const wMax =
        enabledCategories.writingScore !== false ? exact.writing[idx] || 0 : 0;
      const hjMax =
        enabledCategories.hijaa !== false ? exact.hijaa[idx] || 0 : 0;
      const ayMax =
        enabledCategories.ayahs !== false ? exact.ayahs[idx] || 0 : 0;

      if (enabledCategories.readingScore !== false)
        next[`${h.id}_reading`] = rMax;
      if (enabledCategories.writingScore !== false)
        next[`${h.id}_writing`] = wMax;
      if (enabledCategories.hijaa !== false) next[`${h.id}_hijaa`] = hjMax;
      if (enabledCategories.ayahs !== false) next[`${h.id}_ayahs`] = ayMax;
    });

    setForm((prev) => ({ ...prev, readingWritingScores: next }));
  };

  // ----------------------------------------------------------------
  // "Fill All Weights" — distribute totalMarks across enabled categories
  // ----------------------------------------------------------------
  const handleFillAllWeights = () => {
    const totalMarks = form.totalMarks || 100;
    const enabledCats = getEnabledCategories(enabledCategories);

    if (enabledCats.length === 0) return;

    const currentEnabledTotal = enabledCats.reduce(
      (sum, cat) => sum + (readingWeights[cat] || 0),
      0
    );

    const next: ReadingWritingWeights = { ...readingWeights };

    if (currentEnabledTotal > 0) {
      const rawShares = enabledCats.map(
        (cat) => ((readingWeights[cat] || 0) / currentEnabledTotal) * totalMarks
      );
      const cents = rawShares.map((v) => Math.floor(round2(v) * 100));
      const usedCents = cents.reduce((s, c) => s + c, 0);
      const remainder = Math.round(totalMarks * 100) - usedCents;
      if (remainder > 0) {
        const order = cents
          .map((c, i) => ({ i, frac: rawShares[i] * 100 - c }))
          .sort((a, b) => b.frac - a.frac);
        for (let k = 0; k < remainder; k++) {
          cents[order[k % order.length].i] += 1;
        }
      }
      enabledCats.forEach((cat, i) => {
        next[cat] = cents[i] / 100;
      });
    } else {
      const totalCents = Math.round(totalMarks * 100);
      const baseCents = Math.floor(totalCents / enabledCats.length);
      const remainder = totalCents - baseCents * enabledCats.length;
      enabledCats.forEach((cat, i) => {
        next[cat] = (baseCents + (i === 0 ? remainder : 0)) / 100;
      });
    }

    READING_CATEGORIES.forEach((cat) => {
      if (enabledCategories[cat] === false) next[cat] = 0;
    });

    setReadingWeights(next);
  };

  // ----------------------------------------------------------------
  // Derived — memorization
  // ----------------------------------------------------------------
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

  // ----------------------------------------------------------------
  // Derived — Reading
  // ----------------------------------------------------------------
  const enabledSkillsList = useMemo(
    () => getEnabledSkillHeaders(readingHeaders, enabledSkills),
    [readingHeaders, enabledSkills]
  );

  const enabledCatsList = useMemo(
    () => getEnabledCategories(enabledCategories),
    [enabledCategories]
  );

  const effectiveWeights = useMemo(
    () => getEffectiveWeights(readingWeights, enabledCategories),
    [readingWeights, enabledCategories]
  );

  const exactSkillMaxes = useMemo(
    () => calculateExactSkillMaxes(enabledSkillsList, effectiveWeights),
    [enabledSkillsList, effectiveWeights]
  );

  const readingTotals = useMemo(() => {
    const readingTotal = calculateCategoryTotal(
      form.readingWritingScores,
      enabledSkillsList,
      'readingScore'
    );
    const writingTotal = calculateCategoryTotal(
      form.readingWritingScores,
      enabledSkillsList,
      'writingScore'
    );
    const hijaaTotal = calculateCategoryTotal(
      form.readingWritingScores,
      enabledSkillsList,
      'hijaa'
    );
    const ayahsTotal = calculateCategoryTotal(
      form.readingWritingScores,
      enabledSkillsList,
      'ayahs'
    );
    const grandTotal = round2(
      readingTotal + writingTotal + hijaaTotal + ayahsTotal
    );
    const maxTotal = getEffectiveMaxTotal(readingWeights, enabledCategories);
    const pct = maxTotal > 0 ? (grandTotal / maxTotal) * 100 : 0;
    return {
      readingTotal,
      writingTotal,
      hijaaTotal,
      ayahsTotal,
      grandTotal,
      maxTotal,
      percentage: round2(pct),
    };
  }, [
    form.readingWritingScores,
    enabledSkillsList,
    readingWeights,
    enabledCategories,
  ]);

  // ----------------------------------------------------------------
  // Derived — filtered students (NEW)
  // ----------------------------------------------------------------
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.toLowerCase().trim();
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, studentSearch]);

  // ----------------------------------------------------------------
  // Save
  // ----------------------------------------------------------------
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
        computedTotalMarks = getEffectiveMaxTotal(
          readingWeights,
          enabledCategories
        );
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
        enabledSkills: formType === 'reading' ? enabledSkills : undefined,
        enabledCategories:
          formType === 'reading' ? enabledCategories : undefined,
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

  // ============================================================
  // RENDER
  // ============================================================
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

      <KeyboardAwareScreen
        contentContainerStyle={styles.body}
        extraBottomOffset={90}
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

          {/* ================================================================
              STUDENT PICKER (professional)
          ================================================================ */}
          {form.halaqah ? (
            <>
              <Text style={styles.label}>
                {t('examinations.form.student')}
              </Text>

              {loadingStudents ? (
                <View style={styles.studentLoadingWrap}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.studentLoadingText}>
                    {t('examinations.form.loadingStudents') ||
                      'Loading students…'}
                  </Text>
                </View>
              ) : students.length === 0 ? (
                <View style={styles.studentEmptyWrap}>
                  <Ionicons
                    name="people-outline"
                    size={28}
                    color={COLORS.gray}
                  />
                  <Text style={styles.studentEmptyText}>
                    {t('examinations.form.noStudents')}
                  </Text>
                </View>
              ) : form.studentId && form.studentName ? (
                // -------- SELECTED STUDENT CARD --------
                <View style={styles.selectedStudentCard}>
                  <View style={styles.selectedStudentAvatar}>
                    <Text style={styles.selectedStudentAvatarText}>
                      {getInitials(form.studentName)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={styles.selectedStudentName}
                      numberOfLines={1}
                    >
                      {form.studentName}
                    </Text>
                    <Text
                      style={styles.selectedStudentMeta}
                      numberOfLines={1}
                    >
                      {t('examinations.form.selected') || 'Selected student'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.selectedStudentChangeBtn}
                    onPress={() => {
                      update('studentId', '');
                      update('studentName', '');
                    }}
                  >
                    <Ionicons
                      name="swap-horizontal"
                      size={14}
                      color={COLORS.primary}
                    />
                    <Text style={styles.selectedStudentChangeBtnText}>
                      {t('examinations.form.change') || 'Change'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                // -------- SEARCH + LIST PICKER --------
                <View>
                  <View style={styles.studentSearchWrapper}>
                    <Ionicons
                      name="search-outline"
                      size={16}
                      color={COLORS.gray}
                    />
                    <TextInput
                      style={styles.studentSearchInput}
                      value={studentSearch}
                      onChangeText={setStudentSearch}
                      placeholder={
                        t('examinations.form.searchStudent') ||
                        'Search student…'
                      }
                      placeholderTextColor="#A0AAA5"
                    />
                    {studentSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setStudentSearch('')}>
                        <Ionicons
                          name="close-circle"
                          size={16}
                          color={COLORS.gray}
                        />
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.studentCountHint}>
                    {filteredStudents.length}{' '}
                    {t('examinations.form.studentsCount') || 'students'}
                  </Text>

                  <View style={styles.studentListContainer}>
                    <ScrollView
                      style={styles.studentListScroll}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator
                    >
                      {filteredStudents.length === 0 ? (
                        <View style={styles.studentNoMatchWrap}>
                          <Ionicons
                            name="search-outline"
                            size={20}
                            color={COLORS.gray}
                          />
                          <Text style={styles.studentNoMatchText}>
                            {t('examinations.form.noSearchResults') ||
                              'No students match your search'}
                          </Text>
                        </View>
                      ) : (
                        filteredStudents.map((s) => {
                          const active = form.studentId === s._id;
                          return (
                            <TouchableOpacity
                              key={s._id}
                              style={[
                                styles.studentRow,
                                active && styles.studentRowActive,
                              ]}
                              onPress={() => {
                                update('studentId', s._id);
                                update('studentName', s.name);
                                setStudentSearch('');
                              }}
                              activeOpacity={0.7}
                            >
                              <View
                                style={[
                                  styles.studentRowAvatar,
                                  active && styles.studentRowAvatarActive,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.studentRowAvatarText,
                                    active &&
                                      styles.studentRowAvatarTextActive,
                                  ]}
                                >
                                  {getInitials(s.name)}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.studentRowName,
                                  active && styles.studentRowNameActive,
                                ]}
                                numberOfLines={1}
                              >
                                {s.name}
                              </Text>
                              {active && (
                                <Ionicons
                                  name="checkmark-circle"
                                  size={18}
                                  color={COLORS.primary}
                                />
                              )}
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </ScrollView>
                  </View>
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

          {/* ================================================================
              MEMORIZATION: QUESTION BREAKDOWN
          ================================================================ */}
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
                          totalDeduction > 0 ? COLORS.red : COLORS.primary,
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

          {/* ================================================================
              READING & WRITING
          ================================================================ */}
          {formType === 'reading' && (
            <>
              <Text style={styles.sectionTitle}>
                {t('examinations.form.sectionReading')}
              </Text>

              {/* Category weights + Fill All Weights button */}
              <View style={styles.weightsCard}>
                <View style={styles.weightsCardHeader}>
                  <Text style={styles.weightsTitle}>
                    {t('examinations.form.categoryWeights')}
                  </Text>
                  <TouchableOpacity
                    style={styles.fillBtn}
                    onPress={handleFillAllWeights}
                  >
                    <Ionicons name="arrow-up" size={12} color={COLORS.purple} />
                    <Text style={styles.fillBtnText}>
                      {t('examinations.form.fillAllWeights') || 'Fill All'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.weightsGrid}>
                  {READING_CATEGORIES.map((k) => {
                    const catEnabled = enabledCategories[k] !== false;
                    const otherEnabledTotal = READING_CATEGORIES.filter(
                      (cat) => cat !== k && enabledCategories[cat] !== false
                    ).reduce((sum, cat) => sum + (readingWeights[cat] || 0), 0);
                    const maxForThis = catEnabled
                      ? Math.max(
                          0,
                          round2((form.totalMarks || 100) - otherEnabledTotal)
                        )
                      : 0;
                    return (
                      <View key={k} style={styles.weightItem}>
                        <TouchableOpacity
                          style={styles.weightToggleRow}
                          onPress={() => toggleCategory(k)}
                        >
                          <Ionicons
                            name={catEnabled ? 'checkbox' : 'square-outline'}
                            size={14}
                            color={catEnabled ? COLORS.purple : COLORS.gray}
                          />
                          <Text
                            style={[
                              styles.weightLabel,
                              !catEnabled && {
                                textDecorationLine: 'line-through',
                                color: COLORS.gray,
                              },
                            ]}
                          >
                            {t(`examinations.form.categories.${k}`) || k}
                          </Text>
                        </TouchableOpacity>
                        <TextInput
                          style={[
                            styles.weightInput,
                            !catEnabled && {
                              opacity: 0.5,
                              backgroundColor: COLORS.background,
                            },
                          ]}
                          value={String(readingWeights[k] ?? 0)}
                          onChangeText={(v) => {
                            const n = parseFloat(v.replace(/[^0-9.]/g, '')) || 0;
                            updateReadingWeight(k, n);
                          }}
                          keyboardType="numeric"
                          editable={catEnabled}
                        />
                        {catEnabled && (
                          <Text style={styles.weightMaxHint}>
                            max {maxForThis}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>

                <View style={styles.weightsTotalRow}>
                  <Text style={styles.weightsTotalLabel}>
                    {t('examinations.form.total') || 'Total'}
                  </Text>
                  <Text
                    style={[
                      styles.weightsTotalValue,
                      {
                        color:
                          getEffectiveMaxTotal(
                            readingWeights,
                            enabledCategories
                          ) === (form.totalMarks || 100)
                            ? COLORS.primary
                            : getEffectiveMaxTotal(
                                readingWeights,
                                enabledCategories
                              ) > (form.totalMarks || 100)
                            ? COLORS.red
                            : COLORS.amber,
                      },
                    ]}
                  >
                    {getEffectiveMaxTotal(readingWeights, enabledCategories)} /{' '}
                    {form.totalMarks || 100}
                  </Text>
                </View>
                <Text style={styles.weightsHint}>
                  {t('examinations.form.weightsHint', {
                    total: form.totalMarks || 100,
                  })}
                </Text>
              </View>

              {/* Skills header + Fill All Scores button */}
              <View style={styles.skillsSectionHeader}>
                <Text style={styles.skillsSectionTitle}>
                  {t('examinations.form.skillsAndScores') || 'Skills & Scores'}
                </Text>
                <TouchableOpacity
                  style={styles.fillScoresBtn}
                  onPress={handleFillAllScores}
                >
                  <Ionicons name="checkmark" size={12} color={COLORS.primary} />
                  <Text style={styles.fillScoresBtnText}>
                    {t('examinations.form.fillAllScores') || 'Fill All Scores'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Per-skill cards with toggle + 4 category inputs */}
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
                  const skillEnabled = enabledSkills[h.id] !== false;
                  const skillIdx = enabledSkillsList.findIndex(
                    (s) => s.id === h.id
                  );

                  const rMax =
                    enabledCategories.readingScore !== false && skillIdx >= 0
                      ? exactSkillMaxes.reading[skillIdx] || 0
                      : 0;
                  const wMax =
                    enabledCategories.writingScore !== false && skillIdx >= 0
                      ? exactSkillMaxes.writing[skillIdx] || 0
                      : 0;
                  const hjMax =
                    enabledCategories.hijaa !== false && skillIdx >= 0
                      ? exactSkillMaxes.hijaa[skillIdx] || 0
                      : 0;
                  const ayMax =
                    enabledCategories.ayahs !== false && skillIdx >= 0
                      ? exactSkillMaxes.ayahs[skillIdx] || 0
                      : 0;

                  const readingVal =
                    form.readingWritingScores[`${h.id}_reading`] ?? 0;
                  const writingVal =
                    form.readingWritingScores[`${h.id}_writing`] ?? 0;
                  const hijaaVal =
                    form.readingWritingScores[`${h.id}_hijaa`] ?? 0;
                  const ayahsVal =
                    form.readingWritingScores[`${h.id}_ayahs`] ?? 0;

                  const categoryRows: {
                    cat: ReadingCategory;
                    suffix: string;
                    label: string;
                    val: number | string;
                    max: number;
                    color: string;
                  }[] = [
                    {
                      cat: 'readingScore' as const,
                      suffix: 'reading',
                      label: t('examinations.reading.reading'),
                      val: readingVal,
                      max: rMax,
                      color: COLORS.blue,
                    },
                    {
                      cat: 'writingScore' as const,
                      suffix: 'writing',
                      label: t('examinations.reading.writing'),
                      val: writingVal,
                      max: wMax,
                      color: COLORS.primary,
                    },
                    {
                      cat: 'hijaa' as const,
                      suffix: 'hijaa',
                      label: t('examinations.reading.hijaa'),
                      val: hijaaVal,
                      max: hjMax,
                      color: COLORS.amber,
                    },
                    {
                      cat: 'ayahs' as const,
                      suffix: 'ayahs',
                      label: t('examinations.reading.ayahs'),
                      val: ayahsVal,
                      max: ayMax,
                      color: COLORS.pink,
                    },
                  ].filter((row) => enabledCategories[row.cat] !== false);

                  return (
                    <View
                      key={h.id}
                      style={[
                        styles.skillCard,
                        !skillEnabled && styles.skillCardDisabled,
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.skillHeaderRow}
                        onPress={() => toggleSkill(h.id)}
                      >
                        <Ionicons
                          name={skillEnabled ? 'checkbox' : 'square-outline'}
                          size={18}
                          color={skillEnabled ? COLORS.purple : COLORS.gray}
                        />
                        <Text
                          style={[
                            styles.skillLabel,
                            !skillEnabled && {
                              textDecorationLine: 'line-through',
                              color: COLORS.gray,
                            },
                          ]}
                        >
                          {h.label}
                        </Text>
                      </TouchableOpacity>

                      {skillEnabled &&
                        categoryRows.map((row) => {
                          const scoreK = `${h.id}_${row.suffix}`;
                          const numericVal =
                            typeof row.val === 'number'
                              ? row.val
                              : parseFloat(String(row.val)) || 0;
                          return (
                            <View key={row.cat} style={styles.counterRow}>
                              <Text
                                style={[
                                  styles.counterLabel,
                                  { color: row.color },
                                ]}
                              >
                                {row.label}
                                <Text style={styles.counterWeight}>
                                  {' '}
                                  (max {round2(row.max)})
                                </Text>
                              </Text>
                              <View style={styles.counterControls}>
                                <TouchableOpacity
                                  style={styles.counterBtn}
                                  onPress={() =>
                                    decrementReadingScore(scoreK, row.max)
                                  }
                                >
                                  <Ionicons
                                    name="remove"
                                    size={14}
                                    color={COLORS.slate}
                                  />
                                </TouchableOpacity>
                                <TextInput
                                  style={styles.counterInput}
                                  value={String(numericVal)}
                                  onChangeText={(v) =>
                                    updateReadingScore(scoreK, v, row.max)
                                  }
                                  keyboardType="numeric"
                                />
                                <TouchableOpacity
                                  style={styles.counterBtn}
                                  onPress={() =>
                                    incrementReadingScore(scoreK, row.max)
                                  }
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

                      {skillEnabled && categoryRows.length === 0 && (
                        <Text style={styles.hint}>
                          {t('examinations.form.noCategoriesEnabled') ||
                            'No categories enabled'}
                        </Text>
                      )}
                    </View>
                  );
                })}

              {/* Summary card */}
              <View style={styles.grandTotalCard}>
                {enabledCategories.readingScore !== false && (
                  <View style={styles.grandRow}>
                    <Text style={styles.grandLabel}>
                      {t('examinations.reading.reading')}
                    </Text>
                    <Text style={[styles.grandValue, { color: COLORS.blue }]}>
                      {readingTotals.readingTotal} /{' '}
                      {round2(effectiveWeights.readingScore)}
                    </Text>
                  </View>
                )}
                {enabledCategories.writingScore !== false && (
                  <View style={styles.grandRow}>
                    <Text style={styles.grandLabel}>
                      {t('examinations.reading.writing')}
                    </Text>
                    <Text
                      style={[styles.grandValue, { color: COLORS.primary }]}
                    >
                      {readingTotals.writingTotal} /{' '}
                      {round2(effectiveWeights.writingScore)}
                    </Text>
                  </View>
                )}
                {enabledCategories.hijaa !== false && (
                  <View style={styles.grandRow}>
                    <Text style={styles.grandLabel}>
                      {t('examinations.reading.hijaa')}
                    </Text>
                    <Text style={[styles.grandValue, { color: COLORS.amber }]}>
                      {readingTotals.hijaaTotal} /{' '}
                      {round2(effectiveWeights.hijaa)}
                    </Text>
                  </View>
                )}
                {enabledCategories.ayahs !== false && (
                  <View style={styles.grandRow}>
                    <Text style={styles.grandLabel}>
                      {t('examinations.reading.ayahs')}
                    </Text>
                    <Text style={[styles.grandValue, { color: COLORS.pink }]}>
                      {readingTotals.ayahsTotal} /{' '}
                      {round2(effectiveWeights.ayahs)}
                    </Text>
                  </View>
                )}
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
        </KeyboardAwareScreen>

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
    </SafeAreaView>
  );
};

// ============================================================
// STYLES
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
  body: { paddingHorizontal: 16 },
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

  // ---------- Student picker ----------
  studentLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  studentLoadingText: {
    fontSize: 12,
    color: COLORS.slateMuted,
    fontStyle: 'italic',
  },
  studentEmptyWrap: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 24,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  studentEmptyText: {
    fontSize: 12,
    color: COLORS.slateMuted,
    textAlign: 'center',
  },
  selectedStudentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  selectedStudentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedStudentAvatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  selectedStudentName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.slate,
  },
  selectedStudentMeta: {
    fontSize: 11,
    color: COLORS.slateMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  selectedStudentChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  selectedStudentChangeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  studentSearchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  studentSearchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.slate,
    paddingVertical: 0,
  },
  studentCountHint: {
    fontSize: 10,
    color: COLORS.slateMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 8,
    marginBottom: 6,
  },
  studentListContainer: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  studentListScroll: {
    maxHeight: 280,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  studentRowActive: {
    backgroundColor: COLORS.primaryLight,
  },
  studentRowAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentRowAvatarActive: {
    backgroundColor: COLORS.primary,
  },
  studentRowAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.blue,
  },
  studentRowAvatarTextActive: {
    color: '#fff',
  },
  studentRowName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate,
  },
  studentRowNameActive: {
    color: COLORS.primary,
  },
  studentNoMatchWrap: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 24,
  },
  studentNoMatchText: {
    fontSize: 12,
    color: COLORS.slateMuted,
    fontStyle: 'italic',
  },

  // Weights
  weightsCard: {
    backgroundColor: COLORS.purpleLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  weightsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weightsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.purple,
  },
  fillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EDE9FE',
  },
  fillBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.purple },
  weightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weightItem: { flex: 1, minWidth: '22%', alignItems: 'center' },
  weightToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  weightLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
  },
  weightMaxHint: {
    fontSize: 9,
    color: COLORS.gray,
    marginTop: 2,
    fontWeight: '600',
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
  weightsTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#DDD6FE',
  },
  weightsTotalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.purple,
    textTransform: 'uppercase',
  },
  weightsTotalValue: { fontSize: 14, fontWeight: '800' },

  // Skills section
  skillsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  skillsSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
    textTransform: 'uppercase',
  },
  fillScoresBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary + '55',
  },
  fillScoresBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Question cards
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

  // Grand total
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

  // Skill cards (Reading)
  skillCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  skillCardDisabled: {
    backgroundColor: COLORS.background,
    opacity: 0.7,
  },
  skillHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  skillLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
  },

  // Footer
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

//   body: { flex: 1, paddingHorizontal: 16 },