// src/api/client.ts
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { storage } from '../utils/storage';
import { ApiError } from '../types/api.types';
import { Platform } from 'react-native';

// Set to true while debugging login / tenant issues. Set to false for release.
const DEBUG_API = true;

const log = (...args: any[]) => {
  if (DEBUG_API) console.log('[API]', ...args);
};

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    log('ApiClient init. baseURL =', API_BASE_URL);

    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Platform': Platform.OS,
        'X-App-Version': '1.0.0',
      },
    });

    // ---------------- Request interceptor ----------------
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = await storage.getToken();
        if (token) config.headers.Authorization = `Bearer ${token}`;

        const tenantId = await storage.getTenantId();
        if (tenantId) config.headers['x-tenant-id'] = tenantId;

        const tenantSubdomain = await storage.getTenantSubdomain();
        if (tenantSubdomain) config.headers['x-tenant-subdomain'] = tenantSubdomain;

        const branchId = await storage.getBranchId();
        if (branchId) config.headers['x-branch-id'] = branchId;

        const fullUrl = `${config.baseURL || ''}${config.url || ''}`;
        log(
          '→',
          (config.method || 'GET').toUpperCase(),
          fullUrl,
          '| body=',
          config.data ? JSON.stringify(config.data).slice(0, 300) : '(none)'
        );
        log('  headers:', {
          'x-tenant-id': config.headers['x-tenant-id'] || '(none)',
          'x-tenant-subdomain': config.headers['x-tenant-subdomain'] || '(none)',
          'x-branch-id': config.headers['x-branch-id'] || '(none)',
          Authorization: config.headers.Authorization ? 'present' : '(none)',
        });

        return config;
      },
      (error) => {
        log('Request interceptor error:', error?.message);
        return Promise.reject(error);
      }
    );

    // ---------------- Response interceptor ----------------
    this.client.interceptors.response.use(
      (response) => {
        log(
          '←',
          response.status,
          response.config.url,
          '| data=',
          JSON.stringify(response.data).slice(0, 400)
        );
        return response;
      },
      async (error: AxiosError) => {
        log(
          '← ERROR',
          error.response?.status ?? '(no status)',
          error.config?.url ?? '(no url)',
          '|',
          error.message
        );
        if (error.response?.data) {
          log('  error body:', JSON.stringify(error.response.data).slice(0, 500));
        }

        // Only clear auth for 401 on non-auth routes (don't nuke session on bad login)
        const url = error.config?.url || '';
        const isAuthRoute = url.includes('/auth/');
        if (error.response?.status === 401 && !isAuthRoute) {
          await storage.clearAuth();
        }

        const apiError: ApiError = {
          message: 'An error occurred',
          status: error.response?.status,
          data: error.response?.data,
        };

        if (error.response?.data) {
          const data = error.response.data as any;
          apiError.message = data.message || data.error || 'An error occurred';
          apiError.code = data.code;
        } else if (error.request) {
          apiError.message = 'Network error. Please check your connection.';
        } else {
          apiError.message = error.message || 'An unexpected error occurred';
        }

        return Promise.reject(apiError);
      }
    );
  }

  async get<T>(url: string, params?: any): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string, config?: any): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  async upload<T>(
    url: string,
    formData: FormData,
    onProgress?: (progress: number) => void
  ): Promise<T> {
    const response = await this.client.post<T>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(progress);
        }
      },
    });
    return response.data;
  }

  async download(url: string, params?: any): Promise<Blob> {
    const response = await this.client.get(url, {
      params,
      responseType: 'blob',
    });
    return response.data;
  }
}

// Singleton — shared across the entire app
export const api = new ApiClient();

// ------------------ BaseService ------------------
// Now reuses the singleton `api` so all services share the same interceptors.
export abstract class BaseService {
  protected api: ApiClient;

  constructor() {
    this.api = api; // ← was: new ApiClient()
  }

  protected handleResponse<T>(response: any): T {
    if (response && response.success === false) {
      throw new Error(response.message || 'Operation failed');
    }
    return (response && response.data) || response;
  }

  protected handleError(error: any): never {
    console.error('API Error:', error);
    throw error;
  }
}