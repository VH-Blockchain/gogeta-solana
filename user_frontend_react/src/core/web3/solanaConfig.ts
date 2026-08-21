import { clusterApiUrl } from '@solana/web3.js';

/**
 * The portal's single source of Solana configuration (§28).
 *
 * Every value is a Vite env override with a devnet default, so a build can be
 * pointed at another cluster without touching code. Nothing else in the portal
 * should read a `VITE_SOLANA_*` variable directly.
 */

/** Cluster moniker, as the wallet adapter and the explorer both spell it. */
export const SOLANA_NETWORK = (import.meta.env.VITE_SOLANA_NETWORK ??
  'devnet') as 'devnet' | 'testnet' | 'mainnet-beta';

export const SOLANA_RPC_URL: string =
  import.meta.env.VITE_SOLANA_RPC_URL ?? clusterApiUrl(SOLANA_NETWORK);

/** The USDC SPL mint (§3). Devnet USDC by default. */
export const SOLANA_USDC_MINT: string =
  import.meta.env.VITE_SOLANA_USDC_MINT ??
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export const SOLANA_USDC_DECIMALS = Number(
  import.meta.env.VITE_SOLANA_USDC_DECIMALS ?? 6,
);

export const SOLANA_EXPLORER_URL: string =
  import.meta.env.VITE_SOLANA_EXPLORER_URL ?? 'https://explorer.solana.com';

/** Human label for the cluster, derived so it cannot disagree with the network. */
export const SOLANA_NETWORK_NAME =
  SOLANA_NETWORK === 'mainnet-beta'
    ? 'Solana Mainnet'
    : SOLANA_NETWORK === 'testnet'
      ? 'Solana Testnet'
      : 'Solana Devnet';

/**
 * Short display form for a Solana address, e.g. `7xKX…9AbC` (§5).
 *
 * Deliberately shows 4 characters each side rather than the EVM convention of
 * `0x` plus 4: a base58 key has no fixed prefix, so the leading characters are
 * the identifying ones.
 */
export function shortenAddress(address: string | undefined | null): string {
  if (!address) return '';
  return address.length <= 9
    ? address
    : `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/**
 * Explorer link for a transaction (§29). The `cluster` parameter is what makes a
 * devnet signature resolve — without it the explorer searches mainnet and reports
 * the transaction missing.
 */
export function explorerTxUrl(signature: string): string {
  const base = `${SOLANA_EXPLORER_URL}/tx/${signature}`;
  return SOLANA_NETWORK === 'mainnet-beta'
    ? base
    : `${base}?cluster=${SOLANA_NETWORK}`;
}

/** Explorer link for a wallet or mint address. */
export function explorerAddressUrl(address: string): string {
  const base = `${SOLANA_EXPLORER_URL}/address/${address}`;
  return SOLANA_NETWORK === 'mainnet-beta'
    ? base
    : `${base}?cluster=${SOLANA_NETWORK}`;
}
