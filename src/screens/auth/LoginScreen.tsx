// src/screens/auth/LoginScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Image,
  Animated,
  Keyboard,
  Linking,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as LocalAuthentication from 'expo-local-authentication';

import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { normalizePhone, looksLikePhone } from '../../utils/phone';
import { credentialsService } from '../../api/services/credentialsService';
import {
  changeLanguage,
  getCurrentLanguage,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
} from '../../i18n';

// ============================================================
// SCREEN SIZE
// ============================================================
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================
// HUFAD BRAND
// ============================================================
const COLORS = {
  primary: '#0A8E5A',
  primaryDark: '#063D2C',
  primaryDeep: '#042B20',
  primaryLight: '#EAF8F1',
  gold: '#C9A227',
  goldLight: '#FFF8E5',
  white: '#FFFFFF',
  background: '#F5F9F7',
  text: '#16352A',
  textSecondary: '#718079',
  textLight: '#9AA59F',
  border: '#E2EBE6',
  borderLight: '#EDF3EF',
  inputBackground: '#F9FCFA',
  red: '#DC2626',
  redLight: '#FEF0F0',
  redBorder: '#F5CACA',
  gray: '#8A9690',
};

const BIOMETRIC_LOGS_IN = true;

// ============================================================
// CONTACT DETAILS (edit these to match your real info)
// ============================================================
const CONTACT = {
  whatsapp: '+252684350967',
  email: 'hufaadplatform@gmail.com',
  phone: '+252617231576',
  website: 'https://hufaad.com',
};

