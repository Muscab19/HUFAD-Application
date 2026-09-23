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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api as apiClient } from '../../api/client';
import { useBranch } from '../../context/BranchContext';

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
type ParentStatus = 'Active' | 'Inactive';

interface Child {
  _id: string;
  name: string;
  regNo: string;
  fee?: number;
  scholarship?: number;
  netFee?: number;
  feeFrequency?: string;
  halaqah?: { name: string } | string;
}

interface Parent {
  _id: string;
  name: string;
  gender: 'Male' | 'Female';
  email: string;
  phone: string;
  status: ParentStatus;
  children?: Child[];
  childrenCount?: number;
  totalFees?: number;
  totalScholarship?: number;
  totalNetFee?: number;
  profilePic?: string;
  createdAt?: string;
}

interface Student {
  _id: string;
  name: string;
  regNo: string;
  fee?: number;
  halaqah?: { name: string } | string;
}

interface FormState {
  name: string;
  gender: 'Male' | 'Female';
  email: string;
  phone: string;
  status: ParentStatus;
  children: string[];
}

const getEmptyForm = (): FormState => ({
  name: '',
  gender: 'Male',
  email: '',
  phone: '',
  status: 'Active',
  children: [],
});

// ============================================================
// HELPERS
// ============================================================
const getInitials = (name: string) => {
  const parts = (name || '').trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || '').substring(0, 2).toUpperCase();
};

const formatMoney = (n?: number) =>
  `$${(Number(n) || 0).toFixed(2)}`;

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
      <Ionicons name={icon} size={16} color={COLORS.primary} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  </View>
);

