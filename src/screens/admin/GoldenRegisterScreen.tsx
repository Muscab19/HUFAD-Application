// src/screens/admin/GoldenRegisterScreen.tsx
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { api as apiClient } from '../../api/client';

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
const ENDPOINTS = {
  list: '/getEntries',
  create: '/createEntry',
  update: (id: string) => `/updateEntry/${id}`,
  remove: (id: string) => `/deleteEntry/${id}`,
};

// ============================================================
// TYPES
// ============================================================
type AchievementType = 'Khatm' | 'Ijazah' | 'Both';
type Gender = 'Male' | 'Female';
type RiwayahValue = 'Hafs' | 'Warsh' | 'Qalun' | 'Al-Duri' | 'Shuubah';

interface GoldenEntry {
  _id: string;
  name: string;
  gender: Gender;
  date: string;
  photo?: string;
  type: AchievementType;
  riwayah: RiwayahValue;
  certifiedBy?: string;
  note?: string;
  guardianContact?: string;
  duration?: string;
}

// ============================================================
// CONSTANTS + KEY MAPS
// ============================================================
const RIWAYAT: { value: RiwayahValue; label: string; description: string }[] = [
  { value: 'Hafs', label: 'Hafs', description: "Hafs 'an 'Asim — most widely used" },
  { value: 'Warsh', label: 'Warsh', description: "Warsh 'an Nafi' — North & West Africa" },
  { value: 'Qalun', label: 'Qalun', description: "Qalun 'an Nafi' — Libya & parts of Africa" },
  { value: 'Al-Duri', label: 'Al-Duri', description: "Al-Duri 'an Abu Amr — Sudan & parts" },
  { value: 'Shuubah', label: 'Shuubah', description: "Shu'bah 'an 'Asim — complementary to Hafs" },
];

const ACHIEVEMENT_TYPES: AchievementType[] = ['Khatm', 'Ijazah', 'Both'];

const TYPE_KEY: Record<AchievementType, string> = {
  Khatm: 'khatm',
  Ijazah: 'ijazah',
  Both: 'both',
};

const GENDER_KEY: Record<Gender, string> = {
  Male: 'male',
  Female: 'female',
};

const getTypeColor = (type: AchievementType) => {
  switch (type) {
    case 'Khatm':
      return { bg: COLORS.primaryLight, text: COLORS.primary };
    case 'Ijazah':
      return { bg: COLORS.blueLight, text: COLORS.blue };
    case 'Both':
      return { bg: COLORS.purpleLight, text: COLORS.purple };
    default:
      return { bg: '#F1F5F9', text: COLORS.slateMuted };
  }
};

const getRiwayahDescription = (value: RiwayahValue) =>
  RIWAYAT.find((r) => r.value === value)?.description || '';

// ============================================================
// RESPONSE NORMALIZERS
// ============================================================
const unwrap = (res: any): any => {
  if (res && typeof res === 'object' && 'data' in res) return (res as any).data;
  return res;
};

const parseList = (res: any): GoldenEntry[] => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.entries)) return res.entries;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.results)) return res.results;
  return [];
};

const parseOne = (res: any): GoldenEntry | null => {
  if (!res) return null;
  if (res._id) return res as GoldenEntry;
  if (res.entry?._id) return res.entry as GoldenEntry;
  if (res.data?._id) return res.data as GoldenEntry;
  return null;
};

