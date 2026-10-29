// src/screens/admin/reports/ReportMonthPickerModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  COLORS,
  MONTH_SHORT,
  getSafeDate,
  getCurrentMonth,
  toDateKey,
  ReportPeriod,
  ReportPeriodMode,
} from './_shared';

// Re-export so existing imports from './ReportMonthPickerModal' keep working.
export type { ReportPeriod, ReportPeriodMode } from './_shared';

interface ReportMonthPickerModalProps {
  visible: boolean;
  /** Current period value. */
  period: ReportPeriod;
  onClose: () => void;
  onChange: (period: ReportPeriod) => void;
}

// ============================================================
// HELPERS
// ============================================================
const pad = (n: number) => String(n).padStart(2, '0');

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const isValidDate = (s?: string): boolean => {
  if (!s) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
};

const monthStart = (monthStr: string): string => `${monthStr}-01`;
const monthEnd = (monthStr: string): string => {
  const [y, m] = monthStr.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${pad(m)}-${pad(last)}`;
};

const addMonths = (monthStr: string, delta: number): string => {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

// ============================================================
// MAIN
// ============================================================
export const ReportMonthPickerModal: React.FC<
  ReportMonthPickerModalProps
> = ({ visible, period, onClose, onChange }) => {
  const { t } = useTranslation();

  const [mode, setMode] = useState<ReportPeriodMode>(period.mode || 'month');
  const [year, setYear] = useState(() =>
    getSafeDate(period.month || getCurrentMonth()).getFullYear()
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    period.month || getCurrentMonth()
  );
  const [startDate, setStartDate] = useState<string>(
    period.startDate || monthStart(getCurrentMonth())
  );
  const [endDate, setEndDate] = useState<string>(
    period.endDate || monthEnd(getCurrentMonth())
  );
  const [dateError, setDateError] = useState('');

  // ----------------------------------------------------------------
  // Reset when opened with new props
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!visible) return;
    setMode(period.mode || 'month');
    const m = period.month || getCurrentMonth();
    setSelectedMonth(m);
    setYear(getSafeDate(m).getFullYear());
    setStartDate(period.startDate || monthStart(m));
    setEndDate(period.endDate || monthEnd(m));
    setDateError('');
  }, [visible, period]);

  // ----------------------------------------------------------------
  // Selection handlers
  // ----------------------------------------------------------------
  const selectMonth = (idx: number) => {
    const m = `${year}-${pad(idx + 1)}`;
    onChange({ mode: 'month', month: m });
    onClose();
  };

  const applyRange = () => {
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      setDateError(
        t('reports.monthPicker.invalidDates') ||
          'Please enter valid dates (YYYY-MM-DD).'
      );
      return;
    }
    if (startDate > endDate) {
      setDateError(
        t('reports.monthPicker.rangeReversed') ||
          'The start date must be on or before the end date.'
      );
      return;
    }
    setDateError('');
    onChange({ mode: 'range', startDate, endDate });
    onClose();
  };

  // ----------------------------------------------------------------
  // Presets
  // ----------------------------------------------------------------
  const presets = useMemo(() => {
    const now = getCurrentMonth();
    return [
      {
        key: 'thisMonth',
        label:
          t('reports.monthPicker.presets.thisMonth') || 'This month',
        month: now,
      },
      {
        key: 'lastMonth',
        label:
          t('reports.monthPicker.presets.lastMonth') || 'Last month',
        month: addMonths(now, -1),
      },
      {
        key: 'last3',
        label:
          t('reports.monthPicker.presets.last3') || 'Last 3 months',
        from: monthStart(addMonths(now, -2)),
        to: monthEnd(now),
      },
      {
        key: 'thisYear',
        label:
          t('reports.monthPicker.presets.thisYear') || 'This year',
        from: `${new Date().getFullYear()}-01-01`,
        to: todayKey(),
      },
    ];
  }, [t]);

  const applyPreset = (preset: (typeof presets)[number]) => {
    if ('month' in preset && preset.month) {
      onChange({ mode: 'month', month: preset.month });
      onClose();
      return;
    }
    if ('from' in preset && preset.from && 'to' in preset && preset.to) {
      onChange({ mode: 'range', startDate: preset.from, endDate: preset.to });
      onClose();
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {t('reports.monthPicker.title') || 'Report period'}
              </Text>
              <Text style={styles.subtitle}>
                {t('reports.monthPicker.subtitle') ||
                  'Choose a month or a custom range'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ---------- MODE SEGMENTED ---------- */}
            <View style={styles.segment}>
              {(
                [
                  { k: 'month', label: t('reports.monthPicker.modeMonth') || 'Month' },
                  { k: 'range', label: t('reports.monthPicker.modeRange') || 'Custom range' },
                ] as const
              ).map(({ k, label }) => {
                const active = mode === k;
                return (
                  <TouchableOpacity
                    key={k}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                    onPress={() => setMode(k)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={k === 'month' ? 'calendar' : 'calendar-outline'}
                      size={14}
                      color={active ? '#fff' : COLORS.slateMuted}
                    />
                    <Text
                      style={[
                        styles.segmentText,
                        active && styles.segmentTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ---------- PRESETS ---------- */}
            <Text style={styles.sectionLabel}>
              {t('reports.monthPicker.quickPick') || 'Quick pick'}
            </Text>
            <View style={styles.presetRow}>
              {presets.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={styles.presetChip}
                  onPress={() => applyPreset(p)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.presetChipText}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ---------- MONTH MODE ---------- */}
            {mode === 'month' && (
              <>
                <Text style={styles.sectionLabel}>
                  {t('reports.monthPicker.monthLabel') || 'Month'}
                </Text>
                <View style={styles.yearRow}>
                  <TouchableOpacity
                    style={styles.yearBtn}
                    onPress={() => setYear((y) => y - 1)}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={18}
                      color={COLORS.slate}
                    />
                  </TouchableOpacity>
                  <Text style={styles.yearText}>{year}</Text>
                  <TouchableOpacity
                    style={styles.yearBtn}
                    onPress={() => setYear((y) => y + 1)}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={COLORS.slate}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.monthGrid}>
                  {MONTH_SHORT.map((m, idx) => {
                    const thisMonth = `${year}-${pad(idx + 1)}`;
                    const active =
                      period.mode === 'month' && period.month === thisMonth;
                    const isFuture =
                      new Date(year, idx, 1).getTime() >
                      new Date().setHours(23, 59, 59, 999);
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.monthCell,
                          active && styles.monthCellActive,
                          isFuture && styles.monthCellDisabled,
                        ]}
                        onPress={() => !isFuture && selectMonth(idx)}
                        disabled={isFuture}
                      >
                        <Text
                          style={[
                            styles.monthCellText,
                            active && styles.monthCellTextActive,
                            isFuture && styles.monthCellTextDisabled,
                          ]}
                        >
                          {m}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* ---------- RANGE MODE ---------- */}
            {mode === 'range' && (
              <>
                <Text style={styles.sectionLabel}>
                  {t('reports.monthPicker.from') || 'From'}
                </Text>
                <View style={styles.inputWrap}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={COLORS.slateMuted}
                  />
                  <TextInput
                    style={styles.input}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#A0AAA5"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType={
                      Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'
                    }
                  />
                </View>

                <Text style={styles.sectionLabel}>
                  {t('reports.monthPicker.to') || 'To'}
                </Text>
                <View style={styles.inputWrap}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={COLORS.slateMuted}
                  />
                  <TextInput
                    style={styles.input}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#A0AAA5"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType={
                      Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'
                    }
                  />
                </View>

                {dateError ? (
                  <View style={styles.errorBox}>
                    <Ionicons
                      name="alert-circle"
                      size={14}
                      color={COLORS.red}
                    />
                    <Text style={styles.errorText}>{dateError}</Text>
                  </View>
                ) : null}

                <Text style={styles.hint}>
                  {t('reports.monthPicker.rangeHint') ||
                    'Use YYYY-MM-DD format. Inclusive of both start and end dates.'}
                </Text>
              </>
            )}
          </ScrollView>

          {/* FOOTER */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
            >
              <Text style={styles.cancelBtnText}>
                {t('reports.cancel') || 'Cancel'}
              </Text>
            </TouchableOpacity>
            {mode === 'range' ? (
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={applyRange}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.applyBtnText}>
                  {t('reports.monthPicker.apply') || 'Apply range'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => {
                  const m = period.month || selectedMonth || getCurrentMonth();
                  const y = getSafeDate(m).getFullYear();
                  if (y !== year) {
                    // User navigated years — pick the same month in the new year
                    onChange({
                      mode: 'month',
                      month: `${year}-${pad(getSafeDate(m).getMonth() + 1)}`,
                    });
                  } else {
                    onChange({ mode: 'month', month: m });
                  }
                  onClose();
                }}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.applyBtnText}>
                  {t('reports.monthPicker.apply') || 'Apply'}
                </Text>
              </TouchableOpacity>
            )}
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.slate },
  subtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 20, paddingTop: 14 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 14,
    marginBottom: 8,
  },
  hint: {
    fontSize: 11,
    color: COLORS.gray,
    fontStyle: 'italic',
    marginTop: 10,
  },

  // Segmented
  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  segmentBtnActive: { backgroundColor: COLORS.primary },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },
  segmentTextActive: { color: '#fff' },

  // Presets
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary + '33',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Month mode
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 12,
  },
  yearBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  yearText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.slate,
    minWidth: 70,
    textAlign: 'center',
  },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthCell: {
    width: '31%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  monthCellActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  monthCellDisabled: {
    opacity: 0.4,
  },
  monthCellText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate,
  },
  monthCellTextActive: { color: '#fff' },
  monthCellTextDisabled: { color: COLORS.gray },

  // Range mode
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.white,
  },
  input: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.slate,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: COLORS.redLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F6C8C8',
  },
  errorText: { flex: 1, fontSize: 12, color: COLORS.red, fontWeight: '600' },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.slate },
  applyBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});