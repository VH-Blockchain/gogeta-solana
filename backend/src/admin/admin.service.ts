import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  CoinTxnType,
  EntryStatus,
  NotificationType,
  PredictionStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EconomyService } from '../economy/economy.service';
import { GamificationService } from '../gamification/gamification.service';
import { PushService } from '../push/push.service';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { UpdatePredictionDto } from './dto/update-prediction.dto';
import { ResolveDto } from './dto/resolve.dto';
import { AdjustCoinsDto } from './dto/adjust-coins.dto';
import { SuspendDto } from './dto/suspend.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';
import { CreateCmsPageDto, UpdateCmsPageDto } from './dto/cms.dto';

/** Shape of one event from Polymarket's `events` endpoint (subset used). */
interface PolymarketEvent {
  id?: string;
  title: string;
  description?: string;
  image?: string;
  startDate?: string;
  endDate: string;
  tags?: { label: string }[];
  markets?: {
    id?: string; // Polymarket's own numeric market id — stored so the resolution check can look markets up directly by id (see PolymarketMarket below), not just by slug
    question: string;
    slug?: string; // per-market "market key" — unique per sub-market, unlike the event-level slug
    groupItemTitle?: string;
    description?: string;
    image?: string;
    startDate?: string;
    endDate?: string;
    outcomes?: string; // JSON-encoded string[]
    outcomePrices?: string; // JSON-encoded string[]
    volume24hr?: number; // Polymarket's own 24h trading volume (USD) — the real-world "how hot" signal, captured once at import time into Prediction.polymarketVolume24hr/trendingScore
  }[];
}

/** Shape of one row from Polymarket's `markets` endpoint (subset used for
 *  the resolution check — same data source as the import, queried again
 *  later by slug/id once a market is expected to have finished).
 *  `umaResolutionStatus` is UMA's own oracle-confirmed resolution state
 *  (e.g. "resolved") when present — a stronger signal than inferring
 *  settlement purely from price, used as an extra guard where available. */
interface PolymarketMarket {
  id?: string;
  slug: string;
  closed?: boolean;
  outcomes?: string; // JSON-encoded string[]
  outcomePrices?: string; // JSON-encoded string[]
  umaResolutionStatus?: string;
  volume24hr?: number; // used by backfillTrendingVolume — see its doc comment
}

type ResolutionOutcome = 'RESOLVED' | 'STILL_OPEN' | 'AMBIGUOUS' | 'NOT_FOUND' | 'NO_MARKET_KEY';

interface ResolutionCheckResult {
  outcome: ResolutionOutcome;
  detail: string;
  optionId?: string;
}

