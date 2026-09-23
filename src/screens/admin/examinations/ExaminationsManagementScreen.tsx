// src/screens/admin/examinations/ExaminationsManagementScreen.tsx
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
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  COLORS,
  Exam,
  ExamFormType,
  ExamSettings,
  Halaqah,
  DEFAULT_EXAM_TYPES,
  DEFAULT_COLUMNS,
  DEFAULT_READING_HEADERS,
  DEFAULT_READING_WEIGHTS,
  api,
  round2,
  getExamFormType,
  getSurahName,
  getJuzName,
} from './_shared';
import { ExamFormScreen } from './ExamFormScreen';

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
  const { t } = useTranslation();
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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const [detailsExam, setDetailsExam] = useState<Exam | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const [settingsVisible, setSettingsVisible] = useState(false);

  const loadExams = useCallback(async () => {
    setError('');
    try {
      const list = await api.list({
        examType: filterType !== 'All' ? filterType : undefined,
        halaqah: filterHalaqah !== 'all' ? filterHalaqah : undefined,
        searchQuery: searchTerm.trim() || undefined,
      });
      setExams(list);
    } catch (err: any) {
      console.error('Load exams error:', err);
      setError(err?.message || t('examinations.loadFailed'));
      setExams([]);
    }
  }, [filterType, filterHalaqah, searchTerm, t]);

  useEffect(() => {
    (async () => {
      try {
        const [h, tList] = await Promise.all([api.getHalaqat(), api.getExamTypes()]);
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
        ? Math.round(exams.reduce((s, e) => s + (e.percentage || 0), 0) / total)
        : 0;
    return { total, passed, avg };
  }, [exams]);

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

  const renderExam = ({ item }: { item: Exam }) => {
    const formType = getExamFormType(item);
    const isSelected = selectedIds.has(item._id);
    const pct = round2(item.percentage || 0);
    const passing = item.passingMark || item.settings?.passingMark || 60;

    return (
      <TouchableOpacity
        style={[styles.examCard, isSelected && styles.examCardSelected]}
        activeOpacity={0.7}
        onPress={() => (selectionMode ? toggleSelect(item._id) : openDetails(item))}
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
                      formType === 'reading' ? COLORS.purpleLight : COLORS.blueLight,
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
                        formType === 'reading' ? COLORS.purple : COLORS.blue,
                    },
                  ]}
                >
                  {formType === 'reading'
                    ? t('examinations.formTypes.reading')
                    : t('examinations.formTypes.memorization')}
                </Text>
              </View>
              {item.isPublished ? (
                <View style={[styles.typeTag, { backgroundColor: COLORS.primaryLight }]}>
                  <Ionicons name="checkmark-circle" size={10} color={COLORS.primary} />
                  <Text style={[styles.typeTagText, { color: COLORS.primary }]}>
                    {t('examinations.status.published')}
                  </Text>
                </View>
              ) : (
                <View style={[styles.typeTag, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="eye-off" size={10} color={COLORS.gray} />
                  <Text style={[styles.typeTagText, { color: COLORS.gray }]}>
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
            <Text style={styles.examScoreTotal}>/{item.totalMarks || 100}</Text>
            <View style={styles.progressRow}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(pct, 100)}%`,
                      backgroundColor: pct >= passing ? COLORS.primary : COLORS.red,
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
                    item.status === 'Pass' ? COLORS.primaryLight : COLORS.redLight,
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
      </TouchableOpacity>
    );
  };

  const headerSubtitleKey =
    exams.length === 1 ? 'examinations.headerSubtitle' : 'examinations.headerSubtitlePlural';

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
              style={[styles.headerIconBtn, { backgroundColor: COLORS.primaryLight }]}
              onPress={bulkPublish}
            >
              <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: COLORS.amberLight }]}
              onPress={bulkUnpublish}
            >
              <Ionicons name="eye-off" size={18} color={COLORS.amber} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: COLORS.background }]}
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
              <Ionicons name="settings-outline" size={18} color={COLORS.slate} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={onCreate}>
              <Ionicons name="add" size={22} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {publishStatus ? (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
          <Text style={styles.successText}>{publishStatus}</Text>
        </View>
      ) : null}

      {/* SEARCH */}
      <View style={styles.searchContainer}>
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
              <Ionicons name="close-circle" size={18} color={COLORS.gray} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* TYPE FILTER */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        >
          <TouchableOpacity
            style={[styles.filterChip, filterType === 'All' && styles.filterChipActive]}
            onPress={() => setFilterType('All')}
          >
            <Text
              style={[
                styles.filterChipText,
                filterType === 'All' && styles.filterChipTextActive,
              ]}
            >
              {t('examinations.allTypes')}
            </Text>
          </TouchableOpacity>
          {examTypes.map((typ) => (
            <TouchableOpacity
              key={typ}
              style={[styles.filterChip, filterType === typ && styles.filterChipActive]}
              onPress={() => setFilterType(typ)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterType === typ && styles.filterChipTextActive,
                ]}
              >
                {typ}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* HALAQA FILTER */}
      {halaqat.length > 0 && (
        <View style={styles.filterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                filterHalaqah === 'all' && styles.filterChipActive,
              ]}
              onPress={() => setFilterHalaqah('all')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterHalaqah === 'all' && styles.filterChipTextActive,
                ]}
              >
                {t('examinations.allHalaqaat')}
              </Text>
            </TouchableOpacity>
            {halaqat.map((h) => (
              <TouchableOpacity
                key={h._id}
                style={[
                  styles.filterChip,
                  filterHalaqah === h.name && styles.filterChipActive,
                ]}
                onPress={() => setFilterHalaqah(h.name)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filterHalaqah === h.name && styles.filterChipTextActive,
                  ]}
                >
                  {h.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && exams.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('examinations.loading')}</Text>
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
              <Ionicons name="document-text-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>{t('examinations.noResultsTitle')}</Text>
              <Text style={styles.emptyText}>{t('examinations.noResultsEmpty')}</Text>
            </View>
          }
        />
      )}

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

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        settings={settings}
        onSaved={async () => {
          await onSettingsChanged();
          setSettingsVisible(false);
        }}
      />
    </SafeAreaView>
  );
};

// ============================================================
// DETAILS MODAL
// ============================================================
const ExamDetailsModal: React.FC<{
  visible: boolean;
  exam: Exam | null;
  settings: ExamSettings | null;
  onClose: () => void;
  onEdit: (exam: Exam) => void;
  onTogglePublish: (exam: Exam) => void;
  onDelete: (exam: Exam) => void;
}> = ({ visible, exam, settings, onClose, onEdit, onTogglePublish, onDelete }) => {
  const { t } = useTranslation();
  if (!exam) return null;

  const formType = getExamFormType(exam);
  const pct = round2(exam.percentage || 0);
  const passing = exam.passingMark || exam.settings?.passingMark || 60;
  const examiners = exam.examiners || (exam.examiner ? [exam.examiner] : []);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{t('examinations.details.title')}</Text>
              <Text style={styles.modalSubtitle}>{exam.studentName}</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
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
                <Text style={styles.summaryScoreValue}>
                  {round2(exam.obtainedMarks || 0)}
                </Text>
                <Text style={styles.summaryScoreTotal}>/ {exam.totalMarks || 100}</Text>
              </View>

              <View style={styles.summaryProgress}>
                <View
                  style={[
                    styles.summaryProgressFill,
                    {
                      width: `${Math.min(pct, 100)}%`,
                      backgroundColor: pct >= passing ? COLORS.primary : COLORS.red,
                    },
                  ]}
                />
              </View>
              <Text style={styles.summaryPct}>
                {pct}% ·{' '}
                {exam.status === 'Pass'
                  ? t('examinations.status.pass')
                  : t('examinations.status.fail')}
              </Text>
            </View>

            <InfoRow
              label={t('examinations.details.formType')}
              value={
                formType === 'reading'
                  ? t('examinations.formTypes.reading')
                  : t('examinations.formTypes.memorization')
              }
              icon="book-outline"
            />
            <InfoRow
              label={t('examinations.details.date')}
              value={
                exam.dateGregorian
                  ? new Date(exam.dateGregorian).toLocaleDateString()
                  : exam.date
                  ? new Date(exam.date).toLocaleDateString()
                  : t('examinations.details.notAvailable')
              }
              icon="calendar-outline"
            />
            <InfoRow
              label={t('examinations.details.publish')}
              value={
                exam.isPublished
                  ? t('examinations.status.published')
                  : t('examinations.status.draft')
              }
              icon={exam.isPublished ? 'checkmark-circle-outline' : 'eye-off-outline'}
            />
            {exam.examScope ? (
              <InfoRow
                label={t('examinations.details.scope')}
                value={
                  exam.examScope === 'surah'
                    ? `${getSurahName(exam.fromSurah)} → ${getSurahName(exam.toSurah)}`
                    : `${getJuzName(exam.fromJuz)} → ${getJuzName(exam.toJuz)}`
                }
                icon="list-outline"
              />
            ) : null}

            {formType === 'memorization' && (exam.questions || []).length > 0 && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>
                  {t('examinations.details.questionBreakdown')}
                </Text>
                <View style={styles.table}>
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={[styles.tableCell, styles.tableHeaderText]}>
                      {t('examinations.table.q')}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableHeaderText]}>
                      {t('examinations.table.page')}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableHeaderText]}>
                      {t('examinations.table.fathi')}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableHeaderText]}>
                      {t('examinations.table.lahni')}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableHeaderText]}>
                      {t('examinations.table.ruju')}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableHeaderText]}>
                      {t('examinations.table.tajwid')}
                    </Text>
                  </View>
                  {(exam.questions || []).map((q, idx) => (
                    <View key={idx} style={styles.tableRow}>
                      <Text style={styles.tableCell}>{idx + 1}</Text>
                      <Text style={styles.tableCell}>{q.page || '-'}</Text>
                      <Text style={styles.tableCell}>{q.fathi}</Text>
                      <Text style={styles.tableCell}>{q.lahni}</Text>
                      <Text style={styles.tableCell}>{q.ruju || 0}</Text>
                      <Text style={styles.tableCell}>{q.tajwid}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {formType === 'reading' && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>
                  {t('examinations.details.readingTotals')}
                </Text>
                {(() => {
                  const headers =
                    exam.readingWritingHeaders ||
                    settings?.readingWritingHeaders ||
                    DEFAULT_READING_HEADERS;
                  const scores = exam.readingWritingScores || {};
                  const weights =
                    exam.readingWritingWeights ||
                    settings?.readingWritingWeights ||
                    DEFAULT_READING_WEIGHTS;
                  const skillHeaders = headers.filter(
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
                    readingTotal += parseFloat(String(scores[`${h.id}_reading`] ?? 0)) || 0;
                    writingTotal += parseFloat(String(scores[`${h.id}_writing`] ?? 0)) || 0;
                    hijaaTotal += parseFloat(String(scores[`${h.id}_hijaa`] ?? 0)) || 0;
                    ayahsTotal += parseFloat(String(scores[`${h.id}_ayahs`] ?? 0)) || 0;
                  });
                  const total = readingTotal + writingTotal + hijaaTotal + ayahsTotal;

                  return (
                    <View style={styles.readingStats}>
                      <ReadingStat
                        label={t('examinations.reading.reading')}
                        value={round2(readingTotal)}
                        max={weights.readingScore}
                        color={COLORS.blue}
                      />
                      <ReadingStat
                        label={t('examinations.reading.writing')}
                        value={round2(writingTotal)}
                        max={weights.writingScore}
                        color={COLORS.primary}
                      />
                      <ReadingStat
                        label={t('examinations.reading.hijaa')}
                        value={round2(hijaaTotal)}
                        max={weights.hijaa}
                        color={COLORS.amber}
                      />
                      <ReadingStat
                        label={t('examinations.reading.ayahs')}
                        value={round2(ayahsTotal)}
                        max={weights.ayahs}
                        color={COLORS.pink}
                      />
                      <ReadingStat
                        label={t('examinations.reading.total')}
                        value={round2(total)}
                        max={
                          weights.readingScore +
                          weights.writingScore +
                          weights.hijaa +
                          weights.ayahs
                        }
                        color={COLORS.purple}
                      />
                    </View>
                  );
                })()}
              </View>
            )}

            {(exam.notes?.positive || exam.notes?.negative) && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>
                  {t('examinations.details.notes')}
                </Text>
                {exam.notes?.positive ? (
                  <View style={[styles.noteBox, { backgroundColor: COLORS.primaryLight }]}>
                    <Text style={[styles.noteLabel, { color: COLORS.primary }]}>
                      {t('examinations.details.positive')}
                    </Text>
                    <Text style={styles.noteText}>{exam.notes.positive}</Text>
                  </View>
                ) : null}
                {exam.notes?.negative ? (
                  <View style={[styles.noteBox, { backgroundColor: COLORS.amberLight }]}>
                    <Text style={[styles.noteLabel, { color: COLORS.amber }]}>
                      {t('examinations.details.areasToImprove')}
                    </Text>
                    <Text style={styles.noteText}>{exam.notes.negative}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {examiners.length > 0 && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>
                  {t('examinations.details.committee')}
                </Text>
                {examiners.map((ex, idx) => (
                  <View key={idx} style={styles.committeeRow}>
                    <Ionicons name="person-outline" size={14} color={COLORS.purple} />
                    <Text style={styles.committeeName}>{ex}</Text>
                    <View style={styles.committeeLine} />
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.actionBtnOutline} onPress={() => onEdit(exam)}>
              <Ionicons name="create-outline" size={16} color={COLORS.primary} />
              <Text style={styles.actionBtnOutlineText}>
                {t('examinations.details.edit')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionBtnOutline,
                {
                  borderColor: exam.isPublished ? COLORS.amber : COLORS.primary,
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
                  { color: exam.isPublished ? COLORS.amber : COLORS.primary },
                ]}
              >
                {exam.isPublished
                  ? t('examinations.bulk.unpublish')
                  : t('examinations.bulk.publish')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnDanger} onPress={() => onDelete(exam)}>
              <Ionicons name="trash-outline" size={16} color={COLORS.red} />
              <Text style={styles.actionBtnDangerText}>
                {t('examinations.details.delete')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const ReadingStat: React.FC<{
  label: string;
  value: number;
  max: number;
  color: string;
}> = ({ label, value, max, color }) => (
  <View style={styles.readingStatTile}>
    <Text style={styles.readingStatLabel}>{label}</Text>
    <Text style={[styles.readingStatValue, { color }]}>
      {value} / {max}
    </Text>
  </View>
);

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
// SETTINGS MODAL
// ============================================================
const SettingsModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  settings: ExamSettings | null;
  onSaved: () => void;
}> = ({ visible, onClose, settings, onSaved }) => {
  const { t } = useTranslation();
  const [passingMark, setPassingMark] = useState('60');
  const [passingRW, setPassingRW] = useState('60');
  const [examTypes, setExamTypes] = useState<string[]>(DEFAULT_EXAM_TYPES);
  const [newType, setNewType] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPassingMark(String(settings?.passingMark ?? 60));
    setPassingRW(String(settings?.passingMarkReadingWriting ?? 60));
    setExamTypes(settings?.examTypes || DEFAULT_EXAM_TYPES);
    setNewType('');
  }, [visible, settings]);

  const addType = () => {
    const v = newType.trim();
    if (!v) return;
    if (examTypes.includes(v)) return;
    setExamTypes([...examTypes, v]);
    setNewType('');
  };

  const removeType = (v: string) => {
    setExamTypes(examTypes.filter((x) => x !== v));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.saveSettings({
        passingMark: parseInt(passingMark, 10) || 60,
        passingMarkReadingWriting: parseInt(passingRW, 10) || 60,
        examTypes,
      });
      onSaved();
    } catch (err: any) {
      Alert.alert(
        t('examinations.errorTitle'),
        err?.message || t('examinations.settings.saveFailed')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => !saving && onClose()}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{t('examinations.settings.title')}</Text>
              <Text style={styles.modalSubtitle}>
                {t('examinations.settings.subtitle')}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={onClose}
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
            <Text style={styles.formLabel}>
              {t('examinations.settings.passingMemorization')}
            </Text>
            <TextInput
              style={styles.formInput}
              value={passingMark}
              onChangeText={(v) => setPassingMark(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
            />

            <Text style={styles.formLabel}>
              {t('examinations.settings.passingReading')}
            </Text>
            <TextInput
              style={styles.formInput}
              value={passingRW}
              onChangeText={(v) => setPassingRW(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
            />

            <Text style={[styles.formLabel, { marginTop: 20 }]}>
              {t('examinations.settings.examTypes')}
            </Text>
            <View style={styles.chipRow}>
              {examTypes.map((typ) => (
                <View key={typ} style={styles.typeRow}>
                  <Text style={styles.typeRowText}>{typ}</Text>
                  <TouchableOpacity onPress={() => removeType(typ)}>
                    <Ionicons name="close-circle" size={16} color={COLORS.red} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.addTypeRow}>
              <TextInput
                style={[styles.formInput, { flex: 1 }]}
                value={newType}
                onChangeText={setNewType}
                placeholder={t('examinations.settings.newTypePlaceholder')}
                placeholderTextColor="#A0AAA5"
              />
              <TouchableOpacity style={styles.addTypeBtn} onPress={addType}>
                <Ionicons name="add" size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>
                {t('examinations.settings.cancel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={save}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>
                    {t('examinations.settings.save')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    paddingBottom: 8,
    gap: 10,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.slate },
  headerSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectionCount: { fontSize: 12, fontWeight: '700', color: COLORS.slateMuted },
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
  successText: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.primary },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 8 },
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
  filterRow: { paddingHorizontal: 16, paddingBottom: 6 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  filterChipText: { fontSize: 12, fontWeight: '700', color: COLORS.slateMuted },
  filterChipTextActive: { color: COLORS.primary },
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
  loadingWrap: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: COLORS.slateMuted, fontSize: 13 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },
  examCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  examCardSelected: { borderColor: COLORS.blue, backgroundColor: '#F0F7FF' },
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
  examTags: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
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
  examScoreTotal: { fontSize: 11, color: COLORS.slateMuted, marginBottom: 4 },
  progressRow: { width: 70, marginBottom: 4 },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '800' },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.slate, marginTop: 16 },
  emptyText: {
    fontSize: 13,
    color: COLORS.slateMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
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
  summaryScoreBox: { flexDirection: 'row', alignItems: 'baseline', marginTop: 12 },
  summaryScoreValue: { fontSize: 34, fontWeight: '800', color: COLORS.slate },
  summaryScoreTotal: { fontSize: 16, color: COLORS.slateMuted, marginLeft: 4 },
  summaryProgress: {
    width: '80%',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginTop: 10,
  },
  summaryProgressFill: { height: '100%', borderRadius: 4 },
  summaryPct: { fontSize: 13, fontWeight: '700', color: COLORS.slate, marginTop: 8 },
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
  infoValue: { fontSize: 14, color: COLORS.slate, fontWeight: '600', marginTop: 2 },
  block: { marginTop: 20 },
  blockTitle: { fontSize: 14, fontWeight: '800', color: COLORS.slate, marginBottom: 10 },
  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
  },
  tableHeader: { backgroundColor: COLORS.primaryLight },
  tableHeaderText: { fontWeight: '800', color: COLORS.primary },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableCell: {
    flex: 1,
    fontSize: 11,
    color: COLORS.slate,
    paddingVertical: 8,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  readingStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  readingStatTile: {
    flex: 1,
    minWidth: '30%',
    padding: 10,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  readingStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
  },
  readingStatValue: { fontSize: 14, fontWeight: '800', marginTop: 4 },
  noteBox: { padding: 12, borderRadius: 10, marginTop: 6 },
  noteLabel: { fontSize: 11, fontWeight: '800', marginBottom: 4 },
  noteText: { fontSize: 13, color: COLORS.slate },
  committeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  committeeName: { fontSize: 13, fontWeight: '600', color: COLORS.slate, flex: 1 },
  committeeLine: {
    flex: 1,
    height: 1,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: COLORS.gray,
  },
  modalActions: {
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
  actionBtnOutlineText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
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
  actionBtnDangerText: { fontSize: 13, fontWeight: '700', color: COLORS.red },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeRowText: { fontSize: 12, fontWeight: '700', color: COLORS.slate },
  addTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  addTypeBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
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