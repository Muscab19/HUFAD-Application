// src/screens/admin/ReportsScreen.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api as apiClient } from '../../api/client';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';

// ============================================================
// BRAND COLORS
// ============================================================
const COLORS = {
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
const EP = {
  students: '/students',
  studentReport: (id: string) => `/reports/student/${id}`,
  monthlyPerformance: (id: string) => `/reports/student/${id}/monthly-performance`,
};

// ============================================================
// TYPES
// ============================================================
interface HalaqahRef {
  _id?: string;
  name?: string;
}

interface Student {
  _id: string;
  name: string;
  regNo?: string;
  halaqah?: HalaqahRef | string;
  class?: string;
  gender?: 'Male' | 'Female';
  parent?: { name?: string; phone?: string };
  profilePicture?: string;
  enrollmentDate?: string;
}

interface AttendanceSession {
  slotNumber: number;
  name?: string;
  startTime?: string;
  endTime?: string;
  daily: { date: string; status: string; comments?: string }[];
}

interface MemorizationRecord {
  _id?: string;
  date: string;
  type: string;
  score: number;
  totalMarks?: number;
  attempt?: number;
  comment?: string;
  fromSurah?: number;
  toSurah?: number;
  fromAyah?: number;
  toAyah?: number;
  fromJuz?: number;
  toJuz?: number;
  topic?: string;
  bookName?: string;
}

interface ExamQuestion {
  fathi?: number;
  lahni?: number;
  tajwid?: number;
  ruju?: number;
  performance?: number;
  page?: number | string;
  customColumns?: Record<string, number>;
}

interface Exam {
  _id?: string;
  date: string;
  type?: string;
  formType?: string;
  score?: number;
  total?: number;
  totalMarks?: number;
  obtainedMarks?: number;
  percentage?: number;
  status?: string;
  passingMark?: number;
  isPublished?: boolean;
  halaqah?: string;
  studentName?: string;
  fromSurah?: number;
  toSurah?: number;
  fromJuz?: number;
  toJuz?: number;
  questions?: ExamQuestion[];
  marksPer?: { fathi: number; lahni: number; tajwid: number; ruju: number };
  settings?: { columns?: any[] };
  examiners?: string[];
  examiner?: string;
  notes?: { positive?: string; negative?: string } | string;
}

interface BehaviorRecord {
  _id?: string;
  date: string;
  type: 'good' | 'bad';
  description: string;
  category?: string;
  severity?: string;
  recordedBy?: string;
  points: number;
}

interface FinanceData {
  summary?: {
    totalDue?: number;
    totalPaid?: number;
    balance?: number;
    status?: string;
  };
  breakdown?: {
    _id?: string;
    date: string;
    description: string;
    amount: number;
    dueDate?: string;
    status?: string;
  }[];
  payments?: {
    _id?: string;
    date: string;
    amount: number;
    method?: string;
    reference?: string;
    notes?: string;
  }[];
}

interface ReportData {
  student?: Student;
  attendance?: {
    summary?: {
      total?: number;
      present?: number;
      absent?: number;
      late?: number;
      excused?: number;
    };
    sessions?: AttendanceSession[];
  };
  memorization?: {
    summary?: { total?: number; avgScore?: number; bestScore?: number };
    allRecords?: MemorizationRecord[];
    byType?: Record<string, MemorizationRecord[]>;
  };
  exams?: Exam[];
  behavior?: BehaviorRecord[];
  finance?: FinanceData;
}

interface MonthlyPerf {
  month: string;
  combined?: number;
  attendance?: number;
  memorization?: number;
  memorizationScore?: number;
  behavior?: number;
  behaviorScore?: number;
  totalDays?: number;
}

// ============================================================
// CONSTANTS + KEY MAPS
// ============================================================
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const ACHIEVEMENT_TYPES = [
  { value: 'memorization', labelKey: 'memorization', color: COLORS.blue, bg: COLORS.blueLight },
  { value: 'minor_review', labelKey: 'minorReview', color: COLORS.primary, bg: COLORS.primaryLight },
  { value: 'major_review', labelKey: 'majorReview', color: COLORS.purple, bg: COLORS.purpleLight },
  { value: 'ijazah', labelKey: 'ijazah', color: COLORS.gold, bg: COLORS.goldLight },
  { value: 'subac', labelKey: 'subac', color: COLORS.teal, bg: COLORS.tealLight },
  { value: 'book_review', labelKey: 'bookReview', color: '#DB2777', bg: '#FCE7F3' },
  { value: 'tashiih', labelKey: 'tashiih', color: COLORS.amber, bg: COLORS.amberLight },
];

const TAB_KEYS = [
  { key: 'overview', labelKey: 'overview', icon: 'stats-chart' as const },
  { key: 'attendance', labelKey: 'attendance', icon: 'calendar' as const },
  { key: 'memorization', labelKey: 'memorization', icon: 'book' as const },
  { key: 'exams', labelKey: 'exams', icon: 'trophy' as const },
  { key: 'behavior', labelKey: 'behavior', icon: 'heart' as const },
  { key: 'finance', labelKey: 'finance', icon: 'cash' as const },
];

const STATUS_KEY: Record<string, string> = {
  Present: 'present',
  Absent: 'absent',
  Late: 'late',
  Excused: 'excused',
  Pass: 'pass',
  Fail: 'fail',
  Paid: 'paid',
  Partial: 'partial',
  Unpaid: 'unpaid',
};

// ============================================================
// HELPERS
// ============================================================
const unwrap = (res: any): any => {
  if (res && typeof res === 'object' && 'data' in res) return res.data;
  return res;
};

const unwrapData = (res: any): any => {
  const u = unwrap(res);
  if (u && typeof u === 'object' && 'data' in u) return u.data;
  return u;
};

const asArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);

const getCurrentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getSafeDate = (dateStr?: string): Date => {
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

const formatShortDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = getSafeDate(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
};

const getMonthLabel = (monthStr: string) => {
  const d = getSafeDate(monthStr);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};

const getDaysInMonth = (monthStr: string) => {
  const [y, m] = monthStr.split('-').map(Number);
  if (isNaN(y) || isNaN(m)) return [];
  const total = new Date(y, m, 0).getDate();
  return Array.from(
    { length: total },
    (_, i) => `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
  );
};

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'Present':
    case 'Pass':
    case 'Paid':
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

const getHalaqahName = (h?: HalaqahRef | string) => {
  if (!h) return '-';
  if (typeof h === 'string') return h;
  return h.name || '-';
};

const initials = (name?: string) => {
  const s = (name || '').trim();
  if (!s) return '?';
  const parts = s.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.substring(0, 2).toUpperCase();
};

const formatRange = (r: MemorizationRecord): string => {
  if (r.type === 'tashiih') return r.topic || 'Tashiih';
  if (r.type === 'book_review') return r.bookName || 'Book';
  if (r.fromJuz)
    return `Juz ${r.fromJuz}${
      r.toJuz && r.toJuz !== r.fromJuz ? `-${r.toJuz}` : ''
    }`;
  if (r.fromSurah) {
    if (r.fromSurah === r.toSurah)
      return `Surah ${r.fromSurah}:${r.fromAyah || '-'}-${r.toAyah || '-'}`;
    return `Surah ${r.fromSurah}:${r.fromAyah || '-'} → ${r.toSurah}:${
      r.toAyah || '-'
    }`;
  }
  return r.topic || r.bookName || '-';
};

// ============================================================
// SMALL COMPONENTS
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
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  </View>
);

const Badge: React.FC<{ status?: string }> = ({ status }) => {
  const { t } = useTranslation();
  if (!status) return null;
  const c = getStatusColor(status);
  const key = STATUS_KEY[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>
        {key ? t(`reports.statusBadges.${key}`) : status}
      </Text>
    </View>
  );
};

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
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

// ============================================================
// MONTH PICKER MODAL
// ============================================================
const MonthPickerModal: React.FC<{
  visible: boolean;
  value: string;
  onClose: () => void;
  onChange: (m: string) => void;
}> = ({ visible, value, onClose, onChange }) => {
  const { t } = useTranslation();
  const parsed = getSafeDate(value);
  const [year, setYear] = useState(parsed.getFullYear());

  useEffect(() => {
    if (visible) setYear(getSafeDate(value).getFullYear());
  }, [value, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { maxHeight: '70%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {t('reports.monthPicker.title')}
            </Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.yearRow}>
              <TouchableOpacity
                style={styles.yearBtn}
                onPress={() => setYear((y) => y - 1)}
              >
                <Ionicons name="chevron-back" size={18} color={COLORS.slate} />
              </TouchableOpacity>
              <Text style={styles.yearText}>{year}</Text>
              <TouchableOpacity
                style={styles.yearBtn}
                onPress={() => setYear((y) => y + 1)}
              >
                <Ionicons name="chevron-forward" size={18} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            <View style={styles.monthGrid}>
              {MONTH_SHORT.map((m, idx) => {
                const isActive =
                  idx === parsed.getMonth() && year === parsed.getFullYear();
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.monthCell, isActive && styles.monthCellActive]}
                    onPress={() => {
                      onChange(`${year}-${String(idx + 1).padStart(2, '0')}`);
                      onClose();
                    }}
                  >
                    <Text
                      style={[
                        styles.monthCellText,
                        isActive && styles.monthCellTextActive,
                      ]}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// STUDENT SEARCH MODAL
// ============================================================
const StudentSearchModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSelect: (s: Student) => void;
}> = ({ visible, onClose, onSelect }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res: any = await apiClient.get(EP.students, {
          params: { search: query.trim(), limit: 20 },
        });
        const u = unwrapData(res);
        const list = Array.isArray(u) ? u : u?.students || [];
        if (!cancelled) setResults(list);
      } catch (err) {
        console.warn('Student search error:', err);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { maxHeight: '85%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {t('reports.studentSearch.title')}
            </Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainerInner}>
            <View style={styles.searchWrapper}>
              <Ionicons name="search-outline" size={18} color={COLORS.gray} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('reports.studentSearch.placeholder')}
                placeholderTextColor="#A0AAA5"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoFocus
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={18} color={COLORS.gray} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={{ flex: 1 }}>
            {loading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
            ) : query.trim().length < 2 ? (
              <Text style={styles.emptyText}>
                {t('reports.studentSearch.typeAtLeast')}
              </Text>
            ) : results.length === 0 ? (
              <Text style={styles.emptyText}>
                {t('reports.studentSearch.noStudents')}
              </Text>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item._id}
                contentContainerStyle={{ paddingBottom: 24 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.studentRow}
                    onPress={() => {
                      onSelect(item);
                      onClose();
                    }}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.studentName}>{item.name}</Text>
                      <Text style={styles.studentMeta}>
                        {item.regNo || t('reports.na')} •{' '}
                        {getHalaqahName(item.halaqah)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// EXAM DETAILS MODAL
// ============================================================
const ExamDetailsModal: React.FC<{
  visible: boolean;
  exam: Exam | null;
  student: Student | null;
  onClose: () => void;
}> = ({ visible, exam, student, onClose }) => {
  const { t } = useTranslation();
  if (!exam) return null;
  const pct = Math.round((exam.percentage || 0) * 10) / 10;
  const positiveNotes =
    typeof exam.notes === 'string' ? exam.notes : exam.notes?.positive || '';
  const negativeNotes =
    typeof exam.notes === 'object' ? exam.notes?.negative || '' : '';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {t('reports.examDetails.title')}
            </Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.modalProfile}>
              <View style={styles.modalAvatar}>
                <Text style={styles.modalAvatarText}>
                  {initials(student?.name || exam.studentName)}
                </Text>
              </View>
              <Text style={styles.modalName}>
                {student?.name || exam.studentName}
              </Text>
              <Text style={styles.modalEmail}>
                {exam.type || t('reports.exams.monthly')} •{' '}
                {formatShortDate(exam.date)}
              </Text>
            </View>

            <View style={styles.examScoreCard}>
              <Text style={styles.examScoreLabel}>
                {t('reports.examDetails.score')}
              </Text>
              <Text style={styles.examScoreValue}>
                {Math.round((exam.score || 0) * 10) / 10}/
                {exam.total || exam.totalMarks || 100}
              </Text>
              <Text style={styles.examScorePct}>{pct}%</Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(pct, 100)}%`,
                      backgroundColor:
                        pct >= (exam.passingMark || 60)
                          ? COLORS.primary
                          : COLORS.red,
                    },
                  ]}
                />
              </View>
            </View>

            {(exam.questions || []).length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.formLabel}>
                  {t('reports.examDetails.questionBreakdown')}
                </Text>
                {(exam.questions || []).map((q, idx) => {
                  const cols = exam.settings?.columns?.filter(
                    (c) => c.isVisible !== false
                  ) || [
                    { id: 'tajwid', key: 'tajwid', label: 'Tajwid' },
                    { id: 'lahni', key: 'lahni', label: 'Lahni' },
                    { id: 'fathi', key: 'fathi', label: 'Fathi' },
                    { id: 'performance', key: 'performance', label: 'Performance', isAdditive: true },
                  ];
                  return (
                    <View key={idx} style={styles.questionRow}>
                      <Text style={styles.questionIdx}>Q{idx + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={styles.questionCols}>
                          {cols.slice(0, 4).map((col: any) => {
                            const val =
                              q.customColumns?.[col.key] ?? (q as any)[col.key] ?? 0;
                            return (
                              <View key={col.id} style={styles.questionCol}>
                                <Text style={styles.questionColLabel}>
                                  {col.label}
                                </Text>
                                <Text
                                  style={[
                                    styles.questionColValue,
                                    {
                                      color:
                                        col.isAdditive === false
                                          ? COLORS.red
                                          : COLORS.primary,
                                    },
                                  ]}
                                >
                                  {col.isAdditive === false ? '-' : '+'}
                                  {val}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.notesGrid}>
              <View style={[styles.notesCard, { backgroundColor: COLORS.primaryLight }]}>
                <Text style={[styles.notesLabel, { color: COLORS.primary }]}>
                  {t('reports.examDetails.positiveNotes')}
                </Text>
                <Text style={styles.notesText}>
                  {positiveNotes || t('reports.examDetails.noPositiveNotes')}
                </Text>
              </View>
              <View style={[styles.notesCard, { backgroundColor: COLORS.amberLight }]}>
                <Text style={[styles.notesLabel, { color: COLORS.amber }]}>
                  {t('reports.examDetails.negativeNotes')}
                </Text>
                <Text style={styles.notesText}>
                  {negativeNotes || t('reports.examDetails.noNegativeNotes')}
                </Text>
              </View>
            </View>

            <InfoRow
              label={t('reports.examDetails.status')}
              value={
                exam.status
                  ? t(
                      `reports.statusBadges.${
                        STATUS_KEY[exam.status] || 'pass'
                      }`
                    )
                  : t('reports.statusBadges.pass')
              }
              icon="checkmark-circle-outline"
            />
            <InfoRow
              label={t('reports.examDetails.published')}
              value={
                exam.isPublished
                  ? t('reports.examDetails.yes')
                  : t('reports.examDetails.draft')
              }
              icon="cloud-upload-outline"
            />
            <InfoRow
              label={t('reports.examDetails.halaqah')}
              value={exam.halaqah || getHalaqahName(student?.halaqah)}
              icon="book-outline"
            />
            <InfoRow
              label={t('reports.examDetails.date')}
              value={formatShortDate(exam.date)}
              icon="calendar-outline"
            />
            {(exam.examiners || (exam.examiner ? [exam.examiner] : [])).length >
              0 && (
              <InfoRow
                label={t('reports.examDetails.committee')}
                value={(exam.examiners || [exam.examiner!]).join(', ')}
                icon="people-outline"
              />
            )}

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// MAIN SCREEN
// ============================================================
export const ReportsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { currentBranch } = useBranch();
  const { user } = useAuth();
  const branchId =
    (currentBranch as any)?._id ||
    (currentBranch as any)?.id ||
    (user as any)?.branchId ||
    '';

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [activeTab, setActiveTab] = useState('overview');
  const [memFilter, setMemFilter] = useState('all');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [monthlyPerf, setMonthlyPerf] = useState<MonthlyPerf[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [showStudentSearch, setShowStudentSearch] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  const flashError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };

  const fetchReport = useCallback(
    async (studentId: string, month: string, silent = false) => {
      if (!branchId) {
        setReportData(null);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const res: any = await apiClient.get(EP.studentReport(studentId), {
          params: { month },
        });
        const data = unwrapData(res);
        setReportData(data || null);
        setError('');
      } catch (err: any) {
        console.warn('Fetch student report error:', err);
        flashError(
          err?.response?.data?.message ||
            err?.message ||
            t('reports.loadFailed')
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
        const res: any = await apiClient.get(
          EP.monthlyPerformance(studentId),
          { params: { months: 12 } }
        );
        const data = unwrapData(res);
        setMonthlyPerf(
          asArray<MonthlyPerf>(Array.isArray(data) ? data : data?.data || [])
        );
      } catch (err) {
        console.warn('Fetch monthly performance error:', err);
        setMonthlyPerf([]);
      }
    },
    [branchId]
  );

  useEffect(() => {
    if (selectedStudent?._id && branchId) {
      fetchReport(selectedStudent._id, selectedMonth);
    } else {
      setReportData(null);
    }
  }, [selectedStudent, selectedMonth, branchId, fetchReport]);

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
    await fetchReport(selectedStudent._id, selectedMonth, true);
    setRefreshing(false);
  };

  const student = reportData?.student || selectedStudent;
  const attendance = reportData?.attendance;
  const memorization = reportData?.memorization;
  const exams = asArray<Exam>(reportData?.exams);
  const behavior = asArray<BehaviorRecord>(reportData?.behavior);
  const finance = reportData?.finance;

  const attendanceRate = attendance?.summary?.total
    ? Math.round(
        ((attendance.summary.present! + (attendance.summary.late || 0)) /
          attendance.summary.total) *
          100
      )
    : 0;

  const memStats = {
    total: memorization?.summary?.total ?? 0,
    avgScore: memorization?.summary?.avgScore ?? 0,
    bestScore: memorization?.summary?.bestScore ?? 0,
  };
  const examAvg = exams.length
    ? Math.round(
        exams.reduce((s, e) => s + (e.percentage || 0), 0) / exams.length
      )
    : 0;
  const behaviorPoints = behavior.reduce((s, b) => s + (b.points || 0), 0);

  const currentMonthScore = useMemo(() => {
    const memorizationScore = Math.max(
      0,
      Math.min(100, Math.round((memStats.avgScore / 10) * 100))
    );
    const behaviorScore = Math.max(
      0,
      Math.min(100, Math.round(((behaviorPoints + 10) / 20) * 100))
    );
    const combined = Math.round(
      attendanceRate * 0.45 + memorizationScore * 0.45 + behaviorScore * 0.1
    );
    return {
      combined,
      attendance: attendanceRate,
      memorizationScore,
      behaviorScore,
    };
  }, [attendanceRate, memStats.avgScore, behaviorPoints]);

  const filteredRecords = useMemo(() => {
    if (!memorization) return [];
    if (memFilter === 'all') return memorization.allRecords || [];
    return memorization.byType?.[memFilter] || [];
  }, [memorization, memFilter]);

  const attendanceMatrix = useMemo(() => {
    const days = getDaysInMonth(selectedMonth);
    const matrix: Record<
      string,
      {
        date: string;
        day: string;
        statuses: Record<number, string>;
        comments: string[];
      }
    > = {};
    days.forEach((dateStr) => {
      const d = getSafeDate(dateStr);
      matrix[dateStr] = {
        date: dateStr,
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
        statuses: {},
        comments: [],
      };
    });
    (attendance?.sessions || []).forEach((session) => {
      (session.daily || []).forEach((entry) => {
        const dateKey = entry.date?.split('T')[0];
        if (dateKey && matrix[dateKey]) {
          matrix[dateKey].statuses[session.slotNumber] = entry.status;
          if (entry.comments) matrix[dateKey].comments.push(entry.comments);
        }
      });
    });
    return Object.values(matrix);
  }, [attendance, selectedMonth]);

  // ============================================================
  // RENDER: OVERVIEW
  // ============================================================
  const renderOverview = () => {
    const chartData =
      monthlyPerf.length > 0
        ? monthlyPerf.slice(-6)
        : Array.from({ length: 1 }, () => ({
            month: selectedMonth,
            combined: currentMonthScore.combined,
          }));
    const maxCombined = Math.max(
      ...chartData.map((m) => m.combined || 0),
      1
    );

    return (
      <>
        <View style={styles.statsGrid}>
          <StatTile
            label={t('reports.overview.attendance')}
            value={`${attendanceRate}%`}
            icon="calendar"
            color={COLORS.blue}
            bg={COLORS.blueLight}
            subtitle={`${attendance?.summary?.present || 0}/${
              attendance?.summary?.total || 0
            }`}
          />
          <StatTile
            label={t('reports.overview.memorization')}
            value={`${memStats.total || 0}`}
            icon="book"
            color={COLORS.primary}
            bg={COLORS.primaryLight}
            subtitle={t('reports.overview.avg', {
              value: `${memStats.avgScore || 0}/10`,
            })}
          />
          <StatTile
            label={t('reports.overview.exams')}
            value={`${exams.length}`}
            icon="trophy"
            color={COLORS.purple}
            bg={COLORS.purpleLight}
            subtitle={t('reports.overview.avg', { value: `${examAvg}%` })}
          />
          <StatTile
            label={t('reports.overview.behavior')}
            value={`${behaviorPoints > 0 ? '+' : ''}${behaviorPoints}`}
            icon="heart"
            color={behaviorPoints >= 0 ? COLORS.primary : COLORS.red}
            bg={behaviorPoints >= 0 ? COLORS.primaryLight : COLORS.redLight}
            subtitle={t('reports.overview.goodCount', {
              count: behavior.filter((b) => b.type === 'good').length,
            })}
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            title={t('reports.overview.performanceTrend')}
            subtitle={t('reports.overview.performanceTrendSub')}
            icon="trending-up"
          />
          {chartData.map((m) => {
            const pct = Math.min(((m.combined || 0) / maxCombined) * 100, 100);
            const color =
              (m.combined || 0) >= 80
                ? COLORS.primary
                : (m.combined || 0) >= 60
                ? COLORS.amber
                : COLORS.red;
            return (
              <View key={m.month} style={styles.trendRow}>
                <Text style={styles.trendMonth}>{getMonthLabel(m.month)}</Text>
                <View style={styles.trendBarWrap}>
                  <View
                    style={[
                      styles.trendBar,
                      { width: `${pct}%`, backgroundColor: color },
                    ]}
                  />
                </View>
                <Text style={[styles.trendValue, { color }]}>
                  {m.combined || 0}%
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <SectionHeader
            title={t('reports.overview.breakdownByType')}
            subtitle={t('reports.overview.breakdownSub', {
              count: memStats.total || 0,
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
                  <Text style={[styles.breakdownCount, { color: type.color }]}>
                    {count}
                  </Text>
                  <Text style={styles.breakdownLabel} numberOfLines={1}>
                    {t(`reports.achievementTypes.${type.labelKey}`)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <SectionHeader
            title={t('reports.overview.examSummary')}
            icon="trophy"
            subtitle={t('reports.overview.examSummarySub', {
              count: exams.length,
            })}
          />
          <View style={styles.examSummaryGrid}>
            <View style={styles.examSummaryTile}>
              <Text style={styles.examSummaryValue}>{exams.length}</Text>
              <Text style={styles.examSummaryLabel}>
                {t('reports.overview.total')}
              </Text>
            </View>
            <View style={styles.examSummaryTile}>
              <Text
                style={[styles.examSummaryValue, { color: COLORS.primary }]}
              >
                {exams.filter((e) => e.status === 'Pass').length}
              </Text>
              <Text style={styles.examSummaryLabel}>
                {t('reports.overview.passed')}
              </Text>
            </View>
            <View style={styles.examSummaryTile}>
              <Text style={[styles.examSummaryValue, { color: COLORS.blue }]}>
                {examAvg}%
              </Text>
              <Text style={styles.examSummaryLabel}>
                {t('reports.overview.average')}
              </Text>
            </View>
            <View style={styles.examSummaryTile}>
              <Text style={[styles.examSummaryValue, { color: COLORS.gold }]}>
                {exams.length
                  ? `${Math.max(
                      ...exams.map((e) => e.percentage || 0)
                    )}%`
                  : '-'}
              </Text>
              <Text style={styles.examSummaryLabel}>
                {t('reports.overview.best')}
              </Text>
            </View>
          </View>
        </View>
      </>
    );
  };

  // ============================================================
  // RENDER: ATTENDANCE
  // ============================================================
  const renderAttendance = () => (
    <>
      <View style={styles.statsGrid}>
        <StatTile
          label={t('reports.attendance.total')}
          value={`${attendance?.summary?.total || 0}`}
          icon="albums"
          color={COLORS.slate}
          bg="#F1F5F9"
        />
        <StatTile
          label={t('reports.attendance.present')}
          value={`${attendance?.summary?.present || 0}`}
          icon="checkmark-circle"
          color={COLORS.primary}
          bg={COLORS.primaryLight}
        />
        <StatTile
          label={t('reports.attendance.absent')}
          value={`${attendance?.summary?.absent || 0}`}
          icon="close-circle"
          color={COLORS.red}
          bg={COLORS.redLight}
        />
        <StatTile
          label={t('reports.attendance.late')}
          value={`${attendance?.summary?.late || 0}`}
          icon="time"
          color={COLORS.amber}
          bg={COLORS.amberLight}
        />
      </View>

      <View style={styles.card}>
        <SectionHeader
          title={t('reports.attendance.dailyRecords')}
          subtitle={getMonthLabel(selectedMonth)}
          icon="calendar"
        />
        {attendanceMatrix.map((day) => {
          const sessionSlots = Object.keys(day.statuses)
            .map(Number)
            .sort((a, b) => a - b);
          return (
            <View key={day.date} style={styles.dayRow}>
              <View style={styles.dayLeft}>
                <Text style={styles.dayDate}>
                  {formatShortDate(day.date).slice(0, 5)}
                </Text>
                <Text style={styles.dayName}>{day.day}</Text>
              </View>
              <View style={styles.dayStatuses}>
                {sessionSlots.length === 0 ? (
                  <Text style={styles.dayEmpty}>
                    {t('reports.attendance.noRecords')}
                  </Text>
                ) : (
                  sessionSlots.map((slot) => {
                    const status = day.statuses[slot];
                    const c = getStatusColor(status);
                    const key = STATUS_KEY[status];
                    return (
                      <View
                        key={slot}
                        style={[styles.sessionPill, { backgroundColor: c.bg }]}
                      >
                        <Text
                          style={[styles.sessionPillText, { color: c.text }]}
                        >
                          S{slot}:{' '}
                          {key ? t(`reports.statusBadges.${key}`) : status}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          );
        })}
      </View>
    </>
  );

  // ============================================================
  // RENDER: MEMORIZATION
  // ============================================================
  const renderMemorization = () => (
    <>
      <View style={styles.statsGrid}>
        <StatTile
          label={t('reports.memorization.records')}
          value={`${memStats.total || 0}`}
          icon="book"
          color={COLORS.primary}
          bg={COLORS.primaryLight}
        />
        <StatTile
          label={t('reports.memorization.average')}
          value={`${memStats.avgScore || 0}/10`}
          icon="star"
          color={COLORS.gold}
          bg={COLORS.goldLight}
        />
        <StatTile
          label={t('reports.memorization.best')}
          value={`${memStats.bestScore || 0}/10`}
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
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t(`reports.achievementTypes.${type.labelKey}`)} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.card}>
        {filteredRecords.length === 0 ? (
          <Text style={styles.emptyText}>
            {t('reports.noRecordsForFilter')}
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
                <View style={{ flex: 1 }}>
                  <View style={styles.memTopRow}>
                    <Text style={[styles.memType, { color: typeInfo?.color }]}>
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
                    {formatRange(r)}
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

  // ============================================================
  // RENDER: EXAMS
  // ============================================================
  const renderExams = () => (
    <View style={styles.card}>
      <SectionHeader
        title={t('reports.exams.title')}
        subtitle={t('reports.exams.subtitle', { count: exams.length })}
        icon="trophy"
      />
      {exams.length === 0 ? (
        <Text style={styles.emptyText}>
          {t('reports.noExamsRecorded')}
        </Text>
      ) : (
        exams.map((exam, i) => (
          <TouchableOpacity
            key={exam._id || `exam-${i}`}
            style={styles.examRow}
            onPress={() => setSelectedExam(exam)}
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
            <View style={{ flex: 1 }}>
              <Text style={styles.examType}>
                {exam.type || t('reports.exams.monthly')}
              </Text>
              <Text style={styles.examMeta}>
                {formatShortDate(exam.date)} • {exam.halaqah || '-'}
              </Text>
            </View>
            <View style={styles.examRight}>
              <Text style={styles.examScoreMini}>
                {Math.round((exam.score || 0) * 10) / 10}/
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
        ))
      )}
    </View>
  );

  // ============================================================
  // RENDER: BEHAVIOR
  // ============================================================
  const renderBehavior = () => (
    <>
      <View style={styles.statsGrid}>
        <StatTile
          label={t('reports.behavior.good')}
          value={`${behavior.filter((b) => b.type === 'good').length}`}
          icon="thumbs-up"
          color={COLORS.primary}
          bg={COLORS.primaryLight}
        />
        <StatTile
          label={t('reports.behavior.bad')}
          value={`${behavior.filter((b) => b.type === 'bad').length}`}
          icon="thumbs-down"
          color={COLORS.red}
          bg={COLORS.redLight}
        />
        <StatTile
          label={t('reports.behavior.netPoints')}
          value={`${behaviorPoints > 0 ? '+' : ''}${behaviorPoints}`}
          icon="star"
          color={behaviorPoints >= 0 ? COLORS.primary : COLORS.red}
          bg={behaviorPoints >= 0 ? COLORS.primaryLight : COLORS.redLight}
        />
      </View>

      <View style={styles.card}>
        <SectionHeader
          title={t('reports.behavior.title')}
          subtitle={getMonthLabel(selectedMonth)}
          icon="heart"
        />
        {behavior.length === 0 ? (
          <Text style={styles.emptyText}>
            {t('reports.noBehaviorRecords')}
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
              <View style={{ flex: 1 }}>
                <Text style={styles.behaviorDesc}>{b.description}</Text>
                <Text style={styles.behaviorMeta}>
                  {formatShortDate(b.date)}
                  {b.category ? ` • ${b.category}` : ''}
                  {b.recordedBy
                    ? ` • ${t('reports.by', { name: b.recordedBy })}`
                    : ''}
                </Text>
              </View>
              <Text
                style={[
                  styles.behaviorPoints,
                  {
                    color:
                      b.type === 'good' ? COLORS.primary : COLORS.red,
                  },
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

  // ============================================================
  // RENDER: FINANCE
  // ============================================================
  const renderFinance = () => (
    <>
      <View style={styles.statsGrid}>
        <StatTile
          label={t('reports.finance.billed')}
          value={`$${finance?.summary?.totalDue?.toFixed(2) || '0.00'}`}
          icon="document-text"
          color={COLORS.blue}
          bg={COLORS.blueLight}
        />
        <StatTile
          label={t('reports.finance.paid')}
          value={`$${finance?.summary?.totalPaid?.toFixed(2) || '0.00'}`}
          icon="checkmark-circle"
          color={COLORS.primary}
          bg={COLORS.primaryLight}
        />
        <StatTile
          label={t('reports.finance.balance')}
          value={`$${finance?.summary?.balance?.toFixed(2) || '0.00'}`}
          icon="wallet"
          color={
            (finance?.summary?.balance || 0) > 0
              ? COLORS.red
              : COLORS.primary
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
          title={t('reports.finance.feeBreakdown')}
          icon="list"
        />
        {(finance?.breakdown || []).length === 0 ? (
          <Text style={styles.emptyText}>
            {t('reports.noFeeRecords')}
          </Text>
        ) : (
          finance!.breakdown!.map((item, i) => (
            <View key={item._id || `fee-${i}`} style={styles.financeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.financeDesc}>{item.description}</Text>
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
          title={t('reports.finance.paymentHistory')}
          icon="cash"
        />
        {(finance?.payments || []).length === 0 ? (
          <Text style={styles.emptyText}>
            {t('reports.noPaymentsRecorded')}
          </Text>
        ) : (
          finance!.payments!.map((p, i) => (
            <View key={p._id || `pay-${i}`} style={styles.financeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.financeDesc}>
                  {p.method || t('reports.paymentFallback')}
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
  // MAIN RENDER
  // ============================================================
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('reports.headerTitle')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('reports.headerSubtitle')}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() =>
              Alert.alert(
                t('reports.comingSoonTitle'),
                t('reports.comingSoonMsg')
              )
            }
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

      <TouchableOpacity
        style={styles.studentSelector}
        onPress={() => setShowStudentSearch(true)}
        activeOpacity={0.7}
      >
        <View style={styles.studentSelectorIcon}>
          <Ionicons name="person" size={18} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.studentSelectorLabel}>
            {t('reports.student')}
          </Text>
          <Text style={styles.studentSelectorValue} numberOfLines={1}>
            {selectedStudent
              ? selectedStudent.name
              : t('reports.tapToSelectStudent')}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={COLORS.slateMuted} />
      </TouchableOpacity>

      {selectedStudent && (
        <TouchableOpacity
          style={styles.monthSelector}
          onPress={() => setShowMonthPicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar" size={14} color={COLORS.primary} />
          <Text style={styles.monthText}>
            {getMonthLabel(selectedMonth)}
          </Text>
          <Ionicons name="chevron-down" size={14} color={COLORS.primary} />
        </TouchableOpacity>
      )}

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
            {t('reports.noStudentTitle')}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t('reports.noStudentSubtitle')}
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => setShowStudentSearch(true)}
          >
            <Ionicons name="search" size={16} color="#fff" />
            <Text style={styles.emptyBtnText}>
              {t('reports.selectStudent')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {selectedStudent && loading && !reportData && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('reports.loadingReport')}
          </Text>
        </View>
      )}

      {selectedStudent && reportData && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        >
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {initials(student?.name)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>
                {student?.name || t('reports.unknownStudent')}
              </Text>
              <Text style={styles.profileMeta}>
                {student?.regNo || t('reports.na')} •{' '}
                {getHalaqahName(student?.halaqah)}
              </Text>
            </View>
            <View style={styles.profileScore}>
              <Text style={styles.profileScoreValue}>
                {currentMonthScore.combined}%
              </Text>
              <Text style={styles.profileScoreLabel}>
                {t('reports.overall')}
              </Text>
            </View>
          </View>

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
                  activeOpacity={0.7}
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

      <StudentSearchModal
        visible={showStudentSearch}
        onClose={() => setShowStudentSearch(false)}
        onSelect={(s) => {
          setSelectedStudent(s);
          setReportData(null);
          setActiveTab('overview');
          setMemFilter('all');
        }}
      />
      <MonthPickerModal
        visible={showMonthPicker}
        value={selectedMonth}
        onClose={() => setShowMonthPicker(false)}
        onChange={setSelectedMonth}
      />
      <ExamDetailsModal
        visible={!!selectedExam}
        exam={selectedExam}
        student={student || null}
        onClose={() => setSelectedExam(null)}
      />
    </SafeAreaView>
  );
};

export default ReportsScreen;

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

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
  errorText: { flex: 1, fontSize: 12, color: COLORS.red, fontWeight: '600' },

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

  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  monthText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

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
  profileScoreValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  profileScoreLabel: {
    fontSize: 9,
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },

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

  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  trendMonth: {
    width: 70,
    fontSize: 11,
    color: COLORS.slate,
    fontWeight: '600',
  },
  trendBarWrap: {
    flex: 1,
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    overflow: 'hidden',
  },
  trendBar: { height: '100%', borderRadius: 5 },
  trendValue: {
    width: 42,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },

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

  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dayLeft: { width: 60 },
  dayDate: { fontSize: 12, fontWeight: '700', color: COLORS.slate },
  dayName: { fontSize: 10, color: COLORS.slateMuted, marginTop: 1 },
  dayStatuses: { flex: 1, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dayEmpty: { fontSize: 12, color: COLORS.gray, fontStyle: 'italic' },
  sessionPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  sessionPillText: { fontSize: 10, fontWeight: '700' },

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
  examType: { fontSize: 13, fontWeight: '700', color: COLORS.slate },
  examMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  examRight: { alignItems: 'flex-end', gap: 4 },
  examScoreMini: { fontSize: 12, fontWeight: '700', color: COLORS.slate },

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

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  emptyText: {
    fontSize: 13,
    color: COLORS.gray,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { paddingHorizontal: 20 },

  modalProfile: { alignItems: 'center', paddingVertical: 20 },
  modalAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalAvatarText: { fontSize: 34, fontWeight: '800', color: COLORS.white },
  modalName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.slate,
    textAlign: 'center',
  },
  modalEmail: {
    fontSize: 13,
    color: COLORS.slateMuted,
    marginTop: 4,
    fontWeight: '600',
  },

  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginVertical: 12,
  },
  yearBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  yearText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.slate,
    minWidth: 60,
    textAlign: 'center',
  },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthCell: {
    width: '31%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  monthCellActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  monthCellText: { fontSize: 13, fontWeight: '700', color: COLORS.slate },
  monthCellTextActive: { color: '#fff' },

  searchContainerInner: { paddingHorizontal: 20, paddingBottom: 8 },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 44,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: COLORS.slate },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.primary, fontWeight: '800', fontSize: 16 },
  studentName: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  studentMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },

  examScoreCard: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  examScoreLabel: {
    fontSize: 11,
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  examScoreValue: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 4,
  },
  examScorePct: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: { height: '100%', borderRadius: 4 },

  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  questionIdx: {
    width: 32,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slateMuted,
  },
  questionCols: { flexDirection: 'row', gap: 12 },
  questionCol: { alignItems: 'center' },
  questionColLabel: { fontSize: 9, color: COLORS.slateMuted, fontWeight: '700' },
  questionColValue: { fontSize: 12, fontWeight: '800', marginTop: 2 },

  notesGrid: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12 },
  notesCard: { flex: 1, borderRadius: 10, padding: 10 },
  notesLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  notesText: { fontSize: 12, color: COLORS.slate },

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
  infoLabel: { fontSize: 11, color: COLORS.slateMuted, fontWeight: '600' },
  infoValue: {
    fontSize: 14,
    color: COLORS.slate,
    fontWeight: '600',
    marginTop: 2,
  },

  formLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slateMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});