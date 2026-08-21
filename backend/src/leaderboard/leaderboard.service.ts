import { Injectable } from '@nestjs/common';
import { BadgeKey, EntryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type LeaderboardPeriodParam = 'daily' | 'weekly' | 'monthly';
export type LeaderboardRankingMode = 'coins' | 'sow';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  username: string;
  avatarSeed: number;
  score: number;
  coins: number;
  accuracy: number;
  correctPredictions: number;
  topBadge: BadgeKey | null;
}

type UserLite = {
  name: string;
  username: string;
  avatarSeed: number;
  coins: number;
  correctPredictions: number;
  totalPredictions: number;
};

type OrderedRow = { id: string; score: number; accuracyOverride?: number };

// Rarest → most common; the first match becomes a user's displayed top badge.
const BADGE_PRIORITY: BadgeKey[] = [
  BadgeKey.MONTHLY_CHAMPION,
  BadgeKey.WEEKLY_STAR,
  BadgeKey.DAILY_HERO,
  BadgeKey.WINNING_STREAK,
  BadgeKey.ACCURACY_MASTER,
  BadgeKey.FIRST_PREDICTION,
  BadgeKey.WELCOME,
];

/**
 * Leaderboard ranking. Two modes, switchable from admin Settings
 * (`leaderboard.rankingMode`, default "coins" — unchanged from the original
 * behavior so existing installs see no change unless an admin opts in):
 *
 * - "coins": all three periods rank by coins earned in the window (original
 *   behavior, tiebreak by lifetime correct-prediction count).
 * - "sow": matches SOW §5.4 literally — daily still coins-based (that's what
 *   the SOW already specifies for daily), weekly ranks by accuracy % earned
 *   *in that window*, monthly ranks by a consistency score (the fraction of
 *   days in the window the user submitted at least one prediction).
 */
