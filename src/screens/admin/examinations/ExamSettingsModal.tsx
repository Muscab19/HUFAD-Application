// src/screens/admin/examinations/ExamSettingsModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
// Optional — install with: npx expo install expo-image-picker
let ImagePicker: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ImagePicker = require('expo-image-picker');
} catch {
  ImagePicker = null;
}

import {
  COLORS,
  ExamColumn,
  ExamSettings,
  ReadingWritingHeader,
  ReadingWritingWeights,
  ReadingCategory,
  SchoolBranding,
  READING_CATEGORIES,
  DEFAULT_COLUMNS,
  DEFAULT_READING_HEADERS,
  DEFAULT_READING_WEIGHTS,
  DEFAULT_EXAM_TYPES,
  api,
  round2,
} from './_shared';

// ============================================================
// TYPES
// ============================================================
interface ExamSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  settings: ExamSettings | null;
  onSaved: () => void;
}

type TabKey =
  | 'branding'
  | 'general'
  | 'examTypes'
  | 'columns'
  | 'reading'
  | 'notes';

const TABS: { key: TabKey; labelKey: string; fallback: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'branding',  labelKey: 'examinations.settings.tabs.branding',  fallback: 'Branding',  icon: 'school-outline' },
  { key: 'general',   labelKey: 'examinations.settings.tabs.general',   fallback: 'General',   icon: 'options-outline' },
  { key: 'examTypes', labelKey: 'examinations.settings.tabs.examTypes', fallback: 'Exam Types', icon: 'list-outline' },
  { key: 'columns',   labelKey: 'examinations.settings.tabs.columns',   fallback: 'Columns',   icon: 'grid-outline' },
  { key: 'reading',   labelKey: 'examinations.settings.tabs.reading',   fallback: 'Reading',   icon: 'book-outline' },
  { key: 'notes',     labelKey: 'examinations.settings.tabs.notes',     fallback: 'Notes',     icon: 'document-text-outline' },
];

