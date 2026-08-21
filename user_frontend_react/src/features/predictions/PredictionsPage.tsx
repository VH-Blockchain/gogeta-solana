import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import BoltRounded from '@mui/icons-material/BoltRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import GridViewRounded from '@mui/icons-material/GridViewRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import WifiOff from '@mui/icons-material/WifiOff';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import SearchOff from '@mui/icons-material/SearchOff';
import LockClockRounded from '@mui/icons-material/LockClockRounded';
import History from '@mui/icons-material/History';
import StackedBarChart from '@mui/icons-material/StackedBarChart';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import CancelOutlined from '@mui/icons-material/CancelOutlined';
import TrackChangesOutlined from '@mui/icons-material/TrackChangesOutlined';
import EmojiEventsRounded from '@mui/icons-material/EmojiEventsRounded';
import HourglassTopRounded from '@mui/icons-material/HourglassTopRounded';
import ScheduleRounded from '@mui/icons-material/ScheduleRounded';
import { MetaPixel } from '@/core/analytics/metaPixel';
import { Fmt } from '@/core/utils/format';
import { PredictionsRepository } from '@/data/api/predictionsRepository';
import { CategoryCatalog } from '@/data/categoryCatalog';
import type { Prediction } from '@/data/models';
import { useConfigStore } from '@/store/configStore';
import { usePredictionsStore } from '@/store/predictionsStore';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import { ArenaCard } from '@/components/ArenaCard';
import { Icon } from '@/components/Icon';
import { HScrollArrows } from '@/components/HScrollArrows';
import { CardGrid, Counter, Masthead, RailHeader, compactCounter } from '@/components/PageChrome';
import { EmptyState, pagePadding } from '@/components/Primitives';
import { Reveal } from '@/components/Reveal';
import { SkeletonCard } from '@/components/Skeleton';
import { StatTile } from '@/components/StatTile';
import { WebCard } from '@/components/WebCard';
import { useWindowWidth } from '@/hooks/useWindowWidth';
import { withSelectedOption } from '@/data/models';
import { showPredictionDetail } from './detailStore';
import { FiltersDialog } from './FiltersDialog';
import {
  defaultPredictionFilters,
  filtersEqual,
  showFromQueryParam,
  sortQueryKey,
  type PredictionFilters,
} from './filters';

