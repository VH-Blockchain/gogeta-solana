import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:5173';

/**
 * Routes to visit. The portal routes need a session, so the run seeds a token
 * and stubs the API so the pages render with representative data offline.
 */
const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/privacy', '/terms', '/contact'];
const PORTAL_ROUTES = [
  '/dashboard',
  '/predictions',
  '/predictions?tab=active',
  '/predictions?tab=history',
  '/quiz',
  '/quiz?tab=history',
  '/quiz/play/q1',
  '/quiz/result/q1',
  '/points',
  '/leaderboard',
  '/leaderboard/lucky',
  '/rewards',
  '/profile',
  '/notifications',
];

const now = new Date().toISOString();
const soon = new Date(Date.now() + 3 * 3600_000).toISOString();

const USER = {
  id: 'u1', name: 'Ada Lovelace', username: '@ada', email: 'ada@example.com',
  coins: 1450, level: 'ANALYST', xp: 900, totalPredictions: 42, correctPredictions: 30,
  currentStreak: 4, bestStreak: 9, createdAt: now, bio: '', avatarSeed: 2,
};

const OPTION = (id, label, share) => ({ id, label, odds: 1.9, sharePercent: share });

const PREDICTION = (i, extra = {}) => ({
  id: `p${i}`,
  category: { key: 'sports', label: 'Sports', imageUrl: null },
  title: `Will team ${i} win the decider?`,
  subtitle: 'Series decider, tonight',
  options: [OPTION(`p${i}o1`, 'Yes', 64), OPTION(`p${i}o2`, 'No', 36), OPTION(`p${i}o3`, 'Draw', 12), OPTION(`p${i}o4`, 'Abandoned', 4)],
  entryFee: 50, reward: 100, closesAt: soon, participants: 8100 + i,
  status: 'OPEN', featured: i % 2 === 0, info: 'Resolved from the official scorecard. '.repeat(12),
  ...extra,
});

const ENTRY = (rank) => ({
  userId: rank === 3 ? 'u1' : `u${rank}`, rank, name: `Player ${rank}`,
  username: `@player${rank}`, score: 900 - rank * 10, coins: 4200 - rank * 100,
  accuracy: 0.8 - rank * 0.02, avatarSeed: rank,
});

const ROUTES = {
  '/config': {
    economy: { signupBonus: 1000, entryFee: 50, correctReward: 100, luckyBonus: 500, dailyLuckyWinners: 10 },
    premium: { monthlyPrice: '$4.99', yearlyPrice: '$39.99', trialDays: 7, perks: [] },
    app: { version: '1.0.0', supportEmail: 'support@gogeta.app' },
    site: { name: 'GOGETA', tagline: 'Predict. Compete. Prove', contactEmail: 'hello@yesiki.com',
            social: { facebook: 'https://fb.com/gogeta', twitter: '', instagram: '', website: '' } },
    luckyDraw: { enabled: true, label: 'Lucky Draw', tagline: 'See if you won today.' },
    categories: [{ key: 'sports' }, { key: 'crypto' }],
    predictionList: {},
  },
  '/categories': [
    { key: 'sports', label: 'Sports', icon: 'sports_basketball', accent: 'predictions' },
    { key: 'crypto', label: 'Crypto', icon: 'currency_bitcoin', accent: 'rewards' },
    { key: 'music', label: 'Music', icon: 'music_note', accent: 'leaderboard' },
  ],
  '/users/me': USER,
  '/users/me/stats': { globalRank: 12 },
  '/users/me/badges': [
    { key: 'WELCOME', earned: true, progress: 1 },
    { key: 'FIRST_PREDICTION', earned: true, progress: 1 },
    { key: 'ACCURACY_MASTER', earned: false, progress: 0.55 },
    { key: 'WINNING_STREAK', earned: false, progress: 0.4 },
    { key: 'DAILY_HERO', earned: false, progress: 0 },
    { key: 'WEEKLY_STAR', earned: false, progress: 0 },
    { key: 'MONTHLY_CHAMPION', earned: false, progress: 0 },
  ],
  '/users/me/trends': { coinTrend: [10, 40, 30, 80, 60, 120, 90, 140], accuracyTrend: [40, 44, 52, 49, 61, 58, 66, 71], coinDelta: 140, accuracyDelta: -3 },
  '/predictions': { items: [1, 2, 3, 4, 5, 6].map((i) => PREDICTION(i)), total: 34, categoryCounts: { sports: 21, crypto: 9, music: 4 } },
  '/predictions/mine/active': [PREDICTION(7, { mySelectedOptionId: 'p7o1', entryStatus: 'LOCKED' })],
  '/predictions/mine/history': {
    items: [
      PREDICTION(8, { mySelectedOptionId: 'p8o1', correctOptionId: 'p8o1', entryStatus: 'WON' }),
      PREDICTION(9, { mySelectedOptionId: 'p9o2', correctOptionId: 'p9o1', entryStatus: 'LOST' }),
    ],
    summary: { total: 42, won: 30, lost: 12, accuracy: 0.71 },
  },
  '/leaderboard': { entries: [1, 2, 3, 4, 5].map(ENTRY), me: ENTRY(3) },
  '/leaderboard/lucky-winners/today': { winners: [
    { rank: 1, name: 'Player 1', username: '@player1', amount: 500, avatarSeed: 1, isCurrentUser: false },
    { rank: 2, name: 'Ada Lovelace', username: '@ada', amount: 500, avatarSeed: 2, isCurrentUser: true },
  ] },
  '/rewards/summary': { balance: 1450, earnedTotal: 5200, thisWeek: 340, luckyWins: 2, recent: [
    { id: 't1', type: 'CORRECT_REWARD', amount: 100, createdAt: now },
    { id: 't2', type: 'ENTRY_FEE', amount: -50, createdAt: now },
    { id: 't3', type: 'SIGNUP_BONUS', amount: 1000, createdAt: now },
  ] },
  '/rewards/transactions': [
    { id: 't1', type: 'CORRECT_REWARD', amount: 100, createdAt: now },
    { id: 't2', type: 'ENTRY_FEE', amount: -50, createdAt: now },
  ],
  '/notifications': [
    { id: 'n1', type: 'RESULT', title: 'You called it', body: 'Your pick on the decider was correct.', createdAt: now, read: false },
    { id: 'n2', type: 'LUCKY', title: 'Daily draw', body: 'You are one of today\'s lucky winners.', createdAt: now, read: true },
    { id: 'n3', type: 'BADGE', title: 'Badge unlocked', body: 'First Prediction earned.', createdAt: now, read: true },
  ],
  '/cms/privacy': { slug: 'privacy', title: 'Privacy Policy', content: '<h2>Data we store</h2><p>Only what the game needs.</p><ul><li>Your email</li><li>Your predictions</li></ul>' },
  '/cms/terms': { slug: 'terms', title: 'Terms of Use', content: '<h2>Fair play</h2><p>Points only, no real money.</p>' },
};

