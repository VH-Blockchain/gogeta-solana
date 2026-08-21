import { PrismaClient } from '@prisma/client';
import { seedQuiz } from './seed-quiz';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
const prisma = new PrismaClient();

async function main() {
  // ── Levels (SOW §5.5) ──────────────────────────────────────────────
  const levels = [
    { key: 'BEGINNER', label: 'Beginner', criteria: 'Registration', order: 0, minXp: 0 },
    { key: 'PREDICTOR', label: 'Predictor', criteria: '10 Predictions', order: 1, minXp: 500 },
    { key: 'ANALYST', label: 'Analyst', criteria: '50 Correct Predictions', order: 2, minXp: 2000 },
    { key: 'EXPERT', label: 'Expert', criteria: '100 Correct Predictions', order: 3, minXp: 5000 },
    { key: 'CHAMPION', label: 'Champion', criteria: 'Top 10 Monthly', order: 4, minXp: 10000 },
    { key: 'LEGEND', label: 'Legend', criteria: 'Top 3 Monthly (3 Times)', order: 5, minXp: 25000 },
  ] as const;
  for (const l of levels) {
    await prisma.levelDef.upsert({ where: { key: l.key }, update: l, create: l });
  }

  // ── Badges (SOW §5.5) ──────────────────────────────────────────────
  const badges = [
    { key: 'WELCOME', label: 'Welcome', requirement: 'Join Predora', icon: 'waving_hand', accent: 'predictions' },
    { key: 'FIRST_PREDICTION', label: 'First Prediction', requirement: 'Submit first prediction', icon: 'flag', accent: 'profile' },
    { key: 'ACCURACY_MASTER', label: 'Accuracy Master', requirement: '80% accuracy', icon: 'center_focus_strong', accent: 'predictions' },
    { key: 'WINNING_STREAK', label: 'Winning Streak', requirement: '10 correct in a row', icon: 'local_fire_department', accent: 'rewards' },
    { key: 'DAILY_HERO', label: 'Daily Hero', requirement: 'Daily Rank #1', icon: 'bolt', accent: 'rewards' },
    { key: 'WEEKLY_STAR', label: 'Weekly Star', requirement: 'Weekly Rank #1', icon: 'star', accent: 'leaderboard' },
    { key: 'MONTHLY_CHAMPION', label: 'Monthly Champion', requirement: 'Monthly Rank #1', icon: 'emoji_events', accent: 'leaderboard' },
  ] as const;
  for (const b of badges) {
    await prisma.badge.upsert({ where: { key: b.key }, update: b, create: b });
  }

  // ── Categories ─────────────────────────────────────────────────────
  const categories = [
    { key: 'sports', label: 'Sports', icon: 'sports_basketball', accent: 'predictions', sortOrder: 0 },
    { key: 'crypto', label: 'Crypto', icon: 'currency_bitcoin', accent: 'rewards', sortOrder: 1 },
    { key: 'finance', label: 'Finance', icon: 'show_chart', accent: 'rewards', sortOrder: 2 },
    { key: 'entertainment', label: 'Entertainment', icon: 'movie', accent: 'leaderboard', sortOrder: 3 },
    { key: 'esports', label: 'Esports', icon: 'sports_esports', accent: 'leaderboard', sortOrder: 4 },
    { key: 'politics', label: 'Politics', icon: 'how_to_vote', accent: 'profile', sortOrder: 5 },
  ];
  const catByKey: Record<string, string> = {};
  for (const c of categories) {
    const row = await prisma.category.upsert({ where: { key: c.key }, update: c, create: c });
    catByKey[c.key] = row.id;
  }

  // ── Settings (admin-tunable; economy + site) ───────────────────────
  const settings: { key: string; value: unknown }[] = [
    // Reward amounts are 10% of the platform's original values, reduced when
    // paid points were introduced. entryFee is a cost, not a grant, so it is
    // unchanged; dailyLuckyWinners is a count of winners, not points.
    { key: 'economy.signupBonus', value: 100 },
    { key: 'economy.entryFee', value: 50 },
    { key: 'economy.correctReward', value: 10 },
    { key: 'economy.luckyBonus', value: 50 },
    { key: 'economy.dailyLuckyWinners', value: 10 },
    // Buying points with USDC (SPL) on Solana.
    { key: 'economy.usdcToPoints', value: 100 },
    { key: 'economy.pointsPurchaseEnabled', value: true },
    { key: 'economy.pointsMinPurchaseUsdc', value: 1 },
    { key: 'economy.pointsMaxPurchaseUsdc', value: 1000 },
    // Cashing points out.
    { key: 'economy.withdrawalsEnabled', value: true },
    { key: 'economy.minWithdrawalPoints', value: 1000 },
    // Lucky-draw wins are a promotional grant, not something the user paid for
    // or earned by playing, so they are not withdrawable by default.
    { key: 'economy.withdrawableLuckyBonus', value: false },
    { key: 'site.name', value: 'Predora' },
    { key: 'site.tagline', value: 'Predict · Compete · Earn' },
    // AdMob (served to the app via /config → ads). Unit ids default to
    // Google's official TEST units; admin swaps in the client's real ids.
    // NOTE: the AdMob APP id lives in the app binaries (manifest/plist) and
    // needs an app rebuild — only these unit ids are runtime-configurable.
    { key: 'ads.enabled', value: false },
    { key: 'ads.bannerAndroid', value: 'ca-app-pub-3940256099942544/6300978111' },
    { key: 'ads.bannerIos', value: 'ca-app-pub-3940256099942544/2934735716' },
    { key: 'ads.interstitialAndroid', value: 'ca-app-pub-3940256099942544/1033173712' },
    { key: 'ads.interstitialIos', value: 'ca-app-pub-3940256099942544/4411468910' },
    // Full-screen ad shown once every N prediction-result views (0 = never).
    { key: 'ads.interstitialEveryN', value: 2 },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value as object },
      create: { key: s.key, value: s.value as object },
    });
  }

  // ── CMS pages the APP REQUIRES (Terms / Privacy / Help) ────────────
  // These slugs are consumed by the mobile app (register screen + settings).
  // They are seeded as editable PLACEHOLDERS so the app never 404s; the admin
  // then edits the real wording in the admin panel (Settings → CMS). Uses
  // `update: {}` so re-seeding NEVER overwrites content the admin has edited.
  const cmsPages = [
    {
      slug: 'terms',
      title: 'Terms of Service',
      content:
        'These are the Terms of Service for Predora.\n\n'
        + 'This is placeholder content. Please replace it with your finalized Terms '
        + 'of Service from the admin panel (Settings → CMS). Predora uses virtual '
        + 'coins with no real-world monetary value.',
    },
    {
      slug: 'privacy',
      title: 'Privacy Policy',
      content:
        'This is the Privacy Policy for Predora.\n\n'
        + 'This is placeholder content. Please replace it with your finalized Privacy '
        + 'Policy from the admin panel (Settings → CMS), describing what data is '
        + 'collected and how it is used.',
    },
    {
      slug: 'help',
      title: 'Help & Support',
      content:
        'Need help with Predora?\n\n'
        + 'This is placeholder content. Please replace it with your support details '
        + '(FAQs, contact email) from the admin panel (Settings → CMS).',
    },
  ];
  for (const p of cmsPages) {
    await prisma.cmsPage.upsert({
      where: { slug: p.slug },
      update: {}, // never clobber admin-edited content on re-seed
      create: { slug: p.slug, title: p.title, content: p.content, active: true },
    });
  }

  // ── Admin user ─────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: 'admin@gogeta.app' },
    update: {},
    create: {
      email: 'admin@gogeta.app',
      username: '@admin',
      name: 'Gogeta Admin',
      passwordHash: await bcrypt.hash('admin1234', 10),
      role: 'ADMIN',
      isVerified: true,
      coins: 0,
      avatarSeed: 1,
    },
  });

  // ── Sample OPEN predictions ────────────────────────────────────────
  const now = Date.now();
  const hours = (h: number) => new Date(now + h * 3_600_000);
  const samples = [
    {
      cat: 'sports', featured: true, participants: 12420,
      title: 'Will the Falcons win tonight’s final?',
      subtitle: 'Champions League · Final', closesAt: hours(3),
      options: [
        { label: 'Falcons win', odds: 1.85, votes: 58 },
        { label: 'Wolves win', odds: 2.4, votes: 42 },
      ],
    },
    {
      cat: 'crypto', participants: 8430,
      title: 'Will BTC close above $72k today?', subtitle: 'Bitcoin · Daily close', closesAt: hours(6),
      options: [
        { label: 'Yes, above', odds: 1.7, votes: 64 },
        { label: 'No, below', odds: 2.1, votes: 36 },
      ],
    },
    {
      cat: 'esports', participants: 5210,
      title: 'Who takes Map 1 of the Valorant clash?', subtitle: 'VCT · Sentinels vs Fnatic', closesAt: hours(2),
      options: [
        { label: 'Sentinels', odds: 1.95, votes: 49 },
        { label: 'Fnatic', odds: 1.9, votes: 51 },
      ],
    },
    {
      cat: 'finance', participants: 6740,
      title: 'Will the Fed hold rates this meeting?', subtitle: 'Macro · FOMC decision', closesAt: hours(28),
      options: [
        { label: 'Hold', odds: 1.4, votes: 72 },
        { label: 'Cut', odds: 3.0, votes: 28 },
      ],
    },
  ];

  for (const s of samples) {
    const exists = await prisma.prediction.findFirst({ where: { title: s.title } });
    if (exists) continue;
    await prisma.prediction.create({
      data: {
        categoryId: catByKey[s.cat],
        title: s.title,
        subtitle: s.subtitle,
        status: 'OPEN',
        featured: s.featured ?? false,
        participants: s.participants,
        closesAt: s.closesAt,
        options: { create: s.options.map((o, i) => ({ ...o, order: i })) },
      },
    });
  }

  // ── Quiz: question pool + default quiz.* settings ──────────────────
  const quiz = await seedQuiz(prisma);

  // eslint-disable-next-line no-console
  console.log(
    '✅ Seed complete: levels, badges, categories, settings, CMS pages, admin, sample predictions, ' +
      `quiz (${quiz.created} questions created, ${quiz.updated} refreshed)`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
