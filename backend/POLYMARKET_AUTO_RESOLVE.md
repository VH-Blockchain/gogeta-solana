# Polymarket Auto-Resolve

Status: **implemented**, 2026-07-21.

## Problem

Predictions imported from Polymarket (`source = AUTO_ENTRY`) get locked
automatically once `closesAt` passes (`SchedulerService.lockExpiredPredictions`,
every minute), but nothing ever tells the system the *real-world outcome*.
Every one of those predictions sat `LOCKED` forever until an admin happened to
notice it, look up the answer on Polymarket by hand, and resolve it manually
via `POST /admin/predictions/:id/resolve`.

## What this feature does — and deliberately does not do

**Does:** every 15/45 minutes, checks each `LOCKED` / `AUTO_ENTRY` prediction
against Polymarket's own market data. If Polymarket has genuinely closed that
market with an unambiguous winner, the prediction's `status` flips to a new
`AUTO_RESOLVED` state and `correctOptionId` is pre-filled with the detected
winner.

**Does not:** touch `UserPrediction` rows, move coins, update streaks/badges,
or send notifications. That is still the manual `resolvePrediction()` flow —
an admin has to open the prediction and click **Resolve & pay out**. This was
a deliberate scope decision: `resolvePrediction()` moves real economy (coin
rewards, the lucky draw), and Polymarket's price data, while a strong signal,
is not something we wanted silently triggering payouts with zero human in the
loop on day one. Automating the confirm step too is a natural phase 2 once this
has run in production for a while and the detection logic is trusted.

## Status lifecycle (updated)

```
DRAFT → SCHEDULED → OPEN → LOCKED → AUTO_RESOLVED → RESOLVED
                              ↓            ↓
                          CANCELLED    CANCELLED
```

`AUTO_RESOLVED` sits between `LOCKED` and `RESOLVED`. It only ever applies to
`AUTO_ENTRY` (Polymarket-imported) predictions — manually created and
CSV-imported predictions go straight from `LOCKED` to `RESOLVED` via the
admin's manual/CSV resolve flow, same as before.

## How a market is checked

1. Every `Prediction` with `source = 'AUTO_ENTRY'` and `status = 'LOCKED'` is a
   candidate.
2. Each prediction's `marketKey` (the Polymarket market slug, stored on its
   `PredictionOption` rows since all options of one prediction share the same
   slug) is collected into a deduplicated list.
3. That list is looked up against Polymarket's `/markets` endpoint in
   **batches of 50**, using the `slug` query param **repeated** once per
   market (`?slug=a&slug=b&slug=c...`) — this returns all matching markets in
   one HTTP call. This was verified directly against the live API before
   relying on it: comma-separating slugs in a single `slug=` value returns an
   empty result, repeating the param works.

   **Critical fix (found after initial rollout):** `/markets` silently
   defaults to `closed=false` when the `closed` param is omitted. The
   original version of this query passed no `closed` param at all — meaning
   it could *never* find an actually-closed market; every real resolution
   would have looked identical to "not found on Polymarket". Verified
   directly: a known-closed, non-restricted market's slug returned zero
   results with no `closed` param (and with `closed=false` explicitly), one
   result with `closed=true`. Fixed by querying **both** `closed=true` and
   `closed=false` per chunk and merging the results, so open vs. closed vs.
   genuinely-not-found stay correctly distinguishable. See
   `fetchPolymarketMarketsBySlug()`'s doc comment.
4. A prediction only gets auto-resolved when **all** hold:
   - Polymarket's own `closed` field is `true` (the authoritative signal —
     *not* inferred from price, unlike the import-time filter),
   - if present, `umaResolutionStatus` equals `"resolved"` (an extra guard
     using UMA's own oracle-confirmed status where Polymarket exposes it —
     found in the raw API response while investigating the bug above; only
     enforced when the field is present, since older/non-UMA markets may
     lack it), **and**
   - exactly one `outcomePrices` entry is exactly `1`.

   A closed market with no price at exactly `1` (voided, 50/50 split, still
   being adjudicated — a real example pulled from the live API had
   `outcomePrices: ["0", "0"]` on a `closed: true` market) is left alone for
   manual resolution rather than guessing. This is the one meaningful
   correction versus the *existing* import code, which infers "already
   settled" purely from price hitting 0/1 — that heuristic alone is not
   reliable enough to safely gate resolution, only import filtering.
5. The matching local `PredictionOption` is found by comparing its `label` to
   Polymarket's winning outcome label (not by array index) — a defensive
   choice in case option ordering ever drifts from the outcomes array.
6. Predictions whose `marketKey` isn't found on Polymarket at all (delisted,
   archived, or old backlog data that pre-dates the `marketKey` column) are
   skipped and logged, never guessed at.

## Direct id-based lookup (manual check only)

