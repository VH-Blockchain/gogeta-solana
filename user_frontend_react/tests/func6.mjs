import puppeteer from 'puppeteer-core';
import { stub, BASE } from './stubs.mjs';

/**
 * Points & Buy Points (new_features.md §1, §5, §12, §17, §19, §20) against the
 * stubbed backend.
 *
 * A real USDC payment needs a funded wallet and a live chain, so that path is
 * verified separately against Solana devnet. What this suite guards is everything
 * the frontend owns on its own: the balance header, the purchase history, the
 * quote arithmetic, the client-side validation, and the wallet-not-configured
 * fallback.
 */

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

const results = [];
const check = (n, p, d = '') => { results.push({ n, p, d }); console.log(`${p ? ' ok ' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`); };
const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms));

async function scenario({ width = 1440, height = 1100, overrides = {} } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width, height });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // configured in tests, so their chatter is not a page defect.
    if (m.type() === 'error' && !/CORS|net::ERR|Failed to load|fbevents|firebase/i.test(m.text())) {
      errors.push(m.text());
    }
  });
  await stub(page, overrides);
  await page.evaluateOnNewDocument(() => localStorage.setItem('gogeta_jwt', 'smoke-token'));
  return { ctx, page, errors };
}

const txt = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
const navRows = (page) =>
  page.$$eval('nav button', (els) => els.map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
const clickText = (page, label) => page.evaluate((label) => {
  const el = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === label);
  if (el) { el.click(); return true; } return false;
}, label);
/**
 * The header's top-up CTA — matched by its label rather than an attribute,
 * because it is a shared GlowButton whose markup it does not control.
 */
const headerBuyButton = (page) => page.evaluateHandle(() =>
  [...document.querySelectorAll('header button')].find((b) =>
    /^Add(\s|$)/.test(b.innerText.trim())) ?? null);

const openBuyFromHeader = async (page) => {
  const handle = await headerBuyButton(page);
  const el = handle.asElement();
  if (!el) return false;
  await el.evaluate((b) => b.click());
  return true;
};

