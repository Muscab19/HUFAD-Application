// src/screens/admin/examinations/ExaminationsManagementScreen.tsx
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  COLORS,
  Exam,
  ExamSettings,
  Halaqah,
  DEFAULT_EXAM_TYPES,
  api,
  round2,
  getExamFormType,
} from './_shared';
import { ExamFormScreen } from './ExamFormScreen';
import { ExamDetailsModal } from './ExamDetailsModal';
import { ExamSettingsModal } from './ExamSettingsModal';
import { printExamSheet, shareExamSheetAsPdf } from './PrintExamSheet';

// ============================================================
// ROOT
// ============================================================
export const ExaminationsManagementScreen: React.FC = () => {
  const [mode, setMode] = useState<
    { kind: 'list' } | { kind: 'form'; exam: Exam | null }
  >({ kind: 'list' });

  const [settings, setSettings] = useState<ExamSettings | null>(null);

  useEffect(() => {
    (async () => {
      const s = await api.getSettings();
      setSettings(s);
    })();
  }, []);

  const reloadSettings = useCallback(async () => {
    const s = await api.getSettings();
    setSettings(s);
  }, []);

  if (mode.kind === 'form') {
    return (
      <ExamFormScreen
        exam={mode.exam}
        settings={settings}
        onBack={() => setMode({ kind: 'list' })}
        onSaved={() => setMode({ kind: 'list' })}
      />
    );
  }

  return (
    <ExamList
      settings={settings}
      onSettingsChanged={reloadSettings}
      onEdit={(exam) => setMode({ kind: 'form', exam })}
      onCreate={() => setMode({ kind: 'form', exam: null })}
    />
  );
};

export default ExaminationsManagementScreen;

