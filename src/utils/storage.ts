import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';
const TENANT_ID_KEY = 'tenant_id';
const TENANT_SUBDOMAIN_KEY = 'tenant_subdomain';
const BRANCH_ID_KEY = 'branch_id';
const BRANCH_DATA_KEY = 'branch_data';
const LANGUAGE_KEY = 'app_language';

export const storage = {
  // Token management
  storeToken: async (token: string): Promise<void> => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },
  getToken: async (): Promise<string | null> => {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  },
  removeToken: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },

  // User management
  storeUser: async (user: any): Promise<void> => {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },
  getUser: async (): Promise<any | null> => {
    const data = await SecureStore.getItemAsync(USER_KEY);
    return data ? JSON.parse(data) : null;
  },
  removeUser: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(USER_KEY);
  },

  // Tenant management
  storeTenantId: async (tenantId: string): Promise<void> => {
    await SecureStore.setItemAsync(TENANT_ID_KEY, tenantId);
  },
  getTenantId: async (): Promise<string | null> => {
    return await SecureStore.getItemAsync(TENANT_ID_KEY);
  },
  storeTenantSubdomain: async (subdomain: string): Promise<void> => {
    await SecureStore.setItemAsync(TENANT_SUBDOMAIN_KEY, subdomain);
  },
  getTenantSubdomain: async (): Promise<string | null> => {
    return await SecureStore.getItemAsync(TENANT_SUBDOMAIN_KEY);
  },

  // Branch management
  storeBranchId: async (branchId: string): Promise<void> => {
    await SecureStore.setItemAsync(BRANCH_ID_KEY, branchId);
  },
  getBranchId: async (): Promise<string | null> => {
    return await SecureStore.getItemAsync(BRANCH_ID_KEY);
  },
  storeBranchData: async (branch: any): Promise<void> => {
    await SecureStore.setItemAsync(BRANCH_DATA_KEY, JSON.stringify(branch));
  },
  getBranchData: async (): Promise<any | null> => {
    const data = await SecureStore.getItemAsync(BRANCH_DATA_KEY);
    return data ? JSON.parse(data) : null;
  },

  // Language
  storeLanguage: async (lang: string): Promise<void> => {
    await SecureStore.setItemAsync(LANGUAGE_KEY, lang);
  },
  getLanguage: async (): Promise<string | null> => {
    return await SecureStore.getItemAsync(LANGUAGE_KEY);
  },

  // Clear all auth data
  clearAuth: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(TENANT_ID_KEY);
    await SecureStore.deleteItemAsync(TENANT_SUBDOMAIN_KEY);
    await SecureStore.deleteItemAsync(BRANCH_ID_KEY);
    await SecureStore.deleteItemAsync(BRANCH_DATA_KEY);
  },

  clearTenant: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(TENANT_ID_KEY);
    await SecureStore.deleteItemAsync(TENANT_SUBDOMAIN_KEY);
    await SecureStore.deleteItemAsync(BRANCH_ID_KEY);
    await SecureStore.deleteItemAsync(BRANCH_DATA_KEY);
  },
};