import { ApiClient } from '@/core/network/apiClient';
import { badgeFromApi, userFromApi } from '../mappers';
import type { AppUser, BadgeInfo } from '../models';

/** 8-point daily sparkline series (oldest -> newest). */
export interface TrendData {
  coinTrend: number[];
  accuracyTrend: number[];
  coinDelta: number;
  accuracyDelta: number;
}

/** Per-channel push notification preferences. */
export interface NotificationSettings {
  push: boolean;
  lucky: boolean;
  results: boolean;
  leaderboard: boolean;
}

function settingsFrom(data: any): NotificationSettings {
  return {
    push: data?.push === true,
    lucky: data?.lucky === true,
    results: data?.results === true,
    leaderboard: data?.leaderboard === true,
  };
}

/** Loads the full user profile (basic user + stats + badges) in one shot. */
export const UserRepository = {
  async profile(): Promise<AppUser> {
    const [me, stats, badgesRaw] = await Promise.all([
      ApiClient.get<Record<string, any>>('/users/me'),
      ApiClient.get<Record<string, any>>('/users/me/stats'),
      ApiClient.get<any[]>('/users/me/badges'),
    ]);
    const badges: BadgeInfo[] = (badgesRaw ?? []).map(badgeFromApi);
    return userFromApi(me, {
      globalRank: typeof stats?.globalRank === 'number' ? Math.trunc(stats.globalRank) : undefined,
      badges,
    });
  },

  /**
   * Updates editable identity fields (PATCH /users/me), then returns the
   * refreshed full profile (so badges + rank stay populated).
   */
  async updateProfile(patch: {
    name?: string;
    username?: string;
    bio?: string;
    avatarSeed?: number;
  }): Promise<AppUser> {
    await ApiClient.patch('/users/me', patch);
    return UserRepository.profile();
  },

  /** Coin-balance + accuracy sparkline series for the last 8 days. */
  async trends(): Promise<TrendData> {
    const m: any = await ApiClient.get('/users/me/trends');
    const toNumbers = (v: unknown): number[] =>
      Array.isArray(v) ? v.map((e) => Number(e)).filter((n) => !Number.isNaN(n)) : [];
    return {
      coinTrend: toNumbers(m?.coinTrend),
      accuracyTrend: toNumbers(m?.accuracyTrend),
      coinDelta: typeof m?.coinDelta === 'number' ? Math.trunc(m.coinDelta) : 0,
      accuracyDelta: typeof m?.accuracyDelta === 'number' ? Math.trunc(m.accuracyDelta) : 0,
    };
  },

  /**
   * Permanently deletes the authenticated account and all its data
   * (store-mandated in-app account deletion).
   */
  deleteAccount(): Promise<unknown> {
    return ApiClient.delete('/users/me');
  },

  async settings(): Promise<NotificationSettings> {
    return settingsFrom(await ApiClient.get('/users/me/settings'));
  },

  async updateSettings(patch: {
    push?: boolean;
    lucky?: boolean;
    results?: boolean;
    leaderboard?: boolean;
  }): Promise<NotificationSettings> {
    return settingsFrom(await ApiClient.patch('/users/me/settings', patch));
  },

  /**
   * Registers/refreshes this device's FCM token — call after login and
   * whenever the token refreshes.
   */
  registerDeviceToken(token: string, platform: string): Promise<unknown> {
    return ApiClient.post('/users/me/device-token', { token, platform });
  },

  /**
   * Removes this device's FCM token — call on logout so a signed-out device
   * stops receiving pushes meant for the next person who signs in.
   */
  unregisterDeviceToken(token: string): Promise<unknown> {
    return ApiClient.delete('/users/me/device-token', { token });
  },
};