Polymarket also exposes `GET /markets/:id` — a direct lookup by its own
numeric market id, returning the market regardless of open/closed state (no
`closed` filter gotcha like the list endpoint above). Since imports now
capture this id (`PredictionOption.polymarketMarketId`, populated going
forward — the ~7,000-prediction backlog imported before this field existed
has none), the **manual** "Check result" flow (`checkPolymarketResolution`)
prefers it when available and falls back to the (now-fixed) slug-based
lookup otherwise. The batch **cron** still uses slug-based lookup only, to
keep the one-call-per-50-markets efficiency — a per-market id lookup would
mean one HTTP call per prediction again.

Every run writes one `PolymarketResolutionLog` row — `checked` / `resolved` /
`skipped` counts plus a `details` JSON array of per-skip reasons — mirroring
how `PolymarketImportLog` already audits the import side. Readable via
`GET /admin/predictions/polymarket-resolution-logs`.

## Two log tables, on purpose

There are now **two** Polymarket-resolution log tables, each answering a
different question:

| Table | Grain | Question it answers |
|---|---|---|
| `PolymarketResolutionLog` | one row per **cron run** | "Is the cron healthy? How many did it check/resolve/skip this tick?" |
| `PolymarketResolutionCheck` | one row per **prediction check** | "Why hasn't *this specific* prediction resolved?" / "When did it resolve, and via what?" |

`PolymarketResolutionCheck` is written by both the cron and the new manual
"Check result" button (see below), tagged via a `trigger` column
(`CRON`/`MANUAL`), with an `outcome` column (`RESOLVED` / `STILL_OPEN` /
`AMBIGUOUS` / `NOT_FOUND` / `NO_MARKET_KEY`).

**Logging rule, deliberately asymmetric:** every **MANUAL** check is logged
regardless of outcome — an admin clicking "Check result" is inherently
low-volume, and seeing exactly why it didn't resolve is the whole point of
that button. **CRON** checks are only logged here when they actually produce
`RESOLVED`. The cron re-checks the same backlog every 30 minutes forever;
logging `STILL_OPEN`/`NOT_FOUND` for the same never-changing stale prediction
on every single tick would grow this table without bound for zero benefit —
that routine noise stays in `PolymarketResolutionLog.details` (a bounded,
per-run JSON blob) instead. Actual resolutions are rare and meaningful, so
those always get a permanent row here from the cron too.

Per-prediction history: `GET /admin/predictions/:id/resolution-checks`.

## On-demand single-prediction check

Waiting up to 30 minutes for the next cron tick isn't always acceptable, so a
separate, independent action was added: `POST /admin/predictions/:id/check-resolution`.

- Runs the **exact same decision logic** as the cron (`evaluateResolution()`),
  just for one prediction's `marketKey` instead of a batch.
- Only valid for `AUTO_ENTRY` predictions currently `LOCKED` (400 otherwise).
- Returns `{ outcome, detail, prediction? }` — `prediction` is only populated
  when `outcome === 'RESOLVED'`, so the admin UI can refresh that row
  immediately.