// ============================================================
// HELPERS
// ============================================================
const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const getInitials = (name: string) => {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const getAvatarColor = (gender: Gender) =>
  gender === 'Female'
    ? { bg: '#FCE7F3', text: '#DB2777' }
    : { bg: COLORS.blueLight, text: COLORS.blue };

// ============================================================
// SMALL COMPONENTS
// ============================================================
const InfoRow: React.FC<{
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = ({ label, value, icon }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIcon}>
      <Ionicons name={icon} size={16} color={COLORS.gold} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const TypeBadge: React.FC<{ type: AchievementType }> = ({ type }) => {
  const { t } = useTranslation();
  const c = getTypeColor(type);
  return (
    <View style={[styles.typeBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.typeBadgeText, { color: c.text }]}>
        {t(`goldenRegister.types.${TYPE_KEY[type]}`)}
      </Text>
    </View>
  );
};

// ============================================================
// FILTER MODAL
// ============================================================
const FilterModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  filters: {
    type: string;
    gender: string;
    riwayah: string;
    fromDate: string;
    toDate: string;
  };
  onApply: (f: {
    type: string;
    gender: string;
    riwayah: string;
    fromDate: string;
    toDate: string;
  }) => void;
}> = ({ visible, onClose, filters, onApply }) => {
  const { t } = useTranslation();
  const [local, setLocal] = useState(filters);

  useEffect(() => {
    if (visible) setLocal(filters);
  }, [visible, filters]);

  const reset = () => {
    setLocal({ type: '', gender: '', riwayah: '', fromDate: '', toDate: '' });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { maxHeight: '85%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {t('goldenRegister.filterTitle')}
            </Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.filterSectionTitle}>
              {t('goldenRegister.filterAchievement')}
            </Text>
            <View style={styles.filterChipsRow}>
              {['', ...ACHIEVEMENT_TYPES].map((type) => (
                <TouchableOpacity
                  key={type || 'all'}
                  style={[styles.filterChip, local.type === type && styles.filterChipActive]}
                  onPress={() => setLocal({ ...local, type })}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      local.type === type && styles.filterChipTextActive,
                    ]}
                  >
                    {type
                      ? t(
                          `goldenRegister.types.${
                            TYPE_KEY[type as AchievementType]
                          }`
                        )
                      : t('goldenRegister.all')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.filterSectionTitle, { marginTop: 20 }]}>
              {t('goldenRegister.filterGender')}
            </Text>
            <View style={styles.filterChipsRow}>
              {['', 'Male', 'Female'].map((g) => (
                <TouchableOpacity
                  key={g || 'all'}
                  style={[styles.filterChip, local.gender === g && styles.filterChipActive]}
                  onPress={() => setLocal({ ...local, gender: g })}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      local.gender === g && styles.filterChipTextActive,
                    ]}
                  >
                    {g
                      ? t(
                          `goldenRegister.genders.${
                            GENDER_KEY[g as Gender]
                          }`
                        )
                      : t('goldenRegister.all')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.filterSectionTitle, { marginTop: 20 }]}>
              {t('goldenRegister.filterRiwayah')}
            </Text>
            <View style={styles.filterChipsRow}>
              <TouchableOpacity
                style={[styles.filterChip, local.riwayah === '' && styles.filterChipActive]}
                onPress={() => setLocal({ ...local, riwayah: '' })}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    local.riwayah === '' && styles.filterChipTextActive,
                  ]}
                >
                  {t('goldenRegister.all')}
                </Text>
              </TouchableOpacity>
              {RIWAYAT.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.filterChip, local.riwayah === r.value && styles.filterChipActive]}
                  onPress={() => setLocal({ ...local, riwayah: r.value })}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      local.riwayah === r.value && styles.filterChipTextActive,
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.filterSectionTitle, { marginTop: 20 }]}>
              {t('goldenRegister.filterDateRange')}
            </Text>
            <View style={styles.dateRangeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateLabel}>
                  {t('goldenRegister.filterFrom')}
                </Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder={t('goldenRegister.datePlaceholder')}
                  placeholderTextColor="#A0AAA5"
                  value={local.fromDate}
                  onChangeText={(v) => setLocal({ ...local, fromDate: v })}
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateLabel}>
                  {t('goldenRegister.filterTo')}
                </Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder={t('goldenRegister.datePlaceholder')}
                  placeholderTextColor="#A0AAA5"
                  value={local.toDate}
                  onChangeText={(v) => setLocal({ ...local, toDate: v })}
                  autoCapitalize="none"
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.filterResetBtn} onPress={reset}>
              <Text style={styles.filterResetBtnText}>
                {t('goldenRegister.reset')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterApplyBtn}
              onPress={() => {
                onApply(local);
                onClose();
              }}
            >
              <Text style={styles.filterApplyBtnText}>
                {t('goldenRegister.applyFilters')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// ENTRY FORM MODAL
// ============================================================
const EntryFormModal: React.FC<{
  visible: boolean;
  isEditing: boolean;
  initial: Partial<GoldenEntry>;
  onClose: () => void;
  onSave: (entry: Partial<GoldenEntry>) => Promise<void>;
}> = ({ visible, isEditing, initial, onClose, onSave }) => {
  const { t } = useTranslation();
  const blank: Partial<GoldenEntry> = {
    name: '',
    gender: undefined,
    date: new Date().toISOString().split('T')[0],
    type: undefined,
    riwayah: undefined,
    certifiedBy: '',
    note: '',
    guardianContact: '',
    duration: '',
    photo: '',
  };

  const [form, setForm] = useState<Partial<GoldenEntry>>(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setForm({ ...blank, ...initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initial]);

  const update = <K extends keyof GoldenEntry>(key: K, value: GoldenEntry[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        t('goldenRegister.permission.title'),
        t('goldenRegister.permission.msg')
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      const asset = result.assets[0];
      const mime = asset.mimeType || 'image/jpeg';
      update('photo', `data:${mime};base64,${asset.base64}`);
    }
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      Alert.alert(
        t('goldenRegister.validation.missingTitle'),
        t('goldenRegister.validation.missingName')
      );
      return;
    }
    if (!form.gender) {
      Alert.alert(
        t('goldenRegister.validation.missingTitle'),
        t('goldenRegister.validation.missingGender')
      );
      return;
    }
    if (!form.type) {
      Alert.alert(
        t('goldenRegister.validation.missingTitle'),
        t('goldenRegister.validation.missingType')
      );
      return;
    }
    if (!form.riwayah) {
      Alert.alert(
        t('goldenRegister.validation.missingTitle'),
        t('goldenRegister.validation.missingRiwayah')
      );
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isEditing
                ? t('goldenRegister.form.editTitle')
                : t('goldenRegister.form.addTitle')}
            </Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <Ionicons name="person" size={16} color={COLORS.gold} />
                <Text style={styles.formSectionTitle}>
                  {t('goldenRegister.form.sectionPersonal')}
                </Text>
              </View>

              <Text style={styles.formLabel}>
                {t('goldenRegister.form.fullName')} *
              </Text>
              <TextInput
                style={styles.formInput}
                placeholder={t('goldenRegister.placeholders.fullName')}
                placeholderTextColor="#A0AAA5"
                value={form.name || ''}
                onChangeText={(v) => update('name', v)}
              />

              <Text style={[styles.formLabel, { marginTop: 12 }]}>
                {t('goldenRegister.form.gender')} *
              </Text>
              <View style={styles.filterChipsRow}>
                {(['Male', 'Female'] as Gender[]).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.filterChip, form.gender === g && styles.filterChipActive]}
                    onPress={() => update('gender', g)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        form.gender === g && styles.filterChipTextActive,
                      ]}
                    >
                      {t(`goldenRegister.genders.${GENDER_KEY[g]}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.formLabel, { marginTop: 12 }]}>
                {t('goldenRegister.form.dateOfCompletion')} *
              </Text>
              <TextInput
                style={styles.formInput}
                placeholder={t('goldenRegister.datePlaceholder')}
                placeholderTextColor="#A0AAA5"
                value={form.date || ''}
                onChangeText={(v) => update('date', v)}
                autoCapitalize="none"
              />

              <Text style={[styles.formLabel, { marginTop: 12 }]}>
                {t('goldenRegister.form.profilePicture')}
              </Text>
              <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto}>
                {form.photo ? (
                  <Image source={{ uri: form.photo }} style={styles.photoPreview} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={20} color={COLORS.gold} />
                    <Text style={styles.photoPickerText}>
                      {t('goldenRegister.form.uploadPhoto')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {form.photo ? (
                <TouchableOpacity onPress={() => update('photo', '')}>
                  <Text style={styles.removePhotoText}>
                    {t('goldenRegister.form.removePhoto')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <Ionicons name="trophy" size={16} color={COLORS.gold} />
                <Text style={styles.formSectionTitle}>
                  {t('goldenRegister.form.sectionAchievement')}
                </Text>
              </View>

              <Text style={styles.formLabel}>
                {t('goldenRegister.form.achievementType')} *
              </Text>
              <View style={styles.filterChipsRow}>
                {ACHIEVEMENT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.filterChip, form.type === type && styles.filterChipActive]}
                    onPress={() => update('type', type)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        form.type === type && styles.filterChipTextActive,
                      ]}
                    >
                      {t(`goldenRegister.types.${TYPE_KEY[type]}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.formLabel, { marginTop: 12 }]}>
                {t('goldenRegister.form.riwayah')} *
              </Text>
              <View style={styles.filterChipsRow}>
                {RIWAYAT.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    style={[styles.filterChip, form.riwayah === r.value && styles.filterChipActive]}
                    onPress={() => update('riwayah', r.value)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        form.riwayah === r.value && styles.filterChipTextActive,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {form.riwayah && (
                <Text style={styles.riwayahHint}>
                  {getRiwayahDescription(form.riwayah as RiwayahValue)}
                </Text>
              )}

              <Text style={[styles.formLabel, { marginTop: 12 }]}>
                {t('goldenRegister.form.certifiedBy')}
              </Text>
              <TextInput
                style={styles.formInput}
                placeholder={t('goldenRegister.placeholders.certifiedBy')}
                placeholderTextColor="#A0AAA5"
                value={form.certifiedBy || ''}
                onChangeText={(v) => update('certifiedBy', v)}
              />
            </View>

            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <Ionicons name="book" size={16} color={COLORS.gold} />
                <Text style={styles.formSectionTitle}>
                  {t('goldenRegister.form.sectionAdditional')}
                </Text>
              </View>

              <Text style={styles.formLabel}>
                {t('goldenRegister.form.duration')}
              </Text>
              <TextInput
                style={styles.formInput}
                placeholder={t('goldenRegister.placeholders.duration')}
                placeholderTextColor="#A0AAA5"
                value={form.duration || ''}
                onChangeText={(v) => update('duration', v)}
              />

              <Text style={[styles.formLabel, { marginTop: 12 }]}>
                {t('goldenRegister.form.guardianContact')}
              </Text>
              <TextInput
                style={styles.formInput}
                placeholder={t('goldenRegister.placeholders.guardianContact')}
                placeholderTextColor="#A0AAA5"
                value={form.guardianContact || ''}
                onChangeText={(v) => update('guardianContact', v)}
                keyboardType="phone-pad"
              />

              <Text style={[styles.formLabel, { marginTop: 12 }]}>
                {t('goldenRegister.form.note')}
              </Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                placeholder={t('goldenRegister.placeholders.note')}
                placeholderTextColor="#A0AAA5"
                value={form.note || ''}
                onChangeText={(v) => update('note', v)}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.filterResetBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.filterResetBtnText}>
                {t('goldenRegister.form.cancel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterApplyBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.filterApplyBtnText}>
                  {isEditing
                    ? t('goldenRegister.form.updateEntry')
                    : t('goldenRegister.form.saveEntry')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// ENTRY DETAILS MODAL
// ============================================================
const EntryDetailsModal: React.FC<{
  visible: boolean;
  entry: GoldenEntry | null;
  onClose: () => void;
  onEdit: (entry: GoldenEntry) => void;
  onDelete: (entry: GoldenEntry) => void;
}> = ({ visible, entry, onClose, onEdit, onDelete }) => {
  const { t } = useTranslation();
  if (!entry) return null;
  const avatar = getAvatarColor(entry.gender);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {t('goldenRegister.detailsTitle')}
            </Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.modalProfile}>
              {entry.photo ? (
                <Image source={{ uri: entry.photo }} style={styles.modalPhoto} />
              ) : (
                <View style={[styles.modalAvatar, { backgroundColor: avatar.bg }]}>
                  <Text style={[styles.modalAvatarText, { color: avatar.text }]}>
                    {getInitials(entry.name)}
                  </Text>
                </View>
              )}
              <Text style={styles.modalName}>{entry.name}</Text>
              <View style={{ marginTop: 8 }}>
                <TypeBadge type={entry.type} />
              </View>
            </View>

            <InfoRow
              label={t('goldenRegister.entryDetails.gender')}
              value={t(`goldenRegister.genders.${GENDER_KEY[entry.gender]}`)}
              icon="person-outline"
            />
            <InfoRow
              label={t('goldenRegister.entryDetails.riwayah')}
              value={entry.riwayah}
              icon="book-outline"
            />
            <InfoRow
              label={t('goldenRegister.entryDetails.dateOfCompletion')}
              value={formatDate(entry.date)}
              icon="calendar-outline"
            />
            {entry.certifiedBy ? (
              <InfoRow
                label={t('goldenRegister.entryDetails.certifiedBy')}
                value={entry.certifiedBy}
                icon="ribbon-outline"
              />
            ) : null}
            {entry.duration ? (
              <InfoRow
                label={t('goldenRegister.entryDetails.duration')}
                value={entry.duration}
                icon="time-outline"
              />
            ) : null}
            {entry.guardianContact ? (
              <InfoRow
                label={t('goldenRegister.entryDetails.guardianContact')}
                value={entry.guardianContact}
                icon="call-outline"
              />
            ) : null}
            {entry.note ? (
              <InfoRow
                label={t('goldenRegister.entryDetails.note')}
                value={entry.note}
                icon="document-text-outline"
              />
            ) : null}

            <View style={styles.riwayahBlock}>
              <Text style={styles.riwayahBlockLabel}>
                {t('goldenRegister.entryDetails.aboutRiwayah', {
                  riwayah: entry.riwayah,
                })}
              </Text>
              <Text style={styles.riwayahBlockText}>
                {getRiwayahDescription(entry.riwayah)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.deleteRowBtn}
              onPress={() => onDelete(entry)}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.red} />
              <Text style={styles.deleteRowText}>
                {t('goldenRegister.entryDetails.deleteEntry')}
              </Text>
            </TouchableOpacity>

            <View style={{ height: 24 }} />
          </ScrollView>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.filterResetBtn}
              onPress={() =>
                Alert.alert(
                  t('goldenRegister.comingSoonTitle'),
                  t('goldenRegister.comingSoonPrintMsg')
                )
              }
            >
              <Ionicons name="print-outline" size={16} color={COLORS.slate} />
              <Text style={[styles.filterResetBtnText, { marginLeft: 6 }]}>
                {t('goldenRegister.entryDetails.print')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterApplyBtn}
              onPress={() => onEdit(entry)}
            >
              <Text style={styles.filterApplyBtnText}>
                {t('goldenRegister.entryDetails.editEntry')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// MAIN SCREEN
// ============================================================
export const GoldenRegisterScreen: React.FC = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<GoldenEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    type: '',
    gender: '',
    riwayah: '',
    fromDate: '',
    toDate: '',
  });
  const [showFilterModal, setShowFilterModal] = useState(false);

  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingEntry, setEditingEntry] = useState<GoldenEntry | null>(null);

  const [selectedEntry, setSelectedEntry] = useState<GoldenEntry | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2500);
  };
  const flashError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const fetchEntries = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      try {
        const res: any = await apiClient.get(ENDPOINTS.list);
        const list = parseList(unwrap(res));
        setEntries(list);
        setError(null);
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          t('goldenRegister.loadFailed');
        flashError(msg);
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    fetchEntries(true);
  }, [fetchEntries]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEntries(false);
    setRefreshing(false);
  };

  const filteredEntries = useMemo(() => {
    let result = [...entries];

    if (filters.type) result = result.filter((e) => e.type === filters.type);
    if (filters.gender) result = result.filter((e) => e.gender === filters.gender);
    if (filters.riwayah) result = result.filter((e) => e.riwayah === filters.riwayah);

    if (filters.fromDate) {
      const from = new Date(filters.fromDate);
      if (!isNaN(from.getTime())) {
        result = result.filter((e) => new Date(e.date) >= from);
      }
    }
    if (filters.toDate) {
      const to = new Date(filters.toDate);
      if (!isNaN(to.getTime())) {
        result = result.filter((e) => new Date(e.date) <= to);
      }
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.certifiedBy || '').toLowerCase().includes(q)
      );
    }

    return result.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [entries, filters, searchTerm]);

  const activeFilterCount = useMemo(
    () =>
      [filters.type, filters.gender, filters.riwayah, filters.fromDate, filters.toDate].filter(
        Boolean
      ).length,
    [filters]
  );

  const clearFilters = () => {
    setFilters({ type: '', gender: '', riwayah: '', fromDate: '', toDate: '' });
    setSearchTerm('');
  };

  const openAddForm = () => {
    setIsEditing(false);
    setEditingEntry(null);
    setShowFormModal(true);
  };

  const openEditForm = (entry: GoldenEntry) => {
    setIsEditing(true);
    setEditingEntry(entry);
    setShowDetailsModal(false);
    setShowFormModal(true);
  };

  const handleSave = async (form: Partial<GoldenEntry>) => {
    setSaving(true);
    try {
      const payload = {
        name: form.name?.trim(),
        gender: form.gender,
        date: form.date,
        type: form.type,
        riwayah: form.riwayah,
        certifiedBy: form.certifiedBy || '',
        note: form.note || '',
        guardianContact: form.guardianContact || '',
        duration: form.duration || '',
        ...(form.photo ? { photo: form.photo } : {}),
      };

      if (isEditing && editingEntry) {
        const res: any = await apiClient.put(
          ENDPOINTS.update(editingEntry._id),
          payload
        );
        const updated = parseOne(unwrap(res));
        if (updated) {
          setEntries((prev) =>
            prev.map((e) => (e._id === editingEntry._id ? updated : e))
          );
        } else {
          setEntries((prev) =>
            prev.map((e) =>
              e._id === editingEntry._id ? ({ ...e, ...payload } as GoldenEntry) : e
            )
          );
        }
        flashSuccess(t('goldenRegister.updatedMsg'));
      } else {
        const res: any = await apiClient.post(ENDPOINTS.create, payload);
        const created = parseOne(unwrap(res));
        if (created?._id) {
          setEntries((prev) => [created, ...prev]);
        } else {
          await fetchEntries(false);
        }
        flashSuccess(t('goldenRegister.createdMsg'));
      }

      setShowFormModal(false);
      setEditingEntry(null);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        t('goldenRegister.saveFailed');
      flashError(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (entry: GoldenEntry) => {
    Alert.alert(
      t('goldenRegister.deleteTitle'),
      t('goldenRegister.deleteMsg', { name: entry.name }),
      [
        { text: t('goldenRegister.cancel'), style: 'cancel' },
        {
          text: t('goldenRegister.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(ENDPOINTS.remove(entry._id));
              setEntries((prev) => prev.filter((e) => e._id !== entry._id));
              setShowDetailsModal(false);
              flashSuccess(t('goldenRegister.deletedMsg'));
            } catch (err: any) {
              const msg =
                err?.response?.data?.message ||
                err?.message ||
                t('goldenRegister.deleteFailed');
              flashError(msg);
            }
          },
        },
      ]
    );
  };

  const renderEntry = ({ item }: { item: GoldenEntry }) => {
    const avatar = getAvatarColor(item.gender);
    return (
      <TouchableOpacity
        style={styles.entryCard}
        activeOpacity={0.7}
        onPress={() => {
          setSelectedEntry(item);
          setShowDetailsModal(true);
        }}
        onLongPress={() => handleDelete(item)}
      >
        <View style={styles.entryRow}>
          {item.photo ? (
            <Image source={{ uri: item.photo }} style={styles.entryPhoto} />
          ) : (
            <View style={[styles.entryAvatar, { backgroundColor: avatar.bg }]}>
              <Text style={[styles.entryAvatarText, { color: avatar.text }]}>
                {getInitials(item.name)}
              </Text>
            </View>
          )}

          <View style={styles.entryInfo}>
            <Text style={styles.entryName} numberOfLines={1}>
              {item.name}
            </Text>

            <View style={styles.entryMetaRow}>
              <Ionicons name="book-outline" size={11} color={COLORS.slateMuted} />
              <Text style={styles.entryMetaText}>{item.riwayah}</Text>
              <View style={styles.metaDot} />
              <Ionicons
                name={item.gender === 'Male' ? 'male' : 'female'}
                size={11}
                color={COLORS.slateMuted}
              />
              <Text style={styles.entryMetaText}>
                {t(`goldenRegister.genders.${GENDER_KEY[item.gender]}`)}
              </Text>
            </View>

            <View style={styles.entryTags}>
              <TypeBadge type={item.type} />
              <View style={styles.dateTag}>
                <Ionicons name="calendar-outline" size={10} color={COLORS.slateMuted} />
                <Text style={styles.dateTagText}>{formatDate(item.date)}</Text>
              </View>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={16} color="#B7C3BD" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.titleEmoji}>🌟</Text>
            <Text style={styles.headerTitle}>
              {t('goldenRegister.headerTitle')}
            </Text>
          </View>
          <Text style={styles.headerSubtitle}>
            {t('goldenRegister.headerSubtitle', {
              count: filteredEntries.length,
              total: entries.length,
            })}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() =>
              Alert.alert(
                t('goldenRegister.comingSoonTitle'),
                t('goldenRegister.comingSoonExportMsg')
              )
            }
          >
            <Ionicons name="download-outline" size={20} color={COLORS.slate} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="filter-outline" size={20} color={COLORS.slate} />
            {activeFilterCount > 0 && <View style={styles.filterDot} />}
          </TouchableOpacity>

          <TouchableOpacity style={styles.addButton} onPress={openAddForm}>
            <Ionicons name="add" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.red} />
          <Text style={styles.errorBannerText} numberOfLines={2}>
            {error}
          </Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={16} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      ) : null}
      {successMsg ? (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.primary} />
          <Text style={styles.successBannerText}>{successMsg}</Text>
        </View>
      ) : null}

      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('goldenRegister.searchPlaceholder')}
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

      {activeFilterCount > 0 && (
        <View style={styles.activeFiltersRow}>
          {filters.type ? (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {t(
                  `goldenRegister.types.${
                    TYPE_KEY[filters.type as AchievementType]
                  }`
                )}
              </Text>
              <TouchableOpacity onPress={() => setFilters({ ...filters, type: '' })}>
                <Ionicons name="close" size={14} color={COLORS.gold} />
              </TouchableOpacity>
            </View>
          ) : null}
          {filters.gender ? (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {t(
                  `goldenRegister.genders.${
                    GENDER_KEY[filters.gender as Gender]
                  }`
                )}
              </Text>
              <TouchableOpacity onPress={() => setFilters({ ...filters, gender: '' })}>
                <Ionicons name="close" size={14} color={COLORS.gold} />
              </TouchableOpacity>
            </View>
          ) : null}
          {filters.riwayah ? (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>{filters.riwayah}</Text>
              <TouchableOpacity onPress={() => setFilters({ ...filters, riwayah: '' })}>
                <Ionicons name="close" size={14} color={COLORS.gold} />
              </TouchableOpacity>
            </View>
          ) : null}
          {filters.fromDate || filters.toDate ? (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>
                {filters.fromDate || '...'} → {filters.toDate || '...'}
              </Text>
              <TouchableOpacity
                onPress={() => setFilters({ ...filters, fromDate: '', toDate: '' })}
              >
                <Ionicons name="close" size={14} color={COLORS.gold} />
              </TouchableOpacity>
            </View>
          ) : null}
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearFiltersText}>
              {t('goldenRegister.clearAll')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && entries.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loadingText}>
            {t('goldenRegister.loading')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredEntries}
          keyExtractor={(item) => item._id}
          renderItem={renderEntry}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.gold]}
              tintColor={COLORS.gold}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>
                {t('goldenRegister.noResultsTitle')}
              </Text>
              <Text style={styles.emptyText}>
                {searchTerm || activeFilterCount > 0
                  ? t('goldenRegister.noResultsFiltered')
                  : t('goldenRegister.noResultsEmpty')}
              </Text>
              {(searchTerm || activeFilterCount > 0) && (
                <TouchableOpacity style={styles.emptyButton} onPress={clearFilters}>
                  <Text style={styles.emptyButtonText}>
                    {t('goldenRegister.clearFilters')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filters={filters}
        onApply={setFilters}
      />

      <EntryFormModal
        visible={showFormModal}
        isEditing={isEditing}
        initial={editingEntry || {}}
        onClose={() => {
          setShowFormModal(false);
          setEditingEntry(null);
        }}
        onSave={handleSave}
      />

      <EntryDetailsModal
        visible={showDetailsModal}
        entry={selectedEntry}
        onClose={() => setShowDetailsModal(false)}
        onEdit={openEditForm}
        onDelete={handleDelete}
      />
    </SafeAreaView>
  );
};

export default GoldenRegisterScreen;

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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleEmoji: { fontSize: 20 },
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
    position: 'relative',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.gold,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.redLight,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FBD5D5',
  },
  errorBannerText: { flex: 1, fontSize: 12, color: COLORS.red, fontWeight: '600' },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primaryLight,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7EBD8',
  },
  successBannerText: { flex: 1, fontSize: 12, color: COLORS.primary, fontWeight: '600' },

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
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: COLORS.slate },

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
    backgroundColor: COLORS.goldLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  activeFilterText: { fontSize: 11, fontWeight: '600', color: COLORS.gold },
  clearFiltersText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray,
    textDecorationLine: 'underline',
  },

  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.slateMuted,
    fontWeight: '600',
  },

  entryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  entryRow: { flexDirection: 'row', alignItems: 'center' },
  entryAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  entryAvatarText: { fontSize: 18, fontWeight: '800' },
  entryPhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    backgroundColor: COLORS.background,
  },
  entryInfo: { flex: 1 },
  entryName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.slate,
    marginBottom: 4,
  },
  entryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  entryMetaText: {
    fontSize: 11,
    color: COLORS.slateMuted,
    fontWeight: '600',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.gray,
    marginHorizontal: 6,
  },
  entryTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },

  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { fontSize: 10, fontWeight: '800' },
  dateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dateTagText: { fontSize: 10, fontWeight: '600', color: COLORS.slateMuted },

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
    backgroundColor: COLORS.gold,
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  modalAvatarText: { fontSize: 30, fontWeight: '800' },
  modalPhoto: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: COLORS.gold,
    backgroundColor: COLORS.background,
  },
  modalName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.slate,
    textAlign: 'center',
  },

  formSection: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.goldLight,
    paddingBottom: 16,
    marginBottom: 16,
  },
  formSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  formSectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.slate },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
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
  formTextarea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  riwayahHint: {
    fontSize: 11,
    color: COLORS.slateMuted,
    fontStyle: 'italic',
    marginTop: 8,
  },
  photoPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.goldLight,
  },
  photoPickerText: { fontSize: 13, fontWeight: '600', color: COLORS.slate },
  photoPreview: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.white,
  },
  removePhotoText: {
    fontSize: 12,
    color: COLORS.red,
    fontWeight: '600',
    marginTop: 8,
    textDecorationLine: 'underline',
  },

  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
    marginTop: 8,
    marginBottom: 10,
  },
  filterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: COLORS.slateMuted },
  filterChipTextActive: { color: COLORS.white },

  dateRangeRow: { flexDirection: 'row', gap: 10 },
  dateLabel: {
    fontSize: 11,
    color: COLORS.slateMuted,
    fontWeight: '700',
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.slate,
    backgroundColor: COLORS.white,
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
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterResetBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  filterApplyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterApplyBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

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
    backgroundColor: COLORS.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: COLORS.slateMuted, fontWeight: '600' },
  infoValue: { fontSize: 14, color: COLORS.slate, fontWeight: '600', marginTop: 2 },

  riwayahBlock: {
    marginTop: 16,
    backgroundColor: COLORS.goldLight,
    borderRadius: 12,
    padding: 14,
  },
  riwayahBlockLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.gold,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  riwayahBlockText: { fontSize: 13, color: COLORS.slate, lineHeight: 19 },

  deleteRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.redLight,
    borderWidth: 1,
    borderColor: '#FBD5D5',
  },
  deleteRowText: { fontSize: 13, fontWeight: '700', color: COLORS.red },
});