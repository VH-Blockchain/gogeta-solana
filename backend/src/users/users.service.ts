import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { EntryStatus, PredictionStatus, Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DailyBonusMode, DailyBonusService } from '../economy/daily-bonus.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/** User shape that is safe to return to clients (no passwordHash). */
export type PublicUser = Omit<User, 'passwordHash'>;

/** Compute the percentage share of votes for a single option. */
function sharePercent(votes: number, totalVotes: number): number {
  if (totalVotes <= 0) return 0;
  return Math.round((votes / totalVotes) * 100);
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyBonus: DailyBonusService,
  ) {}

  /** Strip the passwordHash off a user record before returning it. */
  toPublicUser(user: User): PublicUser {
    const { passwordHash: _omit, ...rest } = user;
    return rest;
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getMe(userId: string): Promise<PublicUser> {
    return this.toPublicUser(await this.requireUser(userId));
  }

  /** Called only on a genuine app-open event (cold start, or resume from a
   *  backgrounded state) — see the Flutter app's lifecycle observer. Deliberately
   *  NOT hooked into getMe/profile, because that's fetched on every pull-to-refresh,
   *  tab switch and post-submit reload, none of which mean "the user reopened the
   *  app" — hooking it there granted the bonus on every such call instead of once
   *  per real reopen. */
  async notifyAppOpened(
    userId: string,
  ): Promise<{ dailyBonusGranted: number | null; dailyBonusMode: DailyBonusMode | null; coins: number }> {
    const bonus = await this.dailyBonus.grantIfDue(userId);
    if (bonus.granted && bonus.balance !== undefined) {
      return { dailyBonusGranted: bonus.amount, dailyBonusMode: bonus.mode ?? null, coins: bonus.balance };
    }
    const user = await this.requireUser(userId);
    return { dailyBonusGranted: null, dailyBonusMode: null, coins: user.coins };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    if (dto.username) {
      const existing = await this.prisma.user.findUnique({
        where: { username: dto.username },
        select: { id: true },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Username is already taken');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.username !== undefined && { username: dto.username }),
        ...(dto.avatarSeed !== undefined && { avatarSeed: dto.avatarSeed }),
      },
    });
    return this.toPublicUser(updated);
  }

  async getStats(userId: string) {
    const user = await this.requireUser(userId);

    const [betterRanked, earnedBadges, totalBadges] = await Promise.all([
      this.prisma.user.count({ where: { coins: { gt: user.coins } } }),
      this.prisma.userBadge.count({ where: { userId } }),
      this.prisma.badge.count({ where: { active: true } }),
    ]);

    const accuracy =
      user.totalPredictions > 0
        ? user.correctPredictions / user.totalPredictions
        : 0;

    return {
      coins: user.coins,
      level: user.level,
      xp: user.xp,
      totalPredictions: user.totalPredictions,
      correctPredictions: user.correctPredictions,
      accuracy,
      currentStreak: user.currentStreak,
      bestStreak: user.bestStreak,
      globalRank: betterRanked + 1,
      earnedBadges,
      totalBadges,
    };
  }

  async getBadges(userId: string) {
    const [badges, owned] = await Promise.all([
      this.prisma.badge.findMany({
        where: { active: true },
        orderBy: { key: 'asc' },
      }),
      this.prisma.userBadge.findMany({
        where: { userId },
        select: { badgeId: true, earnedAt: true },
      }),
    ]);

    const earnedMap = new Map(owned.map((b) => [b.badgeId, b.earnedAt]));

    return badges.map((badge) => ({
      key: badge.key,
      label: badge.label,
      requirement: badge.requirement,
      icon: badge.icon,
      accent: badge.accent,
      earned: earnedMap.has(badge.id),
      earnedAt: earnedMap.get(badge.id) ?? null,
    }));
  }

  /** Fetch + shape OPEN predictions (with options + sharePercent). */
  private async findOpenPredictions(opts: {
    featured: boolean;
    take?: number;
  }) {
    const predictions = await this.prisma.prediction.findMany({
      where: { status: PredictionStatus.OPEN, featured: opts.featured },
      orderBy: { closesAt: 'asc' },
      take: opts.take,
      include: {
        options: { orderBy: { order: 'asc' } },
      },
    });
    return predictions.map((p) => this.shapePrediction(p));
  }

  private shapePrediction(prediction: {
    id: string;
    categoryId: string;
    title: string;
    subtitle: string;
    entryFee: number;
    reward: number;
    status: PredictionStatus;
    featured: boolean;
    participants: number;
    opensAt: Date;
    closesAt: Date;
    options: {
      id: string;
      label: string;
      odds: number;
      order: number;
      votes: number;
    }[];
  }) {
    const totalVotes = prediction.options.reduce((sum, o) => sum + o.votes, 0);
    return {
      id: prediction.id,
      categoryId: prediction.categoryId,
      title: prediction.title,
      subtitle: prediction.subtitle,
      entryFee: prediction.entryFee,
      reward: prediction.reward,
      status: prediction.status,
      featured: prediction.featured,
      participants: prediction.participants,
      opensAt: prediction.opensAt,
      closesAt: prediction.closesAt,
      options: prediction.options.map((o) => ({
        id: o.id,
        label: o.label,
        odds: o.odds,
        order: o.order,
        votes: o.votes,
        sharePercent: sharePercent(o.votes, totalVotes),
      })),
    };
  }

  async getHome(userId: string) {
    const [user, stats, featuredList, openPredictions, topUsers] =
      await Promise.all([
        this.requireUser(userId),
        this.getStats(userId),
        this.findOpenPredictions({ featured: true, take: 1 }),
        this.findOpenPredictions({ featured: false, take: 4 }),
        this.prisma.user.findMany({
          orderBy: { coins: 'desc' },
          take: 3,
          select: {
            name: true,
            username: true,
            avatarSeed: true,
            coins: true,
            totalPredictions: true,
            correctPredictions: true,
          },
        }),
      ]);

    const leaderboardPeek = topUsers.map((u, index) => ({
      rank: index + 1,
      name: u.name,
      username: u.username,
      avatarSeed: u.avatarSeed,
      coins: u.coins,
      accuracy:
        u.totalPredictions > 0
          ? u.correctPredictions / u.totalPredictions
          : 0,
    }));

    return {
      user: this.toPublicUser(user),
      stats,
      featured: featuredList[0] ?? null,
      openPredictions,
      leaderboardPeek,
    };
  }

  /**
   * Daily sparkline series for the last [days] days (oldest → newest):
   * - coinTrend: the coin balance at the end of each day (from balanceAfter)
   * - accuracyTrend: cumulative win-rate (0..1) of settled predictions
   */
  async getTrends(userId: string, days = 8) {
    await this.requireUser(userId);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Exclusive upper bound (midnight after that day) for each bucket.
    const boundaries: Date[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const end = new Date(startOfToday);
      end.setDate(end.getDate() - i + 1);
      boundaries.push(end);
    }

    const [txns, entries] = await Promise.all([
      this.prisma.coinTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { balanceAfter: true, createdAt: true },
      }),
      this.prisma.userPrediction.findMany({
        where: {
          userId,
          resolvedAt: { not: null },
          status: { in: [EntryStatus.WON, EntryStatus.LOST] },
        },
        orderBy: { resolvedAt: 'asc' },
        select: { status: true, resolvedAt: true },
      }),
    ]);

    const coinTrend = boundaries.map((b) => {
      let balance = 0;
      for (const t of txns) {
        if (t.createdAt < b) balance = t.balanceAfter;
        else break;
      }
      return balance;
    });

    const accuracyTrend = boundaries.map((b) => {
      let correct = 0;
      let total = 0;
      for (const e of entries) {
        if (e.resolvedAt && e.resolvedAt < b) {
          total += 1;
          if (e.status === EntryStatus.WON) correct += 1;
        } else {
          break;
        }
      }
      return total > 0 ? correct / total : 0;
    });

    // Net change across the window (first non-zero → latest) for delta chips.
    const firstCoins = coinTrend.find((v) => v > 0) ?? coinTrend[0] ?? 0;
    const coinDelta = (coinTrend[coinTrend.length - 1] ?? 0) - firstCoins;
    const accFirst = accuracyTrend.find((v) => v > 0) ?? accuracyTrend[0] ?? 0;
    const accuracyDelta = Math.round(((accuracyTrend[accuracyTrend.length - 1] ?? 0) - accFirst) * 100);

    return { coinTrend, accuracyTrend, coinDelta, accuracyDelta };
  }

  async getSettings(userId: string) {
    const u = await this.requireUser(userId);
    return {
      push: u.notifyPush,
      lucky: u.notifyLucky,
      results: u.notifyResults,
      leaderboard: u.notifyLeaderboard,
    };
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    const u = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.push !== undefined && { notifyPush: dto.push }),
        ...(dto.lucky !== undefined && { notifyLucky: dto.lucky }),
        ...(dto.results !== undefined && { notifyResults: dto.results }),
        ...(dto.leaderboard !== undefined && { notifyLeaderboard: dto.leaderboard }),
      },
    });
    return {
      push: u.notifyPush,
      lucky: u.notifyLucky,
      results: u.notifyResults,
      leaderboard: u.notifyLeaderboard,
    };
  }

  /**
   * Permanently deletes the account and all related data (entries, wallet,
   * notifications, ...) via the schema's onDelete: Cascade relations.
   * Required for App Store / Play Store in-app account deletion.
   */
  async deleteAccount(userId: string) {
    const user = await this.requireUser(userId);
    if (user.role === Role.ADMIN) {
      throw new ForbiddenException('Admin accounts cannot be deleted from the app');
    }
    await this.prisma.user.delete({ where: { id: userId } });
    return { deleted: true };
  }

  /** Authenticated in-app/in-admin change — no OTP, since the caller already
   *  proves identity via the current password (unlike forgotPassword's OTP
   *  flow for a logged-out user who doesn't know it). Same table/hashing as
   *  login and reset-password, so app users and admin staff share this one
   *  endpoint. */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.requireUser(userId);
    const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!matches) throw new BadRequestException('Current password is incorrect');
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { success: true };
  }
}
