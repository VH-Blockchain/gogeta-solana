import puppeteer from 'puppeteer-core';
import { stub, BASE } from './stubs.mjs';

/**
 * Withdrawals (new_features.md §1, §3, §4, §14, §28, §29) against the stubbed
 * backend.
 *
 * Filing a real request needs a connected wallet, which no headless browser has,
 * so the submit path itself is verified against the live backend separately.
 * What this suite guards is everything the frontend owns alone: the four
 * eligibility figures, the minimum, the live conversion arithmetic, the
 * destination-wallet gate, the history statuses, and the disabled states.
 */

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

const results = [];
const check = (n, p, d = '') => {
  results.push({ n, p, d });
  console.log(`${p ? ' ok ' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`);
};
const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms));

async function scenario({ width = 1440, height = 1200, overrides = {} } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width, height });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (
      m.type() === 'error' &&
      !/CORS|net::ERR|Failed to load|fbevents|firebase/i.test(
        m.text(),
      )
    ) {
      errors.push(m.text());
    }
  });
  await stub(page, overrides);
  await page.evaluateOnNewDocument(() => localStorage.setItem('gogeta_jwt', 'smoke-token'));
  return { ctx, page, errors };
}

const txt = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

const clickText = (page, label) =>
  page.evaluate((label) => {
    const el = [...document.querySelectorAll('button')].find(
      (e) => e.textContent.trim() === label,
    );
    if (el) {
      el.click();
      return true;
    }
    return false;
  }, label);

/** The dialog's own text, so a match cannot come from the page behind it. */
const dialogText = (page) =>
  page.evaluate(() => {
    const d = document.querySelector('[aria-labelledby="withdraw-title"]');
    return d ? d.innerText.replace(/\s+/g, ' ') : '';
  });

