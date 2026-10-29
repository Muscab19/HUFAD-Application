// src/screens/admin/reports/ReportPrintModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, PrintSection } from './_shared';

// ============================================================
// TYPES
// ============================================================
interface ReportPrintModalProps {
  visible: boolean;
  onClose: () => void;
  /** Returns the selected section keys and the action to perform. */
  onAction: (
    sections: PrintSection[],
    action: 'print' | 'share'
  ) => Promise<void> | void;
}

interface SectionOption {
  value: PrintSection;
  labelKey: string;
  fallbackLabel: string;
  descKey: string;
  fallbackDesc: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

// ============================================================
// SECTION OPTIONS (mirrors the web)
// ============================================================
const SECTION_OPTIONS: SectionOption[] = [
  {
    value: 'all',
    labelKey: 'reports.print.all',
    fallbackLabel: 'Full Report',
    descKey: 'reports.print.allDesc',
    fallbackDesc: 'Every section — the complete report',
    icon: 'documents',
    color: COLORS.indigo,
  },
  {
    value: 'overview',
    labelKey: 'reports.print.overview',
    fallbackLabel: 'Overview',
    descKey: 'reports.print.overviewDesc',
    fallbackDesc: 'Performance summary and monthly trend',
    icon: 'stats-chart',
    color: COLORS.purple,
  },
  {
    value: 'attendance',
    labelKey: 'reports.print.attendance',
    fallbackLabel: 'Attendance',
    descKey: 'reports.print.attendanceDesc',
    fallbackDesc: 'Daily records and session breakdown',
    icon: 'calendar',
    color: COLORS.blue,
  },
  {
    value: 'memorization',
    labelKey: 'reports.print.memorization',
    fallbackLabel: 'Memorization',
    descKey: 'reports.print.memorizationDesc',
    fallbackDesc: 'All memorization & review records',
    icon: 'book',
    color: COLORS.primary,
  },
  {
    value: 'exams',
    labelKey: 'reports.print.exams',
    fallbackLabel: 'Exams',
    descKey: 'reports.print.examsDesc',
    fallbackDesc: 'Exam results and statuses',
    icon: 'trophy',
    color: COLORS.gold,
  },
  {
    value: 'behavior',
    labelKey: 'reports.print.behavior',
    fallbackLabel: 'Behavior',
    descKey: 'reports.print.behaviorDesc',
    fallbackDesc: 'Commendations and disciplinary records',
    icon: 'heart',
    color: COLORS.red,
  },
  {
    value: 'finance',
    labelKey: 'reports.print.finance',
    fallbackLabel: 'Finance',
    descKey: 'reports.print.financeDesc',
    fallbackDesc: 'Billing, payments, and balance',
    icon: 'cash',
    color: COLORS.teal,
  },
];

// ============================================================
// MAIN
// ============================================================
export const ReportPrintModal: React.FC<ReportPrintModalProps> = ({
  visible,
  onClose,
  onAction,
}) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<PrintSection[]>(['all']);
  const [busy, setBusy] = useState<null | 'print' | 'share'>(null);

  // Reset on open
  useEffect(() => {
    if (visible) {
      setSelected(['all']);
      setBusy(null);
    }
  }, [visible]);

  // ----------------------------------------------------------------
  // Toggle a section
  // ----------------------------------------------------------------
  const toggle = (value: PrintSection) => {
    if (busy) return;

    // Tapping "all" wipes everything and selects only "all"
    if (value === 'all') {
      setSelected(['all']);
      return;
    }

    setSelected((prev) => {
      const withoutAll = prev.filter((v) => v !== 'all');
      if (withoutAll.includes(value)) {
        const next = withoutAll.filter((v) => v !== value);
        return next.length === 0 ? ['all'] : next;
      }
      return [...withoutAll, value];
    });
  };

  // ----------------------------------------------------------------
  // Dispatch action
  // ----------------------------------------------------------------
  const handleAction = async (action: 'print' | 'share') => {
    if (busy) return;
    setBusy(action);
    try {
      await onAction(selected, action);
      onClose();
    } catch (e) {
      console.warn('Report print modal action failed', e);
    } finally {
      setBusy(null);
    }
  };

  // ----------------------------------------------------------------
  // Derived
  // ----------------------------------------------------------------
  const selectedCount = useMemo(() => {
    if (selected.includes('all')) return SECTION_OPTIONS.length;
    return selected.length;
  }, [selected]);

  const isAll = selected.includes('all');

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => !busy && onClose()}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {t('reports.print.title') || 'Print Report'}
              </Text>
              <Text style={styles.subtitle}>
                {isAll
                  ? t('reports.print.subtitleAll') ||
                    'All sections will be included'
                  : t('reports.print.subtitleSelected', {
                      count: selectedCount,
                    }) || `${selectedCount} section(s) selected`}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              disabled={!!busy}
            >
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          {/* BODY */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {SECTION_OPTIONS.map((opt) => {
              const isSelected = isAll
                ? opt.value === 'all'
                : selected.includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionCard,
                    isSelected && styles.optionCardSelected,
                  ]}
                  onPress={() => toggle(opt.value)}
                  activeOpacity={0.85}
                  disabled={!!busy}
                >
                  <View
                    style={[
                      styles.optionIcon,
                      { backgroundColor: opt.color + '22' },
                    ]}
                  >
                    <Ionicons name={opt.icon} size={18} color={opt.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        styles.optionLabel,
                        isSelected && styles.optionLabelSelected,
                      ]}
                    >
                      {t(opt.labelKey) || opt.fallbackLabel}
                    </Text>
                    <Text style={styles.optionDesc} numberOfLines={2}>
                      {t(opt.descKey) || opt.fallbackDesc}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}
                  >
                    {isSelected ? (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color="#fff"
                      />
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}

            <Text style={styles.hint}>
              {t('reports.print.hint') ||
                'Tip: choose "Full Report" for a comprehensive sheet, or pick individual sections to keep it brief.'}
            </Text>
          </ScrollView>

          {/* FOOTER */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.shareBtn, busy && { opacity: 0.7 }]}
              onPress={() => handleAction('share')}
              disabled={!!busy}
              activeOpacity={0.85}
            >
              {busy === 'share' ? (
                <ActivityIndicator size="small" color={COLORS.blue} />
              ) : (
                <>
                  <Ionicons
                    name="share-outline"
                    size={16}
                    color={COLORS.blue}
                  />
                  <Text style={styles.shareBtnText}>
                    {t('reports.print.share') || 'Share PDF'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.printBtn, busy && { opacity: 0.7 }]}
              onPress={() => handleAction('print')}
              disabled={!!busy}
              activeOpacity={0.85}
            >
              {busy === 'print' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="print" size={16} color="#fff" />
                  <Text style={styles.printBtnText}>
                    {t('reports.print.confirm') || 'Print'}
                  </Text>
                </>
              )}
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

  // Option card
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    marginBottom: 8,
  },
  optionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slate,
  },
  optionLabelSelected: {
    color: COLORS.primary,
  },
  optionDesc: {
    fontSize: 11,
    color: COLORS.slateMuted,
    marginTop: 3,
    lineHeight: 15,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  hint: {
    fontSize: 11,
    color: COLORS.gray,
    fontStyle: 'italic',
    marginTop: 10,
    paddingHorizontal: 2,
    lineHeight: 16,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.blue,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.blue,
  },
  printBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  printBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});