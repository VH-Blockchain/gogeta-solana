import { Injectable, Logger } from '@nestjs/common';
import {
  Connection,
  PublicKey,
  type ParsedTransactionWithMeta,
  type TokenBalance,
} from '@solana/web3.js';
import {
  POINTS_PURCHASE_RECEIVER_ADDRESS,
  SOLANA_ACCEPT_PROCESSED,
  SOLANA_COMMITMENT,
  SOLANA_NETWORK,
  SOLANA_RPC_URL,
  SOLANA_USDC_DECIMALS,
  SOLANA_USDC_MINT,
} from './solana-chain';
import { isSolanaAddress, isSolanaSignature } from './solana-address';

/**
 * Why a verification failed. The three transient ones —
 * `TX_NOT_FOUND`, `TX_PENDING`, `INSUFFICIENT_CONFIRMATIONS`, `RPC_ERROR` — mean
 * "ask again later" and callers deliberately leave the record open on them; every
 * other reason is a real refusal.
 */
export type VerificationReason =
  | 'TX_NOT_FOUND'
  | 'TX_PENDING'
  | 'INSUFFICIENT_CONFIRMATIONS'
  | 'RPC_ERROR'
  | 'TX_REVERTED'
  | 'INVALID_SIGNATURE'
  | 'CONFIG_ERROR'
  | 'NO_MATCHING_TRANSFER'
  | 'WRONG_MINT'
  | 'WRONG_SENDER'
  | 'WRONG_RECIPIENT'
  | 'AMOUNT_MISMATCH';

export type VerificationResult =
  | {
      ok: true;
      /** Base units actually received, read off the chain. */
      amountRaw: bigint;
      /** Wallet (not token account) that sent it. */
      from: string;
      /** Wallet (not token account) that received it. */
      to: string;
      mint: string;
      decimals: number;
      blockNumber: bigint;
      confirmations: bigint;
      via: string;
    }
  | {
      ok: false;
      reason: VerificationReason;
      message: string;
      detail?: string;
    };

/** What one transfer must satisfy to be accepted. */
interface TransferExpectation {
  signature: string;
  /** SPL mint the transfer must be denominated in. */
  mint: string;
  decimals: number;
  /**
   * Wallet(s) permitted to have sent it. A list, because payouts are signed by
   * whichever admin is on duty from their own wallet.
   */
  expectedFrom: string | readonly string[];
  /** Wallet that must have received it. */
  expectedTo: string;
  /**
   * Minimum base units that must have arrived. Omitted for purchases, where the
   * chain is the authority on the amount and the user is credited for whatever
   * they actually sent; set for payouts, where the platform is asserting it paid
   * a specific debt.
   */
  minAmountRaw?: bigint;
}

/** Net movement of one mint for one wallet across a transaction. */
interface OwnerDelta {
  owner: string;
  mint: string;
  decimals: number;
  delta: bigint;
}

/**
 * Reads Solana and answers one question: did this signature actually move this
 * token, from this wallet, to this wallet, in at least this amount? (§14, §38)
 *
 * The verification works off `meta.preTokenBalances` / `meta.postTokenBalances`
 * rather than by decoding transfer instructions. That is the deliberate choice
 * here, and it matters:
 *
 *  - Those entries carry the **mint** and the **owner wallet** directly, so
 *    there is no need to re-derive associated token accounts and hope the sender
 *    used the canonical one. A transfer out of a non-canonical token account
 *    still attributes to the right owner.
 *  - It is a **net** view. A transaction that transfers in and partly back out,
 *    or routes through several instructions or a CPI, is measured by what
 *    actually ended up where — which is the thing being paid for. Instruction
 *    decoding can be talked into counting a movement that was later undone.
 *  - It ignores instruction shape entirely, so `transfer`, `transferChecked`,
 *    a router, or a future variant all verify the same way.
 *
 * The backend never holds a private key in either direction: it only ever reads.
 */
