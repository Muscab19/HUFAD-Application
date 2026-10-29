// src/screens/teacher/TeacherMemorizationScreen.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { api as apiClient } from '../../api/client';
import { enqueue } from '../../utils/offlineDb';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

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
  pink: '#DB2777',
  pinkLight: '#FCE7F3',
  teal: '#0D9488',
  tealLight: '#CCFBF1',
  gold: '#C9A227',
  goldLight: '#FFF7DF',
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
const SURAH_LIST = [
  { id: 1, name: 'Al-Fatiha', arabic: 'الفاتحة', ayahCount: 7 },
  { id: 2, name: 'Al-Baqarah', arabic: 'البقرة', ayahCount: 286 },
  { id: 3, name: 'Aal-Imran', arabic: 'آل عمران', ayahCount: 200 },
  { id: 4, name: 'An-Nisa', arabic: 'النساء', ayahCount: 176 },
  { id: 5, name: "Al-Ma'idah", arabic: 'المائدة', ayahCount: 120 },
  { id: 6, name: "Al-An'am", arabic: 'الأنعام', ayahCount: 165 },
  { id: 7, name: "Al-A'raf", arabic: 'الأعراف', ayahCount: 206 },
  { id: 8, name: 'Al-Anfal', arabic: 'الأنفال', ayahCount: 75 },
  { id: 9, name: 'At-Tawbah', arabic: 'التوبة', ayahCount: 129 },
  { id: 10, name: 'Yunus', arabic: 'يونس', ayahCount: 109 },
  { id: 11, name: 'Hud', arabic: 'هود', ayahCount: 123 },
  { id: 12, name: 'Yusuf', arabic: 'يوسف', ayahCount: 111 },
  { id: 13, name: "Ar-Ra'd", arabic: 'الرعد', ayahCount: 43 },
  { id: 14, name: 'Ibrahim', arabic: 'إبراهيم', ayahCount: 52 },
  { id: 15, name: 'Al-Hijr', arabic: 'الحجر', ayahCount: 99 },
  { id: 16, name: 'An-Nahl', arabic: 'النحل', ayahCount: 128 },
  { id: 17, name: 'Al-Isra', arabic: 'الإسراء', ayahCount: 111 },
  { id: 18, name: 'Al-Kahf', arabic: 'الكهف', ayahCount: 110 },
  { id: 19, name: 'Maryam', arabic: 'مريم', ayahCount: 98 },
  { id: 20, name: 'Ta-Ha', arabic: 'طه', ayahCount: 135 },
  { id: 21, name: 'Al-Anbiya', arabic: 'الأنبياء', ayahCount: 112 },
  { id: 22, name: 'Al-Hajj', arabic: 'الحج', ayahCount: 78 },
  { id: 23, name: "Al-Mu'minun", arabic: 'المؤمنون', ayahCount: 118 },
  { id: 24, name: 'An-Nur', arabic: 'النور', ayahCount: 64 },
  { id: 25, name: 'Al-Furqan', arabic: 'الفرقان', ayahCount: 77 },
  { id: 26, name: "Ash-Shu'ara", arabic: 'الشعراء', ayahCount: 227 },
  { id: 27, name: 'An-Naml', arabic: 'النمل', ayahCount: 93 },
  { id: 28, name: 'Al-Qasas', arabic: 'القصص', ayahCount: 88 },
  { id: 29, name: 'Al-Ankabut', arabic: 'العنكبوت', ayahCount: 69 },
  { id: 30, name: 'Ar-Rum', arabic: 'الروم', ayahCount: 60 },
  { id: 31, name: 'Luqman', arabic: 'لقمان', ayahCount: 34 },
  { id: 32, name: 'As-Sajdah', arabic: 'السجدة', ayahCount: 30 },
  { id: 33, name: 'Al-Ahzab', arabic: 'الأحزاب', ayahCount: 73 },
  { id: 34, name: 'Saba', arabic: 'سبأ', ayahCount: 54 },
  { id: 35, name: 'Fatir', arabic: 'فاطر', ayahCount: 45 },
  { id: 36, name: 'Ya-Sin', arabic: 'يس', ayahCount: 83 },
  { id: 37, name: 'As-Saffat', arabic: 'الصافات', ayahCount: 182 },
  { id: 38, name: 'Sad', arabic: 'ص', ayahCount: 88 },
  { id: 39, name: 'Az-Zumar', arabic: 'الزمر', ayahCount: 75 },
  { id: 40, name: 'Ghafir', arabic: 'غافر', ayahCount: 85 },
  { id: 41, name: 'Fussilat', arabic: 'فصلت', ayahCount: 54 },
  { id: 42, name: 'Ash-Shura', arabic: 'الشورى', ayahCount: 53 },
  { id: 43, name: 'Az-Zukhruf', arabic: 'الزخرف', ayahCount: 89 },
  { id: 44, name: 'Ad-Dukhan', arabic: 'الدخان', ayahCount: 59 },
  { id: 45, name: 'Al-Jathiyah', arabic: 'الجاثية', ayahCount: 37 },
  { id: 46, name: 'Al-Ahqaf', arabic: 'الأحقاف', ayahCount: 35 },
  { id: 47, name: 'Muhammad', arabic: 'محمد', ayahCount: 38 },
  { id: 48, name: 'Al-Fath', arabic: 'الفتح', ayahCount: 29 },
  { id: 49, name: 'Al-Hujurat', arabic: 'الحجرات', ayahCount: 18 },
  { id: 50, name: 'Qaf', arabic: 'ق', ayahCount: 45 },
  { id: 51, name: 'Adh-Dhariyat', arabic: 'الذاريات', ayahCount: 60 },
  { id: 52, name: 'At-Tur', arabic: 'الطور', ayahCount: 49 },
  { id: 53, name: 'An-Najm', arabic: 'النجم', ayahCount: 62 },
  { id: 54, name: 'Al-Qamar', arabic: 'القمر', ayahCount: 55 },
  { id: 55, name: 'Ar-Rahman', arabic: 'الرحمن', ayahCount: 78 },
  { id: 56, name: "Al-Waqi'ah", arabic: 'الواقعة', ayahCount: 96 },
  { id: 57, name: 'Al-Hadid', arabic: 'الحديد', ayahCount: 29 },
  { id: 58, name: 'Al-Mujadilah', arabic: 'المجادلة', ayahCount: 22 },
  { id: 59, name: 'Al-Hashr', arabic: 'الحشر', ayahCount: 24 },
  { id: 60, name: 'Al-Mumtahanah', arabic: 'الممتحنة', ayahCount: 13 },
  { id: 61, name: 'As-Saff', arabic: 'الصف', ayahCount: 14 },
  { id: 62, name: "Al-Jumu'ah", arabic: 'الجمعة', ayahCount: 11 },
  { id: 63, name: 'Al-Munafiqun', arabic: 'المنافقون', ayahCount: 11 },
  { id: 64, name: 'At-Taghabun', arabic: 'التغابن', ayahCount: 18 },
  { id: 65, name: 'At-Talaq', arabic: 'الطلاق', ayahCount: 12 },
  { id: 66, name: 'At-Tahrim', arabic: 'التحريم', ayahCount: 12 },
  { id: 67, name: 'Al-Mulk', arabic: 'الملك', ayahCount: 30 },
  { id: 68, name: 'Al-Qalam', arabic: 'القلم', ayahCount: 52 },
  { id: 69, name: 'Al-Haqqah', arabic: 'الحاقة', ayahCount: 52 },
  { id: 70, name: "Al-Ma'arij", arabic: 'المعارج', ayahCount: 44 },
  { id: 71, name: 'Nuh', arabic: 'نوح', ayahCount: 28 },
  { id: 72, name: 'Al-Jinn', arabic: 'الجن', ayahCount: 28 },
  { id: 73, name: 'Al-Muzzammil', arabic: 'المزمل', ayahCount: 20 },
  { id: 74, name: 'Al-Muddathir', arabic: 'المدثر', ayahCount: 56 },
  { id: 75, name: 'Al-Qiyamah', arabic: 'القيامة', ayahCount: 40 },
  { id: 76, name: 'Al-Insan', arabic: 'الإنسان', ayahCount: 31 },
  { id: 77, name: 'Al-Mursalat', arabic: 'المرسلات', ayahCount: 50 },
  { id: 78, name: 'An-Naba', arabic: 'النبأ', ayahCount: 40 },
  { id: 79, name: "An-Nazi'at", arabic: 'النازعات', ayahCount: 46 },
  { id: 80, name: 'Abasa', arabic: 'عبس', ayahCount: 42 },
  { id: 81, name: 'At-Takwir', arabic: 'التكوير', ayahCount: 29 },
  { id: 82, name: 'Al-Infitar', arabic: 'الإنفطار', ayahCount: 19 },
  { id: 83, name: 'Al-Mutaffifin', arabic: 'المطففين', ayahCount: 36 },
  { id: 84, name: 'Al-Inshiqaq', arabic: 'الإنشقاق', ayahCount: 25 },
  { id: 85, name: 'Al-Buruj', arabic: 'البروج', ayahCount: 22 },
  { id: 86, name: 'At-Tariq', arabic: 'الطارق', ayahCount: 17 },
  { id: 87, name: "Al-A'la", arabic: 'الأعلى', ayahCount: 19 },
  { id: 88, name: 'Al-Ghashiyah', arabic: 'الغاشية', ayahCount: 26 },
  { id: 89, name: 'Al-Fajr', arabic: 'الفجر', ayahCount: 30 },
  { id: 90, name: 'Al-Balad', arabic: 'البلد', ayahCount: 20 },
  { id: 91, name: 'Ash-Shams', arabic: 'الشمس', ayahCount: 15 },
  { id: 92, name: 'Al-Layl', arabic: 'الليل', ayahCount: 21 },
  { id: 93, name: 'Ad-Duha', arabic: 'الضحى', ayahCount: 11 },
  { id: 94, name: 'Ash-Sharh', arabic: 'الشرح', ayahCount: 8 },
  { id: 95, name: 'At-Tin', arabic: 'التين', ayahCount: 8 },
  { id: 96, name: 'Al-Alaq', arabic: 'العلق', ayahCount: 19 },
  { id: 97, name: 'Al-Qadr', arabic: 'القدر', ayahCount: 5 },
  { id: 98, name: 'Al-Bayyinah', arabic: 'البينة', ayahCount: 8 },
  { id: 99, name: 'Az-Zalzalah', arabic: 'الزلزلة', ayahCount: 8 },
  { id: 100, name: 'Al-Adiyat', arabic: 'العاديات', ayahCount: 11 },
  { id: 101, name: "Al-Qari'ah", arabic: 'القارعة', ayahCount: 11 },
  { id: 102, name: 'At-Takathur', arabic: 'التكاثر', ayahCount: 8 },
  { id: 103, name: 'Al-Asr', arabic: 'العصر', ayahCount: 3 },
  { id: 104, name: 'Al-Humazah', arabic: 'الهمزة', ayahCount: 9 },
  { id: 105, name: 'Al-Fil', arabic: 'الفيل', ayahCount: 5 },
  { id: 106, name: 'Quraysh', arabic: 'قريش', ayahCount: 4 },
  { id: 107, name: "Al-Ma'un", arabic: 'الماعون', ayahCount: 7 },
  { id: 108, name: 'Al-Kawthar', arabic: 'الكوثر', ayahCount: 3 },
  { id: 109, name: 'Al-Kafirun', arabic: 'الكافرون', ayahCount: 6 },
  { id: 110, name: 'An-Nasr', arabic: 'النصر', ayahCount: 3 },
  { id: 111, name: 'Al-Masad', arabic: 'المسد', ayahCount: 5 },
  { id: 112, name: 'Al-Ikhlas', arabic: 'الإخلاص', ayahCount: 4 },
  { id: 113, name: 'Al-Falaq', arabic: 'الفلق', ayahCount: 5 },
  { id: 114, name: 'An-Nas', arabic: 'الناس', ayahCount: 6 },
];