function stubFor(pathname) {
  if (ROUTES[pathname] !== undefined) return ROUTES[pathname];
  if (pathname.startsWith('/predictions/') && pathname.endsWith('/submit')) return { ok: true, balance: 1400 };
  if (pathname.startsWith('/notifications/')) return {};
  if (pathname === '/users/me/device-token') return {};
  return null;
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1440, height: 900 },
});

const problems = [];
const missed = new Set();

async function visit(route, { authed }) {
  const page = await browser.newPage();
  const seen = [];

  page.on('console', (m) => {
    // noisily in dev; those are third-party network facts, not page defects, and
    // without this filter every route "fails" on them. Same exclusion the
    // func5–func7 suites use.
    if (
      (m.type() === 'error' || m.type() === 'warning') &&
      // Firebase and the Meta Pixel are the only third parties left that log in
      // dev; the wallet adapter is quiet until a wallet is actually selected.
      true
    ) {
      seen.push(`${m.type()}: ${m.text()}`);
    }
  });
  page.on('pageerror', (e) => seen.push(`pageerror: ${e.message}`));

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    // Only cross-origin /api/ URLs are backend calls — Vite dev-serves the app's
    // own modules from paths that also contain "/api/" (src/data/api/*).
    if (!url.startsWith(BASE) && url.includes('/api/')) {
      const CORS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': '*',
      };
      // The stub is cross-origin, so the browser preflights anything with an
      // Authorization header.
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS, body: '' });
      const pathname = new URL(url).pathname.replace(/^\/api/, '');
      const body = stubFor(pathname);
      if (body !== null) {
        return req.respond({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(body) });
      }
      missed.add(`${req.method()} ${pathname}`);
      return req.respond({ status: 404, headers: CORS, contentType: 'application/json', body: '{"message":"stub miss"}' });
    }
    // Block third-party beacons (Meta Pixel, Firebase) — offline in this run.
    if (!url.startsWith(BASE)) return req.respond({ status: 204, body: '' });
    return req.continue();
  });

  if (authed) {
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('gogeta_jwt', 'smoke-token');
    });
  }

  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));

  const info = await page.evaluate(() => ({
    rootChildren: document.getElementById('root')?.childElementCount ?? 0,
    text: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 180),
    bodyScrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));

  // Ignore noise we deliberately caused by blocking third-party requests.
  const real = seen.filter((s) =>
    !/fbevents|connect\.facebook|firebase|Failed to load resource|net::ERR|ERR_BLOCKED|Messaging|service worker|ServiceWorker|preloaded using link preload/i.test(s),
  );

  if (info.rootChildren === 0) real.push('root rendered nothing');
  if (info.text.length < 5) real.push('page has no visible text');
  if (info.bodyScrollW > info.clientW + 1) real.push(`horizontal overflow: scrollWidth ${info.bodyScrollW} > clientWidth ${info.clientW}`);

  if (real.length) problems.push({ route, authed, issues: [...new Set(real)] });
  console.log(`${real.length ? 'FAIL' : ' ok '}  ${authed ? '[auth] ' : '[pub]  '}${route}  — "${info.text.slice(0, 70)}"`);

  await page.close();
}

for (const r of PUBLIC_ROUTES) await visit(r, { authed: false });
for (const r of PORTAL_ROUTES) await visit(r, { authed: true });

await browser.close();

if (missed.size) {
  console.log('\n---- unstubbed API calls (harness gaps, not app bugs) ----');
  for (const m of missed) console.log('   ?', m);
}

console.log('\n================ PROBLEMS ================');
if (problems.length === 0) console.log('none');
for (const p of problems) {
  console.log(`\n${p.authed ? '[auth] ' : '[pub] '}${p.route}`);
  for (const i of p.issues) console.log(`   • ${i}`);
}
process.exit(problems.length ? 1 : 0);
