// src/api/services/credentialsService.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ============================================================
// KEYS
// ============================================================
const KEY_IDENTIFIER = 'saved_login_identifier';
const KEY_PASSWORD = 'saved_login_password';
const KEY_DISPLAY_NAME = 'saved_login_display_name';
const KEY_DECISION = 'saved_login_decision';       // 'save' | 'never' | 'not-now'
const KEY_SKIP_COUNT = 'saved_login_skip_count';
const KEY_LAST_PROMPT = 'saved_login_last_prompt';
const KEY_BIOMETRIC_ENABLED = 'saved_login_biometric_enabled';

// ============================================================
// TUNING
// ============================================================
/** How many logins after "Not now" before we ask again */
const RE_ASK_AFTER_LOGINS = 5;

/** How many days after "Not now" before we ask again (whichever is longer) */
const RE_ASK_AFTER_DAYS = 7;

// ============================================================
// PLATFORM-AGNOSTIC STORAGE
// ============================================================
const isWeb = Platform.OS === 'web';

const webStore = {
  get: (k: string) =>
    typeof window !== 'undefined' ? localStorage.getItem(k) : null,
  set: (k: string, v: string) => {
    if (typeof window !== 'undefined') localStorage.setItem(k, v);
  },
  del: (k: string) => {
    if (typeof window !== 'undefined') localStorage.removeItem(k);
  },
};

const get = async (key: string): Promise<string | null> =>
  isWeb ? webStore.get(key) : await SecureStore.getItemAsync(key);

const set = async (key: string, value: string) => {
  if (isWeb) webStore.set(key, value);
  else await SecureStore.setItemAsync(key, value);
};

const del = async (key: string) => {
  if (isWeb) webStore.del(key);
  else await SecureStore.deleteItemAsync(key);
};

// ============================================================
// TYPES
// ============================================================
export type SaveDecision = 'save' | 'never' | 'not-now' | null;

export interface SavedLoginState {
  identifier: string | null;
  password: string | null;
  displayName: string | null;
  decision: SaveDecision;
  biometricEnabled: boolean;
  hasSavedLogin: boolean;   // true when decision === 'save' AND identifier exists
}

