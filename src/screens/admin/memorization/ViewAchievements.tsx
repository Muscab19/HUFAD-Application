// src/screens/admin/memorization/ViewAchievements.tsx
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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  COLORS,
  ACHIEVEMENT_TYPES,
  Achievement,
  AchievementType,
  Student,
  api,
  getTypeInfo,
  getRangeDisplay,
  getStudentId,
  getStudentName,
} from './_shared';
import { api as apiClient } from '../../../api/client';

// ============================================================
// TYPES
// ============================================================
interface TopPerformer {
  studentId: string;
  studentName: string;
  halaqahName: string;
  totalAchievements: number;
  avgScore: number;
  firstAttempts: number;
  secondAttempts: number;
  thirdAttempts: number;
  fourthPlusAttempts: number;
  attemptScore: number | null;
  compositeScore: number;
  type: string;
  isSubacOrTashiih: boolean;
}

interface Stats {
  totalAchievements: number;
  avgScore: number;
  uniqueStudents: number;
  typeCounts: Record<string, number>;
  scoreDistribution?: Record<string, number>;
}

// ============================================================
// MAIN
// ============================================================
export const ViewAchievements: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'today' | 'top'>('today');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color={COLORS.slate} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('memorization.view.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('memorization.view.subtitle')}
          </Text>
        </View>
      </View>

      {/* TABS */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'today' && styles.tabActive]}
          onPress={() => setTab('today')}
        >
          <Ionicons
            name="calendar"
            size={14}
            color={tab === 'today' ? '#fff' : COLORS.slateMuted}
          />
          <Text style={[styles.tabText, tab === 'today' && styles.tabTextActive]}>
            {t('memorization.view.tabToday')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'top' && styles.tabActive]}
          onPress={() => setTab('top')}
        >
          <Ionicons
            name="trophy"
            size={14}
            color={tab === 'top' ? '#fff' : COLORS.slateMuted}
          />
          <Text style={[styles.tabText, tab === 'top' && styles.tabTextActive]}>
            {t('memorization.view.tabTop')}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'today' && <TodayAchievements />}
      {tab === 'top' && <TopPerformers />}
    </SafeAreaView>
  );
};

export default ViewAchievements;

