'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { downloadCsv } from '@/lib/csv';
import type { AdminUser, LedgerRow, UserEntryRow, UsersPage } from '@/lib/types';
import { Badge, Button, Card, Field, MiniStat, Modal, Spinner, inputClass } from '@/components/ui';

const TAKE = 25;

export default function UsersPage() {
  const canEdit = useAuth().user?.role === 'ADMIN';
  const [data, setData] = useState<UsersPage | null>(null);
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjust, setAdjust] = useState<AdminUser | null>(null);
  const [detail, setDetail] = useState<AdminUser | null>(null);
  const [exporting, setExporting] = useState(false);
  // Tracks whether the search bar is currently pinned (sticky) so its top
  // gap can shrink only in that state — a sentinel just above it flips out
  // of view the instant the bar reaches top:0. Same pattern as Predictions.
  const [searchBarStuck, setSearchBarStuck] = useState(false);
  const searchBarSentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<UsersPage>('/admin/users', { query: { search, skip, take: TAKE } });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, skip]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const el = searchBarSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setSearchBarStuck(!entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await api<UsersPage>('/admin/users', { query: { search, skip: 0, take: 1000 } });
      downloadCsv(
        `gogeta-users-${new Date().toISOString().slice(0, 10)}.csv`,
        res.users.map((u) => ({
          email: u.email,
          username: u.username,
          name: u.name,
          coins: u.coins,
          level: u.level,
          predictions: u.totalPredictions,
          correct: u.correctPredictions,
          accuracy: u.totalPredictions ? Math.round((u.correctPredictions / u.totalPredictions) * 100) + '%' : '',
          streak: u.currentStreak,
          verified: u.isVerified,
          suspended: u.isSuspended,
          joined: u.createdAt,
          lastActive: u.lastActiveAt ?? '',
        })),
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function toggleRole(u: AdminUser) {
    const next = u.role === 'VIEWER' ? 'USER' : 'VIEWER';
    const warning =
      next === 'VIEWER'
        ? `Give ${u.email} read-only admin-panel access (VIEWER)?`
        : `Revoke ${u.email}'s admin-panel access?`;
    if (!confirm(warning)) return;
    try {
      await api(`/admin/users/${u.id}/role`, { method: 'POST', body: { role: next } });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function toggleSuspend(u: AdminUser) {
    const warning = u.isSuspended
      ? `Unsuspend ${u.email}? They regain full access.`
      : `Suspend ${u.email}? They will be blocked from the app.`;
    if (!confirm(warning)) return;
    try {
      await api(`/admin/users/${u.id}/suspend`, { method: 'POST', body: { suspended: !u.isSuspended } });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  }

  const total = data?.total ?? 0;
  const pageUsers = data?.users ?? [];
  const verified = pageUsers.filter((u) => u.isVerified && !u.isSuspended).length;
  const suspended = pageUsers.filter((u) => u.isSuspended).length;
  const avgAcc = pageUsers.length
    ? Math.round(
        (pageUsers.reduce((s, u) => s + (u.totalPredictions > 0 ? u.correctPredictions / u.totalPredictions : 0), 0) /
          pageUsers.length) *
          100,
      )
    : 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="mt-1 text-sm text-zinc-500">{total} total · manage points & access.</p>

      {data && (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MiniStat label="Total users" value={total.toLocaleString()} icon="👥" accent="azure" />
          <MiniStat label="Verified" value={verified} sub="this page" icon="✓" accent="aura" />
          <MiniStat label="Suspended" value={suspended} sub="this page" icon="⊘" accent="rose" />
          <MiniStat label="Avg accuracy" value={`${avgAcc}%`} sub="this page" icon="◎" accent="sky" />
        </div>
      )}

      {/* !bg-zinc-950/95 overrides .panel's 72%-opacity background (used by
          every Card) — sticky needs a near-opaque backdrop so scrolled rows
          don't ghost through behind the search bar as the list scrolls
          underneath it. Scoped to this one sticky instance, not global. */}
      <div ref={searchBarSentinelRef} />
      <Card
        className={`sticky top-0 z-10 flex flex-wrap items-center gap-3 p-3 !bg-zinc-950/95 transition-[margin] ${
          searchBarStuck ? 'mt-3' : 'mt-6'
        }`}
      >
        <input
          value={search}
          onChange={(e) => {
            setSkip(0);
            setSearch(e.target.value);
          }}
          placeholder="Search name, email, username…"
          className={inputClass + ' max-w-sm'}
        />
        <Button variant="ghost" onClick={exportCsv} disabled={exporting}>
          {exporting ? 'Exporting…' : '⬇ Export CSV'}
        </Button>
      </Card>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="w-24 px-4 py-3 text-right">Coins</th>
              <th className="w-20 px-4 py-3">Level</th>
              <th className="w-24 px-4 py-3 text-right">Accuracy</th>
              <th className="w-28 px-4 py-3">Status</th>
              <th className="w-80 px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-10">
                  <div className="flex justify-center">
                    <Spinner />
                  </div>
                </td>
              </tr>
            )}
            {!loading &&
              data?.users.map((u) => {
                const acc = u.totalPredictions > 0 ? Math.round((u.correctPredictions / u.totalPredictions) * 100) : 0;
                return (
                  <tr
                    key={u.id}
                    onClick={() => setDetail(u)}
                    className="cursor-pointer border-b border-zinc-800/60 last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-zinc-500">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{u.coins.toLocaleString()}</td>
                    <td className="px-4 py-3 text-zinc-400">{u.level}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{acc}%</td>
                    <td className="px-4 py-3">
                      {u.isSuspended ? (
                        <Badge color="red">Suspended</Badge>
                      ) : u.isVerified ? (
                        <Badge color="green">Verified</Badge>
                      ) : (
                        <Badge color="amber">Unverified</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap justify-end gap-2">
                        {u.role === 'VIEWER' && <Badge color="violet">VIEWER</Badge>}
                        {canEdit && (
                          <>
                            <Button variant="ghost" onClick={() => setAdjust(u)}>
                              Adjust points
                            </Button>
                            {u.role !== 'ADMIN' && (
                              <Button variant="ghost" onClick={() => toggleRole(u)}>
                                {u.role === 'VIEWER' ? 'Revoke viewer' : 'Make viewer'}
                              </Button>
                            )}
                            <Button variant={u.isSuspended ? 'ghost' : 'danger'} onClick={() => toggleSuspend(u)}>
                              {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            {!loading && data?.users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>

      {total > TAKE && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
          <span>
            {skip + 1}–{Math.min(skip + TAKE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - TAKE))}>
              Prev
            </Button>
            <Button variant="ghost" disabled={skip + TAKE >= total} onClick={() => setSkip(skip + TAKE)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {adjust && (
        <AdjustCoinsModal
          user={adjust}
          onClose={() => setAdjust(null)}
          onDone={() => {
            setAdjust(null);
            load();
          }}
        />
      )}
      {detail && <UserDetailModal user={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

interface UserDetail extends AdminUser {
  xp: number;
  bestStreak: number;
  entryCount: number;
  badgeCount: number;
  bio?: string | null;
}

function UserDetailModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [d, setD] = useState<UserDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'ledger' | 'entries'>('overview');
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null);
  const [entries, setEntries] = useState<UserEntryRow[] | null>(null);

  useEffect(() => {
    api<UserDetail>(`/admin/users/${user.id}`)
      .then(setD)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed'));
  }, [user.id]);

  useEffect(() => {
    if (tab === 'ledger' && ledger === null) {
      api<LedgerRow[]>(`/admin/users/${user.id}/ledger`).then(setLedger).catch(() => setLedger([]));
    }
    if (tab === 'entries' && entries === null) {
      api<UserEntryRow[]>(`/admin/users/${user.id}/entries`).then(setEntries).catch(() => setEntries([]));
    }
  }, [tab, user.id, ledger, entries]);

  const acc = d && d.totalPredictions > 0 ? Math.round((d.correctPredictions / d.totalPredictions) * 100) : 0;
  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString() : '—');

  const rows: [string, string | number][] = d
    ? [
        ['Level', d.level],
        ['XP', d.xp.toLocaleString()],
        ['Points', d.coins.toLocaleString()],
        ['Predictions', d.totalPredictions],
        ['Correct', `${d.correctPredictions} (${acc}%)`],
        ['Current streak', d.currentStreak],
        ['Best streak', d.bestStreak],
        ['Entries', d.entryCount],
        ['Badges', d.badgeCount],
        ['Verified', d.isVerified ? 'Yes' : 'No'],
        ['Suspended', d.isSuspended ? 'Yes' : 'No'],
        ['Last active', fmtDate(d.lastActiveAt)],
        ['Joined', fmtDate(d.createdAt)],
      ]
    : [];

  return (
    <Modal title={user.name} onClose={onClose}>
      <p className="-mt-2 mb-3 text-sm text-zinc-500">{user.email} · {user.username}</p>
      <div className="mb-4 flex gap-2">
        {(['overview', 'ledger', 'entries'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs capitalize transition ${
              tab === t ? 'bg-cyan-500/15 text-cyan-300' : 'text-zinc-400 hover:bg-zinc-800/60'
            }`}
          >
            {t === 'ledger' ? 'Points ledger' : t === 'entries' ? 'Predictions' : 'Overview'}
          </button>
        ))}
      </div>
      {err && <p className="text-sm text-rose-400">{err}</p>}

      {tab === 'overview' &&
        (!d && !err ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-white/5 py-1.5">
                <span className="text-zinc-500">{k}</span>
                <span className="font-medium text-zinc-200">{v}</span>
              </div>
            ))}
          </div>
        ))}

      {tab === 'ledger' &&
        (ledger === null ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : ledger.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">No transactions yet.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr className="border-b border-white/10">
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Description</th>
                  <th className="py-2 pr-3 text-right font-medium">Amount</th>
                  <th className="py-2 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ledger.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 pr-3"><Badge color="zinc">{t.type}</Badge></td>
                    <td className="py-2 pr-3 text-zinc-400">{t.description ?? '—'}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${t.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {t.amount >= 0 ? '+' : ''}{t.amount.toLocaleString()}
                    </td>
                    <td className="py-2 text-right text-xs text-zinc-500">
                      {new Date(t.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === 'entries' &&
        (entries === null ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">No predictions played yet.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr className="border-b border-white/10">
                  <th className="py-2 pr-3 font-medium">Prediction</th>
                  <th className="py-2 pr-3 font-medium">Pick</th>
                  <th className="py-2 pr-3 font-medium">Outcome</th>
                  <th className="py-2 text-right font-medium">Reward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 pr-3 text-zinc-300">{e.prediction}</td>
                    <td className="py-2 pr-3 text-zinc-400">{e.pick}</td>
                    <td className="py-2 pr-3">
                      <Badge color={e.status === 'WON' ? 'green' : e.status === 'LOST' ? 'red' : 'amber'}>{e.status}</Badge>
                    </td>
                    <td className="py-2 text-right tabular-nums text-amber-300">
                      {e.rewardEarned > 0 ? `+${e.rewardEarned.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </Modal>
  );
}

function AdjustCoinsModal({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [amountErr, setAmountErr] = useState<string | null>(null);

  async function submit() {
    setAmountErr(null);
    const n = parseInt(amount, 10);
    if (!n) {
      setAmountErr('Enter a non-zero amount (use a negative number to deduct).');
      setErr('Enter a non-zero amount (use a negative number to deduct).');
      return;
    }
    if (!confirm(`${n > 0 ? 'Add' : 'Deduct'} ${Math.abs(n)} points ${n > 0 ? 'to' : 'from'} ${user.email}? This writes to their ledger.`)) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api(`/admin/users/${user.id}/adjust-coins`, { method: 'POST', body: { amount: n, reason: reason || undefined } });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  }

  return (
    <Modal title={`Adjust points — ${user.name}`} onClose={onClose}>
      <p className="mb-4 text-sm text-zinc-500">Current balance: {user.coins.toLocaleString()} points</p>
      <div className="space-y-3">
        <Field label="Amount (+ to credit, − to deduct)" error={amountErr}>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Reason (optional)">
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
        </Field>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Apply'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