const setPoints = (page, value) =>
  page.evaluate((v) => {
    const i = document.querySelector('#withdraw-points');
    if (!i) return false;
    const d = Object.getOwnPropertyDescriptor(i.constructor.prototype, 'value');
    d.set.call(i, v);
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, value);

const openDialog = async (page) => {
  const ok = await clickText(page, 'Withdraw');
  await settle(700);
  return ok;
};

// ---------------------------------------------------------------------------
// A. §28 — the four figures, on the profile
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle2' });
  await settle(1800);

  const body = await txt(page);
  check('profile: a Points & withdrawals section exists', /Points & withdrawals/i.test(body));
  for (const [label, value] of [
    ['Total points', '5,500'],
    ['Withdrawable points', '3,500'],
    ['Reserved for withdrawal', '1,000'],
    ['Available to withdraw', '2,500'],
  ]) {
    // Label and figure must appear together — a right number under the wrong
    // label is the failure this is actually guarding against.
    const paired = await page.evaluate(
      ([l, v]) =>
        [...document.querySelectorAll('*')].some((el) => {
          if (el.children.length > 4) return false;
          const t = (el.innerText || '').replace(/\s+/g, ' ');
          return t.includes(l) && t.includes(v);
        }),
      [label, value],
    );
    check(`§28: "${label}" shows ${value}`, paired, body.slice(0, 200));
  }
  check('§28: the Withdraw button is on the profile', /Withdraw/.test(body));
  check(
    '§28: the eligibility rule is explained',
    /Signup and bonus points cannot/i.test(body),
    body.slice(0, 200),
  );
  check('profile: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// B. §4 — the modal, and the live conversion
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle2' });
  await settle(1800);

  check('§4: the Withdraw button opens a modal', await openDialog(page));
  const d0 = await dialogText(page);
  check('§4: the modal is titled Withdraw Points', /Withdraw Points/.test(d0), d0.slice(0, 120));
  check('§4: available to withdraw is restated in the modal', /2,500 Points/.test(d0), d0.slice(0, 200));
  check('§4: the minimum is stated', /Minimum withdrawal 1,000 Points/.test(d0), d0.slice(0, 250));
  check('§4: the network is named', /Solana Devnet/.test(d0), d0.slice(0, 250));
  check(
    '§5: the rate is presented as the purchase rate',
    /100 points = 1 USDC/.test(d0) && /same rate points are bought at/i.test(d0),
    d0.slice(0, 400),
  );

  // §4's own worked examples: 1000 → 10, 2500 → 25.
  for (const [points, expected] of [
    ['1000', '10 USDC'],
    ['2500', '25 USDC'],
    ['1500', '15 USDC'],
  ]) {
    await setPoints(page, points);
    await settle(400);
    const d = await dialogText(page);
    check(
      `§4: ${points} points converts to ${expected}`,
      new RegExp(`You will receive ${expected.replace('.', '\\.')}`).test(d),
      d.slice(d.indexOf('You will receive'), d.indexOf('You will receive') + 60),
    );
  }

  // A rate that does not divide evenly must not round up in the user's favour
  // and then be corrected by the server.
  await setPoints(page, '1234');
  await settle(400);
  const dFrac = await dialogText(page);
  check(
    '§13: a non-round amount is floored, not rounded up',
    /You will receive 12\.34 USDC/.test(dFrac),
    dFrac.slice(dFrac.indexOf('You will receive'), dFrac.indexOf('You will receive') + 60),
  );

  check('modal: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// C. §3 / §10 — the client refuses what the server would refuse
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle2' });
  await settle(1800);
  await openDialog(page);

  await setPoints(page, '800');
  await settle(400);
  let d = await dialogText(page);
  check('§3: below the minimum is called out', /minimum withdrawal is 1,000 points/i.test(d), d.slice(-300));

  await setPoints(page, '9000');
  await settle(400);
  d = await dialogText(page);
  check(
    '§10: more than available is refused, naming the figure',
    /only have 2,500 points available/i.test(d),
    d.slice(-300),
  );

  await setPoints(page, '12.5');
  await settle(400);
  d = await dialogText(page);
  check('points must be whole', /whole number of points/i.test(d), d.slice(-200));

  // MAX must land exactly on what the server says is available, not on the
  // withdrawable total.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === 'MAX');
    if (b) b.click();
  });
  await settle(400);
  const maxValue = await page.$eval('#withdraw-points', (i) => i.value);
  check('MAX fills the available amount, not the withdrawable total', maxValue === '2500', maxValue);

  check('validation: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// D. §29 — nothing is sent without a wallet the user looked at
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle2' });
  await settle(1800);
  await openDialog(page);
  await setPoints(page, '2000');
  await settle(400);

  const d = await dialogText(page);
  // No wallet is connected in a headless browser, so the dialog must be asking
  // for one rather than offering to submit.
  check(
    '§29: with no wallet, the modal asks for one instead of submitting',
    /Connect your wallet|Wallet connection is not configured/i.test(d),
    d.slice(0, 300),
  );
  check(
    '§29: no "Request Withdrawal" action is offered without a wallet',
    !/Request Withdrawal/.test(d),
    d.slice(-300),
  );
  const confirmBox = await page.$('[aria-labelledby="withdraw-title"] input[type="checkbox"]');
  check('§29: the destination confirmation only appears once connected', confirmBox === null);

  check('wallet gate: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// E. §14 — history, statuses, receipts, and the rejection reason
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle2' });
  await settle(1800);

  const body = await txt(page);
  check('§14: a withdrawal history section exists', /Withdrawal history/i.test(body));
  check('§14: a pending row shows its points and payout', /1,000 Points → 10 USDC/.test(body), body.slice(0, 200));
  check('§14: statuses are shown', /PENDING/.test(body) && /COMPLETED/.test(body) && /REJECTED/.test(body));
  check('§14: the request date is shown', /\d{1,2} \w{3} \d{4}/.test(body));
  check('§23: the admin reason is shown on a rejection', /Wallet could not be verified/.test(body), body.slice(0, 200));

  const receipt = await page.evaluate(
    () =>
      [...document.querySelectorAll('a')].filter((a) => /Receipt/.test(a.innerText)).length,
  );
  check('§14: only the completed row links to a receipt', receipt === 1, `${receipt} receipt links`);

  // Cancelling is offered on a pending request and on nothing else.
  const cancels = await page.evaluate(
    () =>
      [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Cancel')
        .length,
  );
  check('§14: exactly one row offers Cancel (the pending one)', cancels === 1, `${cancels} cancel buttons`);

  check('history: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// F. Below-minimum and feature-off states
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario({
    overrides: {
      '/withdrawals/available': {
        totalPoints: 1200,
        withdrawablePoints: 800,
        reservedPoints: 0,
        availableToWithdraw: 800,
        minimumWithdrawal: 1000,
        pointsPerToken: 100,
        openRequests: 0,
        canWithdraw: false,
        enabled: true,
        unavailableReason: null,
        previewAmount: '8',
        network: {
          networkName: 'Solana Devnet',
          tokenMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
          tokenSymbol: 'USDC',
          tokenDecimals: 6,
          treasuryAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          treasuryAddresses: ['9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'],
        },
        withdrawableSources: ['POINT_PURCHASE', 'CORRECT_REWARD', 'QUIZ_REWARD'],
      },
      '/withdrawals': { total: 0, skip: 0, take: 10, totals: { pointsWithdrawn: 0, amountPaid: '0', tokenSymbol: 'USDC' }, items: [] },
    },
  });
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle2' });
  await settle(1800);

  const body = await txt(page);
  check(
    '§28: below the minimum, the profile says what is needed',
    /need at least 1,000 withdrawable points/i.test(body),
    body.slice(0, 200),
  );
  // The message is only useful if the button is actually blocked.
  await openDialog(page);
  await settle(600);
  const opened = await dialogText(page);
  check('§28: the Withdraw button is inert below the minimum', opened === '', opened.slice(0, 120));
  check('§14: an empty history shows its empty state', /No withdrawals yet/i.test(body), body.slice(0, 200));
  check('below-minimum: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

{
  const { ctx, page, errors } = await scenario({
    overrides: {
      '/withdrawals/available': {
        totalPoints: 5500,
        withdrawablePoints: 3500,
        reservedPoints: 0,
        availableToWithdraw: 3500,
        minimumWithdrawal: 1000,
        pointsPerToken: 100,
        openRequests: 0,
        canWithdraw: false,
        enabled: false,
        unavailableReason: 'Withdrawals are currently turned off.',
        previewAmount: '35',
        network: {
          networkName: 'Solana Devnet',
          tokenMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
          tokenSymbol: 'USDC',
          tokenDecimals: 6,
          treasuryAddress: '',
        },
        withdrawableSources: ['POINT_PURCHASE', 'CORRECT_REWARD', 'QUIZ_REWARD'],
      },
    },
  });
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle2' });
  await settle(1800);

  const body = await txt(page);
  check('feature off: the profile says withdrawals are unavailable', /Withdrawals are unavailable/i.test(body), body.slice(0, 200));
  check('feature off: the reason is shown', /currently turned off/i.test(body), body.slice(0, 200));
  await openDialog(page);
  await settle(600);
  check('feature off: the Withdraw button is inert', (await dialogText(page)) === '');
  check('feature off: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// G. A failing availability call must not break the profile
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario({
    overrides: { '/withdrawals/available': null, '/withdrawals': null },
  });
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle2' });
  await settle(1800);

  const body = await txt(page);
  check('resilience: the rest of the profile still renders', /Ada Lovelace/.test(body), body.slice(0, 150));
  // The API's own message is what surfaces, so this asserts the failure is
  // stated at all rather than matching one specific wording.
  check(
    'resilience: the failure is stated, not swallowed',
    /Withdrawal details unavailable/i.test(body) && /History unavailable/i.test(body),
    body.slice(body.indexOf('Points & withdrawals'), body.indexOf('Points & withdrawals') + 320),
  );
  check(
    'resilience: it does not claim there are no withdrawals',
    !/No withdrawals yet/i.test(body),
    body.slice(body.indexOf('Withdrawal history'), body.indexOf('Withdrawal history') + 160),
  );
  check('resilience: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// H. Mobile
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario({ width: 390, height: 844 });
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle2' });
  await settle(1800);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check('mobile: the profile does not scroll sideways', overflow <= 1, `overflow=${overflow}px`);

  await openDialog(page);
  await settle(700);
  const modalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check('mobile: the withdraw modal fits', modalOverflow <= 1, `overflow=${modalOverflow}px`);
  check('mobile: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
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
