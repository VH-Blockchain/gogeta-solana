'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import type {
  WithdrawalDetail,
  WithdrawalStatus,
  WithdrawalsPage,
  WithdrawalsStatus,
} from '@/lib/types';


import {
  SolanaConnectButton,
  useSolanaWallet,
  walletErrorMessage,
} from '@/components/SolanaWallet';
import { isSolanaSignature, shortenAddress } from '@/lib/solana';
import {
  Badge,
  Button,
  Card,
  Distribution,
  Field,
  MiniStat,
  Modal,
  Spinner,
  inputClass,
  selectClass,
} from '@/components/ui';

const STATUS_COLOR: Record<WithdrawalStatus, string> = {
  PENDING: 'amber',
  APPROVED: 'sky',
  PROCESSING: 'violet',
  COMPLETED: 'green',
  REJECTED: 'red',
  FAILED: 'red',
  CANCELLED: 'zinc',
};

/** Pending first — it is the only status that needs a decision. */
const STATUS_ORDER: WithdrawalStatus[] = [
  'PENDING',
  'APPROVED',
  'PROCESSING',
  'COMPLETED',
  'REJECTED',
  'FAILED',
  'CANCELLED',
];

const TAKE = 25;

const shorten = (v: string | null, head = 10, tail = 6) =>
  !v ? '—' : v.length <= head + tail + 1 ? v : `${v.slice(0, head)}…${v.slice(-tail)}`;

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/**
 * Withdrawal requests (new_features.md §15–§17).
 *
 * Unlike the Points page, this one does act: an admin approves, rejects and
 * settles requests here. The safety rails live in the backend, not in this UI —
 * a request only reaches COMPLETED once the backend has read the payout back off
 * the chain and confirmed the amount, token, sender and recipient (§22), and the
 * user's points are debited in that same step. So there is no button here that
 * can move money or points on its word alone.
 */
