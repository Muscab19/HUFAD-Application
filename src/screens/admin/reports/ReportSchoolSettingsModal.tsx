// src/screens/admin/reports/ReportSchoolSettingsModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

// Optional — degrades gracefully if not installed
let ImagePicker: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ImagePicker = require('expo-image-picker');
} catch {
  ImagePicker = null;
}

import { COLORS, SchoolInfo } from './_shared';

// ============================================================
// TYPES
// ============================================================
interface ReportSchoolSettingsModalProps {
  visible: boolean;
  schoolInfo: SchoolInfo;
  onClose: () => void;
  onSave: (info: SchoolInfo) => void;
}

// ============================================================
// MAIN
// ============================================================
export const ReportSchoolSettingsModal: React.FC<
  ReportSchoolSettingsModalProps
> = ({ visible, schoolInfo, onClose, onSave }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<SchoolInfo>(schoolInfo);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setForm(schoolInfo);
      setSaving(false);
    }
  }, [visible, schoolInfo]);

  const update = <K extends keyof SchoolInfo>(
    key: K,
    value: SchoolInfo[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ----------------------------------------------------------------
  // Logo picking
  // ----------------------------------------------------------------
  const pickLogo = async () => {
    if (!ImagePicker) {
      Alert.alert(
        t('reports.settings.imagePickerMissing') || 'Image Picker unavailable',
        t('reports.settings.imagePickerMissingMsg') ||
          'Please install expo-image-picker to enable logo upload.'
      );
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          t('reports.settings.permissionTitle') || 'Permission needed',
          t('reports.settings.permissionMsg') ||
            'Please allow access to your photos to pick a logo.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'Images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      const base64 = asset.base64;
      if (!base64) return;

      // Size cap ~2MB (web has the same limit). base64 length ≈ size * 4/3.
      const approxBytes = Math.floor((base64.length * 3) / 4);
      if (approxBytes > 2 * 1024 * 1024) {
        Alert.alert(
          t('reports.settings.logoTooLarge') ||
            'Logo is too large. Maximum size is 2MB.'
        );
        return;
      }

      const mime = asset.mimeType || 'image/png';
      update('logo', `data:${mime};base64,${base64}`);
    } catch (e) {
      console.warn('pickLogo failed', e);
    }
  };

  const removeLogo = () => {
    update('logo', null);
  };

  // ----------------------------------------------------------------
  // Save
  // ----------------------------------------------------------------
  const handleSubmit = () => {
    if (!form.nameEn.trim()) {
      Alert.alert(
        t('reports.settings.nameRequired') ||
          'English school name is required'
      );
      return;
    }
    setSaving(true);
    try {
      onSave({
        ...form,
        nameEn: form.nameEn.trim(),
        nameAr: form.nameAr.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        reportTitle: form.reportTitle.trim(),
        footerNote: form.footerNote.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

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
                {t('reports.settings.title') || 'School Settings'}
              </Text>
              <Text style={styles.subtitle}>
                {t('reports.settings.subtitle') ||
                  'Branding used on printed reports'}
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

          {/* BODY */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ---------- LOGO ---------- */}
            <Text style={styles.fieldLabel}>
              {t('reports.settings.schoolLogo') || 'School logo'}
            </Text>
            <View style={styles.logoRow}>
              <View style={styles.logoBox}>
                {form.logo ? (
                  <Image
                    source={{ uri: form.logo }}
                    style={styles.logoImg}
                    resizeMode="contain"
                  />
                ) : (
                  <Ionicons
                    name="image-outline"
                    size={32}
                    color={COLORS.gray}
                  />
                )}
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={pickLogo}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={15}
                    color="#fff"
                  />
                  <Text style={styles.primaryBtnText}>
                    {form.logo
                      ? t('reports.settings.changeLogo') || 'Change logo'
                      : t('reports.settings.uploadLogo') || 'Upload logo'}
                  </Text>
                </TouchableOpacity>

                {form.logo ? (
                  <TouchableOpacity
                    style={styles.dangerBtn}
                    onPress={removeLogo}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={15}
                      color={COLORS.red}
                    />
                    <Text style={styles.dangerBtnText}>
                      {t('reports.settings.remove') || 'Remove'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
            <Text style={styles.hint}>
              {t('reports.settings.logoHint') ||
                'Square PNG or JPG works best. Max 2MB.'}
            </Text>

            {/* ---------- SCHOOL NAMES ---------- */}
            <Text style={styles.fieldLabel}>
              {t('reports.settings.schoolNameEn') || 'School name (English)'}{' '}
              <Text style={{ color: COLORS.red }}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={form.nameEn}
              onChangeText={(v) => update('nameEn', v)}
              placeholder="Global Holy Quran School"
              placeholderTextColor="#A0AAA5"
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>
              {t('reports.settings.schoolNameAr') || 'School name (Arabic)'}
            </Text>
            <TextInput
              style={[styles.input, styles.inputRTL]}
              value={form.nameAr}
              onChangeText={(v) => update('nameAr', v)}
              placeholder="المدرسة العالمية للقرآن الكريم"
              placeholderTextColor="#A0AAA5"
            />

            {/* ---------- CONTACT ---------- */}
            <Text style={styles.fieldLabel}>
              {t('reports.settings.phone') || 'Phone'}
            </Text>
            <View style={styles.inputWithIcon}>
              <Ionicons
                name="call-outline"
                size={16}
                color={COLORS.slateMuted}
              />
              <TextInput
                style={styles.inputFlex}
                value={form.phone}
                onChangeText={(v) => update('phone', v)}
                placeholder="+252 61 234 5678"
                placeholderTextColor="#A0AAA5"
                keyboardType="phone-pad"
              />
            </View>

            <Text style={styles.fieldLabel}>
              {t('reports.settings.email') || 'Email'}
            </Text>
            <View style={styles.inputWithIcon}>
              <Ionicons
                name="mail-outline"
                size={16}
                color={COLORS.slateMuted}
              />
              <TextInput
                style={styles.inputFlex}
                value={form.email}
                onChangeText={(v) => update('email', v)}
                placeholder="info@example.com"
                placeholderTextColor="#A0AAA5"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.fieldLabel}>
              {t('reports.settings.address') || 'Address'}
            </Text>
            <View style={styles.inputWithIcon}>
              <Ionicons
                name="location-outline"
                size={16}
                color={COLORS.slateMuted}
              />
              <TextInput
                style={styles.inputFlex}
                value={form.address}
                onChangeText={(v) => update('address', v)}
                placeholder="Mogadishu, Somalia"
                placeholderTextColor="#A0AAA5"
              />
            </View>

            {/* ---------- REPORT TITLE + FOOTER ---------- */}
            <Text style={styles.fieldLabel}>
              {t('reports.settings.reportTitle') || 'Report title'}
            </Text>
            <View style={styles.inputWithIcon}>
              <Ionicons
                name="pencil-outline"
                size={16}
                color={COLORS.slateMuted}
              />
              <TextInput
                style={styles.inputFlex}
                value={form.reportTitle}
                onChangeText={(v) => update('reportTitle', v)}
                placeholder="Official Student Transcript"
                placeholderTextColor="#A0AAA5"
              />
            </View>

            <Text style={styles.fieldLabel}>
              {t('reports.settings.footerNote') || 'Footer note'}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.footerNote}
              onChangeText={(v) => update('footerNote', v)}
              placeholder="This is a computer-generated document..."
              placeholderTextColor="#A0AAA5"
              multiline
              numberOfLines={3}
            />
          </ScrollView>

          {/* FOOTER */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>
                {t('reports.cancel') || 'Cancel'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={saving}
            >
              <Ionicons name="save" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>
                {t('reports.settings.saveSettings') || 'Save Settings'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: '94%',
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
  body: { paddingHorizontal: 20, paddingTop: 16 },

  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.slateMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 14,
    marginBottom: 6,
  },
  hint: {
    fontSize: 11,
    color: COLORS.gray,
    fontStyle: 'italic',
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.slate,
    backgroundColor: COLORS.white,
  },
  inputRTL: { textAlign: 'right', writingDirection: 'rtl' },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.white,
  },
  inputFlex: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.slate,
  },

  // Logo
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
  logoBox: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: '100%', height: '100%' },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.red,
  },
  dangerBtnText: { color: COLORS.red, fontSize: 13, fontWeight: '700' },

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
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});