const JUZ_NAMES: Record<number, { name: string; arabic: string }> = {
  1: { name: 'الفاتحة بِسْمِ اللَّهِ', arabic: 'الفاتحة' },
  2: { name: 'سَيَقُولُ السُّفَهَاءُ', arabic: 'سَيَقُولُ' },
  3: { name: 'تِلْكَ الرُّسُلُ', arabic: 'تِلْكَ' },
  4: { name: 'لَنْ تَنَالُوا الْبِرَّ', arabic: 'لَنْ تَنَالُوا' },
  5: { name: 'وَالْمُحْصَنَاتُ', arabic: 'وَالْمُحْصَنَاتُ' },
  6: { name: 'لَا يُحِبُّ اللَّهُ', arabic: 'لَا يُحِبُّ' },
  7: { name: 'وَإِذَا سَمِعُوا', arabic: 'وَإِذَا سَمِعُوا' },
  8: { name: 'وَلَوْ أَنَّا', arabic: 'وَلَوْ أَنَّا' },
  9: { name: 'قَالَ الْمَلَأُ', arabic: 'قَالَ الْمَلَأُ' },
  10: { name: 'وَاعْلَمُوا', arabic: 'وَاعْلَمُوا' },
  11: { name: 'يَعْتَذِرُونَ', arabic: 'يَعْتَذِرُونَ' },
  12: { name: 'وَمَا مِن دَابَّةٍ', arabic: 'وَمَا مِن' },
  13: { name: 'وَمَا أُبَرِّئُ', arabic: 'وَمَا أُبَرِّئُ' },
  14: { name: 'رُبَمَا', arabic: 'رُبَمَا' },
  15: { name: 'سُبْحَانَ الَّذِي', arabic: 'سُبْحَانَ' },
  16: { name: 'قَالَ أَلَمْ', arabic: 'قَالَ أَلَمْ' },
  17: { name: 'اقْتَرَبَ', arabic: 'اقْتَرَبَ' },
  18: { name: 'قَدْ أَفْلَحَ', arabic: 'قَدْ أَفْلَحَ' },
  19: { name: 'وَقَالَ الَّذِينَ', arabic: 'وَقَالَ' },
  20: { name: 'أَمَّنْ خَلَقَ', arabic: 'أَمَّنْ' },
  21: { name: 'أُتْلُ مَا أُوحِيَ', arabic: 'أُتْلُ' },
  22: { name: 'وَمَنْ يَقْنُتْ', arabic: 'وَمَنْ يَقْنُتْ' },
  23: { name: 'وَمَا لِيَ', arabic: 'وَمَا لِيَ' },
  24: { name: 'فَمَنِ أَظْلَمُ', arabic: 'فَمَنِ' },
  25: { name: 'إِلَيْهِ يُرَدُّ', arabic: 'إِلَيْهِ' },
  26: { name: 'حم', arabic: 'حم' },
  27: { name: 'قَالُوا آمَنَّا', arabic: 'قَالُوا' },
  28: { name: 'قَدْ سَمِعَ اللَّهُ', arabic: 'قَدْ سَمِعَ' },
  29: { name: 'تَبَارَكَ الَّذِي', arabic: 'تَبَارَكَ' },
  30: { name: 'عَمَّ يَتَسَاءَلُونَ', arabic: 'عَمَّ' },
};

