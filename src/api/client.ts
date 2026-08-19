import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { storage } from '../utils/storage';
import { ApiError } from '../types/api.types';
import { Platform } from 'react-native';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Platform': Platform.OS,
        'X-App-Version': '1.0.0',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        // Add auth token
        const token = await storage.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add tenant identification
        const tenantId = await storage.getTenantId();
        if (tenantId) {
          config.headers['x-tenant-id'] = tenantId;
        }

        // Add tenant subdomain (backward compatibility)
        const tenantSubdomain = await storage.getTenantSubdomain();
        if (tenantSubdomain) {
          config.headers['x-tenant-subdomain'] = tenantSubdomain;
        }

        // Add branch if selected
        const branchId = await storage.getBranchId();
        if (branchId) {
          config.headers['x-branch-id'] = branchId;
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error: AxiosError) => {
        // Handle 401 Unauthorized
        if (error.response?.status === 401) {
          await storage.clearAuth();
        }

        // Format error response
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

  // Generic request methods
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

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }

  // File upload with progress
  async upload<T>(url: string, formData: FormData, onProgress?: (progress: number) => void): Promise<T> {
    const response = await this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(progress);
        }
      },
    });
    return response.data;
  }

  // Download file
  async download(url: string, params?: any): Promise<Blob> {
    const response = await this.client.get(url, {
      params,
      responseType: 'blob',
    });
    return response.data;
  }
}

export const api = new ApiClient();

// API Service base class
export abstract class BaseService {
  protected api: ApiClient;

  constructor() {
    this.api = new ApiClient();
  }

  protected handleResponse<T>(response: any): T {
    if (response.success === false) {
      throw new Error(response.message || 'Operation failed');
    }
    return response.data || response;
  }

  protected handleError(error: any): never {
    console.error('API Error:', error);
    throw error;
  }
}