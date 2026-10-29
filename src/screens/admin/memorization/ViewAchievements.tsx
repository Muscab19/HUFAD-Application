// src/screens/admin/memorization/ViewAchievements.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
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
  SubacGroup,
  api,
  groupApi,
  getTypeInfo,
  getRangeDisplay,
  getStudentId,
  getStudentName,
} from './_shared';

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
}

type Tab = 'today' | 'monthly' | 'subac' | 'top';

// ============================================================
// SHELL
// ============================================================
export const ViewAchievements: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('today');

  const tabs: { id: Tab; labelKey: string; icon: any }[] = [
    { id: 'today', labelKey: 'memorization.view.tabToday', icon: 'calendar-outline' },
    { id: 'monthly', labelKey: 'memorization.view.tabMonthly', icon: 'trending-up-outline' },
    { id: 'subac', labelKey: 'memorization.view.tabSubac', icon: 'people-outline' },
    { id: 'top', labelKey: 'memorization.view.tabTop', icon: 'trophy-outline' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color={COLORS.slate} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('memorization.view.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('memorization.view.subtitle')}</Text>
        </View>
      </View>

      {/* Tabs — proper pill row, horizontally scrollable */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {tabs.map((tb) => {
          const active = tab === tb.id;
          return (
            <TouchableOpacity
              key={tb.id}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(tb.id)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tb.icon}
                size={15}
                color={active ? '#fff' : COLORS.slateMuted}
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t(tb.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={{ flex: 1 }}>
        {tab === 'today' && <TodayAchievements />}
        {tab === 'monthly' && <MonthlyReport />}
        {tab === 'subac' && <SubacReport />}
        {tab === 'top' && <TopPerformers />}
      </View>
    </SafeAreaView>
  );
};

export default ViewAchievements;

// ============================================================
// SHARED: DatePicker row
// ============================================================
const DateRow: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => (
  <View style={styles.dateRow}>
    <View style={styles.dateIconBadge}>
      <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
    </View>
    <TextInput
      style={styles.dateInput}
      value={value}
      onChangeText={onChange}
      placeholder="YYYY-MM-DD"
      placeholderTextColor="#A0AAA5"
      autoCorrect={false}
    />
  </View>
);

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
      setError(err?.message || t('memorization.view.loadFailed'));
      setAchievements([]);
    } finally {
      setLoading(false);
    }
  }, [date, t]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (filterType === 'all') return achievements;
    return achievements.filter((a) => a.type === filterType);
  }, [achievements, filterType]);

  const stats = useMemo<Stats>(() => {
    const total = achievements.length;
    const avg = total > 0
      ? Math.round(
          (achievements.reduce((s, a) => s + (a.score || 0), 0) / total) * 10
        ) / 10
      : 0;
    const uniq = new Set(achievements.map((a) => getStudentId(a))).size;
    const counts: Record<string, number> = {};
    achievements.forEach((a) => {
      counts[a.type] = (counts[a.type] || 0) + 1;
    });
    return { totalAchievements: total, avgScore: avg, uniqueStudents: uniq, typeCounts: counts };
  }, [achievements]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.viewContent}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      <DateRow value={date} onChange={setDate} />

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Stat tiles — proper proportions */}
      <View style={styles.statsGrid}>
        <StatTile
          icon="albums-outline"
          color={COLORS.blue}
          bg={COLORS.blueLight}
          value={stats.totalAchievements}
          label={t('memorization.view.statsRecords')}
        />
        <StatTile
          icon="star-outline"
          color={COLORS.primary}
          bg={COLORS.primaryLight}
          value={`${stats.avgScore}`}
          suffix="/10"
          label={t('memorization.view.statsAvgScore')}
        />
        <StatTile
          icon="people-outline"
          color={COLORS.purple}
          bg={COLORS.purpleLight}
          value={stats.uniqueStudents}
          label={t('memorization.view.statsStudents')}
        />
      </View>

      {/* Type filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRowScroll}
      >
        <TouchableOpacity
          style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
          onPress={() => setFilterType('all')}
          activeOpacity={0.8}
        >
          <Text
            style={[styles.filterChipText, filterType === 'all' && styles.filterChipTextActive]}
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
              activeOpacity={0.8}
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

      {loading && achievements.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('memorization.view.loading')}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title={t('memorization.view.noAchievementsTitle')}
          text={t('memorization.view.noAchievementsText', { date, type: '' })}
        />
      ) : (
        <View style={styles.listStack}>
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

                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.achievementTopRow}>
                    <Text style={styles.achievementStudent} numberOfLines={1}>
                      {getStudentName(a, t)}
                    </Text>
                    <View
                      style={[
                        styles.scoreBadge,
                        { backgroundColor: typeInfo.bg },
                      ]}
                    >
                      <Text style={[styles.scoreBadgeText, { color: typeInfo.color }]}>
                        {a.score}/{a.type === 'subac' ? a.totalMarks || 100 : 10}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.achievementMetaRow}>
                    <View
                      style={[styles.typeTag, { backgroundColor: typeInfo.bg }]}
                    >
                      <Text style={[styles.typeTagText, { color: typeInfo.color }]}>
                        {typeInfo.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.achievementRange} numberOfLines={1}>
                    {getRangeDisplay(a, t)}
                  </Text>

                  {a.comment ? (
                    <View style={styles.commentRow}>
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={12}
                        color={COLORS.slateMuted}
                      />
                      <Text style={styles.achievementComment} numberOfLines={1}>
                        {a.comment}
                      </Text>
                    </View>
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
// STAT TILE
// ============================================================
const StatTile: React.FC<{
  icon: any;
  color: string;
  bg: string;
  value: number | string;
  suffix?: string;
  label: string;
}> = ({ icon, color, bg, value, suffix, label }) => (
  <View style={styles.statTile}>
    <View style={[styles.statIcon, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={16} color={color} />
    </View>
    <View style={styles.statValueRow}>
      <Text style={[styles.statValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      {suffix ? <Text style={[styles.statSuffix, { color }]}>{suffix}</Text> : null}
    </View>
    <Text style={styles.statLabel} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

// ============================================================
// EMPTY STATE
// ============================================================
const EmptyState: React.FC<{ icon: any; title: string; text?: string }> = ({
  icon,
  title,
  text,
}) => (
  <View style={styles.emptyContainer}>
    <View style={styles.emptyIconWrap}>
      <Ionicons name={icon} size={34} color="#B7C4BD" />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    {text ? <Text style={styles.emptyText}>{text}</Text> : null}
  </View>
);

// ============================================================
// MONTHLY TAB
// ============================================================
const MonthlyReport: React.FC = () => {
  const { t } = useTranslation();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [filterType, setFilterType] = useState<'all' | AchievementType>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [studentList] = await Promise.all([api.getStudents('all')]);

      const dates: string[] = [];
      const cur = new Date(startDate);
      const end = new Date(endDate);
      while (cur <= end) {
        dates.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
      }
      const all: Achievement[] = [];
      const batchSize = 7;
      for (let i = 0; i < dates.length; i += batchSize) {
        const batch = dates.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((d) =>
            api.getTodayAchievements({ date: d }).catch(() => [] as Achievement[])
          )
        );
        results.forEach((r) => all.push(...r));
      }
      setStudents(studentList);
      setAchievements(all);
    } catch (err: any) {
      setError(err?.message || t('memorization.view.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, t]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    return students.map((s) => {
      const list = achievements.filter((a) => {
        if (getStudentId(a) !== s._id) return false;
        if (filterType !== 'all' && a.type !== filterType) return false;
        return true;
      });
      const count = list.length;
      const avg = count
        ? Math.round(
            (list.reduce((sum, x) => sum + (x.score || 0), 0) / count) * 10
          ) / 10
        : 0;
      const days = new Set(list.map((x) => new Date(x.date).toDateString())).size;
      return { student: s, count, avg, activeDays: days };
    }).sort((a, b) => b.count - a.count);
  }, [students, achievements, filterType]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.viewContent}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <Text style={styles.miniLabel}>{t('memorization.view.from')}</Text>
          <TextInput
            style={styles.formInput}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#A0AAA5"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.miniLabel}>{t('memorization.view.to')}</Text>
          <TextInput
            style={styles.formInput}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#A0AAA5"
          />
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRowScroll}
      >
        <TouchableOpacity
          style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
          onPress={() => setFilterType('all')}
        >
          <Text
            style={[styles.filterChipText, filterType === 'all' && styles.filterChipTextActive]}
          >
            {t('memorization.view.allTypes') || 'All'}
          </Text>
        </TouchableOpacity>
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

      {loading && rows.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <View style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <Text style={[styles.thCell, { flex: 2.6 }]}>
              {t('memorization.view.student')}
            </Text>
            <Text style={[styles.thCell, { flex: 1, textAlign: 'center' }]}>
              {t('memorization.view.achievements')}
            </Text>
            <Text style={[styles.thCell, { flex: 1, textAlign: 'center' }]}>
              {t('memorization.view.avgScore')}
            </Text>
            <Text style={[styles.thCell, { flex: 1, textAlign: 'center' }]}>
              {t('memorization.view.activeDays')}
            </Text>
          </View>

          {rows.map((r, idx) => (
            <View
              key={r.student._id}
              style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
            >
              <View style={{ flex: 2.6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.tableAvatar}>
                  <Text style={styles.tableAvatarText}>
                    {(r.student.name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.tableName} numberOfLines={1}>
                  {r.student.name}
                </Text>
              </View>
              <Text style={[styles.tdCell, { flex: 1, textAlign: 'center' }]}>
                {r.count}
              </Text>
              <Text
                style={[
                  styles.tdCell,
                  { flex: 1, textAlign: 'center', color: r.avg >= 8 ? COLORS.primary : r.avg >= 5 ? COLORS.amber : COLORS.red },
                ]}
              >
                {r.count ? `${r.avg}/10` : '—'}
              </Text>
              <Text style={[styles.tdCell, { flex: 1, textAlign: 'center' }]}>
                {r.activeDays}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

// ============================================================
// SUBAC TAB
// ============================================================
const SubacReport: React.FC = () => {
  const { t } = useTranslation();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [groups, setGroups] = useState<SubacGroup[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, studentList, groupList] = await Promise.all([
        api.getTodayAchievements({ date }),
        api.getStudents('all'),
        groupApi.list(),
      ]);
      setAchievements(list);
      setStudents(studentList);
      setGroups(groupList.filter((g) => g.type === 'subac'));
    } catch (err: any) {
      setError(err?.message || t('memorization.view.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [date, t]);

  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.viewContent}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      <DateRow value={date} onChange={setDate} />

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={t('memorization.view.noGroupsTitle') || 'No Subac groups'}
          text={t('memorization.view.noGroupsText') || 'Create groups in the Record tab.'}
        />
      ) : (
        <View style={styles.listStack}>
          {groups.map((g) => {
            const records = achievements.filter((a) => {
              if (a.type !== 'subac') return false;
              if (a.groupId !== g.id) return false;
              return true;
            });
            const avg =
              records.length > 0
                ? Math.round(
                    (records.reduce((sum, x) => sum + (x.score || 0), 0) /
                      records.length) *
                      10
                  ) / 10
                : 0;
            const memberName = (id: string) =>
              students.find((s) => s._id === id)?.name || 'Unknown';

            return (
              <View key={g.id} style={styles.subacCard}>
                <View style={styles.subacHeader}>
                  <View style={styles.subacIcon}>
                    <Ionicons name="people" size={16} color={COLORS.purple} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.subacTitle} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <Text style={styles.subacMeta}>
                      {g.members.length} {t('memorization.members') || 'members'} ·{' '}
                      {records.length} {t('memorization.records') || 'records'}
                    </Text>
                  </View>
                  <View style={styles.subacScoreBadge}>
                    <Text style={styles.subacScoreText}>{avg}</Text>
                    <Text style={styles.subacScoreSub}>/10</Text>
                  </View>
                </View>

                <View style={styles.subacDivider} />

                {g.members.map((mid, idx) => {
                  const rec = records.find((r) => getStudentId(r) === mid);
                  return (
                    <View
                      key={mid}
                      style={[styles.subacMemberRow, idx % 2 === 1 && styles.subacMemberRowAlt]}
                    >
                      <View style={styles.subacMemberAvatar}>
                        <Text style={styles.subacMemberAvatarText}>
                          {memberName(mid).charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.subacMemberName} numberOfLines={1}>
                        {memberName(mid)}
                      </Text>
                      {rec ? (
                        <>
                          <View style={styles.dotPillsRow}>
                            <DotPill label="F" count={rec.fathi?.length || 0} />
                            <DotPill label="L" count={rec.lahni?.length || 0} />
                            <DotPill label="T" count={rec.tajwid?.length || 0} />
                            <DotPill label="A" count={rec.ada?.length || 0} />
                            <DotPill label="B" count={rec.behavior?.length || 0} />
                          </View>
                          <Text style={styles.subacMemberScore}>
                            {rec.score}/{rec.totalMarks || 100}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.subacMemberMissing}>—</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

const DotPill: React.FC<{ label: string; count: number }> = ({ label, count }) => {
  const tone =
    count === 0
      ? { bg: COLORS.primaryLight, fg: COLORS.primary }
      : count <= 2
      ? { bg: COLORS.amberLight, fg: COLORS.amber }
      : { bg: COLORS.redLight, fg: COLORS.red };
  return (
    <View style={[styles.dotPill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.dotPillText, { color: tone.fg }]}>
        {label}
        {count}
      </Text>
    </View>
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
      const res = await api.getTopPerformers({
        startDate,
        endDate,
        type: filterType,
        limit: 10,
      });
      setPerformers(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err?.message || t('memorization.view.loadTopFailed'));
      setPerformers([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterType, t]);

  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.viewContent}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <Text style={styles.miniLabel}>{t('memorization.view.from')}</Text>
          <TextInput
            style={styles.formInput}
            value={startDate}
            onChangeText={setStartDate}
            placeholderTextColor="#A0AAA5"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.miniLabel}>{t('memorization.view.to')}</Text>
          <TextInput
            style={styles.formInput}
            value={endDate}
            onChangeText={setEndDate}
            placeholderTextColor="#A0AAA5"
          />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRowScroll}
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

      {loading && performers.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : performers.length === 0 ? (
        <EmptyState icon="trophy-outline" title={t('memorization.view.noTopTitle')} />
      ) : (
        <View style={styles.listStack}>
          {performers.map((p, idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
            const rankBg =
              idx === 0
                ? COLORS.gold
                : idx === 1
                ? '#8E9AA5'
                : idx === 2
                ? '#B45309'
                : COLORS.background;
            return (
              <View key={p.studentId} style={styles.performerRow}>
                <View style={[styles.performerRank, { backgroundColor: rankBg }]}>
                  {medal ? (
                    <Text style={{ fontSize: 16 }}>{medal}</Text>
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
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.performerName} numberOfLines={1}>
                    {p.studentName}
                  </Text>
                  <Text style={styles.performerMeta} numberOfLines={1}>
                    {p.halaqahName || t('memorization.record.noHalaqah')} ·{' '}
                    {p.totalAchievements} {t('memorization.view.recordsSuffix')}
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
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.slate },
  headerSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },

  // Tabs
  tabsRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 12,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
    height: 36,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: { fontSize: 12.5, fontWeight: '700', color: COLORS.slateMuted },
  tabTextActive: { color: '#fff' },

  // Content
  viewContent: { padding: 16, paddingTop: 4, paddingBottom: 40 },
  listStack: { gap: 10, marginTop: 8 },

  // Date
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    height: 48,
    gap: 10,
    marginBottom: 12,
  },
  dateIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateInput: { flex: 1, fontSize: 14, color: COLORS.slate, paddingVertical: 0 },

  // Stat tiles
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statTile: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 6,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statSuffix: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  statLabel: {
    fontSize: 10,
    color: COLORS.slateMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Chips
  chipRowScroll: {
    gap: 8,
    paddingVertical: 4,
    paddingBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 32,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: { fontSize: 12, fontWeight: '700', color: COLORS.slateMuted },
  filterChipTextActive: { color: '#fff' },

  // Error / Loading / Empty
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: COLORS.redLight,
    borderWidth: 1,
    borderColor: '#F6C8C8',
    borderRadius: 12,
  },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.red },
  loadingWrap: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, color: COLORS.slateMuted, fontSize: 13 },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.slate,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 12.5,
    color: COLORS.slateMuted,
    textAlign: 'center',
    lineHeight: 19,
  },

  // Achievement card
  achievementCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  achievementStudent: {
    fontSize: 14.5,
    fontWeight: '800',
    color: COLORS.slate,
    flex: 1,
  },
  scoreBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  scoreBadgeText: { fontSize: 11.5, fontWeight: '800' },
  achievementMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  typeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeTagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  achievementRange: {
    fontSize: 12.5,
    color: COLORS.slate,
    marginTop: 5,
    fontWeight: '600',
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  achievementComment: {
    fontSize: 11.5,
    color: COLORS.slateMuted,
    fontStyle: 'italic',
    flex: 1,
  },

  // Tables
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

  tableCard: {
    marginTop: 12,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
  },
  thCell: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tableRowAlt: { backgroundColor: '#FAFCFB' },
  tableAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableAvatarText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  tableName: { fontSize: 13, color: COLORS.slate, fontWeight: '700', flex: 1 },
  tdCell: { fontSize: 12.5, color: COLORS.slate, fontWeight: '600' },

  // Subac card
  subacCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  subacHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  subacIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subacTitle: { fontSize: 14.5, fontWeight: '800', color: COLORS.slate },
  subacMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  subacScoreBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 1,
  },
  subacScoreText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  subacScoreSub: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  subacDivider: { height: 1, backgroundColor: COLORS.background },
  subacMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  subacMemberRowAlt: { backgroundColor: '#FAFCFB' },
  subacMemberAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subacMemberAvatarText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.slate,
  },
  subacMemberName: {
    fontSize: 12.5,
    color: COLORS.slate,
    flex: 1,
    fontWeight: '600',
  },
  dotPillsRow: { flexDirection: 'row', gap: 3 },
  dotPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 22,
    alignItems: 'center',
  },
  dotPillText: { fontSize: 10, fontWeight: '800' },
  subacMemberScore: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    minWidth: 44,
    textAlign: 'right',
  },
  subacMemberMissing: { fontSize: 12, color: '#CBD5E1' },

  // Performer
  performerRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  performerRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  performerRankText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slateMuted,
  },
  performerName: { fontSize: 14, fontWeight: '800', color: COLORS.slate },
  performerMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  performerRight: { alignItems: 'flex-end' },
  performerScore: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  performerAvg: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
});