- This is intentionally a **separate button** ("Check result", `ghost`
  variant, shown only for `LOCKED` + `AUTO_ENTRY` rows) from the existing
  **Resolve**/**Confirm** button — the existing manual resolve flow was left
  completely unchanged. "Check result" only ever asks "what does Polymarket
  say right now" (and, if resolved, flips the status the same way the cron
  would); it never itself pays anyone out. Confirming payout is still only
  ever done through Resolve/Confirm.

## Safety fixes made alongside this (found during implementation, not optional)

Two existing code paths assumed only `OPEN`/`LOCKED`/`RESOLVED` existed for a
prediction's public-facing behavior. Adding `AUTO_RESOLVED` would have quietly
broken both if left as-is:

1. **`resolvePrediction()`'s guard already just works.** It only refuses to
   run on `RESOLVED`/`CANCELLED` predictions, so calling it on an
   `AUTO_RESOLVED` one proceeds normally — no code change needed there.
2. **`correctOptionId` was leaking to the public API early.**
   `PredictionsService.serialize()` (used by every user-facing prediction
   endpoint) returned `prediction.correctOptionId` unconditionally. Since this
   feature sets that field as soon as a market auto-resolves — before any
   payout — a user could have seen the winning answer before being paid.
   Fixed: it's now only exposed once `status === RESOLVED`.
3. **A user's bet would vanish from "My active picks."**
   `GET /predictions/mine/active` only queried `OPEN`/`LOCKED` predictions. An
   `AUTO_RESOLVED` prediction is neither, so the entry (still `EntryStatus.LOCKED`
   underneath — auto-resolve never touches `UserPrediction`) would disappear
   from the user's active list without appearing in history either. Fixed:
   `AUTO_RESOLVED` is now included in that query.

`GET /predictions/mine/history` did **not** need a fix — it filters by
`UserPrediction.status IN (WON, LOST)`, which is only ever set inside the real
`resolvePrediction()` transaction, so it correctly stays empty until payout.

## Files changed

**Backend** (`predora_backend`)
- `prisma/schema.prisma` — added `AUTO_RESOLVED` to `PredictionStatus`; added
  `PolymarketResolutionLog` (per-run) and `PolymarketResolutionCheck`
  (per-prediction) models. Migrations:
  `prisma/migrations/20260721053554_add_polymarket_auto_resolve/`,
  `prisma/migrations/20260721055254_add_polymarket_resolution_check/`.
- `src/admin/admin.service.ts` —
  - `autoResolvePolymarketPredictions()` — the cron, `@Cron('15,45 * * * *')`.
  - `checkPolymarketResolution(id)` — the on-demand single-prediction check.
  - `evaluateResolution()` — pure decision logic (no I/O), shared by both;
    now also gates on `umaResolutionStatus` where present.
  - `applyResolutionCheck()` — applies a `RESOLVED` outcome and writes the
    `PolymarketResolutionCheck` row per the logging rule above.
  - `fetchPolymarketMarketsBySlug()` (batched fetch helper — fixed to query
    both `closed=true` and `closed=false`, see the critical-fix note above),
    `fetchPolymarketMarketById()` (direct id lookup for the manual check),
    `listPolymarketResolutionLogs()`, `listResolutionChecks()`,
    `PolymarketMarket`/`ResolutionCheckResult` interfaces.
- `src/admin/admin-predictions.controller.ts` — added
  `GET /admin/predictions/polymarket-resolution-logs`,
  `POST /admin/predictions/:id/check-resolution`,
  `GET /admin/predictions/:id/resolution-checks`.
- `src/predictions/predictions.service.ts` — the two safety fixes above
  (`serialize()`, `mineActive()`).
- `prisma/schema.prisma` — added `PredictionOption.polymarketMarketId`.
  Migration: `prisma/migrations/20260721063159_add_polymarket_market_id/`.

**Admin panel** (`predora_admin`)
- `src/lib/types.ts` — added `'AUTO_RESOLVED'` to the `PredictionStatus` union.
- `src/components/ui.tsx` — added a `teal` `Badge` color.
- `src/app/(app)/predictions/page.tsx` — status color/order maps; a new,
  separate **Check result** button (ghost variant) for `LOCKED` + `AUTO_ENTRY`
  rows that calls `check-resolution` and alerts the outcome; the existing
  **Resolve** button is unchanged in behavior and now also shows (as
  **Confirm**) for `AUTO_RESOLVED` rows; `ResolveModal` pre-selects the
  detected winning option and shows a banner explaining it was auto-detected;
  the `#resolve=<id>` deep link now filters to the prediction's actual status
  instead of assuming `LOCKED`.
- `src/app/(app)/page.tsx` — the dashboard's "Needs your attention" widget now
  fetches `AUTO_RESOLVED` predictions too, lists them first (they're a faster
  win — the answer is already known), and tags them "auto-detected" /
  "Confirm →".

## Operational notes

- Cron cadence: `15,45 * * * *` — offset 15 minutes from the existing
  `autoImportPolymarket` cron (`*/30 * * * *`, i.e. `:00`/`:30`), so a newly
  imported market isn't checked for resolution in the same tick it was
  created.
- Batch size: 50 slugs per Polymarket request. Chunked, not a hard cap — a
  backlog of thousands of `LOCKED` predictions is handled in a handful of
  requests, not one per prediction.
- Verified against the live backlog at implementation time: ~6,900 `LOCKED`
  `AUTO_ENTRY` predictions existed, many of them old seed/test data with
  `closesAt` far in the past and no `marketKey` at all, or a `marketKey` no
  longer present on Polymarket. These are all safely skipped and logged, not
  acted on — confirms the "skip when unsure" design holds up against messy
  real data, not just the happy path.

## Verifying it's working

- `GET /admin/predictions/polymarket-resolution-logs` — one row per cron run.
- `GET /admin/predictions/:id/resolution-checks` — full check history for one
  prediction (every manual check + any cron check that resolved it).
- `GET /admin/predictions?status=AUTO_RESOLVED` — predictions currently
  awaiting a one-click confirm.
- Admin dashboard home page — "Needs your attention" now surfaces these first.
- Predictions list — the new **Check result** button, shown only on
  `LOCKED` + Polymarket-sourced rows.

Both the cron's decision logic and the manual check were run against live
production data (not just typechecked) before calling this done:
- A real, still-open Dogecoin 5-minute market correctly came back
  `STILL_OPEN` even though its `closesAt` had already passed by about a
  minute — confirming the gate is genuinely Polymarket's own `closed` flag,
  not local timing.
- A real, already-resolved CS2 market (`closed: true`,
  `umaResolutionStatus: 'resolved'`, winner "Under") was used to catch and
  verify the `closed=false`-default bug above: before the fix, this exact
  market came back empty from the slug query (looking identical to "not
  found"/never-closed); after the fix, it's found correctly with the right
  winning outcome. This is what the earlier Dogecoin test alone didn't
  prove — it only exercised the `STILL_OPEN` path, not `RESOLVED`.

## Possible next phase

If the detection logic proves reliable in production, the natural next step is
letting an admin flip a settings toggle that has the cron call
`resolvePrediction()` directly for `AUTO_RESOLVED` predictions after they've
sat unconfirmed for some window (e.g. 6h), turning this into fully hands-off
resolution. Not built now — deliberately kept as a manual confirm step for the
initial rollout.