// ============================================================
// SCREEN
// ============================================================
export const LoginScreen: React.FC = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { tenantSubdomain } = useTenant();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<'identifier' | 'password' | null>(null);

  const [savedIdentifier, setSavedIdentifier] = useState<string | null>(null);
  const [savedPassword, setSavedPassword] = useState<string | null>(null);
  const [savedDisplayName, setSavedDisplayName] = useState<string | null>(null);
  const [hasSavedLogin, setHasSavedLogin] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showQuickLogin, setShowQuickLogin] = useState(false);

  // Modals
  const [contactVisible, setContactVisible] = useState(false);
  const [languageVisible, setLanguageVisible] = useState(false);
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(getCurrentLanguage());

  const passwordRef = useRef<TextInput>(null);
  const errorShake = useRef(new Animated.Value(0)).current;

  // ============================================================
  // SHAKE
  // ============================================================
  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(errorShake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: -5, duration: 50, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const showError = (
    message: string,
    field: 'identifier' | 'password' | null = null
  ) => {
    setErrorMessage(message);
    setErrorField(field);
    triggerShake();
  };

  const clearError = () => {
    setErrorMessage(null);
    setErrorField(null);
  };

  // ============================================================
  // BOOTSTRAP
  // ============================================================
  useEffect(() => {
    (async () => {
      const saved = await credentialsService.getSaved();

      setSavedIdentifier(saved.identifier);
      setSavedDisplayName(saved.displayName);
      setSavedPassword(saved.password);
      setHasSavedLogin(saved.hasSavedLogin);
      setBiometricEnabled(saved.biometricEnabled);

      if (saved.hasSavedLogin) {
        setShowQuickLogin(true);
      } else if (saved.identifier) {
        setIdentifier(saved.identifier);
      }

      try {
        const hw = await LocalAuthentication.hasHardwareAsync();
        const en = await LocalAuthentication.isEnrolledAsync();
        setBiometricAvailable(hw && en);
      } catch {
        setBiometricAvailable(false);
      }
    })();
  }, []);

  // ============================================================
  // CREDENTIALS
  // ============================================================
  const buildCredentials = (id: string, pwd: string) => {
    const trimmed = id.trim();
    const isPhone = looksLikePhone(trimmed);
    return {
      username: trimmed,
      password: pwd.trim(),
      ...(isPhone ? { phone: normalizePhone(trimmed) } : {}),
    };
  };

  // ============================================================
  // ERROR MAPPER
  // ============================================================
  const mapError = (error: any) => {
    const status = error?.response?.status;
    const raw: string =
      error?.response?.data?.message || error?.data?.message || error?.message || '';
    const lower = raw.toLowerCase();

    if (status === 401 || lower.includes('invalid') || lower.includes('incorrect')) {
      if (lower.includes('password'))
        return { message: t('auth.login.errors.invalidBody'), field: 'password' as const };
      return { message: t('auth.login.errors.invalidBody'), field: 'identifier' as const };
    }
    if (status === 403 || lower.includes('disabled'))
      return { message: t('auth.login.errors.accountDisabledBody'), field: null };
    if (status === 500 || status === 502 || status === 503)
      return { message: t('auth.login.errors.serverBody'), field: null };
    if (error?.request || lower.includes('network') || lower.includes('timeout'))
      return { message: t('auth.login.errors.networkBody'), field: null };
    return { message: raw || t('auth.login.errors.genericBody'), field: null };
  };

  // ============================================================
  // LOGIN
  // ============================================================
  const performLogin = async (id: string, pwd: string) => {
    await login(buildCredentials(id, pwd) as any);
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    clearError();

    const trimmed = identifier.trim();
    if (!trimmed || !password.trim()) {
      showError(t('auth.login.errors.missingBody'), !trimmed ? 'identifier' : 'password');
      return;
    }

    try {
      setLoading(true);
      await performLogin(trimmed, password);
      await askToSaveCredentials(trimmed, password);
    } catch (error: any) {
      const { message, field } = mapError(error);
      showError(message, field);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // SAVE CREDENTIALS
  // ============================================================
  const askToSaveCredentials = async (id: string, pwd: string) => {
    const should = await credentialsService.shouldPromptToSave();
    if (!should) {
      await credentialsService.bumpLoginCount();
      return;
    }

    const displayName = (id || '').split('@')[0];

    Alert.alert(
      t('auth.login.save.title'),
      t('auth.login.save.message'),
      [
        {
          text: t('auth.login.save.never'),
          style: 'destructive',
          onPress: async () => {
            await credentialsService.recordDecision('never');
            setHasSavedLogin(false);
            setSavedPassword(null);
            setSavedIdentifier(null);
            setSavedDisplayName(null);
            setBiometricEnabled(false);
          },
        },
        {
          text: t('auth.login.save.notNow'),
          style: 'cancel',
          onPress: async () => {
            await credentialsService.recordDecision('not-now');
            setHasSavedLogin(false);
            setSavedPassword(null);
          },
        },
        {
          text: t('auth.login.save.save'),
          onPress: async () => {
            await credentialsService.save(id, pwd, displayName);
            setSavedIdentifier(id);
            setSavedPassword(pwd);
            setSavedDisplayName(displayName);
            setHasSavedLogin(true);
            if (biometricAvailable) setTimeout(() => askToEnableBiometric(), 300);
          },
        },
      ],
      { cancelable: false }
    );
  };

  const askToEnableBiometric = () => {
    Alert.alert(
      t('auth.login.biometric.enableTitle'),
      t('auth.login.biometric.enableMessage'),
      [
        {
          text: t('auth.login.biometric.notNow'),
          style: 'cancel',
          onPress: async () => {
            await credentialsService.setBiometricEnabled(false);
            setBiometricEnabled(false);
          },
        },
        {
          text: t('auth.login.biometric.enable'),
          onPress: async () => {
            await credentialsService.setBiometricEnabled(true);
            setBiometricEnabled(true);
          },
        },
      ]
    );
  };

  // ============================================================
  // BIOMETRIC
  // ============================================================
  const handleBiometricLogin = async (silent = false): Promise<boolean> => {
    try {
      clearError();
      if (!biometricAvailable) {
        if (!silent) showError(t('auth.login.biometric.unavailable'));
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('auth.login.biometric.prompt'),
        cancelLabel: t('auth.login.biometric.cancel'),
        fallbackLabel: t('auth.login.biometric.fallback'),
        disableDeviceFallback: false,
      });

      if (!result.success) {
        if (!silent) showError(t('auth.login.biometric.failed'));
        return false;
      }

      if (savedIdentifier && savedPassword) {
        setQuickLoading(true);
        try {
          await performLogin(savedIdentifier, savedPassword);
          await credentialsService.bumpLoginCount();
          return true;
        } finally {
          setQuickLoading(false);
        }
      }

      if (savedIdentifier) setIdentifier(savedIdentifier);
      setTimeout(() => passwordRef.current?.focus(), 150);
      return false;
    } catch {
      if (!silent) showError(t('auth.login.biometric.failed'));
      return false;
    }
  };

  // ============================================================
  // QUICK LOGIN
  // ============================================================
  const handleQuickContinue = async () => {
    try {
      clearError();
      if (!savedIdentifier || !savedPassword) return;

      if (biometricEnabled && biometricAvailable) {
        const ok = await handleBiometricLogin();
        if (!ok) return;
      }

      setQuickLoading(true);
      await performLogin(savedIdentifier, savedPassword);
      await credentialsService.bumpLoginCount();
    } catch (error: any) {
      const { message } = mapError(error);
      await credentialsService.forgetAccount();
      setSavedPassword(null);
      setHasSavedLogin(false);
      setShowQuickLogin(false);
      showError(message);
    } finally {
      setQuickLoading(false);
    }
  };

  const handleForgetAccount = async () => {
    Alert.alert(
      t('auth.login.quickLogin.signOut'),
      t('auth.login.save.message'),
      [
        { text: t('auth.login.save.notNow'), style: 'cancel' },
        {
          text: t('auth.login.save.forget'),
          style: 'destructive',
          onPress: async () => {
            await credentialsService.forgetAccount();
            setHasSavedLogin(false);
            setSavedIdentifier(null);
            setSavedPassword(null);
            setSavedDisplayName(null);
            setBiometricEnabled(false);
            setShowQuickLogin(false);
            setIdentifier('');
            setPassword('');
          },
        },
      ]
    );
  };

  // ============================================================
  // HELPERS
  // ============================================================
  const openWebsite = () => Linking.openURL(CONTACT.website).catch(() => {});
  const openWhatsapp = () =>
    Linking.openURL(`https://wa.me/${CONTACT.whatsapp.replace(/[^0-9]/g, '')}`).catch(
      () => {}
    );
  const openEmail = () =>
    Linking.openURL(`mailto:${CONTACT.email}`).catch(() => {});
  const openPhone = () =>
    Linking.openURL(`tel:${CONTACT.phone}`).catch(() => {});

  const handleLanguageSelect = async (code: SupportedLanguage) => {
    setLanguageVisible(false);
    if (code === currentLang) return;
    try {
      await changeLanguage(code);
      setCurrentLang(code);
    } catch {}
  };

  // ============================================================
  // QUICK LOGIN SCREEN
  // ============================================================
  if (showQuickLogin && hasSavedLogin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.quickScreen}>
          <View style={styles.topDecor} />

          {/* Language switcher — top right */}
          <TouchableOpacity
            style={styles.langIconBtn}
            onPress={() => setLanguageVisible(true)}
          >
            <Ionicons name="language-outline" size={20} color={COLORS.primaryDark} />
          </TouchableOpacity>

          {/* Brand */}
          <View style={styles.quickBrand}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/hufad-icon.jpeg')}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.brandName}>HUFAD</Text>
            <Text style={styles.brandSubtitle}>
              {t('auth.login.brandSubtitle')}
            </Text>
          </View>

          {/* Quick Card */}
          <View style={styles.quickCard}>
            <View style={styles.quickAccountIcon}>
              <Text style={styles.quickAccountInitial}>
                {(savedDisplayName || savedIdentifier || '?').charAt(0).toUpperCase()}
              </Text>
            </View>

            <Text style={styles.quickWelcome}>
              {t('auth.login.quickLogin.title')}
            </Text>
            <Text style={styles.quickIdentifier} numberOfLines={1}>
              {savedIdentifier}
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.88}
              onPress={handleQuickContinue}
              disabled={quickLoading}
            >
              {quickLoading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <>
                  <Ionicons
                    name={
                      biometricEnabled && biometricAvailable
                        ? 'finger-print-outline'
                        : 'log-in-outline'
                    }
                    size={20}
                    color={COLORS.white}
                  />
                  <Text style={styles.primaryButtonText}>
                    {biometricEnabled && biometricAvailable
                      ? t('auth.login.biometric.prompt')
                      : t('auth.login.quickLogin.continueAs')}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {biometricEnabled && biometricAvailable && (
              <TouchableOpacity
                onPress={() => {
                  setShowQuickLogin(false);
                  setTimeout(() => passwordRef.current?.focus(), 200);
                }}
                style={styles.quickFallback}
              >
                <Text style={styles.quickFallbackText}>
                  {t('auth.login.biometric.fallback')}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={handleForgetAccount} style={styles.switchAccount}>
              <Ionicons
                name="swap-horizontal-outline"
                size={15}
                color={COLORS.textSecondary}
              />
              <Text style={styles.switchAccountText}>
                {t('auth.login.quickLogin.signOut')}
              </Text>
            </TouchableOpacity>

            <View style={styles.cardFooter}>
              <TouchableOpacity onPress={() => setContactVisible(true)}>
                <Text style={styles.cardFooterLink}>
                  {t('auth.login.footerContact')}
                </Text>
              </TouchableOpacity>
              <View style={styles.footerDot} />
              <TouchableOpacity onPress={openWebsite}>
                <Text style={styles.cardFooterLink}>
                  {t('auth.login.footerVisit')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.bottomCopyright}>
            {t('auth.login.footer', { year: new Date().getFullYear() })}
          </Text>
        </View>

        {/* Contact + Language modals (shared) */}
        {renderContactModal()}
        {renderLanguageModal()}
      </SafeAreaView>
    );
  }

  // ============================================================
  // FULL LOGIN SCREEN
  // ============================================================
  return (
    <SafeAreaView style={styles.container}>
      {/* Language switcher — top right */}
      <TouchableOpacity
        style={styles.langIconBtn}
        onPress={() => setLanguageVisible(true)}
      >
        <Ionicons name="language-outline" size={20} color={COLORS.primaryDark} />
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* BRAND */}
          <View style={styles.brandBlock}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/hufad-icon.jpeg')}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>

            <Text style={styles.brandName}>HUFAD</Text>
            <Text style={styles.brandSubtitle}>
              {t('auth.login.brandSubtitle')}
            </Text>

            {tenantSubdomain && (
              <View style={styles.tenantBadge}>
                <Ionicons name="business-outline" size={13} color={COLORS.primary} />
                <Text style={styles.tenantText}>{tenantSubdomain}</Text>
              </View>
            )}
          </View>

          {/* LOGIN CARD */}
          <View style={styles.loginCard}>
            {/* Card heading — NOW CENTERED */}
            <View style={styles.cardHeading}>
              <Text style={styles.loginTitle}>{t('auth.login.signIn')}</Text>
              <Text style={styles.loginSubtitle}>
                {t('auth.login.signInHint')}
              </Text>
            </View>

            {/* ERROR */}
            {errorMessage ? (
              <Animated.View
                style={[
                  styles.errorBanner,
                  { transform: [{ translateX: errorShake }] },
                ]}
              >
                <View style={styles.errorIcon}>
                  <Ionicons name="alert-circle" size={17} color={COLORS.red} />
                </View>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <TouchableOpacity
                  onPress={clearError}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={17} color={COLORS.red} />
                </TouchableOpacity>
              </Animated.View>
            ) : null}

            {/* IDENTIFIER */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>
                {t('auth.login.identifierLabel')}
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  errorField === 'identifier' && styles.inputError,
                ]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={
                      errorField === 'identifier' ? COLORS.red : COLORS.textSecondary
                    }
                  />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.login.identifierInputPlaceholder')}
                  placeholderTextColor="#A3AEA8"
                  value={identifier}
                  onChangeText={(v) => {
                    setIdentifier(v);
                    if (errorMessage) clearError();
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={looksLikePhone(identifier) ? 'phone-pad' : 'default'}
                  editable={!loading}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
                {identifier.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setIdentifier('')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={17} color={COLORS.textLight} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* PASSWORD */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>
                {t('auth.login.passwordLabel')}
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  errorField === 'password' && styles.inputError,
                ]}
              >
                <View style={styles.inputIcon}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={
                      errorField === 'password' ? COLORS.red : COLORS.textSecondary
                    }
                  />
                </View>
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder={t('auth.login.passwordInputPlaceholder')}
                  placeholderTextColor="#A3AEA8"
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    if (errorMessage) clearError();
                  }}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={19}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* FORGOT */}
            <TouchableOpacity
              style={styles.forgotButton}
              onPress={() => setContactVisible(true)}
            >
              <Text style={styles.forgotText}>
                {t('auth.login.forgotPassword')}
              </Text>
              <Ionicons
                name="arrow-forward-outline"
                size={14}
                color={COLORS.primary}
              />
            </TouchableOpacity>

            {/* SIGN IN */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.88}
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={COLORS.white} size="small" />
                  <Text style={styles.primaryButtonText}>
                    {t('auth.login.signingIn')}
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>
                    {t('auth.login.signIn')}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
                </>
              )}
            </TouchableOpacity>

            {/* BIOMETRIC */}
            {biometricAvailable && hasSavedLogin && biometricEnabled && (
              <TouchableOpacity
                onPress={() => handleBiometricLogin()}
                style={styles.biometricButton}
                disabled={loading}
                activeOpacity={0.85}
              >
                <View style={styles.biometricIcon}>
                  <Ionicons
                    name="finger-print-outline"
                    size={21}
                    color={COLORS.primary}
                  />
                </View>
                <Text style={styles.biometricText}>
                  {t('auth.login.biometric.prompt')}
                </Text>
              </TouchableOpacity>
            )}

            {/* DIVIDER */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>HUFAD</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* SUPPORT */}
            <View style={styles.supportArea}>
              <Text style={styles.supportQuestion}>
                {t('auth.login.footerQuestion')}
              </Text>
              <View style={styles.supportLinks}>
                <TouchableOpacity
                  onPress={() => setContactVisible(true)}
                  style={styles.supportLinkButton}
                  activeOpacity={0.75}
                >
                  <Ionicons name="headset-outline" size={15} color={COLORS.primary} />
                  <Text style={styles.supportLink}>
                    {t('auth.login.footerContact')}
                  </Text>
                </TouchableOpacity>

                <View style={styles.supportDivider} />

                <TouchableOpacity
                  onPress={openWebsite}
                  style={styles.supportLinkButton}
                  activeOpacity={0.75}
                >
                  <Ionicons name="globe-outline" size={15} color={COLORS.primary} />
                  <Text style={styles.supportLink}>
                    {t('auth.login.footerVisit')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* COPYRIGHT */}
          <Text style={styles.copyright}>
            {t('auth.login.footer', { year: new Date().getFullYear() })}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ========== MODALS ========== */}
      {renderContactModal()}
      {renderLanguageModal()}
    </SafeAreaView>
  );

  // ============================================================
  // CONTACT MODAL
  // ============================================================
  function renderContactModal() {
    return (
      <Modal
        visible={contactVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setContactVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalGrabber} />

            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {t('auth.login.contact.title')}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {t('auth.login.contact.subtitle')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setContactVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* WhatsApp */}
            <ContactRow
              icon="logo-whatsapp"
              iconBg="#E7F8EE"
              iconColor="#25D366"
              label={t('auth.login.contact.whatsapp')}
              value={CONTACT.whatsapp}
              onPress={openWhatsapp}
            />

            {/* Email */}
            <ContactRow
              icon="mail-outline"
              iconBg={COLORS.primaryLight}
              iconColor={COLORS.primary}
              label={t('auth.login.contact.email')}
              value={CONTACT.email}
              onPress={openEmail}
            />

            {/* Phone */}
            <ContactRow
              icon="call-outline"
              iconBg={COLORS.goldLight}
              iconColor={COLORS.gold}
              label={t('auth.login.contact.phone')}
              value={CONTACT.phone}
              onPress={openPhone}
            />

            {/* Website */}
            <ContactRow
              icon="globe-outline"
              iconBg="#EAF3FF"
              iconColor="#2878D0"
              label={t('auth.login.contact.website')}
              value={CONTACT.website.replace(/^https?:\/\//, '')}
              onPress={openWebsite}
            />

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setContactVisible(false)}
            >
              <Text style={styles.modalCloseBtnText}>
                {t('auth.login.contact.close')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ============================================================
  // LANGUAGE MODAL
  // ============================================================
  function renderLanguageModal() {
    return (
      <Modal
        visible={languageVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLanguageVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalGrabber} />

            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {t('auth.login.language.title')}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {t('auth.login.language.subtitle')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setLanguageVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {SUPPORTED_LANGUAGES.map((lang) => {
              const active = currentLang === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langRow, active && styles.langRowActive]}
                  activeOpacity={0.85}
                  onPress={() => handleLanguageSelect(lang.code)}
                >
                  <View
                    style={[
                      styles.langIconWrap,
                      active && styles.langIconWrapActive,
                    ]}
                  >
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={active ? COLORS.primary : COLORS.gray}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.langLabel,
                        active && styles.langLabelActive,
                      ]}
                    >
                      {lang.nativeLabel}
                    </Text>
                    <Text style={styles.langSub}>{lang.label}</Text>
                  </View>
                  {active && (
                    <View style={styles.currentPill}>
                      <Text style={styles.currentPillText}>
                        {t('auth.login.language.current')}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setLanguageVisible(false)}
            >
              <Text style={styles.modalCloseBtnText}>
                {t('auth.login.language.close')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }
};

// ============================================================
// CONTACT ROW
// ============================================================
const ContactRow: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  onPress: () => void;
}> = ({ icon, iconBg, iconColor, label, value, onPress }) => (
  <TouchableOpacity
    style={styles.contactRow}
    activeOpacity={0.85}
    onPress={onPress}
  >
    <View style={[styles.contactIcon, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={20} color={iconColor} />
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.contactLabel}>{label}</Text>
      <Text style={styles.contactValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
  </TouchableOpacity>
);

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  // ROOT
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboard: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 24,
    justifyContent: 'center',
  },

  // LANGUAGE BUTTON (top-right)
  langIconBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  // BRAND
  brandBlock: { alignItems: 'center', marginBottom: 22 },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: 19,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
    overflow: 'hidden',
  },
  logoImage: { width: '100%', height: '100%' },
  brandName: {
    marginTop: 11,
    fontSize: 27,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: 4,
    color: COLORS.primaryDark,
  },
  brandSubtitle: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.15,
  },
  tenantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
  },
  tenantText: {
    marginLeft: 5,
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },

  // LOGIN CARD
  loginCard: {
    width: '100%',
    maxWidth: 470,
    alignSelf: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 23,
    paddingHorizontal: 20,
    paddingTop: 21,
    paddingBottom: 17,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: '#063D2C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.055,
    shadowRadius: 22,
    elevation: 3,
  },

  // CARD HEADING (CENTERED NOW)
  cardHeading: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loginTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.35,
    textAlign: 'center',
  },
  loginSubtitle: {
    marginTop: 5,
    fontSize: 12.5,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },

  // ERROR
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 14,
    backgroundColor: COLORS.redLight,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.redBorder,
  },
  errorIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    borderRadius: 8,
    backgroundColor: '#FDDDDD',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: '#991B1B',
  },

  // FIELDS
  fieldContainer: { marginBottom: 13 },
  fieldLabel: {
    marginBottom: 7,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  inputWrapper: {
    minHeight: 51,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputError: {
    borderColor: COLORS.red,
    backgroundColor: '#FFF9F9',
  },
  inputIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 3,
    borderRadius: 8,
  },
  input: {
    flex: 1,
    minHeight: 49,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },

  // FORGOT
  forgotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: -2,
    marginBottom: 16,
    paddingVertical: 4,
  },
  forgotText: {
    marginRight: 4,
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // PRIMARY BUTTON
  primaryButton: {
    minHeight: 51,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 9,
    elevation: 3,
  },
  primaryButtonDisabled: {
    backgroundColor: '#7DBD9F',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.15,
    marginHorizontal: 7,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },

  // BIOMETRIC
  biometricButton: {
    minHeight: 47,
    marginTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: '#BFE6D1',
  },
  biometricIcon: {
    width: 31,
    height: 31,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    borderRadius: 9,
    backgroundColor: COLORS.white,
  },
  biometricText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // DIVIDER
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 19,
    marginBottom: 15,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.borderLight },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#B2BCB7',
  },

  // SUPPORT
  supportArea: { alignItems: 'center' },
  supportQuestion: {
    fontSize: 11.5,
    fontWeight: '500',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  supportLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  supportLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  supportLink: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  supportDivider: {
    width: 3,
    height: 3,
    marginHorizontal: 8,
    borderRadius: 2,
    backgroundColor: '#B8C3BD',
  },

  // COPYRIGHT
  copyright: {
    marginTop: 17,
    textAlign: 'center',
    fontSize: 10.5,
    fontWeight: '500',
    color: COLORS.gray,
  },

  // QUICK LOGIN
  quickScreen: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  topDecor: {
    position: 'absolute',
    width: SCREEN_WIDTH * 1.5,
    height: SCREEN_WIDTH * 1.5,
    top: -SCREEN_WIDTH * 1.18,
    left: -SCREEN_WIDTH * 0.25,
    borderRadius: SCREEN_WIDTH,
    backgroundColor: '#EAF7F0',
  },
  quickBrand: { alignItems: 'center', marginBottom: 25 },
  quickCard: {
    width: '100%',
    maxWidth: 470,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 17,
    backgroundColor: COLORS.white,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 3,
  },
  quickAccountIcon: {
    width: 76,
    height: 76,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
    borderRadius: 38,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 3,
    borderColor: '#C7E9D7',
  },
  quickAccountInitial: {
    fontSize: 30,
    fontWeight: '900',
    color: COLORS.primary,
  },
  quickWelcome: {
    fontSize: 20,
    textAlign: 'center',
    fontWeight: '800',
    color: COLORS.text,
  },
  quickIdentifier: {
    marginTop: 4,
    marginBottom: 20,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  quickFallback: { alignItems: 'center', marginTop: 11, paddingVertical: 7 },
  quickFallbackText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  switchAccount: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 7,
    paddingVertical: 7,
  },
  switchAccountText: {
    marginLeft: 5,
    fontSize: 11.5,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  cardFooterLink: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  footerDot: {
    width: 3,
    height: 3,
    marginHorizontal: 9,
    borderRadius: 2,
    backgroundColor: '#B8C3BD',
  },
  bottomCopyright: {
    marginTop: 18,
    textAlign: 'center',
    fontSize: 10.5,
    fontWeight: '500',
    color: COLORS.gray,
  },

  // ============================================================
  // MODAL (shared between contact & language)
  // ============================================================
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 61, 44, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  modalGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D9D4',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
    fontWeight: '500',
  },
  modalCloseBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },

  // CONTACT ROW
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  contactIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },

  // LANGUAGE ROW
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
    marginBottom: 10,
  },
  langRowActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  langIconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langIconWrapActive: {},
  langLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  langLabelActive: { color: COLORS.primary },
  langSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  currentPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  currentPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export default LoginScreen;

// madrasa