@Injectable()
export class SolanaService {
  private readonly logger = new Logger('Solana');
  private connection: Connection | null = null;

  /** Why purchases cannot run, or null when configured. */
  configError(): string | null {
    if (!POINTS_PURCHASE_RECEIVER_ADDRESS) {
      return 'POINTS_PURCHASE_RECEIVER_ADDRESS is not configured.';
    }
    if (!isSolanaAddress(POINTS_PURCHASE_RECEIVER_ADDRESS)) {
      return 'POINTS_PURCHASE_RECEIVER_ADDRESS is not a valid Solana address.';
    }
    if (!isSolanaAddress(SOLANA_USDC_MINT)) {
      return 'SOLANA_USDC_MINT is not a valid Solana address.';
    }
    return null;
  }

  private rpc(): Connection {
    this.connection ??= new Connection(SOLANA_RPC_URL, SOLANA_COMMITMENT);
    return this.connection;
  }

  /** Cluster moniker when the RPC answers, null when it cannot be reached. */
  async network(): Promise<string | null> {
    try {
      await this.rpc().getLatestBlockhash();
      return SOLANA_NETWORK;
    } catch (err) {
      this.logger.warn(`RPC ${SOLANA_RPC_URL} unreachable: ${String(err)}`);
      return null;
    }
  }

  // ── Public entry points ─────────────────────────────────────────────────

  /**
   * Verifies an incoming points payment (§10, §14).
   *
   * No expected amount: the quote is a maximum, and the user is credited for
   * exactly what arrived. The sender is pinned to the wallet that created the
   * intent, so one user cannot settle another's purchase with their payment.
   */
  async verifyPayment(
    signature: string,
    expectedFrom: string,
  ): Promise<VerificationResult> {
    const configError = this.configError();
    if (configError) {
      return { ok: false, reason: 'CONFIG_ERROR', message: configError };
    }
    return this.verifyTransfer({
      signature,
      mint: SOLANA_USDC_MINT,
      decimals: SOLANA_USDC_DECIMALS,
      expectedFrom,
      expectedTo: POINTS_PURCHASE_RECEIVER_ADDRESS,
    });
  }

  /**
   * Verifies an outgoing payout before any points are debited (§19).
   *
   * Unlike a purchase this *does* assert an amount: the platform is claiming it
   * settled a specific request, so a transfer for less than the request is worth
   * must not close it. Paying more is accepted — the extra is the operator's
   * mistake to make, not a reason to leave the user's request open.
   */
  async verifyPayout(opts: {
    signature: string;
    mint: string;
    decimals: number;
    expectedFrom: string | readonly string[];
    expectedTo: string;
    expectedAmountRaw: bigint;
  }): Promise<VerificationResult> {
    const senders = Array.isArray(opts.expectedFrom)
      ? opts.expectedFrom
      : [opts.expectedFrom];
    if (senders.length === 0) {
      return {
        ok: false,
        reason: 'CONFIG_ERROR',
        message:
          'No treasury wallet is configured, so a payout cannot be verified.',
      };
    }
    return this.verifyTransfer({
      signature: opts.signature,
      mint: opts.mint,
      decimals: opts.decimals,
      expectedFrom: senders,
      expectedTo: opts.expectedTo,
      minAmountRaw: opts.expectedAmountRaw,
    });
  }

  // ── The verification itself ─────────────────────────────────────────────

