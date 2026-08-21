import puppeteer from 'puppeteer-core';
import { stub, BASE } from './stubs.mjs';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

const results = [];
const check = (n, p, d = '') => { results.push({ n, p, d }); console.log(`${p ? ' ok ' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`); };
const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms));

/** A fresh, isolated browser context per scenario so localStorage never leaks. */
async function scenario({ authed = true, width = 1440, height = 1100 } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width, height });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/CORS|net::ERR|Failed to load|fbevents|firebase/i.test(m.text())) errors.push(m.text()); });
  await stub(page);
  if (authed) await page.evaluateOnNewDocument(() => localStorage.setItem('gogeta_jwt', 'smoke-token'));
  return { ctx, page, errors };
}

const txt = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
const navRows = (page) => page.$$eval('nav button', (els) => els.map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
const byText = async (page, needle, exact = false) => {
  const all = await page.$$('button');
  for (const b of all) {
    const t = ((await b.evaluate((el) => el.textContent)) || '').replace(/\s+/g, ' ').trim();
    if (exact ? t === needle : t.includes(needle)) return b;
  }
  return null;
};

// ---------------------------------------------------------------------------
// A. Sidebar submenus expand for their own section (and collapse elsewhere)
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/predictions`, { waitUntil: 'networkidle2' });
  await settle(1500);
  let rows = await navRows(page);
  check('sidebar: on /predictions the category submenu is expanded',
    rows.some((r) => r.startsWith('Sports')) && rows.some((r) => r.startsWith('Crypto')) && rows.some((r) => r.startsWith('Music')),
    rows.join(' | '));
  check('sidebar: category rows carry real per-category counts',
    rows.includes('Sports21') && rows.includes('Crypto9') && rows.includes('Music4'),
    rows.filter((r) => /^(Sports|Crypto|Music)/.test(r)).join(', '));

  // Clicking a category deep-links with ?category=
  const sports = await byText(page, 'Sports21', true);
  await sports.click();
  await settle(1200);
  check('sidebar: clicking a category routes with ?category=', page.url().includes('category=sports'), page.url());

  await page.goto(`${BASE}/leaderboard`, { waitUntil: 'networkidle2' });
  await settle(1300);
  rows = await navRows(page);
  check('sidebar: on /leaderboard the Ranking submenu is expanded', rows.some((r) => r.includes('Lucky Winners')), rows.join(' | '));

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
  await settle(1200);
  rows = await navRows(page);
  check('sidebar: submenus collapsed on an unrelated page', !rows.some((r) => r.startsWith('Sports')), rows.join(' | '));

  // The chevron toggles the submenu without navigating.
  const chevron = await page.$('button[aria-label="Expand All Predictions"]');
  check('sidebar: chevron is its own control', chevron != null);
  if (chevron) {
    await chevron.click();
    await settle(500);
    check('sidebar: chevron expands without navigating',
      (await navRows(page)).some((r) => r.startsWith('Sports')) && page.url().endsWith('/dashboard'), page.url());
  }

  check('sidebar: collapse toggle present', (await page.$('button[aria-label="Collapse sidebar"]')) != null);
  const collapse = await page.$('button[aria-label="Collapse sidebar"]');
  await collapse.click();
  await settle(500);
  check('sidebar: collapses to the icon rail', !(await txt(page)).includes('All Predictions'));
  check('sidebar: rail keeps every category as a tooltipped icon',
    (await page.$$eval('nav button', (els) => els.map((e) => e.getAttribute('aria-label')))).filter((a) => ['Sports', 'Crypto', 'Music'].includes(a || '')).length === 3);

  check('A: no runtime errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// B. Full submit flow: pick -> confirm -> congrats -> basket cleared
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/predictions`, { waitUntil: 'networkidle2' });
  await settle(1500);

  // Stage two picks from two different cards.
  const pills = await page.$$('button[style*="height: 46px"]');
  check('submit flow: option pills are clickable targets', pills.length >= 8, `${pills.length} pills`);
  await pills[0].click();
  await settle(300);
  await pills[4].click();
  await settle(500);
  check('submit flow: two picks staged', (await txt(page)).includes('2 picks selected'));
  check('submit flow: entry total sums both picks', /Entry -100/.test(await txt(page)), (await txt(page)).match(/Entry [^ ]+/)?.[0]);

  // Tapping the same option again clears just that pick.
  await pills[4].click();
  await settle(400);
  check('submit flow: re-clicking an option deselects it', (await txt(page)).includes('1 pick selected'));
  await pills[4].click();
  await settle(400);

  const submit = await byText(page, 'Submit', true);
  await submit.click();
  await settle(700);
  const dialog = await txt(page);
  check('submit flow: confirm dialog lists both picks + balance math',
    dialog.includes('Confirm your picks') && dialog.includes('Balance before') && dialog.includes('1450') && dialog.includes('1350'),
    dialog.match(/Balance after entry \S+/)?.[0]);

  const confirm = await byText(page, 'Confirm & lock in 2 picks');
  check('submit flow: confirm CTA enabled with enough balance', confirm != null);
  await confirm.click();
  await settle(2000);
  const after = await txt(page);
  check('submit flow: congrats celebration shown', after.includes('Congratulations!') && after.includes('2 picks locked in'));
  check('submit flow: congrats shows rank/streak chips', after.includes('Awaiting result') && after.includes('Rank #12') && after.includes('Streak 4'));
  check('submit flow: confetti canvas in the celebration', (await page.$$('canvas')).length > 0);

  const keep = await byText(page, 'Keep predicting');
  await keep.click();
  await settle(700);
  const cleared = await txt(page);
  check('submit flow: basket cleared after submit', !/picks? selected/.test(cleared));
  check('B: no runtime errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// C. Notifications: mark one read, mark all read, filter
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/notifications`, { waitUntil: 'networkidle2' });
  await settle(1300);
  check('notifications: 1 unread initially', (await txt(page)).includes('Mark all read (1)'));

  const unreadRow = await byText(page, 'You called it');
  await unreadRow.click();
  await settle(600);
  check('notifications: clicking an unread row marks it read (optimistic)',
    !(await txt(page)).includes('Mark all read') && !(await txt(page)).includes('NEW'));

  // Filter to a kind.
  const badgePill = await byText(page, 'Badges', true);
  await badgePill.click();
  await settle(500);
  const filtered = await txt(page);
  check('notifications: filtering to Badges narrows the feed',
    filtered.includes('Badge unlocked') && !filtered.includes('You called it'));

  const resultsPill = await byText(page, 'Results', true);
  await resultsPill.click();
  await settle(500);
  check('notifications: switching filter works', (await txt(page)).includes('You called it'));
  check('C: no runtime errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// D. Guard + deep-link replay (isolated contexts)
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario({ authed: false });
  await page.goto(`${BASE}/rewards`, { waitUntil: 'networkidle2' });
  await settle(1100);
  check('guard: unauthenticated portal deep link bounces to /login', page.url().endsWith('/login'), page.url());
  check('guard: no /login flash artifacts — login renders', (await txt(page)).includes('Welcome back'));

  // Signing in should land on the originally requested page, not the default.
  await page.type('input[type="email"]', 'ada@example.com');
  await page.type('input[type="password"]', 'secret123');
  const signIn = await byText(page, 'Sign in', true);
  await signIn.click();
  await settle(2000);
  check('guard: sign-in replays the pending deep link (/rewards)', page.url().endsWith('/rewards'), page.url());
  check('guard: the deep-linked page actually rendered', (await txt(page)).includes('MY POINTS'));
  check('D: no runtime errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// E. Authenticated visitor on /login bounces into the portal
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await settle(1500);
  check('guard: signed-in visitor on /login lands on Predict', page.url().endsWith('/predictions'), page.url());
  check('E: no runtime errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// F. Search: sidebar/topbar/in-page all drive the same ?q=
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
  await settle(1300);
  const inputs = await page.$$('input[aria-label="Search predictions"]');
  check('search: both sidebar and topbar boxes present', inputs.length === 2, `${inputs.length} boxes`);
  await inputs[1].type('derby');
  await inputs[1].press('Enter');
  await settle(1300);
  check('search: submitting routes to Predict with ?q=', page.url().includes('q=derby'), page.url());
  check('search: hero switches to the search headline', (await txt(page)).includes('Showing predictions matching "derby"'));
  check('F: no runtime errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.p);
console.log(`\n================ ${results.length - failed.length}/${results.length} passed ================`);
for (const f of failed) console.log(`  FAIL: ${f.n}${f.d ? `  [${f.d}]` : ''}`);
process.exit(failed.length ? 1 : 0);
