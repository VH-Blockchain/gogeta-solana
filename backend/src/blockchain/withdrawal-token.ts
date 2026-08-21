import { SOLANA_USDC_DECIMALS, SOLANA_USDC_MINT } from './solana-chain';
import { isSolanaAddress } from './solana-address';

/**
 * The token withdrawals pay out in, configured separately from the token point
 * purchases are paid *with* (§18).
 *
 * The spec asked whether payouts are USDT or USDC and told us not to assume they
 * are interchangeable. Solana devnet has no canonical USDT mint to verify
 * against, and labelling a USDC transfer as USDT would tell a user they are
 * receiving a token they are not — so the payout token stays its own
 * configuration, defaulting to the same devnet USDC the platform already accepts
 * and can verify. Pointing it at a real USDT mint later is an env change and
 * nothing more: set WITHDRAWAL_TOKEN_MINT / _SYMBOL / _DECIMALS.
 *
 * Nothing here is lower-cased. Solana addresses are case-sensitive base58, so the
 * EVM-era habit of normalising case would turn a valid mint into an invalid one
 * (see solana-address.ts).
 */

export const WITHDRAWAL_TOKEN_MINT = (
  process.env.WITHDRAWAL_TOKEN_MINT ?? SOLANA_USDC_MINT
).trim();

export const WITHDRAWAL_TOKEN_SYMBOL = (
  process.env.WITHDRAWAL_TOKEN_SYMBOL ?? 'USDC'
).trim();

export const WITHDRAWAL_TOKEN_DECIMALS = Number(
  process.env.WITHDRAWAL_TOKEN_DECIMALS ?? SOLANA_USDC_DECIMALS,
);

/**
 * The treasury wallets payouts may be sent from.
 *
 * A comma-separated list, because payouts are signed by an admin in their own
 * wallet (the admin panel's Withdrawals page connects one) rather than by a
 * single shared account — so every wallet allowed to pay has to be enumerated.
 * Order matters only for display: the first is shown as "the" treasury.
 *
 * This is only ever compared against the sender of a completed transfer; the
 * backend never holds or needs any of their private keys. The check is what stops
 * a user paying themselves and submitting that signature as their own payout, so
 * it must never be relaxed to "any sender".
 */
export const WITHDRAWAL_TREASURY_ADDRESSES: readonly string[] = (
  process.env.WITHDRAWAL_TREASURY_ADDRESS ?? ''
)
  .split(',')
  .map((a) => a.trim())
  .filter((a) => a.length > 0);

/** The primary treasury wallet — what the UI shows when naming one address. */
export const WITHDRAWAL_TREASURY_ADDRESS =
  WITHDRAWAL_TREASURY_ADDRESSES[0] ?? '';

/** Whether this wallet is allowed to send payouts. Exact, case-sensitive match. */
export function isTreasuryWallet(address: string | null | undefined): boolean {
  if (!address) return false;
  return WITHDRAWAL_TREASURY_ADDRESSES.includes(address.trim());
}

/** Whether the payout token differs from the purchase token. */
export function withdrawalTokenDiffersFromPurchase(): boolean {
  return WITHDRAWAL_TOKEN_MINT !== SOLANA_USDC_MINT;
}

/** Why payouts cannot be verified yet, or null when configured. */
export function withdrawalTokenConfigError(): string | null {
  if (!isSolanaAddress(WITHDRAWAL_TOKEN_MINT)) {
    return 'WITHDRAWAL_TOKEN_MINT is not a valid Solana mint address.';
  }
  if (!Number.isInteger(WITHDRAWAL_TOKEN_DECIMALS) || WITHDRAWAL_TOKEN_DECIMALS < 0) {
    return 'WITHDRAWAL_TOKEN_DECIMALS must be a non-negative integer.';
  }
  if (WITHDRAWAL_TREASURY_ADDRESSES.length === 0) {
    return 'WITHDRAWAL_TREASURY_ADDRESS is not configured, so payouts cannot be verified yet.';
  }
  const bad = WITHDRAWAL_TREASURY_ADDRESSES.filter((a) => !isSolanaAddress(a));
  if (bad.length > 0) {
    return `WITHDRAWAL_TREASURY_ADDRESS contains an invalid Solana address: ${bad.join(', ')}`;
  }
  return null;
}

/** Public token details for the client and the admin panel. */
export function publicWithdrawalToken() {
  return {
    tokenMint: WITHDRAWAL_TOKEN_MINT,
    tokenSymbol: WITHDRAWAL_TOKEN_SYMBOL,
    tokenDecimals: WITHDRAWAL_TOKEN_DECIMALS,
    treasuryAddress: WITHDRAWAL_TREASURY_ADDRESS,
    /** Every wallet allowed to sign a payout, so the admin panel can tell an
     *  admin their connected wallet is not one of them before they send. */
    treasuryAddresses: WITHDRAWAL_TREASURY_ADDRESSES,
  };
}
