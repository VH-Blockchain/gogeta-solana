import puppeteer from 'puppeteer-core';
import { stub, BASE } from './stubs.mjs';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? ' ok ' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

async function newPage(width = 1440, height = 1000) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/CORS|net::ERR|Failed to load|fbevents|firebase/i.test(m.text())) errors.push(m.text()); });
  await stub(page);
  await page.evaluateOnNewDocument(() => localStorage.setItem('gogeta_jwt', 'smoke-token'));
  page.__errors = errors;
  return page;
}

const txt = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
const count = (page, sel) => page.$$eval(sel, (els) => els.length);
const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// 1. Predictions page: grid, tabs, detail panel, basket, submit bar, filters
// ---------------------------------------------------------------------------
{
  const page = await newPage();
  await page.goto(`${BASE}/predictions`, { waitUntil: 'networkidle2' });
  await settle(1400);

  const body = await txt(page);
  check('predictions: hero headline', body.includes('Predict it first.'));
  check('predictions: open tab count badge (server total 34)', /Open\s*34/.test(body), body.match(/Open\s*\d+/)?.[0]);
  check('predictions: category pills from admin catalog', body.includes('Sports') && body.includes('Crypto') && body.includes('Music'));
  check('predictions: cards rendered', body.includes('Will team'), '');
  check('predictions: reward + players footer pills', body.includes('100 pts') && body.includes('8,10'));
  check('predictions: load-more shown (6 of 34)', body.includes('Load more predictions'));

  // Click an option row -> stages a pick, submit bar slides up.
  const optionButtons = await page.$$('button');
  let clicked = false;
  for (const b of optionButtons) {
    const t = await b.evaluate((el) => el.textContent || '');
    if (t.trim().startsWith('Yes') && t.includes('%') === false) { await b.click(); clicked = true; break; }
    if (/^Yes\s*\d+%$/.test(t.replace(/\s+/g, ' ').trim())) { await b.click(); clicked = true; break; }
  }
  if (!clicked) {
    // Fall back: first option pill inside a card (46px tall pill buttons).
    const pill = await page.$$('button[style*="border-radius: 999px"][style*="height: 46px"]');
    if (pill[0]) { await pill[0].click(); clicked = true; }
  }
  await settle(700);
  const afterPick = await txt(page);
  check('predictions: clicking an option stages a pick', clicked && /1 pick selected/.test(afterPick), afterPick.match(/\d+ picks? selected/)?.[0] ?? 'no submit bar');
  check('predictions: submit bar shows entry cost', /Entry\s*-?−?50/.test(afterPick.replace(/−/g, '−')), afterPick.match(/Entry[^A-Za-z]*\d+/)?.[0]);

  // Open the confirm dialog from the submit bar.
  const submitBtn = await page.$$eval('button', (els) => els.findIndex((e) => e.textContent?.trim() === 'Submit'));
  if (submitBtn >= 0) {
    const all = await page.$$('button');
    await all[submitBtn].click();
    await settle(600);
  }
  const confirmText = await txt(page);
  check('predictions: confirm dialog opens with ledger lines',
    confirmText.includes('Confirm your picks') && confirmText.includes('Potential reward') && confirmText.includes('Balance after entry'));
  check('predictions: confirm CTA reflects pick count', /Confirm & lock in 1 picks/.test(confirmText));

  // Escape closes it.
  await page.keyboard.press('Escape');
  await settle(400);
  check('predictions: Escape dismisses the dialog', !(await txt(page)).includes('Confirm your picks'));

  // Open the detail panel via a card header.
  const header = await page.$$eval('button', (els) =>
    els.findIndex((e) => (e.textContent || '').includes('Will team 1 win')));
  if (header >= 0) {
    const all = await page.$$('button');
    await all[header].click();
    await settle(700);
  }
  const detail = await txt(page);
  check('predictions: detail panel opens', detail.includes('Pick your answer') || detail.includes('Your pick'));
  check('predictions: detail shows points lines', detail.includes('Points to enter') && detail.includes('Points if correct'));
  check('predictions: long info copy gets a View more toggle', detail.includes('View more'));
  check('predictions: CTA gated until an option is picked', detail.includes('Pick an option to continue'));
  await page.keyboard.press('Escape');
  await settle(400);

  // Filters dialog.
  const filtersIdx = await page.$$eval('button', (els) => els.findIndex((e) => e.textContent?.trim() === 'Filters'));
  if (filtersIdx >= 0) {
    const all = await page.$$('button');
    await all[filtersIdx].click();
    await settle(500);
  }
  const filters = await txt(page);
  check('predictions: filters dialog lists admin sort/show chips',
    filters.includes('Sort & filter') && filters.includes('Trending') && filters.includes('Biggest Reward') && filters.includes('All Open'));
  await page.keyboard.press('Escape');
  await settle(300);

  // Tab switching routes (so the URL is the source of truth).
  const picksIdx = await page.$$eval('button', (els) => els.findIndex((e) => (e.textContent || '').includes('My Picks')));
  const all2 = await page.$$('button');
  await all2[picksIdx].click();
  await settle(900);
  check('predictions: My Picks tab routes to ?tab=active', page.url().includes('tab=active'), page.url());
  check('predictions: My Picks lists the locked pick', (await txt(page)).includes('Will team 7'));

  const histIdx = await page.$$eval('button', (els) => els.findIndex((e) => (e.textContent || '').includes('History')));
  const all3 = await page.$$('button');
  await all3[histIdx].click();
  await settle(900);
  const hist = await txt(page);
  check('predictions: History tab routes + shows summary tiles',
    page.url().includes('tab=history') && hist.includes('Win rate') && hist.includes('71%'));
  check('predictions: History rows show won/lost chips', hist.includes('Won +100') && hist.includes('Lost'));
  check('predictions: History shows the user\'s pick', hist.includes('Your pick:'));

  check('predictions: no runtime errors', page.__errors.length === 0, page.__errors.join(' | '));
  await page.close();
}

