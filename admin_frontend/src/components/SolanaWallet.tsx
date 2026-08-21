'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ConnectionProvider,
  WalletProvider,
  useConnection,
  useWallet,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider, useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import type { WalletError } from '@solana/wallet-adapter-base';
import { PublicKey, Transaction, type TransactionInstruction } from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  SOLANA_NETWORK_NAME,
  SOLANA_RPC_URL,
  formatTokenAmount,
} from '@/lib/solana';

import '@solana/wallet-adapter-react-ui/styles.css';

/** Last connection failure, so a refused or locked wallet can say so. */
const WalletErrorContext = createContext<string | null>(null);

/**
 * The admin panel's Solana wallet layer (§6, §20, §25).
 *
 * Same architecture as the user portal —
 * `ConnectionProvider → WalletProvider → WalletModalProvider` — so there is one
 * way wallets work across the product rather than two. What differs is the job:
 * here the connected wallet *sends* payouts rather than receiving points, so this
 * module also owns building and signing the SPL transfer.
 *
 * `autoConnect` must stay **on**, and not for the reason its name suggests. The
 * selection modal only calls `select(walletName)`; the one thing that turns a
 * selection into a connection is `WalletProvider`'s own effect, which begins
 * `if (!autoConnect || !adapter) return`. With it off, choosing a wallet sets it
 * and closes the modal while nothing ever connects — the button keeps offering
 * "Connect wallet" forever. It governs the whole connect path, not just silent
 * reconnects.
 *
 * Reconnecting on load is not a risk worth trading that for: the extension
 * prompts for every signature, so an attached wallet cannot move funds on its
 * own, and the treasury bar states the address and whether it is authorised
 * before an admin can act.
 */
