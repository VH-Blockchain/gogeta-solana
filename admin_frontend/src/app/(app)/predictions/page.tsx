'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { api, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { downloadCsv as downloadCsvRows } from '@/lib/csv';
import type { AdminPrediction, PredictionEntriesPage, PredictionEntryRow, PredictionStatus } from '@/lib/types';
import { Accent, Badge, Button, Card, Distribution, Field, MiniStat, Modal, SplitBar, Spinner, inputClass, selectClass } from '@/components/ui';
import { ImageUpload } from '@/components/ImageUpload';

interface Category {
  id: string;
  key: string;
  label: string;
}

/** Converts a UTC ISO timestamp to the "YYYY-MM-DDTHH:mm" string a
 *  `datetime-local` input expects, in the *browser's local* timezone --
 *  `datetime-local` has no timezone of its own, so a bare `.slice(0, 16)` of
 *  the raw UTC string (the previous approach) showed the UTC wall-clock time
 *  mislabeled as if it were already local, off by the timezone offset (e.g.
 *  IST, UTC+5:30: a 3:35 PM local close time is stored as 10:05 UTC, so the
 *  field silently showed 10:05 AM instead). `new Date(iso)` correctly
 *  parses the UTC instant; the local getters below read it back out in the
 *  browser's own timezone, matching what Overview's toLocaleString() shows.
 */
function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_COLOR: Record<PredictionStatus, string> = {
  DRAFT: 'zinc',
  SCHEDULED: 'violet',
  OPEN: 'green',
  LOCKED: 'amber',
  AUTO_RESOLVED: 'teal',
  RESOLVED: 'blue',
  CANCELLED: 'red',
};

// Accent per status (for the breakdown bars) and a cycle for option vote bars.
const STATUS_ACCENT: Record<PredictionStatus, Accent> = {
  DRAFT: 'teal',
  SCHEDULED: 'violet',
  OPEN: 'azure',
  LOCKED: 'amber',
  AUTO_RESOLVED: 'teal',
  RESOLVED: 'sky',
  CANCELLED: 'rose',
};
const OPT_ACCENTS: Accent[] = ['azure', 'sky', 'amber', 'violet', 'rose', 'teal'];
const STATUS_ORDER: PredictionStatus[] = ['OPEN', 'SCHEDULED', 'LOCKED', 'AUTO_RESOLVED', 'DRAFT', 'RESOLVED', 'CANCELLED'];
const SOURCE_ORDER = ['AUTO_ENTRY', 'CSV', 'MANUAL'] as const;
const SOURCE_LABEL: Record<string, string> = { AUTO_ENTRY: 'Polymarket', CSV: 'CSV import', MANUAL: 'Manual' };
const TAKE = 25;