const TASHIIH_TOPICS = [
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

const READING_WRITING_TOPICS = [
  'الحروف الهجائية',
  'الحركات',
  'السكون',
  'التنوين',
  'المدود',
  'اللين',
  'الشدة',
  'اللامات',
  'الهمزات',
  'التاءات',
  'التقاء الساكنين',
  'Other',
];

const DEFAULT_TYPES: {
  value: string;
  labelKey: string;
  color: string;
  bg: string;
}[] = [
  { value: 'memorization', labelKey: 'teacher.memorization.types.memorization', color: COLORS.blue, bg: COLORS.blueLight },
  { value: 'minor_review', labelKey: 'teacher.memorization.types.minor_review', color: COLORS.primary, bg: COLORS.primaryLight },
  { value: 'major_review', labelKey: 'teacher.memorization.types.major_review', color: COLORS.purple, bg: COLORS.purpleLight },
  { value: 'ijazah', labelKey: 'teacher.memorization.types.ijazah', color: COLORS.gold, bg: COLORS.goldLight },
  { value: 'subac', labelKey: 'teacher.memorization.types.subac', color: COLORS.purple, bg: COLORS.purpleLight },
  { value: 'book_review', labelKey: 'teacher.memorization.types.book_review', color: COLORS.pink, bg: COLORS.pinkLight },
  { value: 'tashiih', labelKey: 'teacher.memorization.types.tashiih', color: COLORS.teal, bg: COLORS.tealLight },
  { value: 'reading_writing', labelKey: 'teacher.memorization.types.reading_writing', color: COLORS.amber, bg: COLORS.amberLight },
];

// ============================================================
// HELPERS
// ============================================================
const getMaxAyah = (surahId: number | string) => {
  const id = typeof surahId === 'string' ? parseInt(surahId) : surahId;
  return SURAH_LIST.find((s) => s.id === id)?.ayahCount || 286;
};

const getInitials = (name: string) => {
  const parts = (name || '').trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || '').substring(0, 2).toUpperCase();
};

const getJuzArabic = (n: number) => JUZ_NAMES[n]?.arabic || `الجزء ${n}`;
const getSurahName = (id: number) =>
  SURAH_LIST.find((s) => s.id === id)?.name || `Surah ${id}`;

// ============================================================
// TYPES
// ============================================================
interface Halaqah {
  _id: string;
  id?: string;
  name: string;
  studentCount?: number;
}

interface Student {
  _id: string;
  name: string;
  halaqah?: { _id: string; name: string } | string;
  regNo?: string;
}

interface Achievement {
  _id: string;
  studentId: string | { _id: string; name: string };
  studentName?: string;
  type: string;
  date: string;
  score?: number;
  totalMarks?: number;
  attempt?: number;
  comment?: string;
  rangeType?: 'surah' | 'juz';
  fromSurah?: number;
  fromAyah?: number;
  toSurah?: number;
  toAyah?: number;
  fromJuz?: number;
  fromQuarter?: number;
  toJuz?: number;
  toQuarter?: number;
  bookName?: string;
  bookType?: 'pages' | 'lines' | 'verses';
  fromBookPage?: number;
  toBookPage?: number;
  topic?: string;
  isBulk?: boolean;
  recordedByName?: string;
}

interface Book {
  _id: string;
  name: string;
  author?: string;
  bookType?: 'pages' | 'lines' | 'verses';
}