/** Prediction module (SOW: view available, submit, status, results). */
export function PredictionsPage() {
  const [params, setParams] = useSearchParams();
  const width = useWindowWidth();

  const predictionListCfg = useConfigStore((s) => s.config.predictionList);
  const categoriesVersion = useConfigStore((s) => s.categoriesVersion);
  const openTotal = usePredictionsStore((s) => s.openTotal);
  const active = usePredictionsStore((s) => s.active);
  const history = usePredictionsStore((s) => s.history);
  const open = usePredictionsStore((s) => s.open);
  const loadActive = usePredictionsStore((s) => s.loadActive);
  const loadHistory = usePredictionsStore((s) => s.loadHistory);

  // ---- URL-derived state. The URL is the source of truth for tab/category/
  // query/show, exactly as the Flutter router's query params were: the topbar's
  // "Predict now" resets them by navigating without params, and the sidebar's
  // category links change them from outside this page.
  const tabParam = params.get('tab');
  const tab = tabParam === 'active' ? 1 : tabParam === 'history' ? 2 : 0;
  const categoryParam = params.get('category');
  const query = params.get('q') ?? '';
  const showParam = params.get('show');

  // Multi-select (client feedback): an empty set means All; otherwise a
  // prediction matches if its category is in this set. Seeded from the URL's
  // single `category` param, then owned locally as the user toggles more on.
  const [categories, setCategories] = useState<Set<string>>(
    () => new Set(categoryParam ? [categoryParam] : []),
  );

  const [filters, setFilters] = useState<PredictionFilters>(() => {
    const base = defaultPredictionFilters(predictionListCfg);
    const override = showFromQueryParam(showParam);
    return override ? { ...base, show: override } : base;
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const toolbarRef = useRef<HTMLDivElement>(null);

  const filtersActive = !filtersEqual(filters, defaultPredictionFilters(predictionListCfg));

  /**
   * Refreshes whichever of My Picks (1) / History (2) the given tab is — Open
   * (0) owns and refetches its own data in OpenGrid.
   *
   * WebShell's one-time portal-session bootstrap only ever covers the very
   * first mount, so without this a stale copy from back then is all these two
   * tabs would ever show short of a hard browser refresh.
   */
  useEffect(() => {
    if (tab === 1) void loadActive();
    else if (tab === 2) void loadHistory();
  }, [tab, loadActive, loadHistory]);

  // A sidebar category link changing the URL — re-seed the local selection.
  useEffect(() => {
    setCategories(new Set(categoryParam ? [categoryParam] : []));
  }, [categoryParam]);

  // A ?show= deep link (e.g. the dashboard's Featured "See all").
  useEffect(() => {
    const override = showFromQueryParam(showParam);
    if (override) setFilters((f) => ({ ...f, show: override }));
  }, [showParam]);

  /**
   * Arriving here already filtered to a category (a sidebar link from another
   * page) — the page always mounts scrolled to the top hero, so without this
   * the filtered results sit below the fold and silently look like nothing
   * happened. Only fires on a *URL-driven* category change: pagination, search
   * and in-page pill toggles don't touch `categoryParam`.
   */
  useEffect(() => {
    if (!categoryParam) return;
    const id = window.requestAnimationFrame(() => {
      toolbarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [categoryParam]);

  /**
   * Routes the tab switch instead of just flipping local state — a plain
   * setState never touched the URL, so the topbar's "Predict now" (which
   * navigates with no tab param) saw the same state before and after and
   * silently stayed on My Picks/History (PO-43). Carries the current
   * category/search along so switching tabs doesn't drop an in-progress
   * Open-tab filter.
   */
  const changeTab = (i: number) => {
    const next = new URLSearchParams();
    const firstCategory = [...categories][0];
    if (firstCategory) next.set('category', firstCategory);
    if (query) next.set('q', query);
    if (i === 1) next.set('tab', 'active');
    if (i === 2) next.set('tab', 'history');
    setParams(next);
  };

  const setQuery = (q: string) => {
    const next = new URLSearchParams(params);
    if (q) next.set('q', q);
    else next.delete('q');
    setParams(next);
  };

  const toggleCategory = (key: string) => {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sectionTitle =
    tab === 1
      ? 'Your active picks'
      : tab === 2
        ? 'Your history'
        : query.length === 0
          ? 'Open predictions'
          : `Results for "${query}"`;

  const padding = pagePadding(width);

  const gridKey = `${tab}-${[...categories].sort().join(',')}-${query}-${filters.sort}-${filters.show}`;

  return (
    <div style={{ padding }}>
      <Reveal duration={350} y={0.05}>
        <PredictionsHero open={open} query={query} />
      </Reveal>

      <div style={{ height: 24 }} />

      {/* Toolbar: rail-keyed section header with the tab switcher in its
          trailing slot, matching the Dashboard's section language. */}
      <div ref={toolbarRef} style={{ scrollMarginTop: 12 }}>
        <RailHeader
          title={sectionTitle}
          caption={
            tab === 1
              ? 'Locked in and waiting to resolve'
              : tab === 2
                ? 'Everything you have played'
                : query.length === 0
                  ? 'Live questions taking picks now'
                  : 'Matching your search'
          }
          accent={tab === 1 ? WebTokens.gold : tab === 2 ? WebTokens.violet : WebTokens.accent}
          trailing={
          <Segmented
            // "Active" renamed to "My Picks" — it already showed the same
            // active data the old My-Picks category pill did, so promoting the
            // pill into its own tab would have duplicated this one.
            labels={['Open', 'My Picks', 'History']}
            // Open uses the true server-side total (`open` is capped to a
            // 20-item page) — Active/History return everything unpaginated, so
            // .length is already correct there.
            counts={[openTotal, active.length, history.length]}
            index={tab}
            onChange={changeTab}
          />
          }
        />
      </div>

      <div style={{ height: 24 }} />

      {tab === 0 && (
        <>
          {/* Inline search bar directly above the filter/grid — same
              destination/state as the sidebar and topbar boxes, just the
              reference's in-content placement too. */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <InlineSearch
                key={query}
                initialValue={query}
                onSubmit={(q) => {
                  if (q.length > 0 && q !== query) MetaPixel.logSearched();
                  setQuery(q);
                }}
              />
            </div>
            <FiltersButton active={filtersActive} onClick={() => setFiltersOpen(true)} />
          </div>
          <div style={{ height: 18 }} />
        </>
      )}

      {tab === 0 && CategoryCatalog.isLoaded && (
        <>
          <CategoryPills
            key={categoriesVersion}
            selected={categories}
            onToggle={toggleCategory}
            onClearAll={() => setCategories(new Set())}
          />
          <div style={{ height: 26 }} />
        </>
      )}

      <div key={gridKey} className="reveal" style={{ ['--reveal-y' as string]: '2%' }}>
        {tab === 1 ? (
          <MyPicksGrid items={active} />
        ) : tab === 2 ? (
          <HistoryList />
        ) : (
          <OpenGrid categories={categories} query={query} filters={filters} />
        )}
      </div>

      <FiltersDialog
        open={filtersOpen}
        initial={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={(f) => {
          setFilters(f);
          setFiltersOpen(false);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero banner
// ---------------------------------------------------------------------------

/**
 * Page masthead. Uses the shared slim band (see components/PageChrome) so this
 * page and the Dashboard read as one product rather than two hero styles.
 *
 * The headline swaps to a search summary when a query is active — same
 * behaviour as before, just in the new band.
 */
function PredictionsHero({ open, query }: { open: Prediction[]; query: string }) {
  const players = open.reduce((s, x) => s + x.participants, 0);
  const winUpTo = open.length === 0 ? 0 : Math.max(...open.map((x) => x.reward));

  return (
    <Masthead
      eyebrow="PREDICTION ARENA"
      title={query.length === 0 ? 'Predict it first. Own the leaderboard.' : 'Search'}
      subtitle={
        query.length === 0
          ? 'Back your calls on live questions and climb the ranks every day.'
          : `Showing predictions matching "${query}".`
      }
      counters={[
        <Counter
          key="open"
          icon={<BoltRounded />}
          value={`${open.length}`}
          label="Open now"
          tint={WebTokens.accent}
        />,
        <Counter
          key="players"
          icon={<GroupsRounded />}
          value={compactCounter(players)}
          label="Players in play"
          tint={WebTokens.blue}
        />,
        <Counter
          key="win"
          icon={<BoltRounded />}
          value={`${winUpTo}`}
          label="Win up to"
          tint={WebTokens.gold}
        />,
      ]}
    />
  );
}

/**
 * Opens the sort/show filters dialog. Lit up whenever the applied filters
 * differ from the admin-configured default, so an active non-default filter is
 * never invisible.
 */
function FiltersButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 48,
        flexShrink: 0,
        padding: '0 16px',
        background: active ? withAlpha(WebTokens.accent, 0.12) : 'rgba(255,255,255,0.04)',
        borderRadius: WebTokens.radiusControl,
        border: `1px solid ${active ? withAlpha(WebTokens.accent, 0.55) : WebTokens.border}`,
        color: active ? WebTokens.accent : WebTokens.textSecondary,
        fontWeight: 700,
        fontSize: 13,
      }}
    >
      <TuneRounded sx={{ fontSize: 18 }} />
      Filters
      {active && (
        <span
          aria-hidden="true"
          style={{ width: 6, height: 6, borderRadius: '50%', background: WebTokens.accent }}
        />
      )}
    </button>
  );
}

/**
 * In-content search field — filters the Open grid by title. Has an explicit
 * submit control: previously Enter was the only way to run a search, with no
 * visible affordance for it.
 */
function InlineSearch({
  initialValue,
  onSubmit,
}: {
  initialValue: string;
  onSubmit: (q: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 44,
        padding: '0 16px',
        background: WebTokens.surfaceAlt,
        // Full pill, not a softly-rounded rectangle.
        borderRadius: 999,
        border: `1px solid ${WebTokens.border}`,
      }}
    >
      <SearchRounded sx={{ fontSize: 18 }} style={{ color: WebTokens.textMuted }} />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(value.trim());
        }}
        placeholder="Search predictions…"
        aria-label="Search predictions"
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontSize: 13.5,
          fontWeight: 500,
          color: WebTokens.textPrimary,
        }}
      />
      {value.length > 0 && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue('');
            onSubmit('');
          }}
          style={{ color: WebTokens.textMuted, display: 'inline-flex' }}
        >
          <CloseRounded sx={{ fontSize: 16 }} />
        </button>
      )}
      <button
        type="button"
        aria-label="Run search"
        onClick={() => onSubmit(value.trim())}
        style={{
          width: 30,
          height: 30,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          background: withAlpha(WebTokens.accent, 0.14),
          color: WebTokens.accent,
        }}
      >
        <ArrowForwardRounded sx={{ fontSize: 16 }} />
      </button>
    </div>
  );
}

