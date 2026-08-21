'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Accent, Badge, Card, Modal, Spinner } from '@/components/ui';
import { downloadCsv } from '@/lib/csv';

interface Entry {
  rank: number;
  name: string;
  username: string;
  score: number;
  coins: number;
  accuracy: number;
  topBadge?: string | null;
}
interface Board {
  entries: Entry[];
}
interface Snapshot {
  id: string;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  periodKey: string;
  rankings: Entry[];
  createdAt: string;
}

const PERIODS = ['daily', 'weekly', 'monthly'] as const;
type Period = (typeof PERIODS)[number];
const medal = (rank: number) => (rank === 1 ? 'amber' : rank === 3 ? 'violet' : 'zinc');

export default function LeaderboardPage() {
  const [mode, setMode] = useState<'live' | 'history'>('live');
  const [period, setPeriod] = useState<Period>('daily');

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
      <p className="mt-1 text-sm text-zinc-500">Live rankings and saved period snapshots.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          {(['live', 'history'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize transition ${
                mode === m ? 'bg-gradient-to-r from-cyan-300 to-blue-600 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-4 py-2 text-sm capitalize transition ${
                period === p ? 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30' : 'text-zinc-400 hover:bg-white/5'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {mode === 'live' ? <LiveBoard period={period} /> : <HistoryBoard period={period} />}
    </div>
  );
}

function LiveBoard({ period }: { period: Period }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBoard(null);
    setError(null);
    try {
      setBoard(await api<Board>('/leaderboard', { query: { period } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [period]);
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="mt-4 text-sm text-rose-400">{error}</p>;
  if (!board)
    return (
      <div className="mt-10 flex justify-center">
        <Spinner />
      </div>
    );
  return (
    <>
      {board.entries.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
            onClick={() => exportEntries(`gogeta-leaderboard-${period}`, board.entries)}
          >
            ⬇ Export CSV
          </button>
        </div>
      )}
      {board.entries.length > 0 && <Podium entries={board.entries.slice(0, 3)} />}
      <RankTable entries={board.entries} emptyText="No ranked users for this period." />
    </>
  );
}

function exportEntries(name: string, entries: Entry[]) {
  downloadCsv(
    `${name}-${new Date().toISOString().slice(0, 10)}.csv`,
    entries.map((e) => ({
      rank: e.rank,
      name: e.name,
      username: e.username,
      score: e.score,
      coins: e.coins,
      accuracy: `${Math.round(e.accuracy * 100)}%`,
      topBadge: e.topBadge ?? '',
    })),
  );
}

/* Top-3 spotlight cards above the rankings table. */
function Podium({ entries }: { entries: Entry[] }) {
  // Visual order: 2nd · 1st · 3rd, with the winner raised in the centre.
  const slots = [entries[1], entries[0], entries[2]].filter(Boolean);
  const accentFor = (rank: number): Accent => (rank === 1 ? 'amber' : rank === 2 ? 'sky' : 'violet');
  const ACC: Record<Accent, { from: string; to: string; ring: string }> = {
    amber: { from: 'from-amber-300', to: 'to-orange-500', ring: 'ring-amber-400/40' },
    sky: { from: 'from-sky-400', to: 'to-blue-500', ring: 'ring-sky-400/40' },
    violet: { from: 'from-violet-400', to: 'to-fuchsia-500', ring: 'ring-violet-400/40' },
    aura: { from: 'from-cyan-300', to: 'to-blue-500', ring: 'ring-cyan-400/40' },
    azure: { from: 'from-blue-400', to: 'to-indigo-600', ring: 'ring-blue-400/40' },
    teal: { from: 'from-teal-300', to: 'to-cyan-600', ring: 'ring-teal-400/40' },
    rose: { from: 'from-rose-400', to: 'to-pink-500', ring: 'ring-rose-400/40' },
  };
  return (
    <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
      {slots.map((e) => {
        const a = ACC[accentFor(e.rank)];
        const raised = e.rank === 1;
        return (
          <Card key={e.rank} className={`flex flex-col items-center p-4 text-center ${raised ? 'sm:-translate-y-2' : ''}`}>
            <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${a.from} ${a.to} text-lg font-bold text-zinc-950 shadow-lg ring-2 ${a.ring}`}>
              {e.rank === 1 ? '👑' : e.rank}
            </div>
            <div className="mt-2 line-clamp-1 text-sm font-semibold">{e.name}</div>
            {/* username already carries its own leading @ (see the table
                row below, which doesn't re-add one) */}
            <div className="text-xs text-zinc-500">{e.username}</div>
            <div className="mt-2 text-lg font-semibold tabular-nums">{e.score.toLocaleString()}</div>
            <div className="text-[11px] text-zinc-500">{Math.round((e.accuracy ?? 0) * 100)}% acc · {e.coins.toLocaleString()} 🪙</div>
          </Card>
        );
      })}
    </div>
  );
}

function HistoryBoard({ period }: { period: Period }) {
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Snapshot | null>(null);

  useEffect(() => {
    setSnaps(null);
    setError(null);
    api<Snapshot[]>('/admin/leaderboard/snapshots', { query: { period: period.toUpperCase() } })
      .then(setSnaps)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [period]);

  if (error) return <p className="mt-4 text-sm text-rose-400">{error}</p>;
  if (!snaps)
    return (
      <div className="mt-10 flex justify-center">
        <Spinner />
      </div>
    );

  return (
    <>
      <Card className="mt-4 overflow-hidden">
        {snaps.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">
            No {period} snapshots yet — they&apos;re saved automatically at period close (or run a close from the API).
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Ranked</th>
                <th className="px-4 py-3">Winner</th>
                <th className="px-4 py-3">Captured</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {snaps.map((s) => (
                <tr key={s.id} className="cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/5" onClick={() => setOpen(s)}>
                  <td className="px-4 py-3 font-mono">{s.periodKey}</td>
                  <td className="px-4 py-3 tabular-nums text-zinc-400">{s.rankings.length}</td>
                  <td className="px-4 py-3">{s.rankings[0]?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-500">{new Date(s.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-zinc-500">View ↗</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {open && (
        <Modal title={`${open.period} · ${open.periodKey}`} onClose={() => setOpen(null)}>
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
              onClick={() => exportEntries(`gogeta-snapshot-${open.period.toLowerCase()}-${open.periodKey}`, open.rankings)}
            >
              ⬇ Export CSV
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <RankTable entries={open.rankings} emptyText="No rankings recorded." compact />
          </div>
        </Modal>
      )}
    </>
  );
}

function RankTable({ entries, emptyText, compact }: { entries: Entry[]; emptyText: string; compact?: boolean }) {
  const body = (
    <table className="w-full text-sm">
      <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-zinc-500">
        <tr>
          <th className="px-4 py-3">Rank</th>
          <th className="px-4 py-3">User</th>
          <th className="px-4 py-3">Score</th>
          <th className="px-4 py-3">Accuracy</th>
          <th className="px-4 py-3">Coins</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.rank} className="border-b border-white/5 last:border-0">
            <td className="px-4 py-3">
              <Badge color={medal(e.rank)}>#{e.rank}</Badge>
            </td>
            <td className="px-4 py-3">
              <div className="font-medium">{e.name}</div>
              <div className="text-xs text-zinc-500">{e.username}</div>
            </td>
            <td className="px-4 py-3 tabular-nums">{e.score.toLocaleString()}</td>
            <td className="px-4 py-3 tabular-nums text-zinc-400">{Math.round((e.accuracy ?? 0) * 100)}%</td>
            <td className="px-4 py-3 tabular-nums text-amber-300">{e.coins.toLocaleString()}</td>
          </tr>
        ))}
        {entries.length === 0 && (
          <tr>
            <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
              {emptyText}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
  return compact ? body : <Card className="mt-4 overflow-hidden">{body}</Card>;
}
