// src/utils/storage.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';
const TENANT_ID_KEY = 'tenant_id';
const TENANT_SUBDOMAIN_KEY = 'tenant_subdomain';
const TENANT_DATA_KEY = 'tenant_data';
const BRANCH_ID_KEY = 'branch_id';
const BRANCH_DATA_KEY = 'branch_data';
const LANGUAGE_KEY = 'app_language';

const isWeb = Platform.OS === 'web';

const webStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch {}
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch {}
  },
};

export const storage = {
  // ============================================================
  // Token management
  // ============================================================
  storeToken: async (token: string): Promise<void> => {
    if (isWeb) {
      webStorage.setItem(TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  },
  getToken: async (): Promise<string | null> => {
    if (isWeb) {
      return webStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  },
  removeToken: async (): Promise<void> => {
    if (isWeb) {
      webStorage.removeItem(TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  },

  // ============================================================
  // User management
  // ============================================================
  storeUser: async (user: any): Promise<void> => {
    if (isWeb) {
      webStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    }
  },
  getUser: async (): Promise<any | null> => {
    let data: string | null = null;
    if (isWeb) {
      data = webStorage.getItem(USER_KEY);
    } else {
      data = await SecureStore.getItemAsync(USER_KEY);
    }
    return data ? JSON.parse(data) : null;
  },
  removeUser: async (): Promise<void> => {
    if (isWeb) {
      webStorage.removeItem(USER_KEY);
    } else {
      await SecureStore.deleteItemAsync(USER_KEY);
    }
  },

  // ============================================================
  // Tenant management
  // ============================================================
  storeTenantId: async (tenantId: string): Promise<void> => {
    if (isWeb) {
      webStorage.setItem(TENANT_ID_KEY, tenantId);
    } else {
      await SecureStore.setItemAsync(TENANT_ID_KEY, tenantId);
    }
  },
  getTenantId: async (): Promise<string | null> => {
    if (isWeb) {
      return webStorage.getItem(TENANT_ID_KEY);
    }
    return await SecureStore.getItemAsync(TENANT_ID_KEY);
  },
  storeTenantSubdomain: async (subdomain: string): Promise<void> => {
    if (isWeb) {
      webStorage.setItem(TENANT_SUBDOMAIN_KEY, subdomain);
    } else {
      await SecureStore.setItemAsync(TENANT_SUBDOMAIN_KEY, subdomain);
    }
  },
  getTenantSubdomain: async (): Promise<string | null> => {
    if (isWeb) {
      return webStorage.getItem(TENANT_SUBDOMAIN_KEY);
    }
    return await SecureStore.getItemAsync(TENANT_SUBDOMAIN_KEY);
  },

  // Tenant data (full info)
  storeTenantData: async (tenant: any): Promise<void> => {
    if (isWeb) {
      webStorage.setItem(TENANT_DATA_KEY, JSON.stringify(tenant));
    } else {
      await SecureStore.setItemAsync(TENANT_DATA_KEY, JSON.stringify(tenant));
    }
  },
  getTenantData: async (): Promise<any | null> => {
    let data: string | null = null;
    if (isWeb) {
      data = webStorage.getItem(TENANT_DATA_KEY);
    } else {
      data = await SecureStore.getItemAsync(TENANT_DATA_KEY);
    }
    return data ? JSON.parse(data) : null;
  },

  // ============================================================
  // Branch management
  // ============================================================
  storeBranchId: async (branchId: string): Promise<void> => {
    if (isWeb) {
      webStorage.setItem(BRANCH_ID_KEY, branchId);
    } else {
      await SecureStore.setItemAsync(BRANCH_ID_KEY, branchId);
    }
  },
  getBranchId: async (): Promise<string | null> => {
    if (isWeb) {
      return webStorage.getItem(BRANCH_ID_KEY);
    }
    return await SecureStore.getItemAsync(BRANCH_ID_KEY);
  },
  storeBranchData: async (branch: any): Promise<void> => {
    if (isWeb) {
      webStorage.setItem(BRANCH_DATA_KEY, JSON.stringify(branch));
    } else {
      await SecureStore.setItemAsync(BRANCH_DATA_KEY, JSON.stringify(branch));
    }
  },
  getBranchData: async (): Promise<any | null> => {
    let data: string | null = null;
    if (isWeb) {
      data = webStorage.getItem(BRANCH_DATA_KEY);
    } else {
      data = await SecureStore.getItemAsync(BRANCH_DATA_KEY);
    }
    return data ? JSON.parse(data) : null;
  },

  // ------------------------------------------------------------
  // NEW: Clear just the branch (used by admin "All Branches")
  // ------------------------------------------------------------
  clearBranch: async (): Promise<void> => {
    if (isWeb) {
      webStorage.removeItem(BRANCH_ID_KEY);
      webStorage.removeItem(BRANCH_DATA_KEY);
    } else {
      await SecureStore.deleteItemAsync(BRANCH_ID_KEY);
      await SecureStore.deleteItemAsync(BRANCH_DATA_KEY);
    }
  },

  // Alias for symmetry with `removeToken` / `removeUser`
  removeBranch: async (): Promise<void> => {
    return storage.clearBranch();
  },

  // ============================================================
  // Language
  // ============================================================
  storeLanguage: async (lang: string): Promise<void> => {
    if (isWeb) {
      webStorage.setItem(LANGUAGE_KEY, lang);
    } else {
      await SecureStore.setItemAsync(LANGUAGE_KEY, lang);
    }
  },
  getLanguage: async (): Promise<string | null> => {
    if (isWeb) {
      return webStorage.getItem(LANGUAGE_KEY);
    }
    return await SecureStore.getItemAsync(LANGUAGE_KEY);
  },

  // ============================================================
  // Clear all auth data
  // ============================================================
  clearAuth: async (): Promise<void> => {
    if (isWeb) {
      webStorage.removeItem(TOKEN_KEY);
      webStorage.removeItem(USER_KEY);
      webStorage.removeItem(TENANT_ID_KEY);
      webStorage.removeItem(TENANT_SUBDOMAIN_KEY);
      webStorage.removeItem(TENANT_DATA_KEY);
      webStorage.removeItem(BRANCH_ID_KEY);
      webStorage.removeItem(BRANCH_DATA_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
      await SecureStore.deleteItemAsync(TENANT_ID_KEY);
      await SecureStore.deleteItemAsync(TENANT_SUBDOMAIN_KEY);
      await SecureStore.deleteItemAsync(TENANT_DATA_KEY);
      await SecureStore.deleteItemAsync(BRANCH_ID_KEY);
      await SecureStore.deleteItemAsync(BRANCH_DATA_KEY);
    }
  },

  // ============================================================
  // Clear tenant + branch (keeps token + user)
  // ============================================================
  clearTenant: async (): Promise<void> => {
    if (isWeb) {
      webStorage.removeItem(TENANT_ID_KEY);
      webStorage.removeItem(TENANT_SUBDOMAIN_KEY);
      webStorage.removeItem(TENANT_DATA_KEY);
      webStorage.removeItem(BRANCH_ID_KEY);
      webStorage.removeItem(BRANCH_DATA_KEY);
    } else {
      await SecureStore.deleteItemAsync(TENANT_ID_KEY);
      await SecureStore.deleteItemAsync(TENANT_SUBDOMAIN_KEY);
      await SecureStore.deleteItemAsync(TENANT_DATA_KEY);
      await SecureStore.deleteItemAsync(BRANCH_ID_KEY);
      await SecureStore.deleteItemAsync(BRANCH_DATA_KEY);
    }
  },
};