import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  CoinTxnType,
  PointPurchaseStatus,
  Prisma,
  type PointPurchase,
} from '@prisma/client';
import { formatUnits, parseUnits } from '../blockchain/format';
import { PrismaService } from '../prisma/prisma.service';
import { EconomyService } from '../economy/economy.service';
import { SolanaService } from '../blockchain/solana.service';
import {
  SOLANA_NETWORK,
  SOLANA_NETWORK_NAME,
  SOLANA_USDC_MINT,
  SOLANA_USDC_DECIMALS,
  POINTS_PURCHASE_RECEIVER_ADDRESS,
  explorerTxUrl,
  publicChainConfig,
} from '../blockchain/solana-chain';
import { isSolanaAddress } from '../blockchain/solana-address';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { ConfirmPurchaseDto } from './dto/confirm-purchase.dto';

/** How long a PENDING intent stays valid before the sweeper expires it. */
const INTENT_TTL_MINUTES = Number(
  process.env.POINTS_PURCHASE_TTL_MINUTES ?? 30,
);

@Injectable()
export class PointsPurchaseService {
  private readonly logger = new Logger('PointsPurchase');

  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly solana: SolanaService,
  ) {}

  // ── Public configuration ────────────────────────────────────────────────

  /**
   * Everything the frontend needs to render the Buy Points flow: the network to
   * be on, the token and address to pay, the live rate and the bounds.
   *
   * `enabled` folds together the admin switch and whether the server is
   * actually configured, so the UI has one flag to check rather than having to
   * reason about deployment state.
   */
  async config() {
    const [rules, adminEnabled] = await Promise.all([
      this.economy.getRules(),
      this.economy.pointsPurchaseEnabled(),
    ]);
    const configError = this.solana.configError();

    return {
      enabled: adminEnabled && configError == null,
      /** Set when the operator still has configuration to fill in. */
      unavailableReason:
        configError ??
        (adminEnabled ? null : 'Buying points is currently turned off.'),
      network: publicChainConfig(),
      rate: {
        usdcToPoints: rules.usdcToPoints,
        minUsdc: rules.pointsMinPurchaseUsdc,
        maxUsdc: rules.pointsMaxPurchaseUsdc,
      },
    };
  }

  // ── Intent ──────────────────────────────────────────────────────────────

  /**
   * Creates a PENDING purchase (§15). The server fixes the amount, the rate and
   * the points here, before the wallet signs anything — so the client can never
   * later assert what it is owed.
   */
  async createIntent(userId: string, dto: CreatePurchaseDto) {
    const configError = this.solana.configError();
    if (configError) {
      throw new BadRequestException({
        error: 'PURCHASE_UNAVAILABLE',
        message: configError,
      });
    }
    if (!(await this.economy.pointsPurchaseEnabled())) {
      throw new ForbiddenException({
        error: 'PURCHASE_DISABLED',
        message: 'Buying points is currently turned off.',
      });
    }

    // Trimmed but NOT lower-cased: Solana addresses are case-sensitive base58,
    // so normalising case here would store a different, invalid key and the
    // on-chain sender could never match it (§22).
    const wallet = dto.walletAddress.trim();
    if (!isSolanaAddress(wallet)) {
      throw new BadRequestException({
        error: 'INVALID_WALLET',
        message: 'That is not a valid Solana wallet address.',
      });
    }

    const rules = await this.economy.getRules();

    // Token units, never floats (§17).
    //
    // parseUnits ROUNDS anything beyond the token's precision rather than
    // failing — "1.9999999" would silently become 2 USDC — so excess decimals
    // are rejected up front. The user must be quoted exactly what they typed,
    // because that is the amount they will be asked to pay.
    const amountText = dto.usdcAmount.trim();
    const decimals = amountText.split('.')[1]?.length ?? 0;
    if (decimals > SOLANA_USDC_DECIMALS) {
      throw new BadRequestException({
        error: 'TOO_MANY_DECIMALS',
        message: `USDC supports at most ${SOLANA_USDC_DECIMALS} decimal places.`,
      });
    }

    let amountRaw: bigint;
    try {
      amountRaw = parseUnits(amountText, SOLANA_USDC_DECIMALS);
    } catch {
      throw new BadRequestException({
        error: 'INVALID_AMOUNT',
        message: 'Enter a valid USDC amount.',
      });
    }
    if (amountRaw <= 0n) {
      throw new BadRequestException({
        error: 'INVALID_AMOUNT',
        message: 'Enter a USDC amount greater than zero.',
      });
    }

    const minRaw = parseUnits(
      String(rules.pointsMinPurchaseUsdc),
      SOLANA_USDC_DECIMALS,
    );
    const maxRaw = parseUnits(
      String(rules.pointsMaxPurchaseUsdc),
      SOLANA_USDC_DECIMALS,
    );
    if (amountRaw < minRaw) {
      throw new BadRequestException({
        error: 'BELOW_MINIMUM',
        message: `The minimum purchase is ${rules.pointsMinPurchaseUsdc} USDC.`,
      });
    }
    if (amountRaw > maxRaw) {
      throw new BadRequestException({
        error: 'ABOVE_MAXIMUM',
        message: `The maximum purchase is ${rules.pointsMaxPurchaseUsdc} USDC.`,
      });
    }

    const points = pointsFor(amountRaw, rules.usdcToPoints);
    if (points <= 0) {
      throw new BadRequestException({
        error: 'AMOUNT_TOO_SMALL',
        message: 'That amount is too small to earn any points.',
      });
    }

    const purchase = await this.prisma.pointPurchase.create({
      data: {
        userId,
        walletAddress: wallet,
        amountUsdcRaw: amountRaw.toString(),
        amountUsdc: new Prisma.Decimal(
          formatUnits(amountRaw, SOLANA_USDC_DECIMALS),
        ),
        points,
        exchangeRate: rules.usdcToPoints,
        network: SOLANA_NETWORK,
        tokenMint: SOLANA_USDC_MINT,
        receiverAddress: POINTS_PURCHASE_RECEIVER_ADDRESS,
        expiresAt: new Date(Date.now() + INTENT_TTL_MINUTES * 60_000),
      },
    });

    return this.intentPayload(purchase);
  }

  // ── Confirmation ────────────────────────────────────────────────────────

  /**
   * Verifies the on-chain payment and credits points (§16, §21).
   *
   * The client contributes only a transaction hash. Every figure that matters is
   * read back from Solana; the quoted amount is treated as a maximum, and what
   * actually arrived is what gets paid for.
   */
  async confirm(userId: string, purchaseId: string, dto: ConfirmPurchaseDto) {
    const purchase = await this.prisma.pointPurchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    // Scoped to the owner so one user cannot settle another's intent.
    if (purchase.userId !== userId) {
      throw new ForbiddenException({
        error: 'NOT_YOUR_PURCHASE',
        message: 'That purchase belongs to another account.',
      });
    }

    if (purchase.status === PointPurchaseStatus.CONFIRMED) {
      // Idempotent: replaying a confirm returns the same result instead of
      // crediting again.
      return { ...this.publicPurchase(purchase), alreadyConfirmed: true };
    }
    if (
      purchase.status === PointPurchaseStatus.CANCELLED ||
      purchase.status === PointPurchaseStatus.EXPIRED
    ) {
      throw new BadRequestException({
        error: 'PURCHASE_CLOSED',
        message: 'That purchase is no longer open. Please start a new one.',
      });
    }

    // Trimmed but NOT lower-cased — a signature is case-sensitive base58, and a
    // lower-cased one simply does not resolve on the cluster.
    const signature = dto.transactionSignature.trim();

    // Reject a hash already used by any purchase before touching the chain —
    // the unique index is the real guard, this is the friendly message.
    const existing = await this.prisma.pointPurchase.findUnique({
      where: { transactionSignature: signature },
    });
    if (existing && existing.id !== purchase.id) {
      throw new ConflictException({
        error: 'TRANSACTION_ALREADY_USED',
        message: 'That transaction has already been credited.',
      });
    }

    const result = await this.solana.verifyPayment(signature, purchase.walletAddress);

    if (!result.ok) {
      // Still-pending and RPC problems are transient: leave the purchase open so
      // the client can retry, and record nothing.
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

      await this.prisma.pointPurchase.update({
        where: { id: purchase.id },
        data: {
          status: PointPurchaseStatus.FAILED,
          failureReason: result.detail
            ? `${result.message} (${result.detail})`
            : result.message,
        },
      });
      throw new BadRequestException({
        error: result.reason,
        message: result.message,
      });
    }

    // The chain is the authority on the amount (§8). A payment larger than
    // quoted still only earns what was actually sent; a smaller one earns less.
    const paidRaw = result.amountRaw;
    const creditedPoints = pointsFor(paidRaw, purchase.exchangeRate);
    if (creditedPoints <= 0) {
      await this.prisma.pointPurchase.update({
        where: { id: purchase.id },
        data: {
          status: PointPurchaseStatus.FAILED,
          transactionSignature: signature,
          failureReason: 'The amount paid was too small to earn any points.',
        },
      });
      throw new BadRequestException({
        error: 'AMOUNT_TOO_SMALL',
        message: 'The amount paid was too small to earn any points.',
      });
    }

    try {
      const balance = await this.prisma.$transaction(async (tx) => {
        // Claim the purchase conditionally: whichever concurrent confirm wins
        // this update is the only one that credits (§21).
        const claimed = await tx.pointPurchase.updateMany({
          where: {
            id: purchase.id,
            completedAt: null,
            status: PointPurchaseStatus.PENDING,
          },
          data: {
            status: PointPurchaseStatus.CONFIRMED,
            transactionSignature: signature,
            amountUsdcRaw: paidRaw.toString(),
            amountUsdc: new Prisma.Decimal(
              formatUnits(paidRaw, SOLANA_USDC_DECIMALS),
            ),
            points: creditedPoints,
            blockNumber: result.blockNumber,
            completedAt: new Date(),
            failureReason: null,
          },
        });
        if (claimed.count === 0) {
          throw new ConflictException({
            error: 'ALREADY_CONFIRMED',
            message: 'That purchase has already been credited.',
          });
        }

        const usdcLabel = formatUnits(paidRaw, SOLANA_USDC_DECIMALS);
        return this.economy.applyTxn(
          tx,
          userId,
          CoinTxnType.POINT_PURCHASE,
          creditedPoints,
          {
            referenceId: purchase.id,
            description: `Purchased ${creditedPoints.toLocaleString('en-US')} points with ${usdcLabel} USDC`,
          },
        );
      });

      const fresh = await this.prisma.pointPurchase.findUnique({
        where: { id: purchase.id },
      });
      this.logger.log(
        `Credited ${creditedPoints} points to ${userId} for ${formatUnits(paidRaw, SOLANA_USDC_DECIMALS)} USDC (${result.via}, tx ${signature})`,
      );
      return {
        ...this.publicPurchase(fresh!),
        balance,
        alreadyConfirmed: false,
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          error: 'TRANSACTION_ALREADY_USED',
          message: 'That transaction has already been credited.',
        });
      }
      throw err;
    }
  }

  /** Lets a user abandon an intent they never paid. */
  async cancel(userId: string, purchaseId: string) {
    const purchase = await this.prisma.pointPurchase.findFirst({
      where: { id: purchaseId, userId },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    if (purchase.status !== PointPurchaseStatus.PENDING) {
      throw new BadRequestException({
        error: 'PURCHASE_CLOSED',
        message: 'Only a pending purchase can be cancelled.',
      });
    }
    const updated = await this.prisma.pointPurchase.update({
      where: { id: purchase.id },
      data: { status: PointPurchaseStatus.CANCELLED },
    });
    return this.publicPurchase(updated);
  }

  // ── Reads ───────────────────────────────────────────────────────────────

  async getOne(userId: string, purchaseId: string) {
    const purchase = await this.prisma.pointPurchase.findFirst({
      where: { id: purchaseId, userId },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    return this.publicPurchase(purchase);
  }

  async history(userId: string, opts: { skip?: string; take?: string } = {}) {
    const take = Math.min(Math.max(Number(opts.take) || 20, 1), 100);
    const skip = Math.max(Number(opts.skip) || 0, 0);

    const [total, rows, totals] = await this.prisma.$transaction([
      this.prisma.pointPurchase.count({ where: { userId } }),
      this.prisma.pointPurchase.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.pointPurchase.aggregate({
        where: { userId, status: PointPurchaseStatus.CONFIRMED },
        _sum: { points: true, amountUsdc: true },
      }),
    ]);

    return {
      total,
      skip,
      take,
      totals: {
        pointsPurchased: totals._sum.points ?? 0,
        usdcSpent: totals._sum.amountUsdc?.toString() ?? '0',
      },
      items: rows.map((r) => this.publicPurchase(r)),
    };
  }

  /** Balance plus purchase totals — the Points/Wallet area's header. */
  async balance(userId: string) {
    const [user, totals] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { coins: true },
      }),
      this.prisma.pointPurchase.aggregate({
        where: { userId, status: PointPurchaseStatus.CONFIRMED },
        _sum: { points: true, amountUsdc: true },
      }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    return {
      balance: user.coins,
      purchasedPoints: totals._sum.points ?? 0,
      usdcSpent: totals._sum.amountUsdc?.toString() ?? '0',
    };
  }

  // ── Housekeeping ────────────────────────────────────────────────────────

  /**
   * Expires stale intents. Purely cosmetic — an expired intent has no financial
   * effect, it just stops "pending" rows accumulating in the user's history.
   */
  @Cron('*/5 * * * *')
  async expireStaleIntents() {
    const res = await this.prisma.pointPurchase.updateMany({
      where: {
        status: PointPurchaseStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      data: { status: PointPurchaseStatus.EXPIRED },
    });
    if (res.count > 0) {
      this.logger.log(`Expired ${res.count} stale purchase intent(s)`);
    }
  }

  // ── Shapes ──────────────────────────────────────────────────────────────

  /** What the frontend needs to send the payment. */
  private intentPayload(p: PointPurchase) {
    return {
      purchaseId: p.id,
      usdcAmount: p.amountUsdc.toString(),
      /** Smallest-unit amount to pass straight to the contract call. */
      usdcAmountRaw: p.amountUsdcRaw,
      points: p.points,
      exchangeRate: p.exchangeRate,
      network: p.network,
      tokenMint: p.tokenMint,
      tokenDecimals: SOLANA_USDC_DECIMALS,
      receiverAddress: p.receiverAddress,
      networkName: SOLANA_NETWORK_NAME,
      expiresAt: p.expiresAt.toISOString(),
      status: p.status,
    };
  }

  private publicPurchase(p: PointPurchase) {
    return {
      id: p.id,
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
      completedAt: p.completedAt?.toISOString() ?? null,
      expiresAt: p.expiresAt.toISOString(),
    };
  }
}

/**
 * Points for a smallest-unit USDC amount, computed in integer arithmetic and
 * floored — no floating point anywhere (§17), so the same input always yields
 * the same points and a fraction of a point is never invented.
 */
export function pointsFor(amountRaw: bigint, rate: number): number {
  const scale = 10n ** BigInt(SOLANA_USDC_DECIMALS);
  return Number((amountRaw * BigInt(Math.trunc(rate))) / scale);
}