@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  windowStart(period: LeaderboardPeriodParam): Date {
    const now = new Date();
    switch (period) {
      case 'weekly': {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        return d;
      }
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      case 'daily':
      default:
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    }
  }

  async rankingMode(): Promise<LeaderboardRankingMode> {
    const row = await this.prisma.setting.findUnique({
      where: { key: 'leaderboard.rankingMode' },
    });
    return row?.value === 'sow' ? 'sow' : 'coins';
  }

  private accuracyOf(correct: number, total: number): number {
    return total > 0 ? correct / total : 0;
  }

  private async usersLite(ids: string[]): Promise<Map<string, UserLite>> {
    if (!ids.length) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        username: true,
        avatarSeed: true,
        coins: true,
        correctPredictions: true,
        totalPredictions: true,
      },
    });
    return new Map(users.map((u) => [u.id, u]));
  }

  /** Coins earned in the window, per user — used as the ranking score in
   *  "coins" mode, and as a display/tiebreak value in "sow" mode. */
  private async coinsInWindow(windowStart: Date): Promise<Map<string, number>> {
    const grouped = await this.prisma.coinTransaction.groupBy({
      by: ['userId'],
      where: { amount: { gt: 0 }, createdAt: { gte: windowStart } },
      _sum: { amount: true },
    });
    return new Map(grouped.map((row) => [row.userId, row._sum.amount ?? 0]));
  }

  /** Original ranking: coins earned in the window, tiebreak by lifetime
   *  correct-prediction count. Used for all periods in "coins" mode, and
   *  still for "daily" in "sow" mode (SOW §5.4 daily criteria already is
   *  coins + correct predictions). */
  private async computeOrderedByCoins(
    windowStart: Date,
  ): Promise<{ ordered: OrderedRow[]; userById: Map<string, UserLite> }> {
    const scoreByUser = await this.coinsInWindow(windowStart);
    const ids = [...scoreByUser.keys()];
    const userById = await this.usersLite(ids);

    const ordered = ids
      .map((id) => ({ id, score: scoreByUser.get(id) ?? 0 }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (
          (userById.get(b.id)?.correctPredictions ?? 0) -
          (userById.get(a.id)?.correctPredictions ?? 0)
        );
      });

    return { ordered, userById };
  }

  /** "sow" weekly: ranked by accuracy earned within the window (correct /
   *  settled entries resolved in-window), tiebreak by coins in-window. */
  private async computeOrderedByAccuracy(
    windowStart: Date,
  ): Promise<{ ordered: OrderedRow[]; userById: Map<string, UserLite> }> {
    const settled = await this.prisma.userPrediction.groupBy({
      by: ['userId', 'status'],
      where: {
        resolvedAt: { gte: windowStart },
        status: { in: [EntryStatus.WON, EntryStatus.LOST] },
      },
      _count: { _all: true },
    });
    const statsByUser = new Map<string, { won: number; total: number }>();
    for (const row of settled) {
      const s = statsByUser.get(row.userId) ?? { won: 0, total: 0 };
      s.total += row._count._all;
      if (row.status === EntryStatus.WON) s.won += row._count._all;
      statsByUser.set(row.userId, s);
    }

    const coinsByUser = await this.coinsInWindow(windowStart);
    const ids = [...statsByUser.keys()];
    const userById = await this.usersLite(ids);

    const ordered = ids
      .map((id) => {
        const s = statsByUser.get(id)!;
        return {
          id,
          score: coinsByUser.get(id) ?? 0,
          accuracyOverride: this.accuracyOf(s.won, s.total),
        };
      })
      .sort((a, b) => {
        if (b.accuracyOverride !== a.accuracyOverride) {
          return (b.accuracyOverride ?? 0) - (a.accuracyOverride ?? 0);
        }
        return b.score - a.score;
      });

    return { ordered, userById };
  }

  /** "sow" monthly: ranked by a consistency score — the fraction of days
   *  since the window start (inclusive of today) the user submitted at
   *  least one prediction — tiebreak by coins in-window. */
  private async computeOrderedByConsistency(
    windowStart: Date,
  ): Promise<{ ordered: OrderedRow[]; userById: Map<string, UserLite> }> {
    const daysElapsed = Math.max(
      1,
      Math.floor((Date.now() - windowStart.getTime()) / 86_400_000) + 1,
    );
    const entries = await this.prisma.userPrediction.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { userId: true, createdAt: true },
    });
    const daysByUser = new Map<string, Set<string>>();
    for (const e of entries) {
      const dayKey = e.createdAt.toISOString().slice(0, 10);
      const set = daysByUser.get(e.userId) ?? new Set<string>();
      set.add(dayKey);
      daysByUser.set(e.userId, set);
    }

    const coinsByUser = await this.coinsInWindow(windowStart);
    const consistencyByUser = new Map<string, number>(
      [...daysByUser.entries()].map(([id, days]) => [id, days.size / daysElapsed]),
    );
    const ids = [...daysByUser.keys()];
    const userById = await this.usersLite(ids);

    // Consistency drives the SORT ORDER only — it's not written to
    // `accuracyOverride`/the entry's displayed `accuracy` field, which stays
    // each user's real (lifetime) prediction accuracy. Otherwise the app/web
    // "Accuracy %" column would silently start showing a consistency score
    // under that label once an admin enables "sow" mode — the exact kind of
    // mislabeling this whole pass was meant to eliminate, not reintroduce.
    const ordered = ids
      .map((id) => ({ id, score: coinsByUser.get(id) ?? 0 }))
      .sort((a, b) => {
        const ca = consistencyByUser.get(a.id) ?? 0;
        const cb = consistencyByUser.get(b.id) ?? 0;
        if (cb !== ca) return cb - ca;
        return b.score - a.score;
      });

    return { ordered, userById };
  }

  private async computeOrdered(period: LeaderboardPeriodParam, windowStart: Date) {
    const mode = await this.rankingMode();
    if (mode === 'sow') {
      if (period === 'weekly') return this.computeOrderedByAccuracy(windowStart);
      if (period === 'monthly') return this.computeOrderedByConsistency(windowStart);
    }
    return this.computeOrderedByCoins(windowStart);
  }

  private toEntry(rank: number, userId: string, row: OrderedRow | undefined, u: UserLite | undefined): LeaderboardEntry {
    return {
      rank,
      userId,
      name: u?.name ?? '',
      username: u?.username ?? '',
      avatarSeed: u?.avatarSeed ?? 0,
      score: row?.score ?? 0,
      coins: u?.coins ?? 0,
      accuracy: row?.accuracyOverride ?? this.accuracyOf(u?.correctPredictions ?? 0, u?.totalPredictions ?? 0),
      correctPredictions: u?.correctPredictions ?? 0,
      topBadge: null,
    };
  }

  /** Fill each entry's top badge (by priority) in one query. */
  private async attachBadges(entries: LeaderboardEntry[]) {
    if (!entries.length) return;
    const rows = await this.prisma.userBadge.findMany({
      where: { userId: { in: entries.map((e) => e.userId) } },
      select: { userId: true, badge: { select: { key: true } } },
    });
    const byUser = new Map<string, Set<BadgeKey>>();
    for (const r of rows) {
      const set = byUser.get(r.userId) ?? new Set<BadgeKey>();
      set.add(r.badge.key);
      byUser.set(r.userId, set);
    }
    for (const e of entries) {
      const keys = byUser.get(e.userId);
      e.topBadge = keys ? (BADGE_PRIORITY.find((k) => keys.has(k)) ?? null) : null;
    }
  }

  /** Top [limit] ranked entries for a period (used by the API + scheduler). */
  async getRankedEntries(period: LeaderboardPeriodParam, limit = 50): Promise<LeaderboardEntry[]> {
    const { ordered, userById } = await this.computeOrdered(period, this.windowStart(period));
    const entries = ordered
      .slice(0, limit)
      .map((row, idx) => this.toEntry(idx + 1, row.id, row, userById.get(row.id)));
    await this.attachBadges(entries);
    return entries;
  }

  async getLeaderboard(period: LeaderboardPeriodParam, currentUserId: string) {
    const windowStart = this.windowStart(period);
    const { ordered, userById } = await this.computeOrdered(period, windowStart);

    const entries = ordered
      .slice(0, 50)
      .map((row, idx) => this.toEntry(idx + 1, row.id, row, userById.get(row.id)));
    await this.attachBadges(entries);

    const meIndex = ordered.findIndex((row) => row.id === currentUserId);
    let me: LeaderboardEntry;
    if (meIndex >= 0) {
      const existing = entries.find((e) => e.userId === currentUserId);
      me =
        existing ??
        this.toEntry(meIndex + 1, currentUserId, ordered[meIndex], userById.get(currentUserId));
    } else {
      const meUser = await this.prisma.user.findUnique({
        where: { id: currentUserId },
        select: {
          name: true,
          username: true,
          avatarSeed: true,
          coins: true,
          correctPredictions: true,
          totalPredictions: true,
        },
      });
      me = this.toEntry(ordered.length + 1, currentUserId, undefined, meUser ?? undefined);
    }
    if (me.topBadge === null) await this.attachBadges([me]);

    return { period, windowStart, entries, me };
  }

  async getTodayLuckyWinners(currentUserId: string) {
    // The nightly draw runs at 23:55 and stamps rows with a `dayKey`, not
    // wall-clock "today" — a request.timestamp-based `createdAt >= todayStart`
    // window went empty for the ~23h55m between midnight and that day's run,
    // since the winners for "today" don't exist yet until the job fires.
    // Keying off the draw's own dayKey (same as admin's dayWindowFor()
    // helper) means today's winners stay visible from the moment they're
    // drawn through the rest of the day, matching the "Resets Every
    // Midnight" copy shown in the app.
    const now = new Date();
    const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const draw = await this.prisma.luckyDraw.findUnique({
      where: { dayKey },
      select: { id: true },
    });
    if (!draw) {
      return { winners: [], isCurrentUserWinner: false };
    }

    const winners = await this.prisma.luckyWinner.findMany({
      where: { drawId: draw.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        amount: true,
        createdAt: true,
        user: { select: { name: true, username: true, avatarSeed: true } },
      },
    });

    const list = winners.map((w) => ({
      id: w.id,
      userId: w.userId,
      name: w.user.name,
      username: w.user.username,
      avatarSeed: w.user.avatarSeed,
      amount: w.amount,
      createdAt: w.createdAt,
      // Per-row flag the app actually reads (leaderboard_repository.dart's
      // luckyWinnersToday() maps w['isCurrentUser'] per winner) — the old
      // response only carried this as a single top-level boolean, so every
      // row read `null == true` and the "You Won!" highlight/confetti could
      // never fire from this list.
      isCurrentUser: w.userId === currentUserId,
    }));

    return { winners: list, isCurrentUserWinner: list.some((w) => w.userId === currentUserId) };
  }
}
