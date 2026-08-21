#!/usr/bin/env node
/**
 * One-off data fix for the Champion/Legend skip-ahead bug (see
 * scheduler.service.ts closeMonthly(), fixed in commit 68f6a19): monthly
 * top-10 leaderboard finishes used to promote straight to CHAMPION/LEGEND
 * with no check on correctPredictions, so a high-coin, low-accuracy user
 * could skip Analyst (>=50 correct) and Expert (>=100 correct) entirely.
 *
 * This script finds every user currently at CHAMPION or LEGEND who does NOT
 * actually have >=100 correct predictions (i.e. never legitimately reached
 * Expert) and resets them to the level their real stats support, and zeroes
 * their monthlyTop3Count so old, invalid top-3 finishes can't let them jump
 * straight back to Legend the next time they legitimately become Champion.
 *
 * Users who DO have >=100 correct predictions are left untouched even if
 * currently Champion/Legend — they satisfy the new rule, so there's nothing
 * to prove they were wrongly promoted.
 *
 * Usage:
 *   node scripts/fix-champion-legend-levels.js            # dry run, prints only
 *   node scripts/fix-champion-legend-levels.js --apply     # actually writes changes
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

function correctLevel(totalPredictions, correctPredictions) {
  // Mirrors gamification.service.ts levelFromStats(), capped below EXPERT
  // by construction here (this script only ever runs on users who failed
  // the >=100 correctPredictions check).
  if (correctPredictions >= 50) return 'ANALYST';
  if (totalPredictions >= 10) return 'PREDICTOR';
  return 'BEGINNER';
}

async function main() {
  const apply = process.argv.includes('--apply');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  const suspects = await prisma.user.findMany({
    where: { level: { in: ['CHAMPION', 'LEGEND'] } },
    select: {
      id: true,
      email: true,
      name: true,
      level: true,
      totalPredictions: true,
      correctPredictions: true,
      monthlyTop3Count: true,
    },
  });

  console.log(`Checked ${suspects.length} user(s) currently at CHAMPION/LEGEND.\n`);

  const toFix = suspects.filter((u) => u.correctPredictions < 100);
  const legit = suspects.filter((u) => u.correctPredictions >= 100);

  console.log(`${legit.length} legitimately Expert-qualified (>=100 correct) — left untouched.`);
  console.log(`${toFix.length} wrongly promoted (never reached Expert) — ${apply ? 'FIXING NOW' : 'would be fixed (dry run)'}:\n`);

  for (const u of toFix) {
    const newLevel = correctLevel(u.totalPredictions, u.correctPredictions);
    console.log(
      `  ${u.email} (${u.name}): ${u.level} -> ${newLevel} ` +
      `[total=${u.totalPredictions}, correct=${u.correctPredictions}, monthlyTop3Count ${u.monthlyTop3Count} -> 0]`,
    );
    if (apply) {
      await prisma.user.update({
        where: { id: u.id },
        data: { level: newLevel, monthlyTop3Count: 0 },
      });
    }
  }

  if (!apply && toFix.length) {
    console.log('\nDry run only — re-run with --apply to actually write these changes.');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