// ============================================================
// TODAY TAB
// ============================================================
const TodayAchievements: React.FC = () => {
  const { t } = useTranslation();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [filterType, setFilterType] = useState<'all' | AchievementType>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const list = await api.getTodayAchievements({ date });
      setAchievements(list);
    } catch (err: any) {
      console.error('Load today error:', err);
      setError(err?.message || t('memorization.view.loadFailed'));
      setAchievements([]);
    } finally {
      setLoading(false);
    }
  }, [date, t]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filterType === 'all') return achievements;
    return achievements.filter((a) => a.type === filterType);
  }, [achievements, filterType]);

  const stats = useMemo<Stats>(() => {
    const total = achievements.length;
    const avg =
      total > 0
        ? Math.round(
            (achievements.reduce((s, a) => s + (a.score || 0), 0) / total) * 10
          ) / 10
        : 0;
    const uniq = new Set(achievements.map((a) => getStudentId(a))).size;
    const counts: Record<string, number> = {};
    achievements.forEach((a) => {
      counts[a.type] = (counts[a.type] || 0) + 1;
    });
    return {
      totalAchievements: total,
      avgScore: avg,
      uniqueStudents: uniq,
      typeCounts: counts,
    };
  }, [achievements]);

  const activeTypeLabel =
    filterType === 'all'
      ? ''
      : t('memorization.view.noAchievementsType', {
          type: getTypeInfo(filterType, t).label,
        });

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.viewContent}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={load}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Date + filter */}
      <View style={styles.controlRow}>
        <Ionicons name="calendar-outline" size={16} color={COLORS.slateMuted} />
        <TextInput
          style={styles.dateInput}
          value={date}
          onChangeText={setDate}
          placeholder={t('memorization.view.datePlaceholder')}
          placeholderTextColor="#A0AAA5"
        />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Stats */}
      <View style={styles.statsGrid}>
        <View style={[styles.statTile, { backgroundColor: COLORS.blueLight }]}>
          <Text style={[styles.statValue, { color: COLORS.blue }]}>
            {stats.totalAchievements}
          </Text>
          <Text style={styles.statLabel}>
            {t('memorization.view.statsRecords')}
          </Text>
        </View>
        <View style={[styles.statTile, { backgroundColor: COLORS.primaryLight }]}>
          <Text style={[styles.statValue, { color: COLORS.primary }]}>
            {stats.avgScore}/10
          </Text>
          <Text style={styles.statLabel}>
            {t('memorization.view.statsAvgScore')}
          </Text>
        </View>
        <View style={[styles.statTile, { backgroundColor: COLORS.purpleLight }]}>
          <Text style={[styles.statValue, { color: COLORS.purple }]}>
            {stats.uniqueStudents}
          </Text>
          <Text style={styles.statLabel}>
            {t('memorization.view.statsStudents')}
          </Text>
        </View>
      </View>

      {/* Type filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 44 }}
        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
      >
        <TouchableOpacity
          style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
          onPress={() => setFilterType('all')}
        >
          <Text
            style={[
              styles.filterChipText,
              filterType === 'all' && styles.filterChipTextActive,
            ]}
          >
            {t('memorization.view.allCount', { count: achievements.length })}
          </Text>
        </TouchableOpacity>
        {ACHIEVEMENT_TYPES.map((type) => {
          const count = stats.typeCounts[type.value] || 0;
          if (count === 0 && filterType !== type.value) return null;
          const active = filterType === type.value;
          return (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.filterChip,
                active && { backgroundColor: type.color, borderColor: type.color },
              ]}
              onPress={() => setFilterType(type.value)}
            >
              <Text
                style={[styles.filterChipText, active && styles.filterChipTextActive]}
              >
                {t(type.labelKey)} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {loading && achievements.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('memorization.view.loading')}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="trophy-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>
            {t('memorization.view.noAchievementsTitle')}
          </Text>
          <Text style={styles.emptyText}>
            {t('memorization.view.noAchievementsText', {
              date,
              type: activeTypeLabel,
            })}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8, marginTop: 8 }}>
          {filtered.map((a) => {
            const typeInfo = getTypeInfo(a.type, t);
            return (
              <View key={a._id} style={styles.achievementCard}>
                <View
                  style={[
                    styles.achievementIcon,
                    { backgroundColor: typeInfo.bg },
                  ]}
                >
                  <Ionicons name={typeInfo.icon} size={18} color={typeInfo.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.achievementHeader}>
                    <Text style={styles.achievementStudent} numberOfLines={1}>
                      {getStudentName(a, t)}
                    </Text>
                    <View
                      style={[styles.scoreBadge, { backgroundColor: typeInfo.bg }]}
                    >
                      <Text
                        style={[styles.scoreText, { color: typeInfo.color }]}
                      >
                        {a.score}/{a.type === 'subac' ? a.totalMarks || 100 : 10}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.achievementType}>{typeInfo.label}</Text>
                  <Text style={styles.achievementRange} numberOfLines={1}>
                    {getRangeDisplay(a, t)}
                  </Text>
                  {a.comment ? (
                    <Text style={styles.achievementComment} numberOfLines={1}>
                      "{a.comment}"
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

// ============================================================
// TOP PERFORMERS TAB
// ============================================================
const TopPerformers: React.FC = () => {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<AchievementType>('memorization');
  const [performers, setPerformers] = useState<TopPerformer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res: any = await apiClient.get('/memorizations/top-performers', {
        startDate,
        endDate,
        type: filterType,
        limit: 10,
      });
      const list: TopPerformer[] = Array.isArray(res) ? res : res?.data || [];
      setPerformers(list);
    } catch (err: any) {
      console.error('Load top performers error:', err);
      setError(err?.message || t('memorization.view.loadTopFailed'));
      setPerformers([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterType, t]);

  useEffect(() => {
    load();
  }, [load]);

  const activeTypeLabel = getTypeInfo(filterType, t).label;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.viewContent}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={load}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Date range */}
      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <Text style={styles.miniLabel}>
            {t('memorization.view.from')}
          </Text>
          <TextInput
            style={styles.formInput}
            value={startDate}
            onChangeText={setStartDate}
            placeholder={t('memorization.view.datePlaceholder')}
            placeholderTextColor="#A0AAA5"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.miniLabel}>{t('memorization.view.to')}</Text>
          <TextInput
            style={styles.formInput}
            value={endDate}
            onChangeText={setEndDate}
            placeholder={t('memorization.view.datePlaceholder')}
            placeholderTextColor="#A0AAA5"
          />
        </View>
      </View>

      {/* Type chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 44, marginTop: 8 }}
        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
      >
        {ACHIEVEMENT_TYPES.map((type) => {
          const active = filterType === type.value;
          return (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.filterChip,
                active && { backgroundColor: type.color, borderColor: type.color },
              ]}
              onPress={() => setFilterType(type.value)}
            >
              <Text
                style={[styles.filterChipText, active && styles.filterChipTextActive]}
              >
                {t(type.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* List */}
      {loading && performers.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('memorization.view.loadingTop')}
          </Text>
        </View>
      ) : performers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="trophy-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>
            {t('memorization.view.noTopTitle')}
          </Text>
          <Text style={styles.emptyText}>
            {t('memorization.view.noTopText', {
              type: activeTypeLabel,
              start: startDate,
              end: endDate,
            })}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8, marginTop: 12 }}>
          {performers.map((p, idx) => {
            const medal =
              idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
            const attemptSuffix =
              !p.isSubacOrTashiih && p.attemptScore !== null
                ? ` · ${t('memorization.view.attemptPct', { pct: p.attemptScore })}`
                : '';
            return (
              <View key={p.studentId} style={styles.performerRow}>
                <View
                  style={[
                    styles.performerRank,
                    idx === 0 && { backgroundColor: COLORS.gold },
                    idx === 1 && { backgroundColor: COLORS.gray },
                    idx === 2 && { backgroundColor: '#B45309' },
                  ]}
                >
                  {medal ? (
                    <Text style={{ fontSize: 14 }}>{medal}</Text>
                  ) : (
                    <Text
                      style={[
                        styles.performerRankText,
                        idx < 3 && { color: '#fff' },
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.performerName} numberOfLines={1}>
                    {p.studentName}
                  </Text>
                  <Text style={styles.performerMeta} numberOfLines={1}>
                    {p.halaqahName || t('memorization.record.noHalaqah')} ·{' '}
                    {p.totalAchievements} {t('memorization.view.recordsSuffix')}
                    {attemptSuffix}
                  </Text>
                </View>
                <View style={styles.performerRight}>
                  <Text style={styles.performerScore}>{p.compositeScore}%</Text>
                  <Text style={styles.performerAvg}>{p.avgScore}/10</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
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

  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.slateMuted },
  tabTextActive: { color: '#fff' },

  viewContent: { padding: 16, paddingTop: 8 },

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
    marginBottom: 12,
  },
  dateInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.slate,
    paddingVertical: 0,
  },
  twoCol: { flexDirection: 'row', gap: 10 },
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

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginTop: 12,
    backgroundColor: COLORS.redLight,
    borderWidth: 1,
    borderColor: '#F6C8C8',
    borderRadius: 12,
  },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.red },

  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statTile: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: {
    fontSize: 10,
    color: COLORS.slateMuted,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },

  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: { fontSize: 12, fontWeight: '700', color: COLORS.slateMuted },
  filterChipTextActive: { color: '#fff' },

  loadingWrap: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, color: COLORS.slateMuted, fontSize: 13 },

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

  achievementCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  achievementStudent: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate,
    flex: 1,
  },
  scoreBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  scoreText: { fontSize: 11, fontWeight: '800' },
  achievementType: {
    fontSize: 11,
    color: COLORS.slateMuted,
    fontWeight: '700',
    marginTop: 2,
  },
  achievementRange: {
    fontSize: 12,
    color: COLORS.slate,
    marginTop: 2,
  },
  achievementComment: {
    fontSize: 11,
    color: COLORS.gray,
    fontStyle: 'italic',
    marginTop: 2,
  },

  performerRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  performerRank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  performerRankText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slateMuted,
  },
  performerName: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  performerMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  performerRight: { alignItems: 'flex-end' },
  performerScore: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  performerAvg: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
});