// ============================================================
// MAIN COMPONENT
// ============================================================
export const ExamSettingsModal: React.FC<ExamSettingsModalProps> = ({
  visible,
  onClose,
  settings,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>('branding');
  const [saving, setSaving] = useState(false);

  // ---- Local working copies (reset from `settings` each open) ----
  const [branding, setBranding] = useState<SchoolBranding>({
    logo: null,
    nameAr: '',
    nameEn: '',
    nameSo: '',
  });
  const [passingMark, setPassingMark] = useState('60');
  const [passingRW, setPassingRW] = useState('60');
  const [defaultQuestionCount, setDefaultQuestionCount] = useState('3');
  const [examTypes, setExamTypes] = useState<string[]>(DEFAULT_EXAM_TYPES);
  const [columns, setColumns] = useState<ExamColumn[]>(DEFAULT_COLUMNS);
  const [readingHeaders, setReadingHeaders] = useState<ReadingWritingHeader[]>(
    DEFAULT_READING_HEADERS
  );
  const [readingWeights, setReadingWeights] = useState<ReadingWritingWeights>(
    DEFAULT_READING_WEIGHTS
  );
  const [notesTemplate, setNotesTemplate] = useState({
    positive: '',
    negative: '',
  });

  // ---- Inline-edit trackers ----
  const [editingExamType, setEditingExamType] = useState<string | null>(null);
  const [editingExamTypeValue, setEditingExamTypeValue] = useState('');
  const [newExamType, setNewExamType] = useState('');

  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnLabel, setEditingColumnLabel] = useState('');

  const [newReadingHeaderLabel, setNewReadingHeaderLabel] = useState('');

  // ============================================================
  // Hydrate from `settings` when modal opens
  // ============================================================
  useEffect(() => {
    if (!visible) return;
    setTab('branding');

    const s = settings;
    setBranding({
      logo: s?.branding?.logo ?? null,
      nameAr: s?.branding?.nameAr ?? '',
      nameEn: s?.branding?.nameEn ?? '',
      nameSo: s?.branding?.nameSo ?? '',
    });
    setPassingMark(String(s?.passingMark ?? 60));
    setPassingRW(String(s?.passingMarkReadingWriting ?? 60));
    setDefaultQuestionCount(String(s?.defaultQuestionCount ?? 3));
    setExamTypes(s?.examTypes?.length ? s.examTypes : DEFAULT_EXAM_TYPES);
    setColumns(
      s?.columns?.length ? cloneColumns(s.columns) : cloneColumns(DEFAULT_COLUMNS)
    );
    setReadingHeaders(
      s?.readingWritingHeaders?.length
        ? cloneReadingHeaders(s.readingWritingHeaders)
        : cloneReadingHeaders(DEFAULT_READING_HEADERS)
    );
    setReadingWeights(
      s?.readingWritingWeights
        ? { ...DEFAULT_READING_WEIGHTS, ...s.readingWritingWeights }
        : { ...DEFAULT_READING_WEIGHTS }
    );
    setNotesTemplate(
      s?.notesTemplate
        ? { positive: s.notesTemplate.positive || '', negative: s.notesTemplate.negative || '' }
        : { positive: '', negative: '' }
    );

    // Reset trackers
    setEditingExamType(null);
    setEditingExamTypeValue('');
    setNewExamType('');
    setEditingColumnId(null);
    setEditingColumnLabel('');
    setNewReadingHeaderLabel('');
  }, [visible, settings]);

  // ============================================================
  // BRANDING — logo picker
  // ============================================================
  const pickLogo = async () => {
    if (!ImagePicker) {
      Alert.alert(
        t('examinations.settings.imagePickerMissing') || 'Image Picker unavailable',
        t('examinations.settings.imagePickerMissingMsg') ||
          'Please install expo-image-picker to enable logo upload.'
      );
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          t('examinations.settings.permissionTitle') || 'Permission needed',
          t('examinations.settings.permissionMsg') ||
            'Please allow access to your photos to pick a logo.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'Images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (result.canceled && result.canceled === true) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      const base64 = asset.base64 || null;
      if (!base64) return;
      const mime = asset.mimeType || 'image/png';
      const uri = `data:${mime};base64,${base64}`;
      setBranding((prev) => ({ ...prev, logo: uri }));
    } catch (e) {
      console.warn('pickLogo failed', e);
    }
  };

  const removeLogo = () => {
    setBranding((prev) => ({ ...prev, logo: null }));
  };

  // ============================================================
  // EXAM TYPES
  // ============================================================
  const addExamType = () => {
    const v = newExamType.trim();
    if (!v) return;
    if (examTypes.includes(v)) return;
    setExamTypes((prev) => [...prev, v]);
    setNewExamType('');
  };

  const removeExamType = (v: string) => {
    setExamTypes((prev) => prev.filter((x) => x !== v));
  };

  const startEditExamType = (v: string) => {
    setEditingExamType(v);
    setEditingExamTypeValue(v);
  };

  const commitEditExamType = () => {
    if (!editingExamType) return;
    const v = editingExamTypeValue.trim();
    if (!v) {
      setEditingExamType(null);
      setEditingExamTypeValue('');
      return;
    }
    setExamTypes((prev) => {
      if (prev.includes(v) && v !== editingExamType) return prev;
      return prev.map((x) => (x === editingExamType ? v : x));
    });
    setEditingExamType(null);
    setEditingExamTypeValue('');
  };

  // ============================================================
  // COLUMNS
  // ============================================================
  const addColumn = () => {
    const id = `custom_${Date.now()}`;
    const next: ExamColumn = {
      id,
      key: id,
      label: t('examinations.settings.newColumn') || 'New Column',
      isVisible: true,
      isEditable: true,
      isDeletable: true,
      order: columns.length,
      type: 'number',
      isAdditive: false,
    };
    setColumns((prev) => [...prev, next]);
    setEditingColumnId(id);
    setEditingColumnLabel(next.label);
  };

  const updateColumn = (id: string, patch: Partial<ExamColumn>) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  };

  const deleteColumn = (id: string) => {
    setColumns((prev) => prev.filter((c) => c.id !== id));
  };

  const startEditColumnLabel = (id: string, label: string) => {
    setEditingColumnId(id);
    setEditingColumnLabel(label);
  };

  const commitEditColumnLabel = () => {
    if (!editingColumnId) return;
    const v = editingColumnLabel.trim();
    if (v) updateColumn(editingColumnId, { label: v });
    setEditingColumnId(null);
    setEditingColumnLabel('');
  };

  const moveColumn = (id: string, dir: -1 | 1) => {
    setColumns((prev) => {
      const arr = [...prev].sort((a, b) => (a.order || 0) - (b.order || 0));
      const idx = arr.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr.map((c, i) => ({ ...c, order: i }));
    });
  };

  // ============================================================
  // READING HEADERS
  // ============================================================
  const addReadingHeader = () => {
    const v = newReadingHeaderLabel.trim();
    if (!v) return;
    const id = `header_${Date.now()}`;
    const next: ReadingWritingHeader = {
      id,
      label: v,
      isEditable: true,
      hasCount: false,
      isFixed: false,
      maxScore: 3,
    };
    setReadingHeaders((prev) => [...prev, next]);
    setNewReadingHeaderLabel('');
  };

  const updateReadingHeader = (
    id: string,
    patch: Partial<ReadingWritingHeader>
  ) => {
    setReadingHeaders((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...patch } : h))
    );
  };

  const deleteReadingHeader = (id: string) => {
    setReadingHeaders((prev) => prev.filter((h) => h.id !== id));
  };

  // ============================================================
  // WEIGHTS (category weights inside settings)
  // ============================================================
  const updateCategoryWeight = (key: ReadingCategory, rawValue: number) => {
    setReadingWeights((prev) => {
      const others = READING_CATEGORIES.filter((c) => c !== key).reduce(
        (sum, c) => sum + (prev[c] || 0),
        0
      );
      // On settings screen we don't know totalMarks; clamp per realistic max (100)
      const maxForThis = Math.max(0, round2(100 - others));
      return { ...prev, [key]: round2(Math.max(0, Math.min(rawValue, maxForThis))) };
    });
  };

  // ============================================================
  // SAVE
  // ============================================================
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Partial<ExamSettings> = {
        passingMark: parseInt(passingMark, 10) || 60,
        passingMarkReadingWriting: parseInt(passingRW, 10) || 60,
        defaultQuestionCount: parseInt(defaultQuestionCount, 10) || 3,
        examTypes,
        columns,
        readingWritingHeaders: readingHeaders,
        readingWritingWeights: readingWeights,
        notesTemplate,
        branding,
      };
      await api.saveSettings(payload);
      onSaved();
    } catch (err: any) {
      Alert.alert(
        t('examinations.errorTitle') || 'Error',
        err?.message ||
          t('examinations.settings.saveFailed') ||
          'Failed to save settings'
      );
    } finally {
      setSaving(false);
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
      onRequestClose={() => !saving && onClose()}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {t('examinations.settings.title') || 'Examination Settings'}
              </Text>
              <Text style={styles.subtitle}>
                {t('examinations.settings.subtitle') ||
                  'Configure defaults, columns, and branding'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              disabled={saving}
            >
              <Ionicons name="close" size={22} color={COLORS.slate} />
            </TouchableOpacity>
          </View>

          {/* TAB BAR */}
          <View style={styles.tabBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabBarContent}
            >
              {TABS.map((tb) => {
                const active = tab === tb.key;
                return (
                  <TouchableOpacity
                    key={tb.key}
                    style={[styles.tab, active && styles.tabActive]}
                    onPress={() => setTab(tb.key)}
                  >
                    <Ionicons
                      name={tb.icon}
                      size={14}
                      color={active ? '#fff' : COLORS.slateMuted}
                    />
                    <Text
                      style={[styles.tabText, active && styles.tabTextActive]}
                    >
                      {t(tb.labelKey) || tb.fallback}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* BODY */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ==================================================
                TAB: BRANDING
            ================================================== */}
            {tab === 'branding' && (
              <>
                <Text style={styles.sectionLabel}>
                  {t('examinations.settings.schoolNames') || 'School Names'}
                </Text>

                <Text style={styles.fieldLabel}>
                  {t('examinations.settings.schoolNameAr') || 'Arabic name'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={branding.nameAr || ''}
                  onChangeText={(v) =>
                    setBranding((p) => ({ ...p, nameAr: v }))
                  }
                  placeholder="المدرسة العالمية للقرآن الكريم"
                  placeholderTextColor="#A0AAA5"
                />

                <Text style={styles.fieldLabel}>
                  {t('examinations.settings.schoolNameEn') || 'English name'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={branding.nameEn || ''}
                  onChangeText={(v) =>
                    setBranding((p) => ({ ...p, nameEn: v }))
                  }
                  placeholder="Global Holy Quran School"
                  placeholderTextColor="#A0AAA5"
                />

                <Text style={styles.fieldLabel}>
                  {t('examinations.settings.schoolNameSo') || 'Somali name'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={branding.nameSo || ''}
                  onChangeText={(v) =>
                    setBranding((p) => ({ ...p, nameSo: v }))
                  }
                  placeholder="Dugsiga Quraanka"
                  placeholderTextColor="#A0AAA5"
                />

                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
                  {t('examinations.settings.schoolLogo') || 'School Logo'}
                </Text>
                <View style={styles.logoRow}>
                  <View style={styles.logoPreview}>
                    {branding.logo ? (
                      <Image
                        source={{ uri: branding.logo }}
                        style={styles.logoImg}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons
                        name="image-outline"
                        size={28}
                        color={COLORS.gray}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <TouchableOpacity
                      style={styles.primaryBtnSm}
                      onPress={pickLogo}
                    >
                      <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
                      <Text style={styles.primaryBtnSmText}>
                        {t('examinations.settings.uploadLogo') || 'Upload logo'}
                      </Text>
                    </TouchableOpacity>
                    {branding.logo && (
                      <TouchableOpacity
                        style={styles.dangerBtnSm}
                        onPress={removeLogo}
                      >
                        <Ionicons name="trash-outline" size={14} color={COLORS.red} />
                        <Text style={styles.dangerBtnSmText}>
                          {t('examinations.settings.removeLogo') || 'Remove'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <Text style={styles.hint}>
                  {t('examinations.settings.logoHint') ||
                    'The logo is used on printed exam sheets.'}
                </Text>
              </>
            )}

            {/* ==================================================
                TAB: GENERAL (passing marks + default questions)
            ================================================== */}
            {tab === 'general' && (
              <>
                <Text style={styles.sectionLabel}>
                  {t('examinations.settings.passingMemorization') ||
                    'Passing Mark (Memorization)'}
                </Text>
                <View style={styles.sliderRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={passingMark}
                    onChangeText={(v) =>
                      setPassingMark(v.replace(/[^0-9]/g, ''))
                    }
                    keyboardType="numeric"
                  />
                  <Text style={styles.sliderSuffix}>%</Text>
                </View>
                <View style={styles.chipRow}>
                  {['50', '60', '70', '75', '80'].map((v) => (
                    <TouchableOpacity
                      key={v}
                      style={[
                        styles.chip,
                        passingMark === v && styles.chipActive,
                      ]}
                      onPress={() => setPassingMark(v)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          passingMark === v && styles.chipTextActive,
                        ]}
                      >
                        {v}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.hint}>
                  {t('examinations.settings.passingMarkInfo') ||
                    'Minimum percentage to pass a memorization exam.'}
                </Text>

                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
                  {t('examinations.settings.passingReading') ||
                    'Passing Mark (Reading & Writing)'}
                </Text>
                <View style={styles.sliderRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={passingRW}
                    onChangeText={(v) => setPassingRW(v.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                  />
                  <Text style={styles.sliderSuffix}>%</Text>
                </View>
                <View style={styles.chipRow}>
                  {['50', '60', '70', '75', '80'].map((v) => (
                    <TouchableOpacity
                      key={v}
                      style={[styles.chip, passingRW === v && styles.chipActive]}
                      onPress={() => setPassingRW(v)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          passingRW === v && styles.chipTextActive,
                        ]}
                      >
                        {v}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
                  {t('examinations.settings.defaultQuestions') ||
                    'Default question count'}
                </Text>
                <TextInput
                  style={[styles.input, { width: 100 }]}
                  value={defaultQuestionCount}
                  onChangeText={(v) =>
                    setDefaultQuestionCount(v.replace(/[^0-9]/g, ''))
                  }
                  keyboardType="numeric"
                />
                <Text style={styles.hint}>
                  {t('examinations.settings.defaultQuestionsInfo') ||
                    'Number of question rows pre-filled when creating a new exam.'}
                </Text>
              </>
            )}

            {/* ==================================================
                TAB: EXAM TYPES
            ================================================== */}
            {tab === 'examTypes' && (
              <>
                <Text style={styles.sectionLabel}>
                  {t('examinations.settings.examTypes') || 'Exam Types'}
                </Text>

                <View style={styles.addRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={newExamType}
                    onChangeText={setNewExamType}
                    placeholder={
                      t('examinations.settings.newTypePlaceholder') ||
                      'New exam type'
                    }
                    placeholderTextColor="#A0AAA5"
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={addExamType}>
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 8, marginTop: 12 }}>
                  {examTypes.map((typ) => {
                    const isEditing = editingExamType === typ;
                    return (
                      <View key={typ} style={styles.listRow}>
                        {isEditing ? (
                          <>
                            <TextInput
                              style={[styles.input, { flex: 1 }]}
                              value={editingExamTypeValue}
                              onChangeText={setEditingExamTypeValue}
                              autoFocus
                              onSubmitEditing={commitEditExamType}
                              onBlur={commitEditExamType}
                            />
                            <TouchableOpacity
                              style={styles.iconBtn}
                              onPress={commitEditExamType}
                            >
                              <Ionicons
                                name="checkmark"
                                size={16}
                                color={COLORS.primary}
                              />
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <Text style={styles.listRowText}>{typ}</Text>
                            <TouchableOpacity
                              style={styles.iconBtn}
                              onPress={() => startEditExamType(typ)}
                            >
                              <Ionicons
                                name="create-outline"
                                size={16}
                                color={COLORS.blue}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.iconBtn,
                                { backgroundColor: COLORS.redLight },
                              ]}
                              onPress={() => removeExamType(typ)}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color={COLORS.red}
                              />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    );
                  })}
                  {examTypes.length === 0 && (
                    <Text style={styles.emptyText}>
                      {t('examinations.settings.noExamTypes') ||
                        'No exam types yet.'}
                    </Text>
                  )}
                </View>
                <Text style={styles.hint}>
                  {t('examinations.settings.examTypesInfo') ||
                    'These appear as options when creating an exam.'}
                </Text>
              </>
            )}

            {/* ==================================================
                TAB: COLUMNS
            ================================================== */}
            {tab === 'columns' && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>
                    {t('examinations.settings.columnConfig') ||
                      'Question Columns'}
                  </Text>
                  <TouchableOpacity style={styles.smallAddBtn} onPress={addColumn}>
                    <Ionicons name="add" size={14} color={COLORS.primary} />
                    <Text style={styles.smallAddBtnText}>
                      {t('examinations.settings.addColumn') || 'Add'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 8 }}>
                  {[...columns]
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((col, idx, arr) => {
                      const isEditing = editingColumnId === col.id;
                      return (
                        <View key={col.id} style={styles.columnCard}>
                          {/* Row 1: label + visibility + order */}
                          <View style={styles.columnRowTop}>
                            {isEditing ? (
                              <TextInput
                                style={[styles.input, { flex: 1 }]}
                                value={editingColumnLabel}
                                onChangeText={setEditingColumnLabel}
                                autoFocus
                                onSubmitEditing={commitEditColumnLabel}
                                onBlur={commitEditColumnLabel}
                              />
                            ) : (
                              <TouchableOpacity
                                style={{ flex: 1 }}
                                onPress={() =>
                                  col.isEditable &&
                                  startEditColumnLabel(col.id, col.label)
                                }
                              >
                                <Text style={styles.columnLabel}>
                                  {col.label}
                                </Text>
                                <Text style={styles.columnKey}>
                                  key: {col.key}
                                </Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={styles.iconBtn}
                              onPress={() =>
                                updateColumn(col.id, {
                                  isVisible: !col.isVisible,
                                })
                              }
                            >
                              <Ionicons
                                name={col.isVisible ? 'eye' : 'eye-off'}
                                size={16}
                                color={
                                  col.isVisible ? COLORS.primary : COLORS.gray
                                }
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.iconBtn}
                              onPress={() => moveColumn(col.id, -1)}
                              disabled={idx === 0}
                            >
                              <Ionicons
                                name="arrow-up"
                                size={16}
                                color={idx === 0 ? COLORS.gray : COLORS.slate}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.iconBtn}
                              onPress={() => moveColumn(col.id, 1)}
                              disabled={idx === arr.length - 1}
                            >
                              <Ionicons
                                name="arrow-down"
                                size={16}
                                color={
                                  idx === arr.length - 1
                                    ? COLORS.gray
                                    : COLORS.slate
                                }
                              />
                            </TouchableOpacity>
                          </View>

                          {/* Row 2: type + additive + delete */}
                          <View style={styles.columnRowBottom}>
                            <TouchableOpacity
                              style={[
                                styles.tagBtn,
                                col.type === 'number' && styles.tagBtnActive,
                              ]}
                              onPress={() =>
                                updateColumn(col.id, {
                                  type: col.type === 'number' ? 'text' : 'number',
                                })
                              }
                              disabled={!col.isEditable}
                            >
                              <Text
                                style={[
                                  styles.tagBtnText,
                                  col.type === 'number' &&
                                    styles.tagBtnTextActive,
                                ]}
                              >
                                {col.type === 'number'
                                  ? t('examinations.settings.number') || 'Number'
                                  : t('examinations.settings.text') || 'Text'}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.tagBtn,
                                col.isAdditive !== false && styles.tagBtnAdd,
                              ]}
                              onPress={() =>
                                updateColumn(col.id, {
                                  isAdditive: !(col.isAdditive !== false),
                                })
                              }
                              disabled={!col.isEditable}
                            >
                              <Text
                                style={[
                                  styles.tagBtnText,
                                  col.isAdditive !== false &&
                                    styles.tagBtnAddText,
                                ]}
                              >
                                {col.isAdditive !== false
                                  ? t('examinations.settings.additive') || '+ Adds'
                                  : t('examinations.settings.subtractive') ||
                                    '− Subtracts'}
                              </Text>
                            </TouchableOpacity>

                            {col.isDeletable !== false && (
                              <TouchableOpacity
                                style={[
                                  styles.iconBtn,
                                  { backgroundColor: COLORS.redLight },
                                ]}
                                onPress={() => deleteColumn(col.id)}
                              >
                                <Ionicons
                                  name="trash-outline"
                                  size={16}
                                  color={COLORS.red}
                                />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}
                </View>

                <Text style={styles.hint}>
                  {t('examinations.settings.columnConfigInfo') ||
                    'Add custom columns for tracking, toggle their visibility, or mark them additive/subtractive.'}
                </Text>
              </>
            )}

            {/* ==================================================
                TAB: READING (headers + weights)
            ================================================== */}
            {tab === 'reading' && (
              <>
                <Text style={styles.sectionLabel}>
                  {t('examinations.settings.categoryWeights') ||
                    'Category Weights'}
                </Text>
                <View style={styles.categoryWeightsGrid}>
                  {READING_CATEGORIES.map((cat) => {
                    const others = READING_CATEGORIES.filter(
                      (c) => c !== cat
                    ).reduce((sum, c) => sum + (readingWeights[c] || 0), 0);
                    const maxForThis = Math.max(0, round2(100 - others));
                    return (
                      <View key={cat} style={styles.categoryWeightItem}>
                        <Text style={styles.categoryWeightLabel}>
                          {t(`examinations.form.categories.${cat}`) || cat}
                        </Text>
                        <TextInput
                          style={styles.categoryWeightInput}
                          value={String(readingWeights[cat] ?? 0)}
                          onChangeText={(v) => {
                            const n = parseFloat(v.replace(/[^0-9.]/g, '')) || 0;
                            updateCategoryWeight(cat, n);
                          }}
                          keyboardType="numeric"
                        />
                        <Text style={styles.categoryWeightMax}>
                          max {maxForThis}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.hint}>
                  {t('examinations.settings.categoryWeightsInfo') ||
                    'Total across categories should equal the exam total marks (typically 100).'}
                </Text>

                <View
                  style={[
                    styles.sectionHeaderRow,
                    { marginTop: 24, marginBottom: 8 },
                  ]}
                >
                  <Text style={styles.sectionLabel}>
                    {t('examinations.settings.readingHeaders') ||
                      'Reading & Writing Skills'}
                  </Text>
                </View>

                <View style={styles.addRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={newReadingHeaderLabel}
                    onChangeText={setNewReadingHeaderLabel}
                    placeholder={
                      t('examinations.settings.newHeaderLabel') || 'New skill'
                    }
                    placeholderTextColor="#A0AAA5"
                  />
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={addReadingHeader}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 8, marginTop: 12 }}>
                  {readingHeaders.map((h) => (
                    <View key={h.id} style={styles.headerCard}>
                      <View style={styles.headerCardTop}>
                        <TextInput
                          style={[styles.input, { flex: 1 }]}
                          value={h.label}
                          onChangeText={(v) =>
                            updateReadingHeader(h.id, { label: v })
                          }
                          editable={!h.isFixed}
                        />
                        {!h.isFixed && (
                          <TouchableOpacity
                            style={[
                              styles.iconBtn,
                              { backgroundColor: COLORS.redLight },
                            ]}
                            onPress={() => deleteReadingHeader(h.id)}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color={COLORS.red}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.headerCardBottom}>
                        <View style={styles.miniField}>
                          <Text style={styles.miniFieldLabel}>
                            {t('examinations.settings.maxScore') || 'Max'}
                          </Text>
                          <TextInput
                            style={styles.miniFieldInput}
                            value={String(h.maxScore ?? 3)}
                            onChangeText={(v) => {
                              const n = parseFloat(v.replace(/[^0-9.]/g, ''));
                              updateReadingHeader(h.id, {
                                maxScore: isNaN(n) ? 0 : n,
                              });
                            }}
                            keyboardType="numeric"
                            editable={!h.isFixed}
                          />
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.tagBtn,
                            h.hasCount && styles.tagBtnActive,
                          ]}
                          onPress={() =>
                            updateReadingHeader(h.id, {
                              hasCount: !h.hasCount,
                            })
                          }
                          disabled={h.isFixed}
                        >
                          <Text
                            style={[
                              styles.tagBtnText,
                              h.hasCount && styles.tagBtnTextActive,
                            ]}
                          >
                            {t('examinations.settings.hasCount') || 'Has count'}
                          </Text>
                        </TouchableOpacity>
                        {h.isFixed && (
                          <View style={styles.lockedTag}>
                            <Ionicons
                              name="lock-closed"
                              size={11}
                              color={COLORS.gray}
                            />
                            <Text style={styles.lockedTagText}>
                              {t('examinations.settings.fixed') || 'Fixed'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* ==================================================
                TAB: NOTES
            ================================================== */}
            {tab === 'notes' && (
              <>
                <Text style={styles.sectionLabel}>
                  {t('examinations.settings.positiveNotesTemplate') ||
                    'Positive notes template'}
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notesTemplate.positive}
                  onChangeText={(v) =>
                    setNotesTemplate((p) => ({ ...p, positive: v }))
                  }
                  multiline
                  numberOfLines={3}
                  placeholder={
                    t('examinations.settings.positiveNotesPlaceholder') ||
                    'e.g. Excellent recitation, keep it up!'
                  }
                  placeholderTextColor="#A0AAA5"
                />
                <Text style={styles.hint}>
                  {t('examinations.settings.positiveNotesInfo') ||
                    'Pre-filled into the positive notes field when creating an exam.'}
                </Text>

                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
                  {t('examinations.settings.negativeNotesTemplate') ||
                    'Areas to improve template'}
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notesTemplate.negative}
                  onChangeText={(v) =>
                    setNotesTemplate((p) => ({ ...p, negative: v }))
                  }
                  multiline
                  numberOfLines={3}
                  placeholder={
                    t('examinations.settings.negativeNotesPlaceholder') ||
                    'e.g. Focus on Madd rules in the next session.'
                  }
                  placeholderTextColor="#A0AAA5"
                />
                <Text style={styles.hint}>
                  {t('examinations.settings.negativeNotesInfo') ||
                    'Pre-filled into the improvement notes field when creating an exam.'}
                </Text>
              </>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* FOOTER */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>
                {t('examinations.settings.cancel') || 'Cancel'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>
                    {t('examinations.settings.save') || 'Save'}
                  </Text>
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
// HELPERS
// ============================================================
const cloneColumns = (cols: ExamColumn[]): ExamColumn[] =>
  cols.map((c) => ({ ...c }));
const cloneReadingHeaders = (
  hs: ReadingWritingHeader[]
): ReadingWritingHeader[] => hs.map((h) => ({ ...h }));

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '96%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.slate },
  subtitle: { fontSize: 12, color: COLORS.slateMuted, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tabs
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  tabBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },
  tabTextActive: { color: '#fff' },

  // Body
  body: { paddingHorizontal: 20, paddingTop: 12 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slateMuted,
    marginTop: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: 11,
    color: COLORS.gray,
    fontStyle: 'italic',
    marginTop: 6,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.slateMuted,
    paddingVertical: 12,
    textAlign: 'center',
  },

  // Inputs
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
  textArea: { minHeight: 70, textAlignVertical: 'top' },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
  },
  smallAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },
  chipTextActive: { color: COLORS.primary },

  // Slider row
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderSuffix: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },

  // List rows
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  listRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Branding
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoPreview: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    overflow: 'hidden',
  },
  logoImg: { width: '100%', height: '100%' },
  primaryBtnSm: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  primaryBtnSmText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  dangerBtnSm: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.red,
    backgroundColor: COLORS.white,
  },
  dangerBtnSmText: { color: COLORS.red, fontSize: 12, fontWeight: '700' },

  // Column cards
  columnCard: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    gap: 8,
  },
  columnRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  columnRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  columnLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slate,
  },
  columnKey: {
    fontSize: 10,
    color: COLORS.slateMuted,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    marginTop: 2,
  },
  tagBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tagBtnActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  tagBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slateMuted,
  },
  tagBtnTextActive: { color: COLORS.primary },
  tagBtnAdd: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  tagBtnAddText: { color: COLORS.primary },

  // Reading headers
  headerCard: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    gap: 8,
  },
  headerCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  miniField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  miniFieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
  },
  miniFieldInput: {
    minWidth: 48,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.slate,
    paddingVertical: 0,
    textAlign: 'center',
  },
  lockedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.background,
  },
  lockedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.gray,
    textTransform: 'uppercase',
  },

  // Category weights
  categoryWeightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  categoryWeightItem: {
    flexBasis: '46%',
    flexGrow: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: COLORS.purpleLight,
    alignItems: 'center',
    gap: 4,
  },
  categoryWeightLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.purple,
    textTransform: 'uppercase',
  },
  categoryWeightInput: {
    width: '100%',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.purple,
    backgroundColor: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.purple,
    textAlign: 'center',
  },
  categoryWeightMax: {
    fontSize: 9,
    color: COLORS.slateMuted,
    fontWeight: '600',
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
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});