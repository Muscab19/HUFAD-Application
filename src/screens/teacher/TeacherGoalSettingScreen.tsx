// src/screens/teacher/TeacherGoalSettingScreen.tsx
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
import { api as apiClient } from '../../api/client';

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
  red: '#DC2626',
  redLight: '#FEE9E9',
  amber: '#D97706',
  amberLight: '#FEF3C7',
  gold: '#C9A227',
  goldLight: '#FFF7DF',
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
interface Task {
  title?: string;
  completed?: boolean;
  pendingApproval?: boolean;
}

interface Goal {
  _id: string;
  title: string;
  description?: string;
  targetType?: 'Teacher' | 'Halaqah' | 'Both';
  assignedTo?: string;
  assignedToName?: string;
  timeframe?: string;
  priority?: string;
  status?: string;
  progress?: number;
  startDate?: string;
  endDate?: string;
  tasks?: Task[];
  notes?: string;
}

// ============================================================
// HELPERS
// ============================================================
const STATUS_BG: Record<string, { bg: string; text: string }> = {
  Pending: { bg: '#F1F5F9', text: '#475569' },
  'In Progress': { bg: COLORS.amberLight, text: COLORS.amber },
  Completed: { bg: COLORS.primaryLight, text: COLORS.primary },
  Overdue: { bg: COLORS.redLight, text: COLORS.red },
  Extended: { bg: COLORS.blueLight, text: COLORS.blue },
  Cancelled: { bg: '#E2E8F0', text: '#64748B' },
  'Pending Approval': { bg: COLORS.purpleLight, text: COLORS.purple },
};

const PRIORITY_BG: Record<string, { bg: string; text: string }> = {
  Low: { bg: COLORS.blueLight, text: COLORS.blue },
  Medium: { bg: COLORS.amberLight, text: COLORS.amber },
  High: { bg: '#FED7AA', text: '#C2410C' },
  Critical: { bg: COLORS.redLight, text: COLORS.red },
};

const STATUS_KEY: Record<string, string> = {
  Pending: 'pending',
  'In Progress': 'inProgress',
  Completed: 'completed',
  Overdue: 'overdue',
  Extended: 'extended',
  Cancelled: 'cancelled',
  'Pending Approval': 'pendingApproval',
};

const PRIORITY_KEY: Record<string, string> = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical',
};

const TIMEFRAME_KEY: Record<string, string> = {
  Daily: 'daily',
  Weekly: 'weekly',
  Monthly: 'monthly',
  Yearly: 'yearly',
};

const TARGET_KEY: Record<string, string> = {
  Teacher: 'teacher',
  Halaqah: 'halaqah',
  Both: 'both',
};

