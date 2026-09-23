// src/api/services/notificationsService.ts
import { api } from '../client';

export interface AppNotification {
  _id: string;
  type:
    | 'info'
    | 'success'
    | 'warning'
    | 'error'
    | 'goal'
    | 'attendance'
    | 'exam'
    | 'memorization'
    | 'user'
    | 'message'
    | 'announcement';
  title: string;
  body?: string;
  createdAt: string;
  read?: boolean;
  /** Optional deep-link route to open when tapped */
  route?: string;
  /** Optional metadata (e.g. student id, goal id) */
  meta?: Record<string, any>;
}

export const notificationsService = {
  /**
   * Fetch the current user's notifications.
   * Server filters by role / user / branch automatically.
   */
  async list(params?: { limit?: number; unreadOnly?: boolean }): Promise<AppNotification[]> {
    const res: any = await api.get('/notifications', {
      limit: params?.limit ?? 50,
      unreadOnly: params?.unreadOnly ? 'true' : undefined,
    });
    const data = Array.isArray(res)
      ? res
      : res?.notifications || res?.data || [];
    return data;
  },

  async markRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`, {});
  },

  async markAllRead(): Promise<void> {
    await api.patch('/notifications/read-all', {});
  },

  async clearAll(): Promise<void> {
    await api.delete('/notifications');
  },

  async dismiss(id: string): Promise<void> {
    await api.delete(`/notifications/${id}`);
  },
};