// ---------------------------------------------------------------------------
// 2. Dashboard
// ---------------------------------------------------------------------------
{
  const page = await newPage();
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
  await settle(1600);
  const body = await txt(page);
  check('dashboard: hero + CTAs', body.includes('Make your call.') && body.includes('Predict now') && body.includes('Leaderboard'));
  check('dashboard: KPI tiles', body.includes('Total points') && body.includes('Accuracy') && body.includes('Global rank') && body.includes('Current streak'));
  check('dashboard: trend deltas rendered', /▲\s*140/.test(body) && /▼\s*3/.test(body));
  check('dashboard: rank from stats endpoint (#12)', body.includes('#12'));
  check('dashboard: Featured section (admin-flagged only)', body.includes('Featured'));
  check('dashboard: top predictors peek', body.includes('Top predictors') && body.includes('Player 1'));
  check('dashboard: open challenges section', body.includes('Open challenges'));
  check('dashboard: sidebar shows the true open total (34, not the 20-item page)', /All Predictions\s*34/.test(body), body.match(/All Predictions\s*\d+/)?.[0]);
  check('dashboard: category submenu stays collapsed off its own section', !/Music\s*4/.test(body));
  check('dashboard: no runtime errors', page.__errors.length === 0, page.__errors.join(' | '));
  await page.close();
}

