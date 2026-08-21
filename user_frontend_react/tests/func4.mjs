import puppeteer from 'puppeteer-core';
import { stub, BASE } from './stubs.mjs';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const results = [];
const check = (n, p, d = '') => { results.push({ n, p, d }); console.log(`${p ? ' ok ' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`); };
const settle = (ms = 800) => new Promise((r) => setTimeout(r, ms));

async function open(route) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 950 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await stub(page);
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
  await settle(2200);
  return { ctx, page, errors };
}
const txt = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
const btn = async (page, needle, exact = false) => {
  for (const b of await page.$$('button')) {
    const t = ((await b.evaluate((e) => e.textContent)) || '').replace(/\s+/g, ' ').trim();
    if (exact ? t === needle : t.includes(needle)) return b;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Register -> OTP -> session
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await open('/register');
  check('register: form fields present',
    (await page.$$('input')).length >= 5, `${(await page.$$('input')).length} inputs (incl. the terms checkbox)`);
  check('register: terms checkbox pre-checked (matches the app default)',
    await page.$eval('input[type="checkbox"]', (el) => el.checked));

  // Submitting with empty fields must be rejected client-side.
  const create = await btn(page, 'Create account');
  await create.click();
  await settle(700);
  check('register: empty submit shows a validation toast', (await txt(page)).includes('Please fill in all fields.'));

  await page.type('input[aria-label="Full name"]', 'Ada Lovelace');
  await page.type('input[aria-label="Email"]', 'ada@example.com');
  await page.type('input[aria-label="Password"]', 'secret123');
  await page.type('input[aria-label="Confirm password"]', 'mismatch');
  await (await btn(page, 'Create account')).click();
  await settle(700);
  check('register: mismatched passwords rejected', (await txt(page)).includes('Passwords do not match.'));

  // Fix the confirmation and submit for real.
  await page.$eval('input[aria-label="Confirm password"]', (el) => { el.value = ''; });
  await page.type('input[aria-label="Confirm password"]', 'secret123');
  await (await btn(page, 'Create account')).click();
  await settle(1600);
  const otp = await txt(page);
  check('register: advances to the OTP step', otp.includes('Verify your email') && otp.includes('ada@example.com'));
  check('register: OTP boxes rendered (4 digits, per the backend)',
    (await page.$$('input[autocomplete="one-time-code"]')).length === 1
    && /Code expires in \d:\d\d/.test(otp), otp.match(/Code expires in \S+/)?.[0]);
  check('register: resend is on cooldown initially', /Resend in \d:\d\d/.test(otp), otp.match(/Resend in \S+/)?.[0]);

  await page.type('input[autocomplete="one-time-code"]', '1234');
  await settle(400);
  await (await btn(page, 'Verify & continue')).click();
  await settle(2000);
  check('register: verifying the OTP lands in the portal', page.url().endsWith('/predictions'), page.url());
  check('register: no runtime errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Forgot-password: 3-step wizard
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await open('/forgot-password');
  let body = await txt(page);
  check('forgot: step 1 copy + step dots', body.includes("we'll send you a reset code") && body.includes('Send code'));

  // Invalid email is caught before any request.
  await page.type('input[aria-label="Email"]', 'not-an-email');
  await (await btn(page, 'Send code')).click();
  await settle(600);
  check('forgot: invalid email blocked client-side',
    (await txt(page)).includes('Enter a valid email') && (await txt(page)).includes('Send code'));

  await page.$eval('input[aria-label="Email"]', (el) => { el.value = ''; });
  await page.type('input[aria-label="Email"]', 'ada@example.com');
  await (await btn(page, 'Send code')).click();
  await settle(1400);
  body = await txt(page);
  check('forgot: step 2 reached after sending', body.includes('Verify code') && body.includes('Enter code'));
  check('forgot: success toast shown', body.includes('Reset code sent to your email.'));

  // Short code rejected.
  await (await btn(page, 'Verify code')).click();
  await settle(600);
  check('forgot: short code rejected', (await txt(page)).includes('Enter the 4-digit code.'));

  await page.type('input[autocomplete="one-time-code"]', '1234');
  await settle(300);
  await (await btn(page, 'Verify code')).click();
  await settle(1400);
  body = await txt(page);
  check('forgot: step 3 reached', body.includes('Choose a new password') && body.includes('Update password'));

  await page.type('input[aria-label="New password"]', 'brandnew123');
  await (await btn(page, 'Update password')).click();
  await settle(1800);
  check('forgot: completing the reset returns to sign-in', page.url().endsWith('/login'), page.url());
  check('forgot: confirmation toast', (await txt(page)).includes('Password updated'));
  check('forgot: no runtime errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Login validation + the unverified-account -> OTP branch
// ---------------------------------------------------------------------------
{
  const { ctx, page, errors } = await open('/login');
  await (await btn(page, 'Sign in', true)).click();
  await settle(600);
  const body = await txt(page);
  check('login: empty submit shows field errors',
    body.includes('Email is required') && body.includes('Password is required'));

  await page.type('input[aria-label="Email"]', 'bad-email');
  await settle(300);
  check('login: live email validation', (await txt(page)).includes('Enter a valid email'));
  check('login: no runtime errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Sign out clears the session and returns to the public side
// ---------------------------------------------------------------------------
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 950 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await stub(page);
  await page.evaluateOnNewDocument(() => localStorage.setItem('gogeta_jwt', 't'));
  await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
  await settle(2400);

  await (await btn(page, 'Sign out')).click();
  await settle(700);
  check('sign out: confirmation dialog shown', (await txt(page)).includes('You can sign back in anytime.'));

  // Confirm inside the dialog.
  for (const b of await page.$$('button.btn-filled')) {
    const t = (await b.evaluate((e) => e.textContent)) || '';
    if (t.trim() === 'Sign out') { await b.click(); break; }
  }
  await settle(2000);
  check('sign out: session token cleared',
    (await page.evaluate(() => localStorage.getItem('gogeta_jwt'))) === null);
  check('sign out: guard bounces to /login', page.url().endsWith('/login'), page.url());
  check('sign out: no runtime errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.p);
console.log(`\n================ ${results.length - failed.length}/${results.length} passed ================`);
for (const f of failed) console.log(`  FAIL: ${f.n}${f.d ? `  [${f.d}]` : ''}`);
process.exit(failed.length ? 1 : 0);
