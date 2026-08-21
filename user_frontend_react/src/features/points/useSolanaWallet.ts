import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction, type TransactionInstruction } from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from '@solana/spl-token';
import {
  SOLANA_NETWORK_NAME,
  SOLANA_USDC_DECIMALS,
  SOLANA_USDC_MINT,
} from '@/core/web3/solanaConfig';

/**
 * The portal's one wallet hook (§5, §25).
 *
 * Wraps the Solana wallet adapter with the two things the purchase flow actually
 * needs beyond "connect": the user's USDC balance, and a transfer that survives
 * the real-world cases. There is deliberately no network-switch concept — a
 * Solana wallet does not choose a cluster the way an EVM wallet chooses a chain;
 * the cluster is whatever `ConnectionProvider` was given, so there is nothing for
 * the user to switch and no wrong network to warn about (§7).
 */

/** Base units -> decimal string, in integer arithmetic. No floats (§13). */
function formatTokenAmount(raw: bigint, decimals: number): string {
  const negative = raw < 0n;
  const digits = (negative ? -raw : raw).toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}

export interface PayUsdcOptions {
  /** The mint to send, as quoted by the server. */
  tokenMint: string;
  /** Where to send it, as quoted by the server. */
  receiverAddress: string;
  /** Base-unit amount, as quoted by the server. Never re-derived here. */
  amountRaw: string;
  /** Mint decimals, used for the checked transfer. */
  tokenDecimals?: number;
}

