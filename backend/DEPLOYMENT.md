# Predora — Deployment Guide

This document covers hosting the **Predora backend** (this repo) and the
**Predora admin panel** (separate repo). It is written for the DevOps engineer
standing the platform up on company servers.

The mobile app (Flutter) is **not** hosted — it is built and shipped to the
app stores separately. Only the two services below are hosted.

---

## Components

| Component | Repo | Stack | Branch |
|---|---|---|---|
| API backend | `git@github.com:dipakravalVH/predora_backend.git` | NestJS 11 + Prisma | `main` |
| Admin panel | `git@github.com:dipakravalVH/predora_admin.git` | Next.js 16 + TypeScript + Tailwind v4 | `main` |

**What we need back:** a public URL for the **API** and a public URL for the
**Admin panel**, plus confirmation that PostgreSQL and Redis are provisioned.

---

## Data stores

- **PostgreSQL** — primary database. Connected via `DATABASE_URL`. The schema is
  owned by **Prisma migrations** (in `prisma/migrations/`); apply them with
  `npx prisma migrate deploy` on every deploy. Do not modify the DB by hand.
- **Redis** — caching / support. Connected via `REDIS_HOST` and `REDIS_PORT`.

Please provision managed Postgres + Redis and either give us the connection
details or set the environment variables directly on the host.

---

## API backend

**Runtime:** Node.js (developed on Node 26; Node 20 LTS+ is fine).

**Install & build**
```bash
npm ci
npm run build           # compiles to dist/
```

**Database migrate (run once per deploy, before starting)**
```bash
npx prisma migrate deploy
```

**Seed the database (run once, after the first migrate)**

Creates the reference data the platform needs: levels, badges, categories, the
economy/site settings, the initial admin user, and a few sample predictions.
```bash
npx prisma db seed
```
- `prisma db seed` **auto-loads `.env`**, so `DATABASE_URL` is picked up the same
  way `migrate deploy` does — no need to export it manually.
- It is **idempotent** (uses upsert / existence checks) — safe to re-run.
- Requires dev dependencies to be installed (it runs `ts-node prisma/seed.ts`).
  If you deployed with a production-only install, either run `npm install` first
  or run the compiled seed instead: `node dist/prisma/seed.js` (with
  `DATABASE_URL` present in the environment).
- Initial admin login: `admin@gogeta.app` / `admin1234` — **change this password
  after first login** on any public deployment.

**Run (production)**
```bash
npm run start:prod      # node dist/main
```

**Serving details**
- Listens on `PORT` (default **4000**).
- All routes are served under the `/api` prefix (e.g. `https://api.example.com/api/...`).
- Interactive API docs (Swagger) are at **`/docs`**.
- CORS is enabled.

**Scaling note:** the backend runs an internal nightly cron job (~23:55, for
leaderboard rollups and snapshots). Run it as a **single persistent instance**.
If it is ever scaled horizontally, ensure the cron/scheduler runs on exactly
one node to avoid duplicate rollups.

### Environment variables (backend)

Set these on the host. `.env` is **not** committed; see `.env.example` for the
template.

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_HOST` | ✅ | Redis host |
| `REDIS_PORT` | ✅ | Redis port (default 6379) |
| `JWT_SECRET` | ✅ | Auth token signing secret — use a strong random value in prod |
| `JWT_EXPIRES_IN` | ✅ | Token lifetime (e.g. `7d`) |
| `OTP_TTL_MINUTES` | ✅ | OTP expiry in minutes (default 5) |
| `PORT` | ✅ | API port (default 4000) |
| `NODE_ENV` | ✅ | `production` |
| `FIREBASE_SERVICE_ACCOUNT` | optional | Firebase service-account JSON for push. Empty = OTP/notifications logged to console |
| `STORAGE_DRIVER` | optional | Media storage driver: `local` (default) or `s3` (not yet implemented) |
| `UPLOAD_DIR` | optional | Local driver upload dir (default `./uploads`), served at `/api/uploads`. **Mount a persistent volume here in production.** |

### Media uploads (prediction banners, category images)

Admin image uploads go to `POST /api/admin/upload` and are served at
`/api/uploads/...`. Only the resulting URL is stored in the DB.

- **Demo / single instance:** the default `local` driver is fine — just **mount
  a persistent volume at `UPLOAD_DIR`** (`./uploads`) so images survive
  redeploys. Without a volume, uploaded images are lost on each deploy.
- **Production at scale:** local disk does not work across multiple backend
  instances and has no CDN. Switch to object storage: set `STORAGE_DRIVER=s3`,
  implement `S3StorageService.save()`, `npm i @aws-sdk/client-s3`, and set the
  `S3_*` env vars. No DB / app / admin changes are needed — the storage backend
  is swappable behind `StorageService`.

---

## Admin panel

Separate repo (`predora_admin`). Standard Next.js app.

**Install, build & run**
```bash
npm ci
npm run build
npm run start           # serves the production build
```

**Environment variable (admin)**

| Var | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | ✅ | Full URL of the deployed API + `/api`, e.g. `https://api.example.com/api` |

See the admin repo's `.env.example`. The admin panel talks **only** to the API
(not to the database directly). Admin login is restricted to users with the
ADMIN role.

---

## Deploy checklist

**Every redeploy after the first one, run exactly this from the backend repo root:**
```bash
bash scripts/deploy.sh
```
This one script resets the checkout to `main`, does a clean `npm ci`, applies
migrations, and builds — then restart the running process (see the script's
final line for the exact command). **Do not run any other `npm`/`git`
commands by hand to "fix" a build error** — if the script fails, send us the
full output rather than improvising an install command; a stray
`npm install <package>` (including things that look like a package but are
really just a TypeScript import path, e.g. `firebase-admin/messaging`) can
corrupt the local checkout and is very hard to diagnose remotely.

**First-time setup only:**
1. Provision PostgreSQL and Redis.
2. Set backend environment variables (see table above).
3. `bash scripts/deploy.sh` (does install + migrate + build, per above).
4. `npx prisma db seed` (creates reference data + admin — run once, on first deploy only).
5. `npm run start:prod` — verify `GET /api` responds and `/docs` loads.
6. Deploy the admin repo; set `NEXT_PUBLIC_API_BASE` to the live API URL.
7. `npm ci && npm run build && npm run start` for admin; verify admin login works.
8. Return the API URL and admin URL to the app team.

---

## Notes / current limitations

- **No Dockerfiles yet** — deploy as standard Node apps. Containerization can be
  added on request.
- **Email/OTP delivery** currently logs to the server console (real email
  delivery is a later phase). This does not block hosting.
- **Push notifications** require `FIREBASE_SERVICE_ACCOUNT`; without it, the
  platform runs normally and logs notifications to the console.
