/**
 * QA proof-of-fix: exercises the REAL production level-progression code
 * (GamificationService.levelFromStats, SchedulerService.closeMonthly)
 * against the local dev database — not a reimplementation of the rules.
 *
 * Suite A: Beginner/Predictor/Analyst/Expert thresholds (pure function,
 *          boundary values just below/at each cutoff).
 * Suite B: same thresholds, but round-tripped through a real DB row
 *          (write -> levelFromStats() on the fetched row -> persist ->
 *          re-read), same pattern as the two real call sites
 *          (predictions.service.ts, admin.service.ts).
 * Suite C: Champion/Legend gating via a real closeMonthly() run — proves
 *          the exact reported bug (jimmy: low correctPredictions, high
 *          rank) is now blocked, and that a legitimately Expert-qualified
 *          user still promotes correctly, including the Champion->Legend
 *          step.
 *
 * All test data uses `levelqa-*@test.local` emails and is deleted at the
 * end (or immediately, via --cleanup-only). Run against the LOCAL dev DB
 * only — never point this at production.
 *
 * Usage: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/test-level-progression.ts
 */

import { PrismaClient, UserLevel, CoinTxnType, LeaderboardPeriod } from '@prisma/client';
import { GamificationService } from '../src/gamification/gamification.service';
import { LeaderboardService } from '../src/leaderboard/leaderboard.service';
import { SchedulerService } from '../src/scheduler/scheduler.service';
import { EconomyService } from '../src/economy/economy.service';

const TEST_EMAIL_PREFIX = 'levelqa-';

