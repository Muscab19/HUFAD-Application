// src/screens/admin/memorization/GroupsSection.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  COLORS,
  ACHIEVEMENT_TYPES,
  Student,
  Halaqah,
  GroupType,
  SubacGroup,
  getTypeInfo,
} from './_shared';
import {
  FeedbackModal,
  FeedbackTone,
  FeedbackButton,
} from './_shared/pickers';

// ============================================================
// GROUP CARD
// ============================================================
interface GroupCardProps {
  group: SubacGroup;
  memberCount: number;
  onRecord: (g: SubacGroup) => void;
  onEdit: (g: SubacGroup) => void;
  onDelete: (g: SubacGroup) => void;
}

const GroupCard: React.FC<GroupCardProps> = ({
  group,
  memberCount,
  onRecord,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const typeInfo = getTypeInfo(group.type, t);
  return (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <View style={[styles.groupIcon, { backgroundColor: typeInfo.bg }]}>
          <Ionicons name={typeInfo.icon} size={18} color={typeInfo.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.groupName} numberOfLines={1}>
            {group.name}
          </Text>
          <View style={styles.groupMetaRow}>
            <View style={[styles.typePill, { backgroundColor: typeInfo.bg }]}>
              <Text style={[styles.typePillText, { color: typeInfo.color }]}>
                {typeInfo.label}
              </Text>
            </View>
            <Text style={styles.groupMemberCount}>
              {memberCount} {t('memorization.members') || 'members'}
            </Text>
          </View>
        </View>
        <View style={styles.groupActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onEdit(group)}
          >
            <Ionicons name="create-outline" size={16} color={COLORS.blue} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onDelete(group)}
          >
            <Ionicons name="close" size={16} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.recordBtn,
          { backgroundColor: typeInfo.color || COLORS.primary },
        ]}
        onPress={() => onRecord(group)}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle" size={16} color="#fff" />
        <Text style={styles.recordBtnText}>
          {t('memorization.record_group_achievement') ||
            'Record Group Achievement'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ============================================================
// GROUPS SECTION
// ============================================================
interface GroupsSectionProps {
  groups: SubacGroup[];
  students: Student[];
  halaqat: Halaqah[];
  onCreate: (g: SubacGroup) => void;
  onUpdate: (g: SubacGroup) => void;
  onDelete: (g: SubacGroup) => void;
  onRecord: (g: SubacGroup) => void;
}

export const GroupsSection: React.FC<GroupsSectionProps> = ({
  groups,
  students,
  halaqat,
  onCreate,
  onUpdate,
  onDelete,
  onRecord,
}) => {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<SubacGroup | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    type: GroupType;
    classFilter: string;
    members: string[];
  }>({
    name: '',
    type: 'memorization',
    classFilter: 'all',
    members: [],
  });

  // ============================================================
  // FEEDBACK POPUP (replaces Alert.alert)
  // ============================================================
  const [feedback, setFeedback] = useState<{
    visible: boolean;
    tone: FeedbackTone;
    title: string;
    message?: string;
    buttons?: FeedbackButton[];
  }>({ visible: false, tone: 'info', title: '' });

  const notify = (
    tone: FeedbackTone,
    title: string,
    message?: string,
    buttons?: FeedbackButton[]
  ) => setFeedback({ visible: true, tone, title, message, buttons });

  const filteredStudents = useMemo(() => {
    if (form.classFilter === 'all') return students;
    return students.filter((s) => {
      const hid = typeof s.halaqah === 'object' ? s.halaqah?._id : s.halaqah;
      return hid === form.classFilter;
    });
  }, [students, form.classFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      type: 'memorization',
      classFilter: 'all',
      members: [],
    });
    setModalVisible(true);
  };

  const openEdit = (g: SubacGroup) => {
    setEditing(g);
    setForm({
      name: g.name,
      type: g.type,
      classFilter: 'all',
      members: g.members,
    });
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      notify(
        'warning',
        t('memorization.group_name_required') || 'Group name required',
        t('memorization.enter_group_name') || 'Please enter a group name.'
      );
      return;
    }
    if (!form.members.length) {
      notify(
        'warning',
        t('memorization.members_required') || 'Members required',
        t('memorization.select_at_least_one_member') ||
          'Please select at least one member.'
      );
      return;
    }
    if (editing) {
      onUpdate({
        ...editing,
        name: form.name.trim(),
        type: form.type,
        members: form.members,
      });
    } else {
      onCreate({
        id: `g-${Date.now()}`,
        name: form.name.trim(),
        type: form.type,
        members: form.members,
        createdAt: new Date().toISOString(),
      });
    }
    setModalVisible(false);
  };

  const toggleMember = (id: string) => {
    setForm((prev) =>
      prev.members.includes(id)
        ? { ...prev, members: prev.members.filter((x) => x !== id) }
        : { ...prev, members: [...prev.members, id] }
    );
  };

  return (
    <View style={styles.container}>
      {/* ============ HEADER ROW (always visible, tappable to expand) ============ */}
      <View style={styles.sectionHeader}>
        <TouchableOpacity
          style={styles.sectionHeaderLeft}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={16}
            color={COLORS.slate}
          />
          <Text style={styles.sectionTitle}>
            {t('memorization.groups') || 'Groups'}
          </Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{groups.length}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.newBtn}
          onPress={openCreate}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.newBtnText}>{t('memorization.new') || 'New'}</Text>
        </TouchableOpacity>
      </View>

      {/* ============ COLLAPSIBLE BODY ============ */}
      {expanded && (
        <>
          {groups.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={36} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                {t('memorization.no_groups') ||
                  'No groups yet. Create one to get started.'}
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.groupsScroll}
              contentContainerStyle={styles.groupsScrollContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {groups.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  memberCount={g.members.length}
                  onRecord={onRecord}
                  onEdit={openEdit}
                  onDelete={(grp) => onDelete(grp)}
                />
              ))}
            </ScrollView>
          )}
        </>
      )}

      {/* ============ CREATE / EDIT MODAL ============ */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editing
                  ? t('memorization.edit_group') || 'Edit Group'
                  : t('memorization.create_group') || 'Create Group'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 520 }}
              contentContainerStyle={{ padding: 20, gap: 12 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Name */}
              <Text style={styles.label}>
                {t('memorization.group_name') || 'Group Name'}
              </Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
                placeholder={t('memorization.enter_group_name') || 'Enter name'}
                placeholderTextColor="#A0AAA5"
              />

              {/* Type */}
              <Text style={styles.label}>
                {t('memorization.achievement_type') || 'Achievement Type'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                {ACHIEVEMENT_TYPES.map((ty) => {
                  const active = form.type === ty.value;
                  return (
                    <TouchableOpacity
                      key={ty.value}
                      style={[
                        styles.typeChip,
                        active && {
                          backgroundColor: ty.bg,
                          borderColor: ty.color,
                        },
                      ]}
                      onPress={() => setForm((p) => ({ ...p, type: ty.value }))}
                    >
                      <Ionicons
                        name={ty.icon}
                        size={13}
                        color={active ? ty.color : COLORS.slateMuted}
                      />
                      <Text
                        style={[
                          styles.typeChipText,
                          active && { color: ty.color, fontWeight: '800' },
                        ]}
                      >
                        {t(ty.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Halaqah filter */}
              <Text style={styles.label}>
                {t('memorization.filter_by_halaqah') || 'Filter by Halaqah'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    form.classFilter === 'all' && styles.filterChipActive,
                  ]}
                  onPress={() => setForm((p) => ({ ...p, classFilter: 'all' }))}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      form.classFilter === 'all' && styles.filterChipTextActive,
                    ]}
                  >
                    {t('memorization.all_halaqahs') || 'All'}
                  </Text>
                </TouchableOpacity>
                {halaqat
                  .filter((h) => !h.isAll)
                  .map((h) => {
                    const active = form.classFilter === h._id;
                    return (
                      <TouchableOpacity
                        key={h._id}
                        style={[
                          styles.filterChip,
                          active && styles.filterChipActive,
                        ]}
                        onPress={() =>
                          setForm((p) => ({ ...p, classFilter: h._id }))
                        }
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            active && styles.filterChipTextActive,
                          ]}
                        >
                          {h.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>

              {/* Members */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={styles.label}>
                  {t('memorization.select_members') || 'Members'} (
                  {form.members.length})
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={styles.miniBtn}
                    onPress={() =>
                      setForm((p) => ({
                        ...p,
                        members: filteredStudents.map((s) => s._id),
                      }))
                    }
                  >
                    <Text style={styles.miniBtnText}>
                      {t('memorization.select_all') || 'All'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.miniBtn}
                    onPress={() => setForm((p) => ({ ...p, members: [] }))}
                  >
                    <Text style={styles.miniBtnText}>
                      {t('memorization.clear') || 'Clear'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.memberList}>
                {filteredStudents.map((s) => {
                  const checked = form.members.includes(s._id);
                  return (
                    <TouchableOpacity
                      key={s._id}
                      style={styles.memberRow}
                      onPress={() => toggleMember(s._id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          checked && styles.checkboxActive,
                        ]}
                      >
                        {checked && (
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        )}
                      </View>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelText}>
                  {t('memorization.cancel') || 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  (!form.name.trim() || !form.members.length) && {
                    opacity: 0.5,
                  },
                ]}
                onPress={handleSave}
                disabled={!form.name.trim() || !form.members.length}
              >
                <Text style={styles.saveText}>
                  {editing
                    ? t('memorization.update_group') || 'Update'
                    : t('memorization.create_group') || 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Professional feedback popup (replaces Alert.alert) */}
      <FeedbackModal
        visible={feedback.visible}
        tone={feedback.tone}
        title={feedback.title}
        message={feedback.message}
        buttons={feedback.buttons}
        onClose={() => setFeedback((p) => ({ ...p, visible: false }))}
      />
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingRight: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.slate },
  countBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  newBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // ---- Collapsible groups scroll container ----
  groupsScroll: {
    maxHeight: 320,
  },
  groupsScrollContent: {
    gap: 10,
    paddingBottom: 4,
  },

  groupCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: { fontSize: 15, fontWeight: '800', color: COLORS.slate },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  typePillText: { fontSize: 10, fontWeight: '800' },
  groupMemberCount: {
    fontSize: 11,
    color: COLORS.slateMuted,
    fontWeight: '600',
  },
  groupActions: { flexDirection: 'row', gap: 4 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  recordBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  emptyBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    color: COLORS.slateMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
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
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.slate,
    backgroundColor: COLORS.white,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  typeChipText: { fontSize: 11, fontWeight: '700', color: COLORS.slateMuted },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: { fontSize: 12, fontWeight: '700', color: COLORS.slateMuted },
  filterChipTextActive: { color: '#fff' },

  miniBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  miniBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.slate },

  memberList: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  checkboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  memberName: { fontSize: 13, color: COLORS.slate, flex: 1 },

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
  cancelText: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  saveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});