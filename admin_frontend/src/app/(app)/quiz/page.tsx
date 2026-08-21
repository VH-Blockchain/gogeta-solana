'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { downloadCsv } from '@/lib/csv';
import type {
  QuizAnalytics,
  QuizCategory,
  QuizPhase,
  QuizQuestionCount,
  QuizQuestionRow,
  QuizQuestionsPage,
  QuizSessionDetail,
  QuizSessionRow,
  QuizSessionsPage,
  QuizQuestionDifficulty,
  QuizSettings,
  QuizUpcoming,
} from '@/lib/types';
import {
  QuizAccuracyDonut,
  QuizCategoryBars,
  QuizEntriesTrend,
  QuizOptionSpreadBars,
} from '@/components/charts';
import {
  Accent,
  Badge,
  Button,
  Card,
  Distribution,
  Field,
  MiniStat,
  Modal,
  ProgressBar,
  Spinner,
  inputClass,
  selectClass,
} from '@/components/ui';

const CATEGORIES: { value: QuizCategory; label: string }[] = [
  { value: 'POLITICS', label: 'Politics' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'ENTERTAINMENT', label: 'Entertainment' },
  { value: 'GENERAL_KNOWLEDGE', label: 'General Knowledge' },
];

const PHASE_COLOR: Record<QuizPhase, string> = {
  scheduled: 'violet',
  running: 'green',
  finished: 'blue',
  cancelled: 'red',
};
const PHASE_ORDER: QuizPhase[] = ['running', 'scheduled', 'finished', 'cancelled'];
const CATEGORY_ACCENTS: Record<QuizCategory, Accent> = {
  POLITICS: 'azure',
  SPORTS: 'aura',
  ENTERTAINMENT: 'violet',
  GENERAL_KNOWLEDGE: 'amber',
};
const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;
const TAKE = 25;

const categoryLabel = (c: QuizCategory) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** `mm:ss` for a duration in ms, floored at zero. */
function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

/**
 * A once-per-second tick plus the browser↔server clock offset.
 *
 * The backend is the sole source of truth for quiz timing (it derives every
 * session's start/end from its own wall clock), so countdowns here are drawn
 * against `serverNow`, not `Date.now()` — an admin whose machine is a minute
 * out would otherwise watch a timer that disagrees with the actual sessions.
 */
