import { create } from 'zustand';
import { NotificationsRepository } from '@/data/api/notificationsRepository';
import type { NotificationItem } from '@/data/models';

interface NotificationsState {
  items: NotificationItem[] | null;
  error: string | null;
  fetching: boolean;
  /** True only during the very first load (no items to show yet). */
  loading: boolean;
  load: () => Promise<void>;
  markRead: (n: NotificationItem) => Promise<void>;
  markAllRead: () => Promise<void>;
  reset: () => void;
}

/**
 * Notifications state: backs both the topbar bell (unread dot) and the
 * notifications page, so mark-read updates them together. Port of
 * WebNotificationsProvider.
 */
export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: null,
  error: null,
  fetching: false,
  loading: false,

  load: async () => {
    if (get().fetching) return;
    set((s) => ({ fetching: true, error: null, loading: s.items == null }));
    try {
      set({ items: await NotificationsRepository.list() });
    } catch {
      set({ error: 'Could not load notifications.' });
    } finally {
      set({ fetching: false, loading: false });
    }
  },

  /** Optimistic: flips locally first, then tells the backend (best-effort). */
  markRead: async (n) => {
    const items = get().items;
    if (!n.unread || items == null) return;
    set({ items: items.map((i) => (i.id === n.id ? { ...i, unread: false } : i)) });
    try {
      await NotificationsRepository.markRead(n.id);
    } catch {
      /* dot already cleared; the next load resyncs */
    }
  },

  markAllRead: async () => {
    const items = get().items;
    if (items == null || items.every((i) => !i.unread)) return;
    set({ items: items.map((i) => ({ ...i, unread: false })) });
    try {
      await NotificationsRepository.markAllRead();
    } catch {
      /* the next load resyncs */
    }
  },

  /** Drop state on sign-out so the next account starts clean. */
  reset: () => set({ items: null, error: null }),
}));

export const unreadCount = (s: NotificationsState): number =>
  s.items == null ? 0 : s.items.filter((n) => n.unread).length;
