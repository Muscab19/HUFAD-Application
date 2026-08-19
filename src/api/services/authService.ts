import { BaseService } from '../client';
import { LoginCredentials, LoginResponse, User } from '../../types/user.types';
import { ApiResponse } from '../../types/api.types';
import { storage } from '../../utils/storage';

export class AuthService extends BaseService {
  private readonly basePath = '/api/auth';

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await this.api.post<LoginResponse>(`${this.basePath}/login`, credentials);
      
      // Store token and user data
      if (response.token) {
        await storage.storeToken(response.token);
      }
      if (response.user) {
        await storage.storeUser(response.user);
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
      const response = await this.api.put<ApiResponse<User>>(`${this.basePath}/profile`, data);
      const updatedUser = this.handleResponse<User>(response);
      
      // Update stored user data
      const currentUser = await storage.getUser();
      if (currentUser) {
        await storage.storeUser({ ...currentUser, ...updatedUser });
      }
      
      return updatedUser;
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
      
      // Get filename and type from URI
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
      
      // Update stored user data with new photo
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