export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );
  const [connectError, setConnectError] = useState<string | null>(null);

  /**
   * Without this the adapter swallows a failed connection entirely: the button
   * simply goes back to offering "Connect wallet", which reads as "nothing
   * happened" rather than "your wallet refused" or "that extension is locked".
   */
  const onError = useCallback((err: WalletError) => {
    setConnectError(walletErrorMessage(err));
  }, []);

  return (
    <ConnectionProvider endpoint={SOLANA_RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        <WalletErrorContext.Provider value={connectError}>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletErrorContext.Provider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export interface SendTokenOptions {
  /** The SPL mint to send, as recorded on the withdrawal request. */
  mint: string;
  /** Destination wallet — the request's own address, never re-derived here. */
  recipient: string;
  /** Base-unit amount, exactly as the server computed it. */
  amountRaw: string;
  /** Mint decimals, for the checked transfer. */
  decimals: number;
}

/**
 * Everything a page needs from the connected wallet.
 *
 * Deliberately not a context of its own — it reads the adapter hooks directly, so
 * there is no second source of truth about connection state.
 */
export function useSolanaWallet() {
  const { connection } = useConnection();
  const { publicKey, connected, connecting, disconnect, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const connectError = useContext(WalletErrorContext);

  const [sending, setSending] = useState(false);
  const [balanceRaw, setBalanceRaw] = useState<bigint | null>(null);

  const address = publicKey?.toBase58() ?? null;

  /** The connected wallet's balance of one mint, or null if unreadable. */
  const readBalance = useCallback(
    async (mint: string, decimals: number): Promise<string | null> => {
      if (!publicKey) return null;
      try {
        const ata = getAssociatedTokenAddressSync(new PublicKey(mint), publicKey);
        const account = await getAccount(connection, ata);
        setBalanceRaw(account.amount);
        return formatTokenAmount(account.amount, decimals);
      } catch {
        // No token account is a real zero, but any other failure is unknown —
        // and an admin about to pay should not be shown a confident number the
        // panel could not actually read.
        setBalanceRaw(null);
        return null;
      }
    },
    [publicKey, connection],
  );

  /**
   * Signs and submits a payout, returning its signature once confirmed.
   *
   * Mirrors the portal's transfer for the same reasons: the recipient may have no
   * token account for this mint yet (§12), `transferChecked` makes the token
   * program reject a mint/decimals mismatch on-chain, and the signature is only
   * returned after confirmation so the settle call does not race the cluster.
   *
   * The amount is passed straight through from the request. This function never
   * computes what is owed — that figure came from the server and the server
   * re-verifies it against the chain before debiting anything.
   */
  const sendToken = useCallback(
    async (opts: SendTokenOptions): Promise<string> => {
      if (!publicKey) throw new Error('Connect a wallet first.');

      const mint = new PublicKey(opts.mint);
      const recipient = new PublicKey(opts.recipient);
      const amount = BigInt(opts.amountRaw);
      if (amount <= 0n) throw new Error('That payout amount is not sendable.');

      setSending(true);
      try {
        const fromAta = getAssociatedTokenAddressSync(mint, publicKey);
        const toAta = getAssociatedTokenAddressSync(mint, recipient);

        let held: bigint;
        try {
          held = (await getAccount(connection, fromAta)).amount;
        } catch {
          throw new Error(
            `This wallet holds none of that token on ${SOLANA_NETWORK_NAME}.`,
          );
        }
        if (held < amount) {
          throw new Error(
            `Treasury holds ${formatTokenAmount(held, opts.decimals)} but this payout needs ${formatTokenAmount(amount, opts.decimals)}.`,
          );
        }

        const instructions: TransactionInstruction[] = [];
        if ((await connection.getAccountInfo(toAta)) == null) {
          instructions.push(
            createAssociatedTokenAccountIdempotentInstruction(
              publicKey,
              toAta,
              recipient,
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
            opts.decimals,
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
        const status = await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          'confirmed',
        );
        if (status.value.err) {
          // The signature is still returned by the caller's error path so a
          // partially-landed payout is never invisible.
          throw new Error(`The transfer failed on-chain (${signature}).`);
        }
        return signature;
      } finally {
        setSending(false);
      }
    },
    [publicKey, connection, sendTransaction],
  );

  return {
    address,
    connected,
    connecting,
    sending,
    balanceRaw,
    /** Why the last connection attempt failed, or null. */
    connectError: connected ? null : connectError,
    networkName: SOLANA_NETWORK_NAME,
    connect: useCallback(() => setVisible(true), [setVisible]),
    disconnect,
    readBalance,
    sendToken,
  };
}

/** First line of a wallet error, in language an admin can act on. */
export function walletErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const first = raw.split('\n')[0].trim();
  if (/user rejected|user denied|rejected the request/i.test(first)) {
    return 'You cancelled the transaction in your wallet.';
  }
  return first.slice(0, 240) || 'The wallet reported an unknown error.';
}

/**
 * Connect / disconnect control.
 *
 * Rendered as the panel's own button rather than the adapter's
 * `WalletMultiButton`, so it matches the surrounding UI — the adapter's stylesheet
 * is still imported for the wallet-selection modal, which is worth keeping as-is
 * because it is what users recognise from other Solana apps.
 */
export function SolanaConnectButton({ className }: { className?: string }) {
  const { address, connected, connecting, connect, disconnect } = useSolanaWallet();
  const [mounted, setMounted] = useState(false);

  // Wallet state lives in the browser, so rendering it during SSR would produce
  // markup the client immediately contradicts.
  useEffect(() => setMounted(true), []);

  const base =
    className ??
    'rounded-lg bg-gradient-to-r from-cyan-400 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50';

  if (!mounted) {
    return (
      <button type="button" className={base} disabled>
        Connect wallet
      </button>
    );
  }

  if (connected && address) {
    return (
      <button
        type="button"
        onClick={() => void disconnect()}
        className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.08]"
      >
        Disconnect
      </button>
    );
  }

  return (
    <button type="button" onClick={connect} disabled={connecting} className={base}>
      {connecting ? 'Connecting…' : 'Connect wallet'}
    </button>
  );
}
