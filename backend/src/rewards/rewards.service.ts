import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type TransactionFilter = 'all' | 'earned' | 'spent';

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const [user, earnedAgg, weekAgg, luckyWins, recent, freePicks] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { coins: true },
        }),
        this.prisma.coinTransaction.aggregate({
          where: { userId, amount: { gt: 0 } },
          _sum: { amount: true },
        }),
        this.prisma.coinTransaction.aggregate({
          where: { userId, amount: { gt: 0 }, createdAt: { gte: weekStart } },
          _sum: { amount: true },
        }),
        this.prisma.luckyWinner.count({ where: { userId } }),
        this.prisma.coinTransaction.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            type: true,
            description: true,
            amount: true,
            createdAt: true,
          },
        }),
        // A free (entryFee = 0) submission never writes a CoinTransaction —
        // there's nothing to debit, so `recent` above would otherwise stay
        // empty for a user who only ever plays no-fee predictions. Paid
        // entries are deliberately excluded here since those already appear
        // via their own ENTRY_FEE row above; including both would duplicate
        // the same submission twice.
        this.prisma.userPrediction.findMany({
          where: { userId, entryFee: 0 },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            createdAt: true,
            prediction: { select: { title: true } },
            option: { select: { label: true } },
          },
        }),
      ]);

    const merged = [
      ...recent.map((t) => ({
        id: t.id,
        type: t.type as string,
        title: t.description,
        amount: t.amount,
        createdAt: t.createdAt,
      })),
      ...freePicks.map((p) => ({
        id: `pick-${p.id}`,
        type: 'PREDICTION_SUBMITTED',
        title: `Predicted "${p.prediction.title}" — ${p.option.label}`,
        amount: 0,
        createdAt: p.createdAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    return {
      balance: user?.coins ?? 0,
      earnedTotal: earnedAgg._sum.amount ?? 0,
      thisWeek: weekAgg._sum.amount ?? 0,
      luckyWins,
      recent: merged,
    };
  }

  async getTransactions(
    userId: string,
    filter: TransactionFilter,
    limit: number,
  ) {
    const where: Prisma.CoinTransactionWhereInput = { userId };
    if (filter === 'earned') {
      where.amount = { gt: 0 };
    } else if (filter === 'spent') {
      where.amount = { lt: 0 };
    }

    const txns = await this.prisma.coinTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        description: true,
        amount: true,
        balanceAfter: true,
        createdAt: true,
      },
    });

    return txns.map((t) => ({
      id: t.id,
      type: t.type,
      title: t.description,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      createdAt: t.createdAt,
    }));
  }
}
