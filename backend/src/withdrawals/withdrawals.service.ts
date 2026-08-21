import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CoinTxnType,
  NotificationType,
  Prisma,
  WithdrawalStatus,
  type WithdrawalRequest,
} from '@prisma/client';
import { formatUnits } from '../blockchain/format';
import { PrismaService } from '../prisma/prisma.service';
import { EconomyService } from '../economy/economy.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  SOLANA_NETWORK,
  SOLANA_NETWORK_NAME,
  explorerTxUrl,
} from '../blockchain/solana-chain';
import {
  WITHDRAWAL_TOKEN_DECIMALS,
  WITHDRAWAL_TOKEN_MINT,
  WITHDRAWAL_TOKEN_SYMBOL,
  publicWithdrawalToken,
  withdrawalTokenConfigError,
} from '../blockchain/withdrawal-token';
import { isSolanaAddress } from '../blockchain/solana-address';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import {
  OPTIONAL_WITHDRAWABLE_TYPES,
  WITHDRAWABLE_TYPES,
  computeWithdrawable,
  pointsToTokenRaw,
  type LedgerTotals,
} from './withdrawable';

/** Statuses that hold a user's points. */
export const RESERVING_STATUSES: readonly WithdrawalStatus[] = [
  WithdrawalStatus.PENDING,
  WithdrawalStatus.APPROVED,
  WithdrawalStatus.PROCESSING,
];

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger('Withdrawals');

  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Eligibility ─────────────────────────────────────────────────────────

  /**
   * Withdrawable balance, computed from the ledger (§2, §27).
   *
   * Deliberately never reads `user.coins` alone: the balance says how many points
   * exist, not where they came from, and only some sources may be cashed out.
   */
  async availability(userId: string) {
    const [user, rules, luckyWithdrawable, enabled] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { coins: true },
      }),
      this.economy.getRules(),
      this.economy.withdrawableLuckyBonus(),
      this.economy.withdrawalsEnabled(),
    ]);
    if (!user) throw new NotFoundException('User not found');

    const withdrawableTypes = [
      ...WITHDRAWABLE_TYPES,
      ...(luckyWithdrawable ? OPTIONAL_WITHDRAWABLE_TYPES : []),
    ];

    // One grouped read over the ledger rather than several sums, so the numbers
    // cannot come from different snapshots.
    const [byType, reservedAgg] = await Promise.all([
      this.prisma.coinTransaction.groupBy({
        by: ['type'],
        where: { userId },
        _sum: { amount: true },
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: { userId, reserved: true },
        _sum: { points: true },
        _count: { _all: true },
      }),
    ]);

    const totals: LedgerTotals = {
      withdrawableCredits: 0,
      giftedCredits: 0,
      spend: 0,
      withdrawn: 0,
    };
    for (const row of byType) {
      const sum = row._sum.amount ?? 0;
      if (row.type === CoinTxnType.WITHDRAWAL) {
        totals.withdrawn += Math.abs(sum);
        continue;
      }
      if (sum >= 0) {
        if (withdrawableTypes.includes(row.type))
          totals.withdrawableCredits += sum;
        else totals.giftedCredits += sum;
      } else {
        // A negative ADMIN_ADJUST counts as spend, which is what makes a clawback
        // reduce the withdrawable pool rather than being ignored.
        totals.spend += Math.abs(sum);
      }
    }

    const reservedPoints = reservedAgg._sum.points ?? 0;
    const breakdown = computeWithdrawable(totals, user.coins, reservedPoints);
    const minimum = rules.minWithdrawalPoints;

    return {
      ...breakdown,
      openRequests: reservedAgg._count._all,
      minimumWithdrawal: minimum,
      /** Points per whole token — the same rate the purchase flow uses (§5). */
      pointsPerToken: rules.usdcToPoints,
      canWithdraw:
        enabled &&
        this.configError() == null &&
        breakdown.availableToWithdraw >= minimum,
      enabled,
      unavailableReason: !enabled
        ? 'Withdrawals are currently turned off.'
        : this.configError(),
      network: {
        network: SOLANA_NETWORK,
        networkName: SOLANA_NETWORK_NAME,
        ...publicWithdrawalToken(),
      },
      /** What the user would receive for the full available amount. */
      previewAmount: formatUnits(
        pointsToTokenRaw(
          breakdown.availableToWithdraw,
          rules.usdcToPoints,
          WITHDRAWAL_TOKEN_DECIMALS,
        ),
        WITHDRAWAL_TOKEN_DECIMALS,
      ),
      withdrawableSources: withdrawableTypes,
    };
  }

  /**
   * Why withdrawals cannot run, or null when configured.
   *
   * Delegates to the token module, which owns the mint/treasury rules, so the
   * user-facing availability check and the admin-side payout check can never
   * disagree about whether the platform is configured to pay.
   */
  configError(): string | null {
    return withdrawalTokenConfigError();
  }

  // ── Request ─────────────────────────────────────────────────────────────

  /**
   * Creates a PENDING request and reserves the points (§9, §10, §12).
   *
   * Every figure that matters is derived here: the client supplies only a point
   * count, a wallet and an optional note. The payout, the rate and the
   * eligibility all come from the server (§25).
   *
   * The reservation is what stops two concurrent requests spending the same
   * points. Both read the same availability, so the check alone is not enough —
   * after inserting, this re-reads the reserved total inside the same
   * transaction and rolls back if the row it just wrote pushed the user over
   * their limit. Whichever transaction commits second sees the other's row and
   * loses.
   */
  async create(userId: string, dto: CreateWithdrawalDto) {
    const configError = this.configError();
    if (configError) {
      throw new BadRequestException({
        error: 'WITHDRAWALS_UNAVAILABLE',
        message: configError,
      });
    }

    const [rules, enabled] = await Promise.all([
      this.economy.getRules(),
      this.economy.withdrawalsEnabled(),
    ]);
    if (!enabled) {
      throw new ForbiddenException({
        error: 'WITHDRAWALS_DISABLED',
        message: 'Withdrawals are currently turned off.',
      });
    }

    // Trimmed but NOT lower-cased: a payout goes to this exact base58 key, and
    // case-normalising it would send money to an address that does not exist (§22).
    const wallet = dto.walletAddress.trim();
    if (!isSolanaAddress(wallet)) {
      throw new BadRequestException({
        error: 'INVALID_WALLET',
        message: 'That is not a valid Solana wallet address.',
      });
    }

    const points = Math.trunc(dto.points);
    if (!Number.isFinite(points) || points <= 0) {
      throw new BadRequestException({
        error: 'INVALID_AMOUNT',
        message: 'Enter a whole number of points greater than zero.',
      });
    }
    if (points < rules.minWithdrawalPoints) {
      throw new BadRequestException({
        error: 'BELOW_MINIMUM',
        message: `You need at least ${rules.minWithdrawalPoints.toLocaleString('en-US')} withdrawable points to request a withdrawal.`,
      });
    }

    const avail = await this.availability(userId);
    if (points > avail.availableToWithdraw) {
      throw new BadRequestException({
        error: 'INSUFFICIENT_WITHDRAWABLE',
        message: `You only have ${avail.availableToWithdraw.toLocaleString('en-US')} points available to withdraw.`,
      });
    }

    const amountRaw = pointsToTokenRaw(
      points,
      rules.usdcToPoints,
      WITHDRAWAL_TOKEN_DECIMALS,
    );
    if (amountRaw <= 0n) {
      throw new BadRequestException({
        error: 'AMOUNT_TOO_SMALL',
        message: 'That many points converts to nothing at the current rate.',
      });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.withdrawalRequest.create({
        data: {
          userId,
          walletAddress: wallet,
          points,
          amountRaw: amountRaw.toString(),
          amount: new Prisma.Decimal(
            formatUnits(amountRaw, WITHDRAWAL_TOKEN_DECIMALS),
          ),
          // Snapshotted so a later admin rate change cannot restate this
          // request's value (§13).
          exchangeRate: rules.usdcToPoints,
          network: SOLANA_NETWORK,
          
          tokenMint: WITHDRAWAL_TOKEN_MINT,
          tokenSymbol: WITHDRAWAL_TOKEN_SYMBOL,
          tokenDecimals: WITHDRAWAL_TOKEN_DECIMALS,
          userNote: dto.userNote?.trim() || null,
          status: WithdrawalStatus.PENDING,
          reserved: true,
        },
      });

      // Re-check inside the transaction: two requests that both passed the
      // availability check above cannot both survive this.
      const [user, reservedAgg] = await Promise.all([
        tx.user.findUnique({ where: { id: userId }, select: { coins: true } }),
        tx.withdrawalRequest.aggregate({
          where: { userId, reserved: true },
          _sum: { points: true },
        }),
      ]);
      const reservedNow = reservedAgg._sum.points ?? 0;
      if (
        reservedNow > avail.withdrawablePoints ||
        reservedNow > (user?.coins ?? 0)
      ) {
        throw new ConflictException({
          error: 'CONCURRENT_WITHDRAWAL',
          message:
            'Another withdrawal request was submitted at the same time. Please check your history and try again.',
        });
      }
      return row;
    });

    await this.audit('WITHDRAWAL_CREATED', userId, created, { points });
    await this.notify(
      userId,
      'Withdrawal requested',
      `Your withdrawal request for ${points.toLocaleString('en-US')} points (${created.amount.toString()} ${WITHDRAWAL_TOKEN_SYMBOL}) has been submitted.`,
      created.id,
    );

    this.logger.log(
      `Withdrawal ${created.id}: ${points} points → ${created.amount.toString()} ${WITHDRAWAL_TOKEN_SYMBOL} for ${userId}`,
    );
    return this.publicRow(created);
  }

  /** Lets a user withdraw their request while it is still untouched. */
  async cancel(userId: string, id: string) {
    const row = await this.prisma.withdrawalRequest.findFirst({
      where: { id, userId },
    });
    if (!row) throw new NotFoundException('Withdrawal request not found');
    if (row.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException({
        error: 'NOT_CANCELLABLE',
        message: 'Only a pending request can be cancelled.',
      });
    }

    // Conditional update so a cancel racing an admin approval cannot win twice.
    const claimed = await this.prisma.withdrawalRequest.updateMany({
      where: { id, userId, status: WithdrawalStatus.PENDING },
      data: {
        status: WithdrawalStatus.CANCELLED,
        reserved: false,
        adminNote: null,
      },
    });
    if (claimed.count === 0) {
      throw new ConflictException({
        error: 'NOT_CANCELLABLE',
        message: 'That request has already been actioned.',
      });
    }

    const fresh = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
    });
    await this.audit('WITHDRAWAL_CANCELLED', userId, fresh!, {});
    return this.publicRow(fresh!);
  }

  // ── Reads ───────────────────────────────────────────────────────────────

  async history(userId: string, opts: { skip?: string; take?: string } = {}) {
    const take = Math.min(Math.max(Number(opts.take) || 20, 1), 100);
    const skip = Math.max(Number(opts.skip) || 0, 0);

    const [total, rows, completed] = await Promise.all([
      this.prisma.withdrawalRequest.count({ where: { userId } }),
      this.prisma.withdrawalRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: { userId, status: WithdrawalStatus.COMPLETED },
        _sum: { points: true, amount: true },
      }),
    ]);

    return {
      total,
      skip,
      take,
      totals: {
        pointsWithdrawn: completed._sum.points ?? 0,
        amountPaid: completed._sum.amount?.toString() ?? '0',
        tokenSymbol: WITHDRAWAL_TOKEN_SYMBOL,
      },
      items: rows.map((r) => this.publicRow(r)),
    };
  }

  async getOne(userId: string, id: string) {
    const row = await this.prisma.withdrawalRequest.findFirst({
      where: { id, userId },
    });
    if (!row) throw new NotFoundException('Withdrawal request not found');
    return this.publicRow(row);
  }

  // ── Shared helpers (also used by the admin service) ──────────────────────

  publicRow(r: WithdrawalRequest) {
    return {
      id: r.id,
      walletAddress: r.walletAddress,
      points: r.points,
      amount: r.amount.toString(),
      amountRaw: r.amountRaw,
      exchangeRate: r.exchangeRate,
      network: r.network,
      networkName: r.network,
      tokenMint: r.tokenMint,
      tokenSymbol: r.tokenSymbol,
      tokenDecimals: r.tokenDecimals,
      status: r.status,
      reserved: r.reserved,
      userNote: r.userNote,
      /** The admin's reason, shown to the user on a rejection (§23). */
      adminNote: r.adminNote,
      transactionSignature: r.transactionSignature,
      explorerUrl: r.transactionSignature ? explorerTxUrl(r.transactionSignature) : null,
      blockNumber: r.blockNumber != null ? r.blockNumber.toString() : null,
      createdAt: r.createdAt.toISOString(),
      approvedAt: r.approvedAt?.toISOString() ?? null,
      rejectedAt: r.rejectedAt?.toISOString() ?? null,
      completedAt: r.completedAt?.toISOString() ?? null,
    };
  }

  /** Audit trail for every state change (§31). */
  async audit(
    action: string,
    actorId: string | null,
    row: WithdrawalRequest,
    extra: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        target: row.id,
        meta: {
          withdrawalId: row.id,
          userId: row.userId,
          points: row.points,
          amount: row.amount.toString(),
          tokenSymbol: row.tokenSymbol,
          walletAddress: row.walletAddress,
          status: row.status,
          transactionSignature: row.transactionSignature,
          ...extra,
        },
      },
    });
  }

  /** Reuses the existing notification system (§32). */
  async notify(
    userId: string,
    title: string,
    body: string,
    withdrawalId: string,
  ) {
    try {
      await this.notifications.create(
        userId,
        NotificationType.SYSTEM,
        title,
        body,
        {
          withdrawalId,
        },
      );
    } catch (err) {
      // A notification failure must never roll back a money decision.
      this.logger.warn(
        `Withdrawal notification failed for ${userId}: ${String(err)}`,
      );
    }
  }
}
