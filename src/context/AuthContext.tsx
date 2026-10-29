// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { AuthState, User, LoginCredentials } from '../types/user.types';
import { authService } from '../api/services/authService';
import { storage } from '../utils/storage';
import { sessionExit } from '../utils/sessionExit';
import { resolveRole } from '../utils/resolveRole';
import { Alert } from 'react-native';

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: true,
  error: null,
};

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  forceLogout: () => Promise<void>;
  updateUser: (user: Partial<User>) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let globalForceLogout: (() => Promise<void>) | null = null;
export const triggerGlobalForceLogout = async () => {
  if (globalForceLogout) await globalForceLogout();
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AuthState>(initialState);

  // ------------------------------------------------------------
  // Force logout — no network, wipe storage + state
  // ------------------------------------------------------------
  const forceLogout = useCallback(async () => {
    try {
      await storage.clearAuth();
    } catch (e) {
      console.warn('clearAuth failed', e);
    }
    try {
      await sessionExit.markSessionEnded();
    } catch {}
    setState({
      user: null,
      token: null,
      isLoading: false,
      error: null,
    });
  }, []);

  useEffect(() => {
    globalForceLogout = forceLogout;
    return () => {
      globalForceLogout = null;
    };
  }, [forceLogout]);

  // ------------------------------------------------------------
  // Load stored auth data on mount
  // ------------------------------------------------------------
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const wasKilled = await sessionExit.wasKilledWhileActive();
        if (wasKilled) {
          await storage.clearAuth();
          await sessionExit.markSessionEnded();
          setState({ ...initialState, isLoading: false });
          return;
        }

        const [token, user] = await Promise.all([
          storage.getToken(),
          storage.getUser(),
        ]);

        if (token && user) {
          // ---- OFFLINE-FIRST: restore cached session immediately ----
          setState({
            user,
            token,
            isLoading: false,
            error: null,
          });

          // ---- Background refresh (safe to fail when offline) ----
          (async () => {
            try {
              const profile = await authService.getProfile();
              if (!profile) return;
              setState((prev) => {
                // Only merge if the same session is still active
                if (!prev.user || !prev.token) return prev;
                // Keep any cached fields the profile didn't return
                const merged: any = {
                  ...prev.user,
                  ...(profile as any),
                };
                if (!merged.role && (prev.user as any).role) {
                  merged.role = (prev.user as any).role;
                }
                // Persist the freshened copy for the next cold start
                storage.storeUser(merged).catch(() => {});
                return { ...prev, user: merged as User };
              });
            } catch {
              // Offline / auth error — keep the cached user.
              // Do NOT logout, do NOT clear storage.
            }
          })();
        } else {
          setState({
            ...initialState,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('Error loading auth data:', error);
        setState({
          ...initialState,
          isLoading: false,
        });
      }
    };

    loadStoredData();
  }, []);

  // ------------------------------------------------------------
  // Login — resolve the role SYNCHRONOUSLY so the UI can route
  // immediately, then enrich in the background
  // ------------------------------------------------------------
  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await authService.login(credentials);

      // Try to resolve a role from the login response + JWT immediately
      const immediateRole = resolveRole(response.user, response.token);

      // Optimistically attach the resolved role onto the user object so
      // downstream consumers (RoleNavigator, ProfileScreen) see it right away
      const optimisticUser: any = {
        ...(response.user || {}),
        ...(immediateRole && !response.user?.role
          ? { role: immediateRole }
          : {}),
      };

      await sessionExit.markSessionActive();

      // Flip isLoading off NOW — do not wait on getProfile
      setState({
        user: optimisticUser,
        token: response.token,
        isLoading: false,
        error: null,
      });

      // Background: if the role was missing, fetch the profile and merge it
      if (!immediateRole) {
        (async () => {
          try {
            const profile = await authService.getProfile();
            if (profile) {
              setState((prev) => {
                // Only merge if the user is still the same session
                if (!prev.user || !prev.token) return prev;
                return {
                  ...prev,
                  user: { ...prev.user, ...(profile as any) },
                };
              });
            }
          } catch (e) {
            console.warn('Background profile fetch failed:', e);
          }
        })();
      }
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Login failed',
      }));

      Alert.alert(
        'Login Failed',
        error.message || 'Please check your credentials'
      );
      throw error;
    }
  }, []);

  // ------------------------------------------------------------
  // Logout
  // ------------------------------------------------------------
  const logout = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      try {
        await sessionExit.markSessionEnded();
      } catch {}
      setState({
        user: null,
        token: null,
        isLoading: false,
        error: null,
      });
    }
  }, []);

  // ------------------------------------------------------------
  // Update user
  // ------------------------------------------------------------
const updateUser = useCallback(async (userData: Partial<User>) => {
  try {
    const updatedUser = await authService.updateProfile(userData);
    setState((prev) => {
      if (!prev.user) {
        return { ...prev, user: updatedUser as User };
      }
      // Merge: keep any existing field that the response didn't include
      const merged = {
        ...prev.user,
        ...(updatedUser as Partial<User>),
      };

      // Guard: if the merge somehow lost the role, keep the old one
      if (!(merged as any)?.role && (prev.user as any)?.role) {
        (merged as any).role = (prev.user as any).role;
      }

      return { ...prev, user: merged as User };
    });
  } catch (error: any) {
    Alert.alert('Update Failed', error.message || 'Failed to update profile');
    throw error;
  }
}, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        forceLogout,
        updateUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};