// ============================================================
// SCREEN
// ============================================================
export const TeacherMemorizationScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { currentBranch } = useBranch();
  const { isOnline } = useNetworkStatus();

  // Data
  const [teacherHalaqahs, setTeacherHalaqahs] = useState<Halaqah[]>([]);
  const [selectedHalaqah, setSelectedHalaqah] = useState<Halaqah | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [todaysAchievements, setTodaysAchievements] = useState<Achievement[]>([]);
  const [achievementTypes, setAchievementTypes] = useState(DEFAULT_TYPES);
  const [books, setBooks] = useState<Book[]>([]);

  // UI
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Add modal
  const [addModal, setAddModal] = useState<{
    visible: boolean;
    student: Student | null;
  }>({ visible: false, student: null });

  const [achForm, setAchForm] = useState({
    type: 'memorization',
    rangeType: 'surah' as 'surah' | 'juz',
    fromSurah: 1,
    fromAyah: 1,
    toSurah: 1,
    toAyah: 1,
    fromJuz: 1,
    fromQuarter: 1,
    toJuz: 1,
    toQuarter: 8,
    bookId: '',
    bookName: '',
    fromBookPage: '',
    toBookPage: '',
    score: '8',
    attempt: '1',
    comment: '',
    topic: '',
    customTopic: '',
  });

  // View modal
  const [viewModal, setViewModal] = useState<{
    visible: boolean;
    student: Student | null;
    achievements: Achievement[];
  }>({ visible: false, student: null, achievements: [] });

  // ============================================================
  // BOOT: halaqahs + types + books
  // ============================================================
  const loadInitial = useCallback(async () => {
    try {
      setError('');
      const branchId = currentBranch?._id;

      const [hRes, typesRes, booksRes]: any = await Promise.all([
        apiClient.get('/teacher/halaqahs'),
        apiClient.get('/teacher/achievement-types').catch(() => null),
        // Books are created by the admin via POST /books — read from the
        // same shared endpoint so admin-created books show up here too.
        apiClient
          .get('/books', branchId ? { branchId } : undefined)
          .catch(() =>
            // Fallback: if the shared endpoint isn't reachable for this
            // role, try the teacher-scoped endpoint.
            apiClient.get('/teacher/books').catch(() => null)
          ),
      ]);

      const list: Halaqah[] = Array.isArray(hRes)
        ? hRes
        : hRes?.halaqahs || hRes?.data || [];
      setTeacherHalaqahs(list);

      if (list.length > 0) {
        setSelectedHalaqah(list[0]);
      }

      if (typesRes && Array.isArray(typesRes)) {
        const merged = [...typesRes];
        DEFAULT_TYPES.forEach((def) => {
          if (!merged.some((t: any) => t.value === def.value)) {
            merged.push(def);
          }
        });
        setAchievementTypes(merged as any);
      } else {
        setAchievementTypes(DEFAULT_TYPES);
      }

      // Normalize various response shapes the API might return.
      const rawBooks = Array.isArray(booksRes)
        ? booksRes
        : booksRes?.books || booksRes?.data || [];
      setBooks(
        rawBooks.map((b: any) => ({
          _id: String(b._id || b.id),
          name: b.name,
          author: b.author,
          bookType: b.bookType || 'pages',
        }))
      );
    } catch (err: any) {
      console.error('Load initial memorization error:', err);
      setError(
        err?.message || t('teacher.memorization.alerts.loadHalaqahsFailed')
      );
    } finally {
      setInitialLoading(false);
    }
  }, [t, currentBranch?._id]); 

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // ============================================================
  // LOAD STUDENTS + TODAY'S ACHIEVEMENTS
  // ============================================================
  const loadStudents = useCallback(
    async (halaqahId: string) => {
      setError('');
      setLoadingStudents(true);
      try {
        const res: any = await apiClient.get(
          `/teacher/students/halaqah/${halaqahId}`
        );
        const data: Student[] = res?.students || res?.data || (Array.isArray(res) ? res : []);
        setStudents(data);
      } catch (err: any) {
        console.error('Load students error:', err);
        setError(err?.message || t('teacher.memorization.alerts.loadStudentsFailed'));
        setStudents([]);
      } finally {
        setLoadingStudents(false);
      }
    },
    [t]
  );

  const loadTodaysAchievements = useCallback(
    async (halaqahId: string, date: string) => {
      try {
        const res: any = await apiClient.get('/memorizations/today', {
          halaqahId,
          date,
        });
        setTodaysAchievements(Array.isArray(res) ? res : res?.data || []);
      } catch (err) {
        console.error('Load achievements error:', err);
        setTodaysAchievements([]);
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedHalaqah) return;
    const id = selectedHalaqah._id || selectedHalaqah.id || '';
    if (!id) return;
    loadStudents(id);
    loadTodaysAchievements(id, selectedDate);
  }, [selectedHalaqah, selectedDate, loadStudents, loadTodaysAchievements]);

  const onRefresh = async () => {
    if (!selectedHalaqah) return;
    setRefreshing(true);
    const id = selectedHalaqah._id || selectedHalaqah.id || '';
    await Promise.all([loadStudents(id), loadTodaysAchievements(id, selectedDate)]);
    setRefreshing(false);
  };

  // ============================================================
  // FILTER
  // ============================================================
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return students;
    const q = searchTerm.toLowerCase();
    return students.filter((s) => s.name?.toLowerCase().includes(q));
  }, [students, searchTerm]);

  const getTodayCount = (studentId: string) => {
    const target = new Date(selectedDate);
    target.setHours(0, 0, 0, 0);
    return todaysAchievements.filter((a) => {
      const sid =
        typeof a.studentId === 'object' ? a.studentId?._id : a.studentId;
      if (String(sid) !== String(studentId)) return false;
      const d = new Date(a.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === target.getTime();
    }).length;
  };

  // ============================================================
  // OPEN ADD MODAL
  // ============================================================
  const openAdd = (student: Student) => {
    // Prefill from last achievement of today (continue where they left off)
    const last = todaysAchievements
      .filter((a) => {
        const sid = typeof a.studentId === 'object' ? a.studentId?._id : a.studentId;
        return String(sid) === String(student._id);
      })
      .sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];

    const base = {
      type: 'memorization',
      rangeType: 'surah' as 'surah' | 'juz',
      fromSurah: 1,
      fromAyah: 1,
      toSurah: 1,
      toAyah: 1,
      fromJuz: 1,
      fromQuarter: 1,
      toJuz: 1,
      toQuarter: 8,
      bookId: '',
      bookName: '',
      fromBookPage: '',
      toBookPage: '',
      score: '8',
      attempt: '1',
      comment: '',
      topic: '',
      customTopic: '',
    };

    if (last) {
      base.type = last.type || 'memorization';
      base.rangeType = (last.rangeType as 'surah' | 'juz') || 'surah';
      base.fromSurah = last.toSurah || 1;
      base.fromAyah = last.toAyah || 1;
      base.toSurah = last.toSurah || 1;
      base.toAyah = Math.min(
        (last.toAyah || 1) + 1,
        getMaxAyah(last.toSurah || 1)
      );
      base.fromJuz = last.fromJuz || 1;
      base.fromQuarter = last.fromQuarter || 1;
      base.toJuz = last.toJuz || 1;
      base.toQuarter = last.toQuarter || 8;
      base.bookId = (last as any).bookId || '';
      base.bookName = last.bookName || '';
      base.score = String(last.score || 8);
      base.attempt = String((last.attempt || 0) + 1);
      base.topic = last.topic || '';
    }

    setAchForm(base);
    setAddModal({ visible: true, student });
  };

  // ============================================================
  // OPEN VIEW MODAL
  // ============================================================
  const openView = async (student: Student) => {
    try {
      const res: any = await apiClient.get(
        `/student/${student._id}/memorizations`,
        { date: selectedDate }
      );
      const list: Achievement[] = Array.isArray(res) ? res : res?.data || [];
      setViewModal({ visible: true, student, achievements: list });
    } catch (err) {
      setViewModal({ visible: true, student, achievements: [] });
    }
  };

  // ============================================================
  // SAVE ACHIEVEMENT
  // ============================================================
  const handleSave = async () => {
    if (!addModal.student) return;
    const branchId = currentBranch?._id;
    if (!branchId) {
      Alert.alert(
        t('teacher.memorization.alerts.selectBranch'),
        t('teacher.memorization.alerts.selectBranch')
      );
      return;
    }

    setSaving(true);
    try {
      const data: any = {
        studentId: addModal.student._id,
        studentName: addModal.student.name,
        halaqahId: selectedHalaqah?._id || selectedHalaqah?.id,
        halaqahName: selectedHalaqah?.name,
        date: selectedDate,
        type: achForm.type,
        score: +achForm.score || 8,
        attempt: +achForm.attempt || 1,
        comment: achForm.comment || '',
        branchId,
        teacher: (user as any)?.name || 'Teacher',
        recordedBy: (user as any)?._id,
        recordedByName: (user as any)?.name || 'Teacher',
      };

      if (achForm.type === 'tashiih' || achForm.type === 'reading_writing') {
        let topicValue = achForm.topic || '';
        if (topicValue === 'Other') topicValue = achForm.customTopic || 'Other';
        data.topic = topicValue;
        delete data.attempt;
      } else if (achForm.type === 'book_review') {
        if (achForm.bookId) data.bookId = achForm.bookId;
        const book = books.find((b) => b._id === achForm.bookId);
        data.bookName = book?.name || achForm.bookName;
        data.bookType = book?.bookType || 'pages';
        data.fromBookPage = +achForm.fromBookPage || 0;
        data.toBookPage = +achForm.toBookPage || 0;
      } else {
        data.rangeType = achForm.rangeType;
        if (achForm.rangeType === 'surah') {
          data.fromSurah = +achForm.fromSurah;
          data.fromAyah = +achForm.fromAyah;
          data.toSurah = +achForm.toSurah;
          data.toAyah = +achForm.toAyah;
        } else {
          data.fromJuz = +achForm.fromJuz;
          data.fromQuarter = +achForm.fromQuarter;
          data.toJuz = +achForm.toJuz;
          data.toQuarter = +achForm.toQuarter;
        }
      }

      // -------- OFFLINE PATH --------
      if (!isOnline) {
        await enqueue('memorization', branchId, data);
        setAddModal({ visible: false, student: null });
        if (selectedHalaqah) {
          const id = selectedHalaqah._id || selectedHalaqah.id || '';
          await loadStudents(id);
          await loadTodaysAchievements(id, selectedDate);
        }
        Alert.alert(
          t('teacher.memorization.actions.save'),
          'Saved offline — will sync automatically'
        );
        return;
      }

      // -------- ONLINE PATH --------
      try {
        await apiClient.post('/memorizations', data);
        setAddModal({ visible: false, student: null });
        if (selectedHalaqah) {
          const id = selectedHalaqah._id || selectedHalaqah.id || '';
          await loadStudents(id);
          await loadTodaysAchievements(id, selectedDate);
        }
        Alert.alert(
          t('teacher.memorization.actions.save'),
          t('teacher.memorization.alerts.saveSuccess')
        );
      } catch (err: any) {
        // Weak signal / timeout / server error → queue silently
        try {
          await enqueue('memorization', branchId, data);
          setAddModal({ visible: false, student: null });
          if (selectedHalaqah) {
            const id = selectedHalaqah._id || selectedHalaqah.id || '';
            await loadStudents(id);
            await loadTodaysAchievements(id, selectedDate);
          }
          Alert.alert(
            t('teacher.memorization.actions.save'),
            'Saved offline — will sync automatically'
          );
        } catch (e: any) {
          Alert.alert(
            t('teacher.memorization.actions.save'),
            err?.message || t('teacher.memorization.alerts.saveFailed')
          );
        }
      }
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // RANGE DISPLAY (for view modal)
  // ============================================================
  const getRangeDisplay = (a: Achievement): string => {
    if (a.type === 'tashiih' || a.type === 'reading_writing') {
      return a.topic || a.type;
    }
    if (a.type === 'book_review') {
      const unit =
        a.bookType === 'lines'
          ? t('teacher.memorization.addModal.bookLines')
          : a.bookType === 'verses'
          ? t('teacher.memorization.addModal.bookVerses')
          : t('teacher.memorization.addModal.bookPages');
      return `${a.bookName || 'Book'} (${unit} ${a.fromBookPage || '-'}-${a.toBookPage || '-'})`;
    }
    if (a.rangeType === 'juz') {
      const fromName = JUZ_NAMES[a.fromJuz || 1]?.name || `Juz ${a.fromJuz}`;
      const toName = JUZ_NAMES[a.toJuz || 1]?.name || `Juz ${a.toJuz}`;
      return `${fromName} (${a.fromQuarter || 1}/8) → ${toName} (${a.toQuarter || 8}/8)`;
    }
    if (a.fromSurah === a.toSurah) {
      return `${getSurahName(a.fromSurah || 1)} (${a.fromAyah || '-'}-${a.toAyah || '-'})`;
    }
    return `${getSurahName(a.fromSurah || 1)}:${a.fromAyah} → ${getSurahName(a.toSurah || 1)}:${a.toAyah}`;
  };

  const getTypeLabel = (value: string) => {
    const found = achievementTypes.find((t) => t.value === value);
    if (found?.labelKey) return t(found.labelKey);
    return value;
  };

  const getTypeColor = (value: string) => {
    const found = achievementTypes.find((t) => t.value === value);
    return found
      ? { color: found.color, bg: found.bg }
      : { color: COLORS.blue, bg: COLORS.blueLight };
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('teacher.memorization.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (teacherHalaqahs.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.noHalaqahWrap}>
          <View style={styles.noHalaqahIcon}>
            <Ionicons name="people-outline" size={48} color={COLORS.amber} />
          </View>
          <Text style={styles.noHalaqahTitle}>
            {t('teacher.memorization.noHalaqahTitle')}
          </Text>
          <Text style={styles.noHalaqahText}>
            {t('teacher.memorization.noHalaqahText')}
          </Text>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => {
              setInitialLoading(true);
              loadInitial();
            }}
          >
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.refreshBtnText}>
              {t('teacher.memorization.refresh')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.headerTitle}>
            {t('teacher.memorization.title')}
          </Text>
          <Text style={styles.headerSubtitle}>
            {t('teacher.memorization.teacherLabel', {
              name: (user as any)?.name || user?.username || '',
            })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.viewToggle}
          onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
        >
          <Ionicons
            name={viewMode === 'grid' ? 'list' : 'grid'}
            size={18}
            color={COLORS.slate}
          />
        </TouchableOpacity>
      </View>

      {/* CONTROLS */}
      <View style={styles.controlsBlock}>
        <View style={styles.controlRow}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.slateMuted} />
          <TextInput
            style={styles.dateInput}
            value={selectedDate}
            onChangeText={setSelectedDate}
            placeholder={t('teacher.memorization.datePlaceholder')}
            placeholderTextColor="#A0AAA5"
          />
        </View>

        {teacherHalaqahs.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 44 }}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {teacherHalaqahs.map((h) => {
              const id = h._id || h.id || '';
              const active = (selectedHalaqah?._id || selectedHalaqah?.id) === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.halaqahChip, active && styles.halaqahChipActive]}
                  onPress={() => setSelectedHalaqah(h)}
                >
                  <Text
                    style={[
                      styles.halaqahChipText,
                      active && styles.halaqahChipTextActive,
                    ]}
                  >
                    {h.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('teacher.memorization.search')}
            placeholderTextColor="#A0AAA5"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.gray} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ERROR */}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* STUDENT COUNT */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {selectedHalaqah
            ? t('teacher.memorization.studentsOf', {
                name: selectedHalaqah.name,
                count: filteredStudents.length,
              })
            : t('teacher.memorization.selectHalaqahPrompt')}
        </Text>
      </View>

      {/* LIST */}
      {loadingStudents && students.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('teacher.memorization.loading')}
          </Text>
        </View>
      ) : viewMode === 'grid' ? (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item._id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.gridCard}>
              <View style={styles.gridAvatarWrap}>
                <View style={styles.gridAvatar}>
                  <Text style={styles.gridAvatarText}>
                    {getInitials(item.name)}
                  </Text>
                </View>
              </View>
              <Text style={styles.gridName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.gridMeta} numberOfLines={1}>
                {selectedHalaqah?.name || ''}
              </Text>

              <View style={styles.gridCountBox}>
                <Text style={styles.gridCountValue}>{getTodayCount(item._id)}</Text>
                <Text style={styles.gridCountLabel}>
                  {t('teacher.memorization.todayCount', { count: getTodayCount(item._id) })}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.gridAddBtn}
                onPress={() => openAdd(item)}
              >
                <Ionicons name="add" size={14} color="#fff" />
                <Text style={styles.gridAddBtnText}>
                  {t('teacher.memorization.actions.addAchievement')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gridViewBtn}
                onPress={() => openView(item)}
              >
                <Ionicons name="eye-outline" size={14} color={COLORS.blue} />
                <Text style={styles.gridViewBtnText}>
                  {t('teacher.memorization.actions.view')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>
                {t('teacher.memorization.studentsCount', { count: 0 })}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.listCard}>
              <View style={styles.listAvatar}>
                <Text style={styles.listAvatarText}>
                  {getInitials(item.name)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.listMeta} numberOfLines={1}>
                  {selectedHalaqah?.name || ''} ·{' '}
                  {t('teacher.memorization.todayCount', {
                    count: getTodayCount(item._id),
                  })}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.listBtnPrimary}
                onPress={() => openAdd(item)}
              >
                <Text style={styles.listBtnPrimaryText}>
                  {t('teacher.memorization.actions.add')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.listBtnOutline}
                onPress={() => openView(item)}
              >
                <Text style={styles.listBtnOutlineText}>
                  {t('teacher.memorization.actions.view')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>
                {t('teacher.memorization.studentsCount', { count: 0 })}
              </Text>
            </View>
          }
        />
      )}

      {/* ============ ADD ACHIEVEMENT MODAL ============ */}
      <Modal
        visible={addModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => !saving && setAddModal({ visible: false, student: null })}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {t('teacher.memorization.addModal.title')}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {addModal.student?.name} · {selectedDate}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => !saving && setAddModal({ visible: false, student: null })}
                disabled={saving}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* TYPE CHIPS */}
              <Text style={styles.formLabel}>
                {t('teacher.memorization.addModal.achievementType')}
              </Text>
              <View style={styles.chipRow}>
                {achievementTypes.map((type: any) => {
                  const active = achForm.type === type.value;
                  const label = type.labelKey ? t(type.labelKey) : type.label || type.value;
                  return (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.typeChip,
                        active && {
                          backgroundColor: type.bg,
                          borderColor: type.color,
                        },
                      ]}
                      onPress={() =>
                        setAchForm((prev) => ({ ...prev, type: type.value }))
                      }
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          active && { color: type.color, fontWeight: '800' },
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* TASHIIH TOPIC */}
              {achForm.type === 'tashiih' && (
                <>
                  <Text style={styles.formLabel}>
                    {t('teacher.memorization.addModal.topic')}
                  </Text>
                  <View style={styles.chipRow}>
                    {TASHIIH_TOPICS.map((tp) => {
                      const active = achForm.topic === tp;
                      return (
                        <TouchableOpacity
                          key={tp}
                          style={[
                            styles.topicChip,
                            active && styles.topicChipActive,
                          ]}
                          onPress={() =>
                            setAchForm((prev) => ({ ...prev, topic: tp }))
                          }
                        >
                          <Text
                            style={[
                              styles.topicChipText,
                              active && styles.topicChipTextActive,
                            ]}
                          >
                            {tp}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {achForm.topic === 'Other' && (
                    <TextInput
                      style={[styles.formInput, { marginTop: 8 }]}
                      value={achForm.customTopic}
                      onChangeText={(v) =>
                        setAchForm((prev) => ({ ...prev, customTopic: v }))
                      }
                      placeholder={t('teacher.memorization.addModal.enterCustomTopic')}
                      placeholderTextColor="#A0AAA5"
                    />
                  )}
                </>
              )}

              {/* READING & WRITING TOPIC */}
              {achForm.type === 'reading_writing' && (
                <>
                  <Text style={styles.formLabel}>
                    {t('teacher.memorization.addModal.topic')}
                  </Text>
                  <View style={styles.chipRow}>
                    {READING_WRITING_TOPICS.map((tp) => {
                      const active = achForm.topic === tp;
                      return (
                        <TouchableOpacity
                          key={tp}
                          style={[
                            styles.topicChip,
                            active && styles.topicChipActive,
                          ]}
                          onPress={() =>
                            setAchForm((prev) => ({ ...prev, topic: tp }))
                          }
                        >
                          <Text
                            style={[
                              styles.topicChipText,
                              active && styles.topicChipTextActive,
                            ]}
                          >
                            {tp}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {achForm.topic === 'Other' && (
                    <TextInput
                      style={[styles.formInput, { marginTop: 8 }]}
                      value={achForm.customTopic}
                      onChangeText={(v) =>
                        setAchForm((prev) => ({ ...prev, customTopic: v }))
                      }
                      placeholder={t('teacher.memorization.addModal.enterCustomTopic')}
                      placeholderTextColor="#A0AAA5"
                    />
                  )}
                </>
              )}

              {/* RANGE TYPE (not for tashiih / reading_writing / book_review) */}
              {achForm.type !== 'tashiih' &&
                achForm.type !== 'reading_writing' &&
                achForm.type !== 'book_review' && (
                  <>
                    <Text style={styles.formLabel}>
                      {t('teacher.memorization.addModal.rangeType')}
                    </Text>
                    <View style={styles.chipRow}>
                      {(['surah', 'juz'] as const).map((rt) => {
                        const active = achForm.rangeType === rt;
                        return (
                          <TouchableOpacity
                            key={rt}
                            style={[
                              styles.rangeChip,
                              active && styles.rangeChipActive,
                            ]}
                            onPress={() =>
                              setAchForm((prev) => ({ ...prev, rangeType: rt }))
                            }
                          >
                            <Text
                              style={[
                                styles.rangeChipText,
                                active && styles.rangeChipTextActive,
                              ]}
                            >
                              {rt === 'surah'
                                ? t('teacher.memorization.addModal.surah')
                                : t('teacher.memorization.addModal.juz')}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Surah range */}
                    {achForm.rangeType === 'surah' ? (
                      <>
                        <Text style={styles.formLabel}>
                          {t('teacher.memorization.addModal.from')}
                        </Text>
                        <View style={styles.twoCol}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.miniLabel}>
                              {t('teacher.memorization.addModal.fromSurah')}
                            </Text>
                            <TextInput
                              style={styles.formInput}
                              value={String(achForm.fromSurah)}
                              onChangeText={(v) => {
                                const n = Math.max(
                                  1,
                                  Math.min(114, parseInt(v, 10) || 1)
                                );
                                setAchForm((prev) => ({ ...prev, fromSurah: n }));
                              }}
                              keyboardType="numeric"
                            />
                            <Text style={styles.formHint} numberOfLines={1}>
                              {getSurahName(achForm.fromSurah)}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.miniLabel}>
                              {t('teacher.memorization.addModal.fromAyah')}
                            </Text>
                            <TextInput
                              style={styles.formInput}
                              value={String(achForm.fromAyah)}
                              onChangeText={(v) => {
                                const max = getMaxAyah(achForm.fromSurah);
                                const n = Math.max(
                                  1,
                                  Math.min(max, parseInt(v, 10) || 1)
                                );
                                setAchForm((prev) => ({ ...prev, fromAyah: n }));
                              }}
                              keyboardType="numeric"
                            />
                            <Text style={styles.formHint}>
                              max {getMaxAyah(achForm.fromSurah)}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.formLabel}>
                          {t('teacher.memorization.addModal.to')}
                        </Text>
                        <View style={styles.twoCol}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.miniLabel}>
                              {t('teacher.memorization.addModal.toSurah')}
                            </Text>
                            <TextInput
                              style={styles.formInput}
                              value={String(achForm.toSurah)}
                              onChangeText={(v) => {
                                const n = Math.max(
                                  1,
                                  Math.min(114, parseInt(v, 10) || 1)
                                );
                                setAchForm((prev) => ({ ...prev, toSurah: n }));
                              }}
                              keyboardType="numeric"
                            />
                            <Text style={styles.formHint} numberOfLines={1}>
                              {getSurahName(achForm.toSurah)}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.miniLabel}>
                              {t('teacher.memorization.addModal.toAyah')}
                            </Text>
                            <TextInput
                              style={styles.formInput}
                              value={String(achForm.toAyah)}
                              onChangeText={(v) => {
                                const max = getMaxAyah(achForm.toSurah);
                                const n = Math.max(
                                  1,
                                  Math.min(max, parseInt(v, 10) || 1)
                                );
                                setAchForm((prev) => ({ ...prev, toAyah: n }));
                              }}
                              keyboardType="numeric"
                            />
                            <Text style={styles.formHint}>
                              max {getMaxAyah(achForm.toSurah)}
                            </Text>
                          </View>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.formLabel}>
                          {t('teacher.memorization.addModal.from')}
                        </Text>
                        <View style={styles.twoCol}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.miniLabel}>
                              {t('teacher.memorization.addModal.fromJuz')}
                            </Text>
                            <TextInput
                              style={styles.formInput}
                              value={String(achForm.fromJuz)}
                              onChangeText={(v) => {
                                const n = Math.max(
                                  1,
                                  Math.min(30, parseInt(v, 10) || 1)
                                );
                                setAchForm((prev) => ({ ...prev, fromJuz: n }));
                              }}
                              keyboardType="numeric"
                            />
                            <Text style={styles.formHint}>
                              {getJuzArabic(achForm.fromJuz)}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.miniLabel}>
                              {t('teacher.memorization.addModal.fromQuarter')}
                            </Text>
                            <TextInput
                              style={styles.formInput}
                              value={String(achForm.fromQuarter)}
                              onChangeText={(v) => {
                                const n = Math.max(
                                  1,
                                  Math.min(8, parseInt(v, 10) || 1)
                                );
                                setAchForm((prev) => ({ ...prev, fromQuarter: n }));
                              }}
                              keyboardType="numeric"
                            />
                          </View>
                        </View>

                        <Text style={styles.formLabel}>
                          {t('teacher.memorization.addModal.to')}
                        </Text>
                        <View style={styles.twoCol}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.miniLabel}>
                              {t('teacher.memorization.addModal.toJuz')}
                            </Text>
                            <TextInput
                              style={styles.formInput}
                              value={String(achForm.toJuz)}
                              onChangeText={(v) => {
                                const n = Math.max(
                                  1,
                                  Math.min(30, parseInt(v, 10) || 1)
                                );
                                setAchForm((prev) => ({ ...prev, toJuz: n }));
                              }}
                              keyboardType="numeric"
                            />
                            <Text style={styles.formHint}>
                              {getJuzArabic(achForm.toJuz)}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.miniLabel}>
                              {t('teacher.memorization.addModal.toQuarter')}
                            </Text>
                            <TextInput
                              style={styles.formInput}
                              value={String(achForm.toQuarter)}
                              onChangeText={(v) => {
                                const n = Math.max(
                                  1,
                                  Math.min(8, parseInt(v, 10) || 1)
                                );
                                setAchForm((prev) => ({ ...prev, toQuarter: n }));
                              }}
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                      </>
                    )}
                  </>
                )}

              {/* BOOK REVIEW */}
              {achForm.type === 'book_review' && (
                <>
                  <Text style={styles.formLabel}>
                    {t('teacher.memorization.addModal.book')}
                  </Text>
                  <View style={styles.chipRow}>
                    {books.length === 0 ? (
                      <Text style={styles.formHint}>
                        {t('teacher.memorization.addModal.select')} —
                        no books
                      </Text>
                    ) : (
                      books.map((b) => {
                        const active = achForm.bookId === b._id;
                        return (
                          <TouchableOpacity
                            key={b._id}
                            style={[
                              styles.topicChip,
                              active && styles.topicChipActive,
                            ]}
                            onPress={() =>
                              setAchForm((prev) => ({
                                ...prev,
                                bookId: b._id,
                                bookName: b.name,
                              }))
                            }
                          >
                            <Text
                              style={[
                                styles.topicChipText,
                                active && styles.topicChipTextActive,
                              ]}
                            >
                              {b.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>

                  <Text style={styles.formLabel}>
                    {t('teacher.memorization.addModal.from')}
                  </Text>
                  <View style={styles.twoCol}>
                    <TextInput
                      style={styles.formInput}
                      value={achForm.fromBookPage}
                      onChangeText={(v) =>
                        setAchForm((prev) => ({
                          ...prev,
                          fromBookPage: v.replace(/[^0-9]/g, ''),
                        }))
                      }
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#A0AAA5"
                    />
                    <TextInput
                      style={styles.formInput}
                      value={achForm.toBookPage}
                      onChangeText={(v) =>
                        setAchForm((prev) => ({
                          ...prev,
                          toBookPage: v.replace(/[^0-9]/g, ''),
                        }))
                      }
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#A0AAA5"
                    />
                  </View>
                </>
              )}

              {/* ATTEMPT */}
              {achForm.type !== 'tashiih' &&
                achForm.type !== 'reading_writing' && (
                  <>
                    <Text style={styles.formLabel}>
                      {t('teacher.memorization.addModal.attempt')}
                    </Text>
                    <View style={styles.chipRow}>
                      {['1', '2', '3', '4', '5'].map((a) => {
                        const active = achForm.attempt === a;
                        return (
                          <TouchableOpacity
                            key={a}
                            style={[
                              styles.attemptChip,
                              active && styles.attemptChipActive,
                            ]}
                            onPress={() =>
                              setAchForm((prev) => ({ ...prev, attempt: a }))
                            }
                          >
                            <Text
                              style={[
                                styles.attemptChipText,
                                active && styles.attemptChipTextActive,
                              ]}
                            >
                              {a}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}

              {/* SCORE */}
              <Text style={styles.formLabel}>
                {t('teacher.memorization.addModal.score')}
              </Text>
              <View style={styles.chipRow}>
                {['4', '5', '6', '7', '8', '9', '10'].map((s) => {
                  const active = achForm.score === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.attemptChip,
                        active && styles.attemptChipActive,
                      ]}
                      onPress={() =>
                        setAchForm((prev) => ({ ...prev, score: s }))
                      }
                    >
                      <Text
                        style={[
                          styles.attemptChipText,
                          active && styles.attemptChipTextActive,
                        ]}
                      >
                        {s}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* COMMENT */}
              <Text style={styles.formLabel}>
                {t('teacher.memorization.addModal.comment')}
              </Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={achForm.comment}
                onChangeText={(v) =>
                  setAchForm((prev) => ({ ...prev, comment: v }))
                }
                placeholder={t('teacher.memorization.addModal.commentPlaceholder')}
                placeholderTextColor="#A0AAA5"
                multiline
                numberOfLines={3}
              />

              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => !saving && setAddModal({ visible: false, student: null })}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>
                  {t('teacher.memorization.actions.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.submitBtnText}>
                      {t('teacher.memorization.actions.save')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============ VIEW ACHIEVEMENTS MODAL ============ */}
      <Modal
        visible={viewModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setViewModal({ visible: false, student: null, achievements: [] })
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {t('teacher.memorization.viewModal.title', {
                    name: viewModal.student?.name || '',
                  })}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() =>
                  setViewModal({ visible: false, student: null, achievements: [] })
                }
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              {viewModal.achievements.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="book-outline" size={56} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>
                    {t('teacher.memorization.viewModal.noAchievements')}
                  </Text>
                  <Text style={styles.emptyText}>
                    {t('teacher.memorization.viewModal.noAchievementsHint')}
                  </Text>
                </View>
              ) : (
                viewModal.achievements.map((a) => {
                  const typeInfo = getTypeColor(a.type);
                  return (
                    <View key={a._id} style={styles.achCard}>
                      <View
                        style={[
                          styles.achTag,
                          { backgroundColor: typeInfo.bg },
                        ]}
                      >
                        <Text
                          style={[styles.achTagText, { color: typeInfo.color }]}
                        >
                          {getTypeLabel(a.type)}
                        </Text>
                        {a.isBulk && (
                          <Text style={styles.achBulk}>
                            · {t('teacher.memorization.viewModal.bulk')}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.achRange}>{getRangeDisplay(a)}</Text>
                      <View style={styles.achMetaRow}>
                        <Text style={styles.achMeta}>
                          {t('teacher.memorization.viewModal.score')}:{' '}
                          {a.score}/{a.type === 'subac' ? a.totalMarks || 100 : 10}
                        </Text>
                        <Text style={styles.achMeta}>
                          {t('teacher.memorization.viewModal.date')}:{' '}
                          {new Date(a.date).toLocaleDateString()}
                        </Text>
                      </View>
                      {a.comment ? (
                        <Text style={styles.achComment} numberOfLines={2}>
                          "{a.comment}"
                        </Text>
                      ) : null}
                    </View>
                  );
                })
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default TeacherMemorizationScreen;

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // LOADING / NO HALAQA
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.slateMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  noHalaqahWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  noHalaqahIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.amberLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noHalaqahTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.slate,
    textAlign: 'center',
  },
  noHalaqahText: {
    fontSize: 13,
    color: COLORS.slateMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  refreshBtn: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  refreshBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // HEADER
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
  viewToggle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // CONTROLS
  controlsBlock: { paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  dateInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.slate,
    paddingVertical: 0,
  },
  halaqahChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  halaqahChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  halaqahChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },
  halaqahChipTextActive: { color: COLORS.primary },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.slate },

  // ERROR
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: COLORS.redLight,
    borderWidth: 1,
    borderColor: '#F6C8C8',
    borderRadius: 12,
  },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.red },

  // COUNT
  countRow: { paddingHorizontal: 16, paddingBottom: 6 },
  countText: { fontSize: 12, color: COLORS.slateMuted, fontWeight: '600' },

  // LIST
  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },

  // GRID CARD
  gridCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  gridAvatarWrap: { marginBottom: 8 },
  gridAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridAvatarText: { fontSize: 18, fontWeight: '800', color: COLORS.blue },
  gridName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate,
    textAlign: 'center',
  },
  gridMeta: {
    fontSize: 11,
    color: COLORS.slateMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  gridCountBox: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  gridCountValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  gridCountLabel: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  gridAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 8,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  gridAddBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  gridViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 10,
    paddingVertical: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.blue,
    alignSelf: 'stretch',
  },
  gridViewBtnText: { color: COLORS.blue, fontSize: 11, fontWeight: '700' },

  // LIST CARD
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  listAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listAvatarText: { fontSize: 15, fontWeight: '800', color: COLORS.blue },
  listName: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  listMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  listBtnPrimary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  listBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  listBtnOutline: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.blue,
  },
  listBtnOutlineText: { color: COLORS.blue, fontWeight: '700', fontSize: 12 },

  // EMPTY
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.slate,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.slateMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
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
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  modalSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { paddingHorizontal: 20, paddingTop: 12 },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // FORM
  formLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  miniLabel: {
    fontSize: 10,
    color: COLORS.slateMuted,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  formInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.slate,
    backgroundColor: COLORS.white,
  },
  formHint: {
    fontSize: 10,
    color: COLORS.gray,
    marginTop: 4,
    fontStyle: 'italic',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },

  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  typeChipText: { fontSize: 11, fontWeight: '700', color: COLORS.slateMuted },

  topicChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  topicChipActive: {
    backgroundColor: COLORS.tealLight,
    borderColor: COLORS.teal,
  },
  topicChipText: { fontSize: 11, fontWeight: '700', color: COLORS.slateMuted },
  topicChipTextActive: { color: COLORS.teal },

  rangeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  rangeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  rangeChipText: { fontSize: 12, fontWeight: '700', color: COLORS.slateMuted },
  rangeChipTextActive: { color: '#fff' },

  attemptChip: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attemptChipActive: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  attemptChipText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slateMuted,
  },
  attemptChipTextActive: { color: '#fff' },

  // ACHIEVEMENT CARD (VIEW MODAL)
  achCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  achTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  achTagText: { fontSize: 11, fontWeight: '800' },
  achBulk: { fontSize: 10, fontWeight: '600', marginLeft: 4, opacity: 0.8 },
  achRange: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate,
    marginBottom: 6,
  },
  achMetaRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  achMeta: { fontSize: 12, color: COLORS.slateMuted, fontWeight: '600' },
  achComment: {
    fontSize: 12,
    color: COLORS.gray,
    fontStyle: 'italic',
    marginTop: 8,
  },
});

//const { isOnline } = useNetworkStatus()