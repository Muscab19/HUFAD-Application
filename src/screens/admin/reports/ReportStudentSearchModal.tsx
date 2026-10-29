// src/screens/admin/reports/ReportStudentSearchModal.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  COLORS,
  Student,
  getHalaqahName,
  reportsApi,
} from './_shared';

// ============================================================
// CONSTANTS
// ============================================================
const RECENT_KEY = 'reports_recent_students_v1';
const MAX_RECENTS = 6;
const MIN_QUERY = 2;

// ============================================================
// TYPES
// ============================================================
interface ReportStudentSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (s: Student) => void;
  selectedStudent?: Student | null;
}

// ============================================================
// RECENTS STORAGE
// ============================================================
const loadRecents = async (): Promise<Student[]> => {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveRecents = async (list: Student[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      RECENT_KEY,
      JSON.stringify(list.slice(0, MAX_RECENTS))
    );
  } catch (e) {
    console.warn('saveRecents failed', e);
  }
};

const pushRecent = async (student: Student): Promise<Student[]> => {
  const existing = await loadRecents();
  const filtered = existing.filter((s) => s._id !== student._id);
  const next = [student, ...filtered].slice(0, MAX_RECENTS);
  await saveRecents(next);
  return next;
};

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

/** Highlight the matched substring inside a name. */
const renderHighlighted = (
  text: string,
  query: string,
  baseStyle: any,
  highlightStyle: any
) => {
  const q = query.trim();
  if (!q) return <Text style={baseStyle}>{text}</Text>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx === -1) return <Text style={baseStyle}>{text}</Text>;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <Text style={baseStyle} numberOfLines={1}>
      {before}
      <Text style={highlightStyle}>{match}</Text>
      {after}
    </Text>
  );
};

// ============================================================
// MAIN
// ============================================================
export const ReportStudentSearchModal: React.FC<
  ReportStudentSearchModalProps
