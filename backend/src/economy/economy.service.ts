import { BadRequestException, Injectable } from '@nestjs/common';
import { CoinTxnType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface EconomyRules {
  signupBonus: number;
  /** The live "Default points" value (Settings -> Points economy). Charged
   *  on entry for every prediction with useDefaultEconomy = true. */
  entryFee: number;
  correctReward: number;
  luckyBonus: number;
  dailyLuckyWinners: number;
  /** Points credited per whole USDC when buying points. */
  usdcToPoints: number;
  /** Per-purchase USDC bounds, inclusive. */
  pointsMinPurchaseUsdc: number;
  pointsMaxPurchaseUsdc: number;
  /** Smallest withdrawal a user may request, in points. */
  minWithdrawalPoints: number;
}

/**
 * Central coin economy. Defaults match the SOW but every value is overridable
 * from the admin `Setting` table (key `economy.*`) so rewards are dynamic.
 */
@Injectable()
export class EconomyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reward amounts are 10% of the platform's original values (1000/100/500),
   * reduced when paid points were introduced so granted points and purchased
   * points are worth comparable amounts.
   *
   * `entryFee` is a cost the user pays, not a grant, so it is deliberately
   * unchanged — as is `dailyLuckyWinners`, which counts winners rather than
   * points.
   */
  static readonly DEFAULTS: EconomyRules = {
    signupBonus: 100,
    entryFee: 50,
    correctReward: 10,
    luckyBonus: 50,
    dailyLuckyWinners: 10,
    usdcToPoints: 100,
    pointsMinPurchaseUsdc: 1,
    pointsMaxPurchaseUsdc: 1000,
    minWithdrawalPoints: 1000,
  };

  async getRules(): Promise<EconomyRules> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { startsWith: 'economy.' } },
    });
    const overrides: Partial<EconomyRules> = {};
    for (const row of rows) {
      const key = row.key.replace('economy.', '') as keyof EconomyRules;
      const value = Number(row.value as unknown);
      if (key in EconomyService.DEFAULTS && Number.isFinite(value)) {
        overrides[key] = value;
      }
    }
    return { ...EconomyService.DEFAULTS, ...overrides };
  }

  /**
   * Master on/off switch for the whole points economy (Settings -> Points
   * economy). Off means completely free: every prediction's entry cost
   * resolves to 0 (no deduction, no Points/Reward summary shown anywhere in
   * the app) regardless of its own Points value or whether it follows the
   * default — see resolveEntryFee. Defaults on. Reward payout on a correct
   * call is untouched by this switch, same as any existing 0-cost
   * prediction already pays a real reward today.
   */
  /**
   * Whether buying points with USDC is currently offered (Settings -> Points
   * economy). Separate from `getRules()` because that only parses numbers.
   */
  async pointsPurchaseEnabled(): Promise<boolean> {
    const row = await this.prisma.setting.findUnique({
      where: { key: 'economy.pointsPurchaseEnabled' },
    });
    return row?.value !== false;
  }

  /**
   * Master switch for cashing points out (Settings -> Points economy). Separate
   * from `getRules()` because that only parses numbers.
   */
  async withdrawalsEnabled(): Promise<boolean> {
    const row = await this.prisma.setting.findUnique({
      where: { key: 'economy.withdrawalsEnabled' },
    });
    return row?.value !== false;
  }

  /**
   * Whether lucky-draw points may be cashed out.
   *
   * Off by default: a draw win is a promotional grant rather than something the
   * user paid for or earned by playing, and the spec's own worked example
   * excludes it. Left configurable so the policy can change without a deploy.
   */
  async withdrawableLuckyBonus(): Promise<boolean> {
    const row = await this.prisma.setting.findUnique({
      where: { key: 'economy.withdrawableLuckyBonus' },
    });
    return row?.value === true;
  }

  async pointsEnabled(): Promise<boolean> {
    const row = await this.prisma.setting.findUnique({ where: { key: 'economy.pointsEnabled' } });
    return row?.value !== false;
  }

  /**
   * Resolves the actual reward to store on a prediction at create/edit time.
   * Points and Reward are always independent, admin-set values — falls back
   * to the global "Default reward" setting only when the admin doesn't
   * supply one explicitly (e.g. via CSV import missing the column).
   */
  computeReward(explicitReward: number | undefined, fallback: number): number {
    return explicitReward ?? fallback;
  }

  /**
   * The entryFee/reward actually in effect for a prediction right now.
   * useDefaultEconomy = true always tracks the live Points economy settings
   * (so an admin changing "Default points" instantly applies to every
   * prediction still following the default, no backfill needed); false uses
   * the per-prediction override stored on the row.
   */
  resolveEntryFee(
    prediction: { entryFee: number; useDefaultEconomy: boolean },
    rules: EconomyRules,
    pointsEnabled: boolean,
  ): number {
    if (!pointsEnabled) return 0;
    return prediction.useDefaultEconomy ? rules.entryFee : prediction.entryFee;
  }

  resolveReward(prediction: { reward: number; useDefaultEconomy: boolean }, rules: EconomyRules): number {
    return prediction.useDefaultEconomy ? rules.correctReward : prediction.reward;
  }

  /**
   * Apply a signed coin change to a user and record an auditable transaction.
   * Must be called inside a Prisma `$transaction` (pass the tx client) so the
   * balance update and the ledger row commit atomically.
   */
  async applyTxn(
    tx: Prisma.TransactionClient,
    userId: string,
    type: CoinTxnType,
    amount: number,
    opts: { referenceId?: string; description?: string } = {},
  ): Promise<number> {
    const user = await tx.user.update({
      where: { id: userId },
      data: { coins: { increment: amount } },
      select: { coins: true },
    });
    await tx.coinTransaction.create({
      data: {
        userId,
        type,
        amount,
        balanceAfter: user.coins,
        referenceId: opts.referenceId,
        description: opts.description ?? '',
      },
    });
    return user.coins;
  }
}