let pass = 0;
let fail = 0;
function check(label: string, expected: unknown, actual: unknown) {
  const ok = expected === actual;
  ok ? pass++ : fail++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}: expected=${expected} actual=${actual}`);
}

async function cleanup(prisma: PrismaClient) {
  const testUsers = await prisma.user.findMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
    select: { id: true },
  });
  const ids = testUsers.map((u) => u.id);
  if (ids.length) {
    await prisma.coinTransaction.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  console.log(`Cleanup: removed ${ids.length} test user(s) and their coin transactions.`);
}

async function main() {
  const prisma = new PrismaClient();
  const gamification = new GamificationService(prisma as any);
  const leaderboard = new LeaderboardService(prisma as any);
  const economy = new EconomyService(prisma as any);
  const scheduler = new SchedulerService(prisma as any, leaderboard, gamification, economy, {} as any);

  if (process.argv.includes('--cleanup-only')) {
    await cleanup(prisma);
    await prisma.$disconnect();
    return;
  }

  await cleanup(prisma); // start from a clean slate in case a prior run crashed mid-way

  console.log('\n=== Suite A: levelFromStats() thresholds (pure function, boundary values) ===');
  const casesA: Array<{ label: string; total: number; correct: number; expected: UserLevel }> = [
    { label: 'total=0 correct=0 -> BEGINNER', total: 0, correct: 0, expected: UserLevel.BEGINNER },
    { label: 'total=9 correct=0 -> BEGINNER (just below Predictor)', total: 9, correct: 0, expected: UserLevel.BEGINNER },
    { label: 'total=10 correct=0 -> PREDICTOR (Predictor cutoff)', total: 10, correct: 0, expected: UserLevel.PREDICTOR },
    { label: 'total=60 correct=49 -> PREDICTOR (just below Analyst)', total: 60, correct: 49, expected: UserLevel.PREDICTOR },
    { label: 'total=60 correct=50 -> ANALYST (Analyst cutoff)', total: 60, correct: 50, expected: UserLevel.ANALYST },
    { label: 'total=120 correct=99 -> ANALYST (just below Expert)', total: 120, correct: 99, expected: UserLevel.ANALYST },
    { label: 'total=120 correct=100 -> EXPERT (Expert cutoff)', total: 120, correct: 100, expected: UserLevel.EXPERT },
    { label: 'total=500 correct=500 -> EXPERT (well above cutoff)', total: 500, correct: 500, expected: UserLevel.EXPERT },
  ];
  for (const c of casesA) {
    const actual = gamification.levelFromStats({
      totalPredictions: c.total,
      correctPredictions: c.correct,
      level: UserLevel.BEGINNER,
    });
    check(c.label, c.expected, actual);
  }
  console.log('  [PASS-check] CHAMPION/LEGEND never demoted by stats recompute:');
  check(
    'level=CHAMPION, correct=0 -> stays CHAMPION (never demoted by this function)',
    UserLevel.CHAMPION,
    gamification.levelFromStats({ totalPredictions: 0, correctPredictions: 0, level: UserLevel.CHAMPION }),
  );

  console.log('\n=== Suite B: same thresholds, round-tripped through a real DB row ===');
  for (const c of casesA) {
    const email = `${TEST_EMAIL_PREFIX}suiteB-${c.total}-${c.correct}@test.local`;
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Level QA (Suite B)',
        username: email,
        passwordHash: 'x',
        totalPredictions: c.total,
        correctPredictions: c.correct,
        level: UserLevel.BEGINNER,
      },
    });
    const fetched = await prisma.user.findUnique({
      where: { id: user.id },
      select: { totalPredictions: true, correctPredictions: true, level: true },
    });
    const newLevel = gamification.levelFromStats(fetched!);
    await prisma.user.update({ where: { id: user.id }, data: { level: newLevel } });
    const reread = await prisma.user.findUnique({ where: { id: user.id }, select: { level: true } });
    check(`[persisted] ${c.label}`, c.expected, reread!.level);
  }

  console.log('\n=== Suite C: Champion/Legend gating via a real closeMonthly() run ===');
  console.log('  (reproduces the reported bug directly: low-correctPredictions user ranked #1 by coins)');

  const now = new Date();

  // Scenario 1 — the reported bug, reproduced: jimmy-like user, way below
  // Analyst (50 correct), ranked #1 (and top-3) purely on coins. Must NOT
  // be promoted at all.
  const lowCorrect = await prisma.user.create({
    data: {
      email: `${TEST_EMAIL_PREFIX}lowcorrect-topcoins@test.local`,
      name: 'Level QA (low-correct, top coins)',
      username: `${TEST_EMAIL_PREFIX}lowcorrect-topcoins`,
      passwordHash: 'x',
      totalPredictions: 40,
      correctPredictions: 31,
      level: UserLevel.PREDICTOR,
    },
  });
  await prisma.coinTransaction.create({
    data: { userId: lowCorrect.id, type: CoinTxnType.CORRECT_REWARD, amount: 1_000_000, balanceAfter: 1_000_000, createdAt: now },
  });

  // Scenario 2 — legitimately Expert-qualified (>=100 correct), never
  // Champion before, ranked #2 by coins. MUST be promoted to Champion.
  const legitExpert = await prisma.user.create({
    data: {
      email: `${TEST_EMAIL_PREFIX}expert-topcoins@test.local`,
      name: 'Level QA (legit expert, top coins)',
      username: `${TEST_EMAIL_PREFIX}expert-topcoins`,
      passwordHash: 'x',
      totalPredictions: 120,
      correctPredictions: 100,
      level: UserLevel.EXPERT,
    },
  });
  await prisma.coinTransaction.create({
    data: { userId: legitExpert.id, type: CoinTxnType.CORRECT_REWARD, amount: 800_000, balanceAfter: 800_000, createdAt: now },
  });

  // Scenario 3 — already legitimately Champion, 2 prior top-3 finishes
  // already on record, ranked #1 by coins this run (so also top-3). MUST
  // advance to Legend (monthlyTop3Count 2 -> 3).
  const legendTrack = await prisma.user.create({
    data: {
      email: `${TEST_EMAIL_PREFIX}legend-track@test.local`,
      name: 'Level QA (champion, 2 prior top-3s)',
      username: `${TEST_EMAIL_PREFIX}legend-track`,
      passwordHash: 'x',
      totalPredictions: 200,
      correctPredictions: 150,
      level: UserLevel.CHAMPION,
      monthlyTop3Count: 2,
    },
  });
  await prisma.coinTransaction.create({
    data: { userId: legendTrack.id, type: CoinTxnType.CORRECT_REWARD, amount: 1_200_000, balanceAfter: 1_200_000, createdAt: now },
  });

  // The month-close guard is "once per real calendar month" — clear out
  // any snapshot for the current month first so this test run is treated
  // as a fresh close (mirrors first-close-of-the-month in production).
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  await prisma.leaderboardSnapshot.deleteMany({ where: { period: LeaderboardPeriod.MONTHLY, periodKey: monthKey } });

  await scheduler.closeMonthly();

  const [afterLow, afterExpert, afterLegend] = await Promise.all([
    prisma.user.findUnique({ where: { id: lowCorrect.id }, select: { level: true, monthlyTop3Count: true } }),
    prisma.user.findUnique({ where: { id: legitExpert.id }, select: { level: true, monthlyTop3Count: true } }),
    prisma.user.findUnique({ where: { id: legendTrack.id }, select: { level: true, monthlyTop3Count: true } }),
  ]);

  check(
    'BUG REPRO: low-correct (31), top-ranked-by-coins user is NOT promoted',
    UserLevel.PREDICTOR,
    afterLow!.level,
  );
  check('  -> and monthlyTop3Count stays 0 (no invalid credit toward Legend)', 0, afterLow!.monthlyTop3Count);
  check('legit Expert (100 correct), ranked #2, IS promoted to Champion', UserLevel.CHAMPION, afterExpert!.level);
  check('already-Champion + 2 prior top-3s + top-3 this run -> LEGEND', UserLevel.LEGEND, afterLegend!.level);
  check('  -> monthlyTop3Count advances 2 -> 3', 3, afterLegend!.monthlyTop3Count);

  // Clean up the monthly snapshot this test created, so the local DB is
  // left exactly as it was (no real August close happened before this).
  await prisma.leaderboardSnapshot.deleteMany({ where: { period: LeaderboardPeriod.MONTHLY, periodKey: monthKey } });

  await cleanup(prisma);
  await prisma.$disconnect();

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
