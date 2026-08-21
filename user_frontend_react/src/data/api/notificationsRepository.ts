import { ApiClient } from '@/core/network/apiClient';
import { timeAgo } from '../mappers';
import type { NotificationItem, NotificationKind } from '../models';

/** Backend -> app mapping for the notifications feed. */
function kindOf(type?: string | null): NotificationKind {
  switch (type) {
    case 'LUCKY':
      return 'lucky';
    case 'RESULT':
      return 'result';
    case 'BADGE':
      return 'badge';
    case 'LEADERBOARD':
      return 'leaderboard';
    case 'REMINDER':
      return 'reminder';
    case 'SYSTEM':
    default:
      return 'system';
  }
}

function fromJson(j: Record<string, any>): NotificationItem {
  return {
    id: j.id != null ? String(j.id) : '',
    kind: kindOf(j.type),
    title: j.title != null ? String(j.title) : '',
    body: j.body != null ? String(j.body) : '',
    timeAgo: timeAgo(j.createdAt),
    unread: j.read !== true,
  };
}

export const NotificationsRepository = {
  async list(): Promise<NotificationItem[]> {
    const data = await ApiClient.get<any[]>('/notifications');
    return (data ?? []).map((e) => fromJson(e as Record<string, any>));
  },

  async markRead(id: string): Promise<void> {
    await ApiClient.post(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await ApiClient.post('/notifications/read-all');
  },
};
