#!/usr/bin/env bash
# Predora backend — one-command deploy/redeploy.
#
# DevOps: this is the ONLY command you should ever need to run to deploy or
# redeploy this backend. Do not manually run `npm install <package>` to try to
# fix a build error — always re-run this script instead (or reach out to us).
# It safely resets the checkout to exactly match `main`, so any accidental
# local edits (e.g. from a prior manual `npm install` attempt) are discarded
# before installing/building. It does NOT touch your `.env` (git-ignored,
# never affected by a git reset).
#
# Usage: bash scripts/deploy.sh

set -euo pipefail

echo "==> Fetching latest main..."
git fetch origin main

echo "==> Resetting working tree to origin/main (discards any local edits to tracked files)..."
git reset --hard origin/main

echo "==> Clean install (removes node_modules, installs strictly from package-lock.json)..."
rm -rf node_modules
npm ci

echo "==> Applying database migrations..."
npx prisma migrate deploy

echo "==> Building..."
npm run build

echo
echo "==> Build complete. Restart the running service now to apply this deploy"
echo "    (e.g. pm2 restart predora-backend, or your process manager's restart command)."
