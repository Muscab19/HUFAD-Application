// src/screens/admin/GoalSettingScreen.tsx
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
import { api as apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// ============================================================
// COLORS
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
  pink: '#DB2777',
  pinkLight: '#FCE7F3',
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
// TYPES
// ============================================================
type GoalStatus =
  | 'Pending'
  | 'In Progress'
  | 'Completed'
  | 'Overdue'
  | 'Extended'
  | 'Cancelled'
  | 'Pending Approval';

type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
type Timeframe = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
type TargetType = 'Teacher' | 'Halaqah' | 'Both';

interface Task {
  title: string;
  completed: boolean;
  pendingApproval?: boolean;
}

interface Goal {
  _id: string;
  title: string;
  description?: string;
  targetType: TargetType;
  assignedTo: string;
  assignedToName?: string;
  timeframe: Timeframe;
  priority: Priority;
  startDate: string;
  endDate: string;
  tasks: Task[];
  notes?: string;
  status: GoalStatus;
  progress: number;
}

interface TeacherRef {
  _id: string;
  name: string;
}

interface HalaqahRef {
  _id: string;
  name: string;
}

const STATUSES: GoalStatus[] = [
  'Pending',
  'In Progress',
  'Completed',
  'Overdue',
  'Extended',
  'Cancelled',
  'Pending Approval',
];

const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical'];
const TIMEFRAMES: Timeframe[] = ['Daily', 'Weekly', 'Monthly', 'Yearly'];
const TARGET_TYPES: TargetType[] = ['Teacher', 'Halaqah', 'Both'];

// ============================================================
// TRANSLATION KEY MAPS
// ============================================================
const STATUS_KEY: Record<GoalStatus, string> = {
  Pending: 'pending',
  'In Progress': 'inProgress',
  Completed: 'completed',
  Overdue: 'overdue',
  Extended: 'extended',
  Cancelled: 'cancelled',
  'Pending Approval': 'pendingApproval',
};

const PRIORITY_KEY: Record<Priority, string> = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical',
};

const TIMEFRAME_KEY: Record<Timeframe, string> = {
  Daily: 'daily',
  Weekly: 'weekly',
  Monthly: 'monthly',
  Yearly: 'yearly',
};

const TARGET_KEY: Record<TargetType, string> = {
  Teacher: 'teacher',
  Halaqah: 'halaqah',
  Both: 'both',
};

// ============================================================
// HELPERS
// ============================================================
const getStatusStyle = (s: GoalStatus) => {
  switch (s) {
    case 'Completed':
      return { bg: COLORS.primaryLight, text: COLORS.primary };
    case 'In Progress':
      return { bg: COLORS.amberLight, text: COLORS.amber };
    case 'Overdue':
      return { bg: COLORS.redLight, text: COLORS.red };
    case 'Extended':
      return { bg: COLORS.blueLight, text: COLORS.blue };
    case 'Pending Approval':
      return { bg: COLORS.purpleLight, text: COLORS.purple };
    default:
      return { bg: '#F1F5F9', text: COLORS.gray };
  }
};

const getPriorityStyle = (p: Priority) => {
  switch (p) {
    case 'Critical':
      return { bg: COLORS.redLight, text: COLORS.red };
    case 'High':
      return { bg: '#FED7AA', text: '#C2410C' };
    case 'Medium':
      return { bg: COLORS.amberLight, text: COLORS.amber };
    case 'Low':
      return { bg: COLORS.blueLight, text: COLORS.blue };
    default:
      return { bg: '#F1F5F9', text: COLORS.gray };
  }
};

const formatDate = (d: string | undefined, fallback: string) => {
  if (!d) return fallback;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return fallback;
  return dt.toLocaleDateString();
};

const getAssigneeName = (
  goal: Goal,
  teachers: TeacherRef[],
  halaqahs: HalaqahRef[],
  t: any
): string => {
  if (goal.assignedToName) return goal.assignedToName;
  if (goal.targetType === 'Both') return t('goals.allTeachersHalaqat');
  if (goal.targetType === 'Teacher') {
    return (
      teachers.find((tt) => tt._id === goal.assignedTo)?.name ||
      t('goals.unknown')
    );
  }
  return (
    halaqahs.find((h) => h._id === goal.assignedTo)?.name || t('goals.unknown')
  );
};

