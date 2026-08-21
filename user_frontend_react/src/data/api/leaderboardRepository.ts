import { ApiClient } from '@/core/network/apiClient';
import type { LeaderboardEntry } from '../models';

/**
 * Result of a leaderboard fetch: the ranked `entries` plus the current
 * user's own standing `me` (may be null if the user is unranked).
 */
export interface LeaderboardData {
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
}

const int = (v: unknown, fallback = 0): number =>
  typeof v === 'number' ? Math.trunc(v) : fallback;

function entryFromApi(
  json: Record<string, any>,
  meUserId: string | undefined,
  forceCurrent = false,
): LeaderboardEntry {
  const userId = json.userId != null ? String(json.userId) : undefined;
  return {
    rank: int(json.rank),
    name: json.name != null ? String(json.name) : '',
    username: json.username != null ? String(json.username) : '',
    score: int(json.score),
    coins: int(json.coins),
    accuracy: typeof json.accuracy === 'number' ? json.accuracy : 0,
    topBadge: 'firstPrediction',
    isCurrentUser: forceCurrent || (meUserId != null && userId === meUserId),
    seed: int(json.avatarSeed),
  };
}

export const LeaderboardRepository = {
  /** Fetch the leaderboard for `period` (daily|weekly|monthly). */
  async leaderboard(period: string): Promise<LeaderboardData> {
    const m: any = await ApiClient.get('/leaderboard', { period });
    const meJson = m?.me && typeof m.me === 'object' ? (m.me as Record<string, any>) : null;
    const meUserId = meJson?.userId != null ? String(meJson.userId) : undefined;

    const entries = ((m?.entries as any[]) ?? []).map((e) =>
      entryFromApi(e as Record<string, any>, meUserId),
    );

    return {
      entries,
      me: meJson == null ? null : entryFromApi(meJson, meUserId, true),
    };
  },

  /** Fetch today's lucky-winners pool. */
  async luckyWinnersToday(): Promise<LeaderboardEntry[]> {
    const data: any = await ApiClient.get('/leaderboard/lucky-winners/today');
    const winners = (data?.winners as any[]) ?? [];
    return winners.map((raw, i) => {
      const w = raw as Record<string, any>;
      const amount = int(w.amount);
      return {
        rank: int(w.rank, i + 1),
        name: w.name != null ? String(w.name) : '',
        username: w.username != null ? String(w.username) : '',
        score: amount,
        coins: amount,
        accuracy: 0,
        topBadge: 'dailyHero' as const,
        isCurrentUser: w.isCurrentUser === true,
        seed: int(w.avatarSeed),
      };
    });
  },
};