// ============================================================
// LIST
// ============================================================
const ExamList: React.FC<{
  settings: ExamSettings | null;
  onSettingsChanged: () => void;
  onEdit: (exam: Exam) => void;
  onCreate: () => void;
}> = ({ settings, onSettingsChanged, onEdit, onCreate }) => {
  const { t, i18n } = useTranslation();
  const [exams, setExams] = useState<Exam[]>([]);
  const [halaqat, setHalaqat] = useState<Halaqah[]>([]);
  const [examTypes, setExamTypes] = useState<string[]>(DEFAULT_EXAM_TYPES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [publishStatus, setPublishStatus] = useState<string>('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [filterHalaqah, setFilterHalaqah] = useState<string>('all');
  const [filterGender, setFilterGender] = useState<string>('all');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const [detailsExam, setDetailsExam] = useState<Exam | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const [settingsVisible, setSettingsVisible] = useState(false);

  // ---- Filters bottom-sheet state ----
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [filtersDraft, setFiltersDraft] = useState<{
    examType: string;
    halaqah: string;
    gender: string;
  }>({ examType: 'All', halaqah: 'all', gender: 'all' });

  const language = i18n.language || 'en';

  // ----------------------------------------------------------------
  // Load
  // ----------------------------------------------------------------
  const loadExams = useCallback(async () => {
    setError('');
    try {
      const list = await api.list({
        examType: filterType !== 'All' ? filterType : undefined,
        halaqah: filterHalaqah !== 'all' ? filterHalaqah : undefined,
        gender: filterGender !== 'all' ? filterGender : undefined,
        searchQuery: searchTerm.trim() || undefined,
      });
      setExams(list);
    } catch (err: any) {
      console.error('Load exams error:', err);
      setError(err?.message || t('examinations.loadFailed'));
      setExams([]);
    }
  }, [filterType, filterHalaqah, filterGender, searchTerm, t]);

  useEffect(() => {
    (async () => {
      try {
        const [h, tList] = await Promise.all([
          api.getHalaqat(),
          api.getExamTypes(),
        ]);
        setHalaqat(h);
        if (tList.length > 0) setExamTypes(tList);
      } catch (err) {
        console.warn('Load halaqat/types failed:', err);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadExams();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadExams]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadExams();
    setRefreshing(false);
  };

  const stats = useMemo(() => {
    const total = exams.length;
    const passed = exams.filter((e) => e.status === 'Pass').length;
    const avg =
      total > 0
        ? Math.round(
            exams.reduce((s, e) => s + (e.percentage || 0), 0) / total
          )
        : 0;
    return { total, passed, avg };
  }, [exams]);

  // ----------------------------------------------------------------
  // Filters — sheet handlers
  // ----------------------------------------------------------------
  const openFilters = () => {
    setFiltersDraft({
      examType: filterType,
      halaqah: filterHalaqah,
      gender: filterGender,
    });
    setFiltersVisible(true);
  };

  const applyFilters = () => {
    setFilterType(filtersDraft.examType);
    setFilterHalaqah(filtersDraft.halaqah);
    setFilterGender(filtersDraft.gender);
    setFiltersVisible(false);
  };

  const clearAllFilters = () => {
    setFilterType('All');
    setFilterHalaqah('all');
    setFilterGender('all');
    setFiltersVisible(false);
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterType !== 'All') n++;
    if (filterHalaqah !== 'all') n++;
    if (filterGender !== 'all') n++;
    return n;
  }, [filterType, filterHalaqah, filterGender]);

  // ----------------------------------------------------------------
  // Selection
  // ----------------------------------------------------------------
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  };

  const exitSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  // ----------------------------------------------------------------
  // Bulk publish / unpublish
  // ----------------------------------------------------------------
  const bulkPublish = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Alert.alert(
      t('examinations.bulk.publishTitle'),
      t('examinations.bulk.publishConfirm', { count: ids.length }),
      [
        { text: t('examinations.bulk.cancel'), style: 'cancel' },
        {
          text: t('examinations.bulk.publish'),
          onPress: async () => {
            try {
              await api.bulkPublish(ids);
              setPublishStatus(
                t('examinations.bulk.publishedMsg', { count: ids.length })
              );
              exitSelection();
              await loadExams();
              setTimeout(() => setPublishStatus(''), 3000);
            } catch (err: any) {
              Alert.alert(
                t('examinations.errorTitle'),
                err?.message || t('examinations.bulk.publishFailed')
              );
            }
          },
        },
      ]
    );
  };

  const bulkUnpublish = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Alert.alert(
      t('examinations.bulk.unpublishTitle'),
      t('examinations.bulk.unpublishConfirm', { count: ids.length }),
      [
        { text: t('examinations.bulk.cancel'), style: 'cancel' },
        {
          text: t('examinations.bulk.unpublish'),
          onPress: async () => {
            try {
              await api.bulkUnpublish(ids);
              setPublishStatus(
                t('examinations.bulk.unpublishedMsg', { count: ids.length })
              );
              exitSelection();
              await loadExams();
              setTimeout(() => setPublishStatus(''), 3000);
            } catch (err: any) {
              Alert.alert(
                t('examinations.errorTitle'),
                err?.message || t('examinations.bulk.unpublishFailed')
              );
            }
          },
        },
      ]
    );
  };

  const togglePublish = async (exam: Exam) => {
    try {
      if (exam.isPublished) {
        await api.unpublish(exam._id);
      } else {
        await api.publish(exam._id);
      }
      await loadExams();
    } catch (err: any) {
      Alert.alert(
        t('examinations.errorTitle'),
        err?.message || t('examinations.delete.toggleFailed')
      );
    }
  };

  const deleteExam = (exam: Exam) => {
    Alert.alert(
      t('examinations.delete.title'),
      t('examinations.delete.confirmMsg', {
        examType: exam.examType,
        studentName: exam.studentName,
      }),
      [
        { text: t('examinations.delete.cancel'), style: 'cancel' },
        {
          text: t('examinations.delete.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.remove(exam._id);
              await loadExams();
            } catch (err: any) {
              Alert.alert(
                t('examinations.errorTitle'),
                err?.message || t('examinations.delete.failed')
              );
            }
          },
        },
      ]
    );
  };

  const openDetails = (exam: Exam) => {
    setDetailsExam(exam);
    setDetailsVisible(true);
  };

  // ----------------------------------------------------------------
  // Print / share handlers
  // ----------------------------------------------------------------
  const handlePrint = async (exam: Exam) => {
    await printExamSheet({ exam, settings, language });
  };

  const handleShare = async (exam: Exam) => {
    await shareExamSheetAsPdf({ exam, settings, language });
  };

  // ----------------------------------------------------------------
  // Row rendering
  // ----------------------------------------------------------------
  const renderExam = ({ item }: { item: Exam }) => {
    const formType = getExamFormType(item);
    const isSelected = selectedIds.has(item._id);
    const pct = round2(item.percentage || 0);
    const passing = item.passingMark || item.settings?.passingMark || 60;

    return (
      <TouchableOpacity
        style={[styles.examCard, isSelected && styles.examCardSelected]}
        activeOpacity={0.7}
        onPress={() =>
          selectionMode ? toggleSelect(item._id) : openDetails(item)
        }
        onLongPress={() => {
          setSelectionMode(true);
          toggleSelect(item._id);
        }}
      >
        <View style={styles.examRow}>
          {selectionMode && (
            <TouchableOpacity
              style={styles.checkboxTouch}
              onPress={() => toggleSelect(item._id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={isSelected ? 'checkbox' : 'square-outline'}
                size={20}
                color={isSelected ? COLORS.blue : COLORS.gray}
              />
            </TouchableOpacity>
          )}

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.studentName?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>

          <View style={styles.examInfo}>
            <Text style={styles.examStudent} numberOfLines={1}>
              {item.studentName}
            </Text>
            <Text style={styles.examMeta} numberOfLines={1}>
              {item.halaqah} · {item.examType}
            </Text>
            <View style={styles.examTags}>
              <View
                style={[
                  styles.typeTag,
                  {
                    backgroundColor:
                      formType === 'reading'
                        ? COLORS.purpleLight
                        : COLORS.blueLight,
                  },
                ]}
              >
                <Ionicons
                  name={formType === 'reading' ? 'book' : 'school'}
                  size={10}
                  color={formType === 'reading' ? COLORS.purple : COLORS.blue}
                />
                <Text
                  style={[
                    styles.typeTagText,
                    {
                      color:
                        formType === 'reading'
                          ? COLORS.purple
                          : COLORS.blue,
                    },
                  ]}
                >
                  {formType === 'reading'
                    ? t('examinations.formTypes.reading')
                    : t('examinations.formTypes.memorization')}
                </Text>
              </View>
              {item.isPublished ? (
                <View
                  style={[
                    styles.typeTag,
                    { backgroundColor: COLORS.primaryLight },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={10}
                    color={COLORS.primary}
                  />
                  <Text
                    style={[styles.typeTagText, { color: COLORS.primary }]}
                  >
                    {t('examinations.status.published')}
                  </Text>
                </View>
              ) : (
                <View
                  style={[styles.typeTag, { backgroundColor: '#F1F5F9' }]}
                >
                  <Ionicons name="eye-off" size={10} color={COLORS.gray} />
                  <Text
                    style={[styles.typeTagText, { color: COLORS.gray }]}
                  >
                    {t('examinations.status.draft')}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.examRight}>
            <Text style={styles.examScore}>
              {round2(item.obtainedMarks || 0)}
            </Text>
            <Text style={styles.examScoreTotal}>
              /{item.totalMarks || 100}
            </Text>
            <View style={styles.progressRow}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(pct, 100)}%`,
                      backgroundColor:
                        pct >= passing ? COLORS.primary : COLORS.red,
                    },
                  ]}
                />
              </View>
            </View>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    item.status === 'Pass'
                      ? COLORS.primaryLight
                      : COLORS.redLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      item.status === 'Pass' ? COLORS.primary : COLORS.red,
                  },
                ]}
              >
                {item.status === 'Pass'
                  ? t('examinations.status.pass')
                  : t('examinations.status.fail')}
              </Text>
            </View>
          </View>
        </View>

        {/* Row actions */}
        {!selectionMode && (
          <View style={styles.rowActions}>
            <TouchableOpacity
              style={styles.rowActionBtn}
              onPress={() => handlePrint(item)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name="print-outline"
                size={15}
                color={COLORS.purple}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rowActionBtn}
              onPress={() => handleShare(item)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="share-outline" size={15} color={COLORS.blue} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rowActionBtn}
              onPress={() => onEdit(item)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name="create-outline"
                size={15}
                color={COLORS.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rowActionBtn}
              onPress={() => togglePublish(item)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name={
                  item.isPublished
                    ? 'eye-off-outline'
                    : 'cloud-upload-outline'
                }
                size={15}
                color={item.isPublished ? COLORS.amber : COLORS.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rowActionBtn}
              onPress={() => deleteExam(item)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="trash-outline" size={15} color={COLORS.red} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const headerSubtitleKey =
    exams.length === 1
      ? 'examinations.headerSubtitle'
      : 'examinations.headerSubtitlePlural';

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('examinations.headerTitle')}</Text>
          <Text style={styles.headerSubtitle}>
            {t(headerSubtitleKey, {
              count: exams.length,
              passed: stats.passed,
              avg: stats.avg,
            })}
          </Text>
        </View>
        {selectionMode ? (
          <View style={styles.selectionActions}>
            <Text style={styles.selectionCount}>
              {t('examinations.selectedCount', { count: selectedIds.size })}
            </Text>
            <TouchableOpacity
              style={[
                styles.headerIconBtn,
                { backgroundColor: COLORS.primaryLight },
              ]}
              onPress={bulkPublish}
            >
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={COLORS.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.headerIconBtn,
                { backgroundColor: COLORS.amberLight },
              ]}
              onPress={bulkUnpublish}
            >
              <Ionicons name="eye-off" size={18} color={COLORS.amber} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.headerIconBtn,
                { backgroundColor: COLORS.background },
              ]}
              onPress={exitSelection}
            >
              <Ionicons name="close" size={18} color={COLORS.slate} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.selectionActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setSettingsVisible(true)}
            >
              <Ionicons
                name="settings-outline"
                size={18}
                color={COLORS.slate}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={onCreate}>
              <Ionicons name="add" size={22} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {publishStatus ? (
        <View style={styles.successBanner}>
          <Ionicons
            name="checkmark-circle"
            size={16}
            color={COLORS.primary}
          />
          <Text style={styles.successText}>{publishStatus}</Text>
        </View>
      ) : null}

      {/* SEARCH + FILTERS BAR */}
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={styles.searchWrapper}>
            <Ionicons name="search-outline" size={18} color={COLORS.gray} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('examinations.searchPlaceholder')}
              placeholderTextColor="#A0AAA5"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={() => setSearchTerm('')}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={COLORS.gray}
                />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.filtersButton,
              activeFilterCount > 0 && styles.filtersButtonActive,
            ]}
            onPress={openFilters}
            activeOpacity={0.8}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={activeFilterCount > 0 ? '#fff' : COLORS.slate}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filtersBadge}>
                <Text style={styles.filtersBadgeText}>
                  {activeFilterCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Active filter pills row */}
        {activeFilterCount > 0 && (
          <View style={styles.activePillsRow}>
            {filterType !== 'All' && (
              <View style={styles.activePill}>
                <Text style={styles.activePillText} numberOfLines={1}>
                  {filterType}
                </Text>
              </View>
            )}
            {filterHalaqah !== 'all' && (
              <View style={styles.activePill}>
                <Text style={styles.activePillText} numberOfLines={1}>
                  {filterHalaqah}
                </Text>
              </View>
            )}
            {filterGender !== 'all' && (
              <View style={styles.activePill}>
                <Text style={styles.activePillText} numberOfLines={1}>
                  {filterGender === 'Male'
                    ? t('examinations.male')
                    : t('examinations.female')}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.clearPill}
              onPress={clearAllFilters}
            >
              <Ionicons name="close" size={12} color={COLORS.red} />
              <Text style={styles.clearPillText}>
                {t('examinations.clearFilters') || 'Clear'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && exams.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('examinations.loading')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={exams}
          keyExtractor={(item) => item._id}
          renderItem={renderExam}
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="document-text-outline"
                size={64}
                color="#CBD5E1"
              />
              <Text style={styles.emptyTitle}>
                {t('examinations.noResultsTitle')}
              </Text>
              <Text style={styles.emptyText}>
                {activeFilterCount > 0 || searchTerm
                  ? t('examinations.noResultsFiltered')
                  : t('examinations.noResultsEmpty')}
              </Text>
            </View>
          }
        />
      )}

      {/* DETAILS MODAL */}
      <ExamDetailsModal
        visible={detailsVisible}
        exam={detailsExam}
        settings={settings}
        onClose={() => setDetailsVisible(false)}
        onEdit={(exam) => {
          setDetailsVisible(false);
          onEdit(exam);
        }}
        onTogglePublish={async (exam) => {
          await togglePublish(exam);
          setDetailsVisible(false);
        }}
        onDelete={(exam) => {
          setDetailsVisible(false);
          deleteExam(exam);
        }}
      />

      {/* SETTINGS MODAL */}
      <ExamSettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        settings={settings}
        onSaved={async () => {
          await onSettingsChanged();
          setSettingsVisible(false);
        }}
      />

      {/* ==================================================
          FILTERS BOTTOM SHEET
      ================================================== */}
      <Modal
        visible={filtersVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFiltersVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetContainer}>
            {/* Sheet header */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>
                  {t('examinations.filtersTitle') || 'Filters'}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {t('examinations.filtersSubtitle') ||
                    'Narrow down the exam list'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setFiltersVisible(false)}
              >
                <Ionicons name="close" size={20} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.sheetBody}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Exam Type */}
              <Text style={styles.sheetSectionLabel}>
                {t('examinations.examType') || 'Exam Type'}
              </Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[
                    styles.sheetChip,
                    filtersDraft.examType === 'All' &&
                      styles.sheetChipActive,
                  ]}
                  onPress={() =>
                    setFiltersDraft((p) => ({ ...p, examType: 'All' }))
                  }
                >
                  <Text
                    style={[
                      styles.sheetChipText,
                      filtersDraft.examType === 'All' &&
                        styles.sheetChipTextActive,
                    ]}
                  >
                    {t('examinations.allTypes')}
                  </Text>
                </TouchableOpacity>
                {examTypes.map((typ) => (
                  <TouchableOpacity
                    key={typ}
                    style={[
                      styles.sheetChip,
                      filtersDraft.examType === typ &&
                        styles.sheetChipActive,
                    ]}
                    onPress={() =>
                      setFiltersDraft((p) => ({ ...p, examType: typ }))
                    }
                  >
                    <Text
                      style={[
                        styles.sheetChipText,
                        filtersDraft.examType === typ &&
                          styles.sheetChipTextActive,
                      ]}
                    >
                      {typ}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Halaqah */}
              {halaqat.length > 0 && (
                <>
                  <Text
                    style={[
                      styles.sheetSectionLabel,
                      { marginTop: 20 },
                    ]}
                  >
                    {t('examinations.halaqah') || 'Halaqah'}
                  </Text>
                  <View style={styles.chipRow}>
                    <TouchableOpacity
                      style={[
                        styles.sheetChip,
                        filtersDraft.halaqah === 'all' &&
                          styles.sheetChipActive,
                      ]}
                      onPress={() =>
                        setFiltersDraft((p) => ({ ...p, halaqah: 'all' }))
                      }
                    >
                      <Text
                        style={[
                          styles.sheetChipText,
                          filtersDraft.halaqah === 'all' &&
                            styles.sheetChipTextActive,
                        ]}
                      >
                        {t('examinations.allHalaqaat')}
                      </Text>
                    </TouchableOpacity>
                    {halaqat.map((h) => (
                      <TouchableOpacity
                        key={h._id}
                        style={[
                          styles.sheetChip,
                          filtersDraft.halaqah === h.name &&
                            styles.sheetChipActive,
                        ]}
                        onPress={() =>
                          setFiltersDraft((p) => ({
                            ...p,
                            halaqah: h.name,
                          }))
                        }
                      >
                        <Text
                          style={[
                            styles.sheetChipText,
                            filtersDraft.halaqah === h.name &&
                              styles.sheetChipTextActive,
                          ]}
                        >
                          {h.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Gender */}
              <Text
                style={[styles.sheetSectionLabel, { marginTop: 20 }]}
              >
                {t('examinations.gender') || 'Gender'}
              </Text>
              <View style={styles.chipRow}>
                {[
                  {
                    key: 'all',
                    label: t('examinations.allGenders'),
                  },
                  { key: 'Male', label: t('examinations.male') },
                  { key: 'Female', label: t('examinations.female') },
                ].map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.sheetChip,
                      filtersDraft.gender === key &&
                        styles.sheetChipActive,
                    ]}
                    onPress={() =>
                      setFiltersDraft((p) => ({ ...p, gender: key }))
                    }
                  >
                    <Text
                      style={[
                        styles.sheetChipText,
                        filtersDraft.gender === key &&
                          styles.sheetChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.sheetClearBtn}
                onPress={clearAllFilters}
              >
                <Text style={styles.sheetClearBtnText}>
                  {t('examinations.clearFilters') || 'Clear all'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sheetApplyBtn}
                onPress={applyFilters}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.sheetApplyBtnText}>
                  {t('examinations.applyFilters') || 'Apply'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 8,
    gap: 10,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.slate },
  headerSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: '#BFE9D4',
    borderRadius: 10,
  },
  successText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // ---------- Search + Filters bar ----------
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 46,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.slate,
  },
  filtersButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filtersBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  filtersBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  // Active filter pills
  activePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  activePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary + '55',
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  clearPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.redLight,
    borderWidth: 1,
    borderColor: '#F6C8C8',
  },
  clearPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.red,
  },

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
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.red,
  },
  loadingWrap: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: COLORS.slateMuted, fontSize: 13 },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 4,
  },
  examCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  examCardSelected: {
    borderColor: COLORS.blue,
    backgroundColor: '#F0F7FF',
  },
  checkboxTouch: { paddingRight: 8, paddingVertical: 8 },
  examRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: COLORS.blue },
  examInfo: { flex: 1 },
  examStudent: { fontSize: 15, fontWeight: '700', color: COLORS.slate },
  examMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  examTags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  typeTagText: { fontSize: 10, fontWeight: '700' },
  examRight: { alignItems: 'flex-end', marginLeft: 8, minWidth: 80 },
  examScore: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  examScoreTotal: {
    fontSize: 11,
    color: COLORS.slateMuted,
    marginBottom: 4,
  },
  progressRow: { width: 70, marginBottom: 4 },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: { fontSize: 10, fontWeight: '800' },

  // Row actions
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  rowActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  emptyContainer: {
    alignItems: 'center',
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

  // ---------- Filters bottom sheet ----------
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.slate,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: COLORS.slateMuted,
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sheetSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sheetChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sheetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },
  sheetChipTextActive: {
    color: '#fff',
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  sheetClearBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sheetClearBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate,
  },
  sheetApplyBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sheetApplyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});