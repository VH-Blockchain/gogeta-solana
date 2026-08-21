export const BASE = process.env.PORTAL_BASE ?? 'http://localhost:5173';

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
  status: 'OPEN', featured: i % 2 === 0,
  info: 'Resolved from the official scorecard published after the match. '.repeat(10),
  ...extra,
});

const ENTRY = (rank) => ({
  userId: rank === 4 ? 'u1' : `u${rank}`, rank, name: `Player ${rank}`,
  username: `@player${rank}`, score: 900 - rank * 10, coins: 4200 - rank * 100,
  accuracy: 0.8 - rank * 0.02, avatarSeed: rank,
});

// ---- Quiz ----------------------------------------------------------------
// `serverNow` and the slot boundaries are generated relative to load time, so
// the countdowns and phase transitions behave as they would against a live
// backend. QUIZ_SOON sits far enough out that the lobby stays in its
// "scheduled" state for the whole run.
const QUIZ_SOON = new Date(Date.now() + 8 * 60_000).toISOString();
const QUIZ_SOON_END = new Date(Date.now() + 8 * 60_000 + 50_000).toISOString();

const QUIZ_RULES = {
  entryPoints: 50, rewardPoints: 100, winPercent: 50, questionsPerQuiz: 5,
  secondsPerQuestion: 10, durationSeconds: 50, cycleSeconds: 900, enabled: true,
};

const QUIZ_CATEGORY = (key, label, questionCount, joinedNext = false) => ({
  key, label, questionCount, joinedNext,
});

const QUIZ_SESSION = {
  id: 'q1', category: 'SPORTS', categoryLabel: 'Sports', slotIndex: 4242,
  phase: 'scheduled', startsAt: QUIZ_SOON, endsAt: QUIZ_SOON_END, startsInMs: 8 * 60_000,
  entryPoints: 50, rewardPoints: 100, winPercent: 50, secondsPerQuestion: 10, totalQuestions: 5,
};

const QUIZ_REVIEW = (index, isCorrect) => ({
  index, number: index + 1,
  question: `Sample quiz question ${index + 1}?`,
  options: ['First option', 'Second option', 'Third option', 'Fourth option'],
  correctIndex: 1,
  selectedIndex: isCorrect ? 1 : 2,
  answered: true,
  isCorrect,
  explanation: `Because the second option is the documented answer for ${index + 1}.`,
});

const QUIZ_RESULT = {
  quiz: { id: 'q1', category: 'SPORTS', categoryLabel: 'Sports', slotIndex: 4242,
          startsAt: QUIZ_SOON, endsAt: QUIZ_SOON_END, winPercent: 50 },
  summary: {
    totalQuestions: 5, correctAnswers: 4, wrongAnswers: 1, unanswered: 0,
    score: 4, percentage: 80, pointsSpent: 50, pointsEarned: 100, netPoints: 50,
    result: 'WON', won: true, joinedAt: now, completedAt: now,
  },
  questions: [0, 1, 2, 3].map((i) => QUIZ_REVIEW(i, true)).concat([QUIZ_REVIEW(4, false)]),
};

const QUIZ_HISTORY_ITEM = (i, won) => ({
  id: `qp${i}`, quizId: `q${i}`, slotIndex: 4200 + i,
  category: won ? 'SPORTS' : 'POLITICS', categoryLabel: won ? 'Sports' : 'Politics',
  playedAt: new Date(Date.now() - i * 3600_000).toISOString(),
  totalQuestions: 5, correctAnswers: won ? 4 : 1, wrongAnswers: won ? 1 : 4, unanswered: 0,
  score: won ? 4 : 1, percentage: won ? 80 : 20,
  pointsSpent: 50, pointsEarned: won ? 100 : 0, netPoints: won ? 50 : -50,
  result: won ? 'WON' : 'LOST', won, settled: true,
});

/** Deterministic 88-char base58 signature for row `i` — realistic shape so the
 *  UI's own base58 validation exercises the same path it will in production. */
const sig = (i) => `${'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[i % 56]}`.repeat(88).slice(0, 88);

// ---- Points purchases (USDC SPL on Solana devnet) --------------------------
// Shapes mirror the backend's publicChainConfig(): cluster moniker + human
// label, an SPL mint rather than a contract address, and no chain id.
const SOLANA_NETWORK = {
  network: 'devnet',
  networkName: 'Solana Devnet',
  rpcUrl: 'https://api.devnet.solana.com',
  explorerUrl: 'https://explorer.solana.com',
  usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  usdcDecimals: 6,
  receiverAddress: '5f6tPhiPGc16snPtTsGEEDRLmoay1t8ay2eK1GcNxRmx',
};

// ---- Withdrawals ---------------------------------------------------------
// Numbers chosen to match new_features.md §28's worked example: a 5,500-point
// balance of which 3,500 is withdrawable and 1,000 already reserved, leaving
// 2,500 available.
const WITHDRAWAL_NETWORK = {
  network: 'devnet',
  networkName: 'Solana Devnet',
  tokenMint: SOLANA_NETWORK.usdcMint,
  tokenSymbol: 'USDC',
  tokenDecimals: 6,
  treasuryAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  treasuryAddresses: ['9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'],
};