function Segmented({
  labels,
  counts,
  index,
  onChange,
}: {
  labels: string[];
  counts?: number[];
  index: number;
  onChange: (i: number) => void;
}) {
  return (
    <div
      role="tablist"
      style={{
        display: 'inline-flex',
        gap: 0,
        padding: 4,
        flexShrink: 0,
        background: WebTokens.surfaceAlt,
        borderRadius: 999,
        border: `1px solid ${WebTokens.border}`,
      }}
    >
      {labels.map((label, i) => {
        const selected = i === index;
        const count = counts?.[i] ?? 0;
        return (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(i)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              // Fully rounded pill, not a rectangular chip.
              borderRadius: 999,
              background: selected ? WebTokens.accent : 'transparent',
              color: selected ? WebTokens.onAccent : WebTokens.textSecondary,
              fontSize: 13,
              fontWeight: 600,
              transition: 'background 160ms ease, color 160ms ease',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
            {count > 0 && (
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: selected
                    ? withAlpha(WebTokens.onAccent, 0.18)
                    : withAlpha(WebTokens.accent, 0.16),
                  color: selected ? WebTokens.onAccent : WebTokens.accent,
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Open tab
// ---------------------------------------------------------------------------

/**
 * Multi-select category filter (client feedback: pick more than one category
 * at once, unlike the app's single-select chips) — "All" clears the selection;
 * any other chip toggles independently, and a small check mark distinguishes
 * this from a single-select/radio pattern.
 */
function CategoryPills({
  selected,
  onToggle,
  onClearAll,
}: {
  selected: Set<string>;
  onToggle: (key: string) => void;
  onClearAll: () => void;
}) {
  return (
    <HScrollArrows>
      <Pill
        icon={<GridViewRounded sx={{ fontSize: 15 }} />}
        label="All"
        active={selected.size === 0}
        showCheck={false}
        onClick={onClearAll}
      />
      {CategoryCatalog.all.map((c) => (
        <Pill
          key={c.key}
          icon={<Icon name={c.iconName} size={15} />}
          label={c.label}
          active={selected.has(c.key)}
          showCheck
          onClick={() => onToggle(c.key)}
        />
      ))}
    </HScrollArrows>
  );
}

function Pill({
  icon,
  label,
  active,
  showCheck,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  showCheck: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginRight: 8,
        padding: '9px 14px',
        flexShrink: 0,
        background: active ? withAlpha(WebTokens.accent, 0.14) : 'rgba(255,255,255,0.04)',
        borderRadius: 999,
        border: `1px solid ${active ? withAlpha(WebTokens.accent, 0.55) : WebTokens.border}`,
        color: active ? WebTokens.accent : WebTokens.textSecondary,
        fontSize: 12.5,
        fontWeight: 700,
        transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ display: 'inline-flex', color: active ? WebTokens.accent : WebTokens.textMuted }}>
        {active && showCheck ? <CheckRounded sx={{ fontSize: 15 }} /> : icon}
      </span>
      {label}
    </button>
  );
}

const PAGE_SIZE = 20;

/**
 * Real, server-paginated Open grid. Rendering straight off the shared `open`
 * list would be a single fixed `take: 20` fetch with category filtering done
 * client-side over just those 20 — silently hiding every open prediction past
 * the 20th, in every category. This owns its own paged fetch instead: a single
 * selected category is passed to the backend directly (accurate server-side
 * filtered pagination); "All" or multiple categories fetch unfiltered pages and
 * filter client-side, auto-continuing to the next page if a filtered page comes
 * back empty but more exist.
 */
function OpenGrid({
  categories,
  query,
  filters,
}: {
  categories: Set<string>;
  query: string;
  filters: PredictionFilters;
}) {
  const [items, setItems] = useState<Prediction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemsRef = useRef<Prediction[]>([]);
  itemsRef.current = items;

  const singleCategory = categories.size === 1 ? [...categories][0] : null;

  const visible = useMemo(
    () =>
      items
        .filter((x) => x.selectedOptionId == null)
        .filter(
          (x) => categories.size === 0 || singleCategory != null || categories.has(x.categoryKey),
        ),
    [items, categories, singleCategory],
  );

  const hasMore = items.length < total;

  const fetchPage = useCallback(
    async ({ reset = false, preserveCount = false } = {}) => {
      // preserveCount: keep showing the currently-loaded cards while a
      // post-submit refresh is in flight, instead of flashing back to the
      // skeleton — same reasoning as the app's Predict tab.
      const current = itemsRef.current;
      if (reset) {
        setLoading(current.length === 0);
        setError(null);
      } else {
        if (current.length >= total && total > 0) return;
        setLoadingMore(true);
      }

      const take =
        reset && preserveCount && current.length > PAGE_SIZE ? current.length : PAGE_SIZE;

      try {
        const page = await PredictionsRepository.list({
          category: singleCategory,
          search: query.length === 0 ? null : query,
          sort: sortQueryKey[filters.sort],
          featured: filters.show === 'featured' ? true : null,
          closingHours: filters.show === 'closingSoon' ? 24 : null,
          skip: reset ? 0 : current.length,
          take,
        });

        /**
         * The backend's skip/take pagination has no concept of "already
         * answered by this user" — that's filtered out client-side by
         * `visible` — so a batch that's *partly* already-answered renders short
         * of a full page, leaving a gap in the grid that only got backfilled
         * once the user manually clicked "Load more" (PO-51).
         */
        const answeredInBatch = page.items.some((x) => x.selectedOptionId != null);

        const nextItems = reset ? page.items : [...current, ...page.items];
        itemsRef.current = nextItems;
        setItems(nextItems);
        setTotal(page.total);
        setLoading(false);
        setLoadingMore(false);

        const nextVisible = nextItems
          .filter((x) => x.selectedOptionId == null)
          .filter(
            (x) => categories.size === 0 || singleCategory != null || categories.has(x.categoryKey),
          );
        const stillHasMore = nextItems.length < page.total;

        // A multi-category (or "All") filter is applied client-side, so a page
        // that comes back with nothing matching visible-wise shouldn't dead-end
        // the grid on a false "no results" if more pages exist.
        if (stillHasMore && (nextVisible.length === 0 || answeredInBatch)) {
          await fetchPage();
        }
      } catch {
        setError('Could not load predictions.');
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [singleCategory, query, filters, categories, total],
  );

  // The parent gives this component a fresh key whenever category/query/
  // filters change, so this runs as a fresh mount rather than an update.
  useEffect(() => {
    void fetchPage({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * A submit only changes cards' own locked state, not which page the user is
   * on — re-fetching just the first page would collapse a longer,
   * already-loaded list back down to PAGE_SIZE and strand whatever they'd
   * scrolled past. Re-fetching the same number of items they'd already loaded
   * keeps their place instead.
   */
  const submitVersion = usePredictionsStore((s) => s.submitVersion);
  const justSubmittedVersion = usePredictionsStore((s) => s.justSubmittedVersion);
  const firstSubmitVersion = useRef(submitVersion);
  const firstJustSubmitted = useRef(justSubmittedVersion);

  // Optimistic hide, fires first (justSubmittedVersion bumps synchronously the
  // instant the submit POST resolves, well before the full-list refresh below
  // lands) — otherwise the just-answered card lingered in the grid for a full
  // round-trip. Mutating the entry in place (rather than removing it) keeps the
  // list length — and therefore this grid's skip/take math — exactly as it was;
  // only the `visible` filter's rendering changes.
  useEffect(() => {
    if (justSubmittedVersion === firstJustSubmitted.current) return;
    firstJustSubmitted.current = justSubmittedVersion;
    const { justSubmittedId: id, justSubmittedOptionId: optionId } =
      usePredictionsStore.getState();
    if (!id || !optionId) return;
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      if (idx === -1 || prev[idx].selectedOptionId != null) return prev;
      const next = [...prev];
      next[idx] = withSelectedOption(next[idx], optionId);
      return next;
    });
  }, [justSubmittedVersion]);

  useEffect(() => {
    if (submitVersion === firstSubmitVersion.current) return;
    firstSubmitVersion.current = submitVersion;
    void fetchPage({ reset: true, preserveCount: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitVersion]);

  if (loading && items.length === 0) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 240 }}>
            <SkeletonCard height={220} />
          </div>
        ))}
      </div>
    );
  }

  if (error != null && items.length === 0) {
    return (
      <WebCard>
        <EmptyState
          icon={<WifiOff sx={{ fontSize: 30 }} />}
          title="Couldn't load predictions"
          subtitle={error}
          action={
            <button type="button" className="btn-outlined" onClick={() => fetchPage({ reset: true })}>
              Retry
            </button>
          }
        />
      </WebCard>
    );
  }

  if (visible.length === 0) {
    const q = query.trim();
    return (
      <WebCard>
        <EmptyState
          icon={q.length > 0 ? <SearchOff sx={{ fontSize: 30 }} /> : <HourglassEmpty sx={{ fontSize: 30 }} />}
          title={q.length > 0 ? `No matches for "${q}"` : 'No open predictions'}
          subtitle={
            q.length > 0
              ? 'Try a different search term.'
              : 'New questions drop daily — check back soon.'
          }
        />
      </WebCard>
    );
  }

  return (
    <div>
      <PredictionGrid predictions={visible} />
      {hasMore && (
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn-outlined"
            disabled={loadingMore}
            onClick={() => fetchPage()}
          >
            {loadingMore ? (
              <>
                <span className="glow-btn__spinner" style={{ width: 16, height: 16 }} />
                Loading…
              </>
            ) : (
              <>
                <ExpandMoreRounded sx={{ fontSize: 18 }} />
                Load more predictions
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Cards in an auto-fill grid, shared by the Open and My Picks tabs.
 *
 * Sizes columns in CSS rather than from a measured container width: the final
 * row no longer leaves a ragged gap, and a narrow viewport gets one full-width
 * card instead of a squeezed one.
 */
function PredictionGrid({ predictions }: { predictions: Prediction[] }) {
  return (
    <CardGrid min={260}>
      {predictions.map((p, i) => (
        <Reveal key={p.id} delay={60 * (i % 9)} duration={350} y={0.08}>
          <ArenaCard prediction={p} onOpenDetail={showPredictionDetail} />
        </Reveal>
      ))}
    </CardGrid>
  );
}

/**
 * "My Picks" — the user's already-predicted items, from the shared active list
 * (loaded once for the whole portal session, independent of the Open grid's own
 * pagination). Unpaginated, mirroring the app's own "My picks" list.
 */
function MyPicksGrid({ items }: { items: Prediction[] }) {
  if (items.length === 0) {
    return (
      <WebCard>
        <EmptyState
          icon={<LockClockRounded sx={{ fontSize: 30 }} />}
          title="No picks yet"
          subtitle="Predictions you lock in will show up here."
        />
      </WebCard>
    );
  }
  return <PredictionGrid predictions={items} />;
}

// ---------------------------------------------------------------------------
// History tab
// ---------------------------------------------------------------------------

function HistoryList() {
  const history = usePredictionsStore((s) => s.history);
  const s = usePredictionsStore((st) => st.historySummary);

  const tiles = [
    <StatTile
      key="total"
      icon={<StackedBarChart />}
      label="Total"
      value={`${s.total}`}
      accent={WebTokens.violet}
    />,
    <StatTile
      key="won"
      icon={<CheckCircleOutline />}
      label="Won"
      value={`${s.won}`}
      accent={WebTokens.accent}
    />,
    <StatTile
      key="lost"
      icon={<CancelOutlined />}
      label="Lost"
      value={`${s.lost}`}
      accent="#FF6B6B"
    />,
    <StatTile
      key="rate"
      icon={<TrackChangesOutlined />}
      label="Win rate"
      value={`${Math.round(s.accuracy * 100)}%`}
      accent={WebTokens.gold}
    />,
  ];

  return (
    <div>
      {/* auto-fit: four across when there is room, two on a tablet, one on a
          phone — without measuring the container. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
          gap: 16,
        }}
      >
        {tiles}
      </div>

      <div style={{ height: 24 }} />

      {history.length === 0 ? (
        <WebCard>
          <EmptyState
            icon={<History sx={{ fontSize: 30 }} />}
            title="No results yet"
            subtitle="Resolved predictions land here."
          />
        </WebCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {history.map((p) => (
            <StatusRow key={p.id} prediction={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusRow({ prediction: p }: { prediction: Prediction }) {
  const picked = p.options
    .filter((o) => o.id === p.selectedOptionId)
    .map((o) => o.label)
    .join('');
  const lost = p.status === 'lost';

  const chip = (() => {
    switch (p.status) {
      case 'won':
        return {
          label: `Won +${p.reward}`,
          icon: <EmojiEventsRounded sx={{ fontSize: 13 }} />,
          color: WebTokens.accent,
        };
      case 'lost':
        return {
          label: 'Lost',
          icon: <CloseRounded sx={{ fontSize: 13 }} />,
          color: '#FF6B6B',
        };
      case 'awaitingResult':
        return {
          label: 'Awaiting result',
          icon: <HourglassTopRounded sx={{ fontSize: 13 }} />,
          color: WebTokens.gold,
        };
      default:
        return {
          label: `Closes ${Fmt.durationShort(p.closesInMs)}`,
          icon: <ScheduleRounded sx={{ fontSize: 13 }} />,
          color: WebTokens.gold,
        };
    }
  })();

  const iconTint = lost ? WebTokens.textMuted : WebTokens.violet;

  return (
    <WebCard hoverLift onClick={() => showPredictionDetail(p)} padding={16}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span
          style={{
            width: 42,
            height: 42,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: withAlpha(iconTint, 0.12),
            borderRadius: 12,
          }}
        >
          <Icon name={CategoryCatalog.iconNameFor(p.categoryKey)} size={19} color={iconTint} />
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ellipsis" style={{ fontWeight: 700, fontSize: 14 }}>
            {p.title}
          </div>
          {picked.length > 0 && (
            <span
              style={{
                marginTop: 5,
                display: 'inline-block',
                padding: '3px 8px',
                background: withAlpha(WebTokens.accent, 0.1),
                borderRadius: 999,
                color: WebTokens.accent,
                fontSize: 11.5,
                fontWeight: 700,
              }}
            >
              Your pick: {picked}
            </span>
          )}
        </div>

        <span
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '7px 11px',
            background: withAlpha(chip.color, 0.12),
            borderRadius: 999,
            border: `1px solid ${withAlpha(chip.color, 0.35)}`,
            color: chip.color,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {chip.icon}
          {chip.label}
        </span>
      </div>
    </WebCard>
  );
}
