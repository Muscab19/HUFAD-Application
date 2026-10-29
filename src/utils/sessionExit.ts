// src/utils/sessionExit.ts
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_ACTIVE_KEY = '@hufad/session_active';
const SESSION_KILLED_KEY = '@hufad/session_killed';

/**
 * Track whether the app is being killed by the OS vs. just backgrounded.
 * On iOS/Android there is no reliable "app being killed" event, so we flip
 * a flag to `'background'` when the app goes to background, and back to
 * `'active'` on resume. If the app is force-killed while backgrounded, the
 * flag stays at `'background'` — the next cold start reads it and knows the
 * user killed the app.
 */
let lastAppState: AppStateStatus = AppState.currentState;

export const sessionExit = {
  /** Called once, at App start. Marks a cold-start and clears the killed flag. */
  async markColdStart() {
    try {
      await AsyncStorage.setItem(SESSION_KILLED_KEY, '1');
    } catch {}
  },

  /** Called after a successful login — user session is now active. */
  async markSessionActive() {
    try {
      await AsyncStorage.setItem(SESSION_ACTIVE_KEY, '1');
      await AsyncStorage.removeItem(SESSION_KILLED_KEY);
    } catch {}
  },

  /** Called by logout/forceLogout — session is over. */
  async markSessionEnded() {
    try {
      await AsyncStorage.removeItem(SESSION_ACTIVE_KEY);
      await AsyncStorage.removeItem(SESSION_KILLED_KEY);
    } catch {}
  },

  /** Returns true if the app was previously force-killed while a session was live. */
  async wasKilledWhileActive(): Promise<boolean> {
    try {
      const [active, killed] = await Promise.all([
        AsyncStorage.getItem(SESSION_ACTIVE_KEY),
        AsyncStorage.getItem(SESSION_KILLED_KEY),
      ]);
      return active === '1' && killed === '1';
    } catch {
      return false;
    }
  },

  /**
   * Attach an AppState listener that toggles the killed flag.
   * Must be called once at App startup.
   */
  attachListener(onKilled?: () => void) {
    const sub = AppState.addEventListener('change', (next) => {
      if (
        lastAppState.match(/inactive|background/) &&
        next === 'active'
      ) {
        // App resumed — clear the "killed" flag because the process is alive
        AsyncStorage.setItem(SESSION_KILLED_KEY, '0').catch(() => {});
      }
      if (
        lastAppState === 'active' &&
        next.match(/inactive|background/)
      ) {
        // Went to background — mark as "possibly killed"
        AsyncStorage.setItem(SESSION_KILLED_KEY, '1').catch(() => {});
      }
      lastAppState = next;
    });

    return () => sub.remove();
  },
};