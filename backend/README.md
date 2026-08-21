# GOGETA API (backend)

NestJS + Prisma (PostgreSQL). One role-based REST API serving both the user
portal (`user_frontend_react`) and the admin panel (`admin_frontend`).

- **Base URL:** `http://localhost:4000/api`
- **Swagger:** `http://localhost:4000/docs`
- **Health:** `GET /api/health`

## Stack

NestJS 11 · Prisma 6 · PostgreSQL · JWT + email-OTP auth · `@nestjs/schedule`
cron · class-validator · Swagger · `@solana/web3.js` + `@solana/spl-token`
(read-only cluster access; the backend holds no keys).

No Redis and no job queue. `ioredis` is still in `package.json` but nothing
imports it — scheduling is `@nestjs/schedule` cron in-process, which assumes a
**single instance** (see [Scheduled jobs](#scheduled-jobs)).

## Prerequisites

PostgreSQL 16 running locally, and a database to point at:

```bash
createdb gogetasolana          # once; then set DATABASE_URL to match
```

## Setup & run

```bash
npm install                       # runs `prisma generate` via postinstall
cp .env.example .env              # then fill in the values below
npx prisma migrate deploy         # apply the 28 existing migrations
npm run seed                      # levels, badges, categories, settings, CMS, admin, samples
npx ts-node prisma/seed-quiz.ts   # 200 quiz questions (50 per category) + quiz defaults
npm run build && npm run start:prod
```

Seeded admin: `admin@gogeta.app` / `admin1234`.

### A note on `npm run start:dev`

`start:dev` (`nest start --watch`) **starts once and then fails to relaunch** on
every file change with `Cannot find module '.../dist/main'`. The Nest CLI expects
`dist/main`, but this project compiles to `dist/src/main.js` — `tsconfig.json`
sets no `rootDir` and the program includes `.ts` files outside `src/`
(`prisma/seed.ts`, `prisma/seed-quiz.ts`, `scripts/`), so TypeScript's inferred
common root is the project directory and the output nests a level deeper. That is
also why `start:prod` is `node dist/src/main`.

Until it is fixed, restart with:

```bash
npm run build && npm run start:prod
```

Fixing it properly means setting `"rootDir": "./src"` in `tsconfig.build.json`
and updating `start:prod` to `node dist/main` — a deliberate change to the build
layout, so it has been left alone.

## Environment

Everything lives in `.env` (never committed); `.env.example` documents each key.

| Group | Keys |
| --- | --- |
| Database | `DATABASE_URL` |
| Auth | `JWT_SECRET`, `JWT_EXPIRES_IN`, `OTP_TTL_MINUTES`, `OTP_RESEND_COOLDOWN_SECONDS` |
| Server | `PORT` (4000), `NODE_ENV`, `PUBLIC_BASE_URL` |
| Mail | `MAIL_PROVIDER` (`elasticemail` \| `smtp`), `ELASTICEMAIL_API_KEY`, `SMTP_*`, `MAIL_FROM` |
| Push | `FIREBASE_SERVICE_ACCOUNT` |
| Uploads | `STORAGE_DRIVER` (`local` \| `s3`), `UPLOAD_DIR` |
| Solana | `POINTS_PURCHASE_RECEIVER_ADDRESS`, `SOLANA_NETWORK`, `SOLANA_RPC_URL`, `SOLANA_USDC_MINT`, `SOLANA_USDC_DECIMALS`, `SOLANA_EXPLORER_URL`, `POINTS_PURCHASE_TTL_MINUTES` |
| Withdrawals | `WITHDRAWAL_TREASURY_ADDRESS` (comma-separated list), `WITHDRAWAL_TOKEN_MINT`, `WITHDRAWAL_TOKEN_SYMBOL`, `WITHDRAWAL_TOKEN_DECIMALS` |
| Unused | `REDIS_HOST`, `REDIS_PORT` — left in place but not read anywhere |

`POINTS_PURCHASE_RECEIVER_ADDRESS` has **no default**: while it is empty, buying
points stays disabled rather than accepting payments to an address nobody chose.
`WITHDRAWAL_TREASURY_ADDRESS` behaves the same way for withdrawals — with no
treasury address there is nothing to verify a payout against, so the feature
reports itself unavailable instead of approving requests it cannot settle. It
takes a comma-separated list, because each admin signs payouts from their own
wallet.

Only two mail drivers are implemented. When the selected one is unconfigured,
OTP codes are logged to the console instead — the local-dev path.

## Auth & authorization

Both guards are global (`APP_GUARD` in `app.module.ts`), so **every route
requires a bearer token unless it is marked `@Public()`**:

```
Authorization: Bearer <jwt>
```

- `@Public()` — open routes (auth, `/config`, `/categories`, `/cms`, `/banners`, `/health`)
- `@Roles(Role.ADMIN)` — admin writes
- `@Roles(Role.ADMIN, Role.VIEWER)` — admin reads, so a VIEWER can inspect but not change
- `@CurrentUser('id' | 'email')` — injects the caller, so no endpoint takes a user id from the client

| Method | Route | Notes |
| --- | --- | --- |
| POST | `/auth/register` | signup bonus + Welcome badge, OTP issued |
| POST | `/auth/login` | returns `{ token, user }` |
| POST | `/auth/verify-otp`, `/auth/resend-otp` | email verification |
| POST | `/auth/forgot-password`, `/auth/verify-reset-code`, `/auth/reset-password` | OTP reset |

## API surface

142 mapped routes. Grouped by area — see Swagger for request/response shapes.

### App-facing

| Area | Routes |
| --- | --- |
| Config | `GET /config` — economy, site branding, categories, feature flags, ad units |
| Users | `GET/PATCH/DELETE /users/me`, `/users/me/{stats,badges,home,trends,settings}`, `PATCH /users/me/password`, `POST /users/me/app-open`, `POST/DELETE /users/me/device-token` |
| Predictions | `GET /predictions`, `GET /predictions/:id`, `POST /predictions/:id/submit`, `GET /predictions/mine/{active,history}` |
| Quiz | `GET /quiz/{categories,current,next,history}`, `GET /quiz/history/:participationId`, `POST /quiz/:quizId/{join,answer}`, `GET /quiz/:quizId/{question,result}` |
| Points | `GET /points/{purchase-config,balance,purchases}`, `POST /points/purchase/create`, `POST /points/purchase/:id/{confirm,cancel}`, `GET /points/purchase/:id` |
| Withdrawals | `GET /withdrawals/available`, `GET /withdrawals`, `POST /withdrawals`, `GET /withdrawals/:id`, `POST /withdrawals/:id/cancel` |
| Leaderboard | `GET /leaderboard`, `GET /leaderboard/lucky-winners/today` |
| Rewards | `GET /rewards/{summary,transactions}` |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/:id/read`, `POST /notifications/read-all` |
| Content | `GET /categories`, `GET /banners`, `GET /cms`, `GET /cms/:slug` |

### Admin (81 routes)

`/admin/users` · `/admin/predictions` · `/admin/quizzes` + `/admin/quiz/questions`
· `/admin/points` · `/admin/withdrawals` · `/admin/lucky-draws` · `/admin/leaderboard` · `/admin/settings`
· `/admin/categories` · `/admin/banners` · `/admin/cms` · `/admin/notifications`
· `/admin/analytics` · `/admin/audit-log` · `/admin/upload` · `/admin/mail`

Uploaded files are served from `/api/uploads`.

## The points economy

`CoinTransaction` is the **single ledger** for every balance change. All of them
go through `EconomyService.applyTxn(tx, userId, type, amount, opts)`, which must
be called inside a `prisma.$transaction` so the balance update and the ledger row
commit together. Nothing else in the codebase writes `user.coins`.

`CoinTxnType`: `SIGNUP_BONUS`, `ENTRY_FEE`, `CORRECT_REWARD`, `LUCKY_BONUS`,
`BONUS` (daily), `QUIZ_ENTRY`, `QUIZ_REWARD`, `POINT_PURCHASE`, `WITHDRAWAL`,
`ADMIN_ADJUST`.

Amounts are **not hard-coded** — they resolve from the `Setting` table
(`economy.*`, `quiz.*`, `dailyBonus.*`) and are editable from the admin panel, so
the live values may differ from the code defaults in
`EconomyService.DEFAULTS` / `QUIZ_DEFAULTS`:

| Setting | Code default | Meaning |
| --- | --- | --- |
| `economy.signupBonus` | 100 | granted on registration |
| `economy.entryFee` | 50 | charged per prediction (a cost, not a grant) |
| `economy.correctReward` | 10 | granted for a correct call |
| `economy.luckyBonus` | 50 | per lucky-draw winner |
| `economy.dailyLuckyWinners` | 10 | winners drawn per resolution day |
| `economy.usdcToPoints` | 100 | points per 1 USDC |
| `economy.pointsMinPurchaseUsdc` / `MaxPurchaseUsdc` | 1 / 1000 | per-purchase bounds |
| `economy.pointsPurchaseEnabled` | true | master switch for buying points |
| `economy.pointsEnabled` | true | off ⇒ every prediction entry costs 0 |
| `economy.withdrawalsEnabled` | true | master switch for cashing points out |
| `economy.minWithdrawalPoints` | 1000 | smallest withdrawal a user may request |
| `economy.withdrawableLuckyBonus` | false | whether lucky-draw points may be cashed out |
| `quiz.entryPoints` / `rewardPoints` | 50 / 10 | quiz cost and win reward |
| `quiz.cycleSeconds` / `secondsPerQuestion` / `questionsPerQuiz` | 900 / 10 / 5 | quiz timing |
| `quiz.winPercent` | 50 | score strictly above this wins |

Reward amounts are 10% of the platform's original values, reduced when paid
points were introduced (migration `20260819063500_reduce_rewards_to_10_percent`).
Costs were deliberately left alone.

`isReviewAccount()` and `economy.pointsEnabled = false` both make entry free
without changing any other behaviour — used for store review.

## Quiz engine

Sessions are **derived from the wall clock**, not driven by a ticking job:

```
slotIndex = floor(now / cycleMs)      →  startsAt = slotIndex × cycleMs
```

The finest cron here is one minute but the game needs 10-second precision, so
timing is arithmetic instead of scheduled state transitions. Consequences, all
intended: nothing to recover after a restart, two instances cannot disagree about
when a session runs, and `@@unique([category, slotIndex])` makes session creation
idempotent — duplicates are impossible rather than merely unlikely.

Each `Quiz` row stores a **config snapshot** plus its ordered `questionIds`, so an
admin changing the rules or the question bank mid-flight cannot alter a session
already scheduled or running.

Answer integrity is enforced by the database and by `select` clauses, not by
convention:

- `GET /quiz/:id/question` never selects `correctIndex` or `explanation`
- `POST /quiz/:id/answer` returns no `isCorrect`
- `@@unique([participationId, questionId])` — one answer per question
- `@@unique([userId, quizId])` — one entry per session; a double-click gets `409`
- the answer window is checked server-side with a small `answerGraceMs` latency allowance

## Buying points with USDC (Solana)

Two steps, and the client never states what it is owed:

1. `POST /points/purchase/create` — the server fixes the amount, rate and points
   and stores a `PENDING` `PointPurchase` **before** the wallet signs anything.
2. `POST /points/purchase/:id/confirm` — the client sends **only** a transaction
   signature. `SolanaService` reads the cluster and re-derives the sender,
   recipient, mint, amount and success from the chain itself, then credits only
   what was actually paid, inside one `$transaction`.

`PointPurchase.transactionSignature` is unique, so the same payment can never be
credited twice — the database enforces that, not application logic.

### How a transfer is verified

Verification works off `meta.preTokenBalances` / `meta.postTokenBalances` rather
than by decoding transfer instructions, and that choice carries most of the
correctness:

- Those entries name the **mint** and the **owner wallet** directly, so there is
  no need to re-derive an associated token account and hope the sender used the
  canonical one. A transfer out of a non-canonical token account still attributes
  to the right owner.
- It is a **net** view, summed per owner across every token account they hold for
  the mint. A transaction that moves tokens in and partly back out, routes through
  several instructions, or does the transfer via CPI is measured by what actually
  ended up where. Instruction decoding can be talked into counting a movement that
  was later undone.
- It is indifferent to instruction shape, so `transfer`, `transferChecked`, a
  router, or a future variant all verify identically.

This is also what makes a **multi-recipient** payout verify correctly: a single
transfer splitting 100 USDC as 98/1/1 is read as three independent credits, and
each recipient can only ever claim their own leg. Tested against exactly such a
transaction on devnet.

Addresses and signatures are base58 and **case-sensitive**. They are trimmed and
never lower-cased — the EVM habit of normalising case produces a different,
invalid key, and a lower-cased signature simply does not resolve on the cluster
(see `src/blockchain/solana-address.ts`).

All amounts are handled as `bigint` base units; an amount with more decimals than
the mint supports is rejected rather than silently rounded.

The backend never needs a private key — the user's wallet signs, the server only
reads. The same holds for payouts in the other direction (see
[Withdrawing points to USDC](#withdrawing-points-to-usdc)).

## Withdrawing points to USDC

The reverse of a purchase, with one structural difference: a purchase is settled
by the chain, a withdrawal is settled by a person. So the flow is a review queue,
and the points are **reserved rather than deducted** until a payout exists.

### What is withdrawable

Not the balance. `user.coins` says how many points exist, not where they came
from, and only some sources may be cashed out — so eligibility is recomputed from
the `CoinTransaction` ledger on every read (`src/withdrawals/withdrawable.ts`):

| Counts toward withdrawable | Does not |
| --- | --- |
| `POINT_PURCHASE` (bought with USDC) | `SIGNUP_BONUS` |
| `CORRECT_REWARD` (predictions) | `BONUS` (daily) |
| `QUIZ_REWARD` | `LUCKY_BONUS` — unless `economy.withdrawableLuckyBonus` |

```
spendBeyondGifts   = max(0, spend − giftedCredits)
pool               = withdrawableCredits − alreadyWithdrawn − spendBeyondGifts
withdrawablePoints = clamp(pool, 0, balance)
availableToWithdraw = max(0, withdrawablePoints − reservedPoints)
```

Spending is charged against **gifted points first**, which is the reading that
favours the user, and the result is then clamped to the real balance so
withdrawable can never exceed what is actually held. A negative `ADMIN_ADJUST`
counts as spend, so a clawback shrinks the withdrawable pool instead of being
ignored.

### Reservation, not deduction

`POST /withdrawals` validates the wallet, the minimum and the availability,
derives the payout itself, and writes a `PENDING` `WithdrawalRequest` with
`reserved = true`. The balance is untouched. Two requests cannot spend the same
points: after inserting, `create()` re-reads the reserved total **inside the same
`$transaction`** and rolls back with `CONCURRENT_WITHDRAWAL` if its own row pushed
the user over — whichever transaction commits second sees the other and loses.

The rate is snapshotted onto the row, so a later admin rate change cannot restate
what an open request is worth. It is the *same* `economy.usdcToPoints` purchases
use — there is deliberately no second withdrawal rate to drift apart from it.

### Status flow

```
PENDING ──approve──▶ APPROVED ──processing──▶ PROCESSING ──complete──▶ COMPLETED
   │                    │                          │
   ├──cancel (user)──▶ CANCELLED                   ├──fail──▶ FAILED ──▶ (retry)
   └──reject────────▶ REJECTED ◀──────reject───────┘
```

- **REJECTED / CANCELLED** — the reservation is released. No ledger row was ever
  written, so there is nothing to unwind.
- **FAILED** — the reservation is *kept*, because a failed payout is retryable.
- **COMPLETED** — the only state that touches the balance.

### Completion is verified, not asserted

`POST /admin/withdrawals/:id/complete` accepts **only** a transaction signature.
Before anything is debited, `SolanaService.verifyPayout()` reads the transfer back
off the cluster and confirms the mint, the decimals, the amount, that the sender
is an authorised treasury wallet and that the recipient is the request's wallet.
Only then does `applyTxn(WITHDRAWAL, −points)` run, in the same `$transaction`
that marks the row COMPLETED.

Unlike a purchase, this *does* assert an amount: the platform is claiming it
settled a specific request, so a transfer worth less than the request is refused
with `AMOUNT_MISMATCH`. Overpaying is accepted — that is the operator's mistake to
make, not a reason to leave the user's request open.

`WithdrawalRequest.transactionSignature` is unique, so one payout cannot settle
two requests. A verification that pays the right amount to the *wrong* address is
refused — tested against real devnet transactions.

The backend never holds a treasury key. An admin connects a Solana wallet on the panel's
Withdrawals page, signs the transfer there, and the panel hands the resulting
signature straight to `/complete`; the server only reads the chain. A payout signed
outside the panel still settles by pasting its signature.

`WITHDRAWAL_TREASURY_ADDRESS` therefore accepts a **comma-separated list** — one
entry per admin wallet allowed to pay. A transfer signed by a wallet not on that
list is refused, which is what stops a user paying themselves and submitting that
hash as their own payout, so it is never widened to accept any sender. The panel
checks the connected wallet against the list *before* offering to send, since a
transfer it would later refuse still moves real tokens.

Payouts are denominated in `WITHDRAWAL_TOKEN_*`, configured separately from the
purchase token: the spec asked whether payouts are USDT or USDC and said not to
assume they are interchangeable. **Solana devnet has no canonical USDT mint** to
verify against, and labelling a USDC transfer as USDT would tell users they are
receiving a token they are not. It defaults to the same USDC the platform already
accepts and can verify; pointing it at a real USDT mint later is an env change and
nothing more.

Every transition writes an `AuditLog` row and notifies the user.

## Scheduled jobs

In-process `@nestjs/schedule` cron. **Run one instance**: two would duplicate
payouts and draws.

| Schedule | Where | Job |
| --- | --- | --- |
| `* * * * *` | `quiz.service.ts` | settle finished sessions; prepare upcoming ones |
| `* * * * *` | `scheduler.service.ts` | open scheduled predictions; lock closed ones |
| `55 23 * * *` | `scheduler.service.ts` | daily lucky draw |
| `*/30 * * * *` | `admin.service.ts` | import from Polymarket |
| `15,45 * * * *` | `admin.service.ts` | auto-resolve settled Polymarket markets |
| `*/5 * * * *` | `points-purchase.service.ts` | expire stale purchase intents |

## Database

28 models, 16 enums, 28 migrations. Key tables: `User`, `Prediction` +
`PredictionOption` + `UserPrediction`, `CoinTransaction`, `LuckyDraw` +
`LuckyWinner`, `Quiz` + `QuizQuestion` + `QuizParticipation` + `QuizAnswer`,
`PointPurchase`, `WithdrawalRequest`, `Setting`, `Notification`, `AuditLog`, `Badge`/`UserBadge`,
`LevelDef`, `LeaderboardSnapshot`, `Banner`, `CmsPage`, plus the Polymarket
import/resolution logs.

```bash
npx prisma migrate dev --name <change>   # create + apply in development
npx prisma migrate deploy                # apply in CI/production
npx prisma studio                        # browse the data
```

Never edit production tables by hand — schema and data changes both go through
migrations (`20260819063500_reduce_rewards_to_10_percent` is an example of a data
migration, guarded on the old value so it is idempotent).

## Conventions

- **Validation:** a DTO per request body, `ValidationPipe({ whitelist: true, transform: true })` globally — unknown fields are stripped, so a client cannot smuggle extra properties.
- **Errors:** `throw new BadRequestException({ error: 'MACHINE_CODE', message: 'Human sentence.' })`. The frontends switch on `error` and display `message`.
- **Idempotency:** unique constraints plus catching Prisma `P2002`, rather than check-then-write. Conditional `updateMany({ where: { completedAt: null } })` is how a settle/payout claims its row.
- **Money:** every balance change inside `$transaction`, always via `applyTxn`. Points owed but not yet paid are *reserved*, never pre-deducted.
- **Admin config:** new tunables become `Setting` rows (`area.key`) read through a service, not new columns or env vars.

## Tests

```bash
npm test          # Jest
npm run test:e2e  # Jest, e2e config
npm run lint      # eslint --fix
```

`test/app.e2e-spec.ts` is still the CLI scaffold — it asserts `GET /` returns
"Hello World!", while the real route is `GET /api/health`. It fails as shipped;
either update or remove it before wiring CI. There are no unit tests yet.

## Related

- `../admin_frontend` — Next.js admin panel
- `../user_frontend_react` — React + Vite user portal
- `DEPLOYMENT.md` — deployment notes
- `POLYMARKET_AUTO_RESOLVE.md` — the Polymarket import/resolve flow