  private async verifyTransfer(
    exp: TransferExpectation,
  ): Promise<VerificationResult> {
    const signature = exp.signature.trim();
    if (!isSolanaSignature(signature)) {
      return {
        ok: false,
        reason: 'INVALID_SIGNATURE',
        message: 'That is not a valid Solana transaction signature.',
      };
    }
    if (!isSolanaAddress(exp.mint) || !isSolanaAddress(exp.expectedTo)) {
      return {
        ok: false,
        reason: 'CONFIG_ERROR',
        message: 'The configured mint or destination address is not valid.',
      };
    }

    const senders = (
      Array.isArray(exp.expectedFrom) ? exp.expectedFrom : [exp.expectedFrom]
    )
      .map((s) => s.trim())
      .filter((s) => isSolanaAddress(s));
    if (senders.length === 0) {
      return {
        ok: false,
        reason: 'CONFIG_ERROR',
        message: 'No valid sender wallet was supplied to verify against.',
      };
    }

    const conn = this.rpc();

    // Status first. It distinguishes "not on this cluster at all" from "seen but
    // not yet confirmed", which is the difference between refusing the payment
    // and asking the caller to retry.
    let tx: ParsedTransactionWithMeta | null;
    try {
      const status = await conn.getSignatureStatuses([signature], {
        searchTransactionHistory: true,
      });
      const info = status.value[0];

      if (!info) {
        return {
          ok: false,
          reason: 'TX_NOT_FOUND',
          message:
            'That transaction has not appeared on the network yet. If you have just sent it, try again in a moment.',
        };
      }
      if (info.err) {
        return {
          ok: false,
          reason: 'TX_REVERTED',
          message: 'That transaction failed on-chain, so nothing was paid.',
          detail: JSON.stringify(info.err).slice(0, 300),
        };
      }
      if (
        info.confirmationStatus === 'processed' &&
        !SOLANA_ACCEPT_PROCESSED
      ) {
        return {
          ok: false,
          reason: 'INSUFFICIENT_CONFIRMATIONS',
          message: 'That transaction is still being confirmed.',
        };
      }

      tx = await conn.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
    } catch (err) {
      // An RPC problem is never a reason to refuse a payment — the transfer may
      // be perfectly valid and simply unreadable right now.
      this.logger.warn(`RPC error verifying ${signature}: ${String(err)}`);
      return {
        ok: false,
        reason: 'RPC_ERROR',
        message: 'Could not reach Solana to verify the transaction. Please try again.',
        detail: String(err).slice(0, 300),
      };
    }

    if (!tx) {
      return {
        ok: false,
        reason: 'TX_PENDING',
        message: 'That transaction is confirmed but not yet readable. Please try again.',
      };
    }
    if (tx.meta?.err) {
      return {
        ok: false,
        reason: 'TX_REVERTED',
        message: 'That transaction failed on-chain, so nothing was paid.',
        detail: JSON.stringify(tx.meta.err).slice(0, 300),
      };
    }

    // Net movement of the expected mint, per wallet.
    const deltas = this.ownerDeltas(tx, exp.mint);

    if (deltas.length === 0) {
      // Distinguish "moved a different token" from "moved nothing", because the
      // first is a wrong-mint refusal an operator needs to see plainly (§39).
      const otherMints = this.mintsTouched(tx);
      if (otherMints.length > 0) {
        return {
          ok: false,
          reason: 'WRONG_MINT',
          message: 'That transaction did not transfer the expected token.',
          detail: `expected ${exp.mint}, saw ${otherMints.join(', ')}`,
        };
      }
      return {
        ok: false,
        reason: 'NO_MATCHING_TRANSFER',
        message: 'That transaction contains no token transfer.',
      };
    }

    const received = deltas.find(
      (d) => d.owner === exp.expectedTo && d.delta > 0n,
    );
    if (!received) {
      return {
        ok: false,
        reason: 'WRONG_RECIPIENT',
        message: 'That transaction did not pay the expected wallet.',
        detail: `expected ${exp.expectedTo}, credited ${
          deltas
            .filter((d) => d.delta > 0n)
            .map((d) => d.owner)
            .join(', ') || 'nobody'
        }`,
      };
    }

    // Whoever actually funded it, matched against the allowed senders. Checked
    // on the debit side rather than on the fee payer: the account that signs and
    // pays fees is not necessarily the account whose tokens moved.
    const debited = deltas.filter((d) => d.delta < 0n);
    const sender = debited.find((d) => senders.includes(d.owner));
    if (!sender) {
      return {
        ok: false,
        reason: 'WRONG_SENDER',
        message:
          senders.length > 1
            ? 'That transfer was not sent from an authorised treasury wallet.'
            : 'That transfer was not sent from the expected wallet.',
        detail: `expected ${senders.join(', ')}, debited ${
          debited.map((d) => d.owner).join(', ') || 'nobody'
        }`,
      };
    }

    if (received.decimals !== exp.decimals) {
      return {
        ok: false,
        reason: 'WRONG_MINT',
        message: 'That token does not have the expected number of decimals.',
        detail: `expected ${exp.decimals}, saw ${received.decimals}`,
      };
    }

    if (exp.minAmountRaw != null && received.delta < exp.minAmountRaw) {
      return {
        ok: false,
        reason: 'AMOUNT_MISMATCH',
        message: 'That transfer paid less than this request is worth.',
        detail: `expected at least ${exp.minAmountRaw.toString()}, received ${received.delta.toString()}`,
      };
    }

    return {
      ok: true,
      amountRaw: received.delta,
      from: sender.owner,
      to: received.owner,
      mint: exp.mint,
      decimals: received.decimals,
      blockNumber: BigInt(tx.slot),
      confirmations: 1n,
      via: 'spl-token',
    };
  }

