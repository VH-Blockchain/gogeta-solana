import { Injectable } from '@nestjs/common';
import { CoinTxnType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isReviewAccount } from '../common/review-account';
import { EconomyService } from './economy.service';

export type DailyBonusMode = 'ONCE_PER_DAY' | 'EVERY_SESSION';

export interface DailyBonusSettings {
  /** Points granted per eligible check. 0 (the shipped default) means the
   *  feature is effectively off — no txn, no lastDailyBonusAt bookkeeping. */
  amount: number;
  /** ONCE_PER_DAY: granted once per UTC calendar day. EVERY_SESSION: granted
   *  again on every fresh app open, gated only by cooldownMinutes. */
  mode: DailyBonusMode;
  /** Only used in EVERY_SESSION mode. 0 = no cooldown (grant on every call). */
  cooldownMinutes: number;
}

export interface DailyBonusResult {
  granted: boolean;
  amount: number;
  /** Only meaningful when granted — tells the client which localized
   *  title/message to show ("Daily Login Bonus" vs "Welcome Back Bonus").
   *  "Daily" would be misleading in EVERY_SESSION mode, which can grant
   *  several times a day, so the two modes get distinct, mode-appropriate
   *  copy instead of one generic label used everywhere. */
  mode?: DailyBonusMode;
  balance?: number;
}

/** Transaction-ledger description shown in the user's Points History —
 *  mode-specific for the same reason the client notification is. */
const DESCRIPTION_BY_MODE: Record<DailyBonusMode, string> = {
  ONCE_PER_DAY: 'Daily Login Bonus',
  EVERY_SESSION: 'Welcome Back Bonus',
};

const DEFAULTS: DailyBonusSettings = {
  amount: 0,
  mode: 'ONCE_PER_DAY',
  cooldownMinutes: 0,
};

/**
 * Daily login/points bonus — admin-configurable amount, mode (once per
 * calendar day vs. again on every app open) and, for the latter, a minimum
 * cooldown between grants. Shipped at amount=0 so it's a no-op until an
 * admin sets a real value from Settings → Daily Bonus.
 */
@Injectable()
export class DailyBonusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
  ) {}

  async getSettings(): Promise<DailyBonusSettings> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { startsWith: 'dailyBonus.' } },
    });
    const byKey = new Map(rows.map((r) => [r.key.replace('dailyBonus.', ''), r.value]));

    const amount = Number(byKey.get('amount'));
    const cooldownMinutes = Number(byKey.get('cooldownMinutes'));
    const mode = byKey.get('mode');

    return {
      amount: Number.isFinite(amount) ? amount : DEFAULTS.amount,
      mode: mode === 'EVERY_SESSION' ? 'EVERY_SESSION' : DEFAULTS.mode,
      cooldownMinutes: Number.isFinite(cooldownMinutes) ? cooldownMinutes : DEFAULTS.cooldownMinutes,
    };
  }

  /** Called only from UsersService.notifyAppOpened — a genuine app-open
   *  event (cold start / resume from background), never a plain profile
   *  refresh. Cheap no-op whenever amount is 0. */
  async grantIfDue(userId: string): Promise<DailyBonusResult> {
    const settings = await this.getSettings();
    if (settings.amount <= 0) return { granted: false, amount: 0 };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastDailyBonusAt: true, email: true },
    });
    if (!user || isReviewAccount(user.email)) return { granted: false, amount: 0 };

    const now = new Date();
    const eligible = this.isEligible(user.lastDailyBonusAt, now, settings);
    if (!eligible) return { granted: false, amount: 0 };

    const balance = await this.prisma.$transaction(async (tx) => {
      const newBalance = await this.economy.applyTxn(tx, userId, CoinTxnType.BONUS, settings.amount, {
        description: DESCRIPTION_BY_MODE[settings.mode],
      });
      await tx.user.update({ where: { id: userId }, data: { lastDailyBonusAt: now } });
      return newBalance;
    });

    return { granted: true, amount: settings.amount, mode: settings.mode, balance };
  }

  private isEligible(lastDailyBonusAt: Date | null, now: Date, settings: DailyBonusSettings): boolean {
    if (!lastDailyBonusAt) return true;
    if (settings.mode === 'ONCE_PER_DAY') {
      return lastDailyBonusAt.toISOString().slice(0, 10) !== now.toISOString().slice(0, 10);
    }
    if (settings.cooldownMinutes <= 0) return true;
    return now.getTime() - lastDailyBonusAt.getTime() >= settings.cooldownMinutes * 60_000;
  }
}