export default function WithdrawalsPage() {
  const [page, setPage] = useState<WithdrawalsPage | null>(null);
  const [status, setStatus] = useState<WithdrawalsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPage(
        await api<WithdrawalsPage>('/admin/withdrawals', {
          query: { skip, take: TAKE, status: statusFilter, search, from, to },
        }),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [skip, statusFilter, search, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<WithdrawalsStatus>('/admin/withdrawals/status')
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  function copy(value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(value);
      setTimeout(() => setCopied((c) => (c === value ? null : c)), 1200);
    });
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await api<WithdrawalsPage>('/admin/withdrawals', {
        query: { skip: 0, take: 100, status: statusFilter, search, from, to },
      });
      downloadCsv(
        `gogeta-withdrawals-${new Date().toISOString().slice(0, 10)}.csv`,
        res.items.map((w) => ({
          id: w.id,
          user: w.user.email,
          walletAddress: w.walletAddress,
          points: w.points,
          amount: w.amount,
          token: w.tokenSymbol,
          exchangeRate: w.exchangeRate,
          network: w.networkName,
          transactionSignature: w.transactionSignature ?? '',
          status: w.status,
          adminNote: w.adminNote ?? '',
          createdAt: w.createdAt,
          approvedAt: w.approvedAt ?? '',
          completedAt: w.completedAt ?? '',
        })),
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const items = page?.items ?? null;
  const counts = page?.statusCounts ?? {};
  const symbol = page?.totals.tokenSymbol ?? status?.network.tokenSymbol ?? 'USDC';
  const filtered = statusFilter !== '' || search !== '' || from !== '' || to !== '';

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Withdrawals</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Users cashing withdrawable points back out to {symbol}. Points are reserved
            when a request is made and only debited once the payout is verified on-chain.
          </p>
        </div>
        {status && (
          <Badge color={status.enabled ? 'green' : 'red'}>
            {status.enabled ? '● Withdrawals live' : '■ Withdrawals unavailable'}
          </Badge>
        )}
      </div>

      {status && !status.enabled && (
        <Card className="mt-4 border border-amber-500/30 p-4">
          <div className="text-sm text-amber-300">
            {status.configError ??
              'Withdrawals are turned off in Settings → Points economy.'}
          </div>
          {!status.rpcReachable && (
            <div className="mt-1 text-xs text-zinc-500">
              The {status.network.networkName} RPC could not be reached, so payouts cannot be
              verified.
            </div>
          )}
        </Card>
      )}

      {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}

      <TreasuryBar status={status} />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <MiniStat
            label="Awaiting action"
            sub="pending, approved or processing"
            value={page?.totals.openRequests ?? '—'}
            icon="◷"
            accent="amber"
          />
          <MiniStat
            label="Points reserved"
            sub={`${page?.totals.amountReserved ?? '0'} ${symbol} owed`}
            value={(page?.totals.pointsReserved ?? 0).toLocaleString()}
            icon="◧"
            accent="violet"
          />
          <MiniStat
            label="Paid out"
            sub={`${page?.totals.completedRequests ?? 0} completed`}
            value={`${page?.totals.amountPaid ?? '0'} ${symbol}`}
            icon="$"
            accent="aura"
          />
          <MiniStat
            label="Points withdrawn"
            value={(page?.totals.pointsPaid ?? 0).toLocaleString()}
            icon="◆"
            accent="azure"
          />
        </div>
        <Card className="p-5">
          <div className="mb-3 text-sm font-medium text-zinc-300">Status breakdown</div>
          <Distribution
            items={STATUS_ORDER.map((s) => ({
              label: s,
              value: counts[s] ?? 0,
              accent:
                s === 'COMPLETED'
                  ? ('aura' as const)
                  : s === 'PENDING'
                    ? ('amber' as const)
                    : s === 'REJECTED' || s === 'FAILED'
                      ? ('rose' as const)
                      : s === 'PROCESSING'
                        ? ('violet' as const)
                        : ('teal' as const),
            })).filter((i) => i.value > 0)}
            total={Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0)}
          />
          {status && (
            <div className="mt-4 border-t border-white/5 pt-3 text-xs text-zinc-500">
              <div>Rate: {status.rules.pointsPerToken} points per {symbol}</div>
              <div className="mt-0.5">
                Minimum: {status.rules.minWithdrawalPoints.toLocaleString()} points
              </div>
              <div className="mt-0.5">
                Lucky bonus {status.rules.luckyBonusWithdrawable ? 'is' : 'is not'}{' '}
                withdrawable
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6 flex flex-wrap items-center gap-3 p-3">
        <input
          value={search}
          onChange={(e) => {
            setSkip(0);
            setSearch(e.target.value);
          }}
          placeholder="Search user, wallet or signature…"
          className={inputClass + ' max-w-xs'}
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setSkip(0);
            setStatusFilter(e.target.value);
          }}
          className={selectClass + ' max-w-44'}
        >
          <option value="">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {s} ({counts[s] ?? 0})
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setSkip(0);
              setFrom(e.target.value);
            }}
            className={inputClass + ' w-36'}
          />
          <span>To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setSkip(0);
              setTo(e.target.value);
            }}
            className={inputClass + ' w-36'}
          />
        </div>
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setSkip(0);
              setSearch('');
              setStatusFilter('');
              setFrom('');
              setTo('');
            }}
          >
            Clear
          </Button>
        )}
        <Button variant="ghost" className="ml-auto" onClick={exportCsv} disabled={exporting}>
          {exporting ? 'Exporting…' : '⬇ Export CSV'}
        </Button>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="w-40 px-4 py-3">Wallet</th>
                <th className="w-28 px-4 py-3 text-right">Points</th>
                <th className="w-28 px-4 py-3 text-right">{symbol}</th>
                <th className="w-20 px-4 py-3 text-right">Rate</th>
                <th className="w-40 px-4 py-3">Payout tx</th>
                <th className="w-28 px-4 py-3">Status</th>
                <th className="w-36 px-4 py-3">Requested</th>
              </tr>
            </thead>
            <tbody>
              {!items && (
                <tr>
                  <td colSpan={8} className="px-4 py-10">
                    <div className="flex justify-center">
                      <Spinner />
                    </div>
                  </td>
                </tr>
              )}
              {items?.map((w) => (
                <tr
                  key={w.id}
                  onClick={() => setViewingId(w.id)}
                  className="cursor-pointer border-b border-zinc-800/60 align-top last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-200">{w.user.name}</div>
                    <div className="text-xs text-zinc-500">{w.user.email}</div>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => copy(w.walletAddress)}
                      title={w.walletAddress}
                      className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                    >
                      {copied === w.walletAddress ? 'Copied!' : shorten(w.walletAddress)}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-rose-300">
                    −{w.points.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-300">
                    {w.amount}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-500">
                    {w.exchangeRate}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {w.transactionSignature ? (
                      <a
                        href={w.explorerUrl ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        title={w.transactionSignature}
                        className="font-mono text-xs text-cyan-300 underline decoration-dotted underline-offset-2 hover:text-cyan-200"
                      >
                        {shorten(w.transactionSignature)} ↗
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-600">not sent yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[w.status]}>{w.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {fmtDate(w.createdAt)}
                    {w.completedAt && (
                      <div className="text-zinc-600">paid {fmtDate(w.completedAt)}</div>
                    )}
                  </td>
                </tr>
              ))}
              {items?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                    {filtered ? 'No withdrawals match those filters.' : 'No withdrawal requests yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {page && page.total > TAKE && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
          <span>
            {skip + 1}–{Math.min(skip + TAKE, page.total)} of {page.total}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - TAKE))}>
              Prev
            </Button>
            <Button
              variant="ghost"
              disabled={skip + TAKE >= page.total}
              onClick={() => setSkip(skip + TAKE)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {viewingId && (
        <WithdrawalDetailModal
          id={viewingId}
          status={status}
          onClose={() => setViewingId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

/**
 * The treasury wallet an admin signs payouts from (§20).
 *
 * Sits at the top of the page rather than inside the detail modal so the wallet
 * is connected and checked *before* an admin opens a request and is one click
 * from sending money — connecting mid-decision is where mistakes happen.
 *
 * The allow-list check happens here too, for the same reason. A transfer signed
 * by a wallet the backend will refuse still moves real tokens, so an admin has
 * to learn their wallet is not authorised *before* they send, not from a failed
 * settle afterwards.
 */
function TreasuryBar({ status }: { status: WithdrawalsStatus | null }) {
  const wallet = useSolanaWallet();
  const [balance, setBalance] = useState<string | null>(null);

  const token = status?.network;

  useEffect(() => {
    if (!wallet.connected || !token?.tokenMint) {
      setBalance(null);
      return;
    }
    let live = true;
    void wallet
      .readBalance(token.tokenMint, token.tokenDecimals)
      .then((b) => {
        if (live) setBalance(b);
      });
    return () => {
      live = false;
    };
  }, [wallet.connected, wallet.address, token?.tokenMint, token?.tokenDecimals]);

  const allowed =
    wallet.address == null ||
    token == null ||
    token.treasuryAddresses.length === 0 ||
    token.treasuryAddresses.includes(wallet.address);

  return (
    <Card className="mt-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Treasury wallet</div>
          {wallet.connected && wallet.address ? (
            <>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-zinc-200">{wallet.address}</span>
                <Badge color={allowed ? 'green' : 'red'}>
                  {allowed ? '● Authorised' : '■ Not authorised'}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {status?.network.networkName ?? wallet.networkName}
                {balance != null && token
                  ? ` · holds ${balance} ${token.tokenSymbol}`
                  : ''}
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-zinc-400">
              Not connected. Connect the wallet payouts are sent from.
              {/* Names the cluster before connecting, not after: an admin should know
                  which network they are about to sign on. */}
              <span className="text-zinc-500">
                {' '}
                Payouts settle on {status?.network.networkName ?? wallet.networkName}.
              </span>
            </div>
          )}
        </div>
        <SolanaConnectButton />
      </div>

      {wallet.connectError && !wallet.connected && (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-200">
          {wallet.connectError}
        </p>
      )}

      {!allowed && wallet.address && (
        <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] px-3 py-2 text-xs text-rose-300">
          This wallet is not on the platform&apos;s treasury allow-list, so the backend will refuse
          any payout it signs. Connect an authorised wallet, or add this one to
          WITHDRAWAL_TREASURY_ADDRESS.
        </p>
      )}
    </Card>
  );
}

/**
 * Which actions a status allows (§17), following the backend's own transitions
 * so no legitimate action is hidden and no impossible one is offered.
 *
 * One deliberate narrowing: the backend accepts "mark failed" on a PENDING
 * request, but a request nobody has tried to pay cannot have failed — rejecting
 * is the honest action there, so this offers only that.
 */
function actionsFor(status: WithdrawalStatus) {
  const settled = status === 'COMPLETED' || status === 'REJECTED' || status === 'CANCELLED';
  return {
    approve: status === 'PENDING',
    reject: !settled,
    processing: status === 'APPROVED' || status === 'FAILED',
    complete: status === 'APPROVED' || status === 'PROCESSING' || status === 'FAILED',
    fail: status === 'APPROVED' || status === 'PROCESSING',
  };
}

/** How long to keep retrying settlement while the chain confirms the payout. */
const SETTLE_ATTEMPTS = 12;
const SETTLE_DELAY_MS = 3000;

/** A settlement failure that only means "not confirmed yet". */
function isPending(e: unknown): boolean {
  return (
    e instanceof ApiError &&
    (e.data?.pending === true ||
      e.code === 'TX_PENDING' ||
      e.code === 'INSUFFICIENT_CONFIRMATIONS' ||
      e.code === 'RPC_ERROR')
  );
}

function WithdrawalDetailModal({
  id,
  status,
  onClose,
  onChanged,
}: {
  id: string;
  status: WithdrawalsStatus | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<WithdrawalDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Which action is collecting its required input. */
  const [prompt, setPrompt] = useState<'reject' | 'complete' | 'fail' | null>(null);
  const [reason, setReason] = useState('');
  const [txSig, setTxHash] = useState('');
  const [adminNote, setAdminNote] = useState('');
  /** Progress note while a payout is signed and then settled. */
  const [payNote, setPayNote] = useState<string | null>(null);
  /** Signature of a payout that was sent but has not settled yet — never lose this. */
  const [sentHash, setSentHash] = useState<string | null>(null);
  const wallet = useSolanaWallet();

  

  const load = useCallback(() => {
    api<WithdrawalDetail>(`/admin/withdrawals/${id}`)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [id]);

  useEffect(load, [load]);

  /** Returns whether the action succeeded, so callers can chain on it. */
  async function act(action: string, body?: Record<string, unknown>): Promise<boolean> {
    setBusy(action);
    setActionError(null);
    try {
      const updated = await api<WithdrawalDetail>(`/admin/withdrawals/${id}/${action}`, {
        method: 'POST',
        body: body ?? {},
      });
      // The action responses carry the row but not the joined context, so the
      // detail is re-read rather than patched from a partial reply.
      setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
      load();
      onChanged();
      setPrompt(null);
      setReason('');
      setTxHash('');
      setAdminNote('');
      return true;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
      return false;
    } finally {
      setBusy(null);
    }
  }

  /**
   * Settles a payout that is already on-chain: hands the hash to the backend,
   * which re-reads the transfer and debits the points only if it matches.
   *
   * A freshly-signed transfer usually needs a moment to be mined, so a "not yet"
   * answer is retried rather than surfaced as a failure. Returns true once
   * settled.
   */
  async function settle(hash: string): Promise<boolean> {
    for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
      try {
        await api<WithdrawalDetail>(`/admin/withdrawals/${id}/complete`, {
          method: 'POST',
          body: { transactionSignature: hash },
        });
        setPayNote(null);
        setSentHash(null);
        load();
        onChanged();
        setPrompt(null);
        setTxHash('');
        return true;
      } catch (e) {
        if (!isPending(e)) throw e;
        setPayNote(
          `Waiting for the network to confirm the payout… (${attempt + 1}/${SETTLE_ATTEMPTS})`,
        );
        await new Promise((r) => setTimeout(r, SETTLE_DELAY_MS));
      }
    }
    return false;
  }

  /** Whether the connected wallet is one the backend will accept a payout from. */
  const treasuryAuthorised =
    wallet.address != null &&
    (status == null ||
      status.network.treasuryAddresses.length === 0 ||
      status.network.treasuryAddresses.includes(wallet.address));

  /**
   * Signs the transfer in the admin's wallet, then settles the request with the
   * resulting signature (§19).
   *
   * The ordering here is the whole point. The transfer goes first and the
   * signature is captured into `sentHash` the instant it exists — before any
   * settle attempt — because from that moment real tokens have left the treasury
   * and that string is the only record of it. If settlement then fails or times
   * out, the signature stays on screen to be pasted into the manual path rather
   * than being lost with the error.
   *
   * The allow-list is re-checked immediately before sending, not just at render:
   * an admin can switch wallets in their extension after this modal opened.
   */
  async function payFromWallet() {
    if (!detail) return;
    setActionError(null);
    setPayNote(null);

    if (!treasuryAuthorised) {
      setActionError(
        'The connected wallet is not on the treasury allow-list. The payout would be refused after the tokens had already moved.',
      );
      return;
    }

    let signature: string;
    try {
      setPayNote('Waiting for you to approve the transfer in your wallet…');
      signature = await wallet.sendToken({
        mint: detail.tokenMint,
        recipient: detail.walletAddress,
        // Base units, exactly as the server computed them — never recomputed here.
        amountRaw: detail.amountRaw,
        decimals: detail.tokenDecimals,
      });
    } catch (e) {
      setPayNote(null);
      setActionError(walletErrorMessage(e));
      return;
    }

    // Tokens have moved. Record the signature before anything else can fail.
    setSentHash(signature);
    setPayNote('Transfer sent. Settling the request…');

    try {
      const settled = await settle(signature);
      if (!settled) {
        setActionError(
          'The payout was sent but has not confirmed yet. Keep the signature above and use "Settle a payout already sent" in a moment.',
        );
      }
    } catch (e) {
      setActionError(
        `The payout was sent but could not be settled: ${
          e instanceof Error ? e.message : 'unknown error'
        }. Keep the signature above — do not send again.`,
      );
    }
  }

  if (error) {
    return (
      <Modal title="Withdrawal" onClose={onClose}>
        <p className="text-sm text-rose-400">{error}</p>
      </Modal>
    );
  }
  if (!detail) {
    return (
      <Modal title="Withdrawal" onClose={onClose}>
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      </Modal>
    );
  }

  const allowed = actionsFor(detail.status);
  const rows: [string, ReactNode][] = [
    [
      'Status',
      <Badge key="s" color={STATUS_COLOR[detail.status]}>
        {detail.status}
      </Badge>,
    ],
    ['Request ID', detail.id],
    ['User', `${detail.user.name} · ${detail.user.email}`],
    ['User balance now', detail.user.coins.toLocaleString()],
    ['Destination wallet', detail.walletAddress],
    ['Points', `−${detail.points.toLocaleString()}`],
    ['Payout', `${detail.amount} ${detail.tokenSymbol}`],
    ['Payout (token units)', detail.amountRaw],
    ['Exchange rate', `${detail.exchangeRate} points per ${detail.tokenSymbol}`],
    ['Network', `${detail.network}`],
    [`${detail.tokenSymbol} contract`, detail.tokenMint],
    ['Points reserved', detail.reserved ? 'Yes — held, not yet debited' : 'No'],
    ['Block', detail.blockNumber ?? '—'],
    ['Requested', fmtDate(detail.createdAt)],
    ['Approved', fmtDate(detail.approvedAt)],
    ['Rejected', fmtDate(detail.rejectedAt)],
    ['Completed', fmtDate(detail.completedAt)],
  ];

  return (
    <Modal
      title={`Withdrawal · ${detail.amount} ${detail.tokenSymbol}`}
      // Undismissable while a payout is in flight: a stray backdrop click would
      // otherwise close the dialog holding the only copy of a hash for tokens
      // that have already left the treasury.
      onClose={busy === 'pay' ? () => {} : onClose}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {detail.userNote && (
          <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Note from the user
            </div>
            <div className="mt-1 text-sm text-zinc-300">{detail.userNote}</div>
          </div>
        )}

        {detail.adminNote && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-amber-500/80">
              Admin note
            </div>
            <div className="mt-1 text-sm text-amber-200">{detail.adminNote}</div>
          </div>
        )}

        {detail.transactionSignature && (
          <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-zinc-500">Payout transaction</div>
            <a
              href={detail.explorerUrl ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all font-mono text-xs text-cyan-300 underline decoration-dotted underline-offset-2 hover:text-cyan-200"
            >
              {detail.transactionSignature} ↗
            </a>
          </div>
        )}

        {/* Eligibility at decision time — a request for more than the user can
            currently withdraw is the signal to reject rather than pay. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs sm:grid-cols-4">
          {(
            [
              ['Total', detail.userAvailability.totalPoints],
              ['Withdrawable', detail.userAvailability.withdrawablePoints],
              ['Reserved', detail.userAvailability.reservedPoints],
              ['Available', detail.userAvailability.availableToWithdraw],
            ] as [string, number][]
          ).map(([label, value]) => (
            <div key={label}>
              <div className="text-zinc-500">{label}</div>
              <div className="mt-0.5 tabular-nums font-medium text-zinc-200">
                {value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div
              key={k}
              className="flex min-w-0 items-start justify-between gap-4 border-b border-white/5 py-1.5"
            >
              <span className="shrink-0 text-zinc-500">{k}</span>
              <span className="min-w-0 break-all text-right font-medium text-zinc-200">{v}</span>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Points ledger entry
          </div>
          {detail.coinTransaction ? (
            <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-300">{detail.coinTransaction.description}</span>
                <span className="shrink-0 tabular-nums text-rose-300">
                  {detail.coinTransaction.amount.toLocaleString()}
                </span>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Balance after {detail.coinTransaction.balanceAfter.toLocaleString()} ·{' '}
                {fmtDate(detail.coinTransaction.createdAt)}
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              No ledger entry yet — points are only debited when a verified payout completes.
            </p>
          )}
        </div>

        {actionError && <p className="text-sm text-rose-400">{actionError}</p>}

        {/* ── Actions (§17) ─────────────────────────────────────────────── */}
        {prompt === 'reject' && (
          <div className="space-y-3 rounded-lg border border-rose-500/30 bg-rose-500/[0.05] p-3">
            <Field label="Why is this being rejected? (shown to the user)">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder="e.g. Withdrawable balance could not be verified"
                className={inputClass}
              />
            </Field>
            <div className="flex gap-2">
              <Button
                disabled={busy != null || reason.trim() === ''}
                onClick={() => act('reject', { reason: reason.trim() })}
              >
                {busy === 'reject' ? 'Rejecting…' : 'Confirm rejection'}
              </Button>
              <Button variant="ghost" onClick={() => setPrompt(null)}>
                Cancel
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              The reserved points are released back to the user. Nothing is debited.
            </p>
          </div>
        )}

        {prompt === 'complete' && (
          <div className="space-y-4 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] p-3">
            <div>
              <div className="text-sm font-medium text-zinc-200">
                Pay {detail.amount} {detail.tokenSymbol} to {shorten(detail.walletAddress)}
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                The backend re-reads the transfer from the chain afterwards and refuses anything
                that does not match this request&apos;s token, amount, sender and recipient — the
                user&apos;s points are debited only once it does.
              </p>
            </div>

            {/* ── Path 1: sign and send from the connected wallet ───────── */}
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Pay from the connected wallet
              </div>
              {!wallet.connected ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Connect the treasury wallet at the top of this page to send the transfer from
                  here.
                </p>
              ) : !treasuryAuthorised ? (
                <p className="mt-1 text-xs text-rose-300">
                  The connected wallet is not on the treasury allow-list, so the backend would
                  refuse this payout after the tokens had already moved. Connect an authorised
                  wallet instead.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-zinc-500">
                    Sends {detail.amount} {detail.tokenSymbol} to {shorten(detail.walletAddress)},
                    then settles the request with the resulting signature. Creates the
                    recipient&apos;s token account first if they do not have one.
                  </p>
                  <div className="mt-2">
                    <Button
                      disabled={busy != null || wallet.sending || sentHash != null}
                      onClick={() => void payFromWallet()}
                    >
                      {wallet.sending
                        ? 'Confirm in your wallet…'
                        : busy === 'complete'
                          ? 'Settling…'
                          : `Send ${detail.amount} ${detail.tokenSymbol}`}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* ── Path 2: a payout signed somewhere else ───────────────── */}
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Settle a payout already sent
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                For a transfer signed outside this panel — or to retry settling one that was sent
                here but did not confirm in time.
              </p>
              <div className="mt-2">
                <Field label="Payout transaction signature">
                  <input
                    value={txSig}
                    onChange={(e) => setTxHash(e.target.value.trim())}
                    placeholder="Base58 transaction signature"
                    className={inputClass + ' font-mono'}
                  />
                </Field>
              </div>
              <div className="mt-2">
                <Button
                  variant="ghost"
                  disabled={busy != null || !isSolanaSignature(txSig)}
                  onClick={() => act('complete', { transactionSignature: txSig })}
                >
                  {busy === 'complete' ? 'Verifying on-chain…' : 'Verify & complete'}
                </Button>
              </div>
            </div>

            {/* A sent-but-unsettled payout must never be hidden — it is the only
                record that real tokens have already left the treasury. */}
            {sentHash && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-amber-500/80">
                  Payout sent — do not send again
                </div>
                <div className="mt-1 break-all font-mono text-xs text-amber-200">{sentHash}</div>
              </div>
            )}

            {payNote && (
              <div className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-zinc-400">
                <span className="text-cyan-300">◷</span>
                <span>{payNote}</span>
              </div>
            )}

            <Button variant="ghost" disabled={busy != null} onClick={() => setPrompt(null)}>
              Cancel
            </Button>
          </div>
        )}

        {prompt === 'fail' && (
          <div className="space-y-3 rounded-lg border border-rose-500/30 bg-rose-500/[0.05] p-3">
            <Field label="What went wrong? (shown to the user)">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder="e.g. Transfer reverted — retrying"
                className={inputClass}
              />
            </Field>
            <div className="flex gap-2">
              <Button
                disabled={busy != null || reason.trim() === ''}
                onClick={() => act('fail', { reason: reason.trim() })}
              >
                {busy === 'fail' ? 'Saving…' : 'Mark as failed'}
              </Button>
              <Button variant="ghost" onClick={() => setPrompt(null)}>
                Cancel
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              The points stay reserved so the payout can be retried.
            </p>
          </div>
        )}

        {prompt == null && (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
            {allowed.approve && (
              <Button
                disabled={busy != null}
                // Approving leads straight into the payout step: approve, then
                // wallet, then transfer, without hunting for a second button.
                onClick={() =>
                  void act(
                    'approve',
                    adminNote.trim() ? { adminNote: adminNote.trim() } : {},
                  ).then((ok) => {
                    if (ok) setPrompt('complete');
                  })
                }
              >
                {busy === 'approve' ? 'Approving…' : '✓ Approve & pay…'}
              </Button>
            )}
            {allowed.processing && (
              <Button variant="ghost" disabled={busy != null} onClick={() => act('processing')}>
                {busy === 'processing' ? 'Saving…' : '◷ Mark processing'}
              </Button>
            )}
            {allowed.complete && (
              <Button disabled={busy != null} onClick={() => setPrompt('complete')}>
                $ Send payout…
              </Button>
            )}
            {allowed.fail && (
              <Button variant="ghost" disabled={busy != null} onClick={() => setPrompt('fail')}>
                ⚠ Mark failed…
              </Button>
            )}
            {allowed.reject && (
              <Button variant="danger" disabled={busy != null} onClick={() => setPrompt('reject')}>
                ✕ Reject…
              </Button>
            )}
            {!allowed.approve &&
              !allowed.reject &&
              !allowed.processing &&
              !allowed.complete &&
              !allowed.fail && (
                <p className="text-sm text-zinc-500">
                  This request is settled — no further action is possible.
                </p>
              )}
          </div>
        )}

        {prompt == null && allowed.approve && (
          <Field label="Optional note to attach on approval">
            <input
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              maxLength={500}
              placeholder="Visible to the user"
              className={inputClass}
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}
