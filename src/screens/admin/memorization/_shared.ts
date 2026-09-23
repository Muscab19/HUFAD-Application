// src/screens/admin/memorization/_shared.ts
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
// TYPES
// ============================================================
export type AchievementType =
  | 'memorization'
  | 'minor_review'
  | 'major_review'
  | 'ijazah'
  | 'subac'
  | 'book_review'
  | 'tashiih';

export interface Student {
  _id: string;
  name: string;
  regNo?: string;
  halaqah?: { _id: string; name: string } | string;
  halaqahName?: string;
  timeType?: string;
}

export interface Halaqah {
  _id: string;
  id?: string;
  name: string;
  isAll?: boolean;
}

export interface Achievement {
  _id: string;
  studentId: string | { _id: string; name: string };
  studentName?: string;
  halaqahId?: string;
  halaqahName?: string;
  type: AchievementType;
  date: string;
  score: number;
  attempt?: number;
  comment?: string;
  totalMarks?: number;
  rangeType?: 'surah' | 'juz';
  fromSurah?: number;
  fromAyah?: number;
  toSurah?: number;
  toAyah?: number;
  fromJuz?: number;
  fromQuarter?: number;
  toJuz?: number;
  toQuarter?: number;
  bookId?: string;
  bookName?: string;
  bookType?: 'pages' | 'lines' | 'verses';
  fromBookPage?: number;
  toBookPage?: number;
  topic?: string;
  topicComment?: string;
}

export interface AchievementFormState {
  studentId: string;
  type: AchievementType;
  rangeType: 'surah' | 'juz';
  fromSurah: number;
  fromAyah: number;
  toSurah: number;
  toAyah: number;
  fromJuz: number;
  fromQuarter: number;
  toJuz: number;
  toQuarter: number;
  fromBookPage: string;
  toBookPage: string;
  bookId: string;
  bookName: string;
  score: string;
  attempt: string;
  comment: string;
  topic: string;
  customTopic: string;
}

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

// ============================================================
// JUZ NAMES
// ============================================================
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
// TASHIIH TOPICS
// Arabic strings are used as backend IDs.
// Use TASHIIH_TOPIC_KEYS to look up translation keys.
// ============================================================
export const TASHIIH_TOPICS = [
  'مخارج الحروف',
  'صفات الحروف',
  'أحكام النون الساكنة',
  'أحكام الميم الساكنة',
  'القلقلة',
  'أحكام المدود',
  'أحكام الراء',
  'تطبيق الحروف',
  'تطبيق السورة',
  'Other',
];

/**
 * Maps each Arabic TASHIIH topic (backend ID) to its translation key
 * under the `memorization.topics.*` namespace.
 */
export const TASHIIH_TOPIC_KEYS: Record<string, string> = {
  'مخارج الحروف': 'memorization.topics.مخارج الحروف',
  'صفات الحروف': 'memorization.topics.صفات الحروف',
  'أحكام النون الساكنة': 'memorization.topics.أحكام النون الساكنة',
  'أحكام الميم الساكنة': 'memorization.topics.أحكام الميم الساكنة',
  'القلقلة': 'memorization.topics.القلقلة',
  'أحكام المدود': 'memorization.topics.أحكام المدود',
  'أحكام الراء': 'memorization.topics.أحكام الراء',
  'تطبيق الحروف': 'memorization.topics.تطبيق الحروف',
  'تطبيق السورة': 'memorization.topics.تطبيق السورة',
  'Other': 'memorization.topics.Other',
};

/**
 * Returns the translated label for a Tashiih topic.
 * Falls back to the raw Arabic string if `t` isn't provided.
 */
export const getTopicLabel = (topic: string, t?: (key: string) => string) => {
  if (!t) return topic;
  const key = TASHIIH_TOPIC_KEYS[topic];
  return key ? t(key) : topic;
};

// ============================================================
// ACHIEVEMENT TYPES
// `labelKey` is a translation key (relative to the top-level
// namespace, e.g. "memorization.types.memorization").
// Translate at render time via getTypeInfo(type, t).
// ============================================================
export const ACHIEVEMENT_TYPES: {
  value: AchievementType;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}[] = [
  {
    value: 'memorization',
    labelKey: 'memorization.types.memorization',
    icon: 'book',
    color: COLORS.blue,
    bg: COLORS.blueLight,
  },
  {
    value: 'minor_review',
    labelKey: 'memorization.types.minor_review',
    icon: 'refresh',
    color: COLORS.primary,
    bg: COLORS.primaryLight,
  },
  {
    value: 'major_review',
    labelKey: 'memorization.types.major_review',
    icon: 'trending-up',
    color: COLORS.purple,
    bg: COLORS.purpleLight,
  },
  {
    value: 'ijazah',
    labelKey: 'memorization.types.ijazah',
    icon: 'ribbon',
    color: COLORS.gold,
    bg: COLORS.goldLight,
  },
  {
    value: 'subac',
    labelKey: 'memorization.types.subac',
    icon: 'star',
    color: COLORS.purple,
    bg: COLORS.purpleLight,
  },
  {
    value: 'book_review',
    labelKey: 'memorization.types.book_review',
    icon: 'library',
    color: COLORS.pink,
    bg: COLORS.pinkLight,
  },
  {
    value: 'tashiih',
    labelKey: 'memorization.types.tashiih',
    icon: 'clipboard',
    color: COLORS.teal,
    bg: COLORS.tealLight,
  },
];

