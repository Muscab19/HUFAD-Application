// src/i18n/index.ts
import i18n, { type InitOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager, NativeModules, Platform } from 'react-native';

import en from './locales/en.json';
import ar from './locales/ar.json';
import so from './locales/so.json';

// Storage helper — reuses your existing utils/storage
import { storage } from '../utils/storage';

// ============================================================
// SUPPORTED LANGUAGES
// ============================================================
export type SupportedLanguage = 'en' | 'ar' | 'so';

export interface SupportedLanguageInfo {
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
  isRTL: boolean;
}

export const SUPPORTED_LANGUAGES: SupportedLanguageInfo[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', isRTL: false },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', isRTL: true },
  { code: 'so', label: 'Somali', nativeLabel: 'Soomaali', isRTL: false },
];

export const LANGUAGE_BY_CODE: Record<SupportedLanguage, SupportedLanguageInfo> = {
  en: { code: 'en', label: 'English', nativeLabel: 'English', isRTL: false },
  ar: { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', isRTL: true },
  so: { code: 'so', label: 'Somali', nativeLabel: 'Soomaali', isRTL: false },
};

// ============================================================
// RESOURCES
// ============================================================
const resources = {
  en: { translation: en },
  ar: { translation: ar },
  so: { translation: so },
} as const;

// ============================================================
// DEVICE LANGUAGE (no native module needed)
// ============================================================
const getDeviceLanguage = (): string | null => {
  try {
    const locale =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale ||
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        : NativeModules.I18nManager?.localeIdentifier;
    if (!locale) return null;
    return String(locale).split(/[-_]/)[0].toLowerCase();
  } catch {
    return null;
  }
};

// ============================================================
// INITIAL LANGUAGE RESOLUTION
// ============================================================
const resolveInitialLanguage = async (): Promise<SupportedLanguage> => {
  try {
    const saved = await storage.getLanguage();
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
      return saved as SupportedLanguage;
    }
  } catch {
    // ignore
  }

  try {
    const deviceLang = getDeviceLanguage();
    if (deviceLang && SUPPORTED_LANGUAGES.some((l) => l.code === deviceLang)) {
      return deviceLang as SupportedLanguage;
    }
  } catch {
    // ignore
  }

  return 'en';
};

// ============================================================
// INIT
// ============================================================
let _initialized = false;

export const initI18n = async (): Promise<void> => {
  if (_initialized) return;

  const lng = await resolveInitialLanguage();

  const options: InitOptions = {
    resources,
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  };

  await (i18n.use(initReactI18next).init as any)(options);

  _initialized = true;
};

// ============================================================
// RUNTIME LANGUAGE SWITCH
// ============================================================
export const changeLanguage = async (
  code: SupportedLanguage,
): Promise<{ needsRestart: boolean }> => {
  const currentRTL = I18nManager.isRTL;
  const target = LANGUAGE_BY_CODE[code];
  const targetRTL = target.isRTL;

  await i18n.changeLanguage(code);
  try {
    await storage.storeLanguage(code);
  } catch {
    // ignore — non-fatal
  }

  const needsRestart = currentRTL !== targetRTL;
  if (needsRestart) {
    I18nManager.allowRTL(targetRTL);
    I18nManager.forceRTL(targetRTL);
  }

  return { needsRestart };
};

// ============================================================
// HELPERS
// ============================================================
export const getCurrentLanguage = (): SupportedLanguage =>
  ((i18n.language as SupportedLanguage) || 'en') as SupportedLanguage;

export default i18n;