// ---------------------------------------------------------------------------
// 3. Leaderboard + lucky winners
// ---------------------------------------------------------------------------
{
  const page = await newPage();
  await page.goto(`${BASE}/leaderboard`, { waitUntil: 'networkidle2' });
  await settle(1300);
  let body = await txt(page);
  check('leaderboard: header stats (your rank / ranked / accuracy)', body.includes('your rank') && body.includes('ranked players') && body.includes('your accuracy'));
  check('leaderboard: period tabs', body.includes('Daily') && body.includes('Weekly') && body.includes('Monthly'));
  check('leaderboard: reset countdown', /Resets in/.test(body), body.match(/Resets in \S+/)?.[0]);
  check('leaderboard: podium top-3', body.includes('Player 1') && body.includes('Player 2') && body.includes('Player 3'));
  check('leaderboard: table header columns', body.includes('RANK') && body.includes('PLAYER') && body.includes('POINTS') && body.includes('ACCURACY'));
  check('leaderboard: current user marked "(you)" in the table', body.includes('(you)'));
  check('leaderboard: podium renders the top 3 without a "(you)" tag on them',
    body.indexOf('(you)') > body.indexOf('Player 3'));
  check('leaderboard: climb-ranks banner uses real rank', body.includes("You're #12 globally"));

  // Switch period.
  const weekIdx = await page.$$eval('button', (els) => els.findIndex((e) => e.textContent?.trim() === 'Weekly'));
  const all = await page.$$('button');
  await all[weekIdx].click();
  await settle(900);
  check('leaderboard: switching period reloads', (await txt(page)).includes("This week's climbers"));

  await page.goto(`${BASE}/leaderboard/lucky`, { waitUntil: 'networkidle2' });
  await settle(1300);
  body = await txt(page);
  check('lucky: pool hero + copy', body.includes('Lucky Draw') && body.includes('Resets every midnight') && body.includes('10 top predictors'));
  check('lucky: winners listed', body.includes('Player 1') && body.includes('You won!'));
  check('lucky: status card reflects a win', body.includes('You bagged 500 bonus points today'));
  check('lucky: confetti canvas mounted for a winner', (await count(page, 'canvas')) > 0);
  check('lucky: no runtime errors', page.__errors.length === 0, page.__errors.join(' | '));
  await page.close();
}

// ---------------------------------------------------------------------------
// 4. Rewards + Profile + Notifications
// ---------------------------------------------------------------------------
{
  const page = await newPage();
  await page.goto(`${BASE}/rewards`, { waitUntil: 'networkidle2' });
  await settle(1300);
  let body = await txt(page);
  check('rewards: 4 header stats', body.includes('balance') && body.includes('earned all-time') && body.includes('this week') && body.includes('lucky wins'));
  check('rewards: coin balance hero', body.includes('MY POINTS') && body.includes('points available') && body.includes('earned all-time'));
  check('rewards: ledger + filter tabs', body.includes('Points history') && body.includes('Earned') && body.includes('Spent'));
  check('rewards: signed amounts', body.includes('+100') && body.includes('-50'));

  const spentIdx = await page.$$eval('button', (els) => els.findIndex((e) => e.textContent?.trim() === 'Spent'));
  const all = await page.$$('button');
  await all[spentIdx].click();
  await settle(700);
  check('rewards: filter tab switches without error', page.__errors.length === 0, page.__errors.join(' | '));

  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle2' });
  await settle(1500);
  body = await txt(page);
  check('profile: identity + level chip', body.includes('Ada Lovelace') && body.includes('ANALYST'));
  check('profile: real level progress (30/100 Correct Predictions to Expert)', /30 \/ 100 Correct Predictions to Expert/.test(body), body.match(/\d+ \/ \d+ Correct Predictions to \w+/)?.[0]);
  check('profile: hero stat chips', body.includes('Predictions') && body.includes('Correct') && body.includes('Badges') && body.includes('2/7'));
  check('profile: stat tiles', body.includes('Prediction accuracy') && body.includes('Current / best streak') && body.includes('4 / 9'));
  check('profile: recent activity from the ledger', body.includes('Recent activity') && body.includes('Correct call'));
  check('profile: achievements + level path', body.includes('Main achievements') && body.includes('2 / 7 earned') && body.includes('Achievement levels') && body.includes('Legend'));
  check('profile: account actions',
    body.includes('Sign out') && body.includes('Change password') &&
    /Enable notifications|Notifications on|Blocked — check browser settings/.test(body),
    body.match(/Enable notifications|Notifications on|Blocked[^.]*/)?.[0]);

  await page.goto(`${BASE}/notifications`, { waitUntil: 'networkidle2' });
  await settle(1200);
  body = await txt(page);
  check('notifications: header stats + mark all', body.includes('unread') && body.includes('total') && body.includes('Mark all read (1)'));
  check('notifications: kind filter pills only for present kinds', body.includes('Daily draw') && body.includes('Results') && body.includes('Badges') && !body.includes('Reminders'));
  check('notifications: unread badge', body.includes('NEW'));
  check('notifications: rows rendered', body.includes('You called it') && body.includes('Badge unlocked'));
  check('notifications: no runtime errors', page.__errors.length === 0, page.__errors.join(' | '));
  await page.close();
}

