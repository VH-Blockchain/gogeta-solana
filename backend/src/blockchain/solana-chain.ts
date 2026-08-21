/**
 * The one place Solana network configuration lives (§28).
 *
 * Every value is env-overridable so a deployment can be pointed at another
 * cluster without a code change; the defaults describe devnet, which is what the
 * platform runs on today. Nothing else in the codebase should read a
 * `SOLANA_*` variable directly — import from here instead, so there is a single
 * answer to "which mint / which cluster are we on".
 */

/** Cluster moniker, as the wallet adapters and explorer both spell it. */
export const SOLANA_NETWORK = process.env.SOLANA_NETWORK ?? 'devnet';

export const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

/**
 * The USDC SPL mint (§3). Devnet USDC by default — the mint the platform can
 * actually verify against on this cluster.
 */
export const SOLANA_USDC_MINT =
  process.env.SOLANA_USDC_MINT ?? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

/** USDC is 6 decimals on Solana, as on every other chain that carries it. */
export const SOLANA_USDC_DECIMALS = Number(
  process.env.SOLANA_USDC_DECIMALS ?? 6,
);

/** Lamports per SOL — used only to label fees, never to price a payment. */
export const SOLANA_NATIVE_DECIMALS = 9;

/** Where points purchases must be paid. Empty disables buying (see below). */
export const POINTS_PURCHASE_RECEIVER_ADDRESS =
  process.env.POINTS_PURCHASE_RECEIVER_ADDRESS ?? '';

export const SOLANA_EXPLORER_URL =
  process.env.SOLANA_EXPLORER_URL ?? 'https://explorer.solana.com';

/**
 * Human label for the cluster. Derived rather than configured so it can never
 * disagree with `SOLANA_NETWORK` — a panel reading "Devnet" while the backend
 * verifies against mainnet is exactly the confusion worth designing out.
 */
export const SOLANA_NETWORK_NAME = (() => {
  switch (SOLANA_NETWORK) {
    case 'mainnet-beta':
      return 'Solana Mainnet';
    case 'testnet':
      return 'Solana Testnet';
    case 'devnet':
      return 'Solana Devnet';
    default:
      return `Solana (${SOLANA_NETWORK})`;
  }
})();

/**
 * Commitment used for every read. `confirmed` means the transaction has been
 * voted on by a supermajority — settled enough to credit against, and what
 * wallets themselves report success at.
 */
export const SOLANA_COMMITMENT = 'confirmed' as const;

/**
 * Whether a `processed`-only transaction is accepted. Off: a payment is credited
 * once the cluster has confirmed it, not merely seen it.
 */
export const SOLANA_ACCEPT_PROCESSED =
  process.env.SOLANA_ACCEPT_PROCESSED === 'true';

/**
 * Explorer link for a transaction (§29). The `cluster` parameter is what makes a
 * devnet signature actually resolve — without it the explorer looks the
 * signature up on mainnet and reports it missing.
 */
export function explorerTxUrl(signature: string): string {
  const base = `${SOLANA_EXPLORER_URL}/tx/${signature}`;
  return SOLANA_NETWORK === 'mainnet-beta'
    ? base
    : `${base}?cluster=${SOLANA_NETWORK}`;
}

/** Explorer link for an address, for the admin panel's wallet columns. */
export function explorerAddressUrl(address: string): string {
  const base = `${SOLANA_EXPLORER_URL}/address/${address}`;
  return SOLANA_NETWORK === 'mainnet-beta'
    ? base
    : `${base}?cluster=${SOLANA_NETWORK}`;
}

/** The chain details a client needs, and nothing it does not. */
export function publicChainConfig() {
  return {
    network: SOLANA_NETWORK,
    networkName: SOLANA_NETWORK_NAME,
    rpcUrl: SOLANA_RPC_URL,
    explorerUrl: SOLANA_EXPLORER_URL,
    usdcMint: SOLANA_USDC_MINT,
    usdcDecimals: SOLANA_USDC_DECIMALS,
    receiverAddress: POINTS_PURCHASE_RECEIVER_ADDRESS,
  };
}