export function useSolanaWallet() {
  const { connection } = useConnection();
  const { publicKey, connected, connecting, disconnect, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();

  const [sending, setSending] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [usdcBalanceRaw, setUsdcBalanceRaw] = useState<bigint | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  /** False when the wallet holds no USDC token account yet. */
  const [hasTokenAccount, setHasTokenAccount] = useState<boolean | null>(null);

  const address = publicKey?.toBase58() ?? null;

  const usdcBalance = useMemo(
    () =>
      usdcBalanceRaw == null
        ? null
        : formatTokenAmount(usdcBalanceRaw, SOLANA_USDC_DECIMALS),
    [usdcBalanceRaw],
  );

  /**
   * Reads the wallet's USDC balance.
   *
   * A wallet that has never held USDC has no associated token account at all,
   * which the SPL client reports by throwing rather than returning zero. That is
   * a legitimate balance of 0, not a failure — so it is caught and reported as
   * zero, while any *other* error leaves the balance unknown rather than
   * silently displaying 0 for what might be a full wallet.
   */
  const refetchBalance = useCallback(async () => {
    if (!publicKey) {
      setUsdcBalanceRaw(null);
      setHasTokenAccount(null);
      setBalanceError(null);
      return;
    }
    setLoadingBalance(true);
    setBalanceError(null);
    try {
      const ata = getAssociatedTokenAddressSync(
        new PublicKey(SOLANA_USDC_MINT),
        publicKey,
      );
      const account = await getAccount(connection, ata);
      setUsdcBalanceRaw(account.amount);
      setHasTokenAccount(true);
    } catch (err) {
      if (
        err instanceof TokenAccountNotFoundError ||
        err instanceof TokenInvalidAccountOwnerError
      ) {
        setUsdcBalanceRaw(0n);
        setHasTokenAccount(false);
      } else {
        // Unknown balance is honest; a displayed 0 would not be.
        setUsdcBalanceRaw(null);
        setHasTokenAccount(null);
        setBalanceError('Could not read your USDC balance right now.');
      }
    } finally {
      setLoadingBalance(false);
    }
  }, [publicKey, connection]);

  /**
   * Load the balance as soon as a wallet is connected, and clear it on
   * disconnect. Without this the balance stays null until after a purchase,
   * which is exactly when it is least useful.
   */
  useEffect(() => {
    void refetchBalance();
  }, [refetchBalance]);

  const connect = useCallback(() => setVisible(true), [setVisible]);

  /**
   * Sends an SPL token transfer and returns its signature once confirmed (§11).
   *
   * Three things here are not optional in practice:
   *
   *  - **The recipient's token account may not exist.** A wallet address is not
   *    a token account (§12), and a first-ever payment to a fresh platform
   *    wallet has nowhere to land. The idempotent create instruction is
   *    prepended so the transfer works either way and costs nothing extra when
   *    the account is already there.
   *  - **`transferChecked` rather than `transfer`.** It passes the mint and
   *    decimals to the token program, which rejects a mismatch on-chain. A plain
   *    transfer would happily move the wrong token if the accounts were wrong.
   *  - **Waiting for confirmation.** `sendTransaction` resolves as soon as the
   *    cluster accepts the transaction, well before it is confirmed. Returning
   *    then would have the backend look up a signature that is not yet readable.
   */
  const payUsdc = useCallback(
    async (opts: PayUsdcOptions): Promise<string> => {
      if (!publicKey) throw new Error('Connect your wallet first.');

      const mint = new PublicKey(opts.tokenMint || SOLANA_USDC_MINT);
      const receiver = new PublicKey(opts.receiverAddress);
      const decimals = opts.tokenDecimals ?? SOLANA_USDC_DECIMALS;
      const amount = BigInt(opts.amountRaw);
      if (amount <= 0n) throw new Error('That amount is too small to send.');

      setSending(true);
      try {
        const fromAta = getAssociatedTokenAddressSync(mint, publicKey);
        const toAta = getAssociatedTokenAddressSync(mint, receiver);

        // Fail before the wallet prompts, with a message that says what to do —
        // the token program's own error here is unreadable.
        let held: bigint;
        try {
          held = (await getAccount(connection, fromAta)).amount;
        } catch {
          throw new Error(
            `Your wallet holds no USDC on ${SOLANA_NETWORK_NAME}. Fund it and try again.`,
          );
        }
        if (held < amount) {
          throw new Error(
            `You need ${formatTokenAmount(amount, decimals)} USDC but hold ${formatTokenAmount(held, decimals)}.`,
          );
        }

        const instructions: TransactionInstruction[] = [];
        const toAtaInfo = await connection.getAccountInfo(toAta);
        if (toAtaInfo == null) {
          instructions.push(
            createAssociatedTokenAccountIdempotentInstruction(
              publicKey, // payer
              toAta,
              receiver, // owner
              mint,
            ),
          );
        }
        instructions.push(
          createTransferCheckedInstruction(
            fromAta,
            mint,
            toAta,
            publicKey,
            amount,
            decimals,
          ),
        );

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash('confirmed');
        const tx = new Transaction({
          blockhash,
          lastValidBlockHeight,
          feePayer: publicKey,
        }).add(...instructions);

        const signature = await sendTransaction(tx, connection);

        // Wait for the cluster to confirm before handing the signature on.
        const status = await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          'confirmed',
        );
        if (status.value.err) {
          throw new Error('The transfer failed on-chain. Nothing was sent.');
        }

        void refetchBalance();
        return signature;
      } finally {
        setSending(false);
      }
    },
    [publicKey, connection, sendTransaction, refetchBalance],
  );

  return {
    /** The adapter is always available in a browser — kept so callers can gate. */
    available: true,
    address,
    isConnected: connected,
    connecting,
    networkName: SOLANA_NETWORK_NAME,
    usdcBalance,
    usdcBalanceRaw,
    loadingBalance,
    balanceError,
    hasTokenAccount,
    refetchBalance,
    sending,
    connect,
    disconnect,
    payUsdc,
  };
}

/** First line of a wallet error, trimmed to something displayable. */
export function walletErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const first = raw.split('\n')[0].trim();
  if (/user rejected|user denied|rejected the request/i.test(first)) {
    return 'You cancelled the transaction in your wallet.';
  }
  return first.slice(0, 200) || 'Something went wrong with the wallet.';
}
