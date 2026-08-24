import puppeteer from 'puppeteer-core';
import { stub, BASE } from './stubs.mjs';

/**
 * Dialog geometry — that a modal's action row is actually reachable.
 *
 * Every other suite asserted only *horizontal* overflow, which is why the
 * withdraw modal shipped taller than the viewport with its Cancel / Request
 * Withdrawal buttons below the fold and no way to scroll to them. `innerText`
 * finds those buttons whether or not a user can reach them, so this asserts
 * real geometry instead — the same reasoning func3 was written on.
 *
 * 720 is the reported case: a laptop viewport at 100% browser zoom. 600 forces
 * the overflow path so the scroll container itself is exercised.
 */
const VIEWPORTS = [
  { label: '720 (100% zoom, laptop)', width: 1329, height: 720 },
  { label: '900 (100% zoom, desktop)', width: 1440, height: 900 },
  { label: '600 (short window)', width: 1329, height: 600 },
];

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

for (const vp of VIEWPORTS) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: vp.width, height: vp.height });
  await stub(page, {});
  await page.evaluateOnNewDocument(() => localStorage.setItem('gogeta_jwt', 'smoke-token'));
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle2' });
  await settle(1800);

  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button')].find(
      (e) => e.textContent.trim() === 'Withdraw',
    );
    el?.click();
  });
  await settle(900);

  const geo = await page.evaluate(() => {
    const dialog = document.querySelector('[aria-labelledby="withdraw-title"]');
    if (!dialog) return null;
    // The card is the scroll container: the element whose scrollHeight can
    // exceed its clientHeight.
    const card = [...dialog.querySelectorAll('div')].find(
      (d) => getComputedStyle(d).overflowY === 'auto' && d.scrollHeight > 0,
    );
    const btn = (label) =>
      [...dialog.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
    };
    return {
      viewportH: window.innerHeight,
      cancel: rect(btn('Cancel')),
      hasCard: card != null,
      cardScrollable: card ? card.scrollHeight > card.clientHeight + 1 : false,
      cardClient: card ? card.clientHeight : null,
      cardScroll: card ? card.scrollHeight : null,
      pageOverflowX:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  if (!geo) {
    check(`${vp.label}: dialog opened`, false, 'dialog not found');
    await ctx.close();
    continue;
  }

  check(`${vp.label}: dialog opened`, true);

  // The real assertion: the action row is inside the viewport, not below it.
  const cancelVisible =
    geo.cancel != null && geo.cancel.bottom <= geo.viewportH + 1 && geo.cancel.top >= 0;
  check(
    `${vp.label}: Cancel is within the viewport`,
    cancelVisible,
    geo.cancel
      ? `bottom=${geo.cancel.bottom} viewportH=${geo.viewportH}`
      : 'Cancel button not found',
  );

  check(
    `${vp.label}: the card is a scroll container`,
    geo.hasCard,
    `client=${geo.cardClient} scroll=${geo.cardScroll} scrollable=${geo.cardScrollable}`,
  );

  check(
    `${vp.label}: no sideways overflow`,
    geo.pageOverflowX <= 1,
    `overflowX=${geo.pageOverflowX}px`,
  );

  // Everything must stay reachable after scrolling the card to the end too.
  if (geo.cardScrollable) {
    const afterScroll = await page.evaluate(() => {
      const dialog = document.querySelector('[aria-labelledby="withdraw-title"]');
      const card = [...dialog.querySelectorAll('div')].find(
        (d) => getComputedStyle(d).overflowY === 'auto' && d.scrollHeight > 0,
      );
      card.scrollTop = card.scrollHeight;
      const btn = [...dialog.querySelectorAll('button')].find(
        (b) => b.textContent.trim() === 'Cancel',
      );
      const r = btn.getBoundingClientRect();
      return { bottom: Math.round(r.bottom), top: Math.round(r.top), viewportH: window.innerHeight };
    });
    check(
      `${vp.label}: Cancel still visible after scrolling to the end`,
      afterScroll.bottom <= afterScroll.viewportH + 1 && afterScroll.top >= 0,
      `top=${afterScroll.top} bottom=${afterScroll.bottom} viewportH=${afterScroll.viewportH}`,
    );
  }

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
