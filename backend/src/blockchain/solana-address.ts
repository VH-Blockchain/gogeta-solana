import { PublicKey } from '@solana/web3.js';

/**
 * Solana address and signature validation (§22).
 *
 * Both are base58 and **case-sensitive**, which is the single most important
 * thing to know here. The EVM habit of lower-casing an address before storing or
 * comparing it is not a harmless normalisation on Solana — it produces a
 * different, invalid key. `5f6tPh…` and `5f6tPh…` are not the same wallet, and
 * the lower-cased form is not a wallet at all.
 *
 * That is why there is no `normalize` function in this file. The only safe
 * normalisation is trimming surrounding whitespace.
 */

/** Base58 alphabet: no 0, O, I or l, so those can never appear. */
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

/**
 * Whether this is a real Solana public key.
 *
 * The length/alphabet check alone is not enough — a 32–44 character base58
 * string can still decode to something that is not 32 bytes — so this decodes it
 * properly via `PublicKey`, which is what §22 asks for in place of the old
 * `/^0x[a-fA-F0-9]{40}$/` test.
 */
export function isSolanaAddress(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  if (v.length < 32 || v.length > 44 || !BASE58.test(v)) return false;
  try {
    // Throws unless the base58 decodes to exactly 32 bytes. Deliberately no
    // on-curve check: associated token accounts and program-derived wallets are
    // off-curve by construction, and refusing those would reject legitimate
    // destinations.
    return new PublicKey(v).toBase58() === v;
  } catch {
    return false;
  }
}

/**
 * Whether this is a real Solana transaction signature: 64 bytes, base58, which
 * lands at 87 or 88 characters.
 */
export function isSolanaSignature(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  return v.length >= 87 && v.length <= 88 && BASE58.test(v);
}

/**
 * Trims a wallet address without touching its case, and throws if it is not a
 * real key. Use this wherever a client-supplied address enters the system.
 */
export function requireSolanaAddress(value: string, label = 'address'): string {
  const v = value.trim();
  if (!isSolanaAddress(v)) {
    throw new Error(`${label} is not a valid Solana address`);
  }
  return v;
}

/**
 * Constant-time-ish equality for two addresses. Exists so the intent is
 * explicit at every call site: addresses compare **exactly**, never
 * case-insensitively.
 */
export function sameAddress(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.trim() === b.trim();
}

/** Short display form, e.g. `7xKX…9AbC`. */
export function shortenAddress(address: string | null | undefined): string {
  if (!address) return '';
  return address.length <= 9
    ? address
    : `${address.slice(0, 4)}…${address.slice(-4)}`;
}