// ============================================================
// SERVICE
// ============================================================
export const credentialsService = {
  // ----------------------------------------------------------
  // SAVE
  // ----------------------------------------------------------
  /**
   * Persist identifier + password.
   * Used when the user chooses "Save" (full auto-login) or after biometric opt-in.
   */
  async save(identifier: string, password: string, displayName: string) {
    await set(KEY_IDENTIFIER, identifier);
    await set(KEY_PASSWORD, password);
    await set(KEY_DISPLAY_NAME, displayName);
    await set(KEY_DECISION, 'save');
    await set(KEY_SKIP_COUNT, '0');
    await set(KEY_LAST_PROMPT, new Date().toISOString());
  },

  // ----------------------------------------------------------
  // DECISION RECORDING
  // ----------------------------------------------------------
  /**
   * Record the user's choice and, for "save", persist credentials.
   */
  async recordDecision(
    decision: Exclude<SaveDecision, null>,
    identifier?: string,
    password?: string
  ) {
    await set(KEY_LAST_PROMPT, new Date().toISOString());

    if (decision === 'save' && identifier && password) {
      const displayName = identifier.split('@')[0];
      await this.save(identifier, password, displayName);
      return;
    }

    if (decision === 'never') {
      // Remember the decision forever
      await set(KEY_DECISION, 'never');
      // Clear any previously-saved credentials
      await del(KEY_IDENTIFIER);
      await del(KEY_PASSWORD);
      await del(KEY_DISPLAY_NAME);
      await del(KEY_BIOMETRIC_ENABLED);
      await set(KEY_SKIP_COUNT, '0');
      return;
    }

    if (decision === 'not-now') {
      await set(KEY_DECISION, 'not-now');
      await set(KEY_SKIP_COUNT, '0');
      // Do NOT clear identifier/password — they might have been set previously
      // by a "save" that got overridden. Instead, ensure nothing is exposed.
      await del(KEY_PASSWORD);   // never keep the password around if "not-now"
    }
  },

  // ----------------------------------------------------------
  // LOGIN COUNT BUMP (for "Not now" re-ask logic)
  // ----------------------------------------------------------
  /**
   * Call this after every successful login.
   * If the user previously chose "Not now", this increments the counter
   * that decides when to re-ask.
   */
  async bumpLoginCount() {
    const decision = await get(KEY_DECISION);
    if (decision === 'not-now') {
      const current = parseInt((await get(KEY_SKIP_COUNT)) || '0', 10);
      await set(KEY_SKIP_COUNT, String(current + 1));
    }
  },

  // ----------------------------------------------------------
  // SHOULD PROMPT?
  // ----------------------------------------------------------
  /**
   * Returns true if we should show the "Save login?" prompt after a successful login.
   * Logic:
   *   - decision === 'save'   → false (already saved)
   *   - decision === 'never'  → false (user said never)
   *   - decision === 'not-now'→ true if skip_count >= RE_ASK_AFTER_LOGINS
   *                             OR last_prompt older than RE_ASK_AFTER_DAYS
   *   - no decision yet       → true
   */
  async shouldPromptToSave(): Promise<boolean> {
    const decision = (await get(KEY_DECISION)) as SaveDecision;

    if (decision === 'save') return false;
    if (decision === 'never') return false;

    if (decision === 'not-now') {
      const count = parseInt((await get(KEY_SKIP_COUNT)) || '0', 10);
      const lastPrompt = await get(KEY_LAST_PROMPT);

      if (count >= RE_ASK_AFTER_LOGINS) return true;

      if (lastPrompt) {
        const ageMs = Date.now() - new Date(lastPrompt).getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        if (ageDays >= RE_ASK_AFTER_DAYS) return true;
      }

      return false;
    }

    // No decision yet → always prompt
    return true;
  },

  // ----------------------------------------------------------
  // GET
  // ----------------------------------------------------------
  async getSaved(): Promise<SavedLoginState> {
    const [identifier, password, displayName, decision, bio] = await Promise.all([
      get(KEY_IDENTIFIER),
      get(KEY_PASSWORD),
      get(KEY_DISPLAY_NAME),
      get(KEY_DECISION),
      get(KEY_BIOMETRIC_ENABLED),
    ]);

    const typedDecision = (decision as SaveDecision) || null;

    return {
      identifier,
      password,
      displayName,
      decision: typedDecision,
      biometricEnabled: bio === 'true',
      // A "full saved login" only exists when decision === 'save' AND we have both
      hasSavedLogin: typedDecision === 'save' && !!identifier && !!password,
    };
  },

  // ----------------------------------------------------------
  // CLEAR
  // ----------------------------------------------------------
  async clear() {
    await del(KEY_IDENTIFIER);
    await del(KEY_PASSWORD);
    await del(KEY_DISPLAY_NAME);
    await del(KEY_DECISION);
    await del(KEY_SKIP_COUNT);
    await del(KEY_LAST_PROMPT);
    await del(KEY_BIOMETRIC_ENABLED);
  },

  /**
   * Only forget the account — keeps the "Never" decision so we don't re-ask.
   * Used when the user taps "Sign in with a different account".
   */
  async forgetAccount() {
    await del(KEY_IDENTIFIER);
    await del(KEY_PASSWORD);
    await del(KEY_DISPLAY_NAME);
    await del(KEY_BIOMETRIC_ENABLED);
    // Decision intentionally kept as-is
  },

  // ----------------------------------------------------------
  // BIOMETRIC
  // ----------------------------------------------------------
  async setBiometricEnabled(enabled: boolean) {
    await set(KEY_BIOMETRIC_ENABLED, enabled ? 'true' : 'false');
  },

  async isBiometricEnabled(): Promise<boolean> {
    return (await get(KEY_BIOMETRIC_ENABLED)) === 'true';
  },
};