// ============================================================
// HELPERS
// ============================================================
export const getMaxAyah = (surahId: number | string) => {
  const id = typeof surahId === 'string' ? parseInt(surahId) : surahId;
  return SURAH_LIST.find((s) => s.id === id)?.ayahCount || 286;
};

export const getSurahName = (id?: number) => {
  if (!id) return '';
  return SURAH_LIST.find((s) => s.id === id)?.name || `Surah ${id}`;
};

export const getSurahArabic = (id?: number) => {
  if (!id) return '';
  return SURAH_LIST.find((s) => s.id === id)?.arabic || '';
};

export const getJuzName = (id?: number) => {
  if (!id) return '';
  return JUZ_NAMES[id]?.name || `Juz ${id}`;
};

export const getJuzArabic = (id?: number) => {
  if (!id) return '';
  return JUZ_NAMES[id]?.arabic || '';
};

/**
 * Returns the achievement type metadata plus a translated `label`.
 * Pass `t` from useTranslation() at the call site.
 */
export const getTypeInfo = (
  type: AchievementType,
  t?: (key: string) => string
) => {
  const meta =
    ACHIEVEMENT_TYPES.find((x) => x.value === type) || ACHIEVEMENT_TYPES[0];
  return {
    ...meta,
    label: t ? t(meta.labelKey) : meta.labelKey,
  };
};

/**
 * Human-readable range string.
 * Pass `t` to translate units (Book, Pages, Lines, Verses, Unknown, Tashiih).
 */
export const getRangeDisplay = (
  a: Achievement,
  t?: (key: string, opts?: any) => string
): string => {
  const tr = (key: string, fallback: string, opts?: any) =>
    t ? t(key, opts) : fallback;

  if (a.type === 'tashiih') {
    return a.topic ? getTopicLabel(a.topic, t) : tr('memorization.types.tashiih', 'Tashiih');
  }
  if (a.type === 'book_review') {
    const unitFallback =
      a.bookType === 'lines'
        ? 'Lines'
        : a.bookType === 'verses'
        ? 'Verses'
        : 'Pages';
    const unitKey =
      a.bookType === 'lines'
        ? 'memorization.range.lines'
        : a.bookType === 'verses'
        ? 'memorization.range.verses'
        : 'memorization.range.pages';
    const unit = tr(unitKey, unitFallback);
    const bookLabel = a.bookName || tr('memorization.range.book', 'Book');
    return `${bookLabel} (${unit} ${a.fromBookPage || '-'}-${a.toBookPage || '-'})`;
  }
  if (a.rangeType === 'juz') {
    return `${getJuzName(a.fromJuz)} (${a.fromQuarter || 1}/8) → ${getJuzName(
      a.toJuz
    )} (${a.toQuarter || 8}/8)`;
  }
  if (a.fromSurah === a.toSurah) {
    return `${getSurahName(a.fromSurah)} (${a.fromAyah || '-'}-${
      a.toAyah || '-'
    })`;
  }
  return `${getSurahName(a.fromSurah)}:${a.fromAyah} → ${getSurahName(
    a.toSurah
  )}:${a.toAyah}`;
};

export const getStudentId = (a: Achievement): string => {
  return typeof a.studentId === 'string' ? a.studentId : a.studentId?._id || '';
};

export const getStudentName = (
  a: Achievement,
  t?: (key: string) => string
): string => {
  if (a.studentName) return a.studentName;
  if (typeof a.studentId === 'object' && a.studentId?.name) return a.studentId.name;
  return t ? t('memorization.range.unknown') : 'Unknown';
};

// ============================================================
// API
// ============================================================
export const api = {
  getHalaqat: async (): Promise<Halaqah[]> => {
    const res: any = await apiClient.get('/halaqaat');
    const list = Array.isArray(res)
      ? res
      : res?.halaqaat || res?.halaqat || res?.data || [];
    return list;
  },

  getStudents: async (halaqahId?: string): Promise<Student[]> => {
    const params: any = { limit: 1000 };
    if (halaqahId && halaqahId !== 'all') params.halaqah = halaqahId;
    const res: any = await apiClient.get('/students', params);
    const list = Array.isArray(res) ? res : res?.students || res?.data || [];
    return list;
  },

  getTodayAchievements: async (params: {
    halaqahId?: string;
    date: string;
  }): Promise<Achievement[]> => {
    const q: any = { date: params.date };
    if (params.halaqahId && params.halaqahId !== 'all')
      q.halaqahId = params.halaqahId;
    const res: any = await apiClient.get('/memorizations/today', q);
    return Array.isArray(res) ? res : res?.data || [];
  },

  createAchievement: async (payload: any): Promise<Achievement> => {
    return await apiClient.post('/memorizations', payload);
  },

  updateAchievement: async (id: string, payload: any): Promise<Achievement> => {
    return await apiClient.put(`/memorizations/${id}`, payload);
  },

  deleteAchievement: async (id: string): Promise<void> => {
    await apiClient.delete(`/memorizations/${id}`);
  },
};