const setAmount = (page, value) => page.evaluate((v) => {
  const i = document.querySelector('#usdc-amount');
  if (!i) return false;
  const d = Object.getOwnPropertyDescriptor(i.constructor.prototype, 'value');
  d.set.call(i, v);
  i.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, value);

// ---------------------------------------------------------------------------
// A. Sidebar entry, and the rest of the nav still points where it says
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/points`, { waitUntil: 'networkidle2' });
  await settle(1800);

  const rows = await navRows(page);
  check('sidebar: a Points row exists', rows.some((r) => r === 'Points'), rows.join(' | '));

  // The sidebar looks nav items up by route, so inserting one must not shift the
  // others onto the wrong destinations.
  for (const [label, path] of [['Rewards', '/rewards'], ['Profile', '/profile'], ['Quiz', '/quiz'], ['Points', '/points']]) {
    const ok = await clickText(page, label);
    await settle(700);
    check(`sidebar: "${label}" navigates to ${path}`, ok && page.url().endsWith(path), page.url());
  }

  check('points: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// A2. The Buy control in the header, reachable from every portal page
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  for (const route of ['/dashboard', '/predictions', '/quiz', '/rewards', '/profile', '/points']) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2' });
    await settle(1300);
    const present = await page.evaluate(() =>
      [...document.querySelectorAll('header button')].some((b) => /^Add(\s|$)/.test(b.innerText.trim())));
    check(`header: top-up control is present on ${route}`, present);
  }

  // It sits next to the balance, and the balance itself links to /points.
  const order = await page.evaluate(() => {
    const buy = [...document.querySelectorAll('header button')].find((b) => /^Add(\s|$)/.test(b.innerText.trim()));
    const bal = document.querySelector('header button[title="Points balance"]');
    if (!buy || !bal) return null;
    // GlowButton is wrapped in a positioning div, so compare against that.
    const wrapper = buy.parentElement;
    return { adjacent: bal.nextElementSibling === wrapper || bal.nextElementSibling === buy };
  });
  check('header: the top-up CTA sits directly beside the balance', order?.adjacent === true, JSON.stringify(order));

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
  await settle(1300);
  await page.evaluate(() => document.querySelector('header button[title="Points balance"]')?.click());
  await settle(1400);
  check('header: the balance links to the Points page', page.url().endsWith('/points'), page.url());

  // Opening from the header works on a page that is not /points.
  // Styled as a sibling of "Predict now", not a bespoke outlined chip.
  const styling = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('header button')];
    const buy = btns.find((b) => /^Add(\s|$)/.test(b.innerText.trim()));
    const predict = btns.find((b) => /Predict now/.test(b.innerText));
    if (!buy || !predict) return null;
    const a = getComputedStyle(buy), b = getComputedStyle(predict);
    return {
      label: buy.innerText.trim(),
      sameHeight: buy.getBoundingClientRect().height === predict.getBoundingClientRect().height,
      sameRadius: a.borderRadius === b.borderRadius,
      buyIsGradient: a.backgroundImage.includes('gradient'),
      predictIsGradient: b.backgroundImage.includes('gradient'),
      hasGlow: a.boxShadow !== 'none',
    };
  });
  check('header: the CTA is renamed to "Add Points"', styling?.label === 'Add Points', JSON.stringify(styling));
  check('header: same height as Predict now', styling?.sameHeight === true, JSON.stringify(styling));
  check('header: same pill radius as Predict now', styling?.sameRadius === true, JSON.stringify(styling));
  check('header: gradient fill like Predict now', styling?.buyIsGradient === true && styling?.predictIsGradient === true, JSON.stringify(styling));
  check('header: has a glow like Predict now', styling?.hasGlow === true, JSON.stringify(styling));

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
  await settle(1300);
  await openBuyFromHeader(page);
  await settle(1000);
  const t = await txt(page);
  check('header: the dialog opens from a non-points page', /USDC amount/.test(t) && /You will receive/.test(t), t.slice(0, 300));
  check('header: it did not navigate away to open', page.url().endsWith('/dashboard'), page.url());

  check('header: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// B. Balance header and purchase history (§5, §12)
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/points`, { waitUntil: 'networkidle2' });
  await settle(1800);
  const t = await txt(page);

  check('header: shows the points balance', /POINTS BALANCE/i.test(t) && /1,450/.test(t), t.slice(0, 240));
  check('header: shows points bought and USDC spent', /1,500 bought/.test(t) && /15\.000000 USDC spent/.test(t), t.slice(0, 320));
  check('header: shows the exchange rate', /1 : 100/.test(t));
  check('header: offers Buy Points (§5)', /Buy Points/.test(t));

  check('history: section renders (§12)', /Points purchase history/.test(t));
  check('history: shows the USDC amount and credited points', /10 USDC \+1,000 Points/.test(t), t.slice(0, 600));
  check('history: shows the date, rate and network (§12)', /1 : 100 · Solana Devnet/.test(t), t.slice(0, 600));
  check('history: shows the wallet address', /7xKX…gAsU/.test(t), t.slice(0, 600));
  check('history: shows the status (§12)', /Confirmed/.test(t));

  const link = await page.$$eval('a[href*="explorer.solana.com"]', (a) => a.map((x) => x.getAttribute('href'))[0] ?? '');
  check('history: the signature links to the Solana explorer with the devnet cluster (§29)',
    link.startsWith('https://explorer.solana.com/tx/') && link.includes('cluster=devnet'), link);

  check('history: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// C. Buy Points modal: the quote (§5, §6, §17)
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/points`, { waitUntil: 'networkidle2' });
  await settle(1800);
  await openBuyFromHeader(page);
  await settle(900);
  let t = await txt(page);

  check('modal: opens from the header button', /USDC amount/.test(t), t.slice(0, 240));
  check('modal: quotes the points for the default amount', /You will receive 1,000 Points/.test(t), t.slice(0, 400));
  check('modal: states the rate (§6)', /1 USDC = 100 points/.test(t));
  check('modal: names the network (§19)', /Network Solana Devnet/.test(t), t.slice(0, 500));
  check('modal: shows the receiving address', /Pay to 5f6t…xRmx/.test(t), t.slice(0, 500));
  check('modal: states the purchase limits', /1–1000 USDC per purchase/.test(t), t.slice(0, 500));

  // The quote must be integer-floored, matching the server exactly (§17).
  for (const [amount, expected] of [
    ['1', '100 Points'],
    ['2.5', '250 Points'],
    ['1.234567', '123 Points'],
    ['999', '99,900 Points'],
  ]) {
    await setAmount(page, amount);
    await settle(350);
    t = await txt(page);
    check(`quote: ${amount} USDC → ${expected}`, t.includes(`You will receive ${expected}`), t.slice(0, 300));
  }

  check('modal: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// D. Client-side validation (§17, §20)
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/points`, { waitUntil: 'networkidle2' });
  await settle(1800);
  await openBuyFromHeader(page);
  await settle(900);

  for (const [amount, expect] of [
    ['1.1234567', /at most 6 decimal places/i],
    ['0.5', /minimum purchase is 1/i],
    ['5000', /maximum purchase is 1000/i],
    ['abc', /Enter a number/i],
    ['0', /greater than zero/i],
  ]) {
    await setAmount(page, amount);
    await settle(320);
    const t = await txt(page);
    check(`validation: "${amount}" is explained`, expect.test(t), t.slice(0, 320));
  }

  check('validation: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// E. Wallet not configured, and purchasing switched off (§20)
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/points`, { waitUntil: 'networkidle2' });
  await settle(1800);
  await openBuyFromHeader(page);
  await settle(900);
  const modal = await page.evaluate(() => {
    const m = document.querySelector('.modal');
    return m ? m.innerText.replace(/\s+/g, ' ') : '';
  });
  // The Solana wallet adapter is always available, so the modal always offers a
  // connect action rather than sometimes reporting itself unconfigured.
  // are valid here. What must hold either way: the dialog opens and states the
  // next step instead of failing silently or crashing the page.
  const configured = /connect your wallet/i.test(modal);
  const notConfigured = /No Solana wallet was detected|Wallet unavailable/.test(modal);
  check('wallet state: the modal states the next step', configured || notConfigured, modal.slice(0, 300));
  check(
    configured
      ? 'wallet configured: the primary action is Connect Wallet'
      : 'wallet unconfigured: the primary action is disabled',
    configured ? /Connect Wallet/.test(modal) : /Wallet unavailable/.test(modal),
    modal.slice(0, 300),
  );
  const t = await txt(page);
  check('wallet state: the page still rendered fully', /Points purchase history/.test(t));
  check('wallet state: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}
{
  const { ctx, page, errors } = await scenario({
    overrides: {
      '/points/purchase-config': {
        enabled: false,
        unavailableReason: 'Buying points is currently turned off.',
        network: { network: 'devnet', networkName: 'Solana Devnet', rpcUrl: '', explorerUrl: '', usdcMint: '', usdcDecimals: 6, receiverAddress: '' },
        rate: { usdcToPoints: 100, minUsdc: 1, maxUsdc: 1000 },
      },
    },
  });
  await page.goto(`${BASE}/points`, { waitUntil: 'networkidle2' });
  await settle(1800);
  const t = await txt(page);
  check('disabled: the reason is shown', /currently turned off/.test(t), t.slice(0, 400));
  const pageBtnDisabled = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().includes('Buy Points'));
    return b ? b.disabled : null;
  });
  check('disabled: the page Buy Points button is not clickable', pageBtnDisabled === true, `disabled=${pageBtnDisabled}`);
  // The header control stays visible but explains itself via its tooltip rather
  // than opening a dialog that cannot complete.
  await openBuyFromHeader(page);
  await settle(700);
  const opened = await page.evaluate(() => !!document.querySelector('#usdc-amount'));
  check('disabled: the header control does not open the dialog', opened === false);
  const tip = await page.evaluate(() => {
    const b = [...document.querySelectorAll('header button')].find((x) => /^Add(\s|$)/.test(x.innerText.trim()));
    return b?.closest('[title]')?.getAttribute('title') ?? '';
  });
  check('disabled: the header control explains why', /turned off|unavailable/i.test(tip), tip);
  check('disabled: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// F. Reduced rewards are read from the server, not hard-coded (§1)
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario({
    overrides: {
      '/config': {
        economy: { signupBonus: 100, entryFee: 50, correctReward: 10, luckyBonus: 50, dailyLuckyWinners: 10 },
        premium: {}, app: { version: '1.0.0' },
        site: { name: 'GOGETA', tagline: 'Predict. Compete. Prove', contactEmail: 'hello@yesiki.com',
                social: { facebook: '', twitter: '', instagram: '', website: '' } },
        luckyDraw: { enabled: true, label: 'Lucky Draw', tagline: 'See if you won today.' },
        categories: [{ key: 'sports' }], predictionList: {},
      },
    },
  });
  await page.goto(`${BASE}/leaderboard/lucky`, { waitUntil: 'networkidle2' });
  await settle(1800);
  const t = await txt(page);
  check('lucky: the bonus amount comes from /config, not a constant',
    !/500 bonus points/.test(t), t.slice(0, 400));
  check('lucky: shows the configured winners-per-day', /10 top predictors/.test(t), t.slice(0, 400));
  check('lucky: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// G. Narrow viewport
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario({ width: 390, height: 844 });
  await page.goto(`${BASE}/points`, { waitUntil: 'networkidle2' });
  await settle(1600);
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('mobile: points page does not scroll sideways', overflow <= 1, `overflow=${overflow}px`);
  await openBuyFromHeader(page);
  await settle(900);
  const modalOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('mobile: the Buy Points modal fits', modalOverflow <= 1, `overflow=${modalOverflow}px`);
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