/** Fields that are always excluded when returning a User to an admin. */
const USER_SAFE_SELECT = {
  id: true,
  email: true,
  username: true,
  name: true,
  role: true,
  coins: true,
  level: true,
  xp: true,
  totalPredictions: true,
  correctPredictions: true,
  currentStreak: true,
  bestStreak: true,
  avatarSeed: true,
  bio: true,
  isVerified: true,
  isSuspended: true,
  lastActiveAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export interface ImportJob {
  status: 'running' | 'done';
  total: number;
  processed: number;
  created: number;
  failed: number;
  errors: { row: number; error: string }[];
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger('Admin');

  // In-memory CSV-import progress, keyed by job id. Fine for a single
  // persistent backend instance (see DEPLOYMENT.md); would need Redis if
  // this is ever scaled horizontally. Entries are pruned a few minutes
  // after completion so this can't grow unbounded.
  private readonly importJobs = new Map<string, ImportJob>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    private readonly gamification: GamificationService,
    private readonly push: PushService,
  ) {}

  // ───────────────────────── Predictions ─────────────────────────

  /** Short, source-tagged reference code for a newly-created prediction —
   *  e.g. PREDICT-CSV-A1B2C3D4. Polymarket imports don't use this: they
   *  build PREDICT-POLYMARKET-<market.id> directly so the code encodes the
   *  real Polymarket market id an admin can cross-check against. */
  private newReferenceCode(prefix: 'MANUAL' | 'CSV'): string {
    return `PREDICT-${prefix}-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }

  async createPrediction(adminId: string, dto: CreatePredictionDto) {
    // A future opensAt schedules the prediction: it goes live automatically
    // when the scheduler's minute tick reaches it.
    const opensAt = dto.opensAt ? new Date(dto.opensAt) : null;
    const scheduled = !!opensAt && opensAt.getTime() > Date.now();
    // Points and Reward are independent, admin-set values. When neither is
    // supplied (admin left "Use default settings" checked), the prediction
    // tracks Settings -> Points economy live via useDefaultEconomy — the
    // snapshot below is just a cache, not what's actually charged/paid.
    const rules = await this.economy.getRules();
    const useDefaultEconomy = dto.useDefaultEconomy ?? dto.entryFee === undefined;
    const points = dto.entryFee ?? rules.entryFee;
    const reward = this.economy.computeReward(dto.reward, rules.correctReward);
    return this.prisma.prediction.create({
      data: {
        categoryId: dto.categoryId,
        referenceCode: this.newReferenceCode('MANUAL'),
        title: dto.title,
        subtitle: dto.subtitle ?? '',
        info: dto.info ?? '',
        bannerImageUrl: dto.bannerImageUrl ?? null,
        entryFee: points,
        reward,
        useDefaultEconomy,
        closesAt: new Date(dto.closesAt),
        opensAt: opensAt ?? undefined,
        featured: dto.featured ?? false,
        status: scheduled ? PredictionStatus.SCHEDULED : (dto.status ?? PredictionStatus.OPEN),
        createdById: adminId,
        options: {
          create: dto.options.map((opt, index) => ({
            label: opt.label,
            odds: opt.odds,
            order: index,
          })),
        },
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });
  }

  // ── Categories ─────────────────────────────────────────────────────────

  listCategories() {
    return this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  }

/** Bulk-create OPEN predictions from parsed CSV rows. Each row:
   *  title, subtitle, info, categoryKey, entryFee, reward, closesAt (ISO),
   *  featured, option1..option4.
   *
   *  Runs as a background job instead of blocking the request: with 100+
   *  rows, even batched DB writes could take longer than the reverse
   *  proxy's gateway timeout and surface a 504 to the admin even though the
   *  import kept running to completion server-side. Returning a jobId
   *  immediately and polling status via [getImportJobStatus] avoids holding
   *  the HTTP connection open for the whole import, and lets the UI show
   *  live progress ("42/100 processed") instead of an opaque spinner. */
  startImportPredictions(rows: Record<string, string>[], adminId: string): { jobId: string; total: number } {
    const jobId = randomUUID();
    this.importJobs.set(jobId, {
      status: 'running',
      total: rows.length,
      processed: 0,
      created: 0,
      failed: 0,
      errors: [],
    });
    this.runImportPredictions(jobId, rows, adminId).catch((e) => {
      this.logger.error(`CSV import job ${jobId} crashed: ${e instanceof Error ? e.message : e}`);
      const job = this.importJobs.get(jobId);
      if (job) job.status = 'done';
    });
    return { jobId, total: rows.length };
  }

  /** Read-only progress snapshot for a job started by [startImportPredictions]. */
  getImportJobStatus(jobId: string): ImportJob {
    const job = this.importJobs.get(jobId);
    if (!job) throw new NotFoundException('Import job not found (it may have expired)');
    return job;
  }

  private async runImportPredictions(jobId: string, rows: Record<string, string>[], adminId: string) {
    const categories = await this.prisma.category.findMany({ select: { id: true, key: true } });
    const catByKey = new Map(categories.map((c) => [c.key.toLowerCase(), c.id]));
    const rules = await this.economy.getRules();

    const processRow = async (
      r: Record<string, string>,
      line: number,
    ): Promise<{ ok: true } | { ok: false; row: number; error: string }> => {
      try {
        const title = (r.title ?? '').trim();
        if (!title) throw new Error('title is required');
        const catKey = (r.categoryKey ?? r.category ?? '').trim().toLowerCase();
        const categoryId = catByKey.get(catKey);
        if (!categoryId) throw new Error(`unknown categoryKey "${catKey}"`);
        const opts = ['option1', 'option2', 'option3', 'option4']
          .map((k) => (r[k] ?? '').trim())
          .filter(Boolean);
        if (opts.length < 2) throw new Error('at least 2 options (option1, option2) required');
        const closesAt = new Date((r.closesAt ?? '').trim());
        if (isNaN(closesAt.getTime())) {
          throw new Error('invalid closesAt (use ISO date, e.g. 2026-07-15T18:00:00Z)');
        }
        const rawEntryFee = r.entryFee ? Number(r.entryFee) : undefined;
        const rawReward = r.reward ? Number(r.reward) : undefined;
        if (rawEntryFee !== undefined && isNaN(rawEntryFee)) throw new Error('entryFee must be a number');
        if (rawReward !== undefined && isNaN(rawReward)) throw new Error('reward must be a number');
        const points = rawEntryFee ?? rules.entryFee;
        const reward = this.economy.computeReward(rawReward, rules.correctReward);
        await this.prisma.prediction.create({
          data: {
            categoryId,
            referenceCode: this.newReferenceCode('CSV'),
            title,
            subtitle: (r.subtitle ?? '').trim(),
            info: (r.info ?? '').trim(),
            entryFee: points,
            reward,
            useDefaultEconomy: rawEntryFee === undefined,
            featured: /^(1|true|yes)$/i.test((r.featured ?? '').trim()),
            closesAt,
            status: PredictionStatus.OPEN,
            source: 'CSV',
            createdById: adminId,
            options: { create: opts.map((label, idx) => ({ label, odds: 2.0, order: idx })) },
          },
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, row: line, error: e instanceof Error ? e.message : 'failed' };
      }
    };

    // Rows used to be created one at a time (100 sequential DB round trips)
    // in the same request that responded to the client. Processing in small
    // concurrent batches — and updating job.processed after each one —
    // keeps each row's error isolated (same per-row try/catch) while
    // cutting wall-clock time and letting the UI show live progress.
    const BATCH_SIZE = 10;
    const job = this.importJobs.get(jobId);
    if (!job) return; // job was pruned (shouldn't happen mid-run, but guard anyway)
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map((r, j) => processRow(r, i + j + 2)));
      for (const result of results) {
        if (result.ok) job.created++;
        else job.errors.push({ row: result.row, error: result.error });
      }
      job.processed += batch.length;
    }
    job.status = 'done';
    job.failed = job.errors.length;
    // Prune a few minutes after completion so polling clients still have
    // time to read the final state, without leaking memory indefinitely.
    setTimeout(() => this.importJobs.delete(jobId), 5 * 60_000).unref();
  }

  /** Bulk-resolve predictions from parsed CSV rows. Each row:
   *  predictionId, winningOption (option label, or 1-based index). Reuses the
   *  standard resolve flow (payouts + lucky draw). */
  async importResolutions(rows: Record<string, string>[]) {
    const errors: { row: number; error: string }[] = [];
    let resolved = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const line = i + 2;
      try {
        const id = (r.predictionId ?? r.id ?? '').trim();
        if (!id) throw new Error('predictionId is required');
        // referenceCode (PREDICT-POLYMARKET-/PREDICT-CSV-/PREDICT-MANUAL-) is
        // a display/cross-check code, not a lookup key — this import only
        // matches the prediction's real internal id, so reject it early with
        // a clear message instead of a confusing generic "not found" below.
        if (/^PREDICT-/i.test(id)) {
          throw new Error(`"${id}" looks like a reference code, not a prediction id — use the ID shown in the Predictions table (or the "id" column from Export CSV)`);
        }
        const winning = (r.winningOption ?? r.winner ?? '').trim();
        if (!winning) throw new Error('winningOption is required');
        const prediction = await this.prisma.prediction.findUnique({
          where: { id },
          include: { options: { orderBy: { order: 'asc' } } },
        });
        if (!prediction) throw new Error(`prediction "${id}" not found`);
        let opt = prediction.options.find((o) => o.label.toLowerCase() === winning.toLowerCase());
        if (!opt && /^\d+$/.test(winning)) opt = prediction.options[Number(winning) - 1];
        if (!opt) throw new Error(`winningOption "${winning}" not found among options`);
        await this.resolvePrediction(id, { correctOptionId: opt.id });
        resolved++;
      } catch (e) {
        errors.push({ row: line, error: e instanceof Error ? e.message : 'failed' });
      }
    }
    return { resolved, failed: errors.length, errors };
  }

  /** Case + trailing-"s" insensitive category-key normalization — mirrors
   *  the app's own normalizeCategoryKey exactly, so "Sports"/"sport"/"Sport"
   *  all resolve to the same category on import the same way they already
   *  do for display client-side. Only ever used as an internal lookup key,
   *  never shown to a user. */
  private normalizeCategoryKey(key: string): string {
    const lower = key.trim().toLowerCase();
    return lower.length > 1 && lower.endsWith('s') ? lower.slice(0, -1) : lower;
  }

  /** Pull currently-open (not yet ended) events from Polymarket and create one
   *  prediction PER MARKET (not per event) — an event grouping 8 sub-markets
   *  (e.g. "how many X in 2026?") produces 8 independent predictions, one per
   *  question, each with its own Yes/No options. Every one of an event's tags
   *  is checked (normalized, then via a curated synonym map) against existing
   *  categories — see resolveCategoryId below — auto-creating a brand-new
   *  category from a genuinely novel topical tag rather than defaulting to
   *  "Other"; Other (created once, on first use) is the last resort, only
   *  when an event has no usable tag at all. All sub-markets of an event
   *  share that same category. The individual market's JSON is kept in
   *  `rawData` and `source` is set to AUTO_ENTRY so these are distinguishable
   *  from panel-created ('MANUAL') and CSV-imported ('CSV') predictions.
   *
   *  Always fetches active, non-ended events (active=true&closed=false) —
   *  there's no search term or status toggle from the caller. The existing
   *  "already imported" dedup below (matched by title) is what keeps a
   *  repeat click — or a scheduled run — from recreating predictions that
   *  came in on a prior run; it only ever adds ones that are genuinely new.
   *
   *  `adminId` is omitted for the scheduled cron run below (createdById is
   *  an optional column) since there's no acting admin for those.
   *
   *  Every run — manual or cron, success or failure — writes one row to
   *  `PolymarketImportLog` (url, trigger, status, created/skipped counts,
   *  error if any) so both sources of imports are auditable in one place. */
  async importPolymarketPredictions(
    adminId: string | undefined,
    opts: { limit?: number },
    trigger: 'MANUAL' | 'CRON' = 'MANUAL',
  ) {
    // `limit` is a market/prediction count, not an event count — one event
    // can bundle several sub-markets, so requesting `limit` events from
    // Polymarket directly can yield well over `limit` predictions. Over-fetch
    // events instead, then stop processing markets once `limit` is hit.
    const marketLimit = opts.limit ?? 50;
    const perFetchLimit = String(Math.min(marketLimit * 5, 500));
    const baseParams = { limit: perFetchLimit, active: 'true', closed: 'false' };
    // A newest-first-only fetch means the ONLY events we ever pull are ones
    // that just started (order=startDate) — which, by definition, haven't
    // existed long enough to have any real trading volume yet. That left
    // every Polymarket-imported prediction's trendingScore/polymarketVolume24hr
    // sitting at 0/null forever, since Polymarket's API doesn't even include
    // the volume24hr field on a brand-new market's JSON. Fetching a SECOND,
    // volume-sorted list alongside the usual newest one — and merging with
    // the volume-sorted events first — means already-established,
    // real-volume events actually get a chance to be imported (and so
    // actually carry a meaningful trendingScore), not just fresh zero-volume
    // ones. Deduped by event id (a volume-heavy event might also be recent
    // enough to appear in both lists).
    const newestUrl = `https://gamma-api.polymarket.com/events?${new URLSearchParams({ ...baseParams, order: 'startDate', ascending: 'false' })}`;
    const trendingUrl = `https://gamma-api.polymarket.com/events?${new URLSearchParams({ ...baseParams, order: 'volume24hr', ascending: 'false' })}`;
    this.logger.log(`Polymarket request: ${newestUrl}`);
    this.logger.log(`Polymarket request: ${trendingUrl}`);

    try {
      const [newestRes, trendingRes] = await Promise.all([fetch(newestUrl), fetch(trendingUrl)]);
      for (const [res, url] of [[newestRes, newestUrl], [trendingRes, trendingUrl]] as const) {
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new BadRequestException(`Polymarket fetch failed (${url}): ${res.status} ${res.statusText} — ${detail.slice(0, 300)}`);
        }
      }
      const newestEvents = (await newestRes.json()) as PolymarketEvent[];
      const trendingEvents = (await trendingRes.json()) as PolymarketEvent[];

      const categories = await this.prisma.category.findMany({ select: { id: true, key: true, label: true, sortOrder: true } });
      // Normalized (case + trailing-"s") so "Sports"/"sport"/"Sport" all
      // match the same category — mirrors the app's own normalizeCategoryKey,
      // used here so the same tag wording that already resolves correctly
      // client-side doesn't silently miss on import and dump into Other.
      const catByName = new Map(categories.map((c) => [this.normalizeCategoryKey(c.label), c.id]));
      for (const c of categories) {
        const normKey = this.normalizeCategoryKey(c.key);
        if (!catByName.has(normKey)) catByName.set(normKey, c.id);
      }
      let nextSortOrder = categories.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;
      let otherCategoryId = catByName.get('other');

      // Every event carries SEVERAL tags, not one, and Polymarket doesn't
      // guarantee the topical one comes first — a market's first tag is
      // often an administrative/curation tag like "Recurring" or "Hide From
      // New" (skipped below) with the real topic (e.g. "Politics") further
      // down the array. Checking only tags[0] (the previous behavior) is
      // why the overwhelming majority of predictions were landing in
      // Other. Known Polymarket-internal tags that aren't a real topic:
      const NON_TOPICAL_TAGS = new Set(
        ['recurring', 'hide from new', 'weekly', 'monthly', 'daily', 'games', 'tweet markets', 'earn 4%', 'hit price'].map((t) =>
          this.normalizeCategoryKey(t),
        ),
      );
      // Common real-world Polymarket tag wordings that don't literally match
      // any of our category labels/keys even after normalization — mapped
      // to the closest existing category. Extend this as new recurring tag
      // wordings show up; anything NOT covered here (and not matching a
      // category directly) gets a brand-new category auto-created for it
      // instead of falling into Other, so genuinely new topics still get a
      // real home.
      const TAG_SYNONYMS: Record<string, string> = Object.fromEntries(
        (
          [
            ['geopolitics', 'world'],
            ['iran', 'world'],
            ['israel', 'world'],
            ['middle east', 'world'],
            ['russia', 'world'],
            ['united states', 'world'],
            ['trump', 'world'],
            ['u.s. x iran', 'world'],
            ['iran ceasefire', 'world'],
            ['iran regime', 'world'],
            ['strait of hormuz', 'world'],
            ['khamenei', 'world'],
            ['peace deal', 'world'],
            ['israel x iran', 'world'],
            ['multi strikes', 'world'],
            ['elections', 'politics'],
            ['global elections', 'politics'],
            ['world elections', 'politics'],
            ['us election', 'politics'],
            ['israel election', 'politics'],
            ['main election', 'politics'],
            ['crypto prices', 'crypto'],
            ['bitcoin', 'crypto'],
            ['ethereum', 'crypto'],
            ['fed', 'economy'],
            ['fed rates', 'economy'],
            ['fomc', 'economy'],
            ['jerome powell', 'economy'],
            ['cpi release', 'economy'],
            ['economic policy', 'economy'],
            ['oil', 'economy'],
            ['league of legends', 'esports'],
            ['counter strike 2', 'esports'],
            ['basketball', 'sports'],
            ['soccer', 'sports'],
            ['tennis', 'sports'],
            ['nba', 'sports'],
            ['tech', 'science'],
            ['ai', 'science'],
            ['big tech', 'business'],
            ['serie a', 'sports'],
            ['warsh', 'finance'],
            ['fdv', 'crypto'],
            ['daily temperature', 'weather'],
            ['highest temperature', 'weather'],
          ] as [string, string][]
        ).map(([tag, catKey]) => [this.normalizeCategoryKey(tag), this.normalizeCategoryKey(catKey)]),
      );

      /** Resolves an event's category, checking every tag (in order) against
       *  existing categories directly, then via the synonym map, before
       *  auto-creating a brand-new category from the first real topical tag.
       *  Some Polymarket events genuinely ship with an empty/all-non-topical
       *  tags array (confirmed live — e.g. single-company earnings-metric
       *  markets) — for those, falls back to running `fallbackText` (the
       *  event title) through the same CATEGORY_KEYWORD_RULES the Other
       *  backfill uses, auto-creating that category too if it's missing on
       *  this environment. Other is the true last resort, only when neither
       *  tags nor the title give any usable signal. New categories get a
       *  generic icon (admin can refine it later from the Categories tab);
       *  this never invents an icon name the app doesn't already recognize. */
      const resolveCategoryId = async (tags: { label: string }[] | undefined, fallbackText: string): Promise<string> => {
        const candidates = (tags ?? []).map((t) => t.label).filter((label) => !NON_TOPICAL_TAGS.has(this.normalizeCategoryKey(label)));
        for (const label of candidates) {
          const norm = this.normalizeCategoryKey(label);
          const direct = catByName.get(norm) ?? catByName.get(TAG_SYNONYMS[norm] ?? '');
          if (direct) return direct;
        }
        if (candidates.length > 0) {
          const label = candidates[0];
          const key = this.normalizeCategoryKey(label).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'other';
          const created = await this.prisma.category.create({
            data: { key, label, icon: 'label', accent: 'predictions', sortOrder: nextSortOrder++ },
          });
          catByName.set(this.normalizeCategoryKey(label), created.id);
          catByName.set(this.normalizeCategoryKey(key), created.id);
          return created.id;
        }
        const rule = this.CATEGORY_KEYWORD_RULES.find((r) => r.pattern.test(fallbackText));
        if (rule) {
          const norm = this.normalizeCategoryKey(rule.categoryKey);
          const existing = catByName.get(norm);
          if (existing) return existing;
          const defaults = this.CATEGORY_DEFAULTS[rule.categoryKey] ?? { label: rule.categoryKey, icon: 'label' };
          const created = await this.prisma.category.create({
            data: { key: rule.categoryKey, label: defaults.label, icon: defaults.icon, accent: 'predictions', sortOrder: nextSortOrder++ },
          });
          catByName.set(norm, created.id);
          return created.id;
        }
        if (!otherCategoryId) {
          const otherCategory = await this.prisma.category.create({
            data: { key: 'other', label: 'Other', icon: 'label', accent: 'predictions', sortOrder: nextSortOrder++ },
          });
          otherCategoryId = otherCategory.id;
          catByName.set('other', otherCategoryId);
        }
        return otherCategoryId;
      };

      const rules = await this.economy.getRules();
      const created: string[] = [];
      const skipped: { event: string; reason: string }[] = [];
      const seenEventIds = new Set<string>();

      // Two independent passes, each with its OWN budget — newest-first is
      // the primary driver (this cron's actual job: pick up genuinely new
      // content) and must run its full marketLimit regardless of what the
      // trending pass finds. A single shared budget across both lists (the
      // previous approach, events merged trending-first) let a handful of
      // high-volume, rarely-rotating events — already-settled esports
      // sub-markets, long-running election/rate-decision markets, almost
      // always already imported or no-longer-enterable — silently consume
      // the ENTIRE run's budget before the newest list was ever reached.
      // Production sat at "0 created" for hours because of exactly this.
      // The trending pass now only tops up whatever's uniquely there,
      // strictly after newest has had its full run, never at its expense.
      const processEvents = async (events: PolymarketEvent[], budget: number) => {
        let processed = 0;
        eventLoop: for (const event of events) {
          const key = event.id ?? event.title;
          if (seenEventIds.has(key)) continue;
          seenEventIds.add(key);
          if (processed >= budget) break;

          const categoryId = await resolveCategoryId(event.tags, event.title ?? '');

          const markets = event.markets ?? [];
          if (markets.length === 0) {
            skipped.push({ event: event.title ?? event.id ?? 'unknown', reason: 'event has no markets' });
            continue;
          }

          for (const market of markets) {
            if (processed >= budget) break eventLoop;
            processed++;
            try {
              const options = this.marketYesNoOptions(market);
              if (options.length < 2) throw new Error('fewer than 2 usable options (already settled)');

              const closesAt = new Date(market.endDate ?? event.endDate);
              if (isNaN(closesAt.getTime())) throw new Error('invalid endDate');

              // Dedup by Polymarket's own market id (via referenceCode's
              // unique index) first whenever it's available — an indexed
              // point lookup, O(log n) regardless of table size, unlike the
              // title+categoryId+source check (no supporting index on
              // title, so it scans every existing row in that category on
              // every single candidate market, every 30-minute cron tick,
              // forever). Still falls back to the title-based check
              // whenever the id lookup finds nothing, though — not just
              // when market.id is missing. Predictions imported before the
              // referenceCode column existed have referenceCode=NULL, so
              // an id-only check would never find them and would happily
              // recreate a market that's already in the system under the
              // old schema; the slower fallback is what actually catches
              // those.
              const dup = market.id
                ? await this.prisma.prediction.findUnique({
                    where: { referenceCode: `PREDICT-POLYMARKET-${market.id}` },
                    select: { id: true },
                  })
                : null;
              const dupByTitle = dup
                ? null
                : await this.prisma.prediction.findFirst({
                    where: { title: market.question, categoryId, source: 'AUTO_ENTRY' },
                    select: { id: true },
                  });
              if (dup || dupByTitle) throw new Error('already imported');

              const startDateRaw = market.startDate ?? event.startDate;
              const opensAt = startDateRaw ? new Date(startDateRaw) : null;
              const scheduled = !!opensAt && opensAt.getTime() > Date.now();

              // Keyed by Polymarket's own market id, not a random short id,
              // so an admin can paste this straight into Polymarket to
              // confirm the real-world outcome against what this panel
              // shows.
              const referenceCode = market.id
                ? `PREDICT-POLYMARKET-${market.id}`
                : `PREDICT-POLYMARKET-${market.slug ?? randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
              // Real-world "how hot is this" signal, snapshotted once at
              // import (not refreshed afterward) — see the schema comment
              // on trendingScore for why this doesn't just reuse
              // `participants`.
              const volume24hr = typeof market.volume24hr === 'number' ? market.volume24hr : undefined;
              const prediction = await this.prisma.prediction.create({
                data: {
                  categoryId,
                  referenceCode,
                  title: market.question,
                  info: market.description ?? event.description ?? '',
                  // Deliberately not carrying over market.image/event.image
                  // — Polymarket-imported predictions should never get a
                  // banner image set automatically.
                  bannerImageUrl: null,
                  entryFee: rules.entryFee,
                  reward: this.economy.computeReward(undefined, rules.correctReward),
                  // Polymarket imports always track Settings -> Points
                  // economy live — an admin changing Default points/reward
                  // instantly applies to every imported market, not just
                  // ones created after the change.
                  useDefaultEconomy: true,
                  polymarketVolume24hr: volume24hr ?? null,
                  trendingScore: volume24hr ?? 0,
                  closesAt,
                  opensAt: opensAt ?? undefined,
                  status: scheduled ? PredictionStatus.SCHEDULED : PredictionStatus.OPEN,
                  source: 'AUTO_ENTRY',
                  rawData: JSON.stringify(market),
                  createdById: adminId,
                  options: {
                    create: options.map((o, index) => ({
                      label: o.label,
                      odds: o.odds,
                      order: index,
                      marketKey: market.slug,
                      polymarketMarketId: market.id,
                      question: market.question,
                    })),
                  },
                },
              });
              created.push(prediction.id);
            } catch (e) {
              skipped.push({ event: market.question ?? event.title ?? 'unknown', reason: e instanceof Error ? e.message : 'failed' });
            }
          }
        }
        return processed;
      };

      await processEvents(newestEvents, marketLimit);
      await processEvents(trendingEvents, marketLimit);

      await this.prisma.polymarketImportLog.create({
        data: { url: `${newestUrl} | ${trendingUrl}`, trigger, status: 'SUCCESS', created: created.length, skipped: skipped.length },
      });
      return { created: created.length, skipped: skipped.length, predictionIds: created, skippedDetails: skipped };
    } catch (e) {
      await this.prisma.polymarketImportLog.create({
        data: {
          url: `${newestUrl} | ${trendingUrl}`,
          trigger,
          status: 'FAILED',
          error: e instanceof Error ? e.message : 'failed',
        },
      });
      throw e;
    }
  }

  /** Every 30 minutes — same import the admin's "Run" button triggers, just
   *  unattended. No acting admin, so `createdById` is left unset (nullable
   *  column, no FK). The dedup check inside importPolymarketPredictions means
   *  this only ever adds markets that weren't already imported. */
  @Cron('*/30 * * * *')
  async autoImportPolymarket() {
    try {
      const res = await this.importPolymarketPredictions(undefined, {}, 'CRON');
      if (res.created > 0 || res.skipped > 0) {
        this.logger.log(`Polymarket auto-import: ${res.created} created, ${res.skipped} skipped`);
      }
    } catch (e) {
      this.logger.error(`Polymarket auto-import failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  listPolymarketImportLogs(opts: { skip?: string; take?: string } = {}) {
    const take = Math.min(Math.max(Number(opts.take) || 25, 1), 100);
    const skip = Math.max(Number(opts.skip) || 0, 0);
    return this.prisma.$transaction([
      this.prisma.polymarketImportLog.count(),
      this.prisma.polymarketImportLog.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
    ]).then(([total, items]) => ({ items, total, skip, take }));
  }

  /** Every 15/45 past the hour, offset from the import cron — checks every
   *  LOCKED, Polymarket-sourced prediction against Polymarket's own market
   *  data and, once a market has actually closed with an unambiguous winner,
   *  resolves it: runs the exact same full settlement as the manual
   *  "Resolve & pay out" button (via resolvePrediction() — see
   *  applyResolutionCheck()'s doc comment). Entries get settled WON/LOST,
   *  coins/streaks/badges awarded, notifications sent, the lucky draw run —
   *  fully hands-off, no admin click required. (An earlier version paused at
   *  a status-only `AUTO_RESOLVED` flip awaiting manual confirmation; that
   *  was removed on request in favor of immediate payout.)
   *
   *  ALSO sweeps any prediction still sitting in `AUTO_RESOLVED` — a leftover
   *  bucket from before the above change, orphaned because this cron used to
   *  only query LOCKED and never went back for them. Those already have
   *  Polymarket's winner in `correctOptionId` from whenever they were first
   *  detected, so they're settled directly via resolvePrediction() with no
   *  re-fetch/re-evaluate needed — the same one-line payout call a LOCKED
   *  candidate gets once its own check resolves.
   *
   *  A market only qualifies when Polymarket's own `closed` flag is true AND
   *  exactly one outcome price is exactly 1 — a closed market with no such
   *  price (voided, 50-50, still-being-adjudicated) is left alone for manual
   *  resolution instead of guessing. Every run writes one PolymarketResolutionLog
   *  row (checked/resolved/skipped + why), mirroring how imports are audited. */
  @Cron('15,45 * * * *')
  async autoResolvePolymarketPredictions() {
    const candidates = await this.prisma.prediction.findMany({
      where: {
        source: 'AUTO_ENTRY',
        status: { in: [PredictionStatus.LOCKED, PredictionStatus.AUTO_RESOLVED] },
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    if (candidates.length === 0) return;

    const alreadyDetected = candidates.filter((p) => p.status === PredictionStatus.AUTO_RESOLVED);
    const locked = candidates.filter((p) => p.status === PredictionStatus.LOCKED);

    let resolved = 0;
    const details: { title: string; reason: string }[] = [];

    for (const prediction of alreadyDetected) {
      if (!prediction.correctOptionId) {
        details.push({ title: prediction.title, reason: 'AUTO_RESOLVED with no correctOptionId set — left for manual resolution' });
        continue;
      }
      try {
        await this.resolvePrediction(prediction.id, { correctOptionId: prediction.correctOptionId });
        resolved++;
      } catch (e) {
        // Same reasoning as the LOCKED loop below — one failure must not
        // stop the rest of the sweep; resolvePrediction() is fully
        // transactional, so this prediction is simply retried next tick.
        details.push({ title: prediction.title, reason: `payout failed: ${e instanceof Error ? e.message : 'unknown error'}` });
      }
    }

    const marketKeys = [
      ...new Set(locked.map((p) => p.options[0]?.marketKey).filter((k): k is string => !!k)),
    ];

    let marketsByKey: Map<string, PolymarketMarket> = new Map();
    if (marketKeys.length > 0) {
      try {
        marketsByKey = await this.fetchPolymarketMarketsBySlug(marketKeys);
      } catch (e) {
        const error = e instanceof Error ? e.message : 'failed';
        this.logger.error(`Polymarket auto-resolve check failed: ${error}`);
        await this.prisma.polymarketResolutionLog.create({
          data: { checked: candidates.length, resolved, skipped: details.length, details: details.length ? details : undefined, error },
        });
        return;
      }
    }

    for (const prediction of locked) {
      const marketKey = prediction.options[0]?.marketKey ?? undefined;
      const market = marketKey ? marketsByKey.get(marketKey) : undefined;
      const result = this.evaluateResolution(prediction, marketKey, market);

      try {
        await this.applyResolutionCheck(prediction, marketKey, result, 'CRON');
      } catch (e) {
        // A RESOLVED outcome now runs a real payout transaction, which can
        // fail (economy rules missing, DB hiccup, etc.) — one failure must
        // not stop the rest of the batch from being checked. resolvePrediction()
        // is fully transactional, so a throw here leaves this prediction
        // untouched (still LOCKED); it's retried on the next tick.
        details.push({ title: prediction.title, reason: `payout failed: ${e instanceof Error ? e.message : 'unknown error'}` });
        continue;
      }

      if (result.outcome === 'RESOLVED') {
        resolved++;
      } else if (result.outcome !== 'STILL_OPEN') {
        // STILL_OPEN is the expected common case and not worth logging —
        // everything else (ambiguous, not found, missing key) is.
        details.push({ title: prediction.title, reason: result.detail });
      }
    }

    await this.prisma.polymarketResolutionLog.create({
      data: {
        checked: candidates.length,
        resolved,
        skipped: details.length,
        details: details.length ? details : undefined,
      },
    });
    if (resolved > 0 || details.length > 0) {
      this.logger.log(
        `Polymarket auto-resolve: ${resolved} resolved & paid out, ${details.length} skipped ` +
          `(of ${locked.length} LOCKED checked + ${alreadyDetected.length} AUTO_RESOLVED swept)`,
      );
    }
  }

  listPolymarketResolutionLogs(opts: { skip?: string; take?: string } = {}) {
    const take = Math.min(Math.max(Number(opts.take) || 25, 1), 100);
    const skip = Math.max(Number(opts.skip) || 0, 0);
    return this.prisma.$transaction([
      this.prisma.polymarketResolutionLog.count(),
      this.prisma.polymarketResolutionLog.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
    ]).then(([total, items]) => ({ items, total, skip, take }));
  }

  /** Admin-triggered, on-demand equivalent of the cron above for exactly
   *  one prediction — lets an admin check "has Polymarket settled this yet?"
   *  right now instead of waiting up to 30 minutes for the next tick. A
   *  RESOLVED outcome pays out immediately (see applyResolutionCheck()) —
   *  same as the cron, no separate confirm step. Unlike the cron, every
   *  manual check is logged to PolymarketResolutionCheck regardless of
   *  outcome — an admin clicking this button is inherently low-volume, so
   *  there's no growth concern, and seeing exactly why a check didn't
   *  resolve (still open? ambiguous? no market key?) is the whole point of
   *  a manual "check now" button. */
  async checkPolymarketResolution(id: string) {
    const prediction = await this.prisma.prediction.findUnique({
      where: { id },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    if (!prediction) throw new NotFoundException('Prediction not found');
    if (prediction.source !== 'AUTO_ENTRY') {
      throw new BadRequestException('Only Polymarket-imported predictions can be checked against Polymarket');
    }
    if (prediction.status !== PredictionStatus.LOCKED) {
      throw new BadRequestException(`Only LOCKED predictions can be checked — this one is ${prediction.status}`);
    }

    const marketKey = prediction.options[0]?.marketKey ?? undefined;
    const polymarketMarketId = prediction.options[0]?.polymarketMarketId ?? undefined;

    // Prefer a direct id lookup (GET /markets/:id) when we have one — it
    // returns the market regardless of its open/closed state, unlike the
    // slug-based list endpoint (see fetchPolymarketMarketsBySlug's doc
    // comment for why that matters). Only predictions imported after this
    // field was added have an id stored; older ones fall back to slug.
    const market = polymarketMarketId
      ? await this.fetchPolymarketMarketById(polymarketMarketId)
      : marketKey
        ? (await this.fetchPolymarketMarketsBySlug([marketKey])).get(marketKey)
        : undefined;

    const result = this.evaluateResolution(prediction, marketKey, market);
    await this.applyResolutionCheck(prediction, marketKey, result, 'MANUAL');

    return {
      outcome: result.outcome,
      detail: result.detail,
      prediction: result.outcome === 'RESOLVED' ? await this.getPrediction(id) : undefined,
    };
  }

  /** Resolution-check history for one prediction — every manual check, plus
   *  any cron check that actually resolved it. Answers "why hasn't this
   *  resolved" / "when did it resolve" without digging through cron-run
   *  aggregate logs. */
  listResolutionChecks(predictionId: string, opts: { skip?: string; take?: string } = {}) {
    const take = Math.min(Math.max(Number(opts.take) || 25, 1), 100);
    const skip = Math.max(Number(opts.skip) || 0, 0);
    return this.prisma.$transaction([
      this.prisma.polymarketResolutionCheck.count({ where: { predictionId } }),
      this.prisma.polymarketResolutionCheck.findMany({
        where: { predictionId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]).then(([total, items]) => ({ items, total, skip, take }));
  }

  /** Given a prediction and the Polymarket market matching its marketKey
   *  (if any), decides what — if anything — should happen. Pure decision
   *  logic, no I/O: shared by the cron (batch) and the manual single-check
   *  endpoint so both apply the exact same rule. A market only counts as
   *  resolved when Polymarket's own `closed` flag is true AND exactly one
   *  outcome price is exactly 1 — anything else (still open, voided,
   *  50/50, ambiguous) is left for a human rather than guessed at. */
  private evaluateResolution(
    prediction: { options: { id: string; label: string }[] },
    marketKey: string | undefined,
    market: PolymarketMarket | undefined,
  ): ResolutionCheckResult {
    if (!marketKey) {
      return { outcome: 'NO_MARKET_KEY', detail: 'No Polymarket market key stored on this prediction' };
    }
    if (!market) {
      return { outcome: 'NOT_FOUND', detail: `Market "${marketKey}" not found on Polymarket (delisted or archived)` };
    }
    if (!market.closed) {
      return { outcome: 'STILL_OPEN', detail: 'Market is still open on Polymarket' };
    }
    // Extra guard when Polymarket exposes it: UMA's own oracle-confirmed
    // resolution status. Only enforced when present (older/non-UMA markets
    // may not have it) — if it's there and says the resolution isn't final
    // (e.g. still disputed/pending), that overrides `closed` alone.
    if (market.umaResolutionStatus && market.umaResolutionStatus !== 'resolved') {
      return {
        outcome: 'AMBIGUOUS',
        detail: `Closed on Polymarket, but UMA resolution status is "${market.umaResolutionStatus}" (not finalized)`,
      };
    }

    const labels = this.parseJsonArray(market.outcomes);
    const prices = this.parseJsonArray(market.outcomePrices).map(Number);
    const winningLabels = labels.filter((_, i) => prices[i] === 1);
    if (winningLabels.length !== 1) {
      return {
        outcome: 'AMBIGUOUS',
        detail: `Ambiguous outcome (outcomes=${market.outcomes ?? 'n/a'} prices=${market.outcomePrices ?? 'n/a'})`,
      };
    }

    const winner = prediction.options.find((o) => o.label === winningLabels[0]);
    if (!winner) {
      return { outcome: 'AMBIGUOUS', detail: `Winning label "${winningLabels[0]}" matches no local option` };
    }

    return { outcome: 'RESOLVED', detail: `Winning option: ${winner.label}`, optionId: winner.id };
  }

  /** A RESOLVED outcome now runs the exact same full settlement as the
   *  manual "Resolve & pay out" button — resolvePrediction() itself: every
   *  entry settled WON/LOST, coins/streaks/badges awarded, notifications
   *  sent, the lucky draw run, status set to RESOLVED. This used to stop at
   *  a lightweight status-only `AUTO_RESOLVED` flip awaiting a human
   *  confirm click; that pause was removed on request, so detecting a
   *  result now pays out immediately with no separate confirm step, from
   *  both the cron and the manual "Check result"/Resolve click. No
   *  `adminId` — same convention as autoImportPolymarket's own unattended
   *  runs (AuditLog records `actorId: null` for these).
   *
   *  Records the check per the logging rule described on
   *  PolymarketResolutionCheck/the cron doc comment above. */
  private async applyResolutionCheck(
    prediction: { id: string; title: string },
    marketKey: string | undefined,
    result: ResolutionCheckResult,
    trigger: 'CRON' | 'MANUAL',
  ) {
    if (result.outcome === 'RESOLVED' && result.optionId) {
      await this.resolvePrediction(prediction.id, { correctOptionId: result.optionId });
    }
    if (trigger === 'MANUAL' || result.outcome === 'RESOLVED') {
      await this.prisma.polymarketResolutionCheck.create({
        data: {
          predictionId: prediction.id,
          marketKey: marketKey ?? null,
          trigger,
          outcome: result.outcome,
          detectedOptionId: result.optionId ?? null,
          detail: result.detail,
        },
      });
    }
  }

  /** Batches slugs into as few Polymarket requests as possible — the
   *  `slug` query param can be repeated to OR-match several markets in one
   *  call (verified directly against the live API; comma-separating them in
   *  a single `slug=` value does NOT work, it returns zero results). Chunked
   *  to keep each request URL a sane length rather than assuming an
   *  unlimited batch size.
   *
   *  IMPORTANT: `/markets` defaults to `closed=false` when the `closed`
   *  param is omitted — verified directly against the live API: a
   *  known-closed, non-restricted market's slug returned zero results with
   *  no `closed` param (and with `closed=false` explicitly), but one result
   *  with `closed=true`. Since this method exists specifically to find
   *  markets that *have* closed, omitting that param would make it
   *  structurally incapable of ever finding one — every real resolution
   *  would look identical to "not found on Polymarket". Both `closed=true`
   *  and `closed=false` are queried per chunk and merged, so the caller can
   *  still correctly tell "still open" apart from "genuinely not found".
   *
   *  Returns a slug→market map covering whatever subset of the requested
   *  slugs Polymarket still has a record of, in either state. */
  private async fetchPolymarketMarketsBySlug(slugs: string[]): Promise<Map<string, PolymarketMarket>> {
    const CHUNK_SIZE = 50;
    const result = new Map<string, PolymarketMarket>();
    for (let i = 0; i < slugs.length; i += CHUNK_SIZE) {
      const chunk = slugs.slice(i, i + CHUNK_SIZE);
      for (const closed of ['true', 'false']) {
        const params = new URLSearchParams({ closed });
        for (const slug of chunk) params.append('slug', slug);
        const url = `https://gamma-api.polymarket.com/markets?${params}`;
        const res = await fetch(url);
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(`Polymarket fetch failed: ${res.status} ${res.statusText} — ${detail.slice(0, 300)}`);
        }
        const markets = (await res.json()) as PolymarketMarket[];
        for (const m of markets) if (m.slug) result.set(m.slug, m);
      }
    }
    return result;
  }

  /** Direct lookup by Polymarket's own numeric market id (GET /markets/:id)
   *  — only usable for predictions imported after `polymarketMarketId` started
   *  being captured. Unlike the slug-based list endpoint, this isn't subject
   *  to the closed/active filtering described above: it returns the market
   *  regardless of its state in one request, with no chunking/OR-matching
   *  needed since it's already a single lookup. Returns undefined on 404. */
  private async fetchPolymarketMarketById(id: string): Promise<PolymarketMarket | undefined> {
    const res = await fetch(`https://gamma-api.polymarket.com/markets/${id}`);
    if (res.status === 404) return undefined;
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Polymarket fetch failed: ${res.status} ${res.statusText} — ${detail.slice(0, 300)}`);
    }
    return (await res.json()) as PolymarketMarket;
  }

  /** One-time backfill for predictions imported before trendingScore existed
   *  (or before a market had accumulated any real volume yet) — NOT a cron,
   *  on-demand only, call repeatedly (each call processes one bounded batch)
   *  until `remaining` hits 0, then stop. Scoped to OPEN/LOCKED AUTO_ENTRY
   *  predictions only — the ones people actually browse/discover right now;
   *  RESOLVED/CANCELLED ones don't need a trending signal since nobody can
   *  act on them anymore.
   *
   *  `polymarketVolume24hr: null` in the where clause is the "not yet
   *  checked" marker — every candidate this processes gets a non-null value
   *  written (the real volume24hr if Polymarket had one, otherwise the 0
   *  sentinel), so nothing is ever re-checked twice and the batches
   *  naturally converge to `remaining: 0`.
   *
   *  Matched back to its own real market by marketKey (slug) — the same
   *  precise, unique-per-market identifier the resolve-check cron already
   *  relies on — and cross-checked against polymarketMarketId whenever a
   *  candidate has one, so a slug collision/staleness can't silently apply
   *  one market's volume to a different prediction; a mismatch is skipped
   *  (left null, retried next batch) rather than trusted. */
  async backfillTrendingVolume(take = 200) {
    const where: Prisma.PredictionWhereInput = {
      source: 'AUTO_ENTRY',
      status: { in: [PredictionStatus.OPEN, PredictionStatus.LOCKED] },
      polymarketVolume24hr: null,
    };
    const [remainingBefore, candidates] = await this.prisma.$transaction([
      this.prisma.prediction.count({ where }),
      this.prisma.prediction.findMany({
        where,
        include: { options: { orderBy: { order: 'asc' }, take: 1 } },
        take,
      }),
    ]);
    if (candidates.length === 0) return { processed: 0, updated: 0, skippedMismatch: 0, remaining: 0 };

    const slugs = [...new Set(candidates.map((p) => p.options[0]?.marketKey).filter((k): k is string => !!k))];
    const marketsByKey = slugs.length > 0 ? await this.fetchPolymarketMarketsBySlug(slugs) : new Map<string, PolymarketMarket>();

    let updated = 0;
    let skippedMismatch = 0;
    for (const p of candidates) {
      const option = p.options[0];
      const slug = option?.marketKey ?? undefined;
      const market = slug ? marketsByKey.get(slug) : undefined;
      // Cross-check: if this prediction already has a polymarketMarketId
      // captured (newer rows do), the fetched market's own id must agree —
      // otherwise skip rather than write a possibly-mismatched volume.
      const idsAgree = !option?.polymarketMarketId || !market?.id || market.id === option.polymarketMarketId;
      if (market && !idsAgree) {
        skippedMismatch++;
        continue;
      }
      const volume24hr = typeof market?.volume24hr === 'number' ? market.volume24hr : 0;
      await this.prisma.prediction.update({
        where: { id: p.id },
        data: { polymarketVolume24hr: volume24hr, trendingScore: volume24hr },
      });
      updated++;
    }
    return {
      processed: candidates.length,
      updated,
      skippedMismatch,
      remaining: Math.max(0, remainingBefore - (candidates.length - skippedMismatch)),
    };
  }

  /** Fallback label/icon for a keyword rule's category when it doesn't
   *  exist yet on this environment — e.g. "music" only ever got created via
   *  the live import's auto-create path, so an environment that hasn't
   *  imported a real Music-tagged event yet has no Music category at all,
   *  and a rule matching "album"/"song" would otherwise silently no-op
   *  forever. Anything not listed here falls back to a plain 'label' icon
   *  (admin can refine it after the fact from the Categories tab). */
  private readonly CATEGORY_DEFAULTS: Record<string, { label: string; icon: string }> = {
    music: { label: 'Music', icon: 'music_note' },
  };

  /** Title-keyword rules for backfillOtherCategories — old predictions
   *  imported before the multi-tag/synonym import fix (see
   *  importPolymarketPredictions) have no preserved tag data (rawData only
   *  ever stored the market, not the event, and tags live on the event), so
   *  there's nothing to re-run the real matcher against. Confirmed live
   *  against Polymarket's own API that this really is the only viable
   *  option for several stragglers — some markets (e.g. per-company
   *  earnings-metric predictions) genuinely carry zero tags on
   *  Polymarket's side, so even a live lookup wouldn't help. This is a
   *  coarser, title-text heuristic instead: good enough to move the
   *  overwhelming majority of the ~11k Other backlog into a real category,
   *  not meant to be perfect. Checked in order, first match wins — more
   *  specific patterns (named esports titles, named sports leagues/events)
   *  come before broader ones so, e.g., an esports "World Cup" doesn't get
   *  misfiled as regular Sports. */
  private readonly CATEGORY_KEYWORD_RULES: { pattern: RegExp; categoryKey: string }[] = [
    { pattern: /\b(bitcoin|btc|ethereum|eth|solana|dogecoin|hyperliquid|xrp|bnb|litecoin|cardano|polkadot|avalanche|chainlink|stablecoin|\bdefi\b|\bnft\b|crypto|up or down|\bfdv\b)/i, categoryKey: 'crypto' },
    { pattern: /\b(league of legends|\blol\b:|counter-?strike|\bcs2\b|valorant|\bdota\b|overwatch|honor of kings|\bpubg\b|call of duty|rainbow six|esports|blast bounty|world cup \d{4} \(esports\))/i, categoryKey: 'esports' },
    { pattern: /\b(\bnba\b|\bnfl\b|\bmlb\b|\bnhl\b|\bfifa\b|\bitf\b|premier league|world cup|olympics?|tennis|cricket|boxing|\bufc\b|\bmma\b|formula ?1|\bf1\b|grand prix|ballon d'?or|super bowl|ryder cup|wimbledon|tour de france|\bipl\b|la liga|serie a|champions league|the ashes|test series|odi series|basketball|football|soccer|rugby|golf|nascar|draft\b|play for the|calder trophy|\btrophy\b)/i, categoryKey: 'sports' },
    // "elections?" (not bare "election" with a trailing boundary) so
    // "general elections" — the plural form Polymarket almost always
    // actually uses — matches; the earlier version silently never matched
    // any plural political term at all. Bare "ministers?" (not just "prime
    // minister") catches "Minister of Education" etc — the leading \b
    // already keeps it from matching inside "administer" etc.
    { pattern: /\b(presidents?|ministers?|elections?|midterms?|parliaments?|congress|senate|referendums?|impeach|coalitions?|governors?|mayors?|house of representatives|monsoon session|ballot measures?)/i, categoryKey: 'politics' },
    // No trailing \b after the country names — the earlier version
    // required a word boundary immediately after e.g. "iran", so common
    // adjectival forms like "Iranian" never matched at all.
    { pattern: /\b(ceasefires?|invades?|invasion|\bwars?\b|treaty|treaties|sanctions?|\bnato\b|united nations|iran|russia|ukraine|israel|gaza|middle east|geopolit)/i, categoryKey: 'world' },
    { pattern: /\b(\bfed\b|federal reserve|interest rates?|\bfomc\b|inflation|\bcpi\b|\bgdp\b|\bstocks?\b|nasdaq|s&p ?500|dow jones|market cap|earnings|\bnyse\b|bond yields?|treasury yields?|\bipo\b|\bwarsh\b|\([A-Z]{2,5}\)|revenue|shipments?)/i, categoryKey: 'finance' },
    { pattern: /\b(jobs? reports?|unemployment|nonfarm payrolls?|retail sales|consumer confidence|\bpmi\b|recession)/i, categoryKey: 'economy' },
    { pattern: /\b(mergers?|acquisitions?|\bceo\b|layoffs?|bankrupt|files? ipo)/i, categoryKey: 'business' },
    { pattern: /\b(box office|\bmovies?\b|\bfilms?\b|domestically|opening weekend)/i, categoryKey: 'movies' },
    { pattern: /\b(billboard|grammy|\balbums?\b|\bsongs?\b)/i, categoryKey: 'music' },
    { pattern: /\b(\bemmys?\b|\boscars?\b|\bvma\b|booker prize|national book award|tv shows?|television)/i, categoryKey: 'entertainment' },
    { pattern: /\b(\bnasa\b|spacex|nobel prize|quantum|artificial intelligence|\bai\b|space launch|\brockets?\b)/i, categoryKey: 'science' },
    { pattern: /\b(temperatures?|rainfall|hurricanes?|eclipse|air quality|\baqi\b|climate|snowfall)/i, categoryKey: 'weather' },
    { pattern: /\b(fashion|gallery|museum|cultural)/i, categoryKey: 'culture' },
    // Recurring "will [person] post/tweet about X on X (the platform)"
    // template — social-media/pop-culture commentary, closest existing fit.
    { pattern: /\bpost\b.*\bon x\b|\btweets?\b/i, categoryKey: 'culture' },
  ];

  /** One-time backfill for predictions stuck in "Other" from before the
   *  multi-tag/synonym import fix — not a cron, on-demand only, call
   *  repeatedly passing back `nextCursor` until `remaining` is 0 (or
   *  `processed` is 0). Cursor-based (by id, not a shrinking-count
   *  estimate) so it terminates correctly even though most predictions
   *  that don't match any keyword rule are deliberately left in Other —
   *  a shrinking-count approach would re-fetch the same never-matching
   *  rows forever. Genuinely unclassifiable-by-title predictions staying
   *  in Other is the correct, honest outcome here, not a bug. */
  async backfillOtherCategories(opts: { take?: number; cursor?: string } = {}) {
    const take = opts.take ?? 200;
    const otherCategory = await this.prisma.category.findUnique({ where: { key: 'other' }, select: { id: true } });
    if (!otherCategory) return { processed: 0, updated: 0, remaining: 0, nextCursor: null };

    const categories = await this.prisma.category.findMany({ select: { id: true, key: true, sortOrder: true } });
    const catIdByKey = new Map(categories.map((c) => [c.key, c.id]));
    let nextSortOrder = categories.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;

    const candidates = await this.prisma.prediction.findMany({
      where: {
        categoryId: otherCategory.id,
        ...(opts.cursor ? { id: { gt: opts.cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      select: { id: true, title: true, subtitle: true },
      take,
    });
    if (candidates.length === 0) {
      const remaining = await this.prisma.prediction.count({ where: { categoryId: otherCategory.id } });
      return { processed: 0, updated: 0, remaining, nextCursor: null };
    }

    let updated = 0;
    for (const p of candidates) {
      const text = `${p.title} ${p.subtitle ?? ''}`;
      const rule = this.CATEGORY_KEYWORD_RULES.find((r) => r.pattern.test(text));
      if (!rule) continue;
      // A rule can reference a category that doesn't exist yet on this
      // environment (found live: the "music" rule matched fine, but no
      // Music category had ever been created on production — it only got
      // auto-created in local testing via the live import path — so the
      // match silently did nothing every single run). Auto-create it here
      // too, same as the live import does for a genuinely novel tag.
      let targetCategoryId = catIdByKey.get(rule.categoryKey);
      if (!targetCategoryId) {
        const defaults = this.CATEGORY_DEFAULTS[rule.categoryKey] ?? { label: rule.categoryKey, icon: 'label' };
        const created = await this.prisma.category.create({
          data: { key: rule.categoryKey, label: defaults.label, icon: defaults.icon, accent: 'predictions', sortOrder: nextSortOrder++ },
        });
        targetCategoryId = created.id;
        catIdByKey.set(rule.categoryKey, targetCategoryId);
      }
      if (targetCategoryId !== otherCategory.id) {
        await this.prisma.prediction.update({ where: { id: p.id }, data: { categoryId: targetCategoryId } });
        updated++;
      }
    }
    const nextCursor = candidates[candidates.length - 1].id;
    const remaining = await this.prisma.prediction.count({
      where: { categoryId: otherCategory.id, id: { gt: nextCursor } },
    });
    return { processed: candidates.length, updated, remaining, nextCursor };
  }

  /** Extracts the Yes/No option pair straight off one market's own
   *  outcomes/outcomePrices. A price of exactly 0 or 1 means that outcome is
   *  already settled (no real uncertainty left) — those are dropped rather
   *  than imported as live odds. */
  private marketYesNoOptions(market: {
    outcomes?: string;
    outcomePrices?: string;
  }): { label: string; odds: number }[] {
    const labels = this.parseJsonArray(market.outcomes);
    const prices = this.parseJsonArray(market.outcomePrices);
    return labels
      .map((label, i) => {
        const odds = Number(prices[i]);
        return label && !isNaN(odds) && !this.isSettledPrice(odds) ? { label, odds } : null;
      })
      .filter((o): o is { label: string; odds: number } => o !== null);
  }

  private isSettledPrice(price: number): boolean {
    return price === 0 || price === 1;
  }

  private parseJsonArray(raw?: string): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async createCategory(dto: {
    key: string;
    label: string;
    icon: string;
    imageUrl?: string;
    iconImageUrl?: string;
    accent?: string;
    sortOrder?: number;
    active?: boolean;
  }) {
    const exists = await this.prisma.category.findUnique({ where: { key: dto.key } });
    if (exists) throw new BadRequestException('A category with that key already exists.');
    const max = await this.prisma.category.aggregate({ _max: { sortOrder: true } });
    return this.prisma.category.create({
      data: {
        key: dto.key.trim(),
        label: dto.label.trim(),
        icon: dto.icon.trim(),
        imageUrl: dto.imageUrl ?? null,
        iconImageUrl: dto.iconImageUrl ?? null,
        accent: dto.accent ?? 'predictions',
        sortOrder: dto.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
        active: dto.active ?? true,
      },
    });
  }

  async updateCategory(
    id: string,
    dto: {
      key?: string;
      label?: string;
      icon?: string;
      imageUrl?: string;
      iconImageUrl?: string;
      accent?: string;
      sortOrder?: number;
      active?: boolean;
    },
  ) {
    const current = await this.prisma.category.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Category not found');
    if (dto.key && dto.key !== current.key) {
      const other = await this.prisma.category.findUnique({ where: { key: dto.key } });
      if (other) throw new BadRequestException('That key is already in use.');
    }
    return this.prisma.category.update({ where: { id }, data: { ...dto } });
  }

  async deleteCategory(id: string) {
    const used = await this.prisma.prediction.count({ where: { categoryId: id } });
    if (used > 0) {
      throw new BadRequestException(
        `Can't delete — ${used} prediction(s) use this category. Hide it instead.`,
      );
    }
    await this.prisma.category.delete({ where: { id } });
    return { deleted: true };
  }

  async reorderCategories(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, i) =>
        this.prisma.category.update({ where: { id }, data: { sortOrder: i } }),
      ),
    );
    return this.listCategories();
  }

  async listPredictions(
    opts: {
      search?: string;
      status?: PredictionStatus;
      categoryKey?: string;
      closingHours?: string;
      source?: string;
      skip?: string;
      take?: string;
    } = {},
  ) {
    const where: Prisma.PredictionWhereInput = {};
    if (opts.status) where.status = opts.status;
    if (opts.categoryKey) where.category = { key: opts.categoryKey };
    if (opts.source) where.source = opts.source;
    const closingHours = Number(opts.closingHours);
    if (closingHours > 0) {
      where.closesAt = { lte: new Date(Date.now() + closingHours * 3_600_000) };
    }
    const q = opts.search?.trim();
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { subtitle: { contains: q, mode: 'insensitive' } },
      ];
    }
    const take = Math.min(Math.max(Number(opts.take) || 25, 1), 100);
    const skip = Math.max(Number(opts.skip) || 0, 0);

    // Breakdown for the dashboard stat tiles + status-distribution chart —
    // scoped to the same search/category/closingHours filters as the list,
    // but NOT the status filter itself (so picking "OPEN" in the dropdown
    // doesn't zero out every other status's count). Counted across the full
    // matching set via one groupBy, not just the current page — unlike the
    // client-side `items.filter(...)` this replaces. sourceCounts mirrors the
    // same idea for the source filter (also excludes `source` itself).
    const { status: _status, source: _source, ...statsWhere } = where;
    const [total, items, statusGroups, sourceGroups, featuredCount] = await this.prisma.$transaction([
      this.prisma.prediction.count({ where }),
      this.prisma.prediction.findMany({
        where,
        include: {
          options: { orderBy: { order: 'asc' } },
          _count: { select: { entries: true } },
        },
        // Trending-first (real-world Polymarket volume24hr for AUTO_ENTRY,
        // live participant count for CSV/Manual — see the trendingScore
        // schema comment), createdAt as the tiebreaker. Was plain
        // createdAt-desc; that also drove the app's sort=newest ("mirrors
        // the admin Predictions tab exactly") — sort=newest itself is
        // unchanged, only this default changed.
        orderBy: [{ trendingScore: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.prediction.groupBy({ by: ['status'], where: statsWhere, orderBy: { status: 'asc' }, _count: true }),
      this.prisma.prediction.groupBy({ by: ['source'], where: statsWhere, orderBy: { source: 'asc' }, _count: true }),
      this.prisma.prediction.count({ where: { ...statsWhere, featured: true } }),
    ]);
    const statusCounts = Object.fromEntries(statusGroups.map((g) => [g.status, g._count])) as Partial<
      Record<PredictionStatus, number>
    >;
    const sourceCounts = Object.fromEntries(sourceGroups.map((g) => [g.source, g._count])) as Record<string, number>;
    return {
      items,
      total,
      skip,
      take,
      openCount: statusCounts.OPEN ?? 0,
      resolvedCount: statusCounts.RESOLVED ?? 0,
      featuredCount,
      statusCounts,
      sourceCounts,
    };
  }

  async getPrediction(id: string) {
    const prediction = await this.prisma.prediction.findUnique({
      where: { id },
      include: {
        options: { orderBy: { order: 'asc' } },
        _count: { select: { entries: true } },
      },
    });
    if (!prediction) throw new NotFoundException('Prediction not found');
    return prediction;
  }

  /** Every user who predicted on this one prediction — who picked what,
   *  whether they won/lost (or still pending), reward earned. Backs the
   *  admin panel's prediction detail dialog ("who has predicted" list) —
   *  admin-only, not exposed anywhere in the app/web portal. Newest entry
   *  first, same ordering convention as getUserEntries. */
  async getPredictionEntries(id: string, opts: { skip?: string; take?: string } = {}) {
    await this.ensurePrediction(id);
    const take = Math.min(Math.max(Number(opts.take) || 50, 1), 200);
    const skip = Math.max(Number(opts.skip) || 0, 0);
    const [total, entries] = await this.prisma.$transaction([
      this.prisma.userPrediction.count({ where: { predictionId: id } }),
      this.prisma.userPrediction.findMany({
        where: { predictionId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: { select: { id: true, name: true, email: true, username: true } },
          option: { select: { label: true } },
        },
      }),
    ]);
    return {
      total,
      skip,
      take,
      items: entries.map((e) => ({
        id: e.id,
        userId: e.user.id,
        userName: e.user.name,
        userEmail: e.user.email,
        username: e.user.username,
        pick: e.option?.label ?? '',
        entryFee: e.entryFee,
        status: e.status,
        rewardEarned: e.rewardEarned,
        createdAt: e.createdAt,
        resolvedAt: e.resolvedAt,
      })),
    };
  }

  async updatePrediction(id: string, dto: UpdatePredictionDto) {
    const existing = await this.prisma.prediction.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) throw new NotFoundException('Prediction not found');
    // Points and Reward are always independent, admin-set values now (no
    // reward-mode concept) - dto.reward is left untouched here when not
    // explicitly sent, so editing Points alone never silently changes it.
    // Sending entryFee/reward implies a fixed override (useDefaultEconomy
    // false) unless the admin explicitly says otherwise; sending
    // useDefaultEconomy: true with no entryFee/reward reverts the
    // prediction to tracking Settings -> Points economy live again.
    const useDefaultEconomy =
      dto.useDefaultEconomy ?? (dto.entryFee !== undefined || dto.reward !== undefined ? false : undefined);
    const newClosesAt = dto.closesAt ? new Date(dto.closesAt) : undefined;
    // Pushing a LOCKED prediction's deadline back out into the future
    // re-opens it for entries — otherwise it would stay LOCKED (and
    // un-enterable in the app) even though its window is open again,
    // until an admin separately flipped status by hand. The per-minute
    // scheduler cron (lockExpiredPredictions) handles the opposite
    // direction on its own, so this only needs to cover re-opening.
    const reactivate =
      existing.status === PredictionStatus.LOCKED &&
      newClosesAt !== undefined &&
      newClosesAt.getTime() > Date.now();
    return this.prisma.prediction.update({
      where: { id },
      data: {
        title: dto.title,
        subtitle: dto.subtitle,
        info: dto.info,
        bannerImageUrl: dto.bannerImageUrl,
        featured: dto.featured,
        closesAt: newClosesAt,
        opensAt: dto.opensAt ? new Date(dto.opensAt) : undefined,
        entryFee: dto.entryFee,
        reward: dto.reward,
        useDefaultEconomy,
        status: reactivate ? PredictionStatus.OPEN : undefined,
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });
  }

  async setStatus(id: string, status: PredictionStatus) {
    await this.ensurePrediction(id);
    return this.prisma.prediction.update({
      where: { id },
      data: { status },
      include: { options: { orderBy: { order: 'asc' } } },
    });
  }

  /** Creates a fresh DRAFT copy of a prediction (options reset, no entries). */
  async duplicatePrediction(id: string, adminId: string) {
    const src = await this.prisma.prediction.findUnique({
      where: { id },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    if (!src) throw new NotFoundException('Prediction not found');
    const duration = Math.max(
      src.closesAt.getTime() - src.opensAt.getTime(),
      60 * 60 * 1000,
    );
    const copy = await this.prisma.prediction.create({
      data: {
        categoryId: src.categoryId,
        referenceCode: this.newReferenceCode('MANUAL'),
        title: src.title,
        subtitle: src.subtitle,
        info: src.info,
        bannerImageUrl: src.bannerImageUrl,
        entryFee: src.entryFee,
        reward: src.reward,
        useDefaultEconomy: src.useDefaultEconomy,
        featured: false,
        status: PredictionStatus.DRAFT,
        closesAt: new Date(Date.now() + duration),
        source: 'MANUAL',
        createdById: adminId,
        options: {
          create: src.options.map((o) => ({ label: o.label, odds: o.odds, order: o.order })),
        },
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    await this.prisma.auditLog.create({
      data: { actorId: adminId, action: 'duplicate-prediction', target: id, meta: { copyId: copy.id } },
    });
    return copy;
  }

  /** Sends an in-app SYSTEM notification to every non-suspended user. */
  async broadcast(adminId: string, dto: { title: string; body: string }) {
    const notify = await this.notificationsEnabled();
    // notifyPush is the user's own "Push notifications" master switch
    // (Settings screen) — respected here same as every other alert type,
    // on top of the admin-global notificationsEnabled() switch above.
    const users = await this.prisma.user.findMany({
      where: { isSuspended: false, role: 'USER', notifyPush: true },
      select: { id: true },
    });
    if (notify.SYSTEM) {
      await this.prisma.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          type: NotificationType.SYSTEM,
          title: dto.title,
          body: dto.body,
        })),
      });
      this.push
        .sendToUsers(users.map((u) => u.id), {
          title: dto.title,
          body: dto.body,
          data: { type: 'SYSTEM' },
        })
        .catch((err) => this.logger.error(`broadcast push failed: ${String(err)}`));
    }
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'broadcast',
        meta: { title: dto.title, sent: notify.SYSTEM ? users.length : 0, suppressed: !notify.SYSTEM },
      },
    });
    return { sent: notify.SYSTEM ? users.length : 0 };
  }

  /** Recent admin activity from the audit log, with actor emails resolved. */
  async auditLog(opts: { take?: string } = {}) {
    const take = Math.min(Math.max(Number(opts.take) || 20, 1), 100);
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean))] as string[];
    const actors = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, email: true, name: true },
    });
    const actorById = new Map(actors.map((a) => [a.id, a]));
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      target: r.target,
      meta: r.meta,
      createdAt: r.createdAt,
      actor: r.actorId ? (actorById.get(r.actorId)?.email ?? r.actorId) : null,
    }));
  }

  /** Applies one action to many predictions; per-id errors, like CSV import. */
  async bulkPredictionAction(
    ids: string[],
    action: 'open' | 'close' | 'cancel' | 'feature' | 'unfeature',
  ) {
    const statusByAction: Partial<Record<typeof action, PredictionStatus>> = {
      open: PredictionStatus.OPEN,
      close: PredictionStatus.LOCKED,
      cancel: PredictionStatus.CANCELLED,
    };
    const errors: { id: string; error: string }[] = [];
    let updated = 0;
    for (const id of ids) {
      try {
        if (action === 'feature' || action === 'unfeature') {
          await this.ensurePrediction(id);
          await this.prisma.prediction.update({
            where: { id },
            data: { featured: action === 'feature' },
          });
        } else {
          await this.setStatus(id, statusByAction[action]!);
        }
        updated++;
      } catch (e) {
        errors.push({ id, error: e instanceof Error ? e.message : 'failed' });
      }
    }
    return { updated, errors };
  }

  /**
   * Which automated notification types are currently allowed to fire,
   * keyed by NotificationType. Admin-configurable via `notifications.enabled.<TYPE>`
   * settings (Settings → Notifications); a type is enabled unless explicitly
   * set to `false` — no seed rows required.
   */
  private async notificationsEnabled(): Promise<Record<NotificationType, boolean>> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { startsWith: 'notifications.enabled.' } },
    });
    const overrides = new Map(
      rows.map((r) => [r.key.replace('notifications.enabled.', ''), r.value === true]),
    );
    const result = {} as Record<NotificationType, boolean>;
    for (const type of Object.values(NotificationType)) {
      result[type] = overrides.has(type) ? (overrides.get(type) as boolean) : true;
    }
    return result;
  }

  private async ensurePrediction(id: string) {
    const exists = await this.prisma.prediction.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Prediction not found');
  }

  /**
   * Core resolution flow (SOW §5.3): settle every entry, award rewards /
   * badges, update streaks & levels — all atomically inside a single
   * transaction. The Lucky Draw itself is a separate once-daily pool
   * (SchedulerService.runLuckyDraw, SOW §5.3 "Daily Reward Pool") that draws
   * from all of a day's correct predictors platform-wide; it no longer runs
   * per-prediction here (that let one user win the bonus repeatedly in a
   * single day whenever multiple predictions resolved).
   */
  async resolvePrediction(id: string, dto: ResolveDto, adminId?: string) {
    const prediction = await this.prisma.prediction.findUnique({
      where: { id },
      include: { options: true, entries: true },
    });
    if (!prediction) throw new NotFoundException('Prediction not found');
    if (
      prediction.status === PredictionStatus.RESOLVED ||
      prediction.status === PredictionStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Prediction is already resolved or cancelled',
      );
    }
    const correctOptionId = dto.correctOptionId;
    if (!prediction.options.some((o) => o.id === correctOptionId)) {
      throw new BadRequestException(
        'correctOptionId is not an option of this prediction',
      );
    }

    // Some AUTO_RESOLVED predictions carried over from an earlier version of
    // the auto-resolve flow already have their entries settled (reward coins
    // already awarded) from whenever they were first processed, but never
    // got their status finalized to RESOLVED. Running the normal flow again
    // on one of these would re-settle and re-award reward coins a SECOND
    // time for anyone who already won. Detect this up front (any entry past
    // its initial LOCKED state means settlement already ran) and only
    // finalize the status — never re-run payout logic for a prediction
    // that's already actually been settled once.
    const alreadySettled = prediction.entries.some(
      (e) => e.status !== EntryStatus.LOCKED,
    );
    if (alreadySettled) {
      await this.prisma.prediction.update({
        where: { id },
        data: {
          correctOptionId,
          status: PredictionStatus.RESOLVED,
          resolvedAt: prediction.resolvedAt ?? new Date(),
        },
      });
      return { won: 0, lost: 0 };
    }

    const rules = await this.economy.getRules();
    // Resolved live so a "use default" prediction pays out whatever
    // "Default reward" currently is, not whatever it was at creation time.
    const effectiveReward = this.economy.resolveReward(prediction, rules);
    const notify = await this.notificationsEnabled();
    // Per-user alert preferences (Settings screen toggles) — notifyPush is
    // the master switch, notifyResults is the sub-toggle for this flow's own
    // notifications (lucky-win alerts are sent separately by the daily draw
    // job). Fetched once up front rather than per-entry, to avoid an N+1.
    const prefs = new Map(
      (
        await this.prisma.user.findMany({
          where: { id: { in: prediction.entries.map((e) => e.userId) } },
          select: { id: true, notifyPush: true, notifyResults: true },
        })
      ).map((u) => [u.id, u]),
    );
    const wantsResult = (userId: string) => {
      const p = prefs.get(userId);
      return p?.notifyPush === true && p?.notifyResults === true;
    };
    // Collected during the transaction, sent after it commits — pushes are
    // network I/O and must not hold the DB transaction open.
    const pushTargets: { userId: string; title: string; body: string; data?: Record<string, string> }[] = [];

    const result = await this.prisma.$transaction(
      async (tx) => {
        const now = new Date();
        let wonCount = 0;
        let lostCount = 0;

        for (const entry of prediction.entries) {
          if (entry.optionId === correctOptionId) {
            wonCount++;

            await tx.userPrediction.update({
              where: { id: entry.id },
              data: {
                status: EntryStatus.WON,
                rewardEarned: effectiveReward,
                resolvedAt: now,
              },
            });

            await this.economy.applyTxn(
              tx,
              entry.userId,
              CoinTxnType.CORRECT_REWARD,
              effectiveReward,
              {
                referenceId: prediction.id,
                description: `Correct: ${prediction.title}`,
              },
            );

            const u = await tx.user.findUnique({
              where: { id: entry.userId },
              select: {
                correctPredictions: true,
                totalPredictions: true,
                currentStreak: true,
                bestStreak: true,
                level: true,
              },
            });
            if (!u) continue;

            const newCorrect = u.correctPredictions + 1;
            const newStreak = u.currentStreak + 1;
            const newBest = Math.max(u.bestStreak, newStreak);
            const newLevel = this.gamification.levelFromStats({
              totalPredictions: u.totalPredictions,
              correctPredictions: newCorrect,
              level: u.level,
            });

            await tx.user.update({
              where: { id: entry.userId },
              data: {
                correctPredictions: newCorrect,
                currentStreak: newStreak,
                bestStreak: newBest,
                level: newLevel,
                xp: { increment: effectiveReward },
              },
            });

            if (newStreak >= 10) {
              await this.gamification.awardBadge(
                tx,
                entry.userId,
                'WINNING_STREAK',
              );
            }
            if (
              u.totalPredictions >= 5 &&
              newCorrect / u.totalPredictions >= 0.8
            ) {
              await this.gamification.awardBadge(
                tx,
                entry.userId,
                'ACCURACY_MASTER',
              );
            }

            if (notify.RESULT && wantsResult(entry.userId)) {
              const title = 'Prediction correct! 🎉';
              const body = `You earned ${effectiveReward} coins on "${prediction.title}".`;
              await tx.notification.create({
                data: { userId: entry.userId, type: NotificationType.RESULT, title, body },
              });
              pushTargets.push({
                userId: entry.userId,
                title,
                body,
                data: { type: 'RESULT', predictionId: prediction.id },
              });
            }
          } else {
            lostCount++;

            await tx.userPrediction.update({
              where: { id: entry.id },
              data: { status: EntryStatus.LOST, resolvedAt: now },
            });

            await tx.user.update({
              where: { id: entry.userId },
              data: { currentStreak: 0 },
            });

            if (notify.RESULT && wantsResult(entry.userId)) {
              const title = 'Result published';
              const body = `Your prediction on "${prediction.title}" didn't hit this time.`;
              await tx.notification.create({
                data: { userId: entry.userId, type: NotificationType.RESULT, title, body },
              });
              pushTargets.push({
                userId: entry.userId,
                title,
                body,
                data: { type: 'RESULT', predictionId: prediction.id },
              });
            }
          }
        }

        await tx.prediction.update({
          where: { id: prediction.id },
          data: {
            correctOptionId,
            status: PredictionStatus.RESOLVED,
            resolvedAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: adminId ?? null,
            action: 'resolve-prediction',
            target: prediction.id,
            meta: {
              title: prediction.title,
              correctOptionId: dto.correctOptionId,
              won: wonCount,
              lost: lostCount,
            },
          },
        });

        return { won: wonCount, lost: lostCount };
      },
      { timeout: 30000 },
    );

    // Fire pushes now that the DB transaction has committed — best-effort,
    // does not block or fail the resolve response if push delivery fails.
    for (const t of pushTargets) {
      this.push
        .sendToUser(t.userId, t)
        .catch((err) => this.logger.error(`push to ${t.userId} failed: ${String(err)}`));
    }

    return result;
  }

  // ───────────────────────────── Users ─────────────────────────────

  async listUsers(dto: ListUsersDto) {
    const take = Math.min(dto.take ?? 50, 100);
    const skip = dto.skip ?? 0;
    const where: Prisma.UserWhereInput = dto.search
      ? {
          OR: [
            { name: { contains: dto.search, mode: 'insensitive' } },
            { email: { contains: dto.search, mode: 'insensitive' } },
            { username: { contains: dto.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SAFE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, skip, take };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_SAFE_SELECT,
        _count: { select: { entries: true, badges: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { _count, ...rest } = user;
    return {
      ...rest,
      entryCount: _count.entries,
      badgeCount: _count.badges,
    };
  }

  async adjustCoins(adminId: string, userId: string, dto: AdjustCoinsDto) {
    await this.ensureUser(userId);
    const description = dto.reason ?? 'Admin adjustment';

    const balance = await this.prisma.$transaction(async (tx) => {
      const newBalance = await this.economy.applyTxn(
        tx,
        userId,
        CoinTxnType.ADMIN_ADJUST,
        dto.amount,
        { description },
      );
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'adjust-coins',
          target: userId,
          meta: { amount: dto.amount, reason: dto.reason ?? null },
        },
      });
      return newBalance;
    });

    return { userId, balance };
  }

  /** A user's coin ledger, newest first. */
  async getUserLedger(userId: string, opts: { take?: string } = {}) {
    await this.ensureUser(userId);
    const take = Math.min(Math.max(Number(opts.take) || 50, 1), 200);
    return this.prisma.coinTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true, type: true, amount: true, description: true, createdAt: true },
    });
  }

  /** A user's prediction entries with outcome, newest first. */
  async getUserEntries(userId: string, opts: { take?: string } = {}) {
    await this.ensureUser(userId);
    const take = Math.min(Math.max(Number(opts.take) || 50, 1), 200);
    const entries = await this.prisma.userPrediction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        prediction: { select: { title: true, status: true } },
        option: { select: { label: true } },
      },
    });
    return entries.map((e) => ({
      id: e.id,
      prediction: e.prediction.title,
      predictionStatus: e.prediction.status,
      pick: e.option?.label ?? '',
      status: e.status,
      rewardEarned: e.rewardEarned,
      createdAt: e.createdAt,
    }));
  }

  /** Changes a user's role (USER / VIEWER / ADMIN) with an audit entry. */
  async setUserRole(adminId: string, userId: string, role: Role) {
    await this.ensureUser(userId);
    if (adminId === userId) throw new BadRequestException("You can't change your own role.");
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true },
    });
    await this.prisma.auditLog.create({
      data: { actorId: adminId, action: 'set-role', target: userId, meta: { role } },
    });
    return user;
  }

  async suspendUser(adminId: string, userId: string, dto: SuspendDto) {
    await this.ensureUser(userId);
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { isSuspended: dto.suspended },
        select: { id: true, isSuspended: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'suspend-user',
          target: userId,
          meta: { suspended: dto.suspended },
        },
      });
      return updated;
    });
    return user;
  }

  /** Manually marks an account verified, bypassing the OTP/email flow
   *  entirely — for accounts that can't complete normal email verification
   *  (e.g. a seed/demo account, or a support case where delivery failed). */
  async forceVerifyUser(adminId: string, userId: string) {
    await this.ensureUser(userId);
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { isVerified: true },
        select: { id: true, email: true, isVerified: true },
      });
      await tx.auditLog.create({
        data: { actorId: adminId, action: 'force-verify-user', target: userId },
      });
      return updated;
    });
    return user;
  }

  private async ensureUser(id: string) {
    const exists = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('User not found');
  }

  // ─────────────────────────── Analytics ───────────────────────────

  async analytics() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      dailyPredictions,
      predictionsResolved,
      coinsAgg,
      accuracyUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { lastActiveAt: { gte: weekAgo } } }),
      this.prisma.userPrediction.count({
        where: { createdAt: { gte: todayStart } },
      }),
      this.prisma.prediction.count({
        where: { status: PredictionStatus.RESOLVED },
      }),
      this.prisma.coinTransaction.aggregate({
        _sum: { amount: true },
        where: { amount: { gt: 0 } },
      }),
      this.prisma.user.findMany({
        where: { totalPredictions: { gt: 0 } },
        select: { totalPredictions: true, correctPredictions: true },
      }),
    ]);

    const avgAccuracy = accuracyUsers.length
      ? accuracyUsers.reduce(
          (sum, u) => sum + u.correctPredictions / u.totalPredictions,
          0,
        ) / accuracyUsers.length
      : 0;

    return {
      totalUsers,
      activeUsers,
      dailyPredictions,
      predictionsResolved,
      coinsDistributed: coinsAgg._sum.amount ?? 0,
      avgAccuracy,
    };
  }

  /** Analytics focused on closed (RESOLVED) predictions: overall totals plus a
   *  per-prediction breakdown of entries, accuracy, winning option and payout. */
  async closedPredictionAnalytics(opts: { take?: string; days?: string } = {}) {
    const take = Math.min(Math.max(Number(opts.take) || 20, 1), 100);
    const days = Number(opts.days) || 0;
    const since = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : undefined;
    const resolvedWhere: Prisma.PredictionWhereInput = {
      status: PredictionStatus.RESOLVED,
      ...(since ? { resolvedAt: { gte: since } } : {}),
    };
    const resolvedFilter = { prediction: resolvedWhere };

    const [totalResolved, entryAgg, wonCount, luckyDraws, recent] = await Promise.all([
      this.prisma.prediction.count({ where: resolvedWhere }),
      this.prisma.userPrediction.aggregate({
        where: resolvedFilter,
        _count: { _all: true },
        _sum: { rewardEarned: true },
      }),
      this.prisma.userPrediction.count({ where: { ...resolvedFilter, status: EntryStatus.WON } }),
      // Lucky draws are pooled once per day now, not per prediction, so they
      // can only be attributed to this same date window, not to individual
      // predictions below (see luckyPaid comment).
      this.prisma.luckyDraw.findMany({
        where: since ? { drawDate: { gte: since } } : {},
        select: { winnersCount: true, bonusPerWinner: true },
      }),
      this.prisma.prediction.findMany({
        where: resolvedWhere,
        include: {
          category: { select: { label: true } },
          correctOption: { select: { label: true } },
          _count: { select: { entries: true } },
        },
        orderBy: { resolvedAt: 'desc' },
        take,
      }),
    ]);

    const ids = recent.map((p) => p.id);
    const [wonGroups, rewardGroups] = await Promise.all([
      this.prisma.userPrediction.groupBy({
        by: ['predictionId'],
        where: { predictionId: { in: ids }, status: EntryStatus.WON },
        _count: { _all: true },
      }),
      this.prisma.userPrediction.groupBy({
        by: ['predictionId'],
        where: { predictionId: { in: ids } },
        _count: { _all: true },
        _sum: { rewardEarned: true },
      }),
    ]);
    const wonBy = new Map(wonGroups.map((g) => [g.predictionId, g._count._all]));
    const entriesBy = new Map(rewardGroups.map((g) => [g.predictionId, g._count._all]));
    const rewardBy = new Map(rewardGroups.map((g) => [g.predictionId, g._sum.rewardEarned ?? 0]));

    const predictions = recent.map((p) => {
      const entries = entriesBy.get(p.id) ?? 0;
      const won = wonBy.get(p.id) ?? 0;
      const rewardPaid = rewardBy.get(p.id) ?? 0;
      return {
        id: p.id,
        title: p.title,
        category: p.category?.label ?? '',
        participants: p.participants,
        entries,
        won,
        lost: entries - won,
        accuracy: entries ? won / entries : 0,
        winningOption: p.correctOption?.label ?? null,
        rewardPaid,
        // Lucky-draw payout is a once-daily platform-wide pool, not
        // attributable to a single prediction (see totalLuckyPaid below).
        payout: rewardPaid,
        resolvedAt: p.resolvedAt,
      };
    });

    const totalEntries = entryAgg._count._all;
    const totalLuckyPaid = luckyDraws.reduce((s, d) => s + d.winnersCount * d.bonusPerWinner, 0);
    const totalRewardPaid = entryAgg._sum.rewardEarned ?? 0;

    return {
      totalResolved,
      totalEntries,
      totalWon: wonCount,
      avgAccuracy: totalEntries ? wonCount / totalEntries : 0,
      totalRewardPaid,
      totalLuckyPaid,
      totalPayout: totalRewardPaid + totalLuckyPaid,
      predictions,
    };
  }

  // ───────────────────────────── Settings ──────────────────────────

  listSettings() {
    return this.prisma.setting.findMany({ orderBy: { key: 'asc' } });
  }

  async upsertSetting(key: string, value: unknown, adminId?: string) {
    const json = value as Prisma.InputJsonValue;
    const setting = await this.prisma.setting.upsert({
      where: { key },
      create: { key, value: json },
      update: { value: json },
    });
    await this.prisma.auditLog.create({
      data: { actorId: adminId ?? null, action: 'update-setting', target: key, meta: json },
    });
    return setting;
  }

  // ───────────────────────────── Banners ───────────────────────────

  listBanners() {
    return this.prisma.banner.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  createBanner(dto: CreateBannerDto) {
    return this.prisma.banner.create({
      data: {
        title: dto.title,
        imageUrl: dto.imageUrl,
        link: dto.link,
        active: dto.active ?? undefined,
        sortOrder: dto.sortOrder ?? undefined,
      },
    });
  }

  async updateBanner(id: string, dto: UpdateBannerDto) {
    await this.ensureBanner(id);
    return this.prisma.banner.update({ where: { id }, data: { ...dto } });
  }

  async deleteBanner(id: string) {
    await this.ensureBanner(id);
    await this.prisma.banner.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async ensureBanner(id: string) {
    const exists = await this.prisma.banner.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Banner not found');
  }

  // ─────────────────────────────── CMS ─────────────────────────────

  listCmsPages() {
    return this.prisma.cmsPage.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  createCmsPage(dto: CreateCmsPageDto) {
    return this.prisma.cmsPage.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        content: dto.content,
        active: dto.active ?? undefined,
      },
    });
  }

  async updateCmsPage(id: string, dto: UpdateCmsPageDto) {
    const exists = await this.prisma.cmsPage.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('CMS page not found');
    return this.prisma.cmsPage.update({ where: { id }, data: { ...dto } });
  }

  // ─────────────────────── Lucky Draw (manual override) ───────────────────

  /** Recent lucky draws with their winners, for the admin Lucky Winners page. */
  async listLuckyDraws(opts: { take?: string } = {}) {
    const take = Math.min(Number(opts.take) || 20, 100);
    const draws = await this.prisma.luckyDraw.findMany({
      orderBy: { drawDate: 'desc' },
      take,
      include: {
        winners: {
          include: { user: { select: { id: true, name: true, username: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return draws.map((d) => ({
      id: d.id,
      dayKey: d.dayKey,
      drawDate: d.drawDate,
      winnersCount: d.winnersCount,
      bonusPerWinner: d.bonusPerWinner,
      eligibleCount: d.eligibleCount,
      winners: d.winners.map((w) => ({
        id: w.id,
        userId: w.userId,
        name: w.user.name,
        username: w.user.username,
        amount: w.amount,
      })),
    }));
  }

  /** The [start, end) calendar-day window a draw pooled from — `dayKey` for
   *  rows created by the daily job, falling back to `drawDate`'s own day for
   *  legacy per-prediction rows that predate `dayKey` (see schema comment). */
  private dayWindowFor(draw: { dayKey: string | null; drawDate: Date }) {
    const base = draw.dayKey
      ? new Date(`${draw.dayKey}T00:00:00`)
      : draw.drawDate;
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  /**
   * Users with a correct prediction that day who weren't drawn — i.e.
   * genuinely eligible manual-replacement candidates (SOW §5.3: "must have
   * at least one correct prediction"), not an arbitrary user list.
   */
  async eligibleLuckyReplacements(drawId: string) {
    const draw = await this.prisma.luckyDraw.findUnique({
      where: { id: drawId },
      include: { winners: { select: { userId: true } } },
    });
    if (!draw) throw new NotFoundException('Lucky draw not found');
    const winnerIds = new Set(draw.winners.map((w) => w.userId));
    const { start, end } = this.dayWindowFor(draw);
    const entries = await this.prisma.userPrediction.findMany({
      where: { status: EntryStatus.WON, resolvedAt: { gte: start, lt: end } },
      distinct: ['userId'],
      select: { user: { select: { id: true, name: true, username: true } } },
    });
    return entries.map((e) => e.user).filter((u) => !winnerIds.has(u.id));
  }

  /**
   * Manually swaps a drawn lucky winner for a different eligible user (e.g.
   * fraud/error correction) — reverses the old winner's bonus, credits the
   * new one, and audit-logs the change. The draw itself stays random per
   * SOW §5.3; this only lets admins correct an individual entry afterward.
   */
  async replaceLuckyWinner(
    drawId: string,
    winnerId: string,
    newUserId: string,
    adminId?: string,
  ) {
    const winner = await this.prisma.luckyWinner.findUnique({
      where: { id: winnerId },
      include: { draw: true },
    });
    if (!winner || winner.drawId !== drawId) {
      throw new NotFoundException('Lucky winner not found');
    }
    if (winner.userId === newUserId) {
      throw new BadRequestException('That user is already this winner');
    }
    const alreadyWinner = await this.prisma.luckyWinner.findUnique({
      where: { drawId_userId: { drawId, userId: newUserId } },
    });
    if (alreadyWinner) {
      throw new BadRequestException('That user is already a winner of this draw');
    }
    const { start, end } = this.dayWindowFor(winner.draw);
    const eligible = await this.prisma.userPrediction.findFirst({
      where: {
        userId: newUserId,
        status: EntryStatus.WON,
        resolvedAt: { gte: start, lt: end },
      },
      select: { id: true },
    });
    if (!eligible) {
      throw new BadRequestException(
        "That user didn't have a correct prediction that day, so is not eligible for its lucky draw",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await this.economy.applyTxn(
        tx,
        winner.userId,
        CoinTxnType.ADMIN_ADJUST,
        -winner.amount,
        {
          referenceId: winner.draw.id,
          description: 'Lucky Winner bonus reversed (admin correction)',
        },
      );
      await this.economy.applyTxn(
        tx,
        newUserId,
        CoinTxnType.ADMIN_ADJUST,
        winner.amount,
        {
          referenceId: winner.draw.id,
          description: 'Lucky Winner bonus (admin correction)',
        },
      );
      const updated = await tx.luckyWinner.update({
        where: { id: winnerId },
        data: { userId: newUserId },
      });
      await tx.auditLog.create({
        data: {
          actorId: adminId ?? null,
          action: 'replace-lucky-winner',
          target: winnerId,
          meta: {
            drawId,
            oldUserId: winner.userId,
            newUserId,
            amount: winner.amount,
          },
        },
      });
      return { id: updated.id, userId: updated.userId, amount: updated.amount };
    });
  }
}
