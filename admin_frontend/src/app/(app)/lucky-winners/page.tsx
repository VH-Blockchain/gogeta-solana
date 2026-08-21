'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Button, Card, Field, Modal, Spinner, StatCard, inputClass } from '@/components/ui';

interface Winner {
  id: string;
  userId: string;
  name: string;
  username: string;
  amount: number;
}

interface Draw {
  id: string;
  /** Null only for legacy per-prediction draws from before this became a
   *  once-daily pool. */
  dayKey: string | null;
  drawDate: string;
  winnersCount: number;
  bonusPerWinner: number;
  eligibleCount: number;
  winners: Winner[];
}

interface EligibleUser {
  id: string;
  name: string;
  username: string;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export default function LuckyWinnersPage() {
  const [draws, setDraws] = useState<Draw[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<{ draw: Draw; winner: Winner } | null>(null);

  const load = useCallback(async () => {
    try {
      setDraws(await api<Draw[]>('/admin/lucky-draws', { query: { take: 30 } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const todaysDraws = draws?.filter((d) => isToday(d.drawDate)) ?? [];
  const todaysWinners = todaysDraws.flatMap((d) => d.winners);
  const totalToday = todaysWinners.reduce((s, w) => s + w.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lucky winners</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Winners are drawn automatically once per day at 11:55 PM, pooled from everyone with at least one correct
          prediction that day (seeded &amp; auditable). Admins can manually replace an individual winner below — e.g.
          to correct fraud or an error — without changing how the draw itself works.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Winners today" value={todaysWinners.length} icon="✦" accent="aura" />
        <StatCard label="Coins paid out today" value={totalToday.toLocaleString()} icon="🪙" accent="amber" sub="bonus rewards" />
        <StatCard label="Draws today" value={todaysDraws.length} icon="🎲" accent="azure" />
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {!draws && !error && (
        <Card className="p-10">
          <div className="flex justify-center"><Spinner /></div>
        </Card>
      )}

      {draws?.length === 0 && (
        <Card className="p-10 text-center text-sm text-zinc-500">
          No lucky draws yet — they run automatically once a day, pooling everyone with a correct prediction that day.
        </Card>
      )}

      {draws?.map((draw) => (
        <Card key={draw.id} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <div>
              <div className="text-sm font-medium text-zinc-200">
                Lucky Draw — {draw.dayKey ?? new Date(draw.drawDate).toLocaleDateString()}
              </div>
              <div className="text-xs text-zinc-500">
                {new Date(draw.drawDate).toLocaleString()} · {draw.winners.length}/{draw.winnersCount} winners ·
                {' '}{draw.eligibleCount} eligible · {draw.bonusPerWinner} points each
              </div>
            </div>
            {isToday(draw.drawDate) && <Badge color="green">Today</Badge>}
          </div>
          <table className="w-full text-sm">
            <tbody>
              {draw.winners.map((w, i) => (
                <tr key={w.id} className="border-b border-white/5 last:border-0">
                  <td className="w-12 px-4 py-3 text-zinc-500">#{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{w.name}</div>
                    <div className="text-xs text-zinc-500">{w.username}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-amber-300">+{w.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" onClick={() => setReplacing({ draw, winner: w })}>Replace</Button>
                  </td>
                </tr>
              ))}
              {draw.winners.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                    No eligible users that day, so no lucky draw was held.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      ))}

      {replacing && (
        <ReplaceWinnerModal
          draw={replacing.draw}
          winner={replacing.winner}
          onClose={() => setReplacing(null)}
          onDone={() => { setReplacing(null); load(); }}
        />
      )}
    </div>
  );
}

function ReplaceWinnerModal({
  draw,
  winner,
  onClose,
  onDone,
}: {
  draw: Draw;
  winner: Winner;
  onClose: () => void;
  onDone: () => void;
}) {
  const [eligible, setEligible] = useState<EligibleUser[] | null>(null);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<EligibleUser[]>(`/admin/lucky-draws/${draw.id}/eligible`)
      .then((users) => { setEligible(users); if (users.length) setSelected(users[0].id); })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load eligible users'));
  }, [draw.id]);

  async function submit() {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/admin/lucky-draws/${draw.id}/winners/${winner.id}/replace`, {
        method: 'POST',
        body: { newUserId: selected },
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to replace winner');
      setBusy(false);
    }
  }

  const drawLabel = draw.dayKey ?? new Date(draw.drawDate).toLocaleDateString();
  return (
    <Modal title={`Replace winner — ${drawLabel}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">
          Removing <span className="font-medium text-zinc-200">{winner.name}</span> ({winner.username}) as a
          winner of this draw. Their {winner.amount} coin bonus will be reversed and credited to whoever replaces
          them instead.
        </p>
        {eligible === null && !err && <Spinner />}
        {eligible?.length === 0 && (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200/90">
            No other users had a correct prediction that day, so there is no eligible replacement — per the SOW,
            only users with a correct prediction that day qualify for its lucky draw.
          </p>
        )}
        {eligible && eligible.length > 0 && (
          <Field label="Replace with">
            <select value={selected} onChange={(e) => setSelected(e.target.value)} className={inputClass}>
              {eligible.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.username})</option>
              ))}
            </select>
          </Field>
        )}
        {err && <p className="text-sm text-rose-400">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !eligible?.length}>
            {busy ? 'Replacing…' : 'Replace winner'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
