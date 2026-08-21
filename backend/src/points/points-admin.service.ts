import { Injectable } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { PointPurchaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EconomyService } from '../economy/economy.service';
import { SolanaService } from '../blockchain/solana.service';
import {
  SOLANA_NETWORK_NAME,
  explorerTxUrl,
  publicChainConfig,
} from '../blockchain/solana-chain';

/**
 * Admin views over points purchases (§13). Read-only by design: an admin can
 * inspect and filter purchases but cannot mark one confirmed by hand — points
 * are only ever credited by verified on-chain payment. Manual corrections go
 * through the existing adjust-coins tool, which leaves its own audit trail.
 */
@Injectable()
export class PointsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly solana: SolanaService,
  ) {}

  async listPurchases(opts: {
    status?: PointPurchaseStatus;
    search?: string;
    skip?: string;
    take?: string;
  }) {
    const take = Math.min(Math.max(Number(opts.take) || 25, 1), 100);
    const skip = Math.max(Number(opts.skip) || 0, 0);

    const where: Prisma.PointPurchaseWhereInput = {};
    if (opts.status) where.status = opts.status;
    const q = opts.search?.trim();
    if (q) {
      where.OR = [
        { walletAddress: { contains: q, mode: 'insensitive' } },
        { transactionSignature: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // Promise.all rather than $transaction([...]): a heterogeneous transaction
    // tuple widens the groupBy/aggregate results to an error type, and these are
    // four independent reads with nothing to keep consistent between them.
    const [total, rows, byStatus, confirmedTotals] = await Promise.all([
      this.prisma.pointPurchase.count({ where }),
      this.prisma.pointPurchase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: {
            select: { id: true, name: true, email: true, username: true },
          },
        },
      }),
      // Counts ignore the status filter so picking "Pending" doesn't zero the
      // other tiles — same convention as the predictions admin list.
      this.prisma.pointPurchase.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.pointPurchase.aggregate({
        where: { status: PointPurchaseStatus.CONFIRMED },
        _sum: { points: true, amountUsdc: true },
        _count: { _all: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) statusCounts[row.status] = row._count._all;

    return {
      total,
      skip,
      take,
      statusCounts,
      totals: {
        confirmedPurchases: confirmedTotals._count._all,
        pointsCredited: confirmedTotals._sum.points ?? 0,
        usdcCollected: confirmedTotals._sum.amountUsdc?.toString() ?? '0',
      },
      items: rows.map((p) => ({
        id: p.id,
        user: {
          id: p.user.id,
          name: p.user.name,
          email: p.user.email,
          username: p.user.username,
        },
        walletAddress: p.walletAddress,
        usdcAmount: p.amountUsdc.toString(),
        points: p.points,
        exchangeRate: p.exchangeRate,
        network: p.network,
        networkName: SOLANA_NETWORK_NAME,
        tokenMint: p.tokenMint,
        receiverAddress: p.receiverAddress,
        transactionSignature: p.transactionSignature,
        explorerUrl: p.transactionSignature
          ? explorerTxUrl(p.transactionSignature)
          : null,
        status: p.status,
        failureReason: p.failureReason,
        blockNumber: p.blockNumber != null ? p.blockNumber.toString() : null,
        createdAt: p.createdAt.toISOString(),
        completedAt: p.completedAt?.toISOString() ?? null,
      })),
    };
  }

  async getPurchase(id: string) {
    const p = await this.prisma.pointPurchase.findUnique({
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
    if (!p) throw new NotFoundException('Purchase not found');

    // The ledger row this purchase produced, so an admin can see the credit
    // itself rather than inferring it.
    const txn = await this.prisma.coinTransaction.findFirst({
      where: { referenceId: p.id, type: 'POINT_PURCHASE' },
      select: {
        id: true,
        amount: true,
        balanceAfter: true,
        createdAt: true,
        description: true,
      },
    });

    return {
      id: p.id,
      user: p.user,
      walletAddress: p.walletAddress,
      usdcAmount: p.amountUsdc.toString(),
      usdcAmountRaw: p.amountUsdcRaw,
      points: p.points,
      exchangeRate: p.exchangeRate,
      network: p.network,
      networkName: SOLANA_NETWORK_NAME,
      tokenMint: p.tokenMint,
      receiverAddress: p.receiverAddress,
      transactionSignature: p.transactionSignature,
      explorerUrl: p.transactionSignature ? explorerTxUrl(p.transactionSignature) : null,
      status: p.status,
      failureReason: p.failureReason,
      blockNumber: p.blockNumber != null ? p.blockNumber.toString() : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      completedAt: p.completedAt?.toISOString() ?? null,
      expiresAt: p.expiresAt.toISOString(),
      coinTransaction: txn
        ? { ...txn, createdAt: txn.createdAt.toISOString() }
        : null,
    };
  }

  /**
   * Deployment health for the admin panel: whether the chain is reachable, and
   * what configuration is still missing. Saves an operator from guessing why
   * purchasing is unavailable.
   */
  async status() {
    const [rules, adminEnabled, liveNetwork] = await Promise.all([
      this.economy.getRules(),
      this.economy.pointsPurchaseEnabled(),
      this.solana.network(),
    ]);
    const configError = this.solana.configError();
    const network = publicChainConfig();

    return {
      enabled: adminEnabled && configError == null,
      adminEnabled,
      configError,
      network,
      rpcReachable: liveNetwork != null,
      rpcNetwork: liveNetwork,
      networkMatches: liveNetwork === network.network,
      rate: {
        usdcToPoints: rules.usdcToPoints,
        minUsdc: rules.pointsMinPurchaseUsdc,
        maxUsdc: rules.pointsMaxPurchaseUsdc,
      },
    };
  }
}