const WITHDRAWAL = (i, status, points, amount, extra = {}) => ({
  id: `wd${i}`,
  walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  points,
  amount,
  amountRaw: String(Math.round(Number(amount) * 1e6)),
  exchangeRate: 100,
  network: 'devnet',
  networkName: 'Solana Devnet',
  tokenMint: WITHDRAWAL_NETWORK.tokenMint,
  tokenSymbol: 'USDC',
  tokenDecimals: 6,
  status,
  reserved: ['PENDING', 'APPROVED', 'PROCESSING'].includes(status),
  userNote: null,
  adminNote: status === 'REJECTED' ? 'Wallet could not be verified.' : null,
  transactionSignature: status === 'COMPLETED' ? sig(i) : null,
  explorerUrl:
    status === 'COMPLETED'
      ? `${SOLANA_NETWORK.explorerUrl}/tx/${sig(i)}?cluster=devnet`
      : null,
  blockNumber: null,
  createdAt: now,
  approvedAt: null,
  rejectedAt: status === 'REJECTED' ? now : null,
  completedAt: status === 'COMPLETED' ? now : null,
  ...extra,
});

const WITHDRAWAL_AVAILABLE = {
  totalPoints: 5500,
  withdrawablePoints: 3500,
  reservedPoints: 1000,
  availableToWithdraw: 2500,
  minimumWithdrawal: 1000,
  pointsPerToken: 100,
  openRequests: 1,
  canWithdraw: true,
  enabled: true,
  unavailableReason: null,
  previewAmount: '25',
  network: WITHDRAWAL_NETWORK,
  withdrawableSources: ['POINT_PURCHASE', 'CORRECT_REWARD', 'QUIZ_REWARD'],
};

const PURCHASE = (i, status, points, usdc) => ({
  id: `pp${i}`,
  walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  usdcAmount: usdc,
  usdcAmountRaw: String(Math.round(Number(usdc) * 1e6)),
  points,
  exchangeRate: 100,
    networkName: 'Solana Devnet',
  tokenMint: SOLANA_NETWORK.usdcMint,
  receiverAddress: SOLANA_NETWORK.receiverAddress,
  transactionSignature: status === 'CONFIRMED' ? sig(i) : null,
  explorerUrl: status === 'CONFIRMED' ? `${SOLANA_NETWORK.explorerUrl}/tx/${sig(i)}?cluster=devnet` : null,
  status,
  failureReason: status === 'FAILED' ? 'Payment verification failed.' : null,
  blockNumber: status === 'CONFIRMED' ? '12345' : null,
  createdAt: now,
  completedAt: status === 'CONFIRMED' ? now : null,
  expiresAt: soon,
});

const ROUTES = {
  '/config': {
    economy: { signupBonus: 1000, entryFee: 50, correctReward: 100, luckyBonus: 500, dailyLuckyWinners: 10 },
    premium: {}, app: { version: '1.0.0' },
    site: { name: 'GOGETA', tagline: 'Predict. Compete. Prove', contactEmail: 'hello@yesiki.com',
            social: { facebook: 'https://fb.com/gogeta', twitter: '', instagram: '', website: '' } },
    luckyDraw: { enabled: true, label: 'Lucky Draw', tagline: 'See if you won today.' },
    categories: [{ key: 'sports' }, { key: 'crypto' }], predictionList: {},
  },
  '/categories': [
    { key: 'sports', label: 'Sports', icon: 'sports_basketball', accent: 'predictions' },
    { key: 'crypto', label: 'Crypto', icon: 'currency_bitcoin', accent: 'rewards' },
    { key: 'music', label: 'Music', icon: 'music_note', accent: 'leaderboard' },
  ],
  '/auth/login': { token: 'smoke-token', user: USER },
  '/auth/verify-otp': { token: 'smoke-token', user: USER },
  '/auth/register': { email: 'ada@example.com', name: 'Ada Lovelace', otpExpiresAt: new Date(Date.now() + 300_000).toISOString(), otp: '1234' },
  '/auth/resend-otp': { otpExpiresAt: new Date(Date.now() + 300_000).toISOString(), otp: '1234' },
  '/auth/forgot-password': { otp: '1234' },
  '/auth/verify-reset-code': {},
  '/auth/reset-password': {},
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
  '/leaderboard': { entries: [1, 2, 3, 4, 5].map(ENTRY), me: ENTRY(4) },
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
    { id: 'n2', type: 'LUCKY', title: 'Daily draw', body: "You are one of today's lucky winners.", createdAt: now, read: true },
    { id: 'n3', type: 'BADGE', title: 'Badge unlocked', body: 'First Prediction earned.', createdAt: now, read: true },
  ],
  '/cms/privacy': { slug: 'privacy', title: 'Privacy Policy', content:
    '<h2>Data we store</h2><p>Only what the game needs.</p>'
    + '<ul><li>Your email address</li><li>Your predictions and results</li><li>Your points ledger</li></ul>'
    + Array.from({ length: 14 }, (_, i) => `<h3>Section ${i + 1}</h3><p>${'Policy detail text that runs to a realistic length. '.repeat(6)}</p>`).join('') },
  '/quiz/categories': {
    serverNow: new Date().toISOString(),
    config: QUIZ_RULES,
    nextQuiz: { slotIndex: 4242, startsAt: QUIZ_SOON, endsAt: QUIZ_SOON_END, opensInMs: 8 * 60_000 },
    categories: [
      QUIZ_CATEGORY('POLITICS', 'Politics', 50),
      QUIZ_CATEGORY('SPORTS', 'Sports', 50),
      QUIZ_CATEGORY('ENTERTAINMENT', 'Entertainment', 50),
      QUIZ_CATEGORY('GENERAL_KNOWLEDGE', 'General Knowledge', 50),
    ],
  },
  '/quiz/current': { serverNow: new Date().toISOString(), active: null },
  '/quiz/next': { serverNow: new Date().toISOString(), quiz: QUIZ_SESSION, joined: false, participation: null },
  '/quiz/history': {
    total: 3, skip: 0, take: 20,
    items: [QUIZ_HISTORY_ITEM(1, true), QUIZ_HISTORY_ITEM(2, false), QUIZ_HISTORY_ITEM(3, true)],
  },
  '/points/purchase-config': {
    enabled: true,
    unavailableReason: null,
    network: SOLANA_NETWORK,
    rate: { usdcToPoints: 100, minUsdc: 1, maxUsdc: 1000 },
  },
  '/points/balance': { balance: 1450, purchasedPoints: 1500, usdcSpent: '15.000000' },
  '/points/purchases': {
    total: 2,
    skip: 0,
    take: 20,
    totals: { pointsPurchased: 1500, usdcSpent: '15.000000' },
    items: [PURCHASE(1, 'CONFIRMED', 1000, '10'), PURCHASE(2, 'CONFIRMED', 500, '5')],
  },
  '/withdrawals/available': WITHDRAWAL_AVAILABLE,
  '/withdrawals': {
    total: 3,
    skip: 0,
    take: 10,
    totals: { pointsWithdrawn: 2000, amountPaid: '20', tokenSymbol: 'USDC' },
    items: [
      WITHDRAWAL(1, 'PENDING', 1000, '10'),
      WITHDRAWAL(2, 'COMPLETED', 2000, '20'),
      WITHDRAWAL(3, 'REJECTED', 1500, '15'),
    ],
  },
  '/cms/terms': { slug: 'terms', title: 'Terms of Use', content: '<h2>Fair play</h2><p>Points only, no real money.</p>' },
};

function stubFor(pathname, method = 'GET') {
  if (pathname === '/withdrawals' && method === 'POST') return WITHDRAWAL(9, 'PENDING', 2000, '20');
  if (ROUTES[pathname] !== undefined) return ROUTES[pathname];
  if (pathname.startsWith('/predictions/') && pathname.endsWith('/submit')) return { ok: true, balance: 1400 };
  if (pathname.startsWith('/quiz/') && pathname.endsWith('/join')) {
    return { ok: true, balance: 1400, participation: { id: 'qp1', quizId: 'q1', entryPoints: 50, joinedAt: now }, quiz: QUIZ_SESSION };
  }
  if (pathname.startsWith('/quiz/') && pathname.endsWith('/result')) return QUIZ_RESULT;
  if (pathname.startsWith('/quiz/history/')) return QUIZ_RESULT;
  if (pathname.startsWith('/withdrawals/') && pathname.endsWith('/cancel')) {
    return WITHDRAWAL(1, 'CANCELLED', 1000, '10');
  }
  // A scheduled session serves no question yet — exactly what the real endpoint
  // returns before the window opens.
  if (pathname.startsWith('/quiz/') && pathname.endsWith('/question')) {
    return { serverNow: new Date().toISOString(), phase: 'scheduled', startsInMs: 8 * 60_000, question: null };
  }
  if (pathname.startsWith('/notifications/')) return {};
  if (pathname === '/users/me/device-token') return {};
  return null;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

/**
 * @param overrides optional `{ [pathname]: body }` map merged over ROUTES for
 *   this page only — lets one suite vary a single response (a balance below the
 *   quiz entry fee, say) without duplicating the whole fixture set.
 */
export async function stub(page, overrides = {}) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    // Only cross-origin /api/ URLs are backend calls — Vite dev-serves the app's
    // own modules from paths that also contain "/api/".
    if (!url.startsWith(BASE) && url.includes('/api/')) {
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS, body: '' });
      const pathname = new URL(url).pathname.replace(/^\/api/, '');
      const body = pathname in overrides ? overrides[pathname] : stubFor(pathname, req.method());
      return req.respond({
        status: body === null ? 404 : 200,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify(body ?? { message: 'stub miss' }),
      });
    }
    if (!url.startsWith(BASE)) return req.respond({ status: 204, body: '' });
    return req.continue();
  });
}
