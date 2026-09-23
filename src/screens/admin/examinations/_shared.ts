// src/screens/admin/examinations/_shared.ts
import { Ionicons } from '@expo/vector-icons';
import { api as apiClient } from '../../../api/client';

// ============================================================
// COLORS
// ============================================================
export const COLORS = {
  primary: '#0A8E5A',
  primaryDark: '#063D2C',
  primaryLight: '#E9F8F0',
  gold: '#C9A227',
  goldLight: '#FFF7DF',
  blue: '#2878D0',
  blueLight: '#EAF3FF',
  purple: '#7C3AED',
  purpleLight: '#F3EFFF',
  pink: '#DB2777',
  pinkLight: '#FCE7F3',
  teal: '#0D9488',
  tealLight: '#CCFBF1',
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
// SURAH LIST
// ============================================================
export const SURAH_LIST = [
  { id: 1, name: 'Al-Fatihah', arabic: 'سورة الفاتحة', ayahCount: 7 },
  { id: 2, name: 'Al-Baqarah', arabic: 'سورة البقرة', ayahCount: 286 },
  { id: 3, name: 'Aal-Imran', arabic: 'سورة آل عمران', ayahCount: 200 },
  { id: 4, name: 'An-Nisa', arabic: 'سورة النساء', ayahCount: 176 },
  { id: 5, name: "Al-Ma'idah", arabic: 'سورة المائدة', ayahCount: 120 },
  { id: 6, name: "Al-An'am", arabic: 'سورة الأنعام', ayahCount: 165 },
  { id: 7, name: "Al-A'raf", arabic: 'سورة الأعراف', ayahCount: 206 },
  { id: 8, name: 'Al-Anfal', arabic: 'سورة الأنفال', ayahCount: 75 },
  { id: 9, name: 'At-Tawbah', arabic: 'سورة التوبة', ayahCount: 129 },
  { id: 10, name: 'Yunus', arabic: 'سورة يونس', ayahCount: 109 },
  { id: 11, name: 'Hud', arabic: 'سورة هود', ayahCount: 123 },
  { id: 12, name: 'Yusuf', arabic: 'سورة يوسف', ayahCount: 111 },
  { id: 13, name: "Ar-Ra'd", arabic: 'سورة الرعد', ayahCount: 43 },
  { id: 14, name: 'Ibrahim', arabic: 'سورة إبراهيم', ayahCount: 52 },
  { id: 15, name: 'Al-Hijr', arabic: 'سورة الحجر', ayahCount: 99 },
  { id: 16, name: 'An-Nahl', arabic: 'سورة النحل', ayahCount: 128 },
  { id: 17, name: 'Al-Isra', arabic: 'سورة الإسراء', ayahCount: 111 },
  { id: 18, name: 'Al-Kahf', arabic: 'سورة الكهف', ayahCount: 110 },
  { id: 19, name: 'Maryam', arabic: 'سورة مريم', ayahCount: 98 },
  { id: 20, name: 'Taha', arabic: 'سورة طه', ayahCount: 135 },
  { id: 21, name: 'Al-Anbiya', arabic: 'سورة الأنبياء', ayahCount: 112 },
  { id: 22, name: 'Al-Hajj', arabic: 'سورة الحج', ayahCount: 78 },
  { id: 23, name: "Al-Mu'minun", arabic: 'سورة المؤمنون', ayahCount: 118 },
  { id: 24, name: 'An-Nur', arabic: 'سورة النور', ayahCount: 64 },
  { id: 25, name: 'Al-Furqan', arabic: 'سورة الفرقان', ayahCount: 77 },
  { id: 26, name: "Ash-Shu'ara", arabic: 'سورة الشعراء', ayahCount: 227 },
  { id: 27, name: 'An-Naml', arabic: 'سورة النمل', ayahCount: 93 },
  { id: 28, name: 'Al-Qasas', arabic: 'سورة القصص', ayahCount: 88 },
  { id: 29, name: 'Al-Ankabut', arabic: 'سورة العنكبوت', ayahCount: 69 },
  { id: 30, name: 'Ar-Rum', arabic: 'سورة الروم', ayahCount: 60 },
  { id: 31, name: 'Luqman', arabic: 'سورة لقمان', ayahCount: 34 },
  { id: 32, name: 'As-Sajdah', arabic: 'سورة السجدة', ayahCount: 30 },
  { id: 33, name: 'Al-Ahzab', arabic: 'سورة الأحزاب', ayahCount: 73 },
  { id: 34, name: 'Saba', arabic: 'سورة سبأ', ayahCount: 54 },
  { id: 35, name: 'Fatir', arabic: 'سورة فاطر', ayahCount: 45 },
  { id: 36, name: 'Ya-Sin', arabic: 'سورة يس', ayahCount: 83 },
  { id: 37, name: 'As-Saffat', arabic: 'سورة الصافات', ayahCount: 182 },
  { id: 38, name: 'Sad', arabic: 'سورة ص', ayahCount: 88 },
  { id: 39, name: 'Az-Zumar', arabic: 'سورة الزمر', ayahCount: 75 },
  { id: 40, name: 'Ghafir', arabic: 'سورة غافر', ayahCount: 85 },
  { id: 41, name: 'Fussilat', arabic: 'سورة فصلت', ayahCount: 54 },
  { id: 42, name: 'Ash-Shura', arabic: 'سورة الشورى', ayahCount: 53 },
  { id: 43, name: 'Az-Zukhruf', arabic: 'سورة الزخرف', ayahCount: 89 },
  { id: 44, name: 'Ad-Dukhan', arabic: 'سورة الدخان', ayahCount: 59 },
  { id: 45, name: 'Al-Jathiyah', arabic: 'سورة الجاثية', ayahCount: 37 },
  { id: 46, name: 'Al-Ahqaf', arabic: 'سورة الأحقاف', ayahCount: 35 },
  { id: 47, name: 'Muhammad', arabic: 'سورة محمد', ayahCount: 38 },
  { id: 48, name: 'Al-Fath', arabic: 'سورة الفتح', ayahCount: 29 },
  { id: 49, name: 'Al-Hujurat', arabic: 'سورة الحجرات', ayahCount: 18 },
  { id: 50, name: 'Qaf', arabic: 'سورة ق', ayahCount: 45 },
  { id: 51, name: 'Adh-Dhariyat', arabic: 'سورة الذاريات', ayahCount: 60 },
  { id: 52, name: 'At-Tur', arabic: 'سورة الطور', ayahCount: 49 },
  { id: 53, name: 'An-Najm', arabic: 'سورة النجم', ayahCount: 62 },
  { id: 54, name: 'Al-Qamar', arabic: 'سورة القمر', ayahCount: 55 },
  { id: 55, name: 'Ar-Rahman', arabic: 'سورة الرحمن', ayahCount: 78 },
  { id: 56, name: "Al-Waqi'ah", arabic: 'سورة الواقعة', ayahCount: 96 },
  { id: 57, name: 'Al-Hadid', arabic: 'سورة الحديد', ayahCount: 29 },
  { id: 58, name: 'Al-Mujadilah', arabic: 'سورة المجادلة', ayahCount: 22 },
  { id: 59, name: 'Al-Hashr', arabic: 'سورة الحشر', ayahCount: 24 },
  { id: 60, name: 'Al-Mumtahanah', arabic: 'سورة الممتحنة', ayahCount: 13 },
  { id: 61, name: 'As-Saff', arabic: 'سورة الصف', ayahCount: 14 },
  { id: 62, name: "Al-Jumu'ah", arabic: 'سورة الجمعة', ayahCount: 11 },
  { id: 63, name: 'Al-Munafiqun', arabic: 'سورة المنافقون', ayahCount: 11 },
  { id: 64, name: 'At-Taghabun', arabic: 'سورة التغابن', ayahCount: 18 },
  { id: 65, name: 'At-Talaq', arabic: 'سورة الطلاق', ayahCount: 12 },
  { id: 66, name: 'At-Tahrim', arabic: 'سورة التحريم', ayahCount: 12 },
  { id: 67, name: 'Al-Mulk', arabic: 'سورة الملك', ayahCount: 30 },
  { id: 68, name: 'Al-Qalam', arabic: 'سورة القلم', ayahCount: 52 },
  { id: 69, name: 'Al-Haqqah', arabic: 'سورة الحاقة', ayahCount: 52 },
  { id: 70, name: "Al-Ma'arij", arabic: 'سورة المعارج', ayahCount: 44 },
  { id: 71, name: 'Nuh', arabic: 'سورة نوح', ayahCount: 28 },
  { id: 72, name: 'Al-Jinn', arabic: 'سورة الجن', ayahCount: 28 },
  { id: 73, name: 'Al-Muzzammil', arabic: 'سورة المزمل', ayahCount: 20 },
  { id: 74, name: 'Al-Muddathir', arabic: 'سورة المدثر', ayahCount: 56 },
  { id: 75, name: 'Al-Qiyamah', arabic: 'سورة القيامة', ayahCount: 40 },
  { id: 76, name: 'Al-Insan', arabic: 'سورة الإنسان', ayahCount: 31 },
  { id: 77, name: 'Al-Mursalat', arabic: 'سورة المرسلات', ayahCount: 50 },
  { id: 78, name: 'An-Naba', arabic: 'سورة النبأ', ayahCount: 40 },
  { id: 79, name: "An-Nazi'at", arabic: 'سورة النازعات', ayahCount: 46 },
  { id: 80, name: 'Abasa', arabic: 'سورة عبس', ayahCount: 42 },
  { id: 81, name: 'At-Takwir', arabic: 'سورة التكوير', ayahCount: 29 },
  { id: 82, name: 'Al-Infitar', arabic: 'سورة الإنفطار', ayahCount: 19 },
  { id: 83, name: 'Al-Mutaffifin', arabic: 'سورة المطففين', ayahCount: 36 },
  { id: 84, name: 'Al-Inshiqaq', arabic: 'سورة الإنشقاق', ayahCount: 25 },
  { id: 85, name: 'Al-Buruj', arabic: 'سورة البروج', ayahCount: 22 },
  { id: 86, name: 'At-Tariq', arabic: 'سورة الطارق', ayahCount: 17 },
  { id: 87, name: "Al-A'la", arabic: 'سورة الأعلى', ayahCount: 19 },
  { id: 88, name: 'Al-Ghashiyah', arabic: 'سورة الغاشية', ayahCount: 26 },
  { id: 89, name: 'Al-Fajr', arabic: 'سورة الفجر', ayahCount: 30 },
  { id: 90, name: 'Al-Balad', arabic: 'سورة البلد', ayahCount: 20 },
  { id: 91, name: 'Ash-Shams', arabic: 'سورة الشمس', ayahCount: 15 },
  { id: 92, name: 'Al-Layl', arabic: 'سورة الليل', ayahCount: 21 },
  { id: 93, name: 'Ad-Duha', arabic: 'سورة الضحى', ayahCount: 11 },
  { id: 94, name: 'Ash-Sharh', arabic: 'سورة الشرح', ayahCount: 8 },
  { id: 95, name: 'At-Tin', arabic: 'سورة التين', ayahCount: 8 },
  { id: 96, name: 'Al-Alaq', arabic: 'سورة العلق', ayahCount: 19 },
  { id: 97, name: 'Al-Qadr', arabic: 'سورة القدر', ayahCount: 5 },
  { id: 98, name: 'Al-Bayyinah', arabic: 'سورة البينة', ayahCount: 8 },
  { id: 99, name: 'Az-Zalzalah', arabic: 'سورة الزلزلة', ayahCount: 8 },
  { id: 100, name: 'Al-Adiyat', arabic: 'سورة العاديات', ayahCount: 11 },
  { id: 101, name: "Al-Qari'ah", arabic: 'سورة القارعة', ayahCount: 11 },
  { id: 102, name: 'At-Takathur', arabic: 'سورة التكاثر', ayahCount: 8 },
  { id: 103, name: 'Al-Asr', arabic: 'سورة العصر', ayahCount: 3 },
  { id: 104, name: 'Al-Humazah', arabic: 'سورة الهمزة', ayahCount: 9 },
  { id: 105, name: 'Al-Fil', arabic: 'سورة الفيل', ayahCount: 5 },
  { id: 106, name: 'Quraysh', arabic: 'سورة قريش', ayahCount: 4 },
  { id: 107, name: "Al-Ma'un", arabic: 'سورة الماعون', ayahCount: 7 },
  { id: 108, name: 'Al-Kawthar', arabic: 'سورة الكوثر', ayahCount: 3 },
  { id: 109, name: 'Al-Kafirun', arabic: 'سورة الكافرون', ayahCount: 6 },
  { id: 110, name: 'An-Nasr', arabic: 'سورة النصر', ayahCount: 3 },
  { id: 111, name: 'Al-Masad', arabic: 'سورة المسد', ayahCount: 5 },
  { id: 112, name: 'Al-Ikhlas', arabic: 'سورة الإخلاص', ayahCount: 4 },
  { id: 113, name: 'Al-Falaq', arabic: 'سورة الفلق', ayahCount: 5 },
  { id: 114, name: 'An-Nas', arabic: 'سورة الناس', ayahCount: 6 },
];

export const JUZ_NAMES: Record<number, { name: string; arabic: string }> = {
  1: { name: 'الفاتحة بِسْمِ اللَّهِ', arabic: 'الفاتحة' },
  2: { name: 'سَيَقُولُ السُّفَهَاءُ', arabic: 'سَيَقُولُ' },
  3: { name: 'تِلْكَ الرُّسُلُ', arabic: 'تِلْكَ' },
  4: { name: 'لَنْ تَنَالُوا الْبِرَّ', arabic: 'لَنْ تَنَالُوا' },
  5: { name: 'وَالْمُحْصَنَاتُ', arabic: 'وَالْمُحْصَنَاتُ' },
  6: { name: 'لَا يُحِبُّ اللَّهُ', arabic: 'لَا يُحِبُّ' },
  7: { name: 'لَتَجِدَنَّ', arabic: 'لَتَجِدَنَّ' },
  8: { name: 'وَلَوْ أَنَّنَا', arabic: 'وَلَوْ أَنَّنَا' },
  9: { name: 'قَالَ الْمَلَأُ', arabic: 'قَالَ الْمَلَأُ' },
  10: { name: 'وَاعْلَمُوا', arabic: 'وَاعْلَمُوا' },
  11: { name: 'يَعْتَذِرُونَ', arabic: 'يَعْتَذِرُونَ' },
  12: { name: 'وَمَا مِنْ دَابَّةٍ', arabic: 'وَمَا مِنْ' },
  13: { name: 'وَمَا أُبَرِّئُ', arabic: 'وَمَا أُبَرِّئُ' },
  14: { name: 'الرّ (الحجر)', arabic: 'الرّ' },
  15: { name: 'سُبْحَانَ الَّذِي', arabic: 'سُبْحَانَ' },
  16: { name: 'قَالَ أَلَمْ أَقُل لَّكَ', arabic: 'قَالَ أَلَمْ' },
  17: { name: 'اقْتَرَبَ لِلنَّاسِ', arabic: 'اقْتَرَبَ' },
  18: { name: 'قَدْ أَفْلَحَ', arabic: 'قَدْ أَفْلَحَ' },
  19: { name: 'وَقَالَ الَّذِينَ', arabic: 'وَقَالَ' },
  20: { name: 'فَمَا كَانَ جَوَابَ قَوْمِهِ', arabic: 'فَمَا كَانَ' },
  21: { name: 'وَلا تَجَادِلُوا', arabic: 'وَلا تَجَادِلُوا' },
  22: { name: 'وَمَنْ يَقْنُتْ', arabic: 'وَمَنْ يَقْنُتْ' },
  23: { name: 'وَمَا أَنْزَلْنَا', arabic: 'وَمَا أَنْزَلْنَا' },
  24: { name: 'فَمَنْ أَظْلَمُ', arabic: 'فَمَنْ أَظْلَمُ' },
  25: { name: 'إِلَيْهِ يُرَدُّ', arabic: 'إِلَيْهِ يُرَدُّ' },
  26: { name: 'أحقاف', arabic: 'أحقاف' },
  27: { name: 'قَالَ فَمَا خَطْبُكُمْ', arabic: 'قَالَ فَمَا' },
  28: { name: 'قَدْ سَمِعَ اللَّهُ', arabic: 'قَدْ سَمِعَ' },
  29: { name: 'تَبَارَكَ الَّذِي', arabic: 'تَبَارَكَ' },
  30: { name: 'عَمَّ يَتَسَاءَلُونَ', arabic: 'عَمَّ' },
};

// ============================================================
// TYPES
// ============================================================
export type ExamFormType = 'memorization' | 'reading';
export type ExamStatus = 'Pass' | 'Fail';
export type ExamScope = 'surah' | 'juz';
export type DateType = 'gregorian' | 'hijri' | 'both';

export interface ExamColumn {
  id: string;
  key: string;
  label: string;
  isVisible: boolean;
  isEditable: boolean;
  isDeletable: boolean;
  order: number;
  type: 'number' | 'text';
  isAdditive?: boolean;
}

export interface ReadingWritingHeader {
  id: string;
  label: string;
  isEditable: boolean;
  hasCount: boolean;
  isFixed: boolean;
  maxScore?: number;
}

export interface ReadingWritingWeights {
  readingScore: number;
  writingScore: number;
  hijaa: number;
  ayahs: number;
}

export interface MarksPer {
  fathi: number;
  lahni: number;
  ruju: number;
  tajwid: number;
  [key: string]: number;
}

export interface ExamQuestion {
  questionNumber: number;
  page: string;
  fathi: number;
  lahni: number;
  ruju?: number;
  tajwid: number;
  performance?: number;
  customColumns?: Record<string, number>;
}

export interface ExamNotes {
  positive: string;
  negative: string;
}

export interface ExamSettings {
  passingMark: number;
  passingMarkReadingWriting: number;
  defaultQuestionCount: number;
  examTypes: string[];
  columns: ExamColumn[];
  notesTemplate: ExamNotes;
  readingWritingHeaders: ReadingWritingHeader[];
  readingWritingWeights: ReadingWritingWeights;
}

export interface Exam {
  _id: string;
  studentId?: string;
  studentName: string;
  halaqah: string;
  examType: string;
  examFormType?: ExamFormType;
  formType?: ExamFormType;
  examScope?: ExamScope;
  fromSurah?: number;
  toSurah?: number;
  fromJuz?: number;
  toJuz?: number;
  examiners?: string[];
  examiner?: string;
  date?: any;
  dateGregorian?: string;
  dateHijri?: string;
  dateType?: DateType;
  questions?: ExamQuestion[];
  notes?: ExamNotes;
  marksPer?: MarksPer;
  settings?: ExamSettings;
  readingWritingHeaders?: ReadingWritingHeader[];
  readingWritingScores?: Record<string, number | string>;
  readingWritingWeights?: ReadingWritingWeights;
  totalMarks?: number;
  obtainedMarks?: number;
  percentage?: number;
  passingMark?: number;
  status?: ExamStatus;
  isPublished?: boolean;
  publishedAt?: string | null;
  branchId?: string;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Halaqah {
  _id: string;
  name: string;
}

export interface StudentLite {
  _id: string;
  name: string;
  halaqah?: string;
}

export interface ExamFormState {
  studentId: string;
  studentName: string;
  halaqah: string;
  examType: string;
  examScope: ExamScope;
  fromSurah: number | '';
  toSurah: number | '';
  fromJuz: number | '';
  toJuz: number | '';
  examiners: string[];
  dateGregorian: string;
  dateHijri: string;
  questions: ExamQuestion[];
  notes: ExamNotes;
  readingWritingScores: Record<string, number | string>;
  totalMarks: number;
}

// ============================================================
// CONSTANTS
// ============================================================
export const DEFAULT_EXAM_TYPES = ['Monthly', 'Three Monthly', 'Final'];

export const DEFAULT_COLUMNS: ExamColumn[] = [
  { id: 'question', key: 'question', label: 'Question', isVisible: true, isEditable: false, isDeletable: false, order: 0, type: 'text' },
  { id: 'page', key: 'page', label: 'Page', isVisible: true, isEditable: true, isDeletable: false, order: 1, type: 'text' },
  { id: 'tajwid', key: 'tajwid', label: 'Tajwid', isVisible: true, isEditable: true, isDeletable: true, order: 2, type: 'number', isAdditive: false },
  { id: 'ruju', key: 'ruju', label: 'Ruju', isVisible: true, isEditable: true, isDeletable: true, order: 3, type: 'number', isAdditive: false },
  { id: 'lahni', key: 'lahni', label: 'Lahni', isVisible: true, isEditable: true, isDeletable: true, order: 4, type: 'number', isAdditive: false },
  { id: 'fathi', key: 'fathi', label: 'Fathi', isVisible: true, isEditable: true, isDeletable: true, order: 5, type: 'number', isAdditive: false },
  { id: 'deduction', key: 'deduction', label: 'Deduction', isVisible: true, isEditable: false, isDeletable: false, order: 6, type: 'number' },
];

export const DEFAULT_READING_HEADERS: ReadingWritingHeader[] = [
  { id: 'huroof', label: 'الحروف الهجائية', isEditable: true, hasCount: false, isFixed: false, maxScore: 3 },
  { id: 'harakat', label: 'الحركات', isEditable: true, hasCount: false, isFixed: false, maxScore: 3 },
  { id: 'sukoon', label: 'السكون', isEditable: true, hasCount: false, isFixed: false, maxScore: 3 },
  { id: 'tanween', label: 'التنوين', isEditable: true, hasCount: false, isFixed: false, maxScore: 3 },
  { id: 'mudood', label: 'المدود', isEditable: true, hasCount: false, isFixed: false, maxScore: 3 },
  { id: 'leen', label: 'اللين', isEditable: true, hasCount: false, isFixed: false, maxScore: 3 },
  { id: 'shaddah', label: 'الشدة', isEditable: true, hasCount: false, isFixed: false, maxScore: 6 },
  { id: 'lamat', label: 'اللامات', isEditable: true, hasCount: false, isFixed: false, maxScore: 2 },
  { id: 'hamzat', label: 'الهمزات', isEditable: true, hasCount: false, isFixed: false, maxScore: 2 },
  { id: 'taat', label: 'التاءات', isEditable: true, hasCount: false, isFixed: false, maxScore: 2 },
  { id: 'sakinain', label: 'التقاء الساكنين', isEditable: true, hasCount: false, isFixed: false, maxScore: 3 },
  { id: 'readingScore', label: 'درجة القراءة', isEditable: true, hasCount: false, isFixed: false, maxScore: 13.5 },
  { id: 'writingScore', label: 'درجة الكتابة', isEditable: true, hasCount: false, isFixed: false, maxScore: 13.5 },
  { id: 'ayahs', label: 'الآيات', isEditable: true, hasCount: false, isFixed: false, maxScore: 3 },
  { id: 'hijaa', label: 'الهجاء', isEditable: true, hasCount: false, isFixed: false, maxScore: 3 },
  { id: 'total', label: 'المجموع', isEditable: false, hasCount: false, isFixed: true, maxScore: 27 },
  { id: 'estimation', label: 'التقدير', isEditable: false, hasCount: false, isFixed: true },
];

export const DEFAULT_READING_WEIGHTS: ReadingWritingWeights = {
  readingScore: 40,
  writingScore: 30,
  hijaa: 15,
  ayahs: 15,
};

export const DEFAULT_MARKS_PER: MarksPer = {
  fathi: 1.2,
  lahni: 0.5,
  ruju: 1.0,
  tajwid: 0.8,
};

// ============================================================
// HELPERS
// ============================================================
export const round2 = (v: any): number => {
  if (v === undefined || v === null || isNaN(Number(v))) return 0;
  return Math.round(Number(v) * 100) / 100;
};

export const getSurahName = (id?: number) => {
  if (!id) return '';
  return SURAH_LIST.find((s) => s.id === Number(id))?.name || `Surah ${id}`;
};

export const getSurahArabic = (id?: number) => {
  if (!id) return '';
  return SURAH_LIST.find((s) => s.id === Number(id))?.arabic || '';
};

export const getJuzName = (id?: number) => {
  if (!id) return '';
  return JUZ_NAMES[Number(id)]?.name || `Juz ${id}`;
};

export const getJuzArabic = (id?: number) => {
  if (!id) return '';
  return JUZ_NAMES[Number(id)]?.arabic || '';
};

export const getExamFormType = (exam: Exam): ExamFormType => {
  return (exam.examFormType || exam.formType || 'memorization') as ExamFormType;
};

export const computeQuestionContribution = (
  q: ExamQuestion,
  columns: ExamColumn[],
  marksPer: MarksPer
): number => {
  let total = 0;
  columns
    .filter(
      (c) =>
        c.isVisible !== false &&
        c.key !== 'question' &&
        c.key !== 'page' &&
        c.key !== 'deduction'
    )
    .forEach((col) => {
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
  return total;
};

export const computeTotalDeduction = (
  questions: ExamQuestion[],
  columns: ExamColumn[],
  marksPer: MarksPer
): number => {
  return questions.reduce(
    (sum, q) => sum + computeQuestionContribution(q, columns, marksPer),
    0
  );
};

export const getVisibleColumns = (settings?: ExamSettings | null): ExamColumn[] => {
  const cols = settings?.columns && settings.columns.length > 0
    ? settings.columns
    : DEFAULT_COLUMNS;
  return cols
    .filter(
      (col) =>
        col.isVisible !== false &&
        col.key !== 'question' &&
        col.key !== 'page' &&
        col.key !== 'deduction'
    )
    .sort((a, b) => (a.order || 0) - (b.order || 0));
};

export const computeReadingTotals = (
  headers: ReadingWritingHeader[],
  scores: Record<string, number | string>,
  weights: ReadingWritingWeights
) => {
  const skillHeaders = headers.filter(
    (h) =>
      h.id !== 'total' &&
      h.id !== 'estimation' &&
      h.id !== 'readingScore' &&
      h.id !== 'writingScore' &&
      h.id !== 'hijaa' &&
      h.id !== 'ayahs'
  );

  let readingTotal = 0;
  let writingTotal = 0;
  let hijaaTotal = 0;
  let ayahsTotal = 0;

  skillHeaders.forEach((h) => {
    readingTotal += parseFloat(String(scores[`${h.id}_reading`] ?? 0)) || 0;
    writingTotal += parseFloat(String(scores[`${h.id}_writing`] ?? 0)) || 0;
    hijaaTotal += parseFloat(String(scores[`${h.id}_hijaa`] ?? 0)) || 0;
    ayahsTotal += parseFloat(String(scores[`${h.id}_ayahs`] ?? 0)) || 0;
  });

  const grandTotal = readingTotal + writingTotal + hijaaTotal + ayahsTotal;
  const maxTotal =
    (weights.readingScore || 0) +
    (weights.writingScore || 0) +
    (weights.hijaa || 0) +
    (weights.ayahs || 0);
  const percentage = maxTotal > 0 ? (grandTotal / maxTotal) * 100 : 0;

  return {
    readingTotal,
    writingTotal,
    hijaaTotal,
    ayahsTotal,
    grandTotal,
    maxTotal,
    percentage,
  };
};

// ============================================================
// API
// ============================================================
export const api = {
  getSettings: async (): Promise<ExamSettings | null> => {
    try {
      const res: any = await apiClient.get('/exam-settings');
      if (!res) return null;
      const settings: ExamSettings = {
        passingMark: res.passingMark ?? 60,
        passingMarkReadingWriting: res.passingMarkReadingWriting ?? 60,
        defaultQuestionCount: res.defaultQuestionCount ?? 3,
        examTypes: res.examTypes || DEFAULT_EXAM_TYPES,
        columns:
          Array.isArray(res.columns) && res.columns.length > 0
            ? res.columns
            : DEFAULT_COLUMNS,
        notesTemplate: res.notesTemplate || { positive: '', negative: '' },
        readingWritingHeaders:
          Array.isArray(res.readingWritingHeaders) &&
          res.readingWritingHeaders.length > 0
            ? res.readingWritingHeaders
            : DEFAULT_READING_HEADERS,
        readingWritingWeights: res.readingWritingWeights || DEFAULT_READING_WEIGHTS,
      };
      return settings;
    } catch (err) {
      console.warn('getSettings failed, using defaults:', err);
      return null;
    }
  },

  saveSettings: async (settings: Partial<ExamSettings>): Promise<any> => {
    return await apiClient.post('/exam-settings', { settings });
  },

  getHalaqat: async (): Promise<Halaqah[]> => {
    const res: any = await apiClient.get('/halaqaat');
    const list = Array.isArray(res) ? res : res?.halaqaat || res?.halaqat || res?.data || [];
    return list;
  },

  getStudentsByHalaqah: async (halaqahName: string): Promise<StudentLite[]> => {
    const res: any = await apiClient.get(
      `/students/halaqah/${encodeURIComponent(halaqahName)}`
    );
    const list = Array.isArray(res) ? res : res?.students || res?.data || [];
    return list;
  },

  getStudents: async (halaqahId?: string): Promise<StudentLite[]> => {
    const params: any = { limit: 1000 };
    if (halaqahId) params.halaqah = halaqahId;
    const res: any = await apiClient.get('/students', params);
    const list = Array.isArray(res) ? res : res?.students || res?.data || [];
    return list;
  },

  list: async (filters?: {
    examType?: string;
    halaqah?: string;
    gender?: string;
    date?: string;
    searchQuery?: string;
  }): Promise<Exam[]> => {
    const params: any = {};
    if (filters?.examType) params.examType = filters.examType;
    if (filters?.halaqah) params.halaqah = filters.halaqah;
    if (filters?.gender) params.gender = filters.gender;
    if (filters?.date) params.date = filters.date;
    if (filters?.searchQuery) params.searchQuery = filters.searchQuery;
    const res: any = await apiClient.get('/exams', params);
    return Array.isArray(res) ? res : res?.exams || res?.data || [];
  },

  getExamTypes: async (): Promise<string[]> => {
    try {
      const res: any = await apiClient.get('/exam-types');
      return Array.isArray(res) ? res : res?.examTypes || [];
    } catch {
      return [];
    }
  },

  create: async (exam: any): Promise<Exam> => {
    return await apiClient.post('/exams', exam);
  },

  update: async (id: string, exam: any): Promise<Exam> => {
    return await apiClient.put(`/exams/${id}`, exam);
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/exams/${id}`);
  },

  publish: async (id: string): Promise<any> => {
    return await apiClient.post(`/exams/publish/${id}`);
  },

  unpublish: async (id: string): Promise<any> => {
    return await apiClient.post(`/exams/unpublish/${id}`);
  },

  bulkPublish: async (examIds: string[]): Promise<any> => {
    return await apiClient.post('/exams/bulk-publish', { examIds });
  },

  bulkUnpublish: async (examIds: string[]): Promise<any> => {
    return await apiClient.post('/exams/bulk-unpublish', { examIds });
  },
};