> = ({ visible, onClose, onSelect, selectedStudent }) => {
  const { t } = useTranslation();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Student[]>([]);
  const [recents, setRecents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  // ----------------------------------------------------------------
  // Open / close lifecycle
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setError('');
      setLoading(false);
      return;
    }

    setQuery('');
    setResults([]);
    setError('');
    setLoading(false);

    // Load recents
    (async () => {
      const list = await loadRecents();
      setRecents(list);
    })();

    // Autofocus the search field shortly after open
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 250);
    return () => clearTimeout(timer);
  }, [visible]);

  // ----------------------------------------------------------------
  // Debounced search
  // ----------------------------------------------------------------
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (q.length < MIN_QUERY) {
      setResults([]);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    const reqId = ++reqIdRef.current;

    debounceRef.current = setTimeout(async () => {
      try {
        const list = await reportsApi.searchStudents(q, 25);
        if (reqId === reqIdRef.current) setResults(list);
      } catch (err: any) {
        console.warn('search students failed', err);
        if (reqId === reqIdRef.current) {
          setResults([]);
          setError(
            err?.message ||
              t('reports.studentSearch.searchFailed') ||
              'Failed to search students.'
          );
        }
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, t]);

  // ----------------------------------------------------------------
  // Selection
  // ----------------------------------------------------------------
  const handleSelect = useCallback(
    async (student: Student) => {
      Keyboard.dismiss();
      pushRecent(student).then(setRecents).catch(() => {});
      onSelect(student);
      onClose();
    },
    [onSelect, onClose]
  );

  // ----------------------------------------------------------------
  // Derived list mode
  // ----------------------------------------------------------------
  const q = query.trim();
  const isSearching = q.length >= MIN_QUERY;

  const data: Student[] = useMemo(
    () => (isSearching ? results : recents),
    [isSearching, results, recents]
  );

  // ----------------------------------------------------------------
  // Row
  // ----------------------------------------------------------------
  const renderRow = ({ item }: { item: Student }) => {
    const isActive = selectedStudent?._id === item._id;
    return (
      <TouchableOpacity
        style={[styles.row, isActive && styles.rowActive]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.rowAvatar, isActive && styles.rowAvatarActive]}>
          <Text
            style={[
              styles.rowAvatarText,
              isActive && styles.rowAvatarTextActive,
            ]}
          >
            {initials(item.name)}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          {renderHighlighted(
            item.name,
            isSearching ? q : '',
            styles.rowName,
            styles.rowNameHighlight
          )}
          <View style={styles.rowMetaRow}>
            <Ionicons
              name="id-card-outline"
              size={11}
              color={COLORS.slateMuted}
            />
            <Text style={styles.rowMetaText} numberOfLines={1}>
              {item.regNo || t('reports.na')}
            </Text>
            <Text style={styles.rowMetaDot}>•</Text>
            <Ionicons
              name="school-outline"
              size={11}
              color={COLORS.slateMuted}
            />
            <Text style={styles.rowMetaText} numberOfLines={1}>
              {getHalaqahName(item.halaqah)}
            </Text>
          </View>
        </View>

        {isActive ? (
          <View style={styles.activeCheck}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </View>
        ) : (
          <Ionicons
            name="chevron-forward"
            size={16}
            color={COLORS.gray}
          />
        )}
      </TouchableOpacity>
    );
  };

  // ----------------------------------------------------------------
  // Empty state
  // ----------------------------------------------------------------
  const renderEmpty = () => {
    if (isSearching) {
      if (loading) {
        return (
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.centerStateText}>
              {t('reports.studentSearch.searching') || 'Searching…'}
            </Text>
          </View>
        );
      }
      if (error) {
        return (
          <View style={styles.centerState}>
            <View
              style={[
                styles.centerStateIcon,
                { backgroundColor: COLORS.redLight },
              ]}
            >
              <Ionicons
                name="alert-circle-outline"
                size={30}
                color={COLORS.red}
              />
            </View>
            <Text style={[styles.centerStateTitle, { color: COLORS.red }]}>
              {error}
            </Text>
          </View>
        );
      }
      return (
        <View style={styles.centerState}>
          <View style={styles.centerStateIcon}>
            <Ionicons name="search" size={30} color={COLORS.primary} />
          </View>
          <Text style={styles.centerStateTitle}>
            {t('reports.studentSearch.noStudents') || 'No students found'}
          </Text>
          <Text style={styles.centerStateText}>
            {t('reports.studentSearch.tryDifferent') ||
              'Try a different name or reg. no.'}
          </Text>
        </View>
      );
    }

    // Idle state — no recents
    return (
      <View style={styles.centerState}>
        <View style={styles.centerStateIcon}>
          <Ionicons name="person-add-outline" size={30} color={COLORS.primary} />
        </View>
        <Text style={styles.centerStateTitle}>
          {t('reports.studentSearch.idleTitle') || 'Find a student'}
        </Text>
        <Text style={styles.centerStateText}>
          {t('reports.studentSearch.typeAtLeast') ||
            'Type at least 2 characters to search.'}
        </Text>
      </View>
    );
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* ============ TOP BAR (back + title) ============ */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={22} color={COLORS.slate} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.topTitle}>
                {t('reports.studentSearch.title') || 'Select student'}
              </Text>
              <Text style={styles.topSubtitle} numberOfLines={1}>
                {selectedStudent
                  ? selectedStudent.name
                  : t('reports.studentSearch.subtitle') ||
                    'Search by name or registration number'}
              </Text>
            </View>
          </View>

          {/* ============ STICKY SEARCH BAR ============ */}
          <View style={styles.searchSticky}>
            <View style={styles.searchBar}>
              <Ionicons
                name="search-outline"
                size={18}
                color={COLORS.slateMuted}
              />
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={
                  t('reports.studentSearch.placeholder') ||
                  'Search student…'
                }
                placeholderTextColor="#A0AAA5"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="never"
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => setQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={COLORS.gray}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ============ SECTION HEADER ============ */}
          {data.length > 0 ? (
            <View style={styles.sectionHeader}>
              {!isSearching && recents.length > 0 ? (
                <Ionicons
                  name="time-outline"
                  size={12}
                  color={COLORS.slateMuted}
                />
              ) : null}
              <Text style={styles.sectionHeaderText}>
                {isSearching
                  ? t('reports.studentSearch.resultsTitle', {
                      count: results.length,
                    }) || `${results.length} results`
                  : t('reports.studentSearch.recentTitle') || 'Recent'}
              </Text>
            </View>
          ) : null}

          {/* ============ LIST ============ */}
          <FlatList
            data={data}
            keyExtractor={(item) => item._id}
            renderItem={renderRow}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator
            contentContainerStyle={{
              paddingBottom: 24,
              flexGrow: data.length === 0 ? 1 : 0,
            }}
            ListEmptyComponent={renderEmpty}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.slate,
  },
  topSubtitle: {
    fontSize: 12,
    color: COLORS.slateMuted,
    marginTop: 2,
  },

  // Sticky search bar
  searchSticky: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.slate,
    paddingVertical: 0,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 64,
    backgroundColor: COLORS.white,
  },
  rowActive: {
    backgroundColor: COLORS.primaryLight,
  },
  rowAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatarActive: { backgroundColor: COLORS.primary },
  rowAvatarText: {
    color: COLORS.blue,
    fontWeight: '800',
    fontSize: 15,
  },
  rowAvatarTextActive: { color: '#fff' },
  rowName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.slate,
  },
  rowNameHighlight: {
    color: COLORS.primary,
    fontWeight: '900',
    backgroundColor: COLORS.primaryLight,
  },
  rowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  rowMetaText: {
    fontSize: 11,
    color: COLORS.slateMuted,
    flexShrink: 1,
  },
  rowMetaDot: {
    fontSize: 10,
    color: COLORS.gray,
  },
  activeCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 76,
  },

  // Center states
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  centerStateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  centerStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.slate,
    textAlign: 'center',
  },
  centerStateText: {
    fontSize: 13,
    color: COLORS.slateMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});