  // ── Balance reading ─────────────────────────────────────────────────────

  /**
   * Net change in one mint per **owner wallet**, summed across every token
   * account that wallet holds for it.
   *
   * Summing per owner rather than per token account is what makes a wallet with
   * two accounts for the same mint verify correctly instead of appearing to have
   * received only part of the payment.
   *
   * A newly created associated token account has no `preTokenBalances` entry at
   * all, so a missing pre-balance is read as zero — otherwise the very common
   * first-ever-payment case would look like no transfer happened.
   */
  private ownerDeltas(
    tx: ParsedTransactionWithMeta,
    mint: string,
  ): OwnerDelta[] {
    const pre = tx.meta?.preTokenBalances ?? [];
    const post = tx.meta?.postTokenBalances ?? [];

    const byOwner = new Map<string, OwnerDelta>();

    const walk = (rows: readonly TokenBalance[], sign: 1n | -1n) => {
      for (const row of rows) {
        if (row.mint !== mint) continue;
        const owner = this.ownerOf(tx, row);
        if (!owner) continue;

        const amount = BigInt(row.uiTokenAmount.amount);
        const existing = byOwner.get(owner);
        if (existing) {
          existing.delta += sign * amount;
        } else {
          byOwner.set(owner, {
            owner,
            mint,
            decimals: row.uiTokenAmount.decimals,
            delta: sign * amount,
          });
        }
      }
    };

    // Post first so `decimals` comes from the settled state.
    walk(post, 1n);
    walk(pre, -1n);

    return [...byOwner.values()].filter((d) => d.delta !== 0n);
  }

  /**
   * The wallet behind a token-balance row.
   *
   * `owner` is populated by every current RPC, but it is optional in the type and
   * older or trimmed-down providers omit it. Falling back to the account key at
   * `accountIndex` keeps verification working there — that key is the token
   * account rather than the wallet, so a payment would then have to be made from
   * the account itself to match, which is strict rather than permissive. Failing
   * closed is the right direction for money.
   */
  private ownerOf(
    tx: ParsedTransactionWithMeta,
    row: TokenBalance,
  ): string | null {
    if (row.owner) return row.owner;
    const key = tx.transaction.message.accountKeys[row.accountIndex];
    return key ? new PublicKey(key.pubkey).toBase58() : null;
  }

  /** Every mint the transaction touched — used only to explain a refusal. */
  private mintsTouched(tx: ParsedTransactionWithMeta): string[] {
    const mints = new Set<string>();
    for (const row of tx.meta?.postTokenBalances ?? []) mints.add(row.mint);
    for (const row of tx.meta?.preTokenBalances ?? []) mints.add(row.mint);
    return [...mints];
  }
}
