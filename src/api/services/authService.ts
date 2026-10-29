import { BaseService } from '../client';
import { LoginCredentials, LoginResponse, User } from '../../types/user.types';
import { ApiResponse } from '../../types/api.types';
import { storage } from '../../utils/storage';

export class AuthService extends BaseService {
  private readonly basePath = '/auth';

  /**
   * Login user (Mobile - accepts username, email, OR phone)
   * Sends `username` (always) + `phone` (normalized, when applicable).
   * Backend matches by any of: username / email / phone.
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const payload: any = {
        username: credentials.username,          // required by backend field name
        password: credentials.password,
      };
      if (credentials.phone) payload.phone = credentials.phone;

      const response = await this.api.post<LoginResponse>(
        `${this.basePath}/login-mobile`,
        payload
      );

      if (response.token) await storage.storeToken(response.token);
      if (response.user)  await storage.storeUser(response.user);

      if (response.tenant) {
        await storage.storeTenantId(response.tenant.tenantId);
        await storage.storeTenantSubdomain(response.tenant.subdomain);
        await storage.storeTenantData(response.tenant);
      }

      if (response.user?.branchId) {
        await storage.storeBranchId(response.user.branchId);
      }

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await this.api.post(`${this.basePath}/logout`);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await storage.clearAuth();
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<User> {
    try {
      const response = await this.api.get<ApiResponse<User>>(`${this.basePath}/profile`);
      return this.handleResponse<User>(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<User>): Promise<User> {
    try {
      const response: any = await this.api.put(`${this.basePath}/profile`, data);

      // The backend returns either:
      //   { message, user }         ← when updating
      //   { ...user fields }        ← when returning the user directly
      // Unwrap both shapes safely.
      const payload = response?.user ?? response?.data?.user ?? response?.data ?? response;

      const currentUser = (await storage.getUser()) || ({} as User);

      // Merge: never let a missing field in the response wipe an existing field
      const merged = { ...currentUser, ...(payload || {}) };

      // Ensure _id is always present (response may use `id` instead)
      if (!merged._id && payload?.id) merged._id = payload.id;

      await storage.storeUser(merged);

      return merged as User;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await this.api.patch(`${this.basePath}/change-password`, {
        currentPassword,
        newPassword,
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * First time password change (for temporary passwords)
   */
  async firstPasswordChange(temporaryPassword: string, newPassword: string): Promise<void> {
    try {
      await this.api.post(`${this.basePath}/first-password-change`, {
        temporaryPassword,
        newPassword,
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Upload profile photo
   */
  async uploadProfilePhoto(photoUri: string): Promise<string> {
    try {
      const formData = new FormData();

      const uriParts = photoUri.split('/');
      const fileName = uriParts[uriParts.length - 1];
      const fileType = this.getFileType(fileName);

      formData.append('profilePhoto', {
        uri: photoUri,
        name: fileName,
        type: fileType,
      } as any);

      const response = await this.api.upload<ApiResponse<{ profilePhoto: string }>>(
        `${this.basePath}/profile/upload-photo`,
        formData
      );

      const result = this.handleResponse<{ profilePhoto: string }>(response);

      const currentUser = await storage.getUser();
      if (currentUser) {
        await storage.storeUser({ ...currentUser, profilePhoto: result.profilePhoto });
      }

      return result.profilePhoto;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private getFileType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
    };
    return mimeTypes[extension] || 'image/jpeg';
  }
}

export const authService = new AuthService();

// async updateProfile(data: Partial<User>): Promise<User> {