// ============================================================
// SCREEN
// ============================================================
export const GoalSettingScreen: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userRole = (user?.role || 'admin') as string;
  const isTeacher = userRole === 'teacher';

  const [goals, setGoals] = useState<Goal[]>([]);
  const [teachers, setTeachers] = useState<TeacherRef[]>([]);
  const [halaqahs, setHalaqahs] = useState<HalaqahRef[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | GoalStatus>('All');
  const [filterPriority, setFilterPriority] = useState<'All' | Priority>('All');
  const [filterTimeframe, setFilterTimeframe] = useState<'All' | Timeframe>('All');
  const [filterTarget, setFilterTarget] = useState<'All' | TargetType>('All');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [addVisible, setAddVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [extendVisible, setExtendVisible] = useState(false);
  const [markCompleteVisible, setMarkCompleteVisible] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);

  const [goalForm, setGoalForm] = useState({
    _id: null as string | null,
    title: '',
    description: '',
    targetType: '' as TargetType | '',
    assignedTo: '',
    timeframe: '' as Timeframe | '',
    priority: 'Medium' as Priority,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    tasks: [''],
    notes: '',
    status: 'Pending' as GoalStatus,
    progress: 0,
  });

  const [extendForm, setExtendForm] = useState({
    newEndDate: '',
    reason: '',
  });

  // ============================================================
  // FETCH
  // ============================================================
  const fetchGoals = useCallback(async () => {
    setError('');
    try {
      const res: any = await apiClient.get('/goals');
      const data = res?.data?.goals || res?.data || res?.goals || res || [];
      setGoals(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Fetch goals error:', err);
      setError(err?.message || 'Failed to load goals.');
      setGoals([]);
    }
  }, []);

  const fetchTeachers = useCallback(async () => {
    try {
      const res: any = await apiClient.get('/teachers', { limit: 1000 });
      const data = res?.teachers || res?.data || res || [];
      setTeachers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Fetch teachers error:', err);
      setTeachers([]);
    }
  }, []);

  const fetchHalaqahs = useCallback(async () => {
    try {
      const res: any = await apiClient.get('/halaqaat', { limit: 1000 });
      const data = res?.halaqaat || res?.halaqat || res?.data || res || [];
      setHalaqahs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Fetch halaqahs error:', err);
      setHalaqahs([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([fetchGoals(), fetchTeachers(), fetchHalaqahs()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchGoals, fetchTeachers, fetchHalaqahs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchGoals(), fetchTeachers(), fetchHalaqahs()]);
    setRefreshing(false);
  };

  // ============================================================
  // FILTERS
  // ============================================================
  const filteredGoals = useMemo(() => {
    let list = [...goals];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (g) =>
          g.title?.toLowerCase().includes(q) ||
          (g.description || '').toLowerCase().includes(q) ||
          (g.assignedToName || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'All') list = list.filter((g) => g.status === filterStatus);
    if (filterPriority !== 'All')
      list = list.filter((g) => g.priority === filterPriority);
    if (filterTimeframe !== 'All')
      list = list.filter((g) => g.timeframe === filterTimeframe);
    if (filterTarget !== 'All') list = list.filter((g) => g.targetType === filterTarget);
    return list.sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
  }, [goals, searchTerm, filterStatus, filterPriority, filterTimeframe, filterTarget]);

  const stats = useMemo(
    () => ({
      total: goals.length,
      active: goals.filter((g) => g.status === 'In Progress').length,
      overdue: goals.filter((g) => g.status === 'Overdue').length,
      completed: goals.filter((g) => g.status === 'Completed').length,
      pendingApproval: goals.filter((g) => g.status === 'Pending Approval').length,
    }),
    [goals]
  );

  const activeFilterCount = useMemo(
    () =>
      [
        filterStatus !== 'All',
        filterPriority !== 'All',
        filterTimeframe !== 'All',
        filterTarget !== 'All',
      ].filter(Boolean).length,
    [filterStatus, filterPriority, filterTimeframe, filterTarget]
  );

  const clearFilters = () => {
    setSearchTerm('');
    setFilterStatus('All');
    setFilterPriority('All');
    setFilterTimeframe('All');
    setFilterTarget('All');
  };

  const resetForm = () => {
    setGoalForm({
      _id: null,
      title: '',
      description: '',
      targetType: '',
      assignedTo: '',
      timeframe: '',
      priority: 'Medium',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      tasks: [''],
      notes: '',
      status: 'Pending',
      progress: 0,
    });
  };

  const openAdd = () => {
    resetForm();
    setAddVisible(true);
  };

  const openEdit = (g: Goal) => {
    setGoalForm({
      _id: g._id,
      title: g.title,
      description: g.description || '',
      targetType: g.targetType,
      assignedTo: g.assignedTo,
      timeframe: g.timeframe,
      priority: g.priority || 'Medium',
      startDate: g.startDate
        ? new Date(g.startDate).toISOString().split('T')[0]
        : '',
      endDate: g.endDate
        ? new Date(g.endDate).toISOString().split('T')[0]
        : '',
      tasks:
        (g.tasks || []).map((tt) =>
          typeof tt === 'string' ? tt : tt.title || ''
        ) || [''],
      notes: g.notes || '',
      status: g.status || 'Pending',
      progress: g.progress || 0,
    });
    setEditVisible(true);
  };

  // ============================================================
  // CRUD
  // ============================================================
  const handleCreate = async () => {
    if (!goalForm.title.trim()) {
      Alert.alert(t('goals.requiredTitle'), t('goals.requiredTitleGoal'));
      return;
    }
    if (!goalForm.targetType) {
      Alert.alert(t('goals.requiredTitle'), t('goals.requiredTarget'));
      return;
    }
    if (goalForm.targetType !== 'Both' && !goalForm.assignedTo) {
      Alert.alert(t('goals.requiredTitle'), t('goals.requiredAssignee'));
      return;
    }

    setProcessing(true);
    try {
      const payload: any = {
        title: goalForm.title.trim(),
        description: goalForm.description,
        targetType: goalForm.targetType,
        assignedTo:
          goalForm.targetType === 'Both' ? 'both' : goalForm.assignedTo,
        timeframe: goalForm.timeframe,
        priority: goalForm.priority,
        startDate: goalForm.startDate,
        endDate: goalForm.endDate,
        tasks: goalForm.tasks
          .filter((tt) => tt.trim())
          .map((title) => ({ title, completed: false })),
        notes: goalForm.notes,
        status: goalForm.status,
        progress: goalForm.progress,
      };
      await apiClient.post('/goals', payload);
      setAddVisible(false);
      resetForm();
      setSuccess(t('goals.createdMsg'));
      setTimeout(() => setSuccess(''), 3000);
      await fetchGoals();
    } catch (err: any) {
      Alert.alert(
        t('goals.errorTitle'),
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('goals.createFailed')
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdate = async () => {
    if (!goalForm._id) return;
    if (!goalForm.title.trim()) {
      Alert.alert(t('goals.requiredTitle'), t('goals.requiredTitleGoal'));
      return;
    }

    setProcessing(true);
    try {
      const payload: any = {
        title: goalForm.title.trim(),
        description: goalForm.description,
        targetType: goalForm.targetType,
        assignedTo:
          goalForm.targetType === 'Both' ? 'both' : goalForm.assignedTo,
        timeframe: goalForm.timeframe,
        priority: goalForm.priority,
        startDate: goalForm.startDate,
        endDate: goalForm.endDate,
        tasks: goalForm.tasks.map((title) => ({ title, completed: false })),
        notes: goalForm.notes,
        status: goalForm.status,
        progress: goalForm.progress,
      };
      await apiClient.put(`/goals/${goalForm._id}`, payload);
      setEditVisible(false);
      resetForm();
      setSuccess(t('goals.updatedMsg'));
      setTimeout(() => setSuccess(''), 3000);
      await fetchGoals();
    } catch (err: any) {
      Alert.alert(
        t('goals.errorTitle'),
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('goals.updateFailed')
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedGoal) return;
    setProcessing(true);
    try {
      await apiClient.delete(`/goals/${selectedGoal._id}`);
      setDeleteVisible(false);
      setDetailsVisible(false);
      setSelectedGoal(null);
      setSuccess(t('goals.deletedMsg'));
      setTimeout(() => setSuccess(''), 3000);
      await fetchGoals();
    } catch (err: any) {
      Alert.alert(
        t('goals.errorTitle'),
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('goals.deleteFailed')
      );
    } finally {
      setProcessing(false);
    }
  };

  // ============================================================
  // TASK OPERATIONS
  // ============================================================
  const handleToggleTask = async (goal: Goal, idx: number) => {
    if (isTeacher) return;
    const task = goal.tasks[idx];
    if (!task) return;

    setProcessing(true);
    try {
      if (task.pendingApproval) {
        await apiClient.patch(`/goals/${goal._id}/task/${idx}/approve`);
        setSuccess(t('goals.taskApprovedAndCompleted'));
      } else {
        await apiClient.patch(`/goals/${goal._id}/task/${idx}`, {
          completed: !task.completed,
        });
        setSuccess(
          !task.completed ? t('goals.taskCompleted') : t('goals.taskUnmarked')
        );
      }
      setTimeout(() => setSuccess(''), 3000);
      await fetchGoals();
    } catch (err: any) {
      Alert.alert(
        t('goals.errorTitle'),
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('goals.taskUpdateFailed')
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestTaskComplete = async (goal: Goal, idx: number) => {
    if (!isTeacher) return;
    const task = goal.tasks[idx];
    if (!task) return;
    if (task.completed) {
      Alert.alert(t('goals.infoTitle'), t('goals.taskAlreadyCompleted'));
      return;
    }
    if (task.pendingApproval) {
      Alert.alert(t('goals.infoTitle'), t('goals.taskAlreadyPending'));
      return;
    }

    setProcessing(true);
    try {
      await apiClient.patch(`/goals/${goal._id}/task/${idx}/request-complete`);
      setSuccess(t('goals.taskRequestSent'));
      setTimeout(() => setSuccess(''), 3000);
      await fetchGoals();
    } catch (err: any) {
      Alert.alert(
        t('goals.errorTitle'),
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('goals.taskRequestFailed')
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveTask = async (goal: Goal, idx: number) => {
    if (isTeacher) return;
    setProcessing(true);
    try {
      await apiClient.patch(`/goals/${goal._id}/task/${idx}/approve`);
      setSuccess(t('goals.taskApproved'));
      setTimeout(() => setSuccess(''), 3000);
      await fetchGoals();
    } catch (err: any) {
      Alert.alert(
        t('goals.errorTitle'),
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('goals.taskApproveFailed')
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectTask = async (goal: Goal, idx: number) => {
    if (isTeacher) return;
    setProcessing(true);
    try {
      await apiClient.patch(`/goals/${goal._id}/task/${idx}/reject`);
      setSuccess(t('goals.taskRejected'));
      setTimeout(() => setSuccess(''), 3000);
      await fetchGoals();
    } catch (err: any) {
      Alert.alert(
        t('goals.errorTitle'),
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('goals.taskRejectFailed')
      );
    } finally {
      setProcessing(false);
    }
  };

  // ============================================================
  // GOAL OPERATIONS
  // ============================================================
  const handleMarkComplete = async (goal: Goal) => {
    if (isTeacher) return;
    setProcessing(true);
    try {
      if (goal.status === 'Pending Approval') {
        await apiClient.patch(`/goals/${goal._id}/approve`);
        setSuccess(t('goals.goalApprovedAndCompleted'));
      } else {
        await apiClient.patch(`/goals/${goal._id}/complete`);
        setSuccess(t('goals.goalCompleted'));
      }
      setTimeout(() => setSuccess(''), 3000);
      setMarkCompleteVisible(false);
      setDetailsVisible(false);
      setSelectedGoal(null);
      await fetchGoals();
    } catch (err: any) {
      Alert.alert(
        t('goals.errorTitle'),
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('goals.completeFailed')
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveGoal = async (goal: Goal) => {
    if (isTeacher) return;
    setProcessing(true);
    try {
      await apiClient.patch(`/goals/${goal._id}/approve`);
      setSuccess(t('goals.goalApprovedAndCompleted'));
      setTimeout(() => setSuccess(''), 3000);
      setDetailsVisible(false);
      setSelectedGoal(null);
      await fetchGoals();
    } catch (err: any) {
      Alert.alert(
        t('goals.errorTitle'),
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('goals.approveFailed')
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectGoal = async (goal: Goal) => {
    if (isTeacher) return;
    setProcessing(true);
    try {
      await apiClient.patch(`/goals/${goal._id}/reject`);
      setSuccess(t('goals.goalRejected'));
      setTimeout(() => setSuccess(''), 3000);
      setDetailsVisible(false);
      setSelectedGoal(null);
      await fetchGoals();
    } catch (err: any) {
      Alert.alert(
        t('goals.errorTitle'),
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('goals.rejectFailed')
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestGoalComplete = async (goal: Goal) => {
    if (!isTeacher) return;
    if (goal.status === 'Completed') {
      Alert.alert(t('goals.infoTitle'), t('goals.goalAlreadyCompleted'));
      return;
    }
    if (goal.status === 'Pending Approval') {
      Alert.alert(t('goals.infoTitle'), t('goals.goalAlreadyPending'));
      return;
    }

    setProcessing(true);
    try {
      await apiClient.patch(`/goals/${goal._id}/request-complete`);
      setSuccess(t('goals.goalRequestSent'));
      setTimeout(() => setSuccess(''), 3000);
      setDetailsVisible(false);
      setSelectedGoal(null);
      await fetchGoals();
    } catch (err: any) {
      Alert.alert(
        t('goals.errorTitle'),
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('goals.requestFailed')
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleExtendGoal = async () => {
    if (!selectedGoal) return;
    if (!extendForm.newEndDate) {
      Alert.alert(t('goals.requiredTitle'), t('goals.requiredEndDate'));
      return;
    }

    setProcessing(true);
    try {
      await apiClient.patch(`/goals/${selectedGoal._id}/extend`, {
        newEndDate: extendForm.newEndDate,
        reason: extendForm.reason,
      });
      setExtendVisible(false);
      setDetailsVisible(false);
      setExtendForm({ newEndDate: '', reason: '' });
      setSelectedGoal(null);
      setSuccess(t('goals.extendedMsg'));
      setTimeout(() => setSuccess(''), 3000);
      await fetchGoals();
    } catch (err: any) {
      Alert.alert(
        t('goals.errorTitle'),
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('goals.extendFailed')
      );
    } finally {
      setProcessing(false);
    }
  };

  // ============================================================
  // RENDER — GOAL CARD
  // ============================================================
  const renderGoal = ({ item }: { item: Goal }) => {
    const statusStyle = getStatusStyle(item.status);
    const priorityStyle = getPriorityStyle(item.priority);
    const completedTasks = item.tasks?.filter((tt) => tt.completed)?.length || 0;
    const totalTasks = item.tasks?.length || 0;

    return (
      <TouchableOpacity
        style={styles.goalCard}
        activeOpacity={0.7}
        onPress={() => {
          setSelectedGoal(item);
          setDetailsVisible(true);
        }}
      >
        {/* Header badges */}
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.badgeText, { color: statusStyle.text }]}>
              {t(`goals.statuses.${STATUS_KEY[item.status]}`)}
            </Text>
          </View>
          {item.status === 'Pending Approval' && (
            <View
              style={[styles.badge, { backgroundColor: COLORS.purpleLight }]}
            >
              <Ionicons name="time-outline" size={10} color={COLORS.purple} />
              <Text style={[styles.badgeText, { color: COLORS.purple }]}>
                {t('goals.awaitingApproval')}
              </Text>
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: priorityStyle.bg }]}>
            <Text style={[styles.badgeText, { color: priorityStyle.text }]}>
              {t(`goals.priorities.${PRIORITY_KEY[item.priority]}`)}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.goalTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.description ? (
          <Text style={styles.goalDescription} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {/* Meta */}
        <View style={styles.goalMeta}>
          <View style={styles.metaItem}>
            <Ionicons
              name={
                item.targetType === 'Teacher'
                  ? 'person-outline'
                  : item.targetType === 'Halaqah'
                  ? 'people-outline'
                  : 'layers-outline'
              }
              size={11}
              color={COLORS.slateMuted}
            />
            <Text style={styles.metaText} numberOfLines={1}>
              {getAssigneeName(item, teachers, halaqahs, t)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={11} color={COLORS.slateMuted} />
            <Text style={styles.metaText}>
              {t(`goals.timeframes.${TIMEFRAME_KEY[item.timeframe]}`)}
            </Text>
          </View>
        </View>

        <View style={styles.dateRow}>
          <Text style={styles.dateText}>
            {formatDate(item.startDate, t('goals.notSet'))} →{' '}
            {formatDate(item.endDate, t('goals.notSet'))}
          </Text>
        </View>

        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>
              {t('goals.progressLabel')}
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

        {/* Tasks summary */}
        {totalTasks > 0 ? (
          <View style={styles.tasksSummary}>
            <Ionicons name="checkbox-outline" size={12} color={COLORS.slateMuted} />
            <Text style={styles.tasksSummaryText}>
              {t('goals.tasksComplete', {
                completed: completedTasks,
                total: totalTasks,
              })}
            </Text>
            {isTeacher ? (
              <Text style={styles.tasksHint}>
                {t('goals.tasksHintTeacher')}
              </Text>
            ) : (
              <Text style={styles.tasksHint}>
                {t('goals.tasksHintAdmin')}
              </Text>
            )}
          </View>
        ) : null}

        {/* Task list */}
        {totalTasks > 0 ? (
          <View style={styles.taskList}>
            {item.tasks.map((task, idx) => {
              const isPending = task.pendingApproval === true;
              const isDone = task.completed === true;
              const displayTitle =
                typeof task === 'string' ? task : task.title;
              return (
                <View key={idx} style={styles.taskRow}>
                  <TouchableOpacity
                    style={[
                      styles.taskCheckbox,
                      isDone && styles.taskCheckboxActive,
                      isPending && styles.taskCheckboxPending,
                    ]}
                    onPress={() => {
                      if (isTeacher) handleRequestTaskComplete(item, idx);
                      else handleToggleTask(item, idx);
                    }}
                    disabled={isDone}
                  >
                    {isDone ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : isPending ? (
                      <Ionicons
                        name="time-outline"
                        size={12}
                        color={COLORS.purple}
                      />
                    ) : null}
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.taskText,
                      isDone && styles.taskTextCompleted,
                      isPending && styles.taskTextPending,
                    ]}
                    numberOfLines={2}
                  >
                    {displayTitle}
                  </Text>
                  {!isTeacher && isPending ? (
                    <View style={styles.taskApproveRow}>
                      <TouchableOpacity
                        style={styles.taskApproveBtn}
                        onPress={() => handleApproveTask(item, idx)}
                      >
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={COLORS.primary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.taskRejectBtn}
                        onPress={() => handleRejectTask(item, idx)}
                      >
                        <Ionicons name="close" size={14} color={COLORS.red} />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Action buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => {
              setSelectedGoal(item);
              setDetailsVisible(true);
            }}
          >
            <Ionicons name="eye-outline" size={14} color={COLORS.blue} />
            <Text style={[styles.cardActionText, { color: COLORS.blue }]}>
              {t('goals.view')}
            </Text>
          </TouchableOpacity>

          {!isTeacher && (
            <TouchableOpacity
              style={styles.cardActionBtn}
              onPress={() => openEdit(item)}
            >
              <Ionicons name="create-outline" size={14} color={COLORS.primary} />
              <Text style={[styles.cardActionText, { color: COLORS.primary }]}>
                {t('goals.edit')}
              </Text>
            </TouchableOpacity>
          )}

          {!isTeacher &&
            item.status !== 'Completed' &&
            item.status !== 'Cancelled' && (
              <TouchableOpacity
                style={styles.cardActionBtn}
                onPress={() => {
                  setSelectedGoal(item);
                  setExtendForm({ newEndDate: '', reason: '' });
                  setExtendVisible(true);
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={COLORS.amber}
                />
                <Text style={[styles.cardActionText, { color: COLORS.amber }]}>
                  {t('goals.extend')}
                </Text>
              </TouchableOpacity>
            )}

          {isTeacher &&
            item.status !== 'Completed' &&
            item.status !== 'Cancelled' && (
              <TouchableOpacity
                style={styles.cardActionBtn}
                onPress={() => handleRequestGoalComplete(item)}
              >
                <Ionicons
                  name="send-outline"
                  size={14}
                  color={COLORS.purple}
                />
                <Text style={[styles.cardActionText, { color: COLORS.purple }]}>
                  {t('goals.request')}
                </Text>
              </TouchableOpacity>
            )}

          {!isTeacher && (
            <TouchableOpacity
              style={styles.cardActionBtn}
              onPress={() => {
                setSelectedGoal(item);
                setDeleteVisible(true);
              }}
            >
              <Ionicons name="trash-outline" size={14} color={COLORS.red} />
              <Text style={[styles.cardActionText, { color: COLORS.red }]}>
                {t('goals.delete')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {isTeacher
              ? t('goals.headerTitleTeacher')
              : t('goals.headerTitle')}
          </Text>
          <Text style={styles.headerSubtitle}>
            {t('goals.headerSubtitle', {
              count: filteredGoals.length,
              total: goals.length,
            })}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            <Ionicons
              name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
              size={18}
              color={COLORS.slate}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setFilterModalVisible(true)}
          >
            <Ionicons name="filter-outline" size={18} color={COLORS.slate} />
            {activeFilterCount > 0 && <View style={styles.filterDot} />}
          </TouchableOpacity>
          {!isTeacher && (
            <TouchableOpacity style={styles.addButton} onPress={openAdd}>
              <Ionicons name="add" size={22} color={COLORS.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <View
            style={[styles.summaryIcon, { backgroundColor: COLORS.purpleLight }]}
          >
            <Ionicons name="flag" size={16} color={COLORS.purple} />
          </View>
          <Text style={styles.summaryValue}>{stats.total}</Text>
          <Text style={styles.summaryLabel}>{t('goals.summary.total')}</Text>
        </View>
        <View style={styles.summaryCard}>
          <View
            style={[styles.summaryIcon, { backgroundColor: COLORS.amberLight }]}
          >
            <Ionicons name="play" size={16} color={COLORS.amber} />
          </View>
          <Text style={styles.summaryValue}>{stats.active}</Text>
          <Text style={styles.summaryLabel}>{t('goals.summary.active')}</Text>
        </View>
        <View style={styles.summaryCard}>
          <View
            style={[styles.summaryIcon, { backgroundColor: COLORS.primaryLight }]}
          >
            <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
          </View>
          <Text style={styles.summaryValue}>{stats.completed}</Text>
          <Text style={styles.summaryLabel}>{t('goals.summary.done')}</Text>
        </View>
        <View style={styles.summaryCard}>
          <View
            style={[styles.summaryIcon, { backgroundColor: COLORS.purpleLight }]}
          >
            <Ionicons name="time" size={16} color={COLORS.purple} />
          </View>
          <Text style={styles.summaryValue}>{stats.pendingApproval}</Text>
          <Text style={styles.summaryLabel}>{t('goals.summary.pending')}</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('goals.searchPlaceholder')}
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

      {activeFilterCount > 0 && (
        <View style={styles.activeFiltersRow}>
          {filterStatus !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {t(`goals.statuses.${STATUS_KEY[filterStatus]}`)}
              </Text>
              <TouchableOpacity onPress={() => setFilterStatus('All')}>
                <Ionicons name="close" size={14} color={COLORS.purple} />
              </TouchableOpacity>
            </View>
          )}
          {filterPriority !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {t(`goals.priorities.${PRIORITY_KEY[filterPriority]}`)}
              </Text>
              <TouchableOpacity onPress={() => setFilterPriority('All')}>
                <Ionicons name="close" size={14} color={COLORS.purple} />
              </TouchableOpacity>
            </View>
          )}
          {filterTimeframe !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {t(`goals.timeframes.${TIMEFRAME_KEY[filterTimeframe]}`)}
              </Text>
              <TouchableOpacity onPress={() => setFilterTimeframe('All')}>
                <Ionicons name="close" size={14} color={COLORS.purple} />
              </TouchableOpacity>
            </View>
          )}
          {filterTarget !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {t(`goals.targetTypes.${TARGET_KEY[filterTarget]}`)}
              </Text>
              <TouchableOpacity onPress={() => setFilterTarget('All')}>
                <Ionicons name="close" size={14} color={COLORS.purple} />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearFiltersText}>
              {t('goals.clearAll')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && goals.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.purple} />
          <Text style={styles.loadingText}>{t('goals.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredGoals}
          keyExtractor={(item) => item._id}
          renderItem={renderGoal}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.purple]}
              tintColor={COLORS.purple}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="flag-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>
                {t('goals.noResultsTitle')}
              </Text>
              <Text style={styles.emptyText}>
                {searchTerm || activeFilterCount > 0
                  ? t('goals.noResultsFiltered')
                  : isTeacher
                  ? t('goals.noResultsEmptyTeacher')
                  : t('goals.noResultsEmptyAdmin')}
              </Text>
              {activeFilterCount > 0 || searchTerm ? (
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={clearFilters}
                >
                  <Text style={styles.emptyButtonText}>
                    {t('goals.clearFilters')}
                  </Text>
                </TouchableOpacity>
              ) : !isTeacher ? (
                <TouchableOpacity style={styles.emptyButton} onPress={openAdd}>
                  <Text style={styles.emptyButtonText}>
                    {t('goals.createGoal')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      {/* ADD MODAL */}
      <GoalFormModal
        visible={addVisible}
        title={t('goals.addModalTitle')}
        form={goalForm}
        setForm={setGoalForm}
        teachers={teachers}
        halaqahs={halaqahs}
        onClose={() => setAddVisible(false)}
        onSubmit={handleCreate}
        submitting={processing}
        submitLabel={t('goals.createGoal')}
        submitIcon="add"
      />

      {/* EDIT MODAL */}
      <GoalFormModal
        visible={editVisible}
        title={t('goals.editModalTitle')}
        form={goalForm}
        setForm={setGoalForm}
        teachers={teachers}
        halaqahs={halaqahs}
        onClose={() => setEditVisible(false)}
        onSubmit={handleUpdate}
        submitting={processing}
        submitLabel={t('goals.editModalTitle')}
        submitIcon="checkmark"
      />

      {/* DETAILS MODAL */}
      <GoalDetailsModal
        visible={detailsVisible}
        goal={selectedGoal}
        teachers={teachers}
        halaqahs={halaqahs}
        isTeacher={isTeacher}
        onClose={() => {
          setDetailsVisible(false);
          setSelectedGoal(null);
        }}
        onEdit={(g) => {
          setDetailsVisible(false);
          openEdit(g);
        }}
        onDelete={(g) => {
          setDetailsVisible(false);
          setSelectedGoal(g);
          setDeleteVisible(true);
        }}
        onExtend={(g) => {
          setDetailsVisible(false);
          setSelectedGoal(g);
          setExtendForm({ newEndDate: '', reason: '' });
          setExtendVisible(true);
        }}
        onMarkComplete={(g) => {
          setDetailsVisible(false);
          setSelectedGoal(g);
          setMarkCompleteVisible(true);
        }}
        onApproveGoal={(g) => handleApproveGoal(g)}
        onRejectGoal={(g) => handleRejectGoal(g)}
        onRequestComplete={(g) => handleRequestGoalComplete(g)}
        onToggleTask={handleToggleTask}
        onRequestTaskComplete={handleRequestTaskComplete}
        onApproveTask={handleApproveTask}
        onRejectTask={handleRejectTask}
      />

      {/* EXTEND MODAL */}
      <Modal
        visible={extendVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setExtendVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalContainer, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {t('goals.extendModalTitle')}
                </Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {selectedGoal?.title}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setExtendVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>
                {t('goals.fields.newEndDate')} *
              </Text>
              <TextInput
                style={styles.formInput}
                value={extendForm.newEndDate}
                onChangeText={(v) =>
                  setExtendForm({ ...extendForm, newEndDate: v })
                }
                placeholder={t('goals.placeholders.date')}
                placeholderTextColor="#A0AAA5"
                autoCapitalize="none"
              />

              <Text style={styles.formLabel}>
                {t('goals.fields.reason')}
              </Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={extendForm.reason}
                onChangeText={(v) =>
                  setExtendForm({ ...extendForm, reason: v })
                }
                placeholder={t('goals.placeholders.reason')}
                placeholderTextColor="#A0AAA5"
                multiline
              />

              {selectedGoal?.endDate ? (
                <Text style={styles.hint}>
                  {t('goals.currentDeadline', {
                    date: formatDate(
                      selectedGoal.endDate,
                      t('goals.notSet')
                    ),
                  })}
                </Text>
              ) : null}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setExtendVisible(false)}
                disabled={processing}
              >
                <Text style={styles.cancelBtnText}>
                  {t('goals.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: COLORS.amber },
                  processing && { opacity: 0.7 },
                ]}
                onPress={handleExtendGoal}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="calendar" size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>
                      {t('goals.extend')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MARK COMPLETE MODAL */}
      <Modal
        visible={markCompleteVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setMarkCompleteVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedGoal?.status === 'Pending Approval'
                  ? t('goals.approveGoalTitle')
                  : t('goals.markCompleteTitle')}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setMarkCompleteVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.deleteText}>
                {selectedGoal?.status === 'Pending Approval'
                  ? t('goals.approveConfirmMsg', {
                      title: selectedGoal?.title || '',
                    })
                  : t('goals.completeConfirmMsg', {
                      title: selectedGoal?.title || '',
                    })}
              </Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setMarkCompleteVisible(false)}
                disabled={processing}
              >
                <Text style={styles.cancelBtnText}>
                  {t('goals.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, processing && { opacity: 0.7 }]}
                onPress={() =>
                  selectedGoal && handleMarkComplete(selectedGoal)
                }
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>
                      {selectedGoal?.status === 'Pending Approval'
                        ? t('goals.approve')
                        : t('goals.complete')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DELETE MODAL */}
      <Modal
        visible={deleteVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('goals.deleteModalTitle')}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setDeleteVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.deleteIconWrap}>
                <Ionicons name="trash-outline" size={32} color={COLORS.red} />
              </View>
              <Text style={styles.deleteText}>
                {t('goals.deleteConfirmMsg', {
                  title: selectedGoal?.title || '',
                })}
              </Text>
              <Text style={styles.deleteHint}>
                {t('goals.deleteCannotUndo')}
              </Text>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setDeleteVisible(false)}
                disabled={processing}
              >
                <Text style={styles.cancelBtnText}>
                  {t('goals.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerBtn, processing && { opacity: 0.7 }]}
                onPress={handleDelete}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                    <Text style={styles.dangerBtnText}>
                      {t('goals.delete')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* FILTER MODAL */}
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        filterPriority={filterPriority}
        setFilterPriority={setFilterPriority}
        filterTimeframe={filterTimeframe}
        setFilterTimeframe={setFilterTimeframe}
        filterTarget={filterTarget}
        setFilterTarget={setFilterTarget}
        onReset={clearFilters}
      />
    </SafeAreaView>
  );
};

export default GoalSettingScreen;

// ============================================================
// FORM MODAL
// ============================================================
interface GoalFormState {
  _id: string | null;
  title: string;
  description: string;
  targetType: TargetType | '';
  assignedTo: string;
  timeframe: Timeframe | '';
  priority: Priority;
  startDate: string;
  endDate: string;
  tasks: string[];
  notes: string;
  status: GoalStatus;
  progress: number;
}

const GoalFormModal: React.FC<{
  visible: boolean;
  title: string;
  form: GoalFormState;
  setForm: React.Dispatch<React.SetStateAction<GoalFormState>>;
  teachers: TeacherRef[];
  halaqahs: HalaqahRef[];
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
  submitIcon: keyof typeof Ionicons.glyphMap;
}> = ({
  visible,
  title,
  form,
  setForm,
  teachers,
  halaqahs,
  onClose,
  onSubmit,
  submitting,
  submitLabel,
  submitIcon,
}) => {
  const { t } = useTranslation();
  const assigneeList = useMemo(() => {
    if (form.targetType === 'Teacher') return teachers;
    if (form.targetType === 'Halaqah') return halaqahs;
    return [];
  }, [form.targetType, teachers, halaqahs]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={onClose}
              disabled={submitting}
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
              {t('goals.fields.title')} *
            </Text>
            <TextInput
              style={styles.formInput}
              value={form.title}
              onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
              placeholder={t('goals.placeholders.title')}
              placeholderTextColor="#A0AAA5"
            />

            <Text style={styles.formLabel}>
              {t('goals.fields.description')}
            </Text>
            <TextInput
              style={[styles.formInput, styles.textArea]}
              value={form.description}
              onChangeText={(v) =>
                setForm((p) => ({ ...p, description: v }))
              }
              placeholder={t('goals.placeholders.description')}
              placeholderTextColor="#A0AAA5"
              multiline
            />

            <Text style={styles.formLabel}>
              {t('goals.fields.targetType')} *
            </Text>
            <View style={styles.chipRow}>
              {TARGET_TYPES.map((tp) => {
                const active = form.targetType === tp;
                return (
                  <TouchableOpacity
                    key={tp}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() =>
                      setForm((p) => ({
                        ...p,
                        targetType: tp,
                        assignedTo: tp === 'Both' ? 'both' : '',
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {t(`goals.targetTypes.${TARGET_KEY[tp]}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {form.targetType && form.targetType !== 'Both' && (
              <>
                <Text style={styles.formLabel}>
                  {form.targetType === 'Teacher'
                    ? t('goals.fields.teacher')
                    : t('goals.fields.halaqah')}{' '}
                  *
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                >
                  {assigneeList.map((item) => {
                    const active = form.assignedTo === item._id;
                    return (
                      <TouchableOpacity
                        key={item._id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() =>
                          setForm((p) => ({ ...p, assignedTo: item._id }))
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,
                            active && styles.chipTextActive,
                          ]}
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {assigneeList.length === 0 && (
                    <Text style={styles.hint}>
                      {t('goals.loadingShort')}
                    </Text>
                  )}
                </ScrollView>
              </>
            )}

            <Text style={styles.formLabel}>
              {t('goals.fields.priority')}
            </Text>
            <View style={styles.chipRow}>
              {PRIORITIES.map((p) => {
                const ps = getPriorityStyle(p);
                const active = form.priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.chip,
                      active && {
                        backgroundColor: ps.bg,
                        borderColor: ps.text,
                      },
                    ]}
                    onPress={() =>
                      setForm((prev) => ({ ...prev, priority: p }))
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && { color: ps.text, fontWeight: '800' },
                      ]}
                    >
                      {t(`goals.priorities.${PRIORITY_KEY[p]}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.formLabel}>
              {t('goals.fields.timeframe')}
            </Text>
            <View style={styles.chipRow}>
              {TIMEFRAMES.map((tp) => {
                const active = form.timeframe === tp;
                return (
                  <TouchableOpacity
                    key={tp}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() =>
                      setForm((p) => ({ ...p, timeframe: tp }))
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {t(`goals.timeframes.${TIMEFRAME_KEY[tp]}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.formLabel}>
              {t('goals.fields.startDate')}
            </Text>
            <TextInput
              style={styles.formInput}
              value={form.startDate}
              onChangeText={(v) => setForm((p) => ({ ...p, startDate: v }))}
              placeholder={t('goals.placeholders.date')}
              placeholderTextColor="#A0AAA5"
              autoCapitalize="none"
            />

            <Text style={styles.formLabel}>
              {t('goals.fields.endDate')}
            </Text>
            <TextInput
              style={styles.formInput}
              value={form.endDate}
              onChangeText={(v) => setForm((p) => ({ ...p, endDate: v }))}
              placeholder={t('goals.placeholders.date')}
              placeholderTextColor="#A0AAA5"
              autoCapitalize="none"
            />

            <Text style={styles.formLabel}>
              {t('goals.fields.status')}
            </Text>
            <View style={styles.chipRow}>
              {(['Pending', 'In Progress'] as GoalStatus[]).map((s) => {
                const active = form.status === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setForm((p) => ({ ...p, status: s }))}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {t(`goals.statuses.${STATUS_KEY[s]}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.formLabel}>
              {t('goals.fields.tasks')}
            </Text>
            {form.tasks.map((task, idx) => (
              <View key={idx} style={styles.taskInputRow}>
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  value={task}
                  onChangeText={(v) => {
                    const next = [...form.tasks];
                    next[idx] = v;
                    setForm((p) => ({ ...p, tasks: next }));
                  }}
                  placeholder={t('goals.placeholders.task', { n: idx + 1 })}
                  placeholderTextColor="#A0AAA5"
                />
                {form.tasks.length > 1 && (
                  <TouchableOpacity
                    style={styles.removeTaskBtn}
                    onPress={() =>
                      setForm((p) => ({
                        ...p,
                        tasks: p.tasks.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    <Ionicons name="close" size={18} color={COLORS.red} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity
              style={styles.addTaskBtn}
              onPress={() =>
                setForm((p) => ({ ...p, tasks: [...p.tasks, ''] }))
              }
            >
              <Ionicons
                name="add-circle-outline"
                size={16}
                color={COLORS.purple}
              />
              <Text style={styles.addTaskText}>
                {t('goals.addTask')}
              </Text>
            </TouchableOpacity>

            <Text style={styles.formLabel}>
              {t('goals.fields.progress')}
            </Text>
            <TextInput
              style={styles.formInput}
              value={String(form.progress)}
              onChangeText={(v) => {
                const n = Math.max(
                  0,
                  Math.min(
                    100,
                    parseInt(v.replace(/[^0-9]/g, ''), 10) || 0
                  )
                );
                setForm((p) => ({ ...p, progress: n }));
              }}
              keyboardType="numeric"
            />

            <Text style={styles.formLabel}>
              {t('goals.fields.notes')}
            </Text>
            <TextInput
              style={[styles.formInput, styles.textArea]}
              value={form.notes}
              onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))}
              placeholder={t('goals.placeholders.notes')}
              placeholderTextColor="#A0AAA5"
              multiline
            />

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.cancelBtnText}>{t('goals.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, submitting && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name={submitIcon} size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>{submitLabel}</Text>
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
// DETAILS MODAL
// ============================================================
const GoalDetailsModal: React.FC<{
  visible: boolean;
  goal: Goal | null;
  teachers: TeacherRef[];
  halaqahs: HalaqahRef[];
  isTeacher: boolean;
  onClose: () => void;
  onEdit: (g: Goal) => void;
  onDelete: (g: Goal) => void;
  onExtend: (g: Goal) => void;
  onMarkComplete: (g: Goal) => void;
  onApproveGoal: (g: Goal) => void;
  onRejectGoal: (g: Goal) => void;
  onRequestComplete: (g: Goal) => void;
  onToggleTask: (g: Goal, idx: number) => void;
  onRequestTaskComplete: (g: Goal, idx: number) => void;
  onApproveTask: (g: Goal, idx: number) => void;
  onRejectTask: (g: Goal, idx: number) => void;
}> = ({
  visible,
  goal,
  teachers,
  halaqahs,
  isTeacher,
  onClose,
  onEdit,
  onDelete,
  onExtend,
  onMarkComplete,
  onApproveGoal,
  onRejectGoal,
  onRequestComplete,
  onToggleTask,
  onRequestTaskComplete,
  onApproveTask,
  onRejectTask,
}) => {
  const { t } = useTranslation();
  if (!goal) return null;
  const statusStyle = getStatusStyle(goal.status);
  const priorityStyle = getPriorityStyle(goal.priority);
  const completedTasks =
    goal.tasks?.filter((tt) => tt.completed)?.length || 0;
  const totalTasks = goal.tasks?.length || 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {goal.title}
              </Text>
              <Text style={styles.modalSubtitle}>
                {t('goals.detailsSubtitle')}
              </Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.badgeRow}>
              <View
                style={[styles.badge, { backgroundColor: statusStyle.bg }]}
              >
                <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                  {t(`goals.statuses.${STATUS_KEY[goal.status]}`)}
                </Text>
              </View>
              {goal.status === 'Pending Approval' && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: COLORS.purpleLight },
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={10}
                    color={COLORS.purple}
                  />
                  <Text style={[styles.badgeText, { color: COLORS.purple }]}>
                    {t('goals.waitingForAdmin')}
                  </Text>
                </View>
              )}
              <View
                style={[styles.badge, { backgroundColor: priorityStyle.bg }]}
              >
                <Text style={[styles.badgeText, { color: priorityStyle.text }]}>
                  {t(`goals.priorities.${PRIORITY_KEY[goal.priority]}`)}
                </Text>
              </View>
            </View>

            <View style={styles.detailsProgressCard}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>
                  {t('goals.progressLabel')}
                </Text>
                <Text style={styles.progressValue}>
                  {goal.progress || 0}%
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(goal.progress || 0, 100)}%` },
                  ]}
                />
              </View>
            </View>

            <InfoRow
              label={t('goals.fields.assignedTo')}
              value={getAssigneeName(goal, teachers, halaqahs, t)}
              icon="person-outline"
            />
            <InfoRow
              label={t('goals.fields.timeframe')}
              value={
                goal.timeframe
                  ? t(`goals.timeframes.${TIMEFRAME_KEY[goal.timeframe]}`)
                  : t('goals.notSet')
              }
              icon="time-outline"
            />
            <InfoRow
              label={t('goals.fields.startDate')}
              value={formatDate(goal.startDate, t('goals.notSet'))}
              icon="calendar-outline"
            />
            <InfoRow
              label={t('goals.fields.endDate')}
              value={formatDate(goal.endDate, t('goals.notSet'))}
              icon="calendar-outline"
            />
            {goal.description ? (
              <View style={styles.descriptionBlock}>
                <Text style={styles.descriptionText}>
                  {goal.description}
                </Text>
              </View>
            ) : null}

            {totalTasks > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  {t('goals.tasksLabel', {
                    completed: completedTasks,
                    total: totalTasks,
                  })}
                </Text>
                {goal.tasks.map((task, idx) => {
                  const isDone = task.completed === true;
                  const isPending = task.pendingApproval === true;
                  const title =
                    typeof task === 'string' ? task : task.title;
                  return (
                    <View key={idx} style={styles.taskDetailRow}>
                      <TouchableOpacity
                        style={[
                          styles.taskCheckbox,
                          isDone && styles.taskCheckboxActive,
                          isPending && styles.taskCheckboxPending,
                        ]}
                        onPress={() => {
                          if (isTeacher) onRequestTaskComplete(goal, idx);
                          else onToggleTask(goal, idx);
                        }}
                        disabled={isDone}
                      >
                        {isDone ? (
                          <Ionicons
                            name="checkmark"
                            size={12}
                            color="#fff"
                          />
                        ) : isPending ? (
                          <Ionicons
                            name="time-outline"
                            size={12}
                            color={COLORS.purple}
                          />
                        ) : null}
                      </TouchableOpacity>
                      <Text
                        style={[
                          styles.taskDetailText,
                          isDone && styles.taskTextCompleted,
                          isPending && styles.taskTextPending,
                        ]}
                      >
                        {title}
                      </Text>
                      {!isTeacher && isPending ? (
                        <View style={styles.taskApproveRow}>
                          <TouchableOpacity
                            style={styles.taskApproveBtn}
                            onPress={() => onApproveTask(goal, idx)}
                          >
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color={COLORS.primary}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.taskRejectBtn}
                            onPress={() => onRejectTask(goal, idx)}
                          >
                            <Ionicons
                              name="close"
                              size={14}
                              color={COLORS.red}
                            />
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {goal.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesText}>{goal.notes}</Text>
              </View>
            ) : null}

            <View style={{ height: 20 }} />
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.detailsActions}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          >
            {!isTeacher && (
              <TouchableOpacity
                style={[styles.actionChip, { borderColor: COLORS.blue }]}
                onPress={() => onEdit(goal)}
              >
                <Ionicons
                  name="create-outline"
                  size={14}
                  color={COLORS.blue}
                />
                <Text
                  style={[styles.actionChipText, { color: COLORS.blue }]}
                >
                  {t('goals.edit')}
                </Text>
              </TouchableOpacity>
            )}

            {!isTeacher && goal.status === 'Pending Approval' && (
              <>
                <TouchableOpacity
                  style={[
                    styles.actionChip,
                    { borderColor: COLORS.primary },
                  ]}
                  onPress={() => onApproveGoal(goal)}
                >
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={COLORS.primary}
                  />
                  <Text
                    style={[
                      styles.actionChipText,
                      { color: COLORS.primary },
                    ]}
                  >
                    {t('goals.approve')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionChip, { borderColor: COLORS.red }]}
                  onPress={() => onRejectGoal(goal)}
                >
                  <Ionicons name="close" size={14} color={COLORS.red} />
                  <Text
                    style={[styles.actionChipText, { color: COLORS.red }]}
                  >
                    {t('goals.reject')}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {!isTeacher &&
              goal.status !== 'Pending Approval' &&
              goal.status !== 'Completed' && (
                <TouchableOpacity
                  style={[
                    styles.actionChip,
                    { borderColor: COLORS.primary },
                  ]}
                  onPress={() => onMarkComplete(goal)}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={COLORS.primary}
                  />
                  <Text
                    style={[
                      styles.actionChipText,
                      { color: COLORS.primary },
                    ]}
                  >
                    {t('goals.complete')}
                  </Text>
                </TouchableOpacity>
              )}

            {isTeacher &&
              goal.status !== 'Completed' &&
              goal.status !== 'Pending Approval' && (
                <TouchableOpacity
                  style={[
                    styles.actionChip,
                    { borderColor: COLORS.purple },
                  ]}
                  onPress={() => onRequestComplete(goal)}
                >
                  <Ionicons
                    name="send-outline"
                    size={14}
                    color={COLORS.purple}
                  />
                  <Text
                    style={[
                      styles.actionChipText,
                      { color: COLORS.purple },
                    ]}
                  >
                    {t('goals.request')}
                  </Text>
                </TouchableOpacity>
              )}

            {goal.status !== 'Completed' &&
              goal.status !== 'Cancelled' &&
              goal.status !== 'Pending Approval' && (
                <TouchableOpacity
                  style={[
                    styles.actionChip,
                    { borderColor: COLORS.amber },
                  ]}
                  onPress={() => onExtend(goal)}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={14}
                    color={COLORS.amber}
                  />
                  <Text
                    style={[styles.actionChipText, { color: COLORS.amber }]}
                  >
                    {t('goals.extend')}
                  </Text>
                </TouchableOpacity>
              )}

            {!isTeacher && (
              <TouchableOpacity
                style={[styles.actionChip, { borderColor: COLORS.red }]}
                onPress={() => onDelete(goal)}
              >
                <Ionicons name="trash-outline" size={14} color={COLORS.red} />
                <Text
                  style={[styles.actionChipText, { color: COLORS.red }]}
                >
                  {t('goals.delete')}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// INFO ROW
// ============================================================
const InfoRow: React.FC<{
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = ({ label, value, icon }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIcon}>
      <Ionicons name={icon} size={16} color={COLORS.purple} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  </View>
);

// ============================================================
// FILTER MODAL
// ============================================================
const FilterModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  filterStatus: 'All' | GoalStatus;
  setFilterStatus: (v: 'All' | GoalStatus) => void;
  filterPriority: 'All' | Priority;
  setFilterPriority: (v: 'All' | Priority) => void;
  filterTimeframe: 'All' | Timeframe;
  setFilterTimeframe: (v: 'All' | Timeframe) => void;
  filterTarget: 'All' | TargetType;
  setFilterTarget: (v: 'All' | TargetType) => void;
  onReset: () => void;
}> = ({
  visible,
  onClose,
  filterStatus,
  setFilterStatus,
  filterPriority,
  setFilterPriority,
  filterTimeframe,
  setFilterTimeframe,
  filterTarget,
  setFilterTarget,
  onReset,
}) => {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { maxHeight: '85%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('goals.filterTitle')}</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.filterSectionTitle}>
              {t('goals.filterStatus')}
            </Text>
            <View style={styles.chipRow}>
              {(['All', ...STATUSES] as const).map((s) => {
                const active = filterStatus === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFilterStatus(s as any)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {s === 'All'
                        ? t('goals.all')
                        : t(`goals.statuses.${STATUS_KEY[s as GoalStatus]}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text
              style={[styles.filterSectionTitle, { marginTop: 16 }]}
            >
              {t('goals.filterPriority')}
            </Text>
            <View style={styles.chipRow}>
              {(['All', ...PRIORITIES] as const).map((p) => {
                const active = filterPriority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFilterPriority(p as any)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {p === 'All'
                        ? t('goals.all')
                        : t(
                            `goals.priorities.${
                              PRIORITY_KEY[p as Priority]
                            }`
                          )}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text
              style={[styles.filterSectionTitle, { marginTop: 16 }]}
            >
              {t('goals.filterTimeframe')}
            </Text>
            <View style={styles.chipRow}>
              {(['All', ...TIMEFRAMES] as const).map((tp) => {
                const active = filterTimeframe === tp;
                return (
                  <TouchableOpacity
                    key={tp}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFilterTimeframe(tp as any)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {tp === 'All'
                        ? t('goals.all')
                        : t(
                            `goals.timeframes.${
                              TIMEFRAME_KEY[tp as Timeframe]
                            }`
                          )}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text
              style={[styles.filterSectionTitle, { marginTop: 16 }]}
            >
              {t('goals.filterTarget')}
            </Text>
            <View style={styles.chipRow}>
              {(['All', ...TARGET_TYPES] as const).map((tp) => {
                const active = filterTarget === tp;
                return (
                  <TouchableOpacity
                    key={tp}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFilterTarget(tp as any)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {tp === 'All'
                        ? t('goals.all')
                        : t(
                            `goals.targetTypes.${
                              TARGET_KEY[tp as TargetType]
                            }`
                          )}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.filterResetBtn}
              onPress={() => {
                onReset();
                onClose();
              }}
            >
              <Text style={styles.filterResetBtnText}>
                {t('goals.reset')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterApplyBtn}
              onPress={onClose}
            >
              <Text style={styles.filterApplyBtnText}>
                {t('goals.applyFilters')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.slate },
  headerSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.purple,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  summaryValue: { fontSize: 16, fontWeight: '800', color: COLORS.slate },
  summaryLabel: { fontSize: 10, color: COLORS.slateMuted, fontWeight: '600' },

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

  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.purpleLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  activeFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.purple,
  },
  clearFiltersText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray,
    textDecorationLine: 'underline',
  },

  loadingWrap: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: COLORS.slateMuted, fontSize: 13 },

  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },

  goalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: { fontSize: 10, fontWeight: '800' },

  goalTitle: { fontSize: 15, fontWeight: '700', color: COLORS.slate },
  goalDescription: {
    fontSize: 12,
    color: COLORS.slateMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  goalMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: COLORS.slateMuted, fontWeight: '600' },
  dateRow: { marginTop: 6 },
  dateText: { fontSize: 11, color: COLORS.slateMuted },

  progressContainer: { marginTop: 12 },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: COLORS.slateMuted,
    fontWeight: '600',
  },
  progressValue: { fontSize: 11, fontWeight: '800', color: COLORS.purple },
  progressBar: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.purple,
  },

  tasksSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tasksSummaryText: {
    fontSize: 11,
    color: COLORS.slateMuted,
    fontWeight: '600',
  },
  tasksHint: { fontSize: 10, color: COLORS.purple, marginLeft: 4 },

  taskList: { marginTop: 8, gap: 4 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  taskCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCheckboxActive: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purple,
  },
  taskCheckboxPending: {
    backgroundColor: COLORS.purpleLight,
    borderColor: COLORS.purple,
  },
  taskText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.slate,
    fontWeight: '600',
  },
  taskTextCompleted: {
    textDecorationLine: 'line-through',
    color: COLORS.slateMuted,
  },
  taskTextPending: { color: COLORS.purple, fontWeight: '700' },
  taskApproveRow: { flexDirection: 'row', gap: 4 },
  taskApproveBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskRejectBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.redLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexWrap: 'wrap',
  },
  cardActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardActionText: { fontSize: 12, fontWeight: '700' },

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
  emptyButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.purple,
    borderRadius: 10,
  },
  emptyButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },

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
    justifyContent: 'space-between',
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

  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
    marginTop: 12,
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
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  hint: {
    fontSize: 11,
    color: COLORS.gray,
    fontStyle: 'italic',
    marginTop: 6,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.purpleLight,
    borderColor: COLORS.purple,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: COLORS.slateMuted },
  chipTextActive: { color: COLORS.purple },

  taskInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  removeTaskBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.redLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 8,
  },
  addTaskText: { fontSize: 13, fontWeight: '700', color: COLORS.purple },

  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
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
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.purple,
    gap: 6,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  dangerBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.red,
    gap: 6,
  },
  dangerBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  deleteIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.redLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  deleteText: {
    fontSize: 14,
    color: COLORS.slate,
    textAlign: 'center',
    lineHeight: 20,
  },
  deleteHint: {
    fontSize: 12,
    color: COLORS.slateMuted,
    textAlign: 'center',
    marginTop: 6,
    fontStyle: 'italic',
  },

  detailsProgressCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
  },
  descriptionBlock: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  descriptionText: {
    fontSize: 13,
    color: COLORS.slate,
    lineHeight: 19,
  },

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
    backgroundColor: COLORS.purpleLight,
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

  section: { marginTop: 20 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
    marginBottom: 10,
  },
  taskDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    marginBottom: 6,
    gap: 10,
  },
  taskDetailText: {
    fontSize: 13,
    color: COLORS.slate,
    flex: 1,
    fontWeight: '600',
  },

  notesBox: {
    backgroundColor: COLORS.amberLight,
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  notesText: {
    fontSize: 12,
    color: COLORS.amber,
    fontWeight: '600',
    lineHeight: 18,
  },

  detailsActions: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 12,
    maxHeight: 60,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: COLORS.white,
  },
  actionChipText: { fontSize: 12, fontWeight: '700' },

  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 12,
    marginBottom: 8,
  },
  filterActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  filterResetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterResetBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate,
  },
  filterApplyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.purple,
    alignItems: 'center',
  },
  filterApplyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});