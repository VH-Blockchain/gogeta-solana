'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import type {
  PointPurchaseDetail,
  PointPurchaseStatus,
  PointPurchasesPage,
  PointsStatus,
} from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  Distribution,
  MiniStat,
  Modal,
  Spinner,
  inputClass,
  selectClass,
} from '@/components/ui';

const STATUS_COLOR: Record<PointPurchaseStatus, string> = {
  PENDING: 'amber',
  CONFIRMED: 'green',
  FAILED: 'red',
  EXPIRED: 'zinc',
  CANCELLED: 'zinc',
};

/** Pending / Confirmed / Failed lead, per the spec's filter list. */
const STATUS_ORDER: PointPurchaseStatus[] = [
  'PENDING',
  'CONFIRMED',
  'FAILED',
  'EXPIRED',
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
 * Points purchases (new_features.md §13).
 *
 * Read-only by design: there is no action here that credits points. A purchase
 * becomes CONFIRMED only when the backend has verified the payment on-chain, so
 * exposing a manual "mark confirmed" button would be a way to mint points
 * outside that check. Corrections go through Users → adjust coins, which writes
 * its own audit entry.
 */
export default function PointsPage() {
  const [page, setPage] = useState<PointPurchasesPage | null>(null);
  const [status, setStatus] = useState<PointsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPage(
        await api<PointPurchasesPage>('/admin/points/purchases', {
          query: { skip, take: TAKE, status: statusFilter, search },
        }),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [skip, statusFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<PointsStatus>('/admin/points/status')
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  // Pending purchases resolve on their own once the chain confirms, so the list
  // refreshes itself — but not while a detail dialog is open.
  useEffect(() => {
    if (viewingId) return;
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load, viewingId]);

  function copy(value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(value);
      setTimeout(() => setCopied((c) => (c === value ? null : c)), 1200);
    });
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await api<PointPurchasesPage>('/admin/points/purchases', {
        query: { skip: 0, take: 100, status: statusFilter, search },
      });
      downloadCsv(
        `gogeta-point-purchases-${new Date().toISOString().slice(0, 10)}.csv`,
        res.items.map((p) => ({
          id: p.id,
          user: p.user.email,
          walletAddress: p.walletAddress,
          usdcAmount: p.usdcAmount,
          points: p.points,
          exchangeRate: p.exchangeRate,
          network: p.network,
          transactionSignature: p.transactionSignature ?? '',
          status: p.status,
          createdAt: p.createdAt,
          completedAt: p.completedAt ?? '',
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

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Points purchases</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Points bought with USDC on Solana. Every confirmed row was verified against the chain
            before points were credited.
          </p>
        </div>
        {status && (
          <Badge color={status.enabled ? 'green' : 'red'}>
            {status.enabled ? '● Purchasing live' : '■ Purchasing unavailable'}
          </Badge>
        )}
      </div>

      {status && !status.enabled && (
        <Card className="mt-4 border border-amber-500/30 p-4">
          <div className="text-sm text-amber-300">
            {status.configError ?? 'Buying points is turned off in Settings → Points economy.'}
          </div>
          {!status.rpcReachable && (
            <div className="mt-1 text-xs text-zinc-500">
              The Solana RPC at {status.network.rpcUrl} could not be reached.
            </div>
          )}
        </Card>
      )}

      {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <MiniStat label="Purchases" sub="all statuses" value={page?.total ?? '—'} icon="◈" accent="azure" />
          <MiniStat
            label="Confirmed"
            value={page?.totals.confirmedPurchases ?? '—'}
            icon="✓"
            accent="aura"
          />
          <MiniStat
            label="Points credited"
            value={(page?.totals.pointsCredited ?? 0).toLocaleString()}
            icon="◆"
            accent="violet"
          />
          <MiniStat
            label="USDC collected"
            value={page?.totals.usdcCollected ?? '—'}
            icon="$"
            accent="amber"
          />
        </div>
        <Card className="p-5">
          <div className="mb-3 text-sm font-medium text-zinc-300">Status breakdown</div>
          <Distribution
            items={STATUS_ORDER.map((s) => ({
              label: s,
              value: counts[s] ?? 0,
              accent:
                s === 'CONFIRMED'
                  ? ('aura' as const)
                  : s === 'PENDING'
                    ? ('amber' as const)
                    : s === 'FAILED'
                      ? ('rose' as const)
                      : ('teal' as const),
            })).filter((i) => i.value > 0)}
            total={Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0)}
          />
          {status && (
            <div className="mt-4 border-t border-white/5 pt-3 text-xs text-zinc-500">
              <div>Rate: {status.rate.usdcToPoints} points per USDC</div>
              <div className="mt-0.5">
                Limits: {status.rate.minUsdc}–{status.rate.maxUsdc} USDC per purchase
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
          className={inputClass + ' max-w-sm'}
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
                <th className="w-28 px-4 py-3 text-right">USDC</th>
                <th className="w-28 px-4 py-3 text-right">Points</th>
                <th className="w-20 px-4 py-3 text-right">Rate</th>
                <th className="w-40 px-4 py-3">Transaction</th>
                <th className="w-28 px-4 py-3">Status</th>
                <th className="w-36 px-4 py-3">Created</th>
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
              {items?.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setViewingId(p.id)}
                  className="cursor-pointer border-b border-zinc-800/60 align-top last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-200">{p.user.name}</div>
                    <div className="text-xs text-zinc-500">{p.user.email}</div>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => copy(p.walletAddress)}
                      title={p.walletAddress}
                      className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                    >
                      {copied === p.walletAddress ? 'Copied!' : shorten(p.walletAddress)}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.usdcAmount}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-300">
                    +{p.points.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{p.exchangeRate}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {p.transactionSignature ? (
                      <a
                        href={p.explorerUrl ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        title={p.transactionSignature}
                        className="font-mono text-xs text-cyan-300 underline decoration-dotted underline-offset-2 hover:text-cyan-200"
                      >
                        {shorten(p.transactionSignature)} ↗
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-600">not paid yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[p.status]}>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {fmtDate(p.createdAt)}
                    {p.completedAt && (
                      <div className="text-zinc-600">paid {fmtDate(p.completedAt)}</div>
                    )}
                  </td>
                </tr>
              ))}
              {items?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                    No points purchases yet.
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
            <Button variant="ghost" disabled={skip + TAKE >= page.total} onClick={() => setSkip(skip + TAKE)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {viewingId && <PurchaseDetailModal id={viewingId} onClose={() => setViewingId(null)} />}
    </div>
  );
}

function PurchaseDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<PointPurchaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<PointPurchaseDetail>(`/admin/points/purchases/${id}`)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [id]);

  if (error) {
    return (
      <Modal title="Purchase" onClose={onClose}>
        <p className="text-sm text-rose-400">{error}</p>
      </Modal>
    );
  }
  if (!detail) {
    return (
      <Modal title="Purchase" onClose={onClose}>
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      </Modal>
    );
  }

  const rows: [string, ReactNode][] = [
    ['Status', <Badge key="s" color={STATUS_COLOR[detail.status]}>{detail.status}</Badge>],
    ['Purchase ID', detail.id],
    ['User', `${detail.user.name} · ${detail.user.email}`],
    ['User balance now', detail.user.coins.toLocaleString()],
    ['Wallet address', detail.walletAddress],
    ['USDC amount', detail.usdcAmount],
    ['USDC (token units)', detail.usdcAmountRaw],
    ['Points', `+${detail.points.toLocaleString()}`],
    ['Exchange rate', `${detail.exchangeRate} points per USDC`],
    ['Network', detail.network],
    ['USDC mint', detail.tokenMint],
    ['Receiving wallet', detail.receiverAddress],
    ['Block', detail.blockNumber ?? '—'],
    ['Created', fmtDate(detail.createdAt)],
    ['Confirmed', fmtDate(detail.completedAt)],
    ['Intent expires', fmtDate(detail.expiresAt)],
  ];

  return (
    <Modal title={`Purchase · ${detail.usdcAmount} USDC`} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-4">
        {detail.failureReason && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.07] px-3 py-2 text-sm text-rose-300">
            {detail.failureReason}
          </div>
        )}

        {detail.transactionSignature && (
          <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-zinc-500">Transaction</div>
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

        <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex min-w-0 items-start justify-between gap-4 border-b border-white/5 py-1.5">
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
                <span className="shrink-0 tabular-nums text-emerald-300">
                  +{detail.coinTransaction.amount.toLocaleString()}
                </span>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Balance after {detail.coinTransaction.balanceAfter.toLocaleString()} ·{' '}
                {fmtDate(detail.coinTransaction.createdAt)}
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              No ledger entry — points are only booked once a payment is verified.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
