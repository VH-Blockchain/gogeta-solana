'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AdminPrediction, Analytics, AuditEntry, ClosedPredictionAnalytics } from '@/lib/types';
import { downloadCsv } from '@/lib/csv';
import { Card, MiniStat, Spinner } from '@/components/ui';
import {
  EntriesByPredictionBars,
  PayoutSplitDonut,
  PayoutTrendArea,
  WonLostDonut,
} from '@/components/charts';

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Analytics | null>(null);
  const [closed, setClosed] = useState<ClosedPredictionAnalytics | null>(null);
  const [days, setDays] = useState(0); // 0 = all time
  const [error, setError] = useState<string | null>(null);

  // KPIs stay fresh while the dashboard is open.
  useEffect(() => {
    const fetchKpis = () =>
      api<Analytics>('/admin/analytics')
        .then(setData)
        .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
    fetchKpis();
    const t = setInterval(fetchKpis, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    api<ClosedPredictionAnalytics>('/admin/analytics/closed-predictions', {
      query: { take: 10, ...(days > 0 ? { days } : {}) },
    })
      .then(setClosed)
      .catch(() => {});
  }, [days]);

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      {/* Slim header: greeting inline + quick actions. */}
      <Card className="relative overflow-hidden p-4">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-cyan-300 to-blue-700 opacity-25 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {greet}, {user?.name ?? 'Admin'} 👋
            </h1>
            <p className="text-xs text-zinc-500">Here&apos;s how GOGETA is performing today.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/predictions#new" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-300 to-blue-600 px-3 text-xs font-semibold text-zinc-900 hover:opacity-90">
              + New prediction
            </Link>
            <Link href="/settings#broadcast" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 hover:bg-white/5">
              <span>📣</span> Broadcast
            </Link>
            <Link href="/users" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 hover:bg-white/5">
              <span>👥</span> Manage users
            </Link>
          </div>
        </div>
      </Card>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {!data && !error ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : data ? (
        /* Compact, clickable KPI strip. */
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiTile href="/users" icon="◎" accent="text-teal-300" value={`${Math.round(data.avgAccuracy * 100)}%`} label="Avg accuracy" />
          <KpiTile href="/users" icon="●" accent="text-blue-300" value={`${data.activeUsers} / ${data.totalUsers}`} label="Active users" />
          <KpiTile href="/users" icon="👥" accent="text-cyan-300" value={data.totalUsers} label="Total users" />
          <KpiTile href="/lucky-winners" icon="🪙" accent="text-amber-300" value={data.coinsDistributed.toLocaleString()} label="Coins paid out" />
          <KpiTile href="/predictions" icon="◉" accent="text-sky-300" value={data.dailyPredictions} label="Predictions today" />
          <KpiTile href="/predictions" icon="✓" accent="text-violet-300" value={data.predictionsResolved} label="Resolved" />
        </div>
      ) : null}

      <NeedsAttention />

      {closed && (
        <ClosedAnalytics closed={closed} days={days} onDays={setDays} />
      )}

      <ActivityFeed />
    </div>
  );
}

/** The admin's to-do list: locked predictions awaiting a result and open
 *  ones closing within 24h. Each row links to the filtered predictions list. */
