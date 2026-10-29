// src/screens/admin/memorization/_shared/pickers.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  COLORS,
  SURAH_LIST,
  JUZ_NAMES,
  getMaxAyah,
} from '../_shared';

// ============================================================
// SURAH PICKER
// ============================================================
interface SurahPickerProps {
  value: number;
  onChange: (id: number) => void;
  onAyahChange?: (ayah: number) => void;
  ayahValue?: number;
  showAyah?: boolean;
  label?: string;
  /** Compact mode: single-line pill, smaller footprint */
  compact?: boolean;
}

export const SurahPicker: React.FC<SurahPickerProps> = ({
  value,
  onChange,
  onAyahChange,
  ayahValue,
  showAyah = false,
  label,
  compact = false,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = SURAH_LIST.find((s) => s.id === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return SURAH_LIST;
    const q = search.toLowerCase();
    return SURAH_LIST.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.arabic.includes(search) ||
        String(s.id) === search
    );
  }, [search]);

  return (
    <>
      <TouchableOpacity
        style={compact ? styles.pickerBtnCompact : styles.pickerBtn}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          {!compact && (
            <Text style={styles.pickerLabel}>
              {label || t('memorization.pickers.surah')}
            </Text>
          )}
          <Text
            style={compact ? styles.pickerValueCompact : styles.pickerValue}
            numberOfLines={1}
          >
            {selected
              ? `${selected.id}. ${selected.name}`
              : t('memorization.pickers.selectSurah')}
          </Text>
        </View>
        <Ionicons
          name="chevron-down"
          size={compact ? 14 : 18}
          color={COLORS.slateMuted}
        />
      </TouchableOpacity>

      {/* Ayah row only used when compact=false and showAyah=true */}
      {showAyah && selected && !compact && (
        <View style={styles.ayahRow}>
          <TextInput
            style={styles.ayahInput}
            value={String(ayahValue ?? 1)}
            onChangeText={(v) => {
              const n = Math.max(
                1,
                Math.min(getMaxAyah(selected.id), parseInt(v, 10) || 1)
              );
              onAyahChange?.(n);
            }}
            keyboardType="numeric"
            placeholder="1"
            placeholderTextColor="#A0AAA5"
          />
          <Text style={styles.ayahHint}>/ {getMaxAyah(selected.id)}</Text>
        </View>
      )}

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('memorization.pickers.selectSurah')}
              </Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchWrapper}>
              <Ionicons name="search" size={16} color={COLORS.gray} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={t('memorization.pickers.searchSurah')}
                placeholderTextColor="#A0AAA5"
                autoFocus
              />
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => {
                const active = item.id === value;
                return (
                  <TouchableOpacity
                    style={[styles.row, active && styles.rowActive]}
                    onPress={() => {
                      onChange(item.id);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <View style={styles.rowNumber}>
                      <Text style={styles.rowNumberText}>{item.id}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{item.name}</Text>
                      <Text style={styles.rowSubtitle}>
                        {item.arabic} · {item.ayahCount}{' '}
                        {t('memorization.pickers.ayahs')}
                      </Text>
                    </View>
                    {active && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={COLORS.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    {t('memorization.pickers.noResults')}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

// ============================================================
// JUZ PICKER (with optional compact stepper mode)
// ============================================================
interface JuzPickerProps {
  value: number;
  onChange: (id: number) => void;
  label?: string;
  /**
   * Compact mode: renders a small −/+ stepper instead of the
   * full-width button. No dropdown is shown. Perfect for
   * the shared Subac settings row.
   */
  compact?: boolean;
}

export const JuzPicker: React.FC<JuzPickerProps> = ({
  value,
  onChange,
  label,
  compact = false,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const selected = JUZ_NAMES[value];

  const juzList = useMemo(
    () => Array.from({ length: 30 }, (_, i) => i + 1),
    []
  );

  // -------- COMPACT STEPPER MODE --------
  if (compact) {
    return (
      <View style={styles.juzCompact}>
        <TouchableOpacity
          style={styles.juzCompactBtn}
          onPress={() => onChange(Math.max(1, value - 1))}
          activeOpacity={0.7}
        >
          <Ionicons name="remove" size={13} color={COLORS.slate} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.juzCompactValueWrap}
          onPress={() => setOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.juzCompactValue} numberOfLines={1}>
            {value}
          </Text>
          <Text style={styles.juzCompactLabel} numberOfLines={1}>
            {t('memorization.pickers.juz')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.juzCompactBtn}
          onPress={() => onChange(Math.min(30, value + 1))}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={13} color={COLORS.slate} />
        </TouchableOpacity>

        {/* Full picker modal still available by tapping the value */}
        <Modal
          visible={open}
          animationType="slide"
          transparent
          onRequestClose={() => setOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {t('memorization.pickers.selectJuz')}
                </Text>
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Ionicons name="close" size={22} color={COLORS.slate} />
                </TouchableOpacity>
              </View>

              <FlatList
                data={juzList}
                keyExtractor={(item) => String(item)}
                renderItem={({ item }) => {
                  const active = item === value;
                  const juz = JUZ_NAMES[item];
                  return (
                    <TouchableOpacity
                      style={[styles.row, active && styles.rowActive]}
                      onPress={() => {
                        onChange(item);
                        setOpen(false);
                      }}
                    >
                      <View style={styles.rowNumber}>
                        <Text style={styles.rowNumberText}>{item}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{juz.name}</Text>
                        <Text style={styles.rowSubtitle}>{juz.arabic}</Text>
                      </View>
                      {active && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={COLORS.primary}
                        />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // -------- DEFAULT FULL-WIDTH MODE --------
  return (
    <>
      <TouchableOpacity
        style={styles.pickerBtn}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.pickerLabel}>
            {label || t('memorization.pickers.juz')}
          </Text>
          <Text style={styles.pickerValue} numberOfLines={1}>
            {selected
              ? `${value}. ${selected.name} (${selected.arabic})`
              : t('memorization.pickers.selectJuz')}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={COLORS.slateMuted} />
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('memorization.pickers.selectJuz')}
              </Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close" size={22} color={COLORS.slate} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={juzList}
              keyExtractor={(item) => String(item)}
              renderItem={({ item }) => {
                const active = item === value;
                const juz = JUZ_NAMES[item];
                return (
                  <TouchableOpacity
                    style={[styles.row, active && styles.rowActive]}
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                  >
                    <View style={styles.rowNumber}>
                      <Text style={styles.rowNumberText}>{item}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{juz.name}</Text>
                      <Text style={styles.rowSubtitle}>{juz.arabic}</Text>
                    </View>
                    {active && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={COLORS.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

// ============================================================
// QUARTER PICKER (with compact mode)
// ============================================================
interface QuarterPickerProps {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  /** Compact mode: small square chips, no label, tight gaps */
  compact?: boolean;
  /** Hide the "Quarter" label completely */
  hideLabel?: boolean;
}

export const QuarterPicker: React.FC<QuarterPickerProps> = ({
  value,
  onChange,
  label,
  compact = false,
  hideLabel = false,
}) => {
  const { t } = useTranslation();
  const quarters = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <View>
      {!hideLabel && (
        <Text style={compact ? styles.pickerLabelCompact : styles.pickerLabel}>
          {label || t('memorization.pickers.quarter')}
        </Text>
      )}
      <View style={compact ? styles.chipRowCompact : styles.chipRow}>
        {quarters.map((q) => {
          const active = q === value;
          return (
            <TouchableOpacity
              key={q}
              style={[
                compact ? styles.chipCompact : styles.chip,
                active && styles.chipActive,
              ]}
              onPress={() => onChange(q)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  compact ? styles.chipTextCompact : styles.chipText,
                  active && styles.chipTextActive,
                ]}
              >
                {compact ? q : `${q}/8`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ============================================================
// COMMENT BOX
// ============================================================
interface CommentBoxProps {
  visible: boolean;
  initial: string;
  onSave: (text: string) => void;
  onClose: () => void;
  title?: string;
}

export const CommentBox: React.FC<CommentBoxProps> = ({
  visible,
  initial,
  onSave,
  onClose,
  title,
}) => {
  const { t } = useTranslation();
  const [text, setText] = useState(initial);

  React.useEffect(() => {
    if (visible) setText(initial);
  }, [visible, initial]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.commentOverlay}>
        <View style={styles.commentBox}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentTitle}>
              {title || t('memorization.comment')}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color={COLORS.slate} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.commentInput}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={4}
            placeholder={t('memorization.enter_comment') || 'Enter comment'}
            placeholderTextColor="#A0AAA5"
          />
          <View style={styles.commentActions}>
            <TouchableOpacity
              style={styles.commentCancelBtn}
              onPress={onClose}
            >
              <Text style={styles.commentCancelText}>
                {t('memorization.cancel') || 'Cancel'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.commentSaveBtn}
              onPress={() => {
                onSave(text);
                onClose();
              }}
            >
              <Text style={styles.commentSaveText}>
                {t('memorization.save') || 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================
// FEEDBACK MODAL (professional replacement for Alert.alert)
// ============================================================
export type FeedbackTone = 'success' | 'error' | 'warning' | 'info';

export interface FeedbackButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface FeedbackModalProps {
  visible: boolean;
  tone?: FeedbackTone;
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  buttons?: FeedbackButton[];
  onClose: () => void;
}

const TONE_META: Record<
  FeedbackTone,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  success: {
    icon: 'checkmark-circle',
    color: COLORS.primary,
    bg: COLORS.primaryLight,
  },
  error: { icon: 'alert-circle', color: COLORS.red, bg: COLORS.redLight },
  warning: { icon: 'warning', color: COLORS.amber, bg: COLORS.amberLight },
  info: { icon: 'information-circle', color: COLORS.blue, bg: COLORS.blueLight },
};

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  visible,
  tone = 'info',
  title,
  message,
  icon,
  buttons,
  onClose,
}) => {
  const meta = TONE_META[tone];
  const resolvedButtons: FeedbackButton[] =
    buttons && buttons.length
      ? buttons
      : [{ text: 'OK', onPress: onClose, style: 'default' }];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.feedbackOverlay}>
        <View style={styles.feedbackCard}>
          <View style={[styles.feedbackIconWrap, { backgroundColor: meta.bg }]}>
            <Ionicons name={icon || meta.icon} size={28} color={meta.color} />
          </View>
          <Text style={styles.feedbackTitle}>{title}</Text>
          {message ? (
            <Text style={styles.feedbackMessage}>{message}</Text>
          ) : null}

          <View style={styles.feedbackActions}>
            {resolvedButtons.map((b, i) => {
              const isDestructive = b.style === 'destructive';
              const isCancel = b.style === 'cancel';
              const isPrimary = !isDestructive && !isCancel;
              return (
                <TouchableOpacity
                  key={`${b.text}-${i}`}
                  style={[
                    styles.feedbackBtn,
                    isPrimary && {
                      backgroundColor: meta.color,
                      borderColor: meta.color,
                    },
                    isDestructive && {
                      backgroundColor: COLORS.red,
                      borderColor: COLORS.red,
                    },
                    isCancel && {
                      backgroundColor: COLORS.white,
                      borderColor: COLORS.border,
                    },
                  ]}
                  onPress={() => {
                    onClose();
                    b.onPress?.();
                  }}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.feedbackBtnText,
                      (isPrimary || isDestructive) && { color: '#fff' },
                      isCancel && { color: COLORS.slate },
                    ]}
                  >
                    {b.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
  // ---------- Default full-width button ----------
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    gap: 8,
  },
  pickerLabel: {
    fontSize: 10,
    color: COLORS.slateMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  pickerValue: { fontSize: 14, color: COLORS.slate, fontWeight: '600' },

  // ---------- Compact single-line pill ----------
  pickerBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: COLORS.white,
    gap: 6,
  },
  pickerValueCompact: {
    fontSize: 13,
    color: COLORS.slate,
    fontWeight: '700',
  },
  pickerLabelCompact: {
    fontSize: 9,
    color: COLORS.slateMuted,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 3,
    letterSpacing: 0.3,
  },

  // ---------- Ayah row ----------
  ayahRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  ayahInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.slate,
    textAlign: 'center',
    backgroundColor: COLORS.white,
  },
  ayahHint: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },

  // ---------- Default quarter chips ----------
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: COLORS.slateMuted },
  chipTextActive: { color: '#fff' },

  // ---------- Compact quarter chips ----------
  chipRowCompact: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
  },
  chipCompact: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 26,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipTextCompact: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slateMuted,
  },

  // ---------- Compact Juz stepper ----------
  juzCompact: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    height: 34,
  },
  juzCompactBtn: {
    paddingHorizontal: 8,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  juzCompactValueWrap: {
    flex: 1,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 6,
  },
  juzCompactValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slate,
  },
  juzCompactLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
  },

  // ---------- Modal shell ----------
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 16,
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

  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    margin: 16,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.slate },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  rowActive: { backgroundColor: COLORS.primaryLight },
  rowNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowNumberText: { fontSize: 12, fontWeight: '800', color: COLORS.slate },
  rowTitle: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  rowSubtitle: { fontSize: 11, color: COLORS.slateMuted, marginTop: 2 },

  empty: { padding: 32, alignItems: 'center' },
  emptyText: { color: COLORS.slateMuted, fontSize: 13 },

  // ---------- Comment box ----------
  commentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  commentBox: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentTitle: { fontSize: 16, fontWeight: '800', color: COLORS.slate },
  commentInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.slate,
    minHeight: 96,
    textAlignVertical: 'top',
    backgroundColor: COLORS.background,
  },
  commentActions: { flexDirection: 'row', gap: 10 },
  commentCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  commentCancelText: { fontSize: 13, fontWeight: '700', color: COLORS.slate },
  commentSaveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  commentSaveText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // ---------- Feedback modal ----------
  feedbackOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  feedbackCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  feedbackIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  feedbackTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.slate,
    textAlign: 'center',
  },
  feedbackMessage: {
    fontSize: 13.5,
    color: COLORS.slateMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  feedbackActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    width: '100%',
  },
  feedbackBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackBtnText: { fontSize: 14, fontWeight: '700' },
});