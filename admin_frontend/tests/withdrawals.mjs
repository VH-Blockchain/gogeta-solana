import puppeteer from 'puppeteer-core';

/**
 * Admin Withdrawals page, including the wallet payout flow.
 *
 * Runs against the dev server on :3000 (override with ADMIN_BASE) with the API stubbed, so the assertions
 * do not depend on what happens to be in the database and the treasury list can
 * be varied per scenario. Signing an actual transfer needs a real wallet, so
 * what this guards is everything the panel decides on its own: whether the
 * payout button is offered, and whether it is blocked when it should be.
 */
const BASE = process.env.ADMIN_BASE ?? 'http://localhost:3000';
const results = [];
const check = (n, p, d = '') => {
  results.push({ n, p, d });
  console.log(`${p ? ' ok ' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`);
};
const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms));

const ADMIN = { id: 'a1', name: 'Root Admin', email: 'admin@gogeta.app', role: 'ADMIN' };

const TREASURY = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

const ROW = (over = {}) => ({
  id: 'w1',
  user: { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com', username: '@ada', coins: 5500 },
  walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  points: 2000,
  amount: '20',
  amountRaw: '20000000',
  exchangeRate: 100,
  network: 'devnet',
  networkName: 'Solana Devnet',
  tokenMint: USDC,
  tokenSymbol: 'USDC',
  tokenDecimals: 6,
  status: 'APPROVED',
  reserved: true,
  userNote: null,
  adminNote: null,
  transactionSignature: null,
  explorerUrl: null,
  blockNumber: null,
  adminId: 'a1',
  createdAt: new Date().toISOString(),
  approvedAt: new Date().toISOString(),
  rejectedAt: null,
  completedAt: null,
  ...over,
});

const STATUS = (over = {}) => ({
  enabled: true,
  adminEnabled: true,
  configError: null,
  rpcReachable: true,
  rpcNetwork: 'devnet',
  networkMatches: true,
  network: {
    networkName: 'Solana Devnet',
    tokenMint: USDC,
    treasuryAddresses: [TREASURY],
    tokenSymbol: 'USDC',
    tokenDecimals: 6,
    treasuryAddress: TREASURY,
    treasuryAddresses: [TREASURY],
  },
  rules: { pointsPerToken: 100, minWithdrawalPoints: 1000, luckyBonusWithdrawable: false },
  ...over,
});

const routes = (over = {}) => ({
  '/users/me': ADMIN,
  '/admin/withdrawals/status': STATUS(),
  '/admin/withdrawals': {
    total: 1,
    skip: 0,
    take: 25,
    statusCounts: { APPROVED: 1 },
    totals: {
      completedRequests: 0,
      pointsPaid: 0,
      amountPaid: '0',
      openRequests: 1,
      pointsReserved: 2000,
      amountReserved: '20',
      tokenSymbol: 'USDC',
    },
    items: [ROW()],
  },
  '/admin/withdrawals/w1': {
    ...ROW(),
    coinTransaction: null,
    userAvailability: {
      totalPoints: 5500,
      withdrawablePoints: 3500,
      reservedPoints: 2000,
      availableToWithdraw: 1500,
    },
  },
  ...over,
});

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

async function scenario(over = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1600, height: 1200 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (
      m.type() === 'error' &&
      !/CORS|net::ERR|Failed to load|Lit is in dev mode|fonts\./i.test(m.text())
    ) {
      errors.push(m.text());
    }
  });

  const table = routes(over);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(BASE) && url.includes('/api/')) {
      const CORS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': '*',
      };
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS, body: '' });
      const path = new URL(url).pathname.replace(/^\/api/, '');
      const body = path in table ? table[path] : null;
      return req.respond({
        status: body === null ? 404 : 200,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify(body ?? { message: 'stub miss' }),
      });
    }
    // Block third-party wallet/relay traffic — offline in this run.
    if (!url.startsWith(BASE)) return req.respond({ status: 204, body: '' });
    return req.continue();
  });

  await page.evaluateOnNewDocument(() =>
    localStorage.setItem('gogeta_admin_token', 'test-token'),
  );
  return { ctx, page, errors };
}

const txt = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
const clickText = (page, label) =>
  page.evaluate((label) => {
    const el = [...document.querySelectorAll('button')].find((e) =>
      e.textContent.trim().startsWith(label),
    );
    if (el) {
      el.click();
      return true;
    }
    return false;
  }, label);

