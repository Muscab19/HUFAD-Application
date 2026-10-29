// src/screens/admin/reports/_shared.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { api as apiClient } from '../../../api/client';

// ============================================================
// BRAND COLORS
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
  red: '#DC2626',
  redLight: '#FEE9E9',
  amber: '#D97706',
  amberLight: '#FEF3C7',
  teal: '#0D9488',
  tealLight: '#CCFBF1',
  pink: '#DB2777',
  pinkLight: '#FCE7F3',
  indigo: '#4F46E5',
  indigoLight: '#EEF2FF',
  white: '#FFFFFF',
  slate: '#18392D',
  slateMuted: '#718079',
  border: '#E4EBE7',
  background: '#F7FAF8',
  gray: '#8A9891',
};

// ============================================================
// ENDPOINTS
// ============================================================
export const EP = {
  students: '/students',
  studentReport: (id: string) => `/reports/student/${id}`,
  monthlyPerformance: (id: string) =>
    `/reports/student/${id}/monthly-performance`,
};

// ============================================================
// TYPES
// ============================================================
export interface HalaqahRef {
  _id?: string;
  name?: string;
}

export interface Student {
  _id: string;
  name: string;
  regNo?: string;
  halaqah?: HalaqahRef | string;
  class?: string;
  grade?: string;
  gender?: 'Male' | 'Female';
  parent?: { name?: string; phone?: string };
  profilePicture?: string;
  enrollmentDate?: string;
}

export interface AttendanceDaily {
  date: string;
  status: string;
  comments?: string;
}

export interface AttendanceSession {
  slotNumber: number;
  name?: string;
  startTime?: string;
  endTime?: string;
  summary?: {
    present?: number;
    absent?: number;
    late?: number;
    excused?: number;
    total?: number;
  };
  daily: AttendanceDaily[];
}

export interface AttendanceData {
  summary?: {
    total?: number;
    present?: number;
    absent?: number;
    late?: number;
    excused?: number;
  };
  sessions?: AttendanceSession[];
}

export interface MemorizationRecord {
  _id?: string;
  date: string;
  type: string;
  score: number;
  totalMarks?: number;
  attempt?: number;
  comment?: string;
  rangeType?: 'surah' | 'juz';
  fromSurah?: number;
  toSurah?: number;
  fromAyah?: number;
  toAyah?: number;
  fromJuz?: number;
  toJuz?: number;
  fromQuarter?: number;
  toQuarter?: number;
  topic?: string;
  bookName?: string;
  bookType?: 'pages' | 'lines' | 'verses';
  fromBookPage?: number;
  toBookPage?: number;
}

export interface MemorizationData {
  summary?: { total?: number; avgScore?: number; bestScore?: number };
  allRecords?: MemorizationRecord[];
  byType?: Record<string, MemorizationRecord[]>;
}

export interface ExamQuestion {
  questionNumber?: number;
  page?: number | string;
  fathi?: number;
  lahni?: number;
  tajwid?: number;
  ruju?: number;
  performance?: number;
  customColumns?: Record<string, number>;
}

export interface ExamColumn {
  id: string;
  key: string;
  label: string;
  isVisible?: boolean;
  isAdditive?: boolean;
  order?: number;
}

export interface Exam {
  _id?: string;
  date: string;
  type?: string;
  formType?: 'memorization' | 'reading';
  examFormType?: 'memorization' | 'reading';
  subject?: string;
  score?: number;
  total?: number;
  totalMarks?: number;
  obtainedMarks?: number;
  percentage?: number;
  status?: 'Pass' | 'Fail';
  passingMark?: number;
  isPublished?: boolean;
  halaqah?: string;
  studentName?: string;
  fromSurah?: number;
  toSurah?: number;
  fromJuz?: number;
  toJuz?: number;
  examScope?: 'surah' | 'juz';
  questions?: ExamQuestion[];
  marksPer?: {
    fathi: number;
    lahni: number;
    tajwid: number;
    ruju: number;
    [key: string]: number;
  };
  settings?: { columns?: ExamColumn[] };
  examiners?: string[];
  examiner?: string;
  notes?: { positive?: string; negative?: string } | string;
}

