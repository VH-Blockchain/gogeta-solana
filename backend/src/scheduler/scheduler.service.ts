import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  BadgeKey,
  CoinTxnType,
  EntryStatus,
  LeaderboardPeriod,
  NotificationType,
  PredictionStatus,
  Prisma,
  UserLevel,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { LeaderboardService, LeaderboardEntry } from '../leaderboard/leaderboard.service';
import { EconomyService } from '../economy/economy.service';
import { PushService } from '../push/push.service';
import { seededShuffle } from '../admin/shuffle.util';

/**
 * Period-close jobs (SOW §5.4/§5.5): snapshot leaderboards for historical
 * reports, award period badges (Daily Hero / Weekly Star / Monthly Champion)
 * and promote Champion/Legend levels. Also runs the once-daily Lucky Draw
 * (SOW §5.3 "Daily Reward Pool").
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leaderboard: LeaderboardService,
    private readonly gamification: GamificationService,
    private readonly economy: EconomyService,
    private readonly push: PushService,
  ) {}

  /** Every minute — publish scheduled predictions whose open time arrived. */
  @Cron('* * * * *')
  async openScheduledPredictions() {
    const res = await this.prisma.prediction.updateMany({
      where: { status: PredictionStatus.SCHEDULED, opensAt: { lte: new Date() } },
      data: { status: PredictionStatus.OPEN },
    });
    if (res.count > 0) this.logger.log(`Opened ${res.count} scheduled prediction(s)`);
  }

  /**
   * Every minute — lock predictions whose entry window has ended. Without
   * this, a prediction stays OPEN in the database (and every client keeps
   * showing it as open/acceptable-to-enter) forever after closesAt passes,
   * until an admin happens to resolve it manually.
   */
  @Cron('* * * * *')
  async lockExpiredPredictions() {
    const res = await this.prisma.prediction.updateMany({
      where: { status: PredictionStatus.OPEN, closesAt: { lte: new Date() } },
      data: { status: PredictionStatus.LOCKED },
    });
    if (res.count > 0) this.logger.log(`Locked ${res.count} expired prediction(s)`);
  }

  /** Nightly at 23:55 — close the day, and the week/month when they end. */
  @Cron('55 23 * * *')
  async nightly() {
    const now = new Date();
    await this.closeDaily();
    await this.runLuckyDraw();
    if (now.getDay() === 0) await this.closeWeekly(); // Sunday
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    if (tomorrow.getDate() === 1) await this.closeMonthly(); // last day of month
  }

  /**
   * Daily Lucky Draw (SOW §5.3): once per calendar day, pool every user with
   * at least one correct prediction that day (across ALL predictions
   * resolved that day, not just one) and randomly draw up to
   * `economy.dailyLuckyWinners` of them for the bonus. Previously this ran
   * once per resolved prediction instead of once per day, so a user could
   * win the bonus repeatedly on a day when multiple predictions resolved —
   * `LuckyDraw.dayKey` being unique makes this job idempotent (also safely
   * re-runnable, e.g. if triggered manually mid-day by an admin).
   */
  async runLuckyDraw() {
    const key = this.dayKey();
    const existing = await this.prisma.luckyDraw.findUnique({
      where: { dayKey: key },
      select: { id: true },
    });
    if (existing) {
      this.logger.log(`Lucky draw already run for ${key}`);
      return;
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const winEntries = await this.prisma.userPrediction.findMany({
      where: { status: EntryStatus.WON, resolvedAt: { gte: start } },
      distinct: ['userId'],
      select: { userId: true },
    });
    const wonUserIds = winEntries.map((e) => e.userId);
    if (wonUserIds.length === 0) {
      this.logger.log(`Lucky draw: no correct predictions today (${key}) — skipped`);
      return;
    }

    const rules = await this.economy.getRules();
    const seed = `${key}-lucky-draw`;
    const picked = seededShuffle(wonUserIds, seed).slice(
      0,
      Math.min(rules.dailyLuckyWinners, wonUserIds.length),
    );

    const luckyEnabled = await this.luckyNotificationsEnabled();
    const prefs = new Map(
      (
        await this.prisma.user.findMany({
          where: { id: { in: picked } },
          select: { id: true, notifyPush: true, notifyLucky: true },
        })
      ).map((u) => [u.id, u]),
    );
    const pushTargets: { userId: string; title: string; body: string }[] = [];

    await this.prisma.$transaction(
      async (tx) => {
        const draw = await tx.luckyDraw.create({
          data: {
            dayKey: key,
            winnersCount: rules.dailyLuckyWinners,
            bonusPerWinner: rules.luckyBonus,
            seed,
            eligibleCount: wonUserIds.length,
          },
        });

        for (const userId of picked) {
          await tx.luckyWinner.create({
            data: { drawId: draw.id, userId, amount: rules.luckyBonus },
          });
          await this.economy.applyTxn(tx, userId, CoinTxnType.LUCKY_BONUS, rules.luckyBonus, {
            referenceId: draw.id,
            description: 'Lucky Winner bonus',
          });

          const p = prefs.get(userId);
          if (luckyEnabled && p?.notifyPush === true && p?.notifyLucky === true) {
            const title = `You're a Lucky Winner! 🍀`;
            const body = `You won ${rules.luckyBonus} bonus coins in the daily draw.`;
            await tx.notification.create({
              data: { userId, type: NotificationType.LUCKY, title, body },
            });
            pushTargets.push({ userId, title, body });
          }
        }
      },
      { timeout: 30000 },
    );

    for (const t of pushTargets) {
      this.push
        .sendToUser(t.userId, t)
        .catch((err) => this.logger.error(`push to ${t.userId} failed: ${String(err)}`));
    }

    this.logger.log(
      `Lucky draw ${key}: ${picked.length}/${wonUserIds.length} eligible drawn, ${rules.luckyBonus} pts each`,
    );
  }

  private async luckyNotificationsEnabled(): Promise<boolean> {
    const row = await this.prisma.setting.findUnique({
      where: { key: 'notifications.enabled.LUCKY' },
    });
    return row ? row.value === true : true;
  }

  // ── Period closes (also callable manually by an admin) ──────────────────

  async closeDaily() {
    const entries = await this.leaderboard.getRankedEntries('daily', 50);
    await this.snapshot(LeaderboardPeriod.DAILY, this.dayKey(), entries);
    if (entries[0]) await this.gamification.awardBadge(this.prisma, entries[0].userId, BadgeKey.DAILY_HERO);
    this.logger.log(`Daily close: ${entries.length} ranked, top=${entries[0]?.name ?? '—'}`);
    return this.summary('daily', entries);
  }

  async closeWeekly() {
    const entries = await this.leaderboard.getRankedEntries('weekly', 50);
    await this.snapshot(LeaderboardPeriod.WEEKLY, `W${this.dayKey()}`, entries);
    if (entries[0]) await this.gamification.awardBadge(this.prisma, entries[0].userId, BadgeKey.WEEKLY_STAR);
    this.logger.log(`Weekly close: ${entries.length} ranked, top=${entries[0]?.name ?? '—'}`);
    return this.summary('weekly', entries);
  }

  async closeMonthly() {
    const key = this.monthKey();
    // Level/count promotion must run at most once per month (it's not
    // idempotent), so only when this month hasn't been closed before.
    const alreadyClosed = await this.prisma.leaderboardSnapshot.findUnique({
      where: { period_periodKey: { period: LeaderboardPeriod.MONTHLY, periodKey: key } },
    });

    const entries = await this.leaderboard.getRankedEntries('monthly', 50);
    await this.snapshot(LeaderboardPeriod.MONTHLY, key, entries);
    if (entries[0]) await this.gamification.awardBadge(this.prisma, entries[0].userId, BadgeKey.MONTHLY_CHAMPION);

    if (alreadyClosed) {
      this.logger.log(`Monthly close: ${key} already processed — refreshed snapshot only`);
      return this.summary('monthly', entries);
    }

    // Levels: top 10 → Champion; 3× top-3 finishes → Legend. Never demote.
    // Leaderboard rank alone must never let a user skip Analyst/Expert — a
    // high-coin, low-accuracy user is NOT eligible until they've organically
    // reached Expert (>=100 correct predictions) via levelFromStats(), same
    // as anyone climbing Beginner→Predictor→Analyst→Expert. Only once that's
    // true (or they're already Champion, tracking further top-3 finishes
    // toward Legend) does a top-10/top-3 monthly finish count for anything.
    const top3 = new Set(entries.slice(0, 3).map((e) => e.userId));
    for (const e of entries.slice(0, 10)) {
      const u = await this.prisma.user.findUnique({
        where: { id: e.userId },
        select: { level: true, monthlyTop3Count: true, correctPredictions: true },
      });
      if (!u || u.level === UserLevel.LEGEND) continue;
      const championEligible = u.level === UserLevel.CHAMPION || u.correctPredictions >= 100;
      if (!championEligible) continue;
      const isTop3 = top3.has(e.userId);
      const monthlyTop3Count = isTop3 ? u.monthlyTop3Count + 1 : u.monthlyTop3Count;
      const level = monthlyTop3Count >= 3 ? UserLevel.LEGEND : UserLevel.CHAMPION;
      await this.prisma.user.update({ where: { id: e.userId }, data: { level, monthlyTop3Count } });
    }
    this.logger.log(`Monthly close: ${entries.length} ranked, champion=${entries[0]?.name ?? '—'}`);
    return this.summary('monthly', entries);
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async snapshot(period: LeaderboardPeriod, periodKey: string, entries: LeaderboardEntry[]) {
    const rankings = entries.map((e) => ({
      rank: e.rank,
      userId: e.userId,
      name: e.name,
      username: e.username,
      score: e.score,
      coins: e.coins,
      accuracy: e.accuracy,
      topBadge: e.topBadge,
    })) as unknown as Prisma.InputJsonValue;

    await this.prisma.leaderboardSnapshot.upsert({
      where: { period_periodKey: { period, periodKey } },
      create: { period, periodKey, rankings },
      update: { rankings },
    });
  }

  private summary(period: string, entries: LeaderboardEntry[]) {
    return { period, ranked: entries.length, top: entries.slice(0, 3).map((e) => ({ rank: e.rank, name: e.name, score: e.score })) };
  }

  private dayKey(d = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private monthKey(d = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}