// ---------------------------------------------------------------------------
// A. The treasury wallet card
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/withdrawals`, { waitUntil: 'networkidle2' });
  await settle(2500);

  const body = await txt(page);
  check('the page loads with a Withdrawals heading', /Withdrawals/.test(body), body.slice(0, 120));
  check('a treasury wallet card is shown', /Treasury wallet/i.test(body), body.slice(0, 300));
  check(
    'with no wallet connected it says so and offers to connect',
    /Not connected/i.test(body) && /Connect wallet/i.test(body),
    body.slice(0, 400),
  );
  check(
    'the withdrawal row is listed',
    /Ada Lovelace/.test(body) && /2,000/.test(body) && /APPROVED/.test(body),
    body.slice(0, 400),
  );
  check('page: no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// B. The payout step, with no wallet connected
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/withdrawals`, { waitUntil: 'networkidle2' });
  await settle(2500);

  // Open the request, then the payout step.
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('tbody tr')][0];
    if (row) row.click();
  });
  await settle(1400);
  let body = await txt(page);
  check('clicking a row opens the detail modal', /Request ID/i.test(body), body.slice(0, 200));
  check(
    'an approved request offers a Send payout action',
    /Send payout/i.test(body),
    body.slice(-400),
  );

  check('the payout step opens', await clickText(page, '$ Send payout'));
  await settle(900);
  body = await txt(page);
  check(
    'it names the exact amount and recipient',
    /Pay 20 USDC to 7xKXtg2C/.test(body),
    body.slice(body.indexOf('Pay 20'), body.indexOf('Pay 20') + 120),
  );
  check(
    'it explains the backend re-verifies the transfer',
    /re-reads the transfer from the chain/i.test(body),
    body.slice(-500),
  );
  check(
    'with no wallet it offers to connect rather than to send',
    /No wallet connected/i.test(body),
    body.slice(-500),
  );
  check(
    'the manual hash path is still available',
    /Settle a payout already sent/i.test(body) && /Payout transaction hash/i.test(body),
    body.slice(-400),
  );
  // Nothing can be settled from an empty hash field.
  const verifyDisabled = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((e) =>
      e.textContent.trim().startsWith('Verify & complete'),
    );
    return b ? b.disabled : null;
  });
  check('"Verify & complete" is disabled with no hash', verifyDisabled === true, `disabled=${verifyDisabled}`);
  check('payout step: no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// C. The treasury bar always offers a way to connect
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/withdrawals`, { waitUntil: 'networkidle2' });
  await settle(2500);
  const body = await txt(page);
  // The Solana wallet adapter needs no project id or third-party service, so
  // there is no "unconfigured" branch any more — the bar is always connectable
  // and names the cluster before an admin commits to signing anything.
  check('the treasury bar offers a connect action', /Connect wallet/i.test(body), body.slice(0, 160));
  check('the treasury bar names the cluster', /Solana Devnet/i.test(body), body.slice(0, 200));
  check('no Arc copy remains', !/Arc Testnet/i.test(body));
  check('config state: no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// D. Status flow — a completed request offers no payout
// ---------------------------------------------------------------------------
{
  const done = {
    ...ROW({
      status: 'COMPLETED',
      reserved: false,
      transactionSignature: '4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444',
      explorerUrl: 'https://explorer.solana.com/tx/4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444?cluster=devnet',
      completedAt: new Date().toISOString(),
    }),
    coinTransaction: {
      id: 'ct1',
      amount: -2000,
      balanceAfter: 3500,
      createdAt: new Date().toISOString(),
      description: 'Withdrawal to 7xKX…gAsU',
    },
    userAvailability: {
      totalPoints: 3500,
      withdrawablePoints: 1500,
      reservedPoints: 0,
      availableToWithdraw: 1500,
    },
  };
  const { ctx, page, errors } = await scenario({ '/admin/withdrawals/w1': done });
  await page.goto(`${BASE}/withdrawals`, { waitUntil: 'networkidle2' });
  await settle(2500);
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('tbody tr')][0];
    if (row) row.click();
  });
  await settle(1400);

  const body = await txt(page);
  check('a completed request says it is settled', /no further action is possible/i.test(body), body.slice(-400));
  check('a completed request offers no payout action', !/Send payout/i.test(body), body.slice(-400));
  check('the debit ledger row is shown', /Withdrawal to 7xKX/.test(body) && /-2,000|−2,000/.test(body), body.slice(-500));
  check('completed: no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// E. An unset treasury reports itself instead of inviting a payout
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario({
    '/admin/withdrawals/status': STATUS({
      enabled: false,
      configError:
        'WITHDRAWAL_TREASURY_ADDRESS is not configured, so payouts cannot be verified yet.',
      network: { ...STATUS().network, treasuryAddress: '', treasuryAddresses: [] },
    }),
  });
  await page.goto(`${BASE}/withdrawals`, { waitUntil: 'networkidle2' });
  await settle(2500);
  const body = await txt(page);
  check(
    'an unset treasury is reported at the top of the page',
    /Withdrawals unavailable/i.test(body) && /WITHDRAWAL_TREASURY_ADDRESS is not configured/.test(body),
    body.slice(0, 500),
  );
  check('unset treasury: no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();

const passed = results.filter((r) => r.p).length;
console.log(`\n================ ${passed}/${results.length} passed ================`);
const failed = results.filter((r) => !r.p);
if (failed.length) {
  console.log('\nFAILURES:');
  for (const f of failed) console.log(`  ${f.n}${f.d ? `  — ${f.d}` : ''}`);
  process.exit(1);
}
