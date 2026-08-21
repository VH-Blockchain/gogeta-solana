/**
 * The admin panel's single source of Solana configuration (§28).
 *
 * Mirrors the portal's `core/web3/solanaConfig.ts` deliberately: same keys, same
 * defaults, same derived labels — so the two frontends can never disagree about
 * which cluster or mint they are describing. The backend re-verifies everything
 * either of them claims, so these values are for display and for building a
 * transaction, never for authorising one.
 */

export const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ??
  'devnet') as 'devnet' | 'testnet' | 'mainnet-beta';

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  (SOLANA_NETWORK === 'mainnet-beta'
    ? 'https://api.mainnet-beta.solana.com'
    : `https://api.${SOLANA_NETWORK}.solana.com`);

export const SOLANA_USDC_MINT =
  process.env.NEXT_PUBLIC_SOLANA_USDC_MINT ??
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export const SOLANA_EXPLORER_URL =
  process.env.NEXT_PUBLIC_SOLANA_EXPLORER_URL ?? 'https://explorer.solana.com';

/** Human label, derived so it cannot drift from the configured cluster. */
export const SOLANA_NETWORK_NAME =
  SOLANA_NETWORK === 'mainnet-beta'
    ? 'Solana Mainnet'
    : SOLANA_NETWORK === 'testnet'
      ? 'Solana Testnet'
      : 'Solana Devnet';

/** Base58 alphabet: no 0, O, I or l. */
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

/**
 * Whether this looks like a Solana address. A shape check only — the backend
 * decodes it properly. Note the absence of any case normalisation: base58 is
 * case-sensitive, so `toLowerCase()` on an address produces an invalid key.
 */
export function isSolanaAddress(v: string | null | undefined): boolean {
  if (!v) return false;
  const s = v.trim();
  return s.length >= 32 && s.length <= 44 && BASE58.test(s);
}

/** Whether this looks like a Solana transaction signature (64 bytes base58). */
export function isSolanaSignature(v: string | null | undefined): boolean {
  if (!v) return false;
  const s = v.trim();
  return s.length >= 87 && s.length <= 88 && BASE58.test(s);
}

/** Short display form, e.g. `7xKX…9AbC` (§30). */
export function shortenAddress(v: string | null | undefined): string {
  if (!v) return '—';
  return v.length <= 9 ? v : `${v.slice(0, 4)}…${v.slice(-4)}`;
}

/** Explorer link for a transaction — the cluster parameter is what makes a
 *  devnet signature resolve rather than 404 against mainnet (§29). */
export function explorerTxUrl(signature: string): string {
  const base = `${SOLANA_EXPLORER_URL}/tx/${signature}`;
  return SOLANA_NETWORK === 'mainnet-beta'
    ? base
    : `${base}?cluster=${SOLANA_NETWORK}`;
}

/** Explorer link for a wallet or mint. */
export function explorerAddressUrl(address: string): string {
  const base = `${SOLANA_EXPLORER_URL}/address/${address}`;
  return SOLANA_NETWORK === 'mainnet-beta'
    ? base
    : `${base}?cluster=${SOLANA_NETWORK}`;
}

/** Base units -> decimal string, in integer arithmetic. No floats (§13). */
export function formatTokenAmount(raw: bigint, decimals: number): string {
  const neg = raw < 0n;
  const digits = (neg ? -raw : raw).toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals).replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}
