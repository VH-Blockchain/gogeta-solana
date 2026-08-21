import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CoinTxnType,
  Prisma,
  WithdrawalStatus,
  type WithdrawalRequest,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EconomyService } from '../economy/economy.service';
import { SolanaService } from '../blockchain/solana.service';
import {
  SOLANA_NETWORK,
  SOLANA_NETWORK_NAME,
  explorerTxUrl,
} from '../blockchain/solana-chain';
import {
  WITHDRAWAL_TREASURY_ADDRESSES,
  publicWithdrawalToken,
} from '../blockchain/withdrawal-token';
import { WithdrawalsService } from './withdrawals.service';
import {
  ApproveWithdrawalDto,
  CompleteWithdrawalDto,
  FailWithdrawalDto,
  RejectWithdrawalDto,
} from './dto/withdrawal-admin.dto';

/**
 * Withdrawal administration (§15–§19, §23, §24).
 *
 * The whole point of this service is that money never moves without a human
 * decision: a request sits PENDING until an admin approves it, and the points are
 * only debited once a real on-chain payout has been verified.
 */
@Injectable()
export class WithdrawalsAdminService {
  private readonly logger = new Logger('WithdrawalsAdmin');

  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly solana: SolanaService,
    private readonly withdrawals: WithdrawalsService,
  ) {}

  // ── Reads ───────────────────────────────────────────────────────────────

  async list(opts: {
    status?: WithdrawalStatus;
    search?: string;
    from?: string;
    to?: string;
    skip?: string;
    take?: string;
  }) {
    const take = Math.min(Math.max(Number(opts.take) || 25, 1), 100);
    const skip = Math.max(Number(opts.skip) || 0, 0);

    const where: Prisma.WithdrawalRequestWhereInput = {};
    if (opts.status) where.status = opts.status;

    const q = opts.search?.trim();
    if (q) {
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { walletAddress: { contains: q, mode: 'insensitive' } },
        { transactionSignature: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { username: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // Date filter (§16). `to` is treated as inclusive of the whole day, which is
    // what a date picker implies.
    const createdAt: Prisma.DateTimeFilter = {};
    if (opts.from) {
      const d = new Date(opts.from);
      if (!Number.isNaN(d.getTime())) createdAt.gte = d;
    }
    if (opts.to) {
      const d = new Date(opts.to);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        createdAt.lte = d;
      }
    }
    if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;

    const [total, rows, byStatus, paidTotals, pendingTotals] =
      await Promise.all([
        this.prisma.withdrawalRequest.count({ where }),
        this.prisma.withdrawalRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                username: true,
                coins: true,
              },
            },
          },
        }),
        // Counts ignore the status filter so picking "Pending" does not zero the
        // other tiles — same convention as the predictions and points lists.
        this.prisma.withdrawalRequest.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.withdrawalRequest.aggregate({
          where: { status: WithdrawalStatus.COMPLETED },
          _sum: { points: true, amount: true },
          _count: { _all: true },
        }),
        this.prisma.withdrawalRequest.aggregate({
          where: { reserved: true },
          _sum: { points: true, amount: true },
          _count: { _all: true },
        }),
      ]);

    const statusCounts: Record<string, number> = {};
    for (const r of byStatus) statusCounts[r.status] = r._count._all;

    return {
      total,
      skip,
      take,
      statusCounts,
      totals: {
        completedRequests: paidTotals._count._all,
        pointsPaid: paidTotals._sum.points ?? 0,
        amountPaid: paidTotals._sum.amount?.toString() ?? '0',
        openRequests: pendingTotals._count._all,
        pointsReserved: pendingTotals._sum.points ?? 0,
        amountReserved: pendingTotals._sum.amount?.toString() ?? '0',
        tokenSymbol: publicWithdrawalToken().tokenSymbol,
      },
      items: rows.map((r) => ({
        ...this.withdrawals.publicRow(r),
        user: r.user,
        adminId: r.adminId,
      })),
    };
  }

  async getOne(id: string) {
    const row = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            coins: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Withdrawal request not found');

    // The ledger entry this withdrawal produced, so an admin sees the debit
    // itself rather than inferring it.
    const txn = await this.prisma.coinTransaction.findFirst({
      where: { referenceId: row.id, type: CoinTxnType.WITHDRAWAL },
      select: {
        id: true,
        amount: true,
        balanceAfter: true,
        createdAt: true,
        description: true,
      },
    });

    // What the user could withdraw right now, for context on the decision.
    const availability = await this.withdrawals.availability(row.userId);

    return {
      ...this.withdrawals.publicRow(row),
      user: row.user,
      adminId: row.adminId,
      coinTransaction: txn
        ? { ...txn, createdAt: txn.createdAt.toISOString() }
        : null,
      userAvailability: {
        totalPoints: availability.totalPoints,
        withdrawablePoints: availability.withdrawablePoints,
        reservedPoints: availability.reservedPoints,
        availableToWithdraw: availability.availableToWithdraw,
      },
    };
  }

  /** Deployment health for the admin panel. */
  async status() {
    const [rules, enabled, luckyWithdrawable, liveNetwork] = await Promise.all([
      this.economy.getRules(),
      this.economy.withdrawalsEnabled(),
      this.economy.withdrawableLuckyBonus(),
      this.solana.network(),
    ]);
    const configError = this.withdrawals.configError();
    const token = publicWithdrawalToken();

    return {
      enabled: enabled && configError == null,
      adminEnabled: enabled,
      configError,
      rpcReachable: liveNetwork != null,
      rpcNetwork: liveNetwork,
      networkMatches: liveNetwork === SOLANA_NETWORK,
      network: {
        network: SOLANA_NETWORK,
        // Same key the points status uses, so the two payloads describe the
        // cluster identically rather than with two names for one thing.
        networkName: SOLANA_NETWORK_NAME,
        ...token,
      },
      rules: {
        pointsPerToken: rules.usdcToPoints,
        minWithdrawalPoints: rules.minWithdrawalPoints,
        luckyBonusWithdrawable: luckyWithdrawable,
      },
    };
  }

  // ── Decisions ───────────────────────────────────────────────────────────

  /**
   * PENDING → APPROVED (§18).
   *
   * Deliberately does not mark the request completed or move any money: approval
   * only authorises the payout. The points stay reserved.
   */
  async approve(adminId: string, id: string, dto: ApproveWithdrawalDto) {
    const row = await this.require(id);
    if (row.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException({
        error: 'NOT_PENDING',
        message: `Only a pending request can be approved (this one is ${row.status}).`,
      });
    }

    const claimed = await this.prisma.withdrawalRequest.updateMany({
      where: { id, status: WithdrawalStatus.PENDING },
      data: {
        status: WithdrawalStatus.APPROVED,
        approvedAt: new Date(),
        adminId,
        adminNote: dto.adminNote?.trim() || null,
      },
    });
    if (claimed.count === 0) {
      throw new ConflictException({
        error: 'ALREADY_ACTIONED',
        message: 'That request has already been actioned.',
      });
    }

    const fresh = await this.require(id);
    await this.withdrawals.audit('WITHDRAWAL_APPROVED', adminId, fresh, {});
    await this.withdrawals.notify(
      fresh.userId,
      'Withdrawal approved',
      `Your withdrawal request for ${fresh.points.toLocaleString('en-US')} points (${fresh.amount.toString()} ${fresh.tokenSymbol}) has been approved and is being processed.`,
      fresh.id,
    );
    return this.withdrawals.publicRow(fresh);
  }

  /** APPROVED → PROCESSING, i.e. "the transfer is being sent". */
  async markProcessing(adminId: string, id: string) {
    const row = await this.require(id);
    if (
      row.status !== WithdrawalStatus.APPROVED &&
      row.status !== WithdrawalStatus.FAILED
    ) {
      throw new BadRequestException({
        error: 'NOT_APPROVED',
        message: `Only an approved or failed request can be moved to processing (this one is ${row.status}).`,
      });
    }

    const claimed = await this.prisma.withdrawalRequest.updateMany({
      where: {
        id,
        status: { in: [WithdrawalStatus.APPROVED, WithdrawalStatus.FAILED] },
      },
      data: { status: WithdrawalStatus.PROCESSING, adminId, reserved: true },
    });
    if (claimed.count === 0) {
      throw new ConflictException({
        error: 'ALREADY_ACTIONED',
        message: 'That request has already been actioned.',
      });
    }

    const fresh = await this.require(id);
    await this.withdrawals.audit('WITHDRAWAL_PROCESSING', adminId, fresh, {});
    return this.withdrawals.publicRow(fresh);
  }

  /**
   * Records the payout and debits the points (§22, §26).
   *
   * The transaction hash is verified against the chain first — recipient, token,
   * amount, sender and success all read back — and only then does the ledger get
   * its single WITHDRAWAL row. An unverifiable hash leaves the request exactly as
   * it was, so nothing is lost and the admin can retry.
   */
  async complete(adminId: string, id: string, dto: CompleteWithdrawalDto) {
    const row = await this.require(id);
    if (row.status === WithdrawalStatus.COMPLETED) {
      // Idempotent: replaying a completion returns the same result rather than
      // debiting twice.
      return { ...this.withdrawals.publicRow(row), alreadyCompleted: true };
    }
    if (
      row.status !== WithdrawalStatus.APPROVED &&
      row.status !== WithdrawalStatus.PROCESSING &&
      row.status !== WithdrawalStatus.FAILED
    ) {
      throw new BadRequestException({
        error: 'NOT_APPROVED',
        message: `A withdrawal must be approved before it can be completed (this one is ${row.status}).`,
      });
    }

    // Trimmed but NOT lower-cased — a Solana signature is case-sensitive base58.
    const signature = dto.transactionSignature.trim();

    // Reject a hash already used by another request before touching the chain —
    // the unique index is the real guard, this is the friendly message.
    const existing = await this.prisma.withdrawalRequest.findUnique({
      where: { transactionSignature: signature },
    });
    if (existing && existing.id !== row.id) {
      throw new ConflictException({
        error: 'TRANSACTION_ALREADY_USED',
        message: 'That transaction has already settled another withdrawal.',
      });
    }

    const result = await this.solana.verifyPayout({
      signature,
      // The mint snapshotted on the row, not the current config: a request must
      // be settled in the token it was actually denominated in, even if the
      // payout token has been repointed since.
      mint: row.tokenMint,
      decimals: row.tokenDecimals,
      // Any authorised treasury wallet, since payouts are signed by an admin
      // in their own wallet rather than by one shared account.
      expectedFrom: WITHDRAWAL_TREASURY_ADDRESSES,
      expectedTo: row.walletAddress,
      expectedAmountRaw: BigInt(row.amountRaw),
    });

    if (!result.ok) {
      // Transient problems leave the request untouched so it can be retried.
      if (
        result.reason === 'TX_PENDING' ||
        result.reason === 'TX_NOT_FOUND' ||
        result.reason === 'INSUFFICIENT_CONFIRMATIONS' ||
        result.reason === 'RPC_ERROR'
      ) {
        throw new BadRequestException({
          error: result.reason,
          message: result.message,
          pending: true,
        });
      }
      throw new BadRequestException({
        error: result.reason,
        message: result.message,
      });
    }

    try {
      const balance = await this.prisma.$transaction(async (tx) => {
        // Claim the row conditionally: whichever concurrent completion wins this
        // update is the only one that debits.
        const claimed = await tx.withdrawalRequest.updateMany({
          where: {
            id,
            completedAt: null,
            status: { not: WithdrawalStatus.COMPLETED },
          },
          data: {
            status: WithdrawalStatus.COMPLETED,
            reserved: false,
            transactionSignature: signature,
            blockNumber: result.blockNumber,
            completedAt: new Date(),
            adminId,
            adminNote: null,
          },
        });
        if (claimed.count === 0) {
          throw new ConflictException({
            error: 'ALREADY_COMPLETED',
            message: 'That withdrawal has already been completed.',
          });
        }

        // The one and only ledger entry for this withdrawal.
        return this.economy.applyTxn(
          tx,
          row.userId,
          CoinTxnType.WITHDRAWAL,
          -row.points,
          {
            referenceId: row.id,
            description: `${row.points.toLocaleString('en-US')} points withdrawn for ${row.amount.toString()} ${row.tokenSymbol}`,
          },
        );
      });

      const fresh = await this.require(id);
      await this.withdrawals.audit('WITHDRAWAL_COMPLETED', adminId, fresh, {
        balanceAfter: balance,
      });
      await this.withdrawals.notify(
        fresh.userId,
        'Withdrawal completed',
        `Your withdrawal of ${fresh.points.toLocaleString('en-US')} points → ${fresh.amount.toString()} ${fresh.tokenSymbol} has been completed.`,
        fresh.id,
      );
      this.logger.log(
        `Withdrawal ${id} completed: -${row.points} points, ${row.amount.toString()} ${row.tokenSymbol}, tx ${signature}`,
      );
      return {
        ...this.withdrawals.publicRow(fresh),
        balance,
        alreadyCompleted: false,
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          error: 'TRANSACTION_ALREADY_USED',
          message: 'That transaction has already settled another withdrawal.',
        });
      }
      throw err;
    }
  }

  /**
   * Rejects a request and releases the reservation (§23).
   *
   * No ledger entry is written or reversed, because none was ever made — the
   * points were reserved, not debited. They become withdrawable again the moment
   * `reserved` clears.
   */
  async reject(adminId: string, id: string, dto: RejectWithdrawalDto) {
    const row = await this.require(id);
    if (
      row.status === WithdrawalStatus.COMPLETED ||
      row.status === WithdrawalStatus.REJECTED ||
      row.status === WithdrawalStatus.CANCELLED
    ) {
      throw new BadRequestException({
        error: 'NOT_REJECTABLE',
        message: `A ${row.status.toLowerCase()} request cannot be rejected.`,
      });
    }

    const claimed = await this.prisma.withdrawalRequest.updateMany({
      where: {
        id,
        status: {
          in: [
            WithdrawalStatus.PENDING,
            WithdrawalStatus.APPROVED,
            WithdrawalStatus.PROCESSING,
            WithdrawalStatus.FAILED,
          ],
        },
      },
      data: {
        status: WithdrawalStatus.REJECTED,
        reserved: false,
        rejectedAt: new Date(),
        adminId,
        adminNote: dto.reason.trim(),
      },
    });
    if (claimed.count === 0) {
      throw new ConflictException({
        error: 'ALREADY_ACTIONED',
        message: 'That request has already been actioned.',
      });
    }

    const fresh = await this.require(id);
    await this.withdrawals.audit('WITHDRAWAL_REJECTED', adminId, fresh, {
      reason: dto.reason.trim(),
    });
    await this.withdrawals.notify(
      fresh.userId,
      'Withdrawal rejected',
      `Your withdrawal request was rejected: ${dto.reason.trim()} Your ${fresh.points.toLocaleString('en-US')} points are available again.`,
      fresh.id,
    );
    return this.withdrawals.publicRow(fresh);
  }

  /**
   * Marks a payout attempt as failed (§24).
   *
   * Keeps the points reserved: the money has not been sent, but the request is
   * still live and an admin can retry it. Losing the reservation here would let
   * the user spend points that are still earmarked for a payout in flight.
   */
  async fail(adminId: string, id: string, dto: FailWithdrawalDto) {
    const row = await this.require(id);
    if (row.status === WithdrawalStatus.COMPLETED) {
      throw new BadRequestException({
        error: 'ALREADY_COMPLETED',
        message: 'A completed withdrawal cannot be marked failed.',
      });
    }

    const claimed = await this.prisma.withdrawalRequest.updateMany({
      where: {
        id,
        status: {
          in: [
            WithdrawalStatus.APPROVED,
            WithdrawalStatus.PROCESSING,
            WithdrawalStatus.PENDING,
          ],
        },
      },
      data: {
        status: WithdrawalStatus.FAILED,
        // Still reserved: the request is retryable, so its points stay held.
        reserved: true,
        adminId,
        adminNote: dto.reason.trim(),
      },
    });
    if (claimed.count === 0) {
      throw new ConflictException({
        error: 'ALREADY_ACTIONED',
        message: 'That request has already been actioned.',
      });
    }

    const fresh = await this.require(id);
    await this.withdrawals.audit('WITHDRAWAL_FAILED', adminId, fresh, {
      reason: dto.reason.trim(),
    });
    await this.withdrawals.notify(
      fresh.userId,
      'Withdrawal could not be completed',
      `Your withdrawal could not be completed: ${dto.reason.trim()} Your points are still reserved while we look into it.`,
      fresh.id,
    );
    return this.withdrawals.publicRow(fresh);
  }

  private async require(id: string): Promise<WithdrawalRequest> {
    const row = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Withdrawal request not found');
    return row;
  }

  /** Explorer link helper for CSV export. */
  explorerUrl(hash: string | null): string | null {
    return hash ? explorerTxUrl(hash) : null;
  }
}
