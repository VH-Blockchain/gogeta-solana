import { ApiClient } from '@/core/network/apiClient';

/**
 * Cashing points out. Mirrors pointsRepository's conventions: envelopes declared
 * here, JSON mapped locally, amounts kept as strings.
 *
 * Nothing in here computes eligibility or a payout — `/withdrawals/available`
 * is the single source of truth for both, so the UI cannot disagree with the
 * server about what a user is owed.
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

export type WithdrawalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED';

const status = (v: unknown): WithdrawalStatus => {
  const s = String(v);
  return s === 'APPROVED' ||
    s === 'PROCESSING' ||
    s === 'COMPLETED' ||
    s === 'REJECTED' ||
    s === 'FAILED' ||
    s === 'CANCELLED'
    ? s
    : 'PENDING';
};

/** The withdrawable breakdown the profile renders. */
export interface WithdrawalAvailability {
  totalPoints: number;
  withdrawablePoints: number;
  reservedPoints: number;
  availableToWithdraw: number;
  minimumWithdrawal: number;
  /** Points per whole token — the same rate purchases use. */
  pointsPerToken: number;
  openRequests: number;
  canWithdraw: boolean;
  enabled: boolean;
  unavailableReason: string | null;
  /** Payout for the full available amount, as a decimal string. */
  previewAmount: string;
  network: {
    /** Cluster moniker, e.g. `devnet`. */
    network: string;
    /** Human label, e.g. `Solana Devnet`. */
    networkName: string;
    /** The SPL mint payouts are denominated in. */
    tokenMint: string;
    tokenSymbol: string;
    tokenDecimals: number;
    treasuryAddress: string;
  };
  /** Which ledger types count toward the withdrawable pool. */
  withdrawableSources: string[];
}

export interface WithdrawalRequest {
  id: string;
  walletAddress: string;
  points: number;
  amount: string;
  exchangeRate: number;
  network: string;
  networkName: string;
  tokenMint: string;
  tokenSymbol: string;
  tokenDecimals: number;
  status: WithdrawalStatus;
  reserved: boolean;
  userNote: string | null;
  /** The admin's reason on a rejection or failure. */
  adminNote: string | null;
  transactionSignature: string | null;
  explorerUrl: string | null;
  createdAtMs: number;
  approvedAtMs: number | null;
  rejectedAtMs: number | null;
  completedAtMs: number | null;
}

export interface WithdrawalHistory {
  total: number;
  totals: { pointsWithdrawn: number; amountPaid: string; tokenSymbol: string };
  items: WithdrawalRequest[];
}

function requestFromApi(j: Record<string, any>): WithdrawalRequest {
  return {
    id: str(j.id),
    walletAddress: str(j.walletAddress),
    points: int(j.points),
    amount: str(j.amount, '0'),
    exchangeRate: int(j.exchangeRate),
    network: str(j.network, 'devnet'),
    networkName: str(j.networkName, 'Solana Devnet'),
    tokenMint: str(j.tokenMint),
    tokenSymbol: str(j.tokenSymbol, 'USDC'),
    tokenDecimals: int(j.tokenDecimals, 6),
    status: status(j.status),
    reserved: j.reserved === true,
    userNote: j.userNote != null ? str(j.userNote) : null,
    adminNote: j.adminNote != null ? str(j.adminNote) : null,
    transactionSignature:
      j.transactionSignature != null ? str(j.transactionSignature) : null,
    explorerUrl: j.explorerUrl != null ? str(j.explorerUrl) : null,
    createdAtMs: ms(j.createdAt),
    approvedAtMs: msOrNull(j.approvedAt),
    rejectedAtMs: msOrNull(j.rejectedAt),
    completedAtMs: msOrNull(j.completedAt),
  };
}

export const WithdrawalsRepository = {
  async available(): Promise<WithdrawalAvailability> {
    const m: any = await ApiClient.get('/withdrawals/available');
    const n = m?.network ?? {};
    return {
      totalPoints: int(m?.totalPoints),
      withdrawablePoints: int(m?.withdrawablePoints),
      reservedPoints: int(m?.reservedPoints),
      availableToWithdraw: int(m?.availableToWithdraw),
      minimumWithdrawal: int(m?.minimumWithdrawal, 1000),
      pointsPerToken: int(m?.pointsPerToken, 100),
      openRequests: int(m?.openRequests),
      canWithdraw: m?.canWithdraw === true,
      enabled: m?.enabled === true,
      unavailableReason: m?.unavailableReason != null ? str(m.unavailableReason) : null,
      previewAmount: str(m?.previewAmount, '0'),
      network: {
        network: str(n.network, 'devnet'),
        networkName: str(n.networkName, 'Solana Devnet'),
        tokenMint: str(n.tokenMint),
        tokenSymbol: str(n.tokenSymbol, 'USDC'),
        tokenDecimals: int(n.tokenDecimals, 6),
        treasuryAddress: str(n.treasuryAddress),
      },
      withdrawableSources: Array.isArray(m?.withdrawableSources)
        ? m.withdrawableSources.map((x: unknown) => str(x))
        : [],
    };
  },

  /**
   * Requests a withdrawal. Sends only the point count, the destination wallet
   * and an optional note — the payout and rate come back from the server.
   */
  async create(
    points: number,
    walletAddress: string,
    userNote?: string,
  ): Promise<WithdrawalRequest> {
    return requestFromApi(
      (await ApiClient.post('/withdrawals', {
        points,
        walletAddress,
        ...(userNote ? { userNote } : {}),
      })) as Record<string, any>,
    );
  },

  async cancel(id: string): Promise<WithdrawalRequest> {
    return requestFromApi(
      (await ApiClient.post(`/withdrawals/${id}/cancel`)) as Record<string, any>,
    );
  },

  async history(opts: { skip?: number; take?: number } = {}): Promise<WithdrawalHistory> {
    const params: Record<string, string> = {};
    if (opts.skip != null) params.skip = String(opts.skip);
    if (opts.take != null) params.take = String(opts.take);

    const m: any = await ApiClient.get('/withdrawals', params);
    return {
      total: int(m?.total),
      totals: {
        pointsWithdrawn: int(m?.totals?.pointsWithdrawn),
        amountPaid: str(m?.totals?.amountPaid, '0'),
        tokenSymbol: str(m?.totals?.tokenSymbol, 'USDC'),
      },
      items: (Array.isArray(m?.items) ? m.items : []).map((j: Record<string, any>) =>
        requestFromApi(j),
      ),
    };
  },
};