// ============================================================
// SCREEN
// ============================================================
export const TeacherGoalSettingScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  // Data
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // UI
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterTimeframe, setFilterTimeframe] = useState('All');
  const [filterTarget, setFilterTarget] = useState('All');

  // Modals
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [extendForm, setExtendForm] = useState({ newEndDate: '', reason: '' });

  // ============================================================
  // FLASH
  // ============================================================
  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };
  const flashError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };

  // ============================================================
  // FETCH
  // ============================================================
  const fetchGoals = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setIsLoading(true);
      setError('');
      try {
        const res: any = await apiClient.get('/goals');
        const data = res?.data?.goals || res?.data || res || [];
        setGoals(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error('Fetch goals error:', err);
        flashError(err?.message || t('teacher.goals.alerts.failedToLoadGoals'));
        setGoals([]);
      } finally {
        if (showSpinner) setIsLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGoals(false);
    setRefreshing(false);
  };

  // ============================================================
  // STATS
  // ============================================================
  const stats = useMemo(
    () => ({
      total: goals.length,
      active: goals.filter((g) => g.status === 'In Progress').length,
      overdue: goals.filter((g) => g.status === 'Overdue').length,
      completed: goals.filter((g) => g.status === 'Completed').length,
      pendingApproval: goals.filter((g) => g.status === 'Pending Approval')
        .length,
    }),
    [goals]
  );

  // ============================================================
  // FILTERS
  // ============================================================
  const filteredGoals = useMemo(() => {
    let result = [...goals];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (g) =>
          g.title?.toLowerCase().includes(q) ||
          g.description?.toLowerCase().includes(q) ||
          g.assignedToName?.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'All') result = result.filter((g) => g.status === filterStatus);
    if (filterPriority !== 'All')
      result = result.filter((g) => g.priority === filterPriority);
    if (filterTimeframe !== 'All')
      result = result.filter((g) => g.timeframe === filterTimeframe);
    if (filterTarget !== 'All')
      result = result.filter((g) => g.targetType === filterTarget);

    return result;
  }, [goals, searchTerm, filterStatus, filterPriority, filterTimeframe, filterTarget]);

  // ============================================================
  // TASK / GOAL HELPERS
  // ============================================================
  const getTaskText = (task: Task | string): string =>
    typeof task === 'string' ? task : task.title || '';

  const getTaskCompleted = (task: Task | string): boolean =>
    typeof task === 'string' ? false : !!task.completed;

  const getTaskPending = (task: Task | string): boolean =>
    typeof task === 'string' ? false : !!task.pendingApproval;

  const completedTasks = (g: Goal) =>
    (g.tasks || []).filter((tk) => getTaskCompleted(tk)).length;

  const totalTasks = (g: Goal) => (g.tasks || []).length;

  const getAssigneeName = (g: Goal): string => {
    if (g.targetType === 'Both') return t('teacher.goals.allTeachersAndHalaqahs');
    if (g.assignedToName) return g.assignedToName;
    return t('teacher.goals.unknown');
  };

  // ============================================================
  // TEACHER ACTIONS
  // ============================================================
  const requestTaskComplete = async (goal: Goal, taskIndex: number) => {
    try {
      setIsProcessing(true);
      const task = goal.tasks?.[taskIndex];
      if (!task) return;

      if (getTaskCompleted(task)) {
        flashError(t('teacher.goals.alerts.taskAlreadyCompleted'));
        return;
      }
      if (getTaskPending(task)) {
        flashError(t('teacher.goals.alerts.taskAlreadyPending'));
        return;
      }

      await apiClient.patch(
        `/goals/${goal._id}/task/${taskIndex}/request-complete`
      );
      flashSuccess(t('teacher.goals.alerts.taskRequestSent'));
      await fetchGoals(false);
    } catch (err: any) {
      flashError(
        err?.message || t('teacher.goals.alerts.failedToRequestTaskCompletion')
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const requestGoalComplete = (goal: Goal) => {
    Alert.alert(
      t('teacher.goals.requestComplete'),
      `${goal.title}\n\n${t('teacher.goals.alerts.requestSentMsg')}`,
      [
        { text: t('teacher.goals.cancel'), style: 'cancel' },
        {
          text: t('teacher.goals.requestComplete'),
          onPress: async () => {
            try {
              setIsProcessing(true);
              if (goal.status === 'Completed') {
                flashError(t('teacher.goals.alerts.alreadyCompleted'));
                return;
              }
              if (goal.status === 'Pending Approval') {
                flashError(t('teacher.goals.alerts.alreadyPending'));
                return;
              }
              await apiClient.patch(`/goals/${goal._id}/request-complete`);
              flashSuccess(t('teacher.goals.alerts.goalRequestSent'));
              setShowDetails(false);
              setSelectedGoal(null);
              await fetchGoals(false);
            } catch (err: any) {
              flashError(
                err?.message ||
                  t('teacher.goals.alerts.failedToRequestGoalCompletion')
              );
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const extendGoal = async (goal: Goal) => {
    if (!extendForm.newEndDate) {
      flashError(t('teacher.goals.alerts.noNewDate'));
      return;
    }
    try {
      setIsProcessing(true);
      await apiClient.patch(`/goals/${goal._id}/extend`, {
        newEndDate: extendForm.newEndDate,
        reason: extendForm.reason,
      });
      flashSuccess(t('teacher.goals.alerts.deadlineExtended'));
      setShowExtend(false);
      setExtendForm({ newEndDate: '', reason: '' });
      setSelectedGoal(null);
      await fetchGoals(false);
    } catch (err: any) {
      flashError(err?.message || t('teacher.goals.alerts.failedToExtendDeadline'));
    } finally {
      setIsProcessing(false);
    }
  };

  const openExtend = (goal: Goal) => {
    setSelectedGoal(goal);
    setExtendForm({ newEndDate: '', reason: '' });
    setShowExtend(true);
  };

  const openDetails = (goal: Goal) => {
    setSelectedGoal(goal);
    setShowDetails(true);
  };

  // ============================================================
  // RENDER: GOAL CARD (grid + list use same card)
  // ============================================================
  const renderGoalCard = ({ item }: { item: Goal }) => {
    const statusStyle = STATUS_BG[item.status || 'Pending'] || STATUS_BG.Pending;
    const priorityStyle =
      PRIORITY_BG[item.priority || 'Medium'] || PRIORITY_BG.Medium;
    const isPendingApproval = item.status === 'Pending Approval';
    const tasks = item.tasks || [];
    const done = completedTasks(item);
    const total = totalTasks(item);

    return (
      <View style={styles.goalCard}>
        {/* Header: status + priority */}
        <View style={styles.goalHeaderRow}>
          <View style={styles.goalBadges}>
            <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                {t(
                  `teacher.goals.${STATUS_KEY[item.status || 'Pending']}`
                )}
              </Text>
            </View>
            {isPendingApproval && (
              <View style={[styles.badge, { backgroundColor: COLORS.purpleLight }]}>
                <Ionicons name="time-outline" size={11} color={COLORS.purple} />
                <Text style={[styles.badgeText, { color: COLORS.purple }]}>
                  {t('teacher.goals.pendingApprovalLabel')}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: priorityStyle.bg,
                  borderWidth: 1,
                  borderColor: priorityStyle.text,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: priorityStyle.text }]}>
                {t(`teacher.goals.${PRIORITY_KEY[item.priority || 'Medium']}`)}
              </Text>
            </View>
          </View>
        </View>

        {/* Title + description */}
        <Text style={styles.goalTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.description ? (
          <Text style={styles.goalDescription} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {/* Meta */}
        <View style={styles.metaRow}>
          {item.targetType ? (
            <Text style={styles.metaText}>
              <Ionicons name="pricetag-outline" size={11} color={COLORS.slateMuted} />{' '}
              {t(`teacher.goals.${TARGET_KEY[item.targetType]}`)}
            </Text>
          ) : null}
          {item.timeframe ? (
            <Text style={styles.metaText}>
              <Ionicons name="time-outline" size={11} color={COLORS.slateMuted} />{' '}
              {t(`teacher.goals.${TIMEFRAME_KEY[item.timeframe]}`)}
            </Text>
          ) : null}
        </View>

        {/* Dates */}
        <View style={styles.datesRow}>
          <Text style={styles.datesText}>
            {t('teacher.goals.startDate')}{' '}
            {item.startDate
              ? new Date(item.startDate).toLocaleDateString()
              : t('teacher.goals.notAvailable')}
          </Text>
          <Text style={styles.datesText}>→</Text>
          <Text style={styles.datesText}>
            {t('teacher.goals.endDate')}{' '}
            {item.endDate
              ? new Date(item.endDate).toLocaleDateString()
              : t('teacher.goals.notAvailable')}
          </Text>
        </View>

        {/* Progress */}
        <View style={styles.progressBlock}>
          <View style={styles.progressHeaderRow}>
            <Text style={styles.progressLabel}>
              {t('teacher.goals.progress')}
            </Text>
            <Text style={styles.progressValue}>{item.progress || 0}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(item.progress || 0, 100)}%` },
              ]}
            />
          </View>
        </View>

        {/* Tasks with tick boxes */}
        {tasks.length > 0 && (
          <View style={styles.tasksBlock}>
            <View style={styles.tasksHeaderRow}>
              <Text style={styles.tasksLabel}>
                {t('teacher.goals.tasks')} ({done}/{total})
              </Text>
              <Text style={styles.tasksLabelMuted}>
                {t('teacher.goals.requestApproval')}
              </Text>
            </View>

            {tasks.slice(0, 5).map((task, idx) => {
              const isDone = getTaskCompleted(task);
              const isPending = getTaskPending(task);
              return (
                <View key={idx} style={styles.taskRow}>
                  <TouchableOpacity
                    style={styles.taskCheckboxTouch}
                    onPress={() => !isDone && !isPending && requestTaskComplete(item, idx)}
                    disabled={isDone || isPending}
                  >
                    <Ionicons
                      name={
                        isDone
                          ? 'checkbox'
                          : isPending
                          ? 'time-outline'
                          : 'square-outline'
                      }
                      size={18}
                      color={
                        isDone
                          ? COLORS.primary
                          : isPending
                          ? COLORS.purple
                          : COLORS.slateMuted
                      }
                    />
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.taskText,
                      isDone && styles.taskTextDone,
                      isPending && styles.taskTextPending,
                    ]}
                    numberOfLines={1}
                  >
                    {getTaskText(task)}
                  </Text>
                  {isPending && (
                    <View style={styles.pendingTag}>
                      <Text style={styles.pendingTagText}>
                        {t('teacher.goals.pendingApprovalLabel')}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}

            {tasks.length > 5 && (
              <Text style={styles.moreTasksText}>
                +{tasks.length - 5} more
              </Text>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionLinkBtn}
            onPress={() => openDetails(item)}
          >
            <Ionicons name="eye-outline" size={14} color={COLORS.purple} />
            <Text style={styles.actionLinkText}>
              {t('teacher.goals.viewDetails')}
            </Text>
          </TouchableOpacity>

          {item.status !== 'Completed' && item.status !== 'Cancelled' && (
            <View style={styles.actionRightGroup}>
              <TouchableOpacity
                style={[
                  styles.actionPrimaryBtn,
                  isPendingApproval && { opacity: 0.6 },
                ]}
                onPress={() => requestGoalComplete(item)}
                disabled={isPendingApproval || isProcessing}
              >
                <Ionicons
                  name={isPendingApproval ? 'time-outline' : 'send-outline'}
                  size={13}
                  color="#fff"
                />
                <Text style={styles.actionPrimaryText}>
                  {isPendingApproval
                    ? t('teacher.goals.waitingForAdmin')
                    : t('teacher.goals.requestComplete')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionSecondaryBtn}
                onPress={() => openExtend(item)}
                disabled={isPendingApproval}
              >
                <Ionicons name="calendar-outline" size={13} color={COLORS.amber} />
                <Text style={styles.actionSecondaryText}>
                  {t('teacher.goals.extend')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ============================================================
  // RENDER
  // ============================================================
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
          <Text style={styles.headerTitle}>{t('teacher.goals.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('teacher.goals.subtitle')}
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

      {/* TEACHER HINT */}
      <View style={styles.hintRow}>
        <View style={styles.hintBadge}>
          <Ionicons name="information-circle" size={12} color={COLORS.purple} />
          <Text style={styles.hintText}>
            {t('teacher.goals.teacherModeHint')}
          </Text>
        </View>
      </View>

      {/* STATS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsRow}
      >
        <StatTile
          label={t('teacher.goals.total')}
          value={stats.total}
          bg={COLORS.purpleLight}
          color={COLORS.purple}
          icon="flag-outline"
        />
        <StatTile
          label={t('teacher.goals.active')}
          value={stats.active}
          bg={COLORS.amberLight}
          color={COLORS.amber}
          icon="play-outline"
        />
        <StatTile
          label={t('teacher.goals.overdue')}
          value={stats.overdue}
          bg={COLORS.redLight}
          color={COLORS.red}
          icon="alert-circle-outline"
        />
        <StatTile
          label={t('teacher.goals.completed')}
          value={stats.completed}
          bg={COLORS.primaryLight}
          color={COLORS.primary}
          icon="checkmark-circle-outline"
        />
        <StatTile
          label={t('teacher.goals.pendingApproval')}
          value={stats.pendingApproval}
          bg={COLORS.purpleLight}
          color={COLORS.purple}
          icon="time-outline"
        />
      </ScrollView>

      {/* SEARCH + FILTERS */}
      <View style={styles.filtersBlock}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('teacher.goals.searchPlaceholder')}
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          <FilterChip
            label={
              filterStatus === 'All'
                ? t('teacher.goals.allStatus')
                : t(`teacher.goals.${STATUS_KEY[filterStatus]}`)
            }
            active={filterStatus !== 'All'}
            onPress={() => {
              // Simple toggle through statuses
              const order = ['All', 'Pending', 'In Progress', 'Completed', 'Overdue', 'Extended', 'Pending Approval'];
              const idx = order.indexOf(filterStatus);
              setFilterStatus(order[(idx + 1) % order.length]);
            }}
          />
          <FilterChip
            label={
              filterPriority === 'All'
                ? t('teacher.goals.allPriorities')
                : t(`teacher.goals.${PRIORITY_KEY[filterPriority]}`)
            }
            active={filterPriority !== 'All'}
            onPress={() => {
              const order = ['All', 'Low', 'Medium', 'High', 'Critical'];
              const idx = order.indexOf(filterPriority);
              setFilterPriority(order[(idx + 1) % order.length]);
            }}
          />
          <FilterChip
            label={
              filterTimeframe === 'All'
                ? t('teacher.goals.allTimeframes')
                : t(`teacher.goals.${TIMEFRAME_KEY[filterTimeframe]}`)
            }
            active={filterTimeframe !== 'All'}
            onPress={() => {
              const order = ['All', 'Daily', 'Weekly', 'Monthly', 'Yearly'];
              const idx = order.indexOf(filterTimeframe);
              setFilterTimeframe(order[(idx + 1) % order.length]);
            }}
          />
          <FilterChip
            label={
              filterTarget === 'All'
                ? t('teacher.goals.allTargets')
                : t(`teacher.goals.${TARGET_KEY[filterTarget]}`)
            }
            active={filterTarget !== 'All'}
            onPress={() => {
              const order = ['All', 'Teacher', 'Halaqah', 'Both'];
              const idx = order.indexOf(filterTarget);
              setFilterTarget(order[(idx + 1) % order.length]);
            }}
          />
        </ScrollView>
      </View>

      {/* ERROR / SUCCESS */}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError('')}>
            <Ionicons name="close" size={16} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      ) : null}
      {success ? (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
          <Text style={styles.successText}>{success}</Text>
        </View>
      ) : null}

      {/* COUNT */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {t('teacher.goals.goalsCount', { count: filteredGoals.length })}
        </Text>
        <TouchableOpacity onPress={() => fetchGoals(false)}>
          <Ionicons name="refresh" size={16} color={COLORS.slateMuted} />
        </TouchableOpacity>
      </View>

      {/* LIST */}
      {isLoading && goals.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('teacher.goals.loading')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredGoals}
          keyExtractor={(item) => item._id}
          renderItem={renderGoalCard}
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
              <Ionicons name="flag-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>
                {t('teacher.goals.noGoalsFound')}
              </Text>
              <Text style={styles.emptyText}>
                {t('teacher.goals.noGoalsFoundDesc')}
              </Text>
            </View>
          }
        />
      )}

      {/* ============ DETAILS MODAL ============ */}
      <Modal
        visible={showDetails}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {selectedGoal?.title}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {t('teacher.goals.goalDetailsAndProgress')}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowDetails(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              {selectedGoal ? (
                <>
                  {/* Status + Priority + Progress tiles */}
                  <View style={styles.tilesRow}>
                    <View style={styles.tile}>
                      <Text style={styles.tileLabel}>
                        {t('teacher.goals.status')}
                      </Text>
                      <Text style={styles.tileValue}>
                        {t(
                          `teacher.goals.${
                            STATUS_KEY[selectedGoal.status || 'Pending']
                          }`
                        )}
                      </Text>
                    </View>
                    <View style={styles.tile}>
                      <Text style={styles.tileLabel}>
                        {t('teacher.goals.priority')}
                      </Text>
                      <Text style={styles.tileValue}>
                        {t(
                          `teacher.goals.${
                            PRIORITY_KEY[selectedGoal.priority || 'Medium']
                          }`
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressBlock}>
                    <View style={styles.progressHeaderRow}>
                      <Text style={styles.progressLabel}>
                        {t('teacher.goals.progress')}
                      </Text>
                      <Text style={styles.progressValue}>
                        {selectedGoal.progress || 0}%
                      </Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(
                              selectedGoal.progress || 0,
                              100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Meta tiles */}
                  <View style={styles.tilesRow}>
                    <View style={styles.tile}>
                      <Text style={styles.tileLabel}>
                        {t('teacher.goals.timeframeLabel')}
                      </Text>
                      <Text style={styles.tileValue}>
                        {selectedGoal.timeframe
                          ? t(
                              `teacher.goals.${
                                TIMEFRAME_KEY[selectedGoal.timeframe]
                              }`
                            )
                          : t('teacher.goals.notSpecified')}
                      </Text>
                    </View>
                    <View style={styles.tile}>
                      <Text style={styles.tileLabel}>
                        {t('teacher.goals.assignedTo')}
                      </Text>
                      <Text style={styles.tileValue}>
                        {getAssigneeName(selectedGoal)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.tilesRow}>
                    <View style={styles.tile}>
                      <Text style={styles.tileLabel}>
                        {t('teacher.goals.startDate')}
                      </Text>
                      <Text style={styles.tileValue}>
                        {selectedGoal.startDate
                          ? new Date(selectedGoal.startDate).toLocaleDateString()
                          : t('teacher.goals.notSet')}
                      </Text>
                    </View>
                    <View style={styles.tile}>
                      <Text style={styles.tileLabel}>
                        {t('teacher.goals.endDate')}
                      </Text>
                      <Text style={styles.tileValue}>
                        {selectedGoal.endDate
                          ? new Date(selectedGoal.endDate).toLocaleDateString()
                          : t('teacher.goals.notSet')}
                      </Text>
                    </View>
                  </View>

                  {selectedGoal.description ? (
                    <View style={styles.descriptionBox}>
                      <Text style={styles.descriptionText}>
                        {selectedGoal.description}
                      </Text>
                    </View>
                  ) : null}

                  {/* Tasks */}
                  {(selectedGoal.tasks || []).length > 0 && (
                    <>
                      <Text style={styles.sectionTitle}>
                        {t('teacher.goals.tasks')} ({completedTasks(selectedGoal)}/
                        {totalTasks(selectedGoal)})
                      </Text>
                      {(selectedGoal.tasks || []).map((task, idx) => {
                        const isDone = getTaskCompleted(task);
                        const isPending = getTaskPending(task);
                        return (
                          <View key={idx} style={styles.detailTaskRow}>
                            <TouchableOpacity
                              onPress={() =>
                                !isDone &&
                                !isPending &&
                                requestTaskComplete(selectedGoal, idx)
                              }
                              disabled={isDone || isPending}
                            >
                              <Ionicons
                                name={
                                  isDone
                                    ? 'checkbox'
                                    : isPending
                                    ? 'time-outline'
                                    : 'square-outline'
                                }
                                size={20}
                                color={
                                  isDone
                                    ? COLORS.primary
                                    : isPending
                                    ? COLORS.purple
                                    : COLORS.slateMuted
                                }
                              />
                            </TouchableOpacity>
                            <Text
                              style={[
                                styles.detailTaskText,
                                isDone && styles.taskTextDone,
                                isPending && styles.taskTextPending,
                              ]}
                            >
                              {getTaskText(task)}
                            </Text>
                            {isPending && (
                              <View style={styles.pendingTag}>
                                <Text style={styles.pendingTagText}>
                                  {t('teacher.goals.pendingApprovalLabel')}
                                </Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </>
                  )}

                  {selectedGoal.notes ? (
                    <View style={styles.notesBox}>
                      <Text style={styles.notesText}>{selectedGoal.notes}</Text>
                    </View>
                  ) : null}

                  <View style={{ height: 20 }} />
                </>
              ) : null}
            </ScrollView>

            {/* Actions */}
            {selectedGoal &&
              selectedGoal.status !== 'Completed' &&
              selectedGoal.status !== 'Cancelled' && (
                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.modalFooterBtnSecondary}
                    onPress={() => {
                      setShowDetails(false);
                      openExtend(selectedGoal);
                    }}
                    disabled={selectedGoal.status === 'Pending Approval'}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={COLORS.amber}
                    />
                    <Text style={styles.modalFooterBtnSecondaryText}>
                      {t('teacher.goals.extendDeadline')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalFooterBtnPrimary}
                    onPress={() => requestGoalComplete(selectedGoal)}
                    disabled={
                      selectedGoal.status === 'Pending Approval' || isProcessing
                    }
                  >
                    <Ionicons name="send-outline" size={16} color="#fff" />
                    <Text style={styles.modalFooterBtnPrimaryText}>
                      {selectedGoal.status === 'Pending Approval'
                        ? t('teacher.goals.waitingForAdmin')
                        : t('teacher.goals.requestComplete')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
          </View>
        </View>
      </Modal>

      {/* ============ EXTEND MODAL ============ */}
      <Modal
        visible={showExtend}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExtend(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContainerSmall}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {t('teacher.goals.extendDeadline')}
                </Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {selectedGoal?.title}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowExtend(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.formLabel}>
                {t('teacher.goals.newEndDate')} *
              </Text>
              <TextInput
                style={styles.formInput}
                value={extendForm.newEndDate}
                onChangeText={(v) =>
                  setExtendForm((prev) => ({ ...prev, newEndDate: v }))
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#A0AAA5"
                autoCapitalize="none"
              />

              <Text style={styles.formLabel}>
                {t('teacher.goals.extensionReason')}
              </Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={extendForm.reason}
                onChangeText={(v) =>
                  setExtendForm((prev) => ({ ...prev, reason: v }))
                }
                placeholder={t('teacher.goals.extensionReasonPlaceholder')}
                placeholderTextColor="#A0AAA5"
                multiline
                numberOfLines={3}
              />

              <View style={styles.currentDeadlineBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={COLORS.amber}
                />
                <Text style={styles.currentDeadlineText}>
                  {t('teacher.goals.currentDeadline')}:{' '}
                  {selectedGoal?.endDate
                    ? new Date(selectedGoal.endDate).toLocaleDateString()
                    : t('teacher.goals.notSet')}
                </Text>
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalFooterBtnSecondary}
                onPress={() => setShowExtend(false)}
                disabled={isProcessing}
              >
                <Text style={styles.modalFooterBtnSecondaryText}>
                  {t('teacher.goals.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalFooterBtnPrimary,
                  isProcessing && { opacity: 0.7 },
                ]}
                onPress={() => selectedGoal && extendGoal(selectedGoal)}
                disabled={isProcessing || !extendForm.newEndDate}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.modalFooterBtnPrimaryText}>
                      {t('teacher.goals.extendDeadline')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

// ============================================================
// STAT TILE
// ============================================================
const StatTile: React.FC<{
  label: string;
  value: number;
  bg: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = ({ label, value, bg, color, icon }) => (
  <View style={[styles.statTile, { backgroundColor: bg }]}>
    <View style={styles.statHeader}>
      <Text style={[styles.statLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name={icon} size={16} color={color} />
    </View>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
  </View>
);

const FilterChip: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
}> = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.filterChip, active && styles.filterChipActive]}
    onPress={onPress}
  >
    <Text
      style={[styles.filterChipText, active && styles.filterChipTextActive]}
      numberOfLines={1}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

export default TeacherGoalSettingScreen;

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // HEADER
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
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

  // HINT
  hintRow: { paddingHorizontal: 16, paddingBottom: 8 },
  hintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.purpleLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  hintText: { fontSize: 11, fontWeight: '600', color: COLORS.purple },

  // STATS
  statsRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 12,
  },
  statTile: {
    minWidth: 110,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  statLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  statValue: { fontSize: 22, fontWeight: '800' },

  // FILTERS
  filtersBlock: { paddingHorizontal: 16, gap: 8, marginBottom: 8 },
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
  filterChipsRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },
  filterChipTextActive: { color: COLORS.primary },

  // BANNERS
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
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: '#BFE9D4',
    borderRadius: 12,
  },
  successText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // COUNT
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  countText: { fontSize: 12, color: COLORS.slateMuted, fontWeight: '600' },

  // LOADING / EMPTY
  loadingWrap: { alignItems: 'center', paddingVertical: 60 },
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

  // LIST
  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },

  // GOAL CARD
  goalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  goalBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: { fontSize: 10, fontWeight: '800' },
  goalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.slate,
    marginBottom: 4,
  },
  goalDescription: {
    fontSize: 12,
    color: COLORS.slateMuted,
    lineHeight: 18,
    marginBottom: 8,
  },
  metaRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginBottom: 4 },
  metaText: { fontSize: 11, color: COLORS.slateMuted, fontWeight: '600' },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  datesText: { fontSize: 11, color: COLORS.gray, fontWeight: '600' },

  // PROGRESS
  progressBlock: { marginBottom: 10 },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: { fontSize: 11, color: COLORS.slateMuted, fontWeight: '600' },
  progressValue: { fontSize: 12, fontWeight: '800', color: COLORS.purple },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.purple,
    borderRadius: 3,
  },

  // TASKS
  tasksBlock: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginBottom: 8,
  },
  tasksHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tasksLabel: { fontSize: 11, fontWeight: '800', color: COLORS.slate },
  tasksLabelMuted: {
    fontSize: 10,
    color: COLORS.purple,
    fontWeight: '600',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  taskCheckboxTouch: { padding: 2 },
  taskText: { flex: 1, fontSize: 12, color: COLORS.slate },
  taskTextDone: { textDecorationLine: 'line-through', color: COLORS.gray },
  taskTextPending: { color: COLORS.purple, fontWeight: '600' },
  pendingTag: {
    backgroundColor: COLORS.purpleLight,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pendingTagText: { fontSize: 9, fontWeight: '800', color: COLORS.purple },
  moreTasksText: {
    fontSize: 10,
    color: COLORS.gray,
    fontStyle: 'italic',
    marginTop: 4,
  },

  // ACTIONS
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexWrap: 'wrap',
  },
  actionLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.purple,
  },
  actionRightGroup: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  actionPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.purple,
  },
  actionPrimaryText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  actionSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.amber,
  },
  actionSecondaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.amber,
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
  modalContainerSmall: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
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

  // DETAILS TILES
  tilesRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  tile: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
  },
  tileLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  tileValue: { fontSize: 14, fontWeight: '800', color: COLORS.slate },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 12,
    marginBottom: 8,
  },

  descriptionBox: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  descriptionText: { fontSize: 13, color: COLORS.slate, lineHeight: 19 },

  detailTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    marginBottom: 6,
  },
  detailTaskText: { flex: 1, fontSize: 13, color: COLORS.slate },

  notesBox: {
    backgroundColor: COLORS.amberLight,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  notesText: { fontSize: 13, color: '#92400E', lineHeight: 19 },

  // MODAL FOOTER
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  modalFooterBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.amber,
    backgroundColor: COLORS.white,
  },
  modalFooterBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.amber,
  },
  modalFooterBtnPrimary: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.purple,
  },
  modalFooterBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  // FORM
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
    marginBottom: 6,
    marginTop: 10,
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
  textArea: { minHeight: 80, textAlignVertical: 'top' },

  currentDeadlineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.amberLight,
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  currentDeadlineText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
});