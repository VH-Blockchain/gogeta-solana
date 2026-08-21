# Gogeta Admin Panel — Deployment Guide

This is the **Predora admin panel** (Next.js). It is hosted alongside, but
separately from, the **Predora API backend** (repo `predora_backend`, which has
its own `DEPLOYMENT.md` covering the database, Redis, and API service).

This document is for the DevOps engineer standing the admin panel up on company
servers.

---

## Overview

| | |
|---|---|
| Repo | `git@github.com:dipakravalVH/predora_admin.git` |
| Stack | Next.js 16 + TypeScript + Tailwind v4 |
| Branch | `main` |
| Talks to | The Predora API only (never the database directly) |
| Access | Login restricted to users with the ADMIN role |

**What we need back:** a public URL for the admin panel.

**Prerequisite:** the API backend must be deployed first, because the admin
panel is configured to point at the live API URL.

---

## Runtime

**Runtime:** Node.js (Node 20 LTS+).

**Install, build & run**
```bash
npm ci
npm run build
npm run start           # serves the production build (default port 3000)
```

To change the port, set `PORT` (standard Next.js behavior), e.g. `PORT=8080 npm run start`.

---

## Environment variables

`.env*` files are not committed with real values; see `.env.example` for the
template. Set this on the host (or in `.env.local`):

| Var | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | ✅ | Full URL of the deployed API **including** the `/api` prefix, e.g. `https://api.example.com/api` |

> Note: `NEXT_PUBLIC_*` values are baked in at **build time**. If the API URL
> changes, rebuild the admin panel (`npm run build`) — setting it only at
> runtime will not take effect.

---

## Deploy checklist

1. Ensure the API backend is deployed and reachable (see the backend repo's `DEPLOYMENT.md`).
2. Set `NEXT_PUBLIC_API_BASE` to the live API URL + `/api`.
3. `npm ci && npm run build`.
4. `npm run start` — verify the login page loads.
5. Log in with an ADMIN account and confirm the dashboard loads real data.
6. Return the admin URL to the app team.