// ============================================================
// MAIN SCREEN
// ============================================================
export const ParentsManagementScreen: React.FC = () => {
  const { t } = useTranslation();
  const { currentBranch } = useBranch();

  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'All' | ParentStatus>('All');
  const [sortConfig] = useState({ key: 'name', direction: 'asc' as 'asc' | 'desc' });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalParents, setTotalParents] = useState(0);
  const parentsPerPage = 10;

  const [students, setStudents] = useState<Student[]>([]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormState>(getEmptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [sendSmsVisible, setSendSmsVisible] = useState(false);
  const [bulkSmsVisible, setBulkSmsVisible] = useState(false);
  const [smsMessage, setSmsMessage] = useState('');
  const [sendingSms, setSendingSms] = useState(false);

  const [resetPasswordVisible, setResetPasswordVisible] = useState(false);

  const [linkStudentVisible, setLinkStudentVisible] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');

  // Debounce
  useEffect(() => {
    const tmr = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(tmr);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedStatus]);

  // ============================================================
  // FETCH
  // ============================================================
  const fetchParents = useCallback(async () => {
    setError('');
    try {
      const params: Record<string, any> = {
        page: currentPage,
        limit: parentsPerPage,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
      };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (selectedStatus !== 'All') params.status = selectedStatus;

      const res: any = await apiClient.get('/parents', params);
      const list = Array.isArray(res?.parents) ? res.parents : [];
      setParents(list);
      setTotalPages(Number(res?.totalPages) || 1);
      setTotalParents(Number(res?.totalParents) || list.length);
    } catch (err: any) {
      console.error('Fetch parents error:', err);
      setError(err?.message || 'Failed to load parents.');
      setParents([]);
    }
  }, [currentPage, debouncedSearch, selectedStatus, sortConfig]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchParents();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchParents]);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await apiClient.get('/students', { limit: 1000 });
        const list = res?.students || res?.data || [];
        setStudents(Array.isArray(list) ? list : []);
      } catch (err) {
        console.warn('Failed to load students for picker:', err);
      }
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchParents();
    setRefreshing(false);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('All');
    setCurrentPage(1);
  };

  const hasActiveFilters = !!searchTerm || selectedStatus !== 'All';

  const stats = useMemo(() => {
    const totalChildren = parents.reduce(
      (sum, p) => sum + (p.childrenCount ?? p.children?.length ?? 0),
      0
    );
    const netFees = parents.reduce((sum, p) => sum + (p.totalNetFee ?? 0), 0);
    return { totalChildren, netFees };
  }, [parents]);

  // ============================================================
  // FORM
  // ============================================================
  const openAddForm = () => {
    setIsEditing(false);
    setFormData(getEmptyForm());
    setFormError('');
    setFormModalVisible(true);
  };

  const openEditForm = (parent: Parent) => {
    setIsEditing(true);
    setFormData({
      name: parent.name || '',
      gender: parent.gender || 'Male',
      email: parent.email || '',
      phone: parent.phone || '',
      status: parent.status || 'Active',
      children: (parent.children || []).map((c) => c._id).filter(Boolean),
    });
    setFormError('');
    setViewModalVisible(false);
    setFormModalVisible(true);
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleChild = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      children: prev.children.includes(id)
        ? prev.children.filter((c) => c !== id)
        : [...prev.children, id],
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return t('parents.validation.nameRequired');
    if (!formData.email.trim()) return t('parents.validation.emailRequired');
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(formData.email.trim())) return t('parents.validation.emailInvalid');
    if (!formData.phone.trim()) return t('parents.validation.phoneRequired');
    return null;
  };

  const handleSave = async () => {
    if (!currentBranch?._id) {
      setFormError(t('parents.branchRequired'));
      return;
    }
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const fd = new FormData();
      fd.append('name', formData.name.trim());
      fd.append('email', formData.email.trim());
      fd.append('phone', formData.phone.trim());
      fd.append('gender', formData.gender);
      fd.append('status', formData.status);
      fd.append('branchId', currentBranch._id);

      formData.children.forEach((id) => fd.append('children', id));

      if (isEditing && selectedParent) {
        await apiClient.put(`/parents/${selectedParent._id}`, fd);
      } else {
        const response: any = await apiClient.post('/parents', fd);
        if (response?.loginCredentials) {
          Alert.alert(
            t('parents.parentAddedTitle'),
            t('parents.parentAddedMsg', {
              username: response.loginCredentials.username,
              password: response.loginCredentials.temporaryPassword,
            }),
          );
        }
      }

      setFormModalVisible(false);
      setSelectedParent(null);
      await fetchParents();
    } catch (err: any) {
      console.error('Save parent error:', err);
      setFormError(
        err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to save parent.'
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // VIEW / DELETE
  // ============================================================
  const openViewModal = async (parent: Parent) => {
    setSelectedParent(parent);
    setViewModalVisible(true);
    try {
      const fresh: any = await apiClient.get(`/parents/${parent._id}`);
      const p = fresh?.parent || fresh?.data || fresh;
      if (p && p._id) setSelectedParent(p);
    } catch {
      // silent
    }
  };

  const handleDelete = (parent: Parent) => {
    Alert.alert(
      t('parents.deleteTitle'),
      t('parents.deleteMsg', { name: parent.name }),
      [
        { text: t('parents.cancel'), style: 'cancel' },
        {
          text: t('parents.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/parents/${parent._id}`);
              setViewModalVisible(false);
              await fetchParents();
              Alert.alert(t('parents.deletedTitle'), t('parents.deletedMsg'));
            } catch (err: any) {
              Alert.alert(t('parents.errorTitle'), err?.message || 'Failed to delete parent.');
            }
          },
        },
      ]
    );
  };

  const handleUnlinkChild = (parent: Parent, childId: string) => {
    Alert.alert(t('parents.unlinkTitle'), t('parents.unlinkMsg'), [
      { text: t('parents.cancel'), style: 'cancel' },
      {
        text: t('parents.unlink'),
        style: 'destructive',
        onPress: async () => {
          try {
            const remaining = (parent.children || [])
              .map((c) => c._id)
              .filter((id) => id !== childId);
            await apiClient.put(`/parents/${parent._id}`, { children: remaining });
            const fresh: any = await apiClient.get(`/parents/${parent._id}`);
            const p = fresh?.parent || fresh?.data || fresh;
            if (p && p._id) setSelectedParent(p);
            await fetchParents();
          } catch (err: any) {
            Alert.alert(t('parents.errorTitle'), err?.message || 'Failed to unlink child.');
          }
        },
      },
    ]);
  };

  const handleLinkStudent = async (studentId: string) => {
    if (!selectedParent) return;
    try {
      const current = (selectedParent.children || []).map((c) => c._id);
      if (current.includes(studentId)) return;
      await apiClient.put(`/parents/${selectedParent._id}`, {
        children: [...current, studentId],
      });
      const fresh: any = await apiClient.get(`/parents/${selectedParent._id}`);
      const p = fresh?.parent || fresh?.data || fresh;
      if (p && p._id) setSelectedParent(p);
      await fetchParents();
      setLinkStudentVisible(false);
      setLinkSearch('');
      Alert.alert(t('parents.linkedTitle'), t('parents.linkedMsg'));
    } catch (err: any) {
      Alert.alert(t('parents.errorTitle'), err?.message || 'Failed to link student.');
    }
  };

  const handleSendSms = async () => {
    if (!selectedParent?.phone) {
      Alert.alert(t('parents.errorTitle'), t('parents.sms.noPhone'));
      return;
    }
    if (!smsMessage.trim()) {
      Alert.alert(t('parents.errorTitle'), t('parents.sms.noMessage'));
      return;
    }
    setSendingSms(true);
    try {
      await apiClient.post('/sms/send', {
        phoneNumber: selectedParent.phone,
        message: smsMessage.trim(),
        parentId: selectedParent._id,
      });
      Alert.alert(
        t('parents.sms.sentTitle'),
        t('parents.sms.sentMsg', { name: selectedParent.name })
      );
      setSendSmsVisible(false);
      setSmsMessage('');
    } catch (err: any) {
      Alert.alert(
        t('parents.sms.failedTitle'),
        err?.message || t('parents.sms.failedMsg')
      );
    } finally {
      setSendingSms(false);
    }
  };

  const handleSendBulkSms = async () => {
    if (selectedIds.size === 0) {
      Alert.alert(t('parents.errorTitle'), t('parents.sms.noSelection'));
      return;
    }
    if (!smsMessage.trim()) {
      Alert.alert(t('parents.errorTitle'), t('parents.sms.noMessage'));
      return;
    }
    setSendingSms(true);
    try {
      const res: any = await apiClient.post('/sms/bulk', {
        parentIds: Array.from(selectedIds),
        message: smsMessage.trim(),
      });
      const summary = res?.summary || {};
      Alert.alert(
        t('parents.sms.bulkSentTitle'),
        t('parents.sms.bulkSentMsg', {
          total: summary.total || selectedIds.size,
          ok: summary.successful ?? '?',
          failed: summary.failed ?? '?',
        })
      );
      setBulkSmsVisible(false);
      setSmsMessage('');
      setSelectedIds(new Set());
    } catch (err: any) {
      Alert.alert(
        t('parents.sms.failedTitle'),
        err?.message || t('parents.sms.failedMsg')
      );
    } finally {
      setSendingSms(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedParent) return;
    Alert.alert(
      t('parents.reset.modalTitle'),
      `${t('parents.reset.message', { email: selectedParent.email })}\n\n${t('parents.reset.notWired')}`
    );
    setResetPasswordVisible(false);
  };

  const openWhatsApp = (phone: string) => {
    const clean = (phone || '').replace(/[^\d]/g, '');
    const url = `https://wa.me/${clean}`;
    Linking.openURL(url).catch(() =>
      Alert.alert(t('parents.errorTitle'), t('parents.whatsapp.failed'))
    );
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ============================================================
  // RENDER PARENT CARD
  // ============================================================
  const renderParent = ({ item }: { item: Parent }) => {
    const isActive = item.status === 'Active';
    const isSelected = selectedIds.has(item._id);
    const childCount = item.childrenCount ?? item.children?.length ?? 0;
    const netFee = item.totalNetFee ?? 0;

    return (
      <TouchableOpacity
        style={[styles.parentCard, isSelected && styles.parentCardSelected]}
        activeOpacity={0.7}
        onPress={() => openViewModal(item)}
        onLongPress={() => toggleSelected(item._id)}
      >
        <View style={styles.parentRow}>
          <TouchableOpacity
            style={styles.checkboxTouch}
            onPress={() => toggleSelected(item._id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={20}
              color={isSelected ? COLORS.blue : COLORS.gray}
            />
          </TouchableOpacity>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
          </View>

          <View style={styles.parentInfo}>
            <Text style={styles.parentName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.parentMetaRow}>
              <Ionicons name="call-outline" size={11} color={COLORS.slateMuted} />
              <Text style={styles.parentPhone}>{item.phone || '—'}</Text>
            </View>
            <View style={styles.parentTags}>
              <View style={styles.childrenTag}>
                <Ionicons name="people-outline" size={11} color={COLORS.blue} />
                <Text style={styles.childrenText}>
                  {childCount === 1
                    ? t('parents.childLabel', { count: childCount })
                    : t('parents.childLabelPlural', { count: childCount })}
                </Text>
              </View>
              <View style={styles.feeTag}>
                <Text style={styles.feeText}>{formatMoney(netFee)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.parentRight}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isActive ? COLORS.primaryLight : '#F1F5F9' },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: isActive ? COLORS.primary : COLORS.gray },
                ]}
              >
                {item.status}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color="#B7C3BD"
              style={{ marginTop: 8 }}
            />
          </View>
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
        <View>
          <Text style={styles.headerTitle}>{t('parents.headerTitle')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('parents.headerSubtitle', {
              count: parents.length,
              total: totalParents,
            })}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {selectedIds.size > 0 ? (
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: COLORS.blueLight }]}
              onPress={() => setBulkSmsVisible(true)}
            >
              <Ionicons name="chatbubbles-outline" size={20} color={COLORS.blue} />
              <View style={styles.bulkBadge}>
                <Text style={styles.bulkBadgeText}>{selectedIds.size}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setFilterModalVisible(true)}
            >
              <Ionicons name="filter-outline" size={20} color={COLORS.slate} />
              {hasActiveFilters && <View style={styles.filterDot} />}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.addButton} onPress={openAddForm}>
            <Ionicons name="add" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: COLORS.blueLight }]}>
            <Ionicons name="people" size={16} color={COLORS.blue} />
          </View>
          <Text style={styles.summaryValue}>{totalParents}</Text>
          <Text style={styles.summaryLabel}>{t('parents.sections.parents')}</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: COLORS.primaryLight }]}>
            <Ionicons name="school" size={16} color={COLORS.primary} />
          </View>
          <Text style={styles.summaryValue}>{stats.totalChildren}</Text>
          <Text style={styles.summaryLabel}>{t('parents.sections.children')}</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: COLORS.purpleLight }]}>
            <Ionicons name="wallet" size={16} color={COLORS.purple} />
          </View>
          <Text style={styles.summaryValue}>{formatMoney(stats.netFees)}</Text>
          <Text style={styles.summaryLabel}>{t('parents.sections.netFees')}</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('parents.searchPlaceholder')}
            placeholderTextColor="#A0AAA5"
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCapitalize="none"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.gray} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {selectedStatus !== 'All' && (
        <View style={styles.activeFiltersRow}>
          <View style={styles.activeFilter}>
            <Text style={styles.activeFilterText}>{selectedStatus}</Text>
            <TouchableOpacity onPress={() => setSelectedStatus('All')}>
              <Ionicons name="close" size={14} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearFiltersText}>{t('parents.clearAll')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError('')}>
            <Ionicons name="close" size={16} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && parents.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('parents.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={parents}
          keyExtractor={(item) => item._id}
          renderItem={renderParent}
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
              <Ionicons name="people-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>{t('parents.noResultsTitle')}</Text>
              <Text style={styles.emptyText}>
                {hasActiveFilters
                  ? t('parents.noResultsFiltered')
                  : t('parents.noResultsEmpty')}
              </Text>
              {hasActiveFilters ? (
                <TouchableOpacity style={styles.emptyButton} onPress={clearFilters}>
                  <Text style={styles.emptyButtonText}>{t('parents.clearFilters')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.emptyButton} onPress={openAddForm}>
                  <Text style={styles.emptyButtonText}>{t('parents.addParent')}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[
                    styles.paginationBtn,
                    currentPage === 1 && styles.paginationBtnDisabled,
                  ]}
                  disabled={currentPage === 1}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={currentPage === 1 ? COLORS.gray : COLORS.slate}
                  />
                </TouchableOpacity>
                <Text style={styles.paginationText}>
                  {t('parents.pageOf', { page: currentPage, total: totalPages })}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.paginationBtn,
                    currentPage === totalPages && styles.paginationBtnDisabled,
                  ]}
                  disabled={currentPage === totalPages}
                  onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={currentPage === totalPages ? COLORS.gray : COLORS.slate}
                  />
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}

      {/* VIEW MODAL */}
      <Modal
        visible={viewModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('parents.details')}</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setViewModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            {selectedParent && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.modalProfile}>
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>
                      {getInitials(selectedParent.name)}
                    </Text>
                  </View>
                  <Text style={styles.modalName}>{selectedParent.name}</Text>
                  <Text style={styles.modalEmail}>{selectedParent.email}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          selectedParent.status === 'Active'
                            ? COLORS.primaryLight
                            : '#F1F5F9',
                        marginTop: 10,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color:
                            selectedParent.status === 'Active'
                              ? COLORS.primary
                              : COLORS.gray,
                        },
                      ]}
                    >
                      {selectedParent.status}
                    </Text>
                  </View>
                </View>

                <InfoRow
                  label={t('parents.infoLabels.gender')}
                  value={selectedParent.gender}
                  icon="person-outline"
                />
                <InfoRow
                  label={t('parents.infoLabels.phone')}
                  value={selectedParent.phone}
                  icon="call-outline"
                />
                <InfoRow
                  label={t('parents.infoLabels.email')}
                  value={selectedParent.email}
                  icon="mail-outline"
                />
                <InfoRow
                  label={t('parents.infoLabels.memberSince')}
                  value={
                    selectedParent.createdAt
                      ? new Date(selectedParent.createdAt).toLocaleDateString()
                      : '—'
                  }
                  icon="calendar-outline"
                />

                <View style={styles.feeSummary}>
                  <Text style={styles.sectionLabel}>{t('parents.feeSummary')}</Text>
                  <View style={styles.feeGrid}>
                    <View style={styles.feeItem}>
                      <Text style={styles.feeLabel}>
                        {t('parents.feeLabels.totalFees')}
                      </Text>
                      <Text style={styles.feeValue}>
                        {formatMoney(selectedParent.totalFees)}
                      </Text>
                    </View>
                    <View style={styles.feeItem}>
                      <Text style={styles.feeLabel}>
                        {t('parents.feeLabels.scholarship')}
                      </Text>
                      <Text style={[styles.feeValue, { color: COLORS.primary }]}>
                        {formatMoney(selectedParent.totalScholarship)}
                      </Text>
                    </View>
                    <View style={styles.feeItem}>
                      <Text style={styles.feeLabel}>
                        {t('parents.feeLabels.netTotal')}
                      </Text>
                      <Text style={[styles.feeValue, { color: COLORS.purple }]}>
                        {formatMoney(selectedParent.totalNetFee)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.childrenSection}>
                  <View style={styles.childrenHeader}>
                    <Text style={styles.sectionLabel}>
                      {t('parents.childrenSection', {
                        count: selectedParent.children?.length || 0,
                      })}
                    </Text>
                    <TouchableOpacity
                      style={styles.linkBtn}
                      onPress={() => setLinkStudentVisible(true)}
                    >
                      <Ionicons name="link-outline" size={14} color={COLORS.blue} />
                      <Text style={styles.linkBtnText}>
                        {t('parents.linkStudent')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {(selectedParent.children || []).length === 0 ? (
                    <Text style={styles.emptyChildrenText}>
                      {t('parents.noChildrenLinked')}
                    </Text>
                  ) : (
                    (selectedParent.children || []).map((child) => (
                      <View key={child._id} style={styles.childCard}>
                        <View style={styles.childAvatar}>
                          <Text style={styles.childAvatarText}>
                            {(child.name || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.childInfo}>
                          <Text style={styles.childName}>{child.name}</Text>
                          <Text style={styles.childReg}>{child.regNo}</Text>
                        </View>
                        <View style={styles.childFee}>
                          <Text style={styles.childFeeValue}>
                            {formatMoney(child.netFee ?? child.fee)}
                          </Text>
                          <Text style={styles.childFeeLabel}>
                            {child.feeFrequency || t('parents.feeLabels.monthly')}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleUnlinkChild(selectedParent, child._id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={20} color={COLORS.red} />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.quickActions}>
                  <TouchableOpacity
                    style={styles.quickActionBtn}
                    onPress={() => setSendSmsVisible(true)}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.quickActionText}>
                      {t('parents.quickActions.sms')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickActionBtn}
                    onPress={() => openWhatsApp(selectedParent.phone)}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                    <Text style={styles.quickActionText}>
                      {t('parents.quickActions.whatsapp')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickActionBtn}
                    onPress={() => setResetPasswordVisible(true)}
                  >
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={18}
                      color={COLORS.purple}
                    />
                    <Text style={styles.quickActionText}>
                      {t('parents.quickActions.reset')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.actionBtnOutline}
                    onPress={() => openEditForm(selectedParent)}
                  >
                    <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.actionBtnOutlineText}>
                      {t('parents.buttons.edit')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtnDanger}
                    onPress={() => handleDelete(selectedParent)}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                    <Text style={styles.actionBtnDangerText}>
                      {t('parents.buttons.delete')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* FILTER MODAL */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '50%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('parents.filterTitle')}</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.filterSectionTitle}>{t('parents.filterStatus')}</Text>
              <View style={styles.filterChipsRow}>
                {(['All', 'Active', 'Inactive'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.filterChip, selectedStatus === s && styles.filterChipActive]}
                    onPress={() => setSelectedStatus(s)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedStatus === s && styles.filterChipTextActive,
                      ]}
                    >
                      {s === 'All' ? t('parents.all') : s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.filterResetBtn} onPress={clearFilters}>
                <Text style={styles.filterResetBtnText}>{t('parents.reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.filterApplyBtnText}>{t('parents.applyFilters')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ADD / EDIT FORM MODAL */}
      <Modal
        visible={formModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => !saving && setFormModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditing ? t('parents.editTitle') : t('parents.addTitle')}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => !saving && setFormModalVisible(false)}
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
              {formError ? (
                <View style={styles.modalErrorBox}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.red} />
                  <Text style={styles.modalErrorText}>{formError}</Text>
                </View>
              ) : null}

              <Text style={styles.formLabel}>{t('parents.fields.fullName')} *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.name}
                onChangeText={(v) => updateField('name', v)}
                placeholder={t('parents.placeholders.fullName')}
                placeholderTextColor="#A0AAA5"
              />

              <Text style={styles.formLabel}>{t('parents.fields.gender')} *</Text>
              <View style={styles.chipRow}>
                {(['Male', 'Female'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.chip, formData.gender === g && styles.chipActive]}
                    onPress={() => updateField('gender', g)}
                  >
                    <Text
                      style={[styles.chipText, formData.gender === g && styles.chipTextActive]}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>{t('parents.fields.email')} *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.email}
                onChangeText={(v) => updateField('email', v)}
                placeholder={t('parents.placeholders.email')}
                placeholderTextColor="#A0AAA5"
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.formLabel}>{t('parents.fields.phone')} *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.phone}
                onChangeText={(v) => updateField('phone', v)}
                placeholder={t('parents.placeholders.phone')}
                placeholderTextColor="#A0AAA5"
                keyboardType="phone-pad"
              />

              <Text style={styles.formLabel}>{t('parents.fields.status')} *</Text>
              <View style={styles.chipRow}>
                {(['Active', 'Inactive'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, formData.status === s && styles.chipActive]}
                    onPress={() => updateField('status', s)}
                  >
                    <Text
                      style={[styles.chipText, formData.status === s && styles.chipTextActive]}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>
                {t('parents.fields.assignChildren', { count: formData.children.length })}
              </Text>
              <View style={styles.studentPicker}>
                {students.length === 0 ? (
                  <Text style={styles.formHint}>No students available</Text>
                ) : (
                  students.map((s) => {
                    const active = formData.children.includes(s._id);
                    return (
                      <TouchableOpacity
                        key={s._id}
                        style={styles.studentRow}
                        onPress={() => toggleChild(s._id)}
                      >
                        <Ionicons
                          name={active ? 'checkbox' : 'square-outline'}
                          size={18}
                          color={active ? COLORS.primary : COLORS.gray}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.studentName}>{s.name}</Text>
                          <Text style={styles.studentMeta}>
                            {s.regNo}
                            {s.fee ? ` • $${s.fee}` : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalActionsFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => !saving && setFormModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>{t('parents.buttons.cancel')}</Text>
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
                      {isEditing
                        ? t('parents.buttons.update')
                        : t('parents.buttons.save')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* SMS MODAL */}
      <Modal
        visible={sendSmsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSendSmsVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalContainer, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('parents.sms.modalTitle', { name: selectedParent?.name || '' })}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSendSmsVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.formLabel}>{t('parents.sms.recipient')}</Text>
              <Text style={styles.infoValue}>{selectedParent?.phone || '—'}</Text>

              <Text style={[styles.formLabel, { marginTop: 14 }]}>
                {t('parents.sms.message')}
              </Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                value={smsMessage}
                onChangeText={setSmsMessage}
                placeholder={t('parents.sms.messagePlaceholder')}
                placeholderTextColor="#A0AAA5"
                multiline
              />
              <Text style={styles.charCount}>
                {t('parents.sms.characters', { count: smsMessage.length })}
              </Text>
            </View>
            <View style={styles.modalActionsFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setSendSmsVisible(false)}
                disabled={sendingSms}
              >
                <Text style={styles.cancelBtnText}>{t('parents.buttons.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, sendingSms && { opacity: 0.7 }]}
                onPress={handleSendSms}
                disabled={sendingSms}
              >
                {sendingSms ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text style={styles.submitBtnText}>{t('parents.sms.send')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* BULK SMS MODAL */}
      <Modal
        visible={bulkSmsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBulkSmsVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalContainer, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('parents.sms.bulkTitle')}</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setBulkSmsVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.formLabel}>{t('parents.sms.recipients')}</Text>
              <Text style={styles.infoValue}>
                {t('parents.sms.recipientsSelected', { count: selectedIds.size })}
              </Text>

              <Text style={[styles.formLabel, { marginTop: 14 }]}>
                {t('parents.sms.message')}
              </Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                value={smsMessage}
                onChangeText={setSmsMessage}
                placeholder={t('parents.sms.messagePlaceholder')}
                placeholderTextColor="#A0AAA5"
                multiline
              />
              <Text style={styles.charCount}>
                {t('parents.sms.characters', { count: smsMessage.length })}
              </Text>
            </View>
            <View style={styles.modalActionsFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setBulkSmsVisible(false)}
                disabled={sendingSms}
              >
                <Text style={styles.cancelBtnText}>{t('parents.buttons.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, sendingSms && { opacity: 0.7 }]}
                onPress={handleSendBulkSms}
                disabled={sendingSms}
              >
                {sendingSms ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text style={styles.submitBtnText}>
                      {t('parents.sms.sendToCount', { count: selectedIds.size })}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* RESET PASSWORD MODAL */}
      <Modal
        visible={resetPasswordVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setResetPasswordVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '50%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('parents.reset.modalTitle')}</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setResetPasswordVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.infoValue}>
                {t('parents.reset.message', { email: selectedParent?.email || '' })}
              </Text>
              <Text style={[styles.formHint, { marginTop: 10 }]}>
                {t('parents.reset.notWired')}
              </Text>
            </View>
            <View style={styles.modalActionsFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setResetPasswordVisible(false)}
              >
                <Text style={styles.cancelBtnText}>{t('parents.reset.close')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleResetPassword}>
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>{t('parents.reset.send')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* LINK STUDENT MODAL */}
      <Modal
        visible={linkStudentVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setLinkStudentVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('parents.linkModal.title', { name: selectedParent?.name || '' })}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setLinkStudentVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.searchWrapper}>
                <Ionicons name="search-outline" size={18} color={COLORS.gray} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('parents.linkModal.searchPlaceholder')}
                  placeholderTextColor="#A0AAA5"
                  value={linkSearch}
                  onChangeText={setLinkSearch}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.studentPicker}>
                {students
                  .filter((s) => {
                    const alreadyLinked = (selectedParent?.children || []).some(
                      (c) => c._id === s._id
                    );
                    if (alreadyLinked) return false;
                    if (!linkSearch.trim()) return true;
                    const q = linkSearch.toLowerCase();
                    return (
                      s.name.toLowerCase().includes(q) ||
                      (s.regNo || '').toLowerCase().includes(q)
                    );
                  })
                  .map((s) => (
                    <View key={s._id} style={styles.studentRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.studentName}>{s.name}</Text>
                        <Text style={styles.studentMeta}>
                          {s.regNo}
                          {s.fee ? ` • $${s.fee}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.linkSmallBtn}
                        onPress={() => handleLinkStudent(s._id)}
                      >
                        <Text style={styles.linkSmallBtnText}>
                          {t('parents.linkModal.linkBtn')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ParentsManagementScreen;

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.slate },
  headerSubtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerIconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    position: 'relative',
  },
  bulkBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: COLORS.blue,
    alignItems: 'center', justifyContent: 'center',
  },
  bulkBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  filterDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.primary,
    borderWidth: 1.5, borderColor: COLORS.white,
  },
  addButton: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },

  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16, paddingBottom: 12, gap: 8,
  },
  summaryCard: {
    flex: 1, backgroundColor: COLORS.white,
    borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'flex-start',
  },
  summaryIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  summaryValue: { fontSize: 16, fontWeight: '800', color: COLORS.slate },
  summaryLabel: { fontSize: 10, color: COLORS.slateMuted, fontWeight: '600' },

  searchContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: COLORS.border,
    height: 44,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: COLORS.slate },

  activeFiltersRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
    gap: 8, flexWrap: 'wrap',
  },
  activeFilter: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, gap: 4,
  },
  activeFilterText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  clearFiltersText: {
    fontSize: 11, fontWeight: '600',
    color: COLORS.gray, textDecorationLine: 'underline',
  },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8, padding: 12,
    backgroundColor: COLORS.redLight,
    borderWidth: 1, borderColor: '#F6C8C8',
    borderRadius: 12,
  },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.red },

  loadingWrap: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: COLORS.slateMuted, fontSize: 13 },

  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },

  parentCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16, padding: 14,
    marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  parentCardSelected: {
    borderColor: COLORS.blue,
    backgroundColor: '#F0F7FF',
  },
  checkboxTouch: { paddingRight: 8, paddingVertical: 8 },
  parentRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.blueLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: COLORS.blue },
  parentInfo: { flex: 1 },
  parentName: {
    fontSize: 15, fontWeight: '700',
    color: COLORS.slate, marginBottom: 3,
  },
  parentMetaRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, marginBottom: 6,
  },
  parentPhone: { fontSize: 11, color: COLORS.slateMuted, fontWeight: '600' },
  parentTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  childrenTag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.blueLight,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, gap: 4,
  },
  childrenText: { fontSize: 10, fontWeight: '600', color: COLORS.blue },
  feeTag: {
    backgroundColor: COLORS.purpleLight,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
  },
  feeText: { fontSize: 10, fontWeight: '700', color: COLORS.purple },
  parentRight: { alignItems: 'flex-end', marginLeft: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },

  paginationRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 16, paddingVertical: 16,
  },
  paginationBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  paginationBtnDisabled: { opacity: 0.4 },
  paginationText: { fontSize: 13, fontWeight: '600', color: COLORS.slate },

  emptyContainer: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 60, paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.slate, marginTop: 16 },
  emptyText: {
    fontSize: 13, color: COLORS.slateMuted,
    textAlign: 'center', marginTop: 8, lineHeight: 20,
  },
  emptyButton: {
    marginTop: 20, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: COLORS.primary, borderRadius: 10,
  },
  emptyButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  modalCloseBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { paddingHorizontal: 20, paddingTop: 12 },

  modalProfile: { alignItems: 'center', paddingVertical: 20 },
  modalAvatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: COLORS.blue,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: COLORS.blue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  modalAvatarText: { fontSize: 32, fontWeight: '800', color: COLORS.white },
  modalName: { fontSize: 20, fontWeight: '800', color: COLORS.slate, textAlign: 'center' },
  modalEmail: { fontSize: 13, color: COLORS.slateMuted, marginTop: 4, fontWeight: '600' },

  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  infoIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: COLORS.slateMuted, fontWeight: '600' },
  infoValue: { fontSize: 14, color: COLORS.slate, fontWeight: '600', marginTop: 2 },

  feeSummary: {
    marginTop: 20, backgroundColor: COLORS.background,
    borderRadius: 14, padding: 16,
  },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: COLORS.slate },
  feeGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  feeItem: { alignItems: 'center' },
  feeLabel: {
    fontSize: 10, color: COLORS.slateMuted,
    fontWeight: '600', marginBottom: 4,
  },
  feeValue: { fontSize: 18, fontWeight: '800', color: COLORS.slate },

  childrenSection: { marginTop: 20 },
  childrenHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  linkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  linkBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.blue },
  emptyChildrenText: {
    fontSize: 12, color: COLORS.gray, fontStyle: 'italic',
    textAlign: 'center', paddingVertical: 16,
  },
  childCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, backgroundColor: COLORS.background,
    borderRadius: 12, marginBottom: 8, gap: 10,
  },
  childAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  childAvatarText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  childInfo: { flex: 1 },
  childName: { fontSize: 13, fontWeight: '700', color: COLORS.slate },
  childReg: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  childFee: { alignItems: 'flex-end' },
  childFeeValue: { fontSize: 14, fontWeight: '800', color: COLORS.purple },
  childFeeLabel: { fontSize: 9, color: COLORS.slateMuted },

  quickActions: {
    flexDirection: 'row', gap: 8, marginTop: 20, flexWrap: 'wrap',
  },
  quickActionBtn: {
    flex: 1, minWidth: 90,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, paddingHorizontal: 8,
    backgroundColor: COLORS.background,
    borderRadius: 12, gap: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  quickActionText: { fontSize: 12, fontWeight: '700', color: COLORS.slate },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtnOutline: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.primary, gap: 6,
  },
  actionBtnOutlineText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  actionBtnDanger: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.red, gap: 6,
  },
  actionBtnDangerText: { fontSize: 13, fontWeight: '700', color: COLORS.red },

  filterSectionTitle: {
    fontSize: 13, fontWeight: '800', color: COLORS.slate,
    marginTop: 12, marginBottom: 10,
  },
  filterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: COLORS.slateMuted },
  filterChipTextActive: { color: COLORS.white },
  filterActions: {
    flexDirection: 'row', padding: 20, gap: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  filterResetBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterResetBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  filterApplyBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.primary, alignItems: 'center',
  },
  filterApplyBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  formLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.slateMuted,
    marginTop: 14, marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.3,
  },
  formInput: {
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: COLORS.slate, backgroundColor: COLORS.white,
  },
  formTextarea: { minHeight: 90, textAlignVertical: 'top' },
  formHint: { fontSize: 11, color: COLORS.gray, fontStyle: 'italic' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.slateMuted },
  chipTextActive: { color: '#fff' },
  charCount: {
    fontSize: 11, color: COLORS.gray,
    textAlign: 'right', marginTop: 4,
  },

  studentPicker: {
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, padding: 8,
    maxHeight: 240, backgroundColor: COLORS.white,
  },
  studentRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingVertical: 8, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  studentName: { fontSize: 13, fontWeight: '700', color: COLORS.slate },
  studentMeta: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },
  linkSmallBtn: {
    backgroundColor: COLORS.blue,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8,
  },
  linkSmallBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  modalErrorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.redLight,
    borderWidth: 1, borderColor: '#F6C8C8',
    borderRadius: 10, padding: 10, marginTop: 12,
  },
  modalErrorText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.red },

  modalActionsFooter: {
    flexDirection: 'row', gap: 10, padding: 20,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  submitBtn: {
    flex: 2, flexDirection: 'row', gap: 6,
    paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});