export interface BehaviorRecord {
  _id?: string;
  date: string;
  type: 'good' | 'bad';
  description: string;
  category?: string;
  severity?: string;
  recordedBy?: string;
  points: number;
}

export interface FinanceBreakdownItem {
  _id?: string;
  date: string;
  description: string;
  amount: number;
  dueDate?: string;
  status?: string;
}

export interface FinancePayment {
  _id?: string;
  date: string;
  amount: number;
  method?: string;
  reference?: string;
  notes?: string;
}

export interface FinanceData {
  summary?: {
    totalDue?: number;
    totalPaid?: number;
    balance?: number;
    status?: string;
  };
  breakdown?: FinanceBreakdownItem[];
  payments?: FinancePayment[];
}

export interface ReportData {
  student?: Student;
  attendance?: AttendanceData;
  memorization?: MemorizationData;
  exams?: Exam[];
  behavior?: BehaviorRecord[];
  finance?: FinanceData;
}

export interface MonthlyPerf {
  month: string;
  combined?: number;
  attendance?: number;
  memorization?: number;
  memorizationScore?: number;
  behavior?: number;
  behaviorScore?: number;
  totalDays?: number;
}

export interface SchoolInfo {
  nameEn: string;
  nameAr: string;
  logo: string | null;
  phone: string;
  email: string;
  address: string;
  reportTitle: string;
  footerNote: string;
}

export type PrintSection =
  | 'all'
  | 'overview'
  | 'attendance'
  | 'memorization'
  | 'exams'
  | 'behavior'
  | 'finance';

// ============================================================
// REPORT PERIOD
// ============================================================
export type ReportPeriodMode = 'month' | 'range';

export interface ReportPeriod {
  mode: ReportPeriodMode;
  /** When mode = 'month' */
  month?: string; // YYYY-MM
  /** When mode = 'range' */
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

// ============================================================
// CONSTANTS
// ============================================================
export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const ACHIEVEMENT_TYPES: {
  value: string;
  labelKey: string;
  color: string;
  bg: string;
}[] = [
  {
    value: 'memorization',
    labelKey: 'memorization',
    color: COLORS.blue,
    bg: COLORS.blueLight,
  },
  {
    value: 'minor_review',
    labelKey: 'minorReview',
    color: COLORS.primary,
    bg: COLORS.primaryLight,
  },
  {
    value: 'major_review',
    labelKey: 'majorReview',
    color: COLORS.purple,
    bg: COLORS.purpleLight,
  },
  {
    value: 'ijazah',
    labelKey: 'ijazah',
    color: COLORS.gold,
    bg: COLORS.goldLight,
  },
  {
    value: 'subac',
    labelKey: 'subac',
    color: COLORS.teal,
    bg: COLORS.tealLight,
  },
  {
    value: 'book_review',
    labelKey: 'bookReview',
    color: COLORS.pink,
    bg: COLORS.pinkLight,
  },
  {
    value: 'tashiih',
    labelKey: 'tashiih',
    color: COLORS.amber,
    bg: COLORS.amberLight,
  },
];

export const TAB_KEYS: {
  key: string;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'overview', labelKey: 'overview', icon: 'stats-chart' },
  { key: 'attendance', labelKey: 'attendance', icon: 'calendar' },
  { key: 'memorization', labelKey: 'memorization', icon: 'book' },
  { key: 'exams', labelKey: 'exams', icon: 'trophy' },
  { key: 'behavior', labelKey: 'behavior', icon: 'heart' },
  { key: 'finance', labelKey: 'finance', icon: 'cash' },
];

export const STATUS_KEY: Record<string, string> = {
  Present: 'present',
  Absent: 'absent',
  Late: 'late',
  Excused: 'excused',
  Pass: 'pass',
  Fail: 'fail',
  Paid: 'paid',
  Partial: 'partial',
  Unpaid: 'unpaid',
  Draft: 'draft',
  Published: 'published',
};

// ============================================================
// SURAH / JUZ NAMES (used in mem-range formatting)
// ============================================================
export const SURAH_LIST = [
  { id: 1, name: 'Al-Fatihah', arabic: 'سورة الفاتحة' },
  { id: 2, name: 'Al-Baqarah', arabic: 'سورة البقرة' },
  { id: 3, name: 'Aal-Imran', arabic: 'سورة آل عمران' },
  { id: 4, name: 'An-Nisa', arabic: 'سورة النساء' },
  { id: 5, name: "Al-Ma'idah", arabic: 'سورة المائدة' },
  { id: 6, name: "Al-An'am", arabic: 'سورة الأنعام' },
  { id: 7, name: "Al-A'raf", arabic: 'سورة الأعراف' },
  { id: 8, name: 'Al-Anfal', arabic: 'سورة الأنفال' },
  { id: 9, name: 'At-Tawbah', arabic: 'سورة التوبة' },
  { id: 10, name: 'Yunus', arabic: 'سورة يونس' },
  { id: 11, name: 'Hud', arabic: 'سورة هود' },
  { id: 12, name: 'Yusuf', arabic: 'سورة يوسف' },
  { id: 13, name: "Ar-Ra'd", arabic: 'سورة الرعد' },
  { id: 14, name: 'Ibrahim', arabic: 'سورة إبراهيم' },
  { id: 15, name: 'Al-Hijr', arabic: 'سورة الحجر' },
  { id: 16, name: 'An-Nahl', arabic: 'سورة النحل' },
  { id: 17, name: 'Al-Isra', arabic: 'سورة الإسراء' },
  { id: 18, name: 'Al-Kahf', arabic: 'سورة الكهف' },
  { id: 19, name: 'Maryam', arabic: 'سورة مريم' },
  { id: 20, name: 'Taha', arabic: 'سورة طه' },
  { id: 21, name: 'Al-Anbiya', arabic: 'سورة الأنبياء' },
  { id: 22, name: 'Al-Hajj', arabic: 'سورة الحج' },
  { id: 23, name: "Al-Mu'minun", arabic: 'سورة المؤمنون' },
  { id: 24, name: 'An-Nur', arabic: 'سورة النور' },
  { id: 25, name: 'Al-Furqan', arabic: 'سورة الفرقان' },
  { id: 26, name: "Ash-Shu'ara", arabic: 'سورة الشعراء' },
  { id: 27, name: 'An-Naml', arabic: 'سورة النمل' },
  { id: 28, name: 'Al-Qasas', arabic: 'سورة القصص' },
  { id: 29, name: 'Al-Ankabut', arabic: 'سورة العنكبوت' },
  { id: 30, name: 'Ar-Rum', arabic: 'سورة الروم' },
  { id: 31, name: 'Luqman', arabic: 'سورة لقمان' },
  { id: 32, name: 'As-Sajdah', arabic: 'سورة السجدة' },
  { id: 33, name: 'Al-Ahzab', arabic: 'سورة الأحزاب' },
  { id: 34, name: 'Saba', arabic: 'سورة سبأ' },
  { id: 35, name: 'Fatir', arabic: 'سورة فاطر' },
  { id: 36, name: 'Ya-Sin', arabic: 'سورة يس' },
  { id: 37, name: 'As-Saffat', arabic: 'سورة الصافات' },
  { id: 38, name: 'Sad', arabic: 'سورة ص' },
  { id: 39, name: 'Az-Zumar', arabic: 'سورة الزمر' },
  { id: 40, name: 'Ghafir', arabic: 'سورة غافر' },
  { id: 41, name: 'Fussilat', arabic: 'سورة فصلت' },
  { id: 42, name: 'Ash-Shura', arabic: 'سورة الشورى' },
  { id: 43, name: 'Az-Zukhruf', arabic: 'سورة الزخرف' },
  { id: 44, name: 'Ad-Dukhan', arabic: 'سورة الدخان' },
  { id: 45, name: 'Al-Jathiyah', arabic: 'سورة الجاثية' },
  { id: 46, name: 'Al-Ahqaf', arabic: 'سورة الأحقاف' },
  { id: 47, name: 'Muhammad', arabic: 'سورة محمد' },
  { id: 48, name: 'Al-Fath', arabic: 'سورة الفتح' },
  { id: 49, name: 'Al-Hujurat', arabic: 'سورة الحجرات' },
  { id: 50, name: 'Qaf', arabic: 'سورة ق' },
  { id: 51, name: 'Adh-Dhariyat', arabic: 'سورة الذاريات' },
  { id: 52, name: 'At-Tur', arabic: 'سورة الطور' },
  { id: 53, name: 'An-Najm', arabic: 'سورة النجم' },
  { id: 54, name: 'Al-Qamar', arabic: 'سورة القمر' },
  { id: 55, name: 'Ar-Rahman', arabic: 'سورة الرحمن' },
  { id: 56, name: "Al-Waqi'ah", arabic: 'سورة الواقعة' },
  { id: 57, name: 'Al-Hadid', arabic: 'سورة الحديد' },
  { id: 58, name: 'Al-Mujadilah', arabic: 'سورة المجادلة' },
  { id: 59, name: 'Al-Hashr', arabic: 'سورة الحشر' },
  { id: 60, name: 'Al-Mumtahanah', arabic: 'سورة الممتحنة' },
  { id: 61, name: 'As-Saff', arabic: 'سورة الصف' },
  { id: 62, name: "Al-Jumu'ah", arabic: 'سورة الجمعة' },
  { id: 63, name: 'Al-Munafiqun', arabic: 'سورة المنافقون' },
  { id: 64, name: 'At-Taghabun', arabic: 'سورة التغابن' },
  { id: 65, name: 'At-Talaq', arabic: 'سورة الطلاق' },
  { id: 66, name: 'At-Tahrim', arabic: 'سورة التحريم' },
  { id: 67, name: 'Al-Mulk', arabic: 'سورة الملك' },
  { id: 68, name: 'Al-Qalam', arabic: 'سورة القلم' },
  { id: 69, name: 'Al-Haqqah', arabic: 'سورة الحاقة' },
  { id: 70, name: "Al-Ma'arij", arabic: 'سورة المعارج' },
  { id: 71, name: 'Nuh', arabic: 'سورة نوح' },
  { id: 72, name: 'Al-Jinn', arabic: 'سورة الجن' },
  { id: 73, name: 'Al-Muzzammil', arabic: 'سورة المزمل' },
  { id: 74, name: 'Al-Muddathir', arabic: 'سورة المدثر' },
  { id: 75, name: 'Al-Qiyamah', arabic: 'سورة القيامة' },
  { id: 76, name: 'Al-Insan', arabic: 'سورة الإنسان' },
  { id: 77, name: 'Al-Mursalat', arabic: 'سورة المرسلات' },
  { id: 78, name: 'An-Naba', arabic: 'سورة النبأ' },
  { id: 79, name: "An-Nazi'at", arabic: 'سورة النازعات' },
  { id: 80, name: 'Abasa', arabic: 'سورة عبس' },
  { id: 81, name: 'At-Takwir', arabic: 'سورة التكوير' },
  { id: 82, name: 'Al-Infitar', arabic: 'سورة الإنفطار' },
  { id: 83, name: 'Al-Mutaffifin', arabic: 'سورة المطففين' },
  { id: 84, name: 'Al-Inshiqaq', arabic: 'سورة الإنشقاق' },
  { id: 85, name: 'Al-Buruj', arabic: 'سورة البروج' },
  { id: 86, name: 'At-Tariq', arabic: 'سورة الطارق' },
  { id: 87, name: "Al-A'la", arabic: 'سورة الأعلى' },
  { id: 88, name: 'Al-Ghashiyah', arabic: 'سورة الغاشية' },
  { id: 89, name: 'Al-Fajr', arabic: 'سورة الفجر' },
  { id: 90, name: 'Al-Balad', arabic: 'سورة البلد' },
  { id: 91, name: 'Ash-Shams', arabic: 'سورة الشمس' },
  { id: 92, name: 'Al-Layl', arabic: 'سورة الليل' },
  { id: 93, name: 'Ad-Duha', arabic: 'سورة الضحى' },
  { id: 94, name: 'Ash-Sharh', arabic: 'سورة الشرح' },
  { id: 95, name: 'At-Tin', arabic: 'سورة التين' },
  { id: 96, name: 'Al-Alaq', arabic: 'سورة العلق' },
  { id: 97, name: 'Al-Qadr', arabic: 'سورة القدر' },
  { id: 98, name: 'Al-Bayyinah', arabic: 'سورة البينة' },
  { id: 99, name: 'Az-Zalzalah', arabic: 'سورة الزلزلة' },
  { id: 100, name: 'Al-Adiyat', arabic: 'سورة العاديات' },
  { id: 101, name: "Al-Qari'ah", arabic: 'سورة القارعة' },
  { id: 102, name: 'At-Takathur', arabic: 'سورة التكاثر' },
  { id: 103, name: 'Al-Asr', arabic: 'سورة العصر' },
  { id: 104, name: 'Al-Humazah', arabic: 'سورة الهمزة' },
  { id: 105, name: 'Al-Fil', arabic: 'سورة الفيل' },
  { id: 106, name: 'Quraysh', arabic: 'سورة قريش' },
  { id: 107, name: "Al-Ma'un", arabic: 'سورة الماعون' },
  { id: 108, name: 'Al-Kawthar', arabic: 'سورة الكوثر' },
  { id: 109, name: 'Al-Kafirun', arabic: 'سورة الكافرون' },
  { id: 110, name: 'An-Nasr', arabic: 'سورة النصر' },
  { id: 111, name: 'Al-Masad', arabic: 'سورة المسد' },
  { id: 112, name: 'Al-Ikhlas', arabic: 'سورة الإخلاص' },
  { id: 113, name: 'Al-Falaq', arabic: 'سورة الفلق' },
  { id: 114, name: 'An-Nas', arabic: 'سورة الناس' },
];

export const JUZ_NAMES: Record<number, string> = {
  1: 'الفاتحة بِسْمِ اللَّهِ',
  2: 'سَيَقُولُ السُّفَهَاءُ',
  3: 'تِلْكَ الرُّسُلُ',
  4: 'لَنْ تَنَالُوا الْبِرَّ',
  5: 'وَالْمُحْصَنَاتُ',
  6: 'لَا يُحِبُّ اللَّهُ',
  7: 'لَتَجِدَنَّ',
  8: 'وَلَوْ أَنَّنَا',
  9: 'قَالَ الْمَلَأُ',
  10: 'وَاعْلَمُوا',
  11: 'يَعْتَذِرُونَ',
  12: 'وَمَا مِنْ دَابَّةٍ',
  13: 'وَمَا أُبَرِّئُ',
  14: 'الرّ (الحجر)',
  15: 'سُبْحَانَ الَّذِي',
  16: 'قَالَ أَلَمْ أَقُل لَّكَ',
  17: 'اقْتَرَبَ لِلنَّاسِ',
  18: 'قَدْ أَفْلَحَ',
  19: 'وَقَالَ الَّذِينَ',
  20: 'فَمَا كَانَ جَوَابَ قَوْمِهِ',
  21: 'وَلا تَجَادِلُوا',
  22: 'وَمَنْ يَقْنُتْ',
  23: 'وَمَا أَنْزَلْنَا',
  24: 'فَمَنْ أَظْلَمُ',
  25: 'إِلَيْهِ يُرَدُّ',
  26: 'أحقاف',
  27: 'قَالَ فَمَا خَطْبُكُمْ',
  28: 'قَدْ سَمِعَ اللَّهُ',
  29: 'تَبَارَكَ الَّذِي',
  30: 'عَمَّ يَتَسَاءَلُونَ',
};

// ============================================================
// DEFAULT SCHOOL INFO
// ============================================================
export const DEFAULT_SCHOOL_INFO: SchoolInfo = {
  nameEn: 'Al-Irshaad Quran Institute',
  nameAr: 'معهد الإرشاد لتحفيظ القرآن الكريم',
  logo: null,
  phone: '+252 61 234 5678',
  email: 'info@alirshaad.edu.so',
  address: 'Mogadishu, Somalia',
  reportTitle: 'Official Student Transcript',
  footerNote:
    'This is a computer-generated document. For any inquiries, please contact the administration office.',
};

const SCHOOL_INFO_KEY = 'reports_school_info_v1';

// ============================================================
// DATE HELPERS
// ============================================================
export const getCurrentMonth = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const getSafeDate = (dateStr?: string): Date => {
  if (!dateStr) return new Date();
  if (dateStr.length === 7) {
    const [y, m] = dateStr.split('-').map(Number);
    if (isNaN(y) || isNaN(m)) return new Date();
    return new Date(y, m - 1, 1);
  }
  const dateOnly = dateStr.split('T')[0];
  const [y, m, d] = dateOnly.split('-').map(Number);
  if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m - 1, d);
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const toDateKey = (d: Date | string): string | null => {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(date.getDate()).padStart(2, '0')}`;
};

export const formatShortDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const d = getSafeDate(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
};

export const formatPrintDate = (dateStr?: string, locale: string = 'en-US'): string => {
  if (!dateStr) return '-';
  const d = getSafeDate(dateStr);
  try {
    return d.toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  }
};

export const getMonthLabel = (monthStr: string): string => {
  const d = getSafeDate(monthStr);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};

export const getMonthLabelLong = (monthStr: string, locale?: string): string => {
  const d = getSafeDate(monthStr);
  try {
    return d.toLocaleString(locale || 'en-US', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`;
  }
};

