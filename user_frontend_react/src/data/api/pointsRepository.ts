import { ApiClient } from '@/core/network/apiClient';

/**
 * Buying points with USDC. Mirrors the conventions of the other repositories:
 * envelope types declared here, JSON mapped locally, no model leakage of raw
 * API shapes.
 *
 * USDC amounts stay strings end to end — a JS number cannot hold token units
 * exactly, and the backend re-derives the real figure from the chain anyway.
 */

const int = (v: unknown, fallback = 0): number =>
  typeof v === 'number' ? Math.trunc(v) : fallback;

const str = (v: unknown, fallback = ''): string => (v != null ? String(v) : fallback);

const msOrNull = (v: unknown): number | null => {
  if (v == null) return null;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
};

const ms = (v: unknown): number => msOrNull(v) ?? 0;

export type PointPurchaseStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

/** Network details and limits, all decided server-side. */
export interface PurchaseConfig {
  enabled: boolean;
  /** Why purchasing is off, when it is. */
  unavailableReason: string | null;
  network: {
    /** Cluster moniker, e.g. `devnet`. */
    network: string;
    /** Human label, e.g. `Solana Devnet`. */
    networkName: string;
    rpcUrl: string;
    explorerUrl: string;
    /** The USDC SPL mint the platform accepts. */
    usdcMint: string;
    usdcDecimals: number;
    receiverAddress: string;
  };
  rate: { usdcToPoints: number; minUsdc: number; maxUsdc: number };
}

/** What the wallet needs in order to send the payment. */
export interface PurchaseIntent {
  purchaseId: string;
  usdcAmount: string;
  /** Smallest-unit amount, passed straight to the contract call. */
  usdcAmountRaw: string;
  points: number;
  exchangeRate: number;
  /** Cluster the payment must be made on. */
  network: string;
  /** The SPL mint to send — quoted by the server, never chosen by the client. */
  tokenMint: string;
  tokenDecimals: number;
  receiverAddress: string;
  networkName: string;
  expiresAtMs: number;
  status: PointPurchaseStatus;
}

export interface PointPurchase {
  id: string;
  walletAddress: string;
  usdcAmount: string;
  points: number;
  exchangeRate: number;
  network: string;
  networkName: string;
  tokenMint: string;
  transactionSignature: string | null;
  explorerUrl: string | null;
  status: PointPurchaseStatus;
  failureReason: string | null;
  createdAtMs: number;
  completedAtMs: number | null;
}

export interface PurchaseHistory {
  total: number;
  totals: { pointsPurchased: number; usdcSpent: string };
  items: PointPurchase[];
}

export interface PointsBalance {
  balance: number;
  purchasedPoints: number;
  usdcSpent: string;
}

const status = (v: unknown): PointPurchaseStatus => {
  const s = String(v);
  return s === 'CONFIRMED' || s === 'FAILED' || s === 'EXPIRED' || s === 'CANCELLED'
    ? s
    : 'PENDING';
};

function purchaseFromApi(j: Record<string, any>): PointPurchase {
  return {
    id: str(j.id),
    walletAddress: str(j.walletAddress),
    usdcAmount: str(j.usdcAmount, '0'),
    points: int(j.points),
    exchangeRate: int(j.exchangeRate),
    network: str(j.network, 'devnet'),
    networkName: str(j.networkName, 'Solana Devnet'),
    tokenMint: str(j.tokenMint),
    transactionSignature:
      j.transactionSignature != null ? str(j.transactionSignature) : null,
    explorerUrl: j.explorerUrl != null ? str(j.explorerUrl) : null,
    status: status(j.status),
    failureReason: j.failureReason != null ? str(j.failureReason) : null,
    createdAtMs: ms(j.createdAt),
    completedAtMs: msOrNull(j.completedAt),
  };
}