function useServerClock(serverNowIso: string | undefined): number {
  const [offsetMs, setOffsetMs] = useState(0);
  const [localNow, setLocalNow] = useState(() => Date.now());

  useEffect(() => {
    if (serverNowIso) setOffsetMs(Date.parse(serverNowIso) - Date.now());
  }, [serverNowIso]);

  useEffect(() => {
    const id = setInterval(() => setLocalNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Returns a *value*, not a getter. A stable `() => Date.now() + offset`
  // callback looks tidier but is invisible to the React Compiler: the child
  // holding the countdown is memoized on its props, so with an unchanging
  // function prop it never re-rendered and every timer sat frozen at whatever
  // the first paint showed.
  return localNow + offsetMs;
}

type Tab = 'sessions' | 'analytics' | 'questions' | 'settings';
const TAB_LABELS: Record<Tab, string> = {
  sessions: 'Sessions',
  analytics: 'Analytics',
  questions: 'Questions',
  settings: 'Configuration',
};
const TAB_ORDER: Tab[] = ['sessions', 'analytics', 'questions', 'settings'];

export default function QuizPage() {
  const canEdit = useAuth().user?.role === 'ADMIN';
  const [tab, setTab] = useState<Tab>('sessions');
  const [upcoming, setUpcoming] = useState<QuizUpcoming | null>(null);
  const [upcomingError, setUpcomingError] = useState<string | null>(null);
  const [loopBusy, setLoopBusy] = useState(false);

  const loadUpcoming = useCallback(async () => {
    try {
      setUpcoming(await api<QuizUpcoming>('/admin/quizzes/upcoming'));
      setUpcomingError(null);
    } catch (e) {
      // NO_QUESTIONS is the expected message before the pool is seeded — the
      // upcoming panel is the only thing that fails, so the rest of the page
      // (question bank, configuration) must still render.
      setUpcomingError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    loadUpcoming();
  }, [loadUpcoming]);

  // The next-slot countdown expires on its own, so re-sync when it should
  // have rolled over rather than polling on a fixed short interval.
  useEffect(() => {
    if (!upcoming) return;
    const id = setTimeout(loadUpcoming, Math.max(2000, upcoming.nextSlot.startsInMs + 1500));
    return () => clearTimeout(id);
  }, [upcoming, loadUpcoming]);

  const nowMs = useServerClock(upcoming?.serverNow);

  async function toggleLoop(enabled: boolean) {
    const verb = enabled ? 'Start' : 'Stop';
    const warning = enabled
      ? 'Start the automatic quiz loop? New sessions will be created every cycle.'
      : 'Stop the automatic quiz loop? No new sessions will be prepared. Sessions that already exist keep running so nobody who has paid loses their entry.';
    if (!confirm(warning)) return;
    setLoopBusy(true);
    try {
      await api(`/admin/quizzes/${enabled ? 'start' : 'stop'}`, { method: 'POST' });
      await loadUpcoming();
    } catch (e) {
      alert(e instanceof Error ? e.message : `${verb} failed`);
    } finally {
      setLoopBusy(false);
    }
  }

  const loopEnabled = upcoming?.loopEnabled ?? false;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Quiz</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Sessions, the question bank and the timing/points rules for the automatic quiz loop.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge color={loopEnabled ? 'green' : 'red'}>
            {upcoming === null ? 'Loop …' : loopEnabled ? '● Loop running' : '■ Loop stopped'}
          </Badge>
          {canEdit && (
            <Button
              variant={loopEnabled ? 'danger' : 'primary'}
              disabled={loopBusy || upcoming === null}
              onClick={() => toggleLoop(!loopEnabled)}
            >
              {loopBusy ? 'Saving…' : loopEnabled ? 'Stop quiz' : 'Start quiz'}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {TAB_ORDER.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              tab === t ? 'bg-cyan-500/15 text-cyan-300' : 'text-zinc-400 hover:bg-zinc-800/60'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'sessions' && (
          <SessionsTab
            canEdit={canEdit}
            upcoming={upcoming}
            upcomingError={upcomingError}
            nowMs={nowMs}
            reloadUpcoming={loadUpcoming}
          />
        )}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'questions' && <QuestionsTab canEdit={canEdit} />}
        {tab === 'settings' && <ConfigurationTab canEdit={canEdit} onSaved={loadUpcoming} />}
      </div>
    </div>
  );
}

/* ── Sessions ──────────────────────────────────────────────────────────── */

/**
 * Phase recomputed in the browser against the server-synced clock.
 *
 * The list endpoint already returns a `phase`, but it is a snapshot from
 * whenever the request was made; recomputing lets the badge flip from
 * "scheduled" to "running" on time without a refetch. `status` (the stored
 * enum) is deliberately not used for this — the cron that stamps RUNNING /
 * FINISHED only runs once a minute, so it lags the real transition.
 */
function livePhase(row: QuizSessionRow, nowMs: number): QuizPhase {
  if (row.status === 'CANCELLED') return 'cancelled';
  if (nowMs < Date.parse(row.startsAt)) return 'scheduled';
  if (nowMs < Date.parse(row.endsAt)) return 'running';
  return 'finished';
}

function SessionsTab({
  canEdit,
  upcoming,
  upcomingError,
  nowMs,
  reloadUpcoming,
}: {
  canEdit: boolean;
  upcoming: QuizUpcoming | null;
  upcomingError: string | null;
  /** Server-synced clock, re-rendered once a second by the parent. */
  nowMs: number;
  reloadUpcoming: () => void;
}) {
  const [page, setPage] = useState<QuizSessionsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      setPage(
        await api<QuizSessionsPage>('/admin/quizzes', {
          query: { skip, take: TAKE, category: categoryFilter, status: statusFilter },
        }),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [skip, categoryFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Sessions turn over on their own, so the table needs to refresh itself —
  // but not while a detail dialog is open, where a reload would swap the data
  // out from under whatever the admin is reading.
  useEffect(() => {
    if (viewingId) return;
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load, viewingId]);

  const items = page?.items ?? null;

  async function act(row: QuizSessionRow, action: 'cancel' | 'settle') {
    const warning =
      action === 'cancel'
        ? `Cancel the ${row.categoryLabel} session scheduled for ${fmtDateTime(row.startsAt)}? Only sessions that have not started yet can be cancelled.`
        : `Settle the ${row.categoryLabel} session now? Scores are graded and rewards paid for anyone who has not been settled yet.`;
    if (!confirm(warning)) return;
    setBusyId(row.id);
    try {
      await api(`/admin/quizzes/${row.id}/${action}`, { method: 'POST' });
      load();
      reloadUpcoming();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await api<QuizSessionsPage>('/admin/quizzes', {
        query: { skip: 0, take: 100, category: categoryFilter, status: statusFilter },
      });
      downloadCsv(
        `gogeta-quiz-sessions-${new Date().toISOString().slice(0, 10)}.csv`,
        res.items.map((q) => ({
          id: q.id,
          slot: q.slotIndex,
          category: q.category,
          status: q.status,
          startsAt: q.startsAt,
          endsAt: q.endsAt,
          settledAt: q.settledAt ?? '',
          participants: q.participants,
          questions: q.totalQuestions,
          entryPoints: q.entryPoints,
          rewardPoints: q.rewardPoints,
          winPercent: q.winPercent,
        })),
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const joinedNext = upcoming?.categories.reduce((s, c) => s + c.participants, 0) ?? 0;
  const phaseCounts = (items ?? []).reduce<Partial<Record<QuizPhase, number>>>((acc, row) => {
    const p = livePhase(row, nowMs);
    acc[p] = (acc[p] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {upcomingError && (
        <Card className="mb-4 border border-amber-500/30 p-4">
          <div className="text-sm text-amber-300">Next session unavailable: {upcomingError}</div>
          <div className="mt-1 text-xs text-zinc-500">
            Sessions are created on demand from the question bank — if a category has no active questions, seed or add
            some in the Questions tab.
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-medium text-zinc-300">Next quiz</div>
            {upcoming && (
              <div className="text-xs text-zinc-500">
                Slot #{upcoming.nextSlot.slotIndex} · starts {fmtDateTime(upcoming.nextSlot.startsAt)}
              </div>
            )}
          </div>
          {!upcoming ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (
            <>
              <div className="mt-3 flex items-end gap-3">
                <div className="text-4xl font-semibold tabular-nums tracking-tight text-cyan-300">
                  {fmtCountdown(Date.parse(upcoming.nextSlot.startsAt) - nowMs)}
                </div>
                <div className="pb-1 text-xs text-zinc-500">until the next session opens</div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {upcoming.categories.map((c) => (
                  <div
                    key={c.category}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm"
                  >
                    <span className="text-zinc-300">{c.categoryLabel}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-zinc-500">
                        {c.participants} joined
                      </span>
                      {c.quizId ? (
                        <Badge color={c.status === 'CANCELLED' ? 'red' : 'violet'}>
                          {c.status === 'CANCELLED' ? 'Cancelled' : 'Ready'}
                        </Badge>
                      ) : (
                        <Badge color="zinc">Not created</Badge>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-zinc-600">
                A session row is created the moment the first player opens the category, or by the scheduler shortly
                before the slot begins — &ldquo;Not created&rdquo; simply means nobody has looked yet.
              </p>
            </>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <MiniStat label="Sessions" sub="all time" value={page?.total ?? '—'} icon="◈" accent="azure" />
          <MiniStat label="Joined next quiz" value={joinedNext} icon="⊚" accent="aura" />
        </div>
      </div>

      <Card className="mt-6 flex flex-wrap items-center gap-3 p-3">
        <select
          value={categoryFilter}
          onChange={(e) => {
            setSkip(0);
            setCategoryFilter(e.target.value);
          }}
          className={selectClass + ' max-w-52'}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setSkip(0);
            setStatusFilter(e.target.value);
          }}
          className={selectClass + ' max-w-44'}
        >
          <option value="">All statuses</option>
          {(['SCHEDULED', 'RUNNING', 'FINISHED', 'CANCELLED'] as const).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {Object.keys(phaseCounts).length > 0 && (
          <span className="text-xs text-zinc-500">
            this page:{' '}
            {PHASE_ORDER.filter((p) => phaseCounts[p]).map((p) => `${phaseCounts[p]} ${p}`).join(' · ')}
          </span>
        )}
        <Button variant="ghost" className="ml-auto" onClick={exportCsv} disabled={exporting}>
          {exporting ? 'Exporting…' : '⬇ Export CSV'}
        </Button>
      </Card>

      {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}

      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="w-24 px-4 py-3">Slot</th>
                <th className="px-4 py-3">Category</th>
                <th
                  className="w-28 px-4 py-3"
                  title="Live phase, computed from the server clock. The stored status enum can lag by up to a minute."
                >
                  Phase
                </th>
                <th className="w-48 px-4 py-3">Window</th>
                <th className="w-24 px-4 py-3 text-right">Players</th>
                <th className="w-20 px-4 py-3 text-right">Qs</th>
                <th className="w-28 px-4 py-3 text-right">Entry / Reward</th>
                <th className="w-52 px-4 py-3 text-right">Actions</th>
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
              {items?.map((row) => {
                const phase = livePhase(row, nowMs);
                return (
                  <tr
                    key={row.id}
                    onClick={() => setViewingId(row.id)}
                    className="cursor-pointer border-b border-zinc-800/60 align-top last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">#{row.slotIndex}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.categoryLabel}</div>
                      <div className="text-xs text-zinc-500">
                        {row.secondsPerQuestion}s per question · win above {row.winPercent}%
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={PHASE_COLOR[phase]}>{phase}</Badge>
                      {phase === 'running' && (
                        <div className="mt-1 text-xs tabular-nums text-cyan-300">
                          {fmtCountdown(Date.parse(row.endsAt) - nowMs)} left
                        </div>
                      )}
                      {phase === 'scheduled' && (
                        <div className="mt-1 text-xs tabular-nums text-zinc-500">
                          in {fmtCountdown(Date.parse(row.startsAt) - nowMs)}
                        </div>
                      )}
                      {phase === 'finished' && !row.settledAt && (
                        <div className="mt-1 text-xs text-amber-400">unsettled</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {fmtDateTime(row.startsAt)}
                      <div className="text-zinc-600">to {fmtDateTime(row.endsAt)}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.participants}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{row.totalQuestions}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                      −{row.entryPoints}
                      <div className="text-amber-300">+{row.rewardPoints}</div>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="ghost" onClick={() => setViewingId(row.id)}>
                          Details
                        </Button>
                        {canEdit && phase === 'scheduled' && (
                          <Button variant="danger" disabled={busyId === row.id} onClick={() => act(row, 'cancel')}>
                            Cancel
                          </Button>
                        )}
                        {canEdit && phase === 'finished' && !row.settledAt && (
                          <Button disabled={busyId === row.id} onClick={() => act(row, 'settle')}>
                            {busyId === row.id ? 'Settling…' : 'Settle'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                    No quiz sessions yet — the first one is created when the next slot opens.
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

      {viewingId && <SessionDetailModal quizId={viewingId} onClose={() => setViewingId(null)} />}
    </div>
  );
}

function SessionDetailModal({ quizId, onClose }: { quizId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<QuizSessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'players' | 'questions'>('overview');

  useEffect(() => {
    api<QuizSessionDetail>(`/admin/quizzes/${quizId}`)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [quizId]);

  if (error) {
    return (
      <Modal title="Quiz session" onClose={onClose}>
        <p className="text-sm text-rose-400">{error}</p>
      </Modal>
    );
  }
  if (!detail) {
    return (
      <Modal title="Quiz session" onClose={onClose}>
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      </Modal>
    );
  }

  const rows: [string, ReactNode][] = [
    ['Status', <Badge key="s" color={detail.status === 'CANCELLED' ? 'red' : 'blue'}>{detail.status}</Badge>],
    ['Session ID', detail.id],
    ['Slot', `#${detail.slotIndex}`],
    ['Starts at', fmtDateTime(detail.startsAt)],
    ['Ends at', fmtDateTime(detail.endsAt)],
    ['Settled at', fmtDateTime(detail.settledAt)],
    ['Questions', detail.config.questionsPerQuiz],
    ['Time per question', `${detail.config.secondsPerQuestion}s`],
    ['Entry', `−${detail.config.entryPoints}`],
    ['Reward', `+${detail.config.rewardPoints}`],
    ['Win threshold', `above ${detail.config.winPercent}%`],
  ];

  return (
    <Modal title={`${detail.categoryLabel} · slot #${detail.slotIndex}`} onClose={onClose} maxWidth="max-w-3xl">
      <div className="mb-4 flex flex-wrap gap-2">
        {(['overview', 'players', 'questions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs transition ${
              tab === t ? 'bg-cyan-500/15 text-cyan-300' : 'text-zinc-400 hover:bg-zinc-800/60'
            }`}
          >
            {t === 'overview'
              ? 'Overview'
              : t === 'players'
                ? `Players (${detail.totals.participants})`
                : `Questions (${detail.questions.length})`}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Players" value={detail.totals.participants} accent="azure" />
            <MiniStat label="Won" value={detail.totals.won} accent="aura" />
            <MiniStat label="Lost" value={detail.totals.lost} accent="rose" />
            {/* Sub text kept short — MiniStat truncates its label line, and
                "kept by the house" was clipped mid-word. */}
            <MiniStat
              label="Net points"
              sub={detail.totals.net >= 0 ? 'kept' : 'paid out'}
              value={detail.totals.net}
              accent={detail.totals.net >= 0 ? 'teal' : 'amber'}
            />
          </div>

          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Points flow</div>
            <Distribution
              items={[
                { label: 'Entry collected', value: detail.totals.entryCollected, accent: 'azure' },
                { label: 'Reward paid', value: detail.totals.rewardPaid, accent: 'amber' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k} className="flex min-w-0 items-start justify-between gap-4 border-b border-white/5 py-1.5">
                <span className="shrink-0 text-zinc-500">{k}</span>
                <span className="min-w-0 break-all text-right font-medium text-zinc-200">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'players' &&
        (detail.participants.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">Nobody joined this session.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-zinc-500">
              <tr className="border-b border-white/10">
                <th className="py-2 pr-3 font-medium">Player</th>
                <th className="py-2 pr-3 text-right font-medium">Score</th>
                <th className="py-2 pr-3 text-right font-medium">C / W / U</th>
                <th className="py-2 pr-3 font-medium">Result</th>
                <th className="py-2 pr-3 text-right font-medium">Entry</th>
                <th className="py-2 text-right font-medium">Reward</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {detail.participants.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-3">
                    <div className="font-medium text-zinc-200">{p.name}</div>
                    <div className="text-xs text-zinc-500">{p.email}</div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {p.score}
                    <div className="text-xs text-zinc-500">{p.percentage}%</div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-zinc-400">
                    {p.correctCount} / {p.wrongCount} / {p.unansweredCount}
                  </td>
                  <td className="py-2 pr-3">
                    {p.result ? (
                      <Badge color={p.result === 'WON' ? 'green' : 'red'}>{p.result}</Badge>
                    ) : (
                      <Badge color="amber">pending</Badge>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-zinc-400">−{p.entryPoints}</td>
                  <td className="py-2 text-right tabular-nums text-amber-300">
                    {p.rewardPoints > 0 ? `+${p.rewardPoints}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}

      {tab === 'questions' && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">
            The exact questions this session asked, in order — frozen at creation, so editing the bank afterwards does
            not change what was played.
          </p>
          {detail.questions.map((q) => (
            <div key={q.id} className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
              <div className="flex gap-2">
                <span className="shrink-0 text-zinc-500">{q.index + 1}.</span>
                <span className="text-zinc-200">{q.question}</span>
              </div>
              {q.correctIndex !== null && (
                <div className="mt-1 pl-5 text-xs text-emerald-400">
                  Correct answer: option {OPTION_LETTERS[q.correctIndex]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ── Analytics ─────────────────────────────────────────────────────────── */

const WINDOWS = [7, 30, 90] as const;

/**
 * Quiz analytics.
 *
 * Everything here is derived from the sessions, participations and answers the
 * engine already records, so the figures cannot drift from the ledger rows they
 * describe. The window applies to every number on the tab, so a rate is never
 * mixed across periods.
 */
function AnalyticsTab() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<QuizAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<QuizAnalytics>('/admin/quizzes/analytics', { query: { days } }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="text-sm text-rose-400">{error}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const t = data.totals;
  const a = data.answers;
  const houseKeeps = t.netPoints >= 0;

  return (
    <div className={`space-y-6 ${loading ? 'opacity-60 transition-opacity' : ''}`}>
      {/* Window picker — every figure below respects it. */}
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <span className="text-sm text-zinc-400">Showing the last</span>
        <div className="flex gap-1.5">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDays(w)}
              className={`rounded-lg px-3 py-1.5 text-xs transition ${
                days === w ? 'bg-cyan-500/15 text-cyan-300' : 'text-zinc-400 hover:bg-zinc-800/60'
              }`}
            >
              {w} days
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-zinc-600">
          since {new Date(data.since).toLocaleDateString()}
        </span>
      </Card>

      {/* Headline numbers. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat label="Sessions run" value={t.sessions.toLocaleString()} icon="◈" accent="azure" />
        <MiniStat
          label="Entries"
          // "0 per session" reads as "nobody played" when the true figure is
          // simply below 0.1 — say that instead of rounding it away.
          sub={
            t.entries > 0 && t.avgEntriesPerSession === 0
              ? 'under 0.1 per session'
              : `${t.avgEntriesPerSession} per session`
          }
          value={t.entries.toLocaleString()}
          icon="⊚"
          accent="aura"
        />
        <MiniStat
          label="Unique players"
          value={t.uniquePlayers.toLocaleString()}
          icon="◉"
          accent="violet"
        />
        <MiniStat
          label="Win rate"
          sub={`${t.won} won · ${t.lost} lost`}
          value={`${t.winRate}%`}
          icon="★"
          accent="amber"
        />
      </div>

      {/* Points economy — the figure an operator actually cares about. */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-zinc-300">Points economy</div>
            <p className="mt-1 text-xs text-zinc-500">
              Entry fees collected against rewards paid out over the window.
            </p>
          </div>
          <div className="text-right">
            <div
              className={`text-2xl font-semibold tabular-nums ${
                houseKeeps ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {houseKeeps ? '+' : ''}
              {t.netPoints.toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500">
              {houseKeeps ? 'net kept' : 'net paid out'}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Distribution
            items={[
              { label: 'Entry collected', value: t.entryCollected, accent: 'azure' },
              { label: 'Reward paid', value: t.rewardPaid, accent: 'amber' },
            ]}
          />
        </div>
      </Card>

      {/* Trend + accuracy side by side. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-1 text-sm font-medium text-zinc-300">Entries &amp; net points per day</div>
          <p className="mb-3 text-xs text-zinc-500">
            Whether more players cost the platform more or less.
          </p>
          <QuizEntriesTrend data={data.trend} />
        </Card>
        <Card className="p-5">
          <div className="mb-1 text-sm font-medium text-zinc-300">Answer accuracy</div>
          <p className="mb-3 text-xs text-zinc-500">
            {a.correct.toLocaleString()} correct of {a.total.toLocaleString()} answered
            {a.unanswered > 0
              ? `, plus ${a.unanswered.toLocaleString()} left unanswered`
              : ''}
            .
          </p>
          <QuizAccuracyDonut
            correct={a.correct}
            wrong={a.wrong}
            unanswered={a.unanswered}
            accuracy={a.accuracy}
          />
        </Card>
      </div>

      {/* Play-quality numbers. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat label="Average score" value={t.avgScore.toString()} icon="◆" accent="aura" />
        <MiniStat label="Average result" value={`${t.avgPercentage}%`} icon="◇" accent="azure" />
        <MiniStat
          label="Avg answer time"
          sub="from question opening"
          value={`${(a.avgResponseMs / 1000).toFixed(1)}s`}
          icon="◷"
          accent="violet"
        />
        <MiniStat
          label="Skip rate"
          sub="questions left unanswered"
          value={`${a.skipRate}%`}
          icon="○"
          accent={a.skipRate > 40 ? 'rose' : 'teal'}
        />
      </div>

      {/* Category + answer-position spread. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-1 text-sm font-medium text-zinc-300">Points by category</div>
          <p className="mb-3 text-xs text-zinc-500">Where the entry fees and rewards land.</p>
          <QuizCategoryBars data={data.byCategory} />
        </Card>
        <Card className="p-5">
          <div className="mb-1 text-sm font-medium text-zinc-300">Answer position spread</div>
          <p className="mb-3 text-xs text-zinc-500">
            How often players pick each letter. A heavy lean on one letter suggests the bank&apos;s
            correct answers cluster there, which players can exploit without knowing the subject.
          </p>
          <QuizOptionSpreadBars data={data.optionSpread} />
        </Card>
      </div>

      {/* Per-category table — the numbers behind the bars. */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Category</th>
                <th className="w-24 px-4 py-3 text-right">Sessions</th>
                <th className="w-24 px-4 py-3 text-right">Entries</th>
                <th className="w-32 px-4 py-3 text-right">Collected</th>
                <th className="w-32 px-4 py-3 text-right">Paid</th>
                <th className="w-28 px-4 py-3 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {data.byCategory.map((c) => (
                <tr key={c.category} className="border-b border-zinc-800/60 last:border-0">
                  <td className="px-4 py-3 font-medium">{c.categoryLabel}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-400">{c.sessions}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.entries}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                    {c.entryCollected.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-300">
                    {c.rewardPaid.toLocaleString()}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${
                      c.netPoints >= 0 ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {c.netPoints >= 0 ? '+' : ''}
                    {c.netPoints.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Question difficulty. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QuestionRanking
          title="Hardest questions"
          caption="Lowest correct rate — check these read clearly and the marked answer is right."
          rows={data.hardestQuestions}
          minAnswers={data.minAnswersForRanking}
          tone="rose"
        />
        <QuestionRanking
          title="Easiest questions"
          caption="Almost always answered correctly — candidates for retiring."
          rows={data.easiestQuestions}
          minAnswers={data.minAnswersForRanking}
          tone="green"
        />
      </div>
    </div>
  );
}

/** One difficulty list, with a bar per row so rates compare at a glance. */
function QuestionRanking({
  title,
  caption,
  rows,
  minAnswers,
  tone,
}: {
  title: string;
  caption: string;
  rows: QuizQuestionDifficulty[];
  minAnswers: number;
  tone: 'rose' | 'green';
}) {
  return (
    <Card className="p-5">
      <div className="text-sm font-medium text-zinc-300">{title}</div>
      <p className="mt-1 text-xs text-zinc-500">{caption}</p>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          Not enough answers yet — a question needs at least {minAnswers} to be ranked.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.questionId}>
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1 text-sm text-zinc-200">{r.question}</span>
                <span
                  className={`shrink-0 tabular-nums text-sm ${
                    tone === 'rose' ? 'text-rose-300' : 'text-emerald-300'
                  }`}
                >
                  {r.correctRate}%
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1">
                  <ProgressBar
                    value={r.correctRate}
                    max={100}
                    accent={tone === 'rose' ? 'rose' : 'aura'}
                  />
                </div>
                <span className="shrink-0 text-[11px] text-zinc-600">
                  {r.correct}/{r.answers}
                  {r.categoryLabel ? ` · ${r.categoryLabel}` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ── Question bank ─────────────────────────────────────────────────────── */

const QUESTION_TAKE = 25;

function QuestionsTab({ canEdit }: { canEdit: boolean }) {
  const [page, setPage] = useState<QuizQuestionsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<QuizQuestionRow | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      setPage(
        await api<QuizQuestionsPage>('/admin/quiz/questions', {
          query: {
            skip,
            take: QUESTION_TAKE,
            category: categoryFilter,
            active: activeFilter,
            search,
          },
        }),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [skip, categoryFilter, activeFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(q: QuizQuestionRow) {
    setBusyId(q.id);
    try {
      await api(`/admin/quiz/questions/${q.id}/status`, { method: 'PATCH', body: { active: !q.active } });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(q: QuizQuestionRow) {
    if (!confirm(`Delete this question?\n\n"${q.question}"\n\nIf it has already been played it is deactivated instead, so past results stay intact.`)) return;
    setBusyId(q.id);
    try {
      const res = await api<{ deleted: boolean; deactivated: boolean; reason?: string }>(
        `/admin/quiz/questions/${q.id}`,
        { method: 'DELETE' },
      );
      if (res.deactivated && res.reason) alert(res.reason);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const items = page?.items ?? null;
  const counts: QuizQuestionCount[] = page?.counts ?? [];

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {counts.length === 0
          ? CATEGORIES.map((c) => <MiniStat key={c.value} label={c.label} value="—" accent={CATEGORY_ACCENTS[c.value]} />)
          : counts.map((c) => (
              <MiniStat
                key={c.category}
                label={c.categoryLabel}
                sub={c.total === c.active ? 'active' : `active of ${c.total}`}
                value={c.active}
                accent={CATEGORY_ACCENTS[c.category]}
              />
            ))}
      </div>

      <Card className="mt-6 flex flex-wrap items-center gap-3 p-3">
        <input
          value={search}
          onChange={(e) => {
            setSkip(0);
            setSearch(e.target.value);
          }}
          placeholder="Search question text…"
          className={inputClass + ' max-w-sm'}
        />
        <select
          value={categoryFilter}
          onChange={(e) => {
            setSkip(0);
            setCategoryFilter(e.target.value);
          }}
          className={selectClass + ' max-w-52'}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(e) => {
            setSkip(0);
            setActiveFilter(e.target.value);
          }}
          className={selectClass + ' max-w-40'}
        >
          <option value="">Active &amp; inactive</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
        {canEdit && (
          <Button className="ml-auto" onClick={() => setEditing('new')}>
            + Add question
          </Button>
        )}
      </Card>

      {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}

      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Question</th>
                <th className="w-44 px-4 py-3">Category</th>
                <th className="w-24 px-4 py-3">Status</th>
                {/* Wide enough for Edit + Deactivate + Delete on one line —
                    at w-56 the third button wrapped and doubled every row's
                    height. */}
                <th className="w-72 px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!items && (
                <tr>
                  <td colSpan={4} className="px-4 py-10">
                    <div className="flex justify-center">
                      <Spinner />
                    </div>
                  </td>
                </tr>
              )}
              {items?.map((q) => {
                const options = [q.optionA, q.optionB, q.optionC, q.optionD];
                const open = expanded.has(q.id);
                return (
                  <tr
                    key={q.id}
                    onClick={() => toggleExpanded(q.id)}
                    className="cursor-pointer border-b border-zinc-800/60 align-top last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-200">{q.question}</div>
                      {open ? (
                        <>
                          <div className="mt-2 space-y-1">
                            {options.map((opt, i) => (
                              <div
                                key={i}
                                className={`flex gap-2 rounded-lg px-2 py-1 text-xs ${
                                  i === q.correctIndex
                                    ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25'
                                    : 'text-zinc-400'
                                }`}
                              >
                                <span className="w-4 shrink-0 font-mono">{OPTION_LETTERS[i]}</span>
                                <span>{opt}</span>
                                {i === q.correctIndex && <span className="ml-auto shrink-0">✓ correct</span>}
                              </div>
                            ))}
                          </div>
                          {q.explanation && (
                            <p className="mt-2 text-xs italic text-zinc-500">{q.explanation}</p>
                          )}
                        </>
                      ) : (
                        <div className="mt-1 truncate text-xs text-zinc-500">
                          {OPTION_LETTERS[q.correctIndex]}: {options[q.correctIndex]}
                          <span className="text-zinc-600"> · click to expand</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{categoryLabel(q.category)}</td>
                    <td className="px-4 py-3">
                      <Badge color={q.active ? 'green' : 'zinc'}>{q.active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {!canEdit ? null : (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="ghost" onClick={() => setEditing(q)}>
                            Edit
                          </Button>
                          <Button variant="ghost" disabled={busyId === q.id} onClick={() => toggleActive(q)}>
                            {q.active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button variant="danger" disabled={busyId === q.id} onClick={() => remove(q)}>
                            Delete
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {items?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-zinc-500">
                    No questions match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {page && page.total > QUESTION_TAKE && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
          <span>
            {skip + 1}–{Math.min(skip + QUESTION_TAKE, page.total)} of {page.total}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - QUESTION_TAKE))}>
              Prev
            </Button>
            <Button
              variant="ghost"
              disabled={skip + QUESTION_TAKE >= page.total}
              onClick={() => setSkip(skip + QUESTION_TAKE)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <QuestionModal
          question={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function QuestionModal({
  question,
  onClose,
  onDone,
}: {
  question: QuizQuestionRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const isEdit = question !== null;
  const [category, setCategory] = useState<QuizCategory>(question?.category ?? 'POLITICS');
  const [text, setText] = useState(question?.question ?? '');
  const [options, setOptions] = useState<string[]>(
    question ? [question.optionA, question.optionB, question.optionC, question.optionD] : ['', '', '', ''],
  );
  const [correctIndex, setCorrectIndex] = useState(question?.correctIndex ?? 0);
  const [explanation, setExplanation] = useState(question?.explanation ?? '');
  const [active, setActive] = useState(question?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }

  async function submit() {
    setError(null);
    if (!text.trim()) return setError('Enter the question text.');
    // All four are mandatory: the engine serves exactly four options and the
    // 0–3 correct index is meaningless if one of them is blank.
    if (options.some((o) => !o.trim())) return setError('All four options are required.');
    const seen = new Set(options.map((o) => o.trim().toLowerCase()));
    if (seen.size < 4) return setError('The four options must be different from each other.');

    setBusy(true);
    try {
      const body = {
        category,
        question: text.trim(),
        optionA: options[0].trim(),
        optionB: options[1].trim(),
        optionC: options[2].trim(),
        optionD: options[3].trim(),
        correctIndex,
        explanation: explanation.trim(),
        active,
      };
      if (isEdit) await api(`/admin/quiz/questions/${question.id}`, { method: 'PUT', body });
      else await api('/admin/quiz/questions', { method: 'POST', body });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={isEdit ? 'Edit question' : 'New question'} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as QuizCategory)}
            className={selectClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Question">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Which country hosted the 2016 Summer Olympics?"
            className={inputClass}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">
            Options — select the radio next to the correct answer
          </span>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <label
                key={i}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition ${
                  i === correctIndex
                    ? 'border-emerald-500/40 bg-emerald-500/[0.07]'
                    : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <input
                  type="radio"
                  name="correctIndex"
                  checked={i === correctIndex}
                  onChange={() => setCorrectIndex(i)}
                />
                <span className="w-4 shrink-0 font-mono text-xs text-zinc-500">{OPTION_LETTERS[i]}</span>
                <input
                  value={opt}
                  onChange={(e) => setOption(i, e.target.value)}
                  maxLength={300}
                  placeholder={`Option ${OPTION_LETTERS[i]}`}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
                />
              </label>
            ))}
          </div>
        </div>

        <Field label="Short explanation (shown on the result screen)">
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Rio de Janeiro hosted the 2016 Games — the first in South America."
            className={inputClass}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active — inactive questions are never served in a session
        </label>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={submit}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create question'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Configuration ─────────────────────────────────────────────────────── */

type SettingKey = keyof Omit<QuizSettings, 'enabled' | 'durationSeconds' | 'derived'>;

const CONFIG_FIELDS: {
  key: SettingKey;
  label: string;
  hint: string;
  min: number;
  max: number;
  unit?: string;
}[] = [
  {
    key: 'cycleSeconds',
    label: 'Quiz interval',
    hint: 'How often a new session starts, per category. The waiting period is this minus the session length.',
    min: 30,
    max: 86_400,
    unit: 'seconds',
  },
  {
    key: 'secondsPerQuestion',
    label: 'Time per question',
    hint: 'Each question is open for exactly this long. Answers arriving later are rejected by the backend.',
    min: 3,
    max: 120,
    unit: 'seconds',
  },
  {
    key: 'questionsPerQuiz',
    label: 'Questions per quiz',
    hint: 'How many questions each session asks. Multiplied by the time per question, this is the session length.',
    min: 1,
    max: 50,
  },
  {
    key: 'entryPoints',
    label: 'Entry points',
    hint: 'Charged when a player joins. Set to 0 to make sessions free to enter.',
    min: 0,
    max: 1_000_000,
  },
  {
    key: 'rewardPoints',
    label: 'Reward points',
    hint: 'Paid to every player who beats the winning percentage.',
    min: 0,
    max: 1_000_000,
  },
  {
    key: 'winPercent',
    label: 'Winning percentage',
    hint: 'A player wins by scoring strictly above this. At 50% with 5 questions, 3 correct wins and 2 loses.',
    min: 0,
    max: 100,
    unit: '%',
  },
  {
    key: 'answerGraceMs',
    label: 'Answer grace period',
    hint: 'Latency allowance when checking an answer against its question window, so a submission sent just in time is not rejected by network delay.',
    min: 0,
    max: 10_000,
    unit: 'ms',
  },
];

function ConfigurationTab({ canEdit, onSaved }: { canEdit: boolean; onSaved: () => void }) {
  const [settings, setSettings] = useState<QuizSettings | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<QuizSettings>('/admin/quizzes/settings');
      setSettings(res);
      setDrafts(Object.fromEntries(CONFIG_FIELDS.map((f) => [f.key, String(res[f.key])])));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(key: SettingKey | 'enabled', value: number | boolean, describe: string) {
    if (!confirm(`${describe}\n\nThis changes the live app immediately. Sessions that already exist keep the rules they were created with.`)) return;
    setBusy(true);
    try {
      const res = await api<QuizSettings>('/admin/quizzes/settings', { method: 'PUT', body: { [key]: value } });
      setSettings(res);
      setDrafts(Object.fromEntries(CONFIG_FIELDS.map((f) => [f.key, String(res[f.key])])));
      setSavedKey(key);
      setTimeout(() => setSavedKey((cur) => (cur === key ? null : cur)), 2500);
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="text-sm text-rose-400">{error}</p>;
  if (!settings) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  // Preview from the *drafts*, so the admin sees the effect of a change before
  // committing it. Mirrors QuizConfigService: duration is derived, and the
  // cycle is clamped up to at least duration + 15s.
  const draftNum = (key: SettingKey) => Number(drafts[key] ?? settings[key]);
  const previewPerQuestion = draftNum('secondsPerQuestion');
  const previewCount = draftNum('questionsPerQuiz');
  const previewDuration = previewPerQuestion * previewCount;
  const previewCycleRaw = draftNum('cycleSeconds');
  const previewCycle = Math.max(previewCycleRaw, previewDuration + 15);
  const cycleClamped = previewCycle !== previewCycleRaw;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-zinc-200">Automatic loop</div>
            <div className="mt-1 text-xs text-zinc-500">
              While this is on, every category opens a new session each interval with no admin action. Turning it off
              stops new sessions being prepared; sessions that already exist still run and settle, so nobody who has
              paid an entry fee loses it.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge color={settings.enabled ? 'green' : 'red'}>{settings.enabled ? 'Enabled' : 'Disabled'}</Badge>
            {canEdit && (
              <Button
                variant={settings.enabled ? 'danger' : 'primary'}
                disabled={busy}
                onClick={() =>
                  save(
                    'enabled',
                    !settings.enabled,
                    settings.enabled ? 'Disable the automatic quiz loop?' : 'Enable the automatic quiz loop?',
                  )
                }
              >
                {settings.enabled ? 'Disable' : 'Enable'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-sm font-medium text-zinc-300">Current schedule</div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat
            label="Session length"
            sub={`${previewCount} × ${previewPerQuestion}s`}
            value={fmtDuration(previewDuration)}
            accent="aura"
          />
          <MiniStat label="New session every" value={fmtDuration(previewCycle)} accent="azure" />
          <MiniStat label="Waiting period" value={fmtDuration(previewCycle - previewDuration)} accent="sky" />
          <MiniStat
            label="Win above"
            sub={`+${draftNum('rewardPoints')} for −${draftNum('entryPoints')}`}
            value={`${draftNum('winPercent')}%`}
            accent="amber"
          />
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Session length is not directly editable — it is always{' '}
          <span className="text-zinc-300">questions per quiz × time per question</span>, so the three values can never
          contradict each other. Change either factor to change the length.
        </p>
        {cycleClamped && (
          <p className="mt-2 text-xs text-amber-400">
            The interval you entered ({fmtDuration(previewCycleRaw)}) is shorter than one session plus a minimum
            15-second waiting period, so it will be raised to {fmtDuration(previewCycle)} on save.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONFIG_FIELDS.map((f) => {
          const raw = drafts[f.key] ?? String(settings[f.key]);
          const n = Number(raw);
          const invalid =
            raw.trim() === '' || !Number.isInteger(n) || n < f.min || n > f.max;
          const dirty = !invalid && n !== settings[f.key];
          return (
            <div key={f.key} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-sm font-medium text-zinc-200">{f.label}</div>
                {f.unit && <div className="text-[10px] uppercase tracking-wide text-zinc-600">{f.unit}</div>}
              </div>
              <div className="mt-1 text-xs text-zinc-500">{f.hint}</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  value={raw}
                  disabled={!canEdit}
                  onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
                  className={inputClass + (invalid ? ' border-rose-500/60' : '')}
                />
                {canEdit && (
                  <Button
                    variant="ghost"
                    disabled={invalid || busy || !dirty}
                    onClick={() => save(f.key, n, `Set ${f.label} to ${n}${f.unit ? ` ${f.unit}` : ''}?`)}
                  >
                    {savedKey === f.key ? '✓ Saved' : 'Save'}
                  </Button>
                )}
              </div>
              {invalid && (
                <p className="mt-1 text-xs text-rose-400">
                  Enter a whole number between {f.min} and {f.max.toLocaleString()}.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-zinc-600">
        Every session stores its own copy of these rules when it is created, so saving a change here never alters a
        session that is already scheduled or running — it applies from the next one onward.
      </p>
    </div>
  );
}