export const getDaysInMonth = (monthStr: string): string[] => {
  const [y, m] = monthStr.split('-').map(Number);
  if (isNaN(y) || isNaN(m)) return [];
  const total = new Date(y, m, 0).getDate();
  return Array.from(
    { length: total },
    (_, i) =>
      `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
  );
};

export const getMonthsFromJanToCurrent = (): string[] => {
  const now = new Date();
  const y = now.getFullYear();
  const currentM = now.getMonth();
  const months: string[] = [];
  for (let m = 0; m <= currentM; m++) {
    months.push(`${y}-${String(m + 1).padStart(2, '0')}`);
  }
  return months;
};

export const getLastNMonths = (n = 12): string[] => {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
};

// ============================================================
// LANGUAGE / RTL HELPERS
// ============================================================
export const isRTLLanguage = (lang?: string): boolean => lang === 'ar';

export const getDateLocale = (lang?: string): string => {
  if (lang === 'ar') return 'ar-EG';
  if (lang === 'so') return 'so-SO';
  return 'en-US';
};

// ============================================================
// STATUS HELPERS
// ============================================================
export const getStatusColor = (
  status?: string
): { bg: string; text: string } => {
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
    case 'Draft':
      return { bg: '#F1F5F9', text: COLORS.slateMuted };
    default:
      return { bg: '#F1F5F9', text: COLORS.slateMuted };
  }
};

// ============================================================
// MISC HELPERS
// ============================================================
export const unwrap = (res: any): any => {
  if (res && typeof res === 'object' && 'data' in res) return res.data;
  return res;
};

export const unwrapData = (res: any): any => {
  const u = unwrap(res);
  if (u && typeof u === 'object' && 'data' in u) return u.data;
  return u;
};

export const asArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);

export const getHalaqahName = (h?: HalaqahRef | string): string => {
  if (!h) return '-';
  if (typeof h === 'string') return h;
  return h.name || '-';
};

export const initials = (name?: string): string => {
  const s = (name || '').trim();
  if (!s) return '?';
  const parts = s.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][1] || parts[1][0]).toUpperCase();
  return s.substring(0, 2).toUpperCase();
};

export const round1 = (n: number): number =>
  Math.round((Number(n) || 0) * 10) / 10;

export const round0 = (n: number): number => Math.round(Number(n) || 0);

// ============================================================
// MEMORIZATION RANGE FORMATTERS
// ============================================================
export const getSurahName = (id?: number): string => {
  if (!id) return '';
  return SURAH_LIST.find((s) => s.id === Number(id))?.name || `Surah ${id}`;
};

export const getSurahArabic = (id?: number): string => {
  if (!id) return '';
  return SURAH_LIST.find((s) => s.id === Number(id))?.arabic || '';
};

export const getJuzName = (id?: number): string => {
  if (!id) return '';
  return JUZ_NAMES[Number(id)] || `Juz ${id}`;
};

/** Short range label for lists on mobile. */
export const formatRangeShort = (r: MemorizationRecord): string => {
  if (r.type === 'tashiih') return r.topic || 'Tashiih';
  if (r.type === 'book_review') {
    const type = r.bookType || 'pages';
    return `${r.bookName || 'Book'} (${type} ${r.fromBookPage || '-'}-${
      r.toBookPage || '-'
    })`;
  }
  if (r.rangeType === 'juz') {
    const fromJuz = Number(r.fromJuz) || 1;
    const toJuz = Number(r.toJuz) || 1;
    if (fromJuz === toJuz) {
      const q = r.fromQuarter || r.toQuarter
        ? ` (${r.fromQuarter || 1}/8-${r.toQuarter || 8}/8)`
        : '';
      return `Juz ${fromJuz}${q}`;
    }
    return `Juz ${fromJuz} → Juz ${toJuz}`;
  }
  if (r.fromSurah) {
    if (r.fromSurah === r.toSurah) {
      return `${getSurahName(r.fromSurah)} (${r.fromAyah || '-'}-${
        r.toAyah || '-'
      })`;
    }
    return `${getSurahName(r.fromSurah)}:${r.fromAyah || '-'} → ${getSurahName(
      r.toSurah
    )}:${r.toAyah || '-'}`;
  }
  return r.topic || r.bookName || '-';
};

/** Full range label used in the printable table. */
export const formatMemorizationRange = (record: MemorizationRecord): string => {
  const isTashiih = record.type === 'tashiih';
  const isBookReview = record.type === 'book_review';

  if (isTashiih) return record.topic || 'Tashiih';
  if (isBookReview) {
    return `${record.bookName || 'Book'} (${record.fromBookPage || '-'}-${
      record.toBookPage || '-'
    })`;
  }

  if (record.rangeType === 'juz') {
    const fromJuz = Number(record.fromJuz) || 1;
    const toJuz = Number(record.toJuz) || 1;
    const fromQuarter = record.fromQuarter;
    const toQuarter = record.toQuarter;
    const fromJuzName = JUZ_NAMES[fromJuz] || `Juz ${fromJuz}`;

    if (fromJuz === toJuz) {
      const quarterPart =
        fromQuarter || toQuarter
          ? ` (${fromQuarter || 1}/8-${toQuarter || 8}/8)`
          : '';
      return `Juz ${fromJuz} (${fromJuzName})${quarterPart}`;
    }

    const toJuzName = JUZ_NAMES[toJuz] || `Juz ${toJuz}`;
    const fromQuarterPart = fromQuarter ? ` ${fromQuarter}/8` : '';
    const toQuarterPart = toQuarter ? ` ${toQuarter}/8` : '';
    return `Juz ${fromJuz} (${fromJuzName})${fromQuarterPart} → Juz ${toJuz} (${toJuzName})${toQuarterPart}`;
  }

  const fromSurahId = record.fromSurah;
  const toSurahId = record.toSurah;
  const fromSurahName = getSurahName(fromSurahId) || `Surah ${fromSurahId}`;
  const fromSurahArabic = getSurahArabic(fromSurahId) || '';
  const fromAyah = record.fromAyah;
  const toAyah = record.toAyah;

  if (fromSurahId === toSurahId) {
    return `${fromSurahName} (${fromSurahArabic}) (${fromAyah}-${toAyah})`;
  }

  const toSurahName = getSurahName(toSurahId) || `Surah ${toSurahId}`;
  const toSurahArabic = getSurahArabic(toSurahId) || '';
  return `${fromSurahName} (${fromSurahArabic}) ${fromAyah} → ${toSurahName} (${toSurahArabic}) ${toAyah}`;
};

// ============================================================
// COMBINED SCORE (same weights as web / backend)
// ============================================================
export interface CombinedScore {
  combined: number;
  attendance: number;
  memorization: number;
  memorizationScore: number;
  behavior: number;
  behaviorScore: number;
}

export const computeCombinedScore = (
  attendanceRate: number,
  memAvgScore: number,
  behaviorPoints: number
): CombinedScore => {
  const attendance = round0(attendanceRate);
  const memorizationScore = Math.max(
    0,
    Math.min(100, round0((memAvgScore / 10) * 100))
  );
  const behaviorScore = Math.max(
    0,
    Math.min(100, round0(((behaviorPoints + 10) / 20) * 100))
  );
  const combined = round0(
    attendance * 0.45 + memorizationScore * 0.45 + behaviorScore * 0.1
  );
  return {
    combined,
    attendance,
    memorization: memAvgScore,
    memorizationScore,
    behavior: behaviorPoints,
    behaviorScore,
  };
};

export const computeAttendanceRate = (
  summary?: AttendanceData['summary']
): number => {
  if (!summary || !summary.total) return 0;
  const present = summary.present || 0;
  const late = summary.late || 0;
  return round0(((present + late) / summary.total) * 100);
};

// ============================================================
// EXAM HELPERS
// ============================================================
export const getExamFormType = (exam: Exam): 'memorization' | 'reading' =>
  (exam.examFormType || exam.formType || 'memorization') as
    | 'memorization'
    | 'reading';

/** Per-question contribution using visible columns + marksPer. */
export const computeQuestionContribution = (
  q: ExamQuestion,
  columns: ExamColumn[],
  marksPer: Record<string, number>
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
      const weight = marksPer[weightKey] !== undefined ? marksPer[weightKey] : 1;
      const value =
        q.customColumns && q.customColumns[col.key] !== undefined
          ? q.customColumns[col.key]
          : (q as any)[fieldKey] || 0;
      const isAdditive = col.isAdditive !== false;
      total += isAdditive ? value * weight : -(value * weight);
    });
  return total;
};

export const getVisibleExamColumns = (
  exam: Exam
): ExamColumn[] => {
  const cols =
    exam.settings?.columns && exam.settings.columns.length > 0
      ? exam.settings.columns
      : [
          {
            id: 'tajwid',
            key: 'tajwid',
            label: 'Tajwid',
            isAdditive: false,
            order: 0,
          },
          {
            id: 'lahni',
            key: 'lahni',
            label: 'Lahni',
            isAdditive: false,
            order: 1,
          },
          {
            id: 'fathi',
            key: 'fathi',
            label: 'Fathi',
            isAdditive: false,
            order: 2,
          },
          {
            id: 'performance',
            key: 'performance',
            label: 'Performance',
            isAdditive: true,
            order: 3,
          },
        ];
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

// ============================================================
// SCHOOL INFO — AsyncStorage
// ============================================================
export const schoolInfoStorage = {
  async load(): Promise<SchoolInfo> {
    try {
      const raw = await AsyncStorage.getItem(SCHOOL_INFO_KEY);
      if (!raw) return { ...DEFAULT_SCHOOL_INFO };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SCHOOL_INFO, ...parsed };
    } catch {
      return { ...DEFAULT_SCHOOL_INFO };
    }
  },
  async save(info: SchoolInfo): Promise<void> {
    try {
      await AsyncStorage.setItem(SCHOOL_INFO_KEY, JSON.stringify(info));
    } catch (e) {
      console.warn('Failed to persist school info', e);
    }
  },
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SCHOOL_INFO_KEY);
    } catch {}
  },
};

// ============================================================
// REPORTS API
// ============================================================
export const reportsApi = {
  /** Search students by name / reg no. */
  searchStudents: async (query: string, limit = 20): Promise<Student[]> => {
    const params: any = { search: query.trim(), limit };
    const res: any = await apiClient.get(EP.students, params);
    const u = unwrapData(res);
    return Array.isArray(u) ? u : u?.students || [];
  },

  /** Fetch the full report for a student, either by month or explicit range. */
  getStudentReport: async (
    studentId: string,
    params: { month?: string; startDate?: string; endDate?: string }
  ): Promise<ReportData | null> => {
    // Build a clean query object — drop undefined/empty so the URL is correct.
    const q: any = {};
    if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
      q.month = params.month;
    }
    if (params.startDate) q.startDate = params.startDate;
    if (params.endDate) q.endDate = params.endDate;

    const res: any = await apiClient.get(EP.studentReport(studentId), q);
    const data = unwrapData(res);
    return data || null;
  },

  /** Last N months of combined scores for a student. */
  getMonthlyPerformance: async (
    studentId: string,
    months = 12
  ): Promise<MonthlyPerf[]> => {
    const res: any = await apiClient.get(EP.monthlyPerformance(studentId), {
      months,
    });
    const data = unwrapData(res);
    const list = Array.isArray(data) ? data : data?.data || [];
    return asArray<MonthlyPerf>(list);
  },
};

// ============================================================
// EXPORTS FOR REFERENCE export const reportsApi = {
// ============================================================
export const REPORTS_STORAGE_KEY = SCHOOL_INFO_KEY;