// ---------------------------------------------------------------------------
// 5. Responsive: mobile drawer, tablet rail, wide right rail
// ---------------------------------------------------------------------------
{
  const page = await newPage(1400, 900);
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
  await settle(1200);
  check('responsive @1400: right rail hidden below 1280+? (should show)', (await txt(page)).includes('RECENT ACTIVITY'));

  await page.setViewport({ width: 1100, height: 900 });
  await settle(700);
  check('responsive @1100: right rail hidden', !(await txt(page)).includes('RECENT ACTIVITY'));
  check('responsive @1100: sidebar still labelled', (await txt(page)).includes('All Predictions'));

  await page.setViewport({ width: 800, height: 900 });
  await settle(700);
  const tablet = await txt(page);
  check('responsive @800: sidebar collapses to icon rail', !tablet.includes('All Predictions'));

  await page.setViewport({ width: 480, height: 900 });
  await settle(700);
  const mobile = await txt(page);
  check('responsive @480: no sidebar, hamburger present', !mobile.includes('All Predictions'));
  const menuBtn = await page.$('button[aria-label="Open navigation"]');
  check('responsive @480: hamburger rendered', menuBtn != null);
  if (menuBtn) {
    await menuBtn.click();
    await settle(600);
    check('responsive @480: drawer opens with full nav', (await txt(page)).includes('All Predictions'));
  }
  check('responsive: no horizontal overflow at 480',
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    await page.evaluate(() => `${document.documentElement.scrollWidth} vs ${document.documentElement.clientWidth}`));
  check('responsive: no runtime errors', page.__errors.length === 0, page.__errors.join(' | '));
  await page.close();
}

// ---------------------------------------------------------------------------
// 6. Landing page sections + guard behaviour
// ---------------------------------------------------------------------------
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await stub(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await settle(1400);
  const body = await txt(page);
  for (const section of ['HOW IT WORKS', "TODAY'S ARENA", 'WHY GOGETA', 'INSIDE THE APP',
                         'EVERYTHING IN THE GAME', 'WHAT PLAYERS SAY', 'GOOD TO KNOW']) {
    check(`landing: section "${section}"`, body.includes(section));
  }
  check('landing: count-up stats strip', body.includes('Welcome points on signup') && body.includes('Bonus points per daily win'));
  check('landing: store badges', body.includes('Google Play') && body.includes('App Store'));
  check('landing: footer legal links', body.includes('Privacy Policy') && body.includes('Terms of Use') && body.includes('Contact Us'));
  check('landing: admin site tagline from /config', body.includes('Predict. Compete. Prove'));
  check('landing: admin social link rendered (facebook only)', (await count(page, 'a[aria-label="Facebook"]')) === 1 && (await count(page, 'a[aria-label="Instagram"]')) === 0);

  // FAQ accordion
  const faqIdx = await page.$$eval('button', (els) => els.findIndex((e) => (e.textContent || '').includes('Is GOGETA real-money gambling?')));
  const all = await page.$$('button');
  await all[faqIdx].click();
  await settle(500);
  check('landing: FAQ expands', (await txt(page)).includes('GOGETA runs entirely on points'));

  // Guard: an unauthenticated portal deep link bounces to /login. Needs its own
  // browser context — earlier authed pages in this run share localStorage, so a
  // plain newPage() would still carry a token.
  const guardCtx = await browser.createBrowserContext();
  const guard = await guardCtx.newPage();
  await stub(guard);
  await guard.goto(`${BASE}/rewards`, { waitUntil: 'networkidle2' });
  await settle(1000);
  check('guard: unauthenticated /rewards redirects to /login', guard.url().endsWith('/login'), guard.url());
  check('guard: login page renders after the bounce', (await txt(guard)).includes('Welcome back'));
  await guardCtx.close();

  check('landing: no runtime errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n================ ${results.length - failed.length}/${results.length} passed ================`);
for (const f of failed) console.log(`  FAIL: ${f.name}${f.detail ? `  [${f.detail}]` : ''}`);
process.exit(failed.length ? 1 : 0);