export const PointsRepository = {
  async purchaseConfig(): Promise<PurchaseConfig> {
    const m: any = await ApiClient.get('/points/purchase-config');
    const n = m?.network ?? {};
    const r = m?.rate ?? {};
    return {
      enabled: m?.enabled === true,
      unavailableReason: m?.unavailableReason != null ? str(m.unavailableReason) : null,
      network: {
        network: str(n.network, 'devnet'),
        networkName: str(n.networkName, 'Solana Devnet'),
        rpcUrl: str(n.rpcUrl),
        explorerUrl: str(n.explorerUrl),
        usdcMint: str(n.usdcMint),
        usdcDecimals: int(n.usdcDecimals, 6),
        receiverAddress: str(n.receiverAddress),
      },
      rate: {
        usdcToPoints: int(r.usdcToPoints, 100),
        minUsdc: int(r.minUsdc, 1),
        maxUsdc: int(r.maxUsdc, 1000),
      },
    };
  },

  async balance(): Promise<PointsBalance> {
    const m: any = await ApiClient.get('/points/balance');
    return {
      balance: int(m?.balance),
      purchasedPoints: int(m?.purchasedPoints),
      usdcSpent: str(m?.usdcSpent, '0'),
    };
  },

  /** Step 1 — the server fixes the amount and the points before any signing. */
  async createIntent(walletAddress: string, usdcAmount: string): Promise<PurchaseIntent> {
    const m: any = await ApiClient.post('/points/purchase/create', {
      walletAddress,
      usdcAmount,
    });
    return {
      purchaseId: str(m?.purchaseId),
      usdcAmount: str(m?.usdcAmount, '0'),
      usdcAmountRaw: str(m?.usdcAmountRaw, '0'),
      points: int(m?.points),
      exchangeRate: int(m?.exchangeRate),
      network: str(m?.network, 'devnet'),
      tokenMint: str(m?.tokenMint),
      tokenDecimals: int(m?.tokenDecimals, 6),
      receiverAddress: str(m?.receiverAddress),
      networkName: str(m?.networkName),
      expiresAtMs: ms(m?.expiresAt),
      status: status(m?.status),
    };
  },

  /**
   * Step 2 — hand the transaction signature over. Deliberately sends nothing
   * else: the mint, the sender, the recipient and the amount are all read off
   * the chain by the backend, never taken from here (§14, §39). The server
   * strips unknown fields anyway, so sending more would be noise at best and a
   * false sense of client authority at worst.
   */
  async confirm(
    purchaseId: string,
    transactionSignature: string,
  ): Promise<PointPurchase & { balance: number; alreadyConfirmed: boolean }> {
    const m: any = await ApiClient.post(`/points/purchase/${purchaseId}/confirm`, {
      transactionSignature,
    });
    return {
      ...purchaseFromApi(m ?? {}),
      balance: int(m?.balance),
      alreadyConfirmed: m?.alreadyConfirmed === true,
    };
  },

  async cancel(purchaseId: string): Promise<PointPurchase> {
    return purchaseFromApi(
      (await ApiClient.post(`/points/purchase/${purchaseId}/cancel`)) as Record<string, any>,
    );
  },

  async getOne(purchaseId: string): Promise<PointPurchase> {
    return purchaseFromApi(
      (await ApiClient.get(`/points/purchase/${purchaseId}`)) as Record<string, any>,
    );
  },

  async history(opts: { skip?: number; take?: number } = {}): Promise<PurchaseHistory> {
    const params: Record<string, string> = {};
    if (opts.skip != null) params.skip = String(opts.skip);
    if (opts.take != null) params.take = String(opts.take);

    const m: any = await ApiClient.get('/points/purchases', params);
    return {
      total: int(m?.total),
      totals: {
        pointsPurchased: int(m?.totals?.pointsPurchased),
        usdcSpent: str(m?.totals?.usdcSpent, '0'),
      },
      items: (Array.isArray(m?.items) ? m.items : []).map((j: Record<string, any>) =>
        purchaseFromApi(j),
      ),
    };
  },
};
