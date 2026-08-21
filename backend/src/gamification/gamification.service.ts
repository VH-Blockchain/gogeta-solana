import { Injectable } from '@nestjs/common';
import { BadgeKey, Prisma, UserLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Badges + level progression rules (SOW §5.5). */
@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Award a badge if the user doesn't already have it. Returns true if newly awarded. */
  async awardBadge(
    tx: Prisma.TransactionClient,
    userId: string,
    key: BadgeKey,
  ): Promise<boolean> {
    const badge = await tx.badge.findUnique({ where: { key } });
    if (!badge) return false;
    const existing = await tx.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
    });
    if (existing) return false;
    await tx.userBadge.create({ data: { userId, badgeId: badge.id } });
    return true;
  }

  /**
   * Level from prediction stats (SOW §5.5). Champion / Legend are
   * leaderboard-driven and assigned by the leaderboard module.
   */
  levelFromStats(stats: {
    totalPredictions: number;
    correctPredictions: number;
    level: UserLevel;
  }): UserLevel {
    // Don't demote leaderboard-earned levels.
    if (stats.level === UserLevel.CHAMPION || stats.level === UserLevel.LEGEND) {
      return stats.level;
    }
    if (stats.correctPredictions >= 100) return UserLevel.EXPERT;
    if (stats.correctPredictions >= 50) return UserLevel.ANALYST;
    if (stats.totalPredictions >= 10) return UserLevel.PREDICTOR;
    return UserLevel.BEGINNER;
  }
}