export default function PredictionsPage() {
  const canEdit = useAuth().user?.role === 'ADMIN';
  const [items, setItems] = useState<AdminPrediction[] | null>(null);
  const [total, setTotal] = useState(0);
  // Site-wide (well, filter-wide) breakdown from the backend — NOT derived
  // from `items`, which is only the current page. See admin.service.ts
  // listPredictions: these three ignore the status filter itself so
  // picking "OPEN" doesn't zero out the Resolved tile.
  const [openCount, setOpenCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [featuredCount, setFeaturedCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Partial<Record<PredictionStatus, number>>>({});
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const [cats, setCats] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [resolving, setResolving] = useState<AdminPrediction | null>(null);
  const [editing, setEditing] = useState<AdminPrediction | null>(null);
  const [viewing, setViewing] = useState<{ prediction: AdminPrediction; initialTab: 'overview' | 'predictors' } | null>(null);
  const [importing, setImporting] = useState<'predictions' | 'resolutions' | null>(null);
  const [polymarketBusy, setPolymarketBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [checkResults, setCheckResults] = useState<Record<string, { outcome: string; detail: string }>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [closingWithin24h, setClosingWithin24h] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Tracks whether the search/filter bar is currently pinned (sticky) so its
  // top gap can shrink only in that state — a sentinel just above it flips
  // out of view the instant the bar reaches top:0.
  const [filterBarStuck, setFilterBarStuck] = useState(false);
  const filterBarSentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{
        items: AdminPrediction[];
        total: number;
        openCount: number;
        resolvedCount: number;
        featuredCount: number;
        statusCounts: Partial<Record<PredictionStatus, number>>;
        sourceCounts: Record<string, number>;
      }>('/admin/predictions', {
        query: {
          search,
          skip,
          take: TAKE,
          status: statusFilter,
          category: categoryFilter,
          source: sourceFilter,
          closingHours: closingWithin24h ? 24 : undefined,
        },
      });
      setItems(res.items);
      setTotal(res.total);
      setOpenCount(res.openCount);
      setResolvedCount(res.resolvedCount);
      setFeaturedCount(res.featuredCount);
      setStatusCounts(res.statusCounts);
      setSourceCounts(res.sourceCounts ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [search, skip, statusFilter, categoryFilter, sourceFilter, closingWithin24h]);

  // Deep-links: #new opens the create form; #locked / #open / #closing24h
  // pre-filter; #resolve=<id> opens that prediction's resolve dialog directly
  // — used by the dashboard's "Needs your attention" section (its per-item
  // "Resolve →" link and the "See all" links next to each category title).
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#new' && canEdit) setCreating(true);
    if (hash === '#locked') setStatusFilter('LOCKED');
    if (hash === '#open') setStatusFilter('OPEN');
    if (hash === '#closing24h') {
      setStatusFilter('OPEN');
      setClosingWithin24h(true);
    }
    if (hash.startsWith('#resolve=')) {
      const id = hash.slice('#resolve='.length);
      // Filter to whichever status this prediction actually has (LOCKED or
      // AUTO_RESOLVED) rather than assuming LOCKED — the dashboard links here
      // for both.
      api<AdminPrediction>(`/admin/predictions/${id}`)
        .then((p) => {
          setStatusFilter(p.status);
          setResolving(p);
        })
        .catch(() => {});
    }
    if (hash) history.replaceState(null, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const el = filterBarSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setFilterBarStuck(!entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    api<Category[]>('/categories')
      .then(setCats)
      .catch(() => setCats([]));
  }, []);

  const ACT_CONFIRM: Record<'open' | 'close' | 'cancel', string> = {
    open: 'Open this prediction? It becomes visible and playable for all users.',
    close: 'Close this prediction? Users will no longer be able to enter.',
    cancel: "Cancel this prediction? This can't be undone.",
  };

  async function act(id: string, action: 'open' | 'close' | 'cancel') {
    if (!confirm(ACT_CONFIRM[action])) return;
    try {
      await api(`/admin/predictions/${id}/${action}`, { method: 'POST' });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function runPolymarket() {
    setPolymarketBusy(true);
    try {
      const res = await api<{ created: number; skipped: number }>('/admin/predictions/import-polymarket', {
        method: 'POST',
      });
      alert(`${res.created} created · ${res.skipped} skipped`);
      if (res.created > 0) load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setPolymarketBusy(false);
    }
  }

  // On-demand equivalent of the auto-resolve cron for exactly one
  // prediction — separate from the manual "Resolve" button below, which is
  // left untouched. This only asks Polymarket "has this settled yet?"; it
  // never moves coins itself. A RESOLVED outcome flips the row to
  // AUTO_RESOLVED, at which point the (unchanged) Resolve button becomes
  // "Confirm" and pre-fills the detected winner.
  const CHECK_OUTCOME_LABEL: Record<string, string> = {
    RESOLVED: 'Resolved',
    STILL_OPEN: 'Still open',
    AMBIGUOUS: 'Ambiguous',
    NOT_FOUND: 'Not found',
    NO_MARKET_KEY: 'No market key',
    ERROR: 'Check failed',
  };
  const CHECK_OUTCOME_COLOR: Record<string, string> = {
    RESOLVED: 'text-teal-300',
    STILL_OPEN: 'text-zinc-500',
    AMBIGUOUS: 'text-amber-300',
    NOT_FOUND: 'text-rose-300',
    NO_MARKET_KEY: 'text-rose-300',
    ERROR: 'text-rose-300',
  };

  async function checkResolution(p: AdminPrediction) {
    setCheckingId(p.id);
    try {
      const res = await api<{ outcome: string; detail: string; prediction?: AdminPrediction }>(
        `/admin/predictions/${p.id}/check-resolution`,
        { method: 'POST' },
      );
      setCheckResults((prev) => ({ ...prev, [p.id]: res }));
      if (res.outcome === 'RESOLVED') load();
      return res;
    } catch (e) {
      const res: { outcome: string; detail: string; prediction?: AdminPrediction } = {
        outcome: 'ERROR',
        detail: e instanceof Error ? e.message : 'Check failed',
      };
      setCheckResults((prev) => ({ ...prev, [p.id]: res }));
      return res;
    } finally {
      setCheckingId(null);
    }
  }

  // Clicking Resolve on a not-yet-checked Polymarket prediction runs the
  // same backend check as "Check result" automatically first — no separate
  // click, no popup. A RESOLVED outcome now pays out immediately as part of
  // that same check (see admin.service.ts's applyResolutionCheck), so there's
  // nothing left to confirm — the dialog does NOT open in that case; the row
  // just refreshes straight to RESOLVED. The dialog only opens when
  // Polymarket hasn't settled it yet, so the admin can still resolve
  // manually — that manual submit is still the one place a payout requires
  // an explicit click.
  async function openResolve(p: AdminPrediction) {
    if (p.source === 'AUTO_ENTRY' && p.status === 'LOCKED') {
      const res = await checkResolution(p);
      if (res.outcome === 'RESOLVED') return;
    }
    setResolving(p);
  }

  function copyId(id: string) {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1200);
    });
  }

  async function duplicate(p: AdminPrediction) {
    if (!confirm(`Duplicate "${p.title}"? A fresh DRAFT copy will be created.`)) return;
    try {
      await api(`/admin/predictions/${p.id}/duplicate`, { method: 'POST' });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await api<{ items: AdminPrediction[] }>('/admin/predictions', {
        query: { search, status: statusFilter, category: categoryFilter, source: sourceFilter, skip: 0, take: 100 },
      });
      downloadCsvRows(
        `gogeta-predictions-${new Date().toISOString().slice(0, 10)}.csv`,
        res.items.map((p) => ({
          id: p.id,
          referenceCode: p.referenceCode ?? '',
          title: p.title,
          subtitle: p.subtitle,
          status: p.status,
          source: p.source ?? 'MANUAL',
          featured: p.featured,
          entryFee: p.entryFee,
          reward: p.reward,
          participants: p.participants,
          options: p.options.map((o) => o.label).join(' | '),
          votes: p.options.reduce((s, o) => s + o.votes, 0),
          closesAt: p.closesAt,
        })),
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulk(action: 'open' | 'close' | 'cancel' | 'feature' | 'unfeature') {
    if (selected.size === 0) return;
    const warning =
      action === 'cancel'
        ? `Cancel ${selected.size} prediction(s)? This can't be undone.`
        : `Apply "${action}" to ${selected.size} prediction(s)?`;
    if (!confirm(warning)) return;
    setBulkBusy(true);
    try {
      const res = await api<{ updated: number; errors: { id: string; error: string }[] }>(
        '/admin/predictions/bulk',
        { method: 'POST', body: { ids: [...selected], action } },
      );
      if (res.errors.length > 0) {
        alert(`${res.updated} updated, ${res.errors.length} failed:\n${res.errors.map((e) => e.error).join('\n')}`);
      }
      setSelected(new Set());
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Bulk action failed');
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Predictions</h1>
          <p className="mt-1 text-sm text-zinc-500">Create, open/close and resolve predictions.</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <>
              <Button variant="ghost" onClick={() => setImporting('predictions')}>Import CSV</Button>
              <Button variant="ghost" onClick={() => setImporting('resolutions')}>Import results</Button>
              <Button variant="ghost" onClick={runPolymarket} disabled={polymarketBusy}>
                {polymarketBusy ? 'Fetching…' : '⇩ Fetch from Polymarket'}
              </Button>
              <Button onClick={() => setCreating(true)}>+ New prediction</Button>
            </>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {items && items.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="grid grid-cols-2 gap-4 lg:col-span-2">
            <MiniStat label="Total" value={total} icon="◎" accent="azure" />
            <MiniStat label="Open now" value={openCount} icon="●" accent="aura" />
            <MiniStat label="Resolved" value={resolvedCount} icon="✓" accent="sky" />
            <MiniStat label="Featured" value={featuredCount} icon="★" accent="amber" />
          </div>
          <Card className="p-5">
            <div className="mb-3 text-sm font-medium text-zinc-300">Status breakdown</div>
            <Distribution
              items={STATUS_ORDER.map((s) => ({
                label: s,
                value: statusCounts[s] ?? 0,
                accent: STATUS_ACCENT[s],
              })).filter((i) => i.value > 0)}
              total={Object.values(statusCounts).reduce((sum, n) => sum + (n ?? 0), 0)}
            />
          </Card>
        </div>
      )}

      {/* !bg-zinc-950/95 overrides .panel's 72%-opacity background (used by
          every Card) — sticky needs a near-opaque backdrop so scrolled rows
          don't ghost through behind the search/filter bar as the list scrolls
          underneath it. Scoped to this one sticky instance, not global. */}
      <div ref={filterBarSentinelRef} />
      <Card
        className={`sticky top-0 z-10 flex flex-wrap items-center gap-3 p-3 !bg-zinc-950/95 transition-[margin] ${
          filterBarStuck ? 'mt-3' : 'mt-6'
        }`}
      >
        <input
          value={search}
          onChange={(e) => {
            setSkip(0);
            setSearch(e.target.value);
          }}
          placeholder="Search predictions by title…"
          className={inputClass + ' max-w-sm'}
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setSkip(0);
            setStatusFilter(e.target.value);
          }}
          className={selectClass + ' max-w-40'}
        >
          <option value="">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setSkip(0);
            setCategoryFilter(e.target.value);
          }}
          className={selectClass + ' max-w-44'}
        >
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c.id} value={c.key}>{c.label}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => {
            setSkip(0);
            setSourceFilter(e.target.value);
          }}
          className={selectClass + ' max-w-48'}
        >
          <option value="">All sources</option>
          {SOURCE_ORDER.map((s) => (
            <option key={s} value={s}>{SOURCE_LABEL[s]} ({sourceCounts[s] ?? 0})</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={closingWithin24h}
            onChange={(e) => {
              setSkip(0);
              setClosingWithin24h(e.target.checked);
            }}
          />
          Closing within 24h
        </label>
        <Button variant="ghost" onClick={exportCsv} disabled={exporting}>
          {exporting ? 'Exporting…' : '⬇ Export CSV'}
        </Button>
      </Card>

      {selected.size > 0 && (
        <Card className="mt-6 flex flex-wrap items-center gap-3 p-3">
          <span className="text-sm text-zinc-300">{selected.size} selected</span>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" disabled={bulkBusy} onClick={() => bulk('open')}>Open</Button>
            <Button variant="ghost" disabled={bulkBusy} onClick={() => bulk('close')}>Close</Button>
            <Button variant="ghost" disabled={bulkBusy} onClick={() => bulk('feature')}>Feature</Button>
            <Button variant="ghost" disabled={bulkBusy} onClick={() => bulk('unfeature')}>Unfeature</Button>
            <Button variant="danger" disabled={bulkBusy} onClick={() => bulk('cancel')}>Cancel</Button>
          </div>
          <button
            type="button"
            className="ml-auto text-sm text-zinc-500 hover:text-zinc-300"
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </button>
        </Card>
      )}

      <Card className={selected.size > 0 ? 'mt-3 overflow-hidden' : 'mt-6 overflow-hidden'}>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={!!items && items.length > 0 && items.every((p) => selected.has(p.id))}
                  onChange={(e) =>
                    setSelected(e.target.checked ? new Set(items?.map((p) => p.id)) : new Set())
                  }
                />
              </th>
              <th className="w-24 px-4 py-3">ID</th>
              <th className="px-4 py-3">Title</th>
              <th className="w-28 px-4 py-3">Status</th>
              <th className="w-20 px-4 py-3 text-right">Entries</th>
              <th className="w-24 px-4 py-3 text-right">Reward</th>
              <th className="w-72 px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!items && (
              <tr>
                <td colSpan={7} className="px-4 py-10">
                  <div className="flex justify-center">
                    <Spinner />
                  </div>
                </td>
              </tr>
            )}
            {items?.map((p) => (
              <tr
                key={p.id}
                onClick={() => setViewing({ prediction: p, initialTab: 'overview' })}
                className="cursor-pointer border-b border-zinc-800/60 last:border-0 align-top hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggleSelected(p.id)}
                  />
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col items-start gap-1">
                    <button
                      type="button"
                      onClick={() => copyId(p.referenceCode ?? p.id)}
                      title={p.referenceCode ?? p.id}
                      className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                    >
                      {copiedId === (p.referenceCode ?? p.id)
                        ? 'Copied!'
                        : p.referenceCode
                          ? p.referenceCode.replace(/^PREDICT-(POLYMARKET|CSV|MANUAL)-/, '')
                          : `${p.id.slice(0, 8)}…`}
                    </button>
                    {/* referenceCode is a display/cross-check code, not a
                        lookup key — "Import results" only accepts the real
                        internal id, so it always needs to be reachable here
                        too, not just via Export CSV. */}
                    {p.referenceCode && (
                      <button
                        type="button"
                        onClick={() => copyId(p.id)}
                        title={`Internal ID (used by Import results): ${p.id}`}
                        className="font-mono text-[10px] text-zinc-600 hover:text-zinc-400"
                      >
                        {copiedId === p.id ? 'Copied!' : `id: ${p.id.slice(0, 8)}…`}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.title}</span>
                    {p.source === 'CSV' && <Badge color="violet">CSV</Badge>}
                    {p.source === 'AUTO_ENTRY' && <Badge color="blue">Polymarket</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-1 text-xs text-zinc-500">
                    {p.options.map((o, i) => (
                      <span key={o.id} title={o.question ?? undefined}>
                        {o.label}
                        {i < p.options.length - 1 ? ' ·' : ''}
                      </span>
                    ))}
                  </div>
                  {p.options.some((o) => o.votes > 0) && (
                    <div className="mt-2 max-w-xs">
                      <SplitBar segments={p.options.map((o, i) => ({ value: o.votes, accent: OPT_ACCENTS[i % OPT_ACCENTS.length] }))} />
                      <div className="mt-1 text-[11px] text-zinc-600">{p.options.reduce((s, o) => s + o.votes, 0)} votes</div>
                    </div>
                  )}
                  {checkResults[p.id] && (
                    <div className={`mt-1.5 text-xs ${CHECK_OUTCOME_COLOR[checkResults[p.id].outcome] ?? 'text-zinc-400'}`}>
                      {CHECK_OUTCOME_LABEL[checkResults[p.id].outcome] ?? checkResults[p.id].outcome}: {checkResults[p.id].detail}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge color={STATUS_COLOR[p.status]}>{p.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setViewing({ prediction: p, initialTab: 'predictors' })}
                    title="View who predicted"
                    className="tabular-nums text-zinc-400 underline decoration-dotted underline-offset-2 hover:text-zinc-200"
                  >
                    {p.participants}
                  </button>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                  +{p.reward}
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {!canEdit ? null : (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="ghost" onClick={() => duplicate(p)}>Duplicate</Button>
                    {p.status !== 'RESOLVED' && p.status !== 'CANCELLED' && (
                      <Button variant="ghost" onClick={() => setEditing(p)}>Edit</Button>
                    )}
                    {(p.status === 'DRAFT' || p.status === 'SCHEDULED') && (
                      <Button variant="ghost" onClick={() => act(p.id, 'open')}>Open now</Button>
                    )}
                    {p.status === 'OPEN' && <Button variant="ghost" onClick={() => act(p.id, 'close')}>Close</Button>}
                    {p.source === 'AUTO_ENTRY' && p.status === 'LOCKED' && (
                      <Button variant="ghost" onClick={() => checkResolution(p)} disabled={checkingId === p.id}>
                        {checkingId === p.id ? 'Checking…' : 'Check result'}
                      </Button>
                    )}
                    {(p.status === 'OPEN' || p.status === 'LOCKED' || p.status === 'AUTO_RESOLVED') && (
                      <Button onClick={() => openResolve(p)} disabled={checkingId === p.id}>
                        {checkingId === p.id ? 'Checking…' : p.status === 'AUTO_RESOLVED' ? 'Confirm' : 'Resolve'}
                      </Button>
                    )}
                    {p.status !== 'RESOLVED' && p.status !== 'CANCELLED' && (
                      <Button variant="danger" onClick={() => act(p.id, 'cancel')}>Cancel</Button>
                    )}
                  </div>
                  )}
                </td>
              </tr>
            ))}
            {items?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">No predictions yet.</td>
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

      {creating && (
        <CreateModal cats={cats} onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); }} />
      )}
      {resolving && (
        <ResolveModal prediction={resolving} onClose={() => setResolving(null)} onDone={() => { setResolving(null); load(); }} />
      )}
      {editing && (
        <EditModal prediction={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />
      )}
      {viewing && (
        <PredictionDetailModal
          prediction={viewing.prediction}
          initialTab={viewing.initialTab}
          onClose={() => setViewing(null)}
          cats={cats}
        />
      )}
      {importing && (
        <ImportModal kind={importing} onClose={() => setImporting(null)} onDone={() => { setImporting(null); load(); }} onImported={load} />
      )}
    </div>
  );
}

// Required columns only (title, categoryKey, closesAt, option1, option2) —
// matches what importPredictions actually enforces (admin.service.ts). All
// other CreatePredictionDto fields (subtitle, info, entryFee, reward,
// featured, extra options) are optional with working fallbacks, so they're
// deliberately left out of the sample rather than implying they're needed.
const SAMPLE_PREDICTIONS_CSV =
  'title,categoryKey,closesAt,option1,option2\n' +
  'Will it rain in Mumbai tomorrow?,sports,2026-08-01T12:00:00Z,Yes,No\n' +
  'Who wins El Clasico?,sports,2026-08-02T20:00:00Z,Real Madrid,Barcelona\n';

const SAMPLE_RESOLUTIONS_CSV =
  'predictionId,winningOption\n' +
  'paste-a-prediction-id-here,Yes\n';

function downloadCsv(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function ImportModal({
  kind,
  onClose,
  onDone,
  onImported,
}: {
  kind: 'predictions' | 'resolutions';
  onClose: () => void;
  onDone: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ created?: number; resolved?: number; failed: number; errors: { row: number; error: string }[] } | null>(null);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; }, []);

  const isPreds = kind === 'predictions';
  const endpoint = isPreds ? '/admin/predictions/import' : '/admin/predictions/import-resolutions';

  async function submit() {
    if (!file) { setErr('Choose a CSV file first.'); return; }
    setBusy(true); setErr(null); setResult(null); setProgress(null);
    try {
      if (isPreds) {
        // Predictions import runs as a background job (see admin.service.ts
        // startImportPredictions) so the request returns immediately instead
        // of blocking until every row is created — that's what let a
        // 100-row import outrun the gateway timeout and surface a 504 even
        // though it kept succeeding server-side. Poll for progress instead.
        const { jobId, total } = await uploadFile<{ jobId: string; total: number }>(endpoint, file);
        setProgress({ processed: 0, total });
        for (;;) {
          await new Promise((r) => setTimeout(r, 1000));
          if (cancelled.current) return;
          const job = await api<{
            status: 'running' | 'done';
            total: number;
            processed: number;
            created: number;
            failed: number;
            errors: { row: number; error: string }[];
          }>(`/admin/predictions/import/${jobId}/status`);
          if (cancelled.current) return;
          setProgress({ processed: job.processed, total: job.total });
          if (job.status === 'done') {
            setResult({ created: job.created, failed: job.failed, errors: job.errors });
            if (job.created > 0) onImported();
            if (job.failed === 0) setTimeout(onDone, 900);
            break;
          }
        }
      } else {
        const res = await uploadFile<{ resolved?: number; failed: number; errors: { row: number; error: string }[] }>(endpoint, file);
        setResult(res);
        // Refresh the underlying list/stats as soon as anything was created —
        // previously this only happened on a fully clean import (res.failed
        // === 0), so a partially-successful import left the predictions list
        // and summary counts stale even though rows were actually added.
        if ((res.resolved ?? 0) > 0) onImported();
        if (res.failed === 0) setTimeout(onDone, 900);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Import failed');
    } finally {
      if (!cancelled.current) setBusy(false);
    }
  }

  return (
    <Modal title={isPreds ? 'Import predictions (CSV)' : 'Import results (CSV)'} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">
          {isPreds
            ? 'Bulk-create predictions from a CSV. Required columns: title, categoryKey, closesAt (ISO), option1, option2.'
            : 'Bulk-resolve predictions from a CSV. Columns: predictionId, winningOption (option label or 1-based index). predictionId is the internal ID — click the small "id:" line under a row\'s reference code (or Export CSV) to copy it, not the reference code itself.'}
        </p>
        <button
          className="text-xs text-cyan-300 underline"
          onClick={() => downloadCsv(isPreds ? 'predictions-sample.csv' : 'resolutions-sample.csv', isPreds ? SAMPLE_PREDICTIONS_CSV : SAMPLE_RESOLUTIONS_CSV)}
        >
          ↓ Download sample CSV
        </button>
        <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={inputClass} />
        {err && <p className="text-sm text-rose-400">{err}</p>}
        {progress && !result && (
          <div className="space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-400 transition-all"
                style={{ width: `${progress.total ? Math.round((progress.processed / progress.total) * 100) : 0}%` }}
              />
            </div>
            <p className="text-xs text-zinc-400">{progress.processed}/{progress.total} processed…</p>
          </div>
        )}
        {result && (
          <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
            <div className="text-emerald-300">
              {isPreds ? `${result.created ?? 0} created` : `${result.resolved ?? 0} resolved`} · {result.failed} failed
            </div>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-rose-300">
                {result.errors.map((er, i) => (
                  <li key={i}>Row {er.row}: {er.error}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={submit} disabled={busy || !file}>
            {busy ? (progress ? `Importing… ${progress.processed}/${progress.total}` : 'Importing…') : 'Import'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditModal({
  prediction,
  onClose,
  onDone,
}: {
  prediction: AdminPrediction;
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(prediction.title);
  const [subtitle, setSubtitle] = useState(prediction.subtitle ?? '');
  const [info, setInfo] = useState(prediction.info ?? '');
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(prediction.bannerImageUrl ?? null);
  // Reflects this prediction's actual current mode — not hardcoded true —
  // so re-opening Edit on an already-overridden prediction shows it
  // unchecked with its real values, instead of always defaulting to "use
  // default" and silently losing the override on save.
  const [useDefaultEconomy, setUseDefaultEconomy] = useState(prediction.useDefaultEconomy);
  const [entryFee, setEntryFee] = useState(String(prediction.entryFee));
  const [reward, setReward] = useState(String(prediction.reward));
  const [featured, setFeatured] = useState(prediction.featured);
  const [closesAt, setClosesAt] = useState(toDatetimeLocalValue(prediction.closesAt));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; entryFee?: string; reward?: string }>({});

  // Deliberately NOT `Number(entryFee) || 0` here — that silently turns a
  // cleared/emptied field into a saved 0 with no warning (that's exactly
  // how a prediction ended up showing "+0" in the app: the field got
  // cleared, Number('') is 0, and 0 is a "valid" number so nothing caught
  // it). Keep the raw parsed value (possibly NaN) so validation below can
  // actually block the save instead of silently coercing it.
  const pointsRaw = Number(entryFee);
  const rewardRaw = Number(reward);

  async function submit() {
    setFieldErrors({});
    if (!title.trim()) {
      setFieldErrors({ title: 'Title is required.' });
      setErr('Title is required.');
      return;
    }
    if (!useDefaultEconomy) {
      if (!Number.isFinite(pointsRaw) || pointsRaw < 0) {
        setFieldErrors({ entryFee: 'Points must be a number ≥ 0.' });
        setErr('Points must be a number ≥ 0.');
        return;
      }
      if (!Number.isFinite(rewardRaw) || rewardRaw <= 0) {
        setFieldErrors({ reward: 'Reward must be a number greater than 0.' });
        setErr('Reward must be a number greater than 0.');
        return;
      }
    }
    setBusy(true);
    setErr(null);
    try {
      await api(`/admin/predictions/${prediction.id}`, {
        method: 'PATCH',
        body: {
          title: title.trim(),
          subtitle: subtitle.trim(),
          info: info.trim(),
          bannerImageUrl: bannerImageUrl || null,
          useDefaultEconomy,
          ...(useDefaultEconomy ? {} : { entryFee: pointsRaw, reward: rewardRaw }),
          featured,
          ...(closesAt ? { closesAt: new Date(closesAt).toISOString() } : {}),
        },
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  }

  return (
    <Modal title="Edit prediction" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Title" error={fieldErrors.title}><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></Field>
        <Field label="Subtitle"><input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={inputClass} /></Field>
        <Field label="Additional information"><textarea value={info} onChange={(e) => setInfo(e.target.value)} rows={4} className={inputClass} /></Field>
        <Field label="Banner image"><ImageUpload value={bannerImageUrl} onChange={setBannerImageUrl} label="Banner" /></Field>
        <div className="space-y-3 rounded-lg border border-white/5 p-3">
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90">
            ⚠ Advanced setting — overrides the global points economy for this prediction only.
            Adjust only if you understand the payout impact; incorrect values can unbalance rewards.
          </p>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={useDefaultEconomy} onChange={(e) => setUseDefaultEconomy(e.target.checked)} />
            Leave points &amp; reward unchanged
          </label>
          {!useDefaultEconomy && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Points (deducted on entry)" error={fieldErrors.entryFee}>
                <input type="number" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Reward (paid on correct call)" error={fieldErrors.reward}>
                <input type="number" value={reward} onChange={(e) => setReward(e.target.value)} className={inputClass} />
              </Field>
            </div>
          )}
        </div>
        <Field label="Closes at"><input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className={inputClass} /></Field>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Featured
        </label>
        {err && <p className="text-sm text-rose-400">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Row-click detail dialog — admin-only (no app/web-portal equivalent).
 * "Overview" mirrors what Edit shows plus status/source/timestamps; the
 * "Who predicted" tab lazily loads GET /admin/predictions/:id/entries the
 * first time it's opened, same lazy-tab pattern as the Users tab's own
 * detail modal. Clicking the participants count in the table jumps
 * straight to this tab via initialTab. */
function PredictionDetailModal({
  prediction: p,
  initialTab,
  onClose,
  cats,
}: {
  prediction: AdminPrediction;
  initialTab: 'overview' | 'predictors';
  onClose: () => void;
  cats: Category[];
}) {
  const [tab, setTab] = useState<'overview' | 'predictors'>(initialTab);
  const [entries, setEntries] = useState<PredictionEntryRow[] | null>(null);
  const [entriesErr, setEntriesErr] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== 'predictors' || entries !== null) return;
    api<PredictionEntriesPage>(`/admin/predictions/${p.id}/entries`, { query: { take: 200 } })
      .then((res) => setEntries(res.items))
      .catch((e) => {
        setEntries([]);
        setEntriesErr(e instanceof Error ? e.message : 'Failed to load');
      });
  }, [tab, p.id, entries]);

  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString() : '—');
  const totalVotes = p.options.reduce((s, o) => s + o.votes, 0);

  const rows: [string, ReactNode][] = [
    ['Status', <Badge key="status" color={STATUS_COLOR[p.status]}>{p.status}</Badge>],
    ['Source', p.source ?? 'MANUAL'],
    ['ID / reference', p.referenceCode ?? p.id],
    ['Category', cats.find((c) => c.id === p.categoryId)?.label ?? p.categoryId],
    ['Featured', p.featured ? 'Yes' : 'No'],
    ['Points', p.entryFee],
    ['Reward', `+${p.reward}`],
    ['Participants', p.participants],
    ['Opens at', fmtDate(p.opensAt)],
    ['Closes at', fmtDate(p.closesAt)],
    ['Resolved at', fmtDate(p.resolvedAt)],
  ];

  const predictorsCount = entries?.length ?? p.participants;

  return (
    <Modal title={p.title} onClose={onClose} maxWidth="max-w-2xl">
      {p.subtitle && <p className="-mt-2 mb-3 text-sm text-zinc-500">{p.subtitle}</p>}
      <div className="mb-4 flex gap-2">
        {(['overview', 'predictors'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs transition ${
              tab === t ? 'bg-cyan-500/15 text-cyan-300' : 'text-zinc-400 hover:bg-zinc-800/60'
            }`}
          >
            {t === 'overview' ? 'Overview' : `Who predicted (${predictorsCount})`}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          {p.bannerImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.bannerImageUrl} alt="" className="max-h-40 w-full rounded-lg object-cover" />
          )}
          {p.info && <p className="text-sm text-zinc-400">{p.info}</p>}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex min-w-0 items-start justify-between gap-4 border-b border-white/5 py-1.5">
                <span className="shrink-0 text-zinc-500">{k}</span>
                <span className="min-w-0 break-all text-right font-medium text-zinc-200">{v}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Options</div>
            <div className="space-y-1.5">
              {p.options.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-zinc-200">
                    {o.label}
                    {o.id === p.correctOptionId && <Badge color="green">Winner</Badge>}
                  </span>
                  <span className="tabular-nums text-zinc-500">
                    {o.votes} vote{o.votes === 1 ? '' : 's'}
                    {totalVotes > 0 ? ` · ${Math.round((o.votes / totalVotes) * 100)}%` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'predictors' &&
        (entries === null ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : entriesErr ? (
          <p className="py-6 text-center text-sm text-rose-400">{entriesErr}</p>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">No one has predicted on this yet.</p>
        ) : (
          // No max-h/overflow wrapper here — Modal's own content div is
          // already scrollable, so nesting a second scroll container just
          // gave this tab two overlapping scrollbars.
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-zinc-500">
              <tr className="border-b border-white/10">
                <th className="py-2 pr-3 font-medium">User</th>
                <th className="py-2 pr-3 font-medium">Pick</th>
                <th className="py-2 pr-3 font-medium">Outcome</th>
                <th className="py-2 pr-3 text-right font-medium">Reward</th>
                <th className="py-2 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 pr-3">
                    <div className="font-medium text-zinc-200">{e.userName}</div>
                    <div className="text-xs text-zinc-500">{e.userEmail}</div>
                  </td>
                  <td className="py-2 pr-3 text-zinc-400">{e.pick}</td>
                  <td className="py-2 pr-3">
                    <Badge color={e.status === 'WON' ? 'green' : e.status === 'LOST' ? 'red' : 'amber'}>{e.status}</Badge>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-amber-300">
                    {e.rewardEarned > 0 ? `+${e.rewardEarned.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-2 text-right text-xs text-zinc-500">
                    {new Date(e.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </Modal>
  );
}

function ResolveModal({ prediction, onClose, onDone }: { prediction: AdminPrediction; onClose: () => void; onDone: () => void }) {
  // AUTO_RESOLVED predictions already have Polymarket's detected winner in
  // correctOptionId — pre-select it so confirming is a single click, while
  // still letting the admin override it before anything is paid out.
  const [optionId, setOptionId] = useState(prediction.correctOptionId ?? prediction.options[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    // No native confirm() here — this modal's own "Resolve & pay out" button
    // plus the warning text below it already is the confirmation step;
    // stacking a second, unstyled browser confirm() on top of it was the
    // "confirmation pop-up UI is not proper" complaint (two overlapping
    // confirmations for one action, one of them unthemed).
    setBusy(true);
    setErr(null);
    try {
      await api(`/admin/predictions/${prediction.id}/resolve`, { method: 'POST', body: { correctOptionId: optionId } });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  }

  return (
    <Modal title="Resolve prediction" onClose={onClose}>
      <p className="mb-4 text-sm text-zinc-500">{prediction.title}</p>
      {prediction.status === 'AUTO_RESOLVED' && (
        <p className="mb-4 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-xs text-teal-300">
          Polymarket already closed this market — the winning option below was detected automatically. Confirm to settle entries and pay out.
        </p>
      )}
      <Field label="Winning option">
        <select value={optionId} onChange={(e) => setOptionId(e.target.value)} className={selectClass}>
          {prediction.options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </Field>
      <p className="mt-3 text-xs text-zinc-500">Resolving settles all entries, pays winners and runs the lucky draw. This can&apos;t be undone.</p>
      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={busy}>{busy ? 'Resolving…' : 'Resolve & pay out'}</Button>
      </div>
    </Modal>
  );
}

function CreateModal({
  cats,
  onClose,
  onDone,
}: {
  cats: Category[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [info, setInfo] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [opensAt, setOpensAt] = useState('');
  const [useDefaultEconomy, setUseDefaultEconomy] = useState(true);
  const [entryFee, setEntryFee] = useState('50');
  const [reward, setReward] = useState('100');
  const [featured, setFeatured] = useState(false);

  // See EditModal for why this isn't `Number(entryFee) || 0` - that
  // silently turns a cleared field into a saved 0 with no warning.
  const pointsRaw = Number(entryFee);
  const rewardRaw = Number(reward);
  const [options, setOptions] = useState<{ label: string }[]>([{ label: '' }, { label: '' }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Per-field errors shown right below the offending field (QA: the single
  // combined message at the bottom was easy to miss when the field itself
  // was scrolled out of view) — kept alongside, not instead of, `err`.
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    categoryId?: string;
    closesAt?: string;
    options?: string;
    entryFee?: string;
    reward?: string;
  }>({});
  const [showMedia, setShowMedia] = useState(false);
  const [showEconomy, setShowEconomy] = useState(false);

  // Scrollbar only shows while actively scrolling — toggle a class directly
  // (not React state) so scroll events don't trigger re-renders.
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    el.classList.add('is-scrolling');
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => el.classList.remove('is-scrolling'), 600);
  }

  function setOpt(i: number, v: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, label: v } : o)));
  }

  async function submit() {
    setErr(null);
    setFieldErrors({});
    const opts = options.filter((o) => o.label.trim());
    if (!title.trim() || !categoryId || !closesAt || opts.length < 2) {
      setFieldErrors({
        title: !title.trim() ? 'Title is required.' : undefined,
        categoryId: !categoryId ? 'Category is required.' : undefined,
        closesAt: !closesAt ? 'Close time is required.' : undefined,
        options: opts.length < 2 ? 'At least 2 options are required.' : undefined,
      });
      setErr('Title, category, close time and at least 2 options are required.');
      return;
    }
    if (!useDefaultEconomy) {
      if (!Number.isFinite(pointsRaw) || pointsRaw < 0) {
        setFieldErrors({ entryFee: 'Points must be a number ≥ 0.' });
        setErr('Points must be a number ≥ 0.');
        return;
      }
      if (!Number.isFinite(rewardRaw) || rewardRaw <= 0) {
        setFieldErrors({ reward: 'Reward must be a number greater than 0.' });
        setErr('Reward must be a number greater than 0.');
        return;
      }
    }
    setBusy(true);
    try {
      await api('/admin/predictions', {
        method: 'POST',
        body: {
          categoryId,
          title: title.trim(),
          subtitle: subtitle.trim() || undefined,
          info: info.trim() || undefined,
          bannerImageUrl: bannerImageUrl || undefined,
          useDefaultEconomy,
          ...(useDefaultEconomy ? {} : { entryFee: pointsRaw, reward: rewardRaw }),
          closesAt: new Date(closesAt).toISOString(),
          ...(opensAt ? { opensAt: new Date(opensAt).toISOString() } : {}),
          featured,
          options: opts.map((o) => ({ label: o.label.trim(), odds: 1.0 })),
        },
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  }

  return (
    <Modal title="New prediction" onClose={onClose}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scrollbar-on-scroll max-h-[70vh] space-y-3 overflow-y-auto pr-1"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Required</p>
        <Field label="Title" error={fieldErrors.title}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Subtitle (optional)">
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Additional information (optional)">
          <textarea value={info} onChange={(e) => setInfo(e.target.value)} rows={4} className={inputClass} placeholder="Extra details, rules, context shown on the prediction…" />
        </Field>
        <Field label="Category" error={fieldErrors.categoryId}>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectClass}>
            <option value="">Select…</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Closes at" error={fieldErrors.closesAt}>
          <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className={inputClass} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Featured (optional)
        </label>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Options (required — at least 2)</span>
            <button className="text-xs text-cyan-300" onClick={() => setOptions((p) => [...p, { label: '' }])}>
              + Add option
            </button>
          </div>
          <div className="space-y-2">
            {options.map((o, i) => (
              <input key={i} placeholder={`Option ${i + 1}`} value={o.label} onChange={(e) => setOpt(i, e.target.value)} className={inputClass} />
            ))}
          </div>
          {fieldErrors.options && <span className="mt-1 block text-xs text-red-400">{fieldErrors.options}</span>}
        </div>

        <p className="pt-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Optional</p>

        <button
          type="button"
          onClick={() => setShowMedia((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.04]"
        >
          <span>Media &amp; scheduling</span>
          <span className="text-zinc-500">{showMedia ? '▲' : '▼'}</span>
        </button>
        {showMedia && (
          <div className="space-y-3 rounded-lg border border-white/5 p-3">
            <Field label="Banner image">
              <ImageUpload value={bannerImageUrl} onChange={setBannerImageUrl} label="Banner" />
            </Field>
            <Field label="Schedule open — publishes automatically at this time instead of immediately">
              <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} className={inputClass} />
            </Field>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowEconomy((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.04]"
        >
          <span>Points &amp; reward</span>
          <span className="text-zinc-500">{showEconomy ? '▲' : '▼'}</span>
        </button>
        {showEconomy && (
          <div className="space-y-3 rounded-lg border border-white/5 p-3">
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90">
              ⚠ Advanced setting — overrides the global points economy for this prediction only.
              Adjust only if you understand the payout impact; incorrect values can unbalance rewards.
            </p>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={useDefaultEconomy} onChange={(e) => setUseDefaultEconomy(e.target.checked)} />
              Use default settings (from Settings → Points economy)
            </label>
            {!useDefaultEconomy && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Points (deducted on entry)" error={fieldErrors.entryFee}>
                  <input type="number" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Reward (paid on correct call)" error={fieldErrors.reward}>
                  <input type="number" value={reward} onChange={(e) => setReward(e.target.value)} className={inputClass} />
                </Field>
              </div>
            )}
          </div>
        )}
        {err && <p className="text-sm text-red-400">{err}</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create'}</Button>
      </div>
    </Modal>
  );
}
