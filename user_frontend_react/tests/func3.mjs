import puppeteer from 'puppeteer-core';
import { stub, BASE } from './stubs.mjs';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const results = [];
const check = (n, p, d = '') => { results.push({ n, p, d }); console.log(`${p ? ' ok ' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`); };
const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms));

async function open(route, { authed = true, width = 1440, height = 900 } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width, height });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await stub(page);
  if (authed) await page.evaluateOnNewDocument(() => localStorage.setItem('gogeta_jwt', 't'));
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
  await settle(2400);
  return { ctx, page, errors };
}

// ---------------------------------------------------------------------------
// Scroll reachability. innerText returns text regardless of whether the user
// can actually get to it, so these assert real geometry instead.
// ---------------------------------------------------------------------------
for (const route of ['/dashboard', '/predictions', '/leaderboard', '/profile', '/rewards']) {
  const { ctx, page, errors } = await open(route);

  const geo = await page.evaluate(() => {
    const pane = document.querySelector('.shell__content');
    const shell = document.querySelector('.shell__main');
    return {
      hasPane: !!pane,
      paneClient: pane?.clientHeight ?? 0,
      paneScroll: pane?.scrollHeight ?? 0,
      shellH: shell?.getBoundingClientRect().height ?? 0,
      viewportH: window.innerHeight,
      docScroll: document.documentElement.scrollHeight,
      docClient: document.documentElement.clientHeight,
    };
  });

  check(`${route}: shell is viewport-capped (not grown by content)`,
    geo.shellH <= geo.viewportH + 1, `shell ${Math.round(geo.shellH)} vs viewport ${geo.viewportH}`);
  check(`${route}: the document itself does not scroll`,
    geo.docScroll <= geo.docClient + 1, `${geo.docScroll} vs ${geo.docClient}`);

  if (geo.paneScroll > geo.paneClient + 1) {
    // Scroll the inner pane to the very bottom and confirm it moved.
    const scrolled = await page.evaluate(async () => {
      const pane = document.querySelector('.shell__content');
      pane.scrollTop = pane.scrollHeight;
      await new Promise((r) => requestAnimationFrame(r));
      return { top: pane.scrollTop, max: pane.scrollHeight - pane.clientHeight };
    });
    check(`${route}: inner pane scrolls to the bottom`,
      Math.abs(scrolled.top - scrolled.max) < 2, `scrollTop ${Math.round(scrolled.top)} / max ${Math.round(scrolled.max)}`);

    // The last element in the pane must land inside the viewport once scrolled.
    const lastVisible = await page.evaluate(() => {
      const pane = document.querySelector('.shell__content');
      const kids = pane.querySelectorAll('*');
      const last = kids[kids.length - 1];
      const r = last.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    });
    check(`${route}: bottom-most content is reachable`, lastVisible);
  } else {
    check(`${route}: content fits without scrolling`, true, `${Math.round(geo.paneScroll)} <= ${Math.round(geo.paneClient)}`);
  }

  check(`${route}: no runtime errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// The document-scrolling pages must still grow past the viewport.
// ---------------------------------------------------------------------------
for (const route of ['/', '/privacy']) {
  const { ctx, page, errors } = await open(route, { authed: false });
  const geo = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollHeight,
    docClient: document.documentElement.clientHeight,
  }));
  check(`${route}: document scrolls (content taller than viewport)`,
    geo.docScroll > geo.docClient + 50, `${geo.docScroll} vs ${geo.docClient}`);

  const reachedBottom = await page.evaluate(async () => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => requestAnimationFrame(r));
    return Math.round(window.scrollY) > 0;
  });
  check(`${route}: scrolling to the footer works`, reachedBottom);

  // Only the landing page uses the aurora backdrop; the legal pages
  // deliberately sit on a plain bg surface (as the Flutter scaffold did).
  if (route === '/') {
    const painted = await page.evaluate(() => {
      const blobs = document.querySelector('.aurora__blobs');
      if (!blobs) return false;
      const r = blobs.getBoundingClientRect();
      return getComputedStyle(blobs).position === 'fixed' && r.height >= window.innerHeight - 1;
    });
    check(`${route}: backdrop stays fixed behind scrolled content`, painted);
  } else {
    const plain = await page.evaluate(() => !document.querySelector('.aurora'));
    check(`${route}: renders on the plain bg surface (no aurora, as designed)`, plain);
  }
  check(`${route}: no runtime errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// The submit bar must actually be on-screen when it has picks.
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await open('/predictions');
  const pills = await page.$$('button[style*="height: 46px"]');
  await pills[0].click();
  await settle(1200);
  const bar = await page.evaluate(() => {
    const el = document.querySelector('.submit-bar');
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      onScreen: r.top >= 0 && r.bottom <= window.innerHeight + 1,
      visibility: cs.visibility, opacity: cs.opacity,
      top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight,
    };
  });
  check('submit bar: on-screen when picks exist',
    bar.onScreen && bar.visibility === 'visible' && bar.opacity === '1',
    `top ${bar.top} bottom ${bar.bottom} vh ${bar.vh} vis ${bar.visibility}`);

  // Clearing must make it genuinely inert, not just transparent.
  const clear = await page.$('button[aria-label="Clear picks"]');
  await clear.click();
  await settle(900);
  const cleared = await page.evaluate(() => {
    const el = document.querySelector('.submit-bar');
    return {
      visibility: getComputedStyle(el).visibility,
      ariaHidden: el.getAttribute('aria-hidden'),
      inText: document.body.innerText.includes('pick selected'),
    };
  });
  check('submit bar: hidden state is inert (not in the text/a11y tree)',
    cleared.visibility === 'hidden' && cleared.ariaHidden === 'true' && !cleared.inText,
    `vis ${cleared.visibility} aria-hidden ${cleared.ariaHidden} inText ${cleared.inText}`);
  check('submit bar: no runtime errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// The detail panel is a full-height right sheet and must not be clipped.
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await open('/predictions');
  const all = await page.$$('button');
  for (const b of all) {
    const t = (await b.evaluate((e) => e.textContent)) || '';
    if (t.includes('Will team 1 win')) { await b.click(); break; }
  }
  await settle(1000);
  const panel = await page.evaluate(() => {
    const aside = document.querySelector('[role="dialog"] aside');
    if (!aside) return null;
    const r = aside.getBoundingClientRect();
    const scroller = aside.querySelector('div[style*="overflow-y"]');
    return {
      fullHeight: Math.abs(r.height - window.innerHeight) < 2,
      rightEdge: Math.abs(r.right - window.innerWidth) < 2,
      bodyScrolls: scroller ? scroller.scrollHeight > scroller.clientHeight : false,
      footerVisible: (aside.innerText || '').includes('Points if correct'),
    };
  });
  check('detail panel: spans the full viewport height', panel?.fullHeight === true);
  check('detail panel: anchored to the right edge', panel?.rightEdge === true);
  check('detail panel: footer stays pinned and visible', panel?.footerVisible === true);
  check('detail panel: no runtime errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.p);
console.log(`\n================ ${results.length - failed.length}/${results.length} passed ================`);
for (const f of failed) console.log(`  FAIL: ${f.n}${f.d ? `  [${f.d}]` : ''}`);
process.exit(failed.length ? 1 : 0);
