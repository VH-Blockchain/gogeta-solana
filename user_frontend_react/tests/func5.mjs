import puppeteer from 'puppeteer-core';
import { stub, BASE } from './stubs.mjs';

/**
 * Quiz module (new_features.md §1–6, §14) against the stubbed backend.
 *
 * Timing-dependent play is covered against a live backend separately — a stub
 * cannot advance a real slot clock. What this suite guards is everything the
 * frontend itself owns: the sidebar entry, the category lobby, the confirmation
 * dialog's numbers, the waiting/result/history rendering, and the rule that the
 * correct answer is never present during play.
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
    if (m.type() === 'error' && !/CORS|net::ERR|Failed to load|fbevents|firebase/i.test(m.text())) errors.push(m.text());
  });
  await stub(page, overrides);
  await page.evaluateOnNewDocument(() => localStorage.setItem('gogeta_jwt', 'smoke-token'));
  return { ctx, page, errors };
}

const txt = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
const navRows = (page) =>
  page.$$eval('nav button', (els) => els.map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
const byText = async (page, needle, exact = false) => {
  for (const b of await page.$$('button')) {
    const t = ((await b.evaluate((el) => el.textContent)) || '').replace(/\s+/g, ' ').trim();
    if (exact ? t === needle : t.includes(needle)) return b;
  }
  return null;
};

// ---------------------------------------------------------------------------
// A. Sidebar entry (§1) — and the rest of the nav still points where it says
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/quiz`, { waitUntil: 'networkidle2' });
  await settle(1500);

  const rows = await navRows(page);
  check('sidebar: a Quiz row exists', rows.some((r) => r === 'Quiz'), rows.join(' | '));

  // Regression guard: the sidebar once indexed PRIMARY_NAV positionally, so
  // inserting Quiz silently pointed the Rewards/Profile rows at the wrong
  // destinations. Every row must still navigate to its own label.
  for (const [label, path] of [['Rewards', '/rewards'], ['Profile', '/profile'], ['Home', '/dashboard'], ['Quiz', '/quiz']]) {
    const btn = await byText(page, label, true);
    if (!btn) { check(`sidebar: "${label}" row present`, false); continue; }
    await btn.click();
    await settle(700);
    check(`sidebar: "${label}" navigates to ${path}`, page.url().endsWith(path), page.url());
  }

  check('quiz: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// B. Category lobby (§1, §14)
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/quiz`, { waitUntil: 'networkidle2' });
  await settle(1600);
  const t = await txt(page);

  for (const label of ['Politics', 'Sports', 'Entertainment', 'General Knowledge']) {
    check(`lobby: "${label}" card renders`, t.includes(label));
  }
  check('lobby: pool sizes come from the API, not hard-coded', /50 questions/.test(t), t.slice(0, 200));
  check('lobby: entry cost is shown', /50 points to enter/.test(t));
  check('lobby: the rules line states the reward', /win 100 points/i.test(t), t.slice(0, 240));
  check('lobby: a countdown to the next quiz renders', /\d+:\d\d until next quiz/.test(t), t.slice(0, 240));

  // The countdown must move on its own.
  const read = () => page.evaluate(() => (document.body.innerText.match(/(\d+:\d\d)\s*\n?\s*until next quiz/) || [])[1]);
  const a = await read();
  await settle(2300);
  const b = await read();
  check('lobby: the countdown ticks', a !== b, `${a} -> ${b}`);

  check('lobby: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// C. Confirmation dialog (§2, §14)
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/quiz`, { waitUntil: 'networkidle2' });
  await settle(1600);

  const opened = await page.evaluate(() => {
    const card = [...document.querySelectorAll('[style*="cursor: pointer"]')].find(
      (d) => d.textContent.trim().startsWith('Sports') && d.textContent.includes('50 question'));
    if (!card) return false;
    card.click();
    return true;
  });
  await settle(800);
  let t = await txt(page);
  check('confirm: opens for the chosen category', opened && t.includes('Join Sports Quiz?'), t.slice(0, 200));
  check('confirm: states the entry fee', /Entry Fee 50 Points/.test(t), t.slice(0, 300));
  check('confirm: states the current balance', /Your Balance 1,450 Points/.test(t), t.slice(0, 300));
  check('confirm: states the question count and timing', /5 questions · 10 seconds each/.test(t), t.slice(0, 400));
  check('confirm: states the win rule', /above 50%/.test(t) && /100 points/.test(t));
  check('confirm: offers Cancel and Join', t.includes('Cancel') && t.includes('Join Quiz'));

  const cancel = await byText(page, 'Cancel', true);
  await cancel?.click();
  await settle(600);
  t = await txt(page);
  check('confirm: Cancel dismisses without joining', !t.includes('Join Sports Quiz?') && page.url().endsWith('/quiz'), page.url());

  check('confirm: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// C2. Not enough points to enter (§16 "Insufficient points")
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario({
    overrides: { '/users/me': { id: 'u1', name: 'Ada Lovelace', username: '@ada', email: 'ada@example.com',
      coins: 10, level: 'BEGINNER', xp: 10, totalPredictions: 0, correctPredictions: 0,
      currentStreak: 0, bestStreak: 0, createdAt: new Date().toISOString(), bio: '', avatarSeed: 1 } },
  });
  await page.goto(`${BASE}/quiz`, { waitUntil: 'networkidle2' });
  await settle(1600);
  await page.evaluate(() => {
    // Clickable cards only — matching any <div> also matches the grid container,
    // whose combined text starts with the first category's name.
    const card = [...document.querySelectorAll('[style*="cursor: pointer"]')].find(
      (d) => d.textContent.trim().startsWith('Sports') && d.textContent.includes('question'));
    card?.click();
  });
  await settle(800);
  const t = await txt(page);

  check('short balance: the dialog still opens and explains the cost', t.includes('Join Sports Quiz?'), t.slice(0, 200));
  check('short balance: the balance is shown', /Your Balance 10 Points/.test(t), t.slice(0, 300));
  check('short balance: the shortfall is spelled out', /need 40 more points/i.test(t), t.slice(0, 400));
  const disabled = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Join Quiz');
    return b ? b.disabled : null;
  });
  check('short balance: Join is disabled', disabled === true, `disabled=${disabled}`);
  check('short balance: still on the lobby', page.url().endsWith('/quiz'), page.url());

  check('short balance: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// D. Joining leads to the live screen, which waits for the start (§3)
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/quiz`, { waitUntil: 'networkidle2' });
  await settle(1600);
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('[style*="cursor: pointer"]')].find(
      (d) => d.textContent.trim().startsWith('Sports') && d.textContent.includes('50 question'));
    card?.click();
  });
  await settle(700);
  const join = await byText(page, 'Join Quiz', true);
  await join?.click();
  await settle(1800);

  check('join: routes to the live quiz', page.url().includes('/quiz/play/'), page.url());
  const t = await txt(page);
  check('join: the waiting screen explains what happens next', /starts shortly/i.test(t), t.slice(0, 240));
  check('join: the waiting screen counts down', /\d+:\d\d/.test(t), t.slice(0, 240));

  // §13: nothing about a correct answer may reach the client before the result.
  const html = await page.content();
  check('play: no correctIndex or explanation in the page source', !/correctIndex/.test(html) && !/documented answer/.test(html));

  check('join: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// E. Result (§5, §14)
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/quiz/result/q1`, { waitUntil: 'networkidle2' });
  await settle(1800);
  const t = await txt(page);

  check('result: "Quiz Complete!" headline', t.includes('Quiz Complete'), t.slice(0, 200));
  check('result: score out of total', /4 \/5|4\/5/.test(t), t.slice(0, 300));
  check('result: percentage', /80%/.test(t));
  check('result: declares the win', /You Won/i.test(t));
  check('result: correct / wrong / unanswered breakdown', /4 Correct/.test(t) && /1 Wrong/.test(t) && /0 Unanswered/.test(t), t.slice(0, 400));
  check('result: points spent and earned', /-50 points/.test(t) && /\+100 points/.test(t), t.slice(0, 400));
  check('result: net points', /\+50 points/.test(t));
  check('result: answer review lists every question', (t.match(/Sample quiz question/g) || []).length === 5);
  check('result: explanations are shown', /documented answer/.test(t));
  check('result: marks the correct answer', /correct answer|your answer/.test(t));
  check('result: offers a way back to the lobby', /Play another quiz/.test(t));

  check('result: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// F. History (§6)
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario();
  await page.goto(`${BASE}/quiz?tab=history`, { waitUntil: 'networkidle2' });
  await settle(1800);
  let t = await txt(page);

  check('history: heading switches to history', t.includes('Your quiz history'), t.slice(0, 200));
  check('history: lists each past attempt', (t.match(/session #/g) || []).length === 3, t.slice(0, 300));
  check('history: shows category and played-at', /Sports/.test(t) && /Politics/.test(t));
  check('history: shows score and percentage', /4\/5 80%/.test(t), t.slice(0, 400));
  check('history: shows right / wrong / missed', /right \/ wrong \/ missed/.test(t));
  // The label uses a typographic minus (U+2212), not an ASCII hyphen.
  check('history: shows the points breakdown', /[-\u2212]50 entry, \+100 reward/.test(t), t.slice(0, 500));
  check('history: shows win and loss outcomes', /Won/.test(t) && /Lost/.test(t));

  // A row opens the graded detail.
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('[style*="cursor: pointer"]')].find((d) => d.textContent.includes('session #'));
    row?.click();
  });
  await settle(1800);
  t = await txt(page);
  check('history: a row opens the full review', /Answer review/.test(t) && /80%/.test(t), t.slice(0, 300));

  check('history: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// G. Narrow viewport — the quiz screens stay usable on a phone (§14)
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await scenario({ width: 390, height: 844 });
  for (const [label, path] of [['lobby', '/quiz'], ['result', '/quiz/result/q1'], ['history', '/quiz?tab=history']]) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2' });
    await settle(1500);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`mobile: ${label} does not scroll sideways`, overflow <= 1, `overflow=${overflow}px`);
  }
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