function NeedsAttention() {
  const [locked, setLocked] = useState<AdminPrediction[] | null>(null);
  const [closingSoon, setClosingSoon] = useState<AdminPrediction[] | null>(null);

  useEffect(() => {
    // AUTO_RESOLVED predictions already have a Polymarket-detected winner —
    // they're a faster win for the admin (one-click confirm) than a bare
    // LOCKED one, so they're listed first, ahead of plain LOCKED items.
    Promise.all([
      api<{ items: AdminPrediction[] }>('/admin/predictions', { query: { status: 'AUTO_RESOLVED', take: 5 } }),
      api<{ items: AdminPrediction[] }>('/admin/predictions', { query: { status: 'LOCKED', take: 5 } }),
    ])
      .then(([autoResolved, lockedOnly]) => setLocked([...autoResolved.items, ...lockedOnly.items].slice(0, 5)))
      .catch(() => setLocked([]));
    api<{ items: AdminPrediction[] }>('/admin/predictions', { query: { status: 'OPEN', take: 100 } })
      .then((r) => {
        const dayAhead = Date.now() + 24 * 60 * 60 * 1000;
        setClosingSoon(
          r.items
            .filter((p) => new Date(p.closesAt).getTime() <= dayAhead)
            .sort((a, b) => new Date(a.closesAt).getTime() - new Date(b.closesAt).getTime())
            .slice(0, 5),
        );
      })
      .catch(() => setClosingSoon([]));
  }, []);

  if (locked === null || closingSoon === null) return null;
  if (locked.length === 0 && closingSoon.length === 0) return null;

  const timeLeft = (iso: string) => {
    const mins = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  };

  return (
    <Card className="border-amber-500/20 p-5">
      <div className="flex items-center gap-2">
        <span>⚡</span>
        <h2 className="text-base font-semibold">Needs your attention</h2>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {locked.length > 0 && (
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-300">Awaiting result</p>
              <Link href="/predictions#locked" className="text-xs text-amber-300 hover:underline">
                See all →
              </Link>
            </div>
            <ul className="mt-2 space-y-1.5">
              {locked.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/predictions#resolve=${p.id}`}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                      p.status === 'AUTO_RESOLVED'
                        ? 'border-teal-500/20 bg-teal-500/[0.04] hover:border-teal-500/40'
                        : 'border-white/5 bg-white/[0.02] hover:border-amber-500/40'
                    }`}
                  >
                    <span className="truncate text-zinc-200">
                      {p.title}
                      {p.status === 'AUTO_RESOLVED' && (
                        <span className="ml-2 rounded-full bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-medium text-teal-300">
                          auto-detected
                        </span>
                      )}
                    </span>
                    <span className={`ml-3 shrink-0 text-xs ${p.status === 'AUTO_RESOLVED' ? 'text-teal-300' : 'text-amber-300'}`}>
                      {p.status === 'AUTO_RESOLVED' ? 'Confirm →' : 'Resolve →'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {closingSoon.length > 0 && (
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-sky-300">Closing within 24h</p>
              <Link href="/predictions#closing24h" className="text-xs text-sky-300 hover:underline">
                See all →
              </Link>
            </div>
            <ul className="mt-2 space-y-1.5">
              {closingSoon.map((p) => (
                <li key={p.id}>
                  <Link
                    href="/predictions#closing24h"
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm transition hover:border-sky-500/40"
                  >
                    <span className="truncate text-zinc-200">{p.title}</span>
                    <span className="ml-3 shrink-0 tabular-nums text-xs text-sky-300">{timeLeft(p.closesAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Small clickable stat — the whole tile navigates to its section. */
function KpiTile({
  href,
  icon,
  accent,
  value,
  label,
}: {
  href: string;
  icon: string;
  accent: string;
  value: string | number;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-white/15 hover:bg-white/[0.05]"
    >
      <div className="flex items-center gap-2">
        <span className={`text-sm ${accent}`}>{icon}</span>
        <span className="truncate text-lg font-semibold text-zinc-100">{value}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between text-[11px] text-zinc-500">
        <span>{label}</span>
        <span className="opacity-0 transition group-hover:opacity-100">→</span>
      </div>
    </Link>
  );
}

// Kept in sync with every `auditLog.create({ action: '...' })` call site in
// the backend's admin.service.ts — an action missing here still shows (via
// the fallback below), just without a friendly icon/label/tone.
const ACTION_LABEL: Record<string, { label: string; icon: string; tone: string }> = {
  'resolve-prediction': { label: 'Resolved prediction', icon: '✓', tone: 'text-emerald-300' },
  'adjust-coins': { label: 'Adjusted points', icon: '🪙', tone: 'text-amber-300' },
  'suspend-user': { label: 'Changed suspension', icon: '⊘', tone: 'text-rose-300' },
  'duplicate-prediction': { label: 'Duplicated prediction', icon: '⧉', tone: 'text-sky-300' },
  broadcast: { label: 'Sent announcement', icon: '📣', tone: 'text-violet-300' },
  'set-role': { label: 'Changed user role', icon: '★', tone: 'text-indigo-300' },
  'update-setting': { label: 'Updated a setting', icon: '⚙', tone: 'text-zinc-300' },
  'replace-lucky-winner': { label: 'Replaced lucky winner', icon: '🔁', tone: 'text-fuchsia-300' },
};

/** Action-aware summary of an audit-log row's meta — falls back generically
 *  for any action not special-cased here. */
function auditDetail(r: AuditEntry): string {
  const meta = r.meta as Record<string, unknown> | null;
  if (r.action === 'replace-lucky-winner') {
    return typeof meta?.amount === 'number' ? `${meta.amount} points reassigned` : (r.target ?? '');
  }
  if (r.action === 'set-role') {
    return typeof meta?.role === 'string' ? `→ ${meta.role}` : (r.target ?? '');
  }
  if (r.action === 'update-setting') {
    const shown = meta && typeof meta === 'object' ? JSON.stringify(meta) : String(meta);
    return r.target ? `${r.target} = ${shown}` : shown;
  }
  if (typeof meta?.title === 'string') return meta.title;
  if (typeof meta?.amount === 'number') return `${meta.amount > 0 ? '+' : ''}${meta.amount} points`;
  return r.target ?? '';
}

function ActivityFeed() {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    api<AuditEntry[]>('/admin/audit-log', { query: { take: 12 } })
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  if (!rows || rows.length === 0) return null;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Recent admin activity</h2>
      <p className="mt-1 text-sm text-zinc-500">Audit trail of critical actions.</p>
      <ul className="mt-4 divide-y divide-white/5">
        {rows.map((r) => {
          const info = ACTION_LABEL[r.action] ?? { label: r.action, icon: '•', tone: 'text-zinc-300' };
          const meta = r.meta as Record<string, unknown> | null;
          const detail =
            typeof meta?.title === 'string'
              ? meta.title
              : typeof meta?.amount === 'number'
                ? `${meta.amount > 0 ? '+' : ''}${meta.amount} points`
                : (r.target ?? '');
          return (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <span className="text-base">{info.icon}</span>
              <div className="min-w-0 flex-1">
                <span className={`text-sm font-medium ${info.tone}`}>{info.label}</span>
                {detail && <span className="ml-2 truncate text-sm text-zinc-400">{detail}</span>}
              </div>
              <span className="shrink-0 text-xs text-zinc-500">
                {r.actor ?? 'system'} · {new Date(r.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: 0 },
];

function ClosedAnalytics({
  closed,
  days,
  onDays,
}: {
  closed: ClosedPredictionAnalytics;
  days: number;
  onDays: (d: number) => void;
}) {
  const rows = closed.predictions;
  const totalWon = rows.reduce((s, p) => s + p.won, 0);
  const totalLost = rows.reduce((s, p) => s + p.lost, 0);

  const barData = rows.slice(0, 8).map((p) => ({
    name: p.title.length > 26 ? `${p.title.slice(0, 25)}…` : p.title,
    correct: p.won,
    incorrect: p.lost,
  }));

  const trendData = [...rows]
    .filter((p) => p.resolvedAt)
    .sort((a, b) => new Date(a.resolvedAt!).getTime() - new Date(b.resolvedAt!).getTime())
    .map((p) => ({
      date: new Date(p.resolvedAt!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      payout: p.payout,
    }));

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Closed predictions</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Analytics for resolved predictions — entries, accuracy and payouts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-white/10 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => onDays(r.days)}
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  days === r.days ? 'bg-cyan-500/15 text-cyan-300' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-zinc-500">last {rows.length} resolved</span>
          <button
            type="button"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
            onClick={() =>
              downloadCsv(
                `gogeta-closed-analytics-${new Date().toISOString().slice(0, 10)}.csv`,
                rows.map((p) => ({
                  title: p.title,
                  category: p.category,
                  winningOption: p.winningOption ?? '',
                  entries: p.entries,
                  correct: p.won,
                  incorrect: p.lost,
                  accuracy: `${Math.round(p.accuracy * 100)}%`,
                  rewardPaid: p.rewardPaid,
                  totalPayout: p.payout,
                  resolvedAt: p.resolvedAt ?? '',
                })),
              )
            }
          >
            ⬇ Export CSV
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <MiniStat label="Resolved" value={closed.totalResolved} icon="✓" accent="azure" />
        <MiniStat label="Total entries" value={closed.totalEntries} icon="◎" accent="aura" />
        <MiniStat label="Correct" value={`${Math.round(closed.avgAccuracy * 100)}%`} icon="◉" accent="teal" />
        <MiniStat label="Reward paid" value={closed.totalRewardPaid.toLocaleString()} icon="🪙" accent="amber" />
        <MiniStat label="Lucky paid" value={closed.totalLuckyPaid.toLocaleString()} icon="✨" accent="violet" />
      </div>

      {rows.length === 0 && (
        <p className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center text-sm text-zinc-500">
          No predictions were resolved in this period.
        </p>
      )}

      {/* Charts */}
      {rows.length > 0 && (
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h3 className="text-sm font-medium text-zinc-300">Entries per prediction</h3>
          <p className="text-xs text-zinc-500">Correct vs incorrect calls on recent resolutions</p>
          <div className="mt-3">
            <EntriesByPredictionBars data={barData} />
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <h3 className="text-sm font-medium text-zinc-300">Crowd accuracy</h3>
            <WonLostDonut won={totalWon} lost={totalLost} />
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <h3 className="text-sm font-medium text-zinc-300">Payout split</h3>
            <PayoutSplitDonut reward={closed.totalRewardPaid} lucky={closed.totalLuckyPaid} />
          </div>
        </div>
      </div>
      )}

      {trendData.length >= 2 && (
        <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h3 className="text-sm font-medium text-zinc-300">Payout per resolution</h3>
          <p className="text-xs text-zinc-500">Coins distributed as predictions resolved</p>
          <div className="mt-3">
            <PayoutTrendArea data={trendData} />
          </div>
        </div>
      )}

      {rows.length > 0 && (
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-zinc-500">
            <tr className="border-b border-white/10">
              <th className="py-2 pr-3 font-medium">Prediction</th>
              <th className="py-2 pr-3 font-medium">Winning option</th>
              <th className="py-2 pr-3 text-right font-medium">Entries</th>
              <th className="py-2 pr-3 font-medium">Accuracy</th>
              <th className="py-2 text-right font-medium">Payout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="py-2.5 pr-3">
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-zinc-500">{p.category}</div>
                </td>
                <td className="py-2.5 pr-3">
                  {p.winningOption ? (
                    <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                      {p.winningOption}
                    </span>
                  ) : (
                    <span className="text-zinc-500">—</span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{p.entries}</td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${Math.round(p.accuracy * 100)}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-xs text-zinc-400">{Math.round(p.accuracy * 100)}%</span>
                  </div>
                </td>
                <td className="py-2.5 text-right">
                  <div className="tabular-nums text-amber-300">{p.payout.toLocaleString()}</div>
                  <div className="text-[11px] text-zinc-500">{p.rewardPaid.toLocaleString()} reward</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </Card>
  );
}

