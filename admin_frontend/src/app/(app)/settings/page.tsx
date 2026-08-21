'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Banner, CmsPage, PointsStatus, Setting, WithdrawalsStatus } from '@/lib/types';
import { Badge, Button, Card, Field, MiniStat, Modal, Spinner, inputClass, selectClass } from '@/components/ui';
import { RichTextEditor, htmlIsEmpty } from '@/components/RichTextEditor';
import { ImageUpload } from '@/components/ImageUpload';

type Tab =
  | 'economy'
  | 'dailyBonus'
  | 'ads'
  | 'luckyDraw'
  | 'leaderboard'
  | 'predictionList'
  | 'site'
  | 'appUpdate'
  | 'notifications'
  | 'other'
  | 'banners'
  | 'cms'
  | 'broadcast';

const TAB_LABELS: Record<Tab, string> = {
  economy: 'Points Economy',
  dailyBonus: 'Daily Bonus',
  ads: 'Ads',
  luckyDraw: 'Lucky Draw',
  leaderboard: 'Leaderboard',
  predictionList: 'Prediction List',
  site: 'Site & Branding',
  appUpdate: 'App Update',
  notifications: 'Notifications',
  other: 'Other',
  banners: 'Banners',
  cms: 'CMS',
  broadcast: 'Broadcast',
};
// Order also drives display order in the tab strip.
const TAB_ORDER: Tab[] = [
  'economy',
  'dailyBonus',
  'ads',
  'luckyDraw',
  'leaderboard',
  'predictionList',
  'site',
  'appUpdate',
  'notifications',
  'other',
  'banners',
  'cms',
  'broadcast',
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('economy');

  // Deep-link: /settings#broadcast (etc.) lands on that tab directly.
  useEffect(() => {
    const hash = window.location.hash.slice(1) as Tab;
    if ((TAB_ORDER as string[]).includes(hash)) setTab(hash);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-zinc-500">Global configuration, banners and CMS pages.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {TAB_ORDER.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              tab === t ? 'bg-cyan-500/15 text-cyan-300' : 'text-zinc-400 hover:bg-zinc-800/60'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'economy' && <PointsEconomyTab />}
        {tab === 'dailyBonus' && <DailyBonusTab />}
        {tab === 'ads' && <AdsTab />}
        {tab === 'luckyDraw' && <LuckyDrawTab />}
        {tab === 'leaderboard' && <LeaderboardTab />}
        {tab === 'predictionList' && <PredictionListTab />}
        {tab === 'site' && <SiteTab />}
        {tab === 'appUpdate' && <AppUpdateTab />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'other' && <OtherSettingsTab />}
        {tab === 'banners' && <BannersTab />}
        {tab === 'cms' && <CmsTab />}
        {tab === 'broadcast' && <BroadcastTab />}
      </div>
    </div>
  );
}

function BroadcastTab() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; body?: string }>({});

  async function send() {
    setFieldErrors({});
    if (!title.trim() || !body.trim()) {
      setFieldErrors({
        title: !title.trim() ? 'Title is required.' : undefined,
        body: !body.trim() ? 'Message is required.' : undefined,
      });
      setErr('Title and message are required.');
      return;
    }
    if (!confirm(`Send "${title.trim()}" to ALL active users? This can't be recalled.`)) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await api<{ sent: number }>('/admin/notifications/broadcast', {
        method: 'POST',
        body: { title: title.trim(), body: body.trim() },
      });
      setResult(`Announcement delivered to ${res.sent.toLocaleString()} users.`);
      setTitle('');
      setBody('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-xl p-6">
      <h2 className="text-lg font-semibold">Broadcast announcement</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Sends an in-app notification to every active user — updates, promotions, downtime notices.
      </p>
      <div className="mt-4 space-y-3">
        <Field label={`Title (${title.length}/80)`} error={fieldErrors.title}>
          <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Weekend Mega Predictions are live! 🎉" className={inputClass} />
        </Field>
        <Field label={`Message (${body.length}/500)`} error={fieldErrors.body}>
          <textarea value={body} maxLength={500} rows={4} onChange={(e) => setBody(e.target.value)} placeholder="Open the Predict tab to join today's featured questions…" className={inputClass} />
        </Field>
        {err && <p className="text-sm text-rose-400">{err}</p>}
        {result && <p className="text-sm text-emerald-400">{result}</p>}
        <div className="flex justify-end">
          <Button onClick={send} disabled={busy}>{busy ? 'Sending…' : '📣 Send to all users'}</Button>
        </div>
      </div>
    </Card>
  );
}

/** Coin-economy knobs with SOW defaults — shown as a friendly labeled form. */
// Fallbacks mirror the backend's EconomyService.DEFAULTS. Reward amounts are
// 10% of the platform's original values (reduced when paid points arrived);
// entryFee is a cost, not a grant, so it is unchanged.
const ECONOMY_FIELDS: { key: string; label: string; hint: string; fallback: number }[] = [
  { key: 'economy.signupBonus', label: 'Welcome bonus', hint: 'Points granted on signup', fallback: 100 },
  { key: 'economy.entryFee', label: 'Default points', hint: 'Deducted from a user’s balance when they enter a prediction (used when a prediction doesn’t set its own Points)', fallback: 50 },
  { key: 'economy.correctReward', label: 'Default reward', hint: 'Credited to a user for a correct call (used when a prediction doesn’t set its own Reward)', fallback: 10 },
  { key: 'economy.luckyBonus', label: 'Lucky-draw bonus', hint: 'Points per lucky-draw winner', fallback: 50 },
  { key: 'economy.dailyLuckyWinners', label: 'Lucky winners / day', hint: 'Winners drawn per resolution day', fallback: 10 },
];

/** Daily login bonus — points granted automatically when the app calls
 *  /users/me (see backend DailyBonusService). Amount ships at 0 (feature
 *  off) until an admin sets a real value here. */
const DAILY_BONUS_NUMBER_FIELDS: { key: string; label: string; hint: string; fallback: number }[] = [
  { key: 'dailyBonus.amount', label: 'Amount', hint: 'Points granted per grant. 0 = feature off.', fallback: 0 },
  {
    key: 'dailyBonus.cooldownMinutes',
    label: 'Cooldown (minutes)',
    hint: 'Only applies in "Every app open" mode. 0 = no cooldown (grants on every open).',
    fallback: 0,
  },
];

/** AdMob ad-unit ids (runtime-configurable; served to the app via /config). */
const ADS_UNIT_FIELDS: { key: string; label: string; hint: string; testUnit: string }[] = [
  {
    key: 'ads.bannerAndroid',
    label: 'Banner unit ID — Android',
    hint: 'From the client AdMob console (app com.iki.app)',
    testUnit: 'ca-app-pub-3940256099942544/6300978111',
  },
  {
    key: 'ads.bannerIos',
    label: 'Banner unit ID — iOS',
    hint: 'From the client AdMob console (app com.ios.iki)',
    testUnit: 'ca-app-pub-3940256099942544/2934735716',
  },
];

/** Site branding/contact/meta — SOW §6 Global System Settings. */
const SITE_TEXT_FIELDS: { key: string; label: string; hint: string; placeholder?: string }[] = [
  { key: 'site.name', label: 'Site name', hint: 'Shown as the app/site name', placeholder: 'GOGETA' },
  { key: 'site.tagline', label: 'Tagline', hint: 'Short one-line description', placeholder: 'Predict · Compete · Earn' },
  { key: 'site.contactEmail', label: 'Contact email', hint: 'Support address shown to users', placeholder: 'hello@yesiki.com' },
  { key: 'site.contactPhone', label: 'Contact phone', hint: 'Optional — shown on the contact page', placeholder: '+1 555 0100' },
  { key: 'site.metaTitle', label: 'Meta title', hint: 'Browser-tab / SEO title for the web portal', placeholder: 'GOGETA — Predict & Earn' },
  { key: 'site.metaDescription', label: 'Meta description', hint: 'SEO description for the web portal' },
  { key: 'site.social.facebook', label: 'Facebook URL', hint: '', placeholder: 'https://facebook.com/…' },
  { key: 'site.social.twitter', label: 'Twitter / X URL', hint: '', placeholder: 'https://x.com/…' },
  { key: 'site.social.instagram', label: 'Instagram URL', hint: '', placeholder: 'https://instagram.com/…' },
  { key: 'site.social.website', label: 'Website URL', hint: '', placeholder: 'https://yesiki.com' },
];
// Native mobile app icons can't change without a rebuild + store
// resubmission, so there's no "upload app icon" field here — it would look
// live-editable but silently do nothing. Only the web portal's own visual
// assets (which genuinely take effect immediately) are configurable.
const SITE_IMAGE_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: 'site.logoUrl', label: 'Site logo', hint: 'Used on the web portal header and landing page' },
  { key: 'site.faviconUrl', label: 'Favicon', hint: 'Browser-tab icon for the web portal' },
];
const SITE_KEYS = new Set([...SITE_TEXT_FIELDS.map((f) => f.key), ...SITE_IMAGE_FIELDS.map((f) => f.key)]);

/** Force-update gate — minBuild is the platform build number (Android
 * versionCode / iOS CFBundleVersion, the integer after `+` in pubspec's
 * version — NOT the version name), below which the app blocks with an
 * update screen. 0 = no minimum set (never blocks). */
const APP_UPDATE_NUMBER_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: 'app.minBuildAndroid', label: 'Minimum build — Android', hint: 'Below this build number, the app blocks until updated. 0 = off' },
  { key: 'app.minBuildIos', label: 'Minimum build — iOS', hint: 'Below this build number, the app blocks until updated. 0 = off' },
];
const APP_UPDATE_TEXT_FIELDS: { key: string; label: string; hint: string; placeholder?: string }[] = [
  { key: 'app.storeUrlAndroid', label: 'Play Store URL', hint: 'Opened by the "Update Now" button on Android', placeholder: 'https://play.google.com/store/apps/details?id=com.iki.app' },
  { key: 'app.storeUrlIos', label: 'App Store URL', hint: 'Opened by the "Update Now" button on iOS', placeholder: 'https://apps.apple.com/app/id…' },
];
const APP_UPDATE_KEYS = new Set([
  ...APP_UPDATE_NUMBER_FIELDS.map((f) => f.key),
  ...APP_UPDATE_TEXT_FIELDS.map((f) => f.key),
  'app.updateMessage',
]);

/** Global on/off per automated notification type — SOW §6 "Notifications settings". */
const NOTIFICATION_TYPE_FIELDS: { type: string; label: string; hint: string }[] = [
  { type: 'SYSTEM', label: 'System / broadcast', hint: 'Manual announcements sent from the Broadcast tab' },
  { type: 'RESULT', label: 'Prediction results', hint: 'Sent when a prediction resolves (won or lost)' },
  { type: 'LUCKY', label: 'Lucky winner', hint: 'Sent to daily lucky-draw winners' },
  { type: 'BADGE', label: 'Badge earned', hint: 'Reserved for future badge-earned alerts' },
  { type: 'LEADERBOARD', label: 'Leaderboard', hint: 'Reserved for future leaderboard alerts' },
  { type: 'REMINDER', label: 'Reminders', hint: 'Reserved for future reminder alerts' },
];
const NOTIFICATION_KEYS = new Set(NOTIFICATION_TYPE_FIELDS.map((f) => `notifications.enabled.${f.type}`));

/** Buying points with USDC — its own card, since it needs the network status too. */
const PURCHASE_FIELDS: { key: string; label: string; hint: string; fallback: number }[] = [
  { key: 'economy.usdcToPoints', label: 'Points per USDC', hint: 'How many points 1 USDC buys. At 100, paying 10 USDC credits 1,000 points.', fallback: 100 },
  { key: 'economy.pointsMinPurchaseUsdc', label: 'Minimum purchase (USDC)', hint: 'Smallest amount a user may pay in one purchase.', fallback: 1 },
  { key: 'economy.pointsMaxPurchaseUsdc', label: 'Maximum purchase (USDC)', hint: 'Largest amount a user may pay in one purchase.', fallback: 1000 },
];

const ECONOMY_KEYS = new Set([
  ...ECONOMY_FIELDS.map((f) => f.key),
  ...PURCHASE_FIELDS.map((f) => f.key),
  'economy.rewardMode',
  'economy.pointsEnabled',
  'economy.pointsPurchaseEnabled',
  'economy.withdrawalsEnabled',
  'economy.minWithdrawalPoints',
  'economy.withdrawableLuckyBonus',
]);
const DAILY_BONUS_KEYS = new Set([...DAILY_BONUS_NUMBER_FIELDS.map((f) => f.key), 'dailyBonus.mode']);
const ADS_KEYS = new Set(['ads.enabled', 'ads.screens', ...ADS_UNIT_FIELDS.map((f) => f.key)]);
// Interstitial ads aren't implemented anywhere in the app — these are
// unused seed rows that would otherwise leak into "Other settings" as
// confusing raw keys with no real effect.
const UNUSED_KEYS = new Set(['ads.interstitialAndroid', 'ads.interstitialIos', 'ads.interstitialEveryN']);
const PREDICTION_LIST_KEYS = new Set([
  'predictionList.sortOptions',
  'predictionList.defaultSort',
  'predictionList.showOptions',
  'predictionList.defaultShow',
]);

/** Shared load/save/draft-parsing plumbing for every settings-backed tab
 *  below. Each tab calls this independently (same self-contained-tab
 *  pattern as Banners/CMS/Broadcast) so it always has the latest saved
 *  values whenever it's selected. */
function useSettingsDrafts() {
  const [items, setItems] = useState<Setting[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<Setting[]>('/admin/settings');
      setItems(res);
      setDrafts(Object.fromEntries(res.map((s) => [s.key, typeof s.value === 'string' ? s.value : JSON.stringify(s.value)])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(key: string, value: unknown, describe: string) {
    if (!confirm(`Save ${describe}? This changes the live app immediately.`)) return;
    await saveSilent(key, value);
  }

  /** Same as `save`, minus the confirm prompt — for sections that auto-save
   *  on every change (e.g. Screen visibility toggles), where a confirm
   *  dialog per click would defeat the point of auto-saving. */
  async function saveSilent(key: string, value: unknown) {
    try {
      await api(`/admin/settings/${key}`, { method: 'PUT', body: { value } });
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2500);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  }

  /** Numbers stay numbers, valid JSON stays JSON, everything else a string. */
  function parseDraft(raw: string): unknown {
    const trimmed = raw.trim();
    if (trimmed !== '' && !isNaN(Number(trimmed))) return Number(trimmed);
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }

  const draftFor = (key: string, fallback: number) => drafts[key] ?? String(fallback);
  const draftStr = (key: string) => drafts[key] ?? '';

  return { items, drafts, setDrafts, error, savedKey, save, saveSilent, parseDraft, draftFor, draftStr };
}

/** Numeric-field grid shared by several tabs (Points economy, Daily Bonus,
 *  App update) — a labeled card with a number input + per-field Save. */
function NumberFieldsGrid({
  fields,
  drafts,
  setDrafts,
  savedKey,
  save,
  describe,
  cols = 'sm:grid-cols-2 lg:grid-cols-3',
}: {
  fields: { key: string; label: string; hint: string; fallback: number }[];
  drafts: Record<string, string>;
  setDrafts: (fn: (d: Record<string, string>) => Record<string, string>) => void;
  savedKey: string | null;
  save: (key: string, value: unknown, describe: string) => void;
  describe: (label: string, n: number) => string;
  cols?: string;
}) {
  return (
    <div className={`mt-4 grid grid-cols-1 gap-4 ${cols}`}>
      {fields.map((f) => {
        const raw = drafts[f.key] ?? String(f.fallback);
        const n = Number(raw);
        const invalid = raw.trim() === '' || isNaN(n) || n < 0 || !Number.isInteger(n);
        return (
          <div key={f.key} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-sm font-medium text-zinc-200">{f.label}</div>
            <div className="text-xs text-zinc-500">{f.hint}</div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={raw}
                onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
                className={inputClass + (invalid ? ' border-rose-500/60' : '')}
              />
              <Button variant="ghost" disabled={invalid} onClick={() => save(f.key, n, describe(f.label, n))}>
                {savedKey === f.key ? '✓ Saved' : 'Save'}
              </Button>
            </div>
            {invalid && <p className="mt-1 text-xs text-rose-400">Enter a whole number ≥ 0.</p>}
          </div>
        );
      })}
    </div>
  );
}

function PointsEconomyTab() {
  const { items, drafts, setDrafts, error, savedKey, save } = useSettingsDrafts();
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!items) return <Spinner />;
  const pointsEnabled = drafts['economy.pointsEnabled'] !== 'false';
  const defaultPointsField = ECONOMY_FIELDS.find((f) => f.key === 'economy.entryFee')!;
  const welcomeBonusField = ECONOMY_FIELDS.find((f) => f.key === 'economy.signupBonus')!;
  const otherFields = ECONOMY_FIELDS.filter((f) => f.key !== 'economy.entryFee' && f.key !== 'economy.signupBonus');
  const dpRaw = drafts[defaultPointsField.key] ?? String(defaultPointsField.fallback);
  const dpN = Number(dpRaw);
  const dpInvalid = dpRaw.trim() === '' || isNaN(dpN) || dpN < 0 || !Number.isInteger(dpN);
  const wbRaw = drafts[welcomeBonusField.key] ?? String(welcomeBonusField.fallback);
  const wbN = Number(wbRaw);
  const wbInvalid = wbRaw.trim() === '' || isNaN(wbN) || wbN < 0 || !Number.isInteger(wbN);
  return (
    <div className="space-y-6">
      <Card className="p-6">
      <h2 className="text-lg font-semibold">Points economy</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Rewards and fees used by the app — changes apply to new activity immediately.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="text-sm font-medium text-zinc-200">{welcomeBonusField.label}</div>
          <div className="text-xs text-zinc-500">{welcomeBonusField.hint}</div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={wbRaw}
              onChange={(e) => setDrafts((d) => ({ ...d, [welcomeBonusField.key]: e.target.value }))}
              className={inputClass + (wbInvalid ? ' border-rose-500/60' : '')}
            />
            <Button
              variant="ghost"
              disabled={wbInvalid}
              onClick={() => save(welcomeBonusField.key, wbN, `${welcomeBonusField.label} = ${wbN} points`)}
            >
              {savedKey === welcomeBonusField.key ? '✓ Saved' : 'Save'}
            </Button>
          </div>
          {wbInvalid && <p className="mt-1 text-xs text-rose-400">Enter a whole number ≥ 0.</p>}
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-zinc-200">{defaultPointsField.label}</div>
              <div className="text-xs text-zinc-500">{defaultPointsField.hint}</div>
            </div>
            <button
              onClick={() =>
                save('economy.pointsEnabled', !pointsEnabled, `Points economy ${pointsEnabled ? 'OFF' : 'ON'}`)
              }
              className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
                pointsEnabled ? 'bg-cyan-500' : 'bg-zinc-700'
              }`}
              aria-label="Toggle points economy"
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  pointsEnabled ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={dpRaw}
              onChange={(e) => setDrafts((d) => ({ ...d, [defaultPointsField.key]: e.target.value }))}
              className={inputClass + (dpInvalid ? ' border-rose-500/60' : '')}
            />
            <Button
              variant="ghost"
              disabled={dpInvalid}
              onClick={() => save(defaultPointsField.key, dpN, `${defaultPointsField.label} = ${dpN} points`)}
            >
              {savedKey === defaultPointsField.key ? '✓ Saved' : 'Save'}
            </Button>
          </div>
          {dpInvalid && <p className="mt-1 text-xs text-rose-400">Enter a whole number ≥ 0.</p>}
          <p className="mt-2 text-xs text-amber-200/80">
            Turn off if app in review — every prediction becomes completely free (no deduction) and no
            Points/Reward summary is shown anywhere in the app, for every prediction old and new, regardless
            of its own Points value.
          </p>
        </div>
        {otherFields.map((f) => {
          const raw = drafts[f.key] ?? String(f.fallback);
          const n = Number(raw);
          const invalid = raw.trim() === '' || isNaN(n) || n < 0 || !Number.isInteger(n);
          return (
            <div key={f.key} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-sm font-medium text-zinc-200">{f.label}</div>
              <div className="text-xs text-zinc-500">{f.hint}</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={raw}
                  onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
                  className={inputClass + (invalid ? ' border-rose-500/60' : '')}
                />
                <Button variant="ghost" disabled={invalid} onClick={() => save(f.key, n, `${f.label} = ${n} points`)}>
                  {savedKey === f.key ? '✓ Saved' : 'Save'}
                </Button>
              </div>
              {invalid && <p className="mt-1 text-xs text-rose-400">Enter a whole number ≥ 0.</p>}
            </div>
          );
        })}
      </div>
      </Card>

      <BuyPointsSettingsCard
        drafts={drafts}
        setDrafts={setDrafts}
        savedKey={savedKey}
        save={save}
      />

      <WithdrawalSettingsCard
        drafts={drafts}
        setDrafts={setDrafts}
        savedKey={savedKey}
        save={save}
      />
    </div>
  );
}

/**
 * Cashing points out (new_features.md §36).
 *
 * The payout rate is deliberately absent: withdrawals use the same
 * `economy.usdcToPoints` rate purchases do, so a separate field here would let
 * the two drift apart and let points be bought at one price and sold at another.
 */
function WithdrawalSettingsCard({
  drafts,
  setDrafts,
  savedKey,
  save,
}: {
  drafts: Record<string, string>;
  setDrafts: (fn: (d: Record<string, string>) => Record<string, string>) => void;
  savedKey: string | null;
  save: (key: string, value: unknown, describe: string) => void;
}) {
  const [status, setStatus] = useState<WithdrawalsStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await api<WithdrawalsStatus>('/admin/withdrawals/status'));
      setStatusError(null);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : 'Could not read the withdrawal status.');
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const enabled = drafts['economy.withdrawalsEnabled'] !== 'false';
  const luckyWithdrawable = drafts['economy.withdrawableLuckyBonus'] === 'true';
  const minRaw = drafts['economy.minWithdrawalPoints'] ?? '1000';
  const minN = Number(minRaw);
  const minInvalid = minRaw.trim() === '' || isNaN(minN) || minN < 1 || !Number.isInteger(minN);
  const symbol = status?.network.tokenSymbol ?? 'USDC';

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Withdraw points to {symbol}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Lets users request a payout of their withdrawable points. Requests are reviewed in
            Withdrawals; points are debited only after a payout is verified on-chain.
          </p>
        </div>
        <button
          onClick={() => {
            save(
              'economy.withdrawalsEnabled',
              !enabled,
              `Withdrawals ${enabled ? 'OFF' : 'ON'}`,
            );
            setTimeout(loadStatus, 400);
          }}
          className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${
            enabled ? 'bg-cyan-500' : 'bg-zinc-700'
          }`}
          aria-label="Toggle withdrawals"
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
              enabled ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {statusError ? (
        <p className="mt-4 text-sm text-rose-400">{statusError}</p>
      ) : !status ? (
        <div className="mt-4"><Spinner /></div>
      ) : (
        <div className="mt-4 space-y-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm">
          <StatusLine
            ok={status.enabled}
            label={status.enabled ? 'Withdrawals are live' : 'Withdrawals are unavailable'}
          />
          {status.configError && <p className="text-xs text-amber-300">{status.configError}</p>}
          <StatusLine
            ok={status.rpcReachable}
            label={
              !status.rpcReachable
                ? 'The Solana RPC is unreachable — payouts cannot be verified'
                : true
                  ? `Connected to ${status.network.networkName}`
                  : `RPC error`
            }
          />
          <StatusLine
            ok={!!status.network.treasuryAddress}
            label={
              status.network.treasuryAddress
                ? `Payouts must be sent from ${status.network.treasuryAddress}`
                : 'No treasury wallet configured (WITHDRAWAL_TREASURY_ADDRESS)'
            }
          />
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 pt-1 text-xs text-zinc-500 sm:grid-cols-2">
            <div className="break-all">
              {symbol} mint: {status.network.tokenMint}
            </div>
            <div>Token decimals: {status.network.tokenDecimals}</div>
            <div>
              Rate: {status.rules.pointsPerToken} points per {symbol} (shared with purchases)
            </div>
          </div>
          <p className="pt-1 text-xs text-zinc-600">
            The payout token and treasury wallet come from the backend&apos;s environment, not from
            these settings — they need a deploy to change. The backend never holds the treasury key;
            an admin sends each payout themselves, or pastes the transaction signature.
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="text-sm font-medium text-zinc-200">Minimum withdrawal (points)</div>
          <div className="text-xs text-zinc-500">
            Smallest request a user may submit. At {status?.rules.pointsPerToken ?? 100} points per{' '}
            {symbol}, {minInvalid ? '—' : minN.toLocaleString()} points is{' '}
            {minInvalid || !status
              ? '—'
              : (minN / status.rules.pointsPerToken).toFixed(2)}{' '}
            {symbol}.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={minRaw}
              onChange={(e) =>
                setDrafts((d) => ({ ...d, 'economy.minWithdrawalPoints': e.target.value }))
              }
              className={inputClass + (minInvalid ? ' border-rose-500/60' : '')}
            />
            <Button
              variant="ghost"
              disabled={minInvalid}
              onClick={() => {
                save('economy.minWithdrawalPoints', minN, `Minimum withdrawal = ${minN}`);
                setTimeout(loadStatus, 400);
              }}
            >
              {savedKey === 'economy.minWithdrawalPoints' ? '✓ Saved' : 'Save'}
            </Button>
          </div>
          {minInvalid && <p className="mt-1 text-xs text-rose-400">Enter a whole number ≥ 1.</p>}
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="text-sm font-medium text-zinc-200">Lucky-draw bonus is withdrawable</div>
          <div className="text-xs text-zinc-500">
            Off by default. Purchased points and points earned from predictions and quizzes are always
            withdrawable; signup and promotional points never are.
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => {
                save(
                  'economy.withdrawableLuckyBonus',
                  !luckyWithdrawable,
                  `Lucky bonus withdrawable ${luckyWithdrawable ? 'OFF' : 'ON'}`,
                );
                setTimeout(loadStatus, 400);
              }}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                luckyWithdrawable ? 'bg-cyan-500' : 'bg-zinc-700'
              }`}
              aria-label="Toggle lucky bonus withdrawable"
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  luckyWithdrawable ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
            <span className="text-sm text-zinc-400">
              {luckyWithdrawable ? 'Counts toward withdrawable points' : 'Excluded'}
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-600">
            Turning this on raises what existing users may withdraw, since eligibility is recomputed
            from the whole ledger each time.
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Buying points with USDC (SPL) on Solana.
 *
 * Shows the live deployment status alongside the editable rate/bounds, because
 * the most common reason purchasing is unavailable is an unset receiving
 * address or an unreachable RPC — neither of which is visible from the settings
 * values alone.
 */
function BuyPointsSettingsCard({
  drafts,
  setDrafts,
  savedKey,
  save,
}: {
  drafts: Record<string, string>;
  setDrafts: (fn: (d: Record<string, string>) => Record<string, string>) => void;
  savedKey: string | null;
  save: (key: string, value: unknown, describe: string) => void;
}) {
  const [status, setStatus] = useState<PointsStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await api<PointsStatus>('/admin/points/status'));
      setStatusError(null);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : 'Could not read the purchase status.');
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const purchaseEnabled = drafts['economy.pointsPurchaseEnabled'] !== 'false';

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Buy points with USDC</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Lets users purchase points by paying USDC on Solana. Points are credited only after the
            backend has verified the payment on-chain.
          </p>
        </div>
        <button
          onClick={() => {
            save(
              'economy.pointsPurchaseEnabled',
              !purchaseEnabled,
              `Buying points ${purchaseEnabled ? 'OFF' : 'ON'}`,
            );
            setTimeout(loadStatus, 400);
          }}
          className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${
            purchaseEnabled ? 'bg-cyan-500' : 'bg-zinc-700'
          }`}
          aria-label="Toggle buying points"
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
              purchaseEnabled ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {/* Deployment status — what an operator needs to know before blaming the settings. */}
      {statusError ? (
        <p className="mt-4 text-sm text-rose-400">{statusError}</p>
      ) : !status ? (
        <div className="mt-4"><Spinner /></div>
      ) : (
        <div className="mt-4 space-y-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm">
          <StatusLine
            ok={status.enabled}
            label={status.enabled ? 'Purchasing is live' : 'Purchasing is unavailable'}
          />
          {status.configError && (
            <p className="text-xs text-amber-300">{status.configError}</p>
          )}
          <StatusLine
            ok={status.rpcReachable}
            label={
              !status.rpcReachable
                ? 'The Solana RPC is unreachable'
                : true
                  ? `Connected to ${status.network.networkName}`
                  : `RPC error`
            }
          />
          <StatusLine
            ok={!!status.network.receiverAddress}
            label={
              status.network.receiverAddress
                ? `Payments received at ${status.network.receiverAddress}`
                : 'No receiving wallet configured (POINTS_PURCHASE_RECEIVER_ADDRESS)'
            }
          />
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 pt-1 text-xs text-zinc-500 sm:grid-cols-2">
            <div className="break-all">USDC mint: {status.network.usdcMint}</div>
            <div>Token decimals: {status.network.usdcDecimals}</div>
            <div className="break-all">RPC: {status.network.rpcUrl}</div>
            <div className="break-all">Explorer: {status.network.explorerUrl}</div>
          </div>
          <p className="pt-1 text-xs text-zinc-600">
            The network, token address and receiving wallet come from the backend&apos;s environment, not
            from these settings — they need a deploy to change.
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PURCHASE_FIELDS.map((f) => {
          const raw = drafts[f.key] ?? String(f.fallback);
          const n = Number(raw);
          const invalid = raw.trim() === '' || isNaN(n) || n < 0 || !Number.isInteger(n);
          return (
            <div key={f.key} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-sm font-medium text-zinc-200">{f.label}</div>
              <div className="text-xs text-zinc-500">{f.hint}</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={raw}
                  onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
                  className={inputClass + (invalid ? ' border-rose-500/60' : '')}
                />
                <Button
                  variant="ghost"
                  disabled={invalid}
                  onClick={() => {
                    save(f.key, n, `${f.label} = ${n}`);
                    setTimeout(loadStatus, 400);
                  }}
                >
                  {savedKey === f.key ? '✓ Saved' : 'Save'}
                </Button>
              </div>
              {invalid && <p className="mt-1 text-xs text-rose-400">Enter a whole number ≥ 0.</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function StatusLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={ok ? 'text-emerald-400' : 'text-rose-400'}>{ok ? '✓' : '✕'}</span>
      <span className={ok ? 'text-zinc-300' : 'text-rose-300'}>{label}</span>
    </div>
  );
}

function DailyBonusTab() {
  const { items, drafts, setDrafts, error, savedKey, save } = useSettingsDrafts();
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!items) return <Spinner />;
  const dailyBonusMode = (drafts['dailyBonus.mode'] ?? 'ONCE_PER_DAY') as 'ONCE_PER_DAY' | 'EVERY_SESSION';
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Daily Bonus</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Points granted automatically when a user opens the app (validated server-side, not client-controlled).
        Amount is 0 by default — the feature is off until set here.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="text-sm font-medium text-zinc-200">Mode</div>
          <div className="text-xs text-zinc-500">Once per calendar day, or again on every app open.</div>
          <div className="mt-2 flex items-center gap-2">
            <select
              value={dailyBonusMode}
              onChange={(e) => setDrafts((d) => ({ ...d, 'dailyBonus.mode': e.target.value }))}
              className={selectClass}
            >
              <option value="ONCE_PER_DAY">Once per day</option>
              <option value="EVERY_SESSION">Every app open</option>
            </select>
            <Button
              variant="ghost"
              onClick={() => save('dailyBonus.mode', dailyBonusMode, `Daily bonus mode = ${dailyBonusMode}`)}
            >
              {savedKey === 'dailyBonus.mode' ? '✓ Saved' : 'Save'}
            </Button>
          </div>
        </div>
        {DAILY_BONUS_NUMBER_FIELDS.map((f) => {
          const raw = drafts[f.key] ?? String(f.fallback);
          const n = Number(raw);
          const invalid = raw.trim() === '' || isNaN(n) || n < 0 || !Number.isInteger(n);
          return (
            <div key={f.key} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-sm font-medium text-zinc-200">{f.label}</div>
              <div className="text-xs text-zinc-500">{f.hint}</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={raw}
                  onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
                  className={inputClass + (invalid ? ' border-rose-500/60' : '')}
                />
                <Button variant="ghost" disabled={invalid} onClick={() => save(f.key, n, `${f.label} = ${n}`)}>
                  {savedKey === f.key ? '✓ Saved' : 'Save'}
                </Button>
              </div>
              {invalid && <p className="mt-1 text-xs text-rose-400">Enter a whole number ≥ 0.</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function AdsTab() {
  const { items, drafts, setDrafts, error, savedKey, save, saveSilent } = useSettingsDrafts();
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!items) return <Spinner />;
  const adsEnabled = drafts['ads.enabled'] === 'true';
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Ads (AdMob)</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Banner ads shown in the mobile app. Changes reach users on their next app launch.
            </p>
          </div>
          <button
            onClick={() => save('ads.enabled', !adsEnabled, `Ads ${adsEnabled ? 'OFF' : 'ON'}`)}
            className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${
              adsEnabled ? 'bg-cyan-500' : 'bg-zinc-700'
            }`}
            aria-label="Toggle ads"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                adsEnabled ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {ADS_UNIT_FIELDS.map((f) => {
            const raw = drafts[f.key] ?? '';
            const isTestUnit = raw.trim() === f.testUnit;
            return (
              <div key={f.key} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-zinc-200">{f.label}</div>
                  {isTestUnit && <Badge color="amber">Google test unit</Badge>}
                </div>
                <div className="text-xs text-zinc-500">{f.hint}</div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={raw}
                    onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
                    placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/NNNNNNNNNN"
                    className={inputClass + ' font-mono text-xs'}
                  />
                  <Button variant="ghost" onClick={() => save(f.key, drafts[f.key]?.trim() ?? '', f.label)}>
                    {savedKey === f.key ? '✓ Saved' : 'Save'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90">
          ⚠ The AdMob <span className="font-semibold">App ID</span>{' '}is embedded in the app binaries and is
          currently Google&apos;s test App ID. When the client shares their AdMob account, the App IDs go into a
          new app build — only the ad <span className="font-semibold">unit IDs</span> above apply without an
          app update.
        </p>
      </Card>

      <AdScreensEditor items={items} save={saveSilent} savedKey={savedKey} />
    </div>
  );
}

/** Per-screen ad on/off + Predictions-feed cadence knobs — one JSON object
 *  setting (`ads.screens`), unlike the flat scalar keys above. Saved as a
 *  single PUT of the whole merged object via the same `save()` plumbing
 *  every other Ads field uses, so Save/refetch behaves identically. */
type AdScreenToggleKey =
  | 'home'
  | 'leaderboard'
  | 'luckyWinners'
  | 'rewards'
  | 'coinHistory'
  | 'profile'
  | 'levels'
  | 'predictionDetail'
  | 'result'
  | 'history';

type AdScreensValue = Record<AdScreenToggleKey, { enabled: boolean }> & {
  predictions: { enabled: boolean; feedGapPattern: number[]; myPicksRepeatEvery: number };
};

const AD_SCREEN_ROWS: { key: AdScreenToggleKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'luckyWinners', label: 'Lucky Winners' },
  { key: 'rewards', label: 'Rewards' },
  { key: 'coinHistory', label: 'Coin History' },
  { key: 'profile', label: 'Profile' },
  { key: 'levels', label: 'Levels' },
  { key: 'predictionDetail', label: 'Prediction Detail' },
  { key: 'result', label: 'Result' },
  { key: 'history', label: 'History' },
];

const AD_SCREENS_DEFAULT: AdScreensValue = {
  home: { enabled: true },
  leaderboard: { enabled: true },
  luckyWinners: { enabled: true },
  rewards: { enabled: true },
  coinHistory: { enabled: true },
  profile: { enabled: true },
  levels: { enabled: true },
  predictionDetail: { enabled: true },
  result: { enabled: true },
  history: { enabled: true },
  predictions: { enabled: true, feedGapPattern: [2, 3, 5], myPicksRepeatEvery: 2 },
};

/** Tolerant of a missing key (first time this ships), a partially-saved
 *  object (older shape), or garbage — always returns every field. */
function normalizeAdScreens(raw: unknown): AdScreensValue {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const enabledOf = (key: string) => {
    const v = r[key];
    return !(v && typeof v === 'object' && (v as { enabled?: unknown }).enabled === false);
  };
  const p = r.predictions && typeof r.predictions === 'object' ? (r.predictions as Record<string, unknown>) : {};
  const gap = Array.isArray(p.feedGapPattern)
    ? p.feedGapPattern.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0)
    : [];
  const repeatEvery = typeof p.myPicksRepeatEvery === 'number' && Number.isInteger(p.myPicksRepeatEvery) && p.myPicksRepeatEvery > 0
    ? p.myPicksRepeatEvery
    : AD_SCREENS_DEFAULT.predictions.myPicksRepeatEvery;

  const out = {} as AdScreensValue;
  for (const row of AD_SCREEN_ROWS) out[row.key] = { enabled: enabledOf(row.key) };
  out.predictions = {
    enabled: p.enabled !== false,
    feedGapPattern: gap.length > 0 ? gap : AD_SCREENS_DEFAULT.predictions.feedGapPattern,
    myPicksRepeatEvery: repeatEvery,
  };
  return out;
}

function AdScreensEditor({
  items,
  save,
  savedKey,
}: {
  items: Setting[];
  save: (key: string, value: unknown) => void;
  savedKey: string | null;
}) {
  const [screens, setScreens] = useState<AdScreensValue>(AD_SCREENS_DEFAULT);

  useEffect(() => {
    const found = items.find((s) => s.key === 'ads.screens');
    setScreens(normalizeAdScreens(found?.value));
  }, [items]);

  function isValid(s: AdScreensValue) {
    const gap = s.predictions.feedGapPattern;
    const gapOk = gap.length > 0 && gap.every((n) => Number.isInteger(n) && n > 0);
    const repeatOk = Number.isInteger(s.predictions.myPicksRepeatEvery) && s.predictions.myPicksRepeatEvery > 0;
    return gapOk && repeatOk;
  }

  // Every toggle/reorder/add/remove auto-saves immediately — there's no
  // separate Save button for this section (unlike the scalar fields above),
  // so a toggle can never silently go unsaved. Only skipped when the result
  // is momentarily invalid (e.g. gap pattern emptied by Remove) — local
  // state still updates so the admin can fix it, and the next valid change
  // saves normally.
  //
  // `setScreens` is called with a plain value (not an updater function) and
  // the save() side effect happens separately, outside of it — React 18
  // Strict Mode's dev-only double-invoke of updater *functions* was firing
  // save() twice per click when it lived inside `setScreens(prev => ...)`.
  function apply(next: AdScreensValue) {
    setScreens(next);
    if (isValid(next)) save('ads.screens', next);
  }

  function toggleScreen(key: AdScreenToggleKey) {
    apply({ ...screens, [key]: { enabled: !screens[key].enabled } });
  }
  function togglePredictions() {
    apply({ ...screens, predictions: { ...screens.predictions, enabled: !screens.predictions.enabled } });
  }
  function addGapStep() {
    apply({
      ...screens,
      predictions: { ...screens.predictions, feedGapPattern: [...screens.predictions.feedGapPattern, 1] },
    });
  }
  function removeGapStep(i: number) {
    apply({
      ...screens,
      predictions: {
        ...screens.predictions,
        feedGapPattern: screens.predictions.feedGapPattern.filter((_, idx) => idx !== i),
      },
    });
  }
  function moveGapStep(i: number, dir: -1 | 1) {
    const j = i + dir;
    const arr = screens.predictions.feedGapPattern;
    if (j < 0 || j >= arr.length) return;
    const next = [...arr];
    [next[i], next[j]] = [next[j], next[i]];
    apply({ ...screens, predictions: { ...screens.predictions, feedGapPattern: next } });
  }
  // Typed fields update local state per keystroke (so the input feels
  // responsive) but only auto-save on blur — saving on every keystroke would
  // fire a request per digit and could briefly persist a half-typed number.
  function setGapStepValue(i: number, raw: string) {
    const n = Number(raw);
    setScreens((s) => {
      const next = [...s.predictions.feedGapPattern];
      next[i] = Number.isFinite(n) ? n : 0;
      return { ...s, predictions: { ...s.predictions, feedGapPattern: next } };
    });
  }
  function setRepeatEvery(raw: string) {
    const n = Number(raw);
    setScreens((s) => ({
      ...s,
      predictions: { ...s.predictions, myPicksRepeatEvery: Number.isFinite(n) ? n : 0 },
    }));
  }
  function saveIfValid() {
    if (isValid(screens)) save('ads.screens', screens);
  }

  const gapPattern = screens.predictions.feedGapPattern;
  const gapEmpty = gapPattern.length === 0;
  const gapInvalid = gapEmpty || gapPattern.some((n) => !Number.isInteger(n) || n <= 0);
  const repeatInvalid = !Number.isInteger(screens.predictions.myPicksRepeatEvery) || screens.predictions.myPicksRepeatEvery <= 0;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Screen visibility</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Per-screen ad on/off — each only shows ads when this switch and the global Ads switch above are
            both on. Saves automatically as you change it; changes reach users on their next app launch.
          </p>
        </div>
        {savedKey === 'ads.screens' && <span className="mt-1 text-xs text-emerald-400">✓ Saved</span>}
      </div>

      <div className="mt-4 divide-y divide-zinc-800 rounded-xl border border-white/5">
        {AD_SCREEN_ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3 p-3">
            <div className="text-sm text-zinc-300">{row.label}</div>
            <button
              onClick={() => toggleScreen(row.key)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                screens[row.key].enabled ? 'bg-cyan-500' : 'bg-zinc-700'
              }`}
              aria-label={`Toggle ${row.label} ads`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  screens[row.key].enabled ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        ))}

        <div className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-zinc-300">Predict the Day</div>
              <div className="text-xs text-zinc-500">The Predictions screen — main feed &amp; My Picks</div>
            </div>
            <button
              onClick={togglePredictions}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                screens.predictions.enabled ? 'bg-cyan-500' : 'bg-zinc-700'
              }`}
              aria-label="Toggle Predict the Day ads"
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  screens.predictions.enabled ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div className="text-xs font-medium text-zinc-300">List index placement (main feed)</div>
            <p className="mt-0.5 text-xs text-zinc-500">
              Which list item index an ad appears after — 2, 3, 5 → ad after item 2, then 3 more, then 5 more, repeating.
            </p>
            <div className="mt-2 space-y-2">
              {gapPattern.map((n, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex flex-col leading-none">
                    <button
                      disabled={i === 0}
                      onClick={() => moveGapStep(i, -1)}
                      className="px-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-25"
                      aria-label={`Move step ${i + 1} up`}
                    >
                      ▲
                    </button>
                    <button
                      disabled={i === gapPattern.length - 1}
                      onClick={() => moveGapStep(i, 1)}
                      className="px-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-25"
                      aria-label={`Move step ${i + 1} down`}
                    >
                      ▼
                    </button>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={n}
                    onChange={(e) => setGapStepValue(i, e.target.value)}
                    onBlur={saveIfValid}
                    className={inputClass + ' w-24' + (!Number.isInteger(n) || n <= 0 ? ' border-rose-500/60' : '')}
                  />
                  <button onClick={() => removeGapStep(i)} className="text-xs text-rose-400 hover:text-rose-300">
                    Remove
                  </button>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={addGapStep}>
                + Add step
              </Button>
            </div>
            {gapInvalid && (
              <p className="mt-2 text-xs text-rose-400">
                {gapEmpty ? 'Add at least one step — the pattern can’t be empty.' : 'Each step must be a whole number ≥ 1.'}
              </p>
            )}
          </div>

          <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div className="text-xs font-medium text-zinc-300">List index placement (My Picks tab)</div>
            <p className="mt-0.5 text-xs text-zinc-500">Ad appears after this item index in the My Picks list.</p>
            <input
              type="number"
              min={1}
              value={screens.predictions.myPicksRepeatEvery}
              onChange={(e) => setRepeatEvery(e.target.value)}
              onBlur={saveIfValid}
              className={inputClass + ' mt-2 w-24' + (repeatInvalid ? ' border-rose-500/60' : '')}
            />
            {repeatInvalid && <p className="mt-1 text-xs text-rose-400">Enter a whole number ≥ 1.</p>}
          </div>
        </div>
      </div>
    </Card>
  );
}

const LUCKY_DRAW_TEXT_FIELDS = [
  {
    key: 'luckyDraw.label',
    label: 'Feature name',
    placeholder: 'Lucky Draw',
    hint: 'Shown as the screen title and home banner heading. Kept separate from "Leaderboard" so the two features aren’t confused.',
  },
  {
    key: 'luckyDraw.tagline',
    label: 'Tagline',
    placeholder: 'See if you won today.',
    hint: 'Subtitle shown under the feature name.',
  },
];

function LuckyDrawTab() {
  const { items, drafts, setDrafts, error, savedKey, save, draftStr } = useSettingsDrafts();
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!items) return <Spinner />;
  // Default ON (unlike ads) - matches the backend's default-true behavior
  // when the setting has never been saved.
  const luckyDrawEnabled = drafts['luckyDraw.enabled'] !== 'false';
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Daily Lucky Draw</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Shows the Daily Lucky Draw banner and Lucky Winners screen in the app. On by default.
          </p>
        </div>
        <button
          onClick={() =>
            save('luckyDraw.enabled', !luckyDrawEnabled, `Lucky draw ${luckyDrawEnabled ? 'OFF' : 'ON'}`)
          }
          className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${
            luckyDrawEnabled ? 'bg-cyan-500' : 'bg-zinc-700'
          }`}
          aria-label="Toggle lucky draw"
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
              luckyDrawEnabled ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {LUCKY_DRAW_TEXT_FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <div className="flex items-center gap-2">
              <input
                value={draftStr(f.key)}
                placeholder={f.placeholder}
                onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
                className={inputClass}
              />
              <Button variant="ghost" onClick={() => save(f.key, drafts[f.key]?.trim() ?? '', f.label)}>
                {savedKey === f.key ? '✓ Saved' : 'Save'}
              </Button>
            </div>
            <p className="mt-1 text-xs text-zinc-500">{f.hint}</p>
          </Field>
        ))}
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Changing these updates the app and web portal immediately via <code className="font-mono text-xs">/config</code> — no app-store update needed.
      </p>
    </Card>
  );
}

function LeaderboardTab() {
  const { items, drafts, setDrafts, error, savedKey, save } = useSettingsDrafts();
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!items) return <Spinner />;
  const rankingMode = drafts['leaderboard.rankingMode'] === 'sow' ? 'sow' : 'coins';
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Leaderboard ranking</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Choose how the Daily / Weekly / Monthly leaderboards rank users. Default is Coins, unchanged from
        launch behavior.
      </p>
      <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="text-sm font-medium text-zinc-200">Ranking mode</div>
        <div className="mt-2 flex items-center gap-2">
          <select
            value={rankingMode}
            onChange={(e) => setDrafts((d) => ({ ...d, 'leaderboard.rankingMode': e.target.value }))}
            className={selectClass}
          >
            <option value="coins">Coins (simple)</option>
            <option value="sow">SOW-compliant</option>
          </select>
          <Button
            variant="ghost"
            onClick={() => save('leaderboard.rankingMode', rankingMode, `Leaderboard ranking = ${rankingMode}`)}
          >
            {savedKey === 'leaderboard.rankingMode' ? '✓ Saved' : 'Save'}
          </Button>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-zinc-500">
          <li>
            <span className="font-medium text-zinc-300">Coins</span> — all three periods rank by coins earned
            in the window (tiebreak: lifetime correct predictions). This is the original behavior.
          </li>
          <li>
            <span className="font-medium text-zinc-300">SOW-compliant</span> — Daily still ranks by coins;
            Weekly ranks by accuracy % earned that week; Monthly ranks by a consistency score (days active ÷
            days elapsed that month).
          </li>
        </ul>
      </div>
    </Card>
  );
}

// Fixed set the app's predictions query actually knows how to compute —
// this tab lets the admin reorder/relabel/hide/default among these, not
// invent brand-new sort logic (a genuinely new dimension still needs a
// backend + app code change; it would then slot into this same list).
type ListOption = { key: string; label: string; enabled: boolean };
const SORT_CATALOG: { key: string; fallbackLabel: string }[] = [
  { key: 'trending', fallbackLabel: 'Trending' },
  { key: 'newest', fallbackLabel: 'Newest' },
  { key: 'closingSoon', fallbackLabel: 'Closing Soon' },
  { key: 'mostPredicted', fallbackLabel: 'Most Predicted' },
  { key: 'topReward', fallbackLabel: 'Biggest Reward' },
];
const SHOW_CATALOG: { key: string; fallbackLabel: string }[] = [
  { key: 'all', fallbackLabel: 'All Open' },
  { key: 'closingSoon', fallbackLabel: 'Closing Today' },
  { key: 'featured', fallbackLabel: 'Featured' },
];

function normalizeListOptions(raw: unknown, catalog: { key: string; fallbackLabel: string }[]): ListOption[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return catalog.map((c) => ({ key: c.key, label: '', enabled: true }));
  }
  const known = new Set(catalog.map((c) => c.key));
  const seen = new Set<string>();
  const out: ListOption[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const key = (entry as Record<string, unknown>).key;
    if (typeof key !== 'string' || !known.has(key) || seen.has(key)) continue;
    seen.add(key);
    const label = (entry as Record<string, unknown>).label;
    out.push({ key, label: typeof label === 'string' ? label : '', enabled: (entry as Record<string, unknown>).enabled !== false });
  }
  return out.length > 0 ? out : catalog.map((c) => ({ key: c.key, label: '', enabled: true }));
}

function readDefaultKey(raw: unknown, fallback: string): string {
  return typeof raw === 'string' ? raw : fallback;
}

/** Reorder (▲▼) / hide / relabel / default-pick editor for one filter
 *  dimension (Sort by, or Show) — shared by both sections of the Prediction
 *  List tab below. */
function FilterOptionsEditor({
  title,
  hint,
  catalog,
  options,
  setOptions,
  defaultKey,
  setDefaultKey,
  onSave,
  busy,
  saved,
}: {
  title: string;
  hint: string;
  catalog: { key: string; fallbackLabel: string }[];
  options: ListOption[];
  setOptions: (next: ListOption[]) => void;
  defaultKey: string;
  setDefaultKey: (key: string) => void;
  onSave: () => void;
  busy: boolean;
  saved: boolean;
}) {
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j], next[i]];
    setOptions(next);
  }
  function toggle(i: number) {
    const next = [...options];
    next[i] = { ...next[i], enabled: !next[i].enabled };
    setOptions(next);
  }
  function relabel(i: number, label: string) {
    const next = [...options];
    next[i] = { ...next[i], label };
    setOptions(next);
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{hint}</p>
        </div>
        <Button variant="ghost" disabled={busy} onClick={onSave}>
          {saved ? '✓ Saved' : 'Save'}
        </Button>
      </div>
      <div className="mt-4 divide-y divide-zinc-800 rounded-xl border border-white/5">
        {options.map((o, i) => {
          const fallback = catalog.find((c) => c.key === o.key)?.fallbackLabel ?? o.key;
          return (
            <div key={o.key} className="flex items-center gap-3 p-3">
              <div className="flex flex-col leading-none">
                <button
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="px-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-25"
                  aria-label={`Move ${fallback} up`}
                >
                  ▲
                </button>
                <button
                  disabled={i === options.length - 1}
                  onClick={() => move(i, 1)}
                  className="px-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-25"
                  aria-label={`Move ${fallback} down`}
                >
                  ▼
                </button>
              </div>
              <input
                type="radio"
                name={`${title}-default`}
                checked={defaultKey === o.key}
                disabled={!o.enabled}
                onChange={() => setDefaultKey(o.key)}
                title="App opens to this by default"
              />
              <div className="w-36 shrink-0 text-sm text-zinc-300">{fallback}</div>
              <input
                value={o.label}
                onChange={(e) => relabel(i, e.target.value)}
                placeholder={`Custom label (blank = app's own "${fallback}" text)`}
                className={inputClass}
              />
              <button
                onClick={() => toggle(i)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${o.enabled ? 'bg-cyan-500' : 'bg-zinc-700'}`}
                aria-label={`Toggle ${fallback}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${o.enabled ? 'left-[22px]' : 'left-0.5'}`}
                />
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        ▲▼ reorders the chips, the radio picks the app&apos;s default, the toggle shows/hides a chip, and the text
        field overrides its label (leave blank to keep the app&apos;s own EN/Hindi/Gujarati translation — a custom
        label here shows as-is in every language).
      </p>
    </Card>
  );
}

function PredictionListTab() {
  const [raw, setRaw] = useState<Setting[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortOptions, setSortOptions] = useState<ListOption[]>([]);
  const [defaultSort, setDefaultSort] = useState('trending');
  const [showOptions, setShowOptions] = useState<ListOption[]>([]);
  const [defaultShow, setDefaultShow] = useState('all');
  const [busySort, setBusySort] = useState(false);
  const [busyShow, setBusyShow] = useState(false);
  const [savedSort, setSavedSort] = useState(false);
  const [savedShow, setSavedShow] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<Setting[]>('/admin/settings');
      setRaw(res);
      const byKey = new Map(res.map((s) => [s.key, s.value as unknown]));
      setSortOptions(normalizeListOptions(byKey.get('predictionList.sortOptions'), SORT_CATALOG));
      setDefaultSort(readDefaultKey(byKey.get('predictionList.defaultSort'), 'trending'));
      setShowOptions(normalizeListOptions(byKey.get('predictionList.showOptions'), SHOW_CATALOG));
      setDefaultShow(readDefaultKey(byKey.get('predictionList.defaultShow'), 'all'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!raw) return <Spinner />;

  async function saveDimension(kind: 'sort' | 'show') {
    const options = kind === 'sort' ? sortOptions : showOptions;
    const requestedDefault = kind === 'sort' ? defaultSort : defaultShow;
    const enabledKeys = options.filter((o) => o.enabled).map((o) => o.key);
    if (enabledKeys.length === 0) {
      alert('At least one option must stay enabled — the app needs something to show.');
      return;
    }
    const effectiveDefault = enabledKeys.includes(requestedDefault) ? requestedDefault : enabledKeys[0];
    const label = kind === 'sort' ? 'Sort by' : 'Show';
    if (!confirm(`Save "${label}" options? This changes the live app immediately — no reupload needed.`)) return;
    const setBusy = kind === 'sort' ? setBusySort : setBusyShow;
    const setSaved = kind === 'sort' ? setSavedSort : setSavedShow;
    setBusy(true);
    try {
      const optionsKey = kind === 'sort' ? 'predictionList.sortOptions' : 'predictionList.showOptions';
      const defaultKeyName = kind === 'sort' ? 'predictionList.defaultSort' : 'predictionList.defaultShow';
      await api(`/admin/settings/${optionsKey}`, { method: 'PUT', body: { value: options } });
      await api(`/admin/settings/${defaultKeyName}`, { method: 'PUT', body: { value: effectiveDefault } });
      if (kind === 'sort') setDefaultSort(effectiveDefault);
      else setDefaultShow(effectiveDefault);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        Controls what the Predict tab&apos;s filter sheet shows, in what order, and which one it opens to by
        default — the app re-reads this on every launch, so changes apply live without a new app build or store
        submission.
      </p>
      <FilterOptionsEditor
        title="Sort by"
        hint="How the open-predictions list is ordered."
        catalog={SORT_CATALOG}
        options={sortOptions}
        setOptions={setSortOptions}
        defaultKey={defaultSort}
        setDefaultKey={setDefaultSort}
        onSave={() => saveDimension('sort')}
        busy={busySort}
        saved={savedSort}
      />
      <FilterOptionsEditor
        title="Show"
        hint="Which open predictions are shown."
        catalog={SHOW_CATALOG}
        options={showOptions}
        setOptions={setShowOptions}
        defaultKey={defaultShow}
        setDefaultKey={setDefaultShow}
        onSave={() => saveDimension('show')}
        busy={busyShow}
        saved={savedShow}
      />
    </div>
  );
}

function SiteTab() {
  const { items, drafts, setDrafts, error, savedKey, save, draftStr } = useSettingsDrafts();
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!items) return <Spinner />;
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Site & branding</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Logo, contact details, social links and SEO meta — served to the web portal (and app) via <code className="font-mono text-xs">/config</code>.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {SITE_IMAGE_FIELDS.map((f) => (
          <div key={f.key} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-sm font-medium text-zinc-200">{f.label}</div>
            <div className="text-xs text-zinc-500">{f.hint}</div>
            <div className="mt-3">
              <ImageUpload
                value={draftStr(f.key) || null}
                label={f.label}
                onChange={(url) => {
                  setDrafts((d) => ({ ...d, [f.key]: url ?? '' }));
                  save(f.key, url ?? '', f.label);
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SITE_TEXT_FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <div className="flex items-center gap-2">
              <input
                value={draftStr(f.key)}
                placeholder={f.placeholder}
                onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
                className={inputClass}
              />
              <Button variant="ghost" onClick={() => save(f.key, drafts[f.key]?.trim() ?? '', f.label)}>
                {savedKey === f.key ? '✓ Saved' : 'Save'}
              </Button>
            </div>
            {f.hint && <p className="mt-1 text-xs text-zinc-500">{f.hint}</p>}
          </Field>
        ))}
      </div>
    </Card>
  );
}

function AppUpdateTab() {
  const { items, drafts, setDrafts, error, savedKey, save, draftStr } = useSettingsDrafts();
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!items) return <Spinner />;
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">App version / force update</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Blocks the app with an update screen for anyone below the minimum build number. Set this right after publishing a new store release.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {APP_UPDATE_NUMBER_FIELDS.map((f) => {
          const raw = drafts[f.key] ?? '0';
          const n = Number(raw);
          const invalid = raw.trim() === '' || isNaN(n) || n < 0 || !Number.isInteger(n);
          return (
            <div key={f.key} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-sm font-medium text-zinc-200">{f.label}</div>
              <div className="text-xs text-zinc-500">{f.hint}</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={raw}
                  onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
                  className={inputClass + (invalid ? ' border-rose-500/60' : '')}
                />
                <Button variant="ghost" disabled={invalid} onClick={() => save(f.key, n, `${f.label} = ${n}`)}>
                  {savedKey === f.key ? '✓ Saved' : 'Save'}
                </Button>
              </div>
              {invalid && <p className="mt-1 text-xs text-rose-400">Enter a whole number ≥ 0.</p>}
            </div>
          );
        })}
      </div>
      <div className="mt-4">
        <Field label="Update message">
          <div className="flex items-start gap-2">
            <textarea
              value={draftStr('app.updateMessage')}
              rows={2}
              placeholder="A new version of GOGETA is available. Please update to continue."
              onChange={(e) => setDrafts((d) => ({ ...d, 'app.updateMessage': e.target.value }))}
              className={inputClass}
            />
            <Button variant="ghost" onClick={() => save('app.updateMessage', drafts['app.updateMessage']?.trim() ?? '', 'Update message')}>
              {savedKey === 'app.updateMessage' ? '✓ Saved' : 'Save'}
            </Button>
          </div>
        </Field>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {APP_UPDATE_TEXT_FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <div className="flex items-center gap-2">
              <input
                value={draftStr(f.key)}
                placeholder={f.placeholder}
                onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
                className={inputClass}
              />
              <Button variant="ghost" onClick={() => save(f.key, drafts[f.key]?.trim() ?? '', f.label)}>
                {savedKey === f.key ? '✓ Saved' : 'Save'}
              </Button>
            </div>
            {f.hint && <p className="mt-1 text-xs text-zinc-500">{f.hint}</p>}
          </Field>
        ))}
      </div>
      <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90">
        ⚠ This is the <span className="font-semibold">build number</span> (Android versionCode / iOS
        CFBundleVersion — the integer after the <span className="font-semibold">+</span> in the app&apos;s
        version, e.g. <span className="font-mono">1.0.0+4</span> → build <span className="font-mono">4</span>),
        not the version name. Double-check the exact build number of the store release before raising this —
        setting it too high blocks users on the version you just published.
      </p>
    </Card>
  );
}

function NotificationsTab() {
  const { items, drafts, setDrafts, error, save } = useSettingsDrafts();
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!items) return <Spinner />;
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Notifications</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Turn automated in-app notification types on or off system-wide. A type is ON unless switched off here.
      </p>
      <div className="mt-4 space-y-3">
        {NOTIFICATION_TYPE_FIELDS.map((f) => {
          const key = `notifications.enabled.${f.type}`;
          const enabled = drafts[key] !== 'false';
          return (
            <div key={f.type} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div>
                <div className="text-sm font-medium text-zinc-200">{f.label}</div>
                <div className="text-xs text-zinc-500">{f.hint}</div>
              </div>
              <button
                onClick={() => {
                  setDrafts((d) => ({ ...d, [key]: String(!enabled) }));
                  save(key, !enabled, `${f.label} ${enabled ? 'OFF' : 'ON'}`);
                }}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? 'bg-cyan-500' : 'bg-zinc-700'}`}
                aria-label={`Toggle ${f.label}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function OtherSettingsTab() {
  const { items, drafts, setDrafts, error, savedKey, save, parseDraft } = useSettingsDrafts();
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!items) return <Spinner />;

  const others = items.filter(
    (s) =>
      !ECONOMY_KEYS.has(s.key) &&
      !DAILY_BONUS_KEYS.has(s.key) &&
      !ADS_KEYS.has(s.key) &&
      !SITE_KEYS.has(s.key) &&
      !NOTIFICATION_KEYS.has(s.key) &&
      !APP_UPDATE_KEYS.has(s.key) &&
      !UNUSED_KEYS.has(s.key) &&
      !PREDICTION_LIST_KEYS.has(s.key) &&
      s.key !== 'luckyDraw.enabled',
  );

  if (others.length === 0) {
    return <p className="text-sm text-zinc-500">No uncategorized settings — everything has its own tab.</p>;
  }

  return (
    <Card className="divide-y divide-zinc-800">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-zinc-300">Other settings</h2>
        <p className="text-xs text-zinc-500">Raw key/value configuration.</p>
      </div>
      {others.map((s) => (
        <div key={s.key} className="flex items-center gap-3 p-4">
          <div className="w-56 shrink-0 font-mono text-sm text-zinc-300">{s.key}</div>
          <input
            value={drafts[s.key] ?? ''}
            onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))}
            className={inputClass}
          />
          <Button variant="ghost" onClick={() => save(s.key, parseDraft(drafts[s.key] ?? ''), s.key)}>
            {savedKey === s.key ? '✓ Saved' : 'Save'}
          </Button>
        </div>
      ))}
    </Card>
  );
}

function BannersTab() {
  const [items, setItems] = useState<Banner[] | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    setItems(await api<Banner[]>('/admin/banners').catch(() => []));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggle(b: Banner) {
    await api(`/admin/banners/${b.id}`, { method: 'PATCH', body: { active: !b.active } }).catch(() => {});
    load();
  }
  async function del(b: Banner) {
    if (!confirm(`Delete banner "${b.title}"?`)) return;
    await api(`/admin/banners/${b.id}`, { method: 'DELETE' }).catch(() => {});
    load();
  }

  if (!items) return <Spinner />;
  const active = items.filter((b) => b.active).length;
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MiniStat label="Banners" value={items.length} icon="🖼" accent="azure" />
        <MiniStat label="Active" value={active} icon="●" accent="aura" />
        <MiniStat label="Hidden" value={items.length - active} icon="○" accent="teal" />
      </div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating(true)}>+ New banner</Button>
      </div>
      <Card className="divide-y divide-zinc-800">
        {items.length === 0 && <p className="p-4 text-sm text-zinc-500">No banners.</p>}
        {items.map((b) => (
          <div key={b.id} className="flex items-center gap-3 p-4">
            <div className="flex-1">
              <div className="font-medium">{b.title}</div>
              <div className="text-xs text-zinc-500">{b.imageUrl}</div>
            </div>
            <Badge color={b.active ? 'green' : 'zinc'}>{b.active ? 'Active' : 'Hidden'}</Badge>
            <Button variant="ghost" onClick={() => toggle(b)}>{b.active ? 'Hide' : 'Show'}</Button>
            <Button variant="danger" onClick={() => del(b)}>Delete</Button>
          </div>
        ))}
      </Card>
      {creating && <CreateBanner onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); }} />}
    </div>
  );
}

function CreateBanner({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; imageUrl?: string }>({});
  async function submit() {
    setFieldErrors({});
    if (!title.trim() || !imageUrl.trim()) {
      setFieldErrors({
        title: !title.trim() ? 'Title is required.' : undefined,
        imageUrl: !imageUrl.trim() ? 'Image URL is required.' : undefined,
      });
      setErr('Title and image URL required.');
      return;
    }
    setBusy(true); setErr(null);
    try {
      await api('/admin/banners', { method: 'POST', body: { title: title.trim(), imageUrl: imageUrl.trim(), link: link.trim() || undefined, active: true } });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); setBusy(false); }
  }
  return (
    <Modal title="New banner" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Title" error={fieldErrors.title}><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></Field>
        <Field label="Image URL" error={fieldErrors.imageUrl}><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputClass} /></Field>
        <Field label="Link (optional)"><input value={link} onChange={(e) => setLink(e.target.value)} className={inputClass} /></Field>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Create'}</Button></div>
      </div>
    </Modal>
  );
}

// Slugs the mobile app consumes directly. If any is missing or unpublished,
// the corresponding in-app link (register screen / settings) breaks — so the
// admin is shown their status explicitly here.
const REQUIRED_APP_PAGES = [
  { slug: 'terms', title: 'Terms of Service' },
  { slug: 'privacy', title: 'Privacy Policy' },
  { slug: 'help', title: 'Help & Support' },
];

function CmsTab() {
  const [items, setItems] = useState<CmsPage[] | null>(null);
  const [creating, setCreating] = useState<{ slug?: string; title?: string } | null>(null);
  const [editing, setEditing] = useState<CmsPage | null>(null);
  const load = useCallback(async () => {
    setItems(await api<CmsPage[]>('/admin/cms').catch(() => []));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggle(p: CmsPage) {
    await api(`/admin/cms/${p.id}`, { method: 'PATCH', body: { active: !p.active } }).catch(() => {});
    load();
  }

  if (!items) return <Spinner />;
  const published = items.filter((p) => p.active).length;
  const bySlug = new Map(items.map((p) => [p.slug, p]));
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MiniStat label="CMS pages" value={items.length} icon="📄" accent="azure" />
        <MiniStat label="Published" value={published} icon="●" accent="aura" />
        <MiniStat label="Draft" value={items.length - published} icon="○" accent="teal" />
      </div>

      <Card className="mb-4 p-4">
        <div className="mb-1 text-sm font-semibold">Required by the app</div>
        <p className="mb-3 text-xs text-zinc-500">
          The mobile app links to these pages. Each must exist and be <span className="text-zinc-300">Published</span> or the in-app link will not work.
        </p>
        <div className="divide-y divide-zinc-800">
          {REQUIRED_APP_PAGES.map((req) => {
            const page = bySlug.get(req.slug);
            const status = !page ? 'missing' : page.active ? 'published' : 'draft';
            return (
              <div key={req.slug} className="flex items-center gap-3 py-2.5">
                <div className="flex-1">
                  <div className="text-sm font-medium">{req.title}</div>
                  <div className="font-mono text-xs text-zinc-500">/{req.slug}</div>
                </div>
                <Badge color={status === 'published' ? 'green' : status === 'draft' ? 'amber' : 'red'}>
                  {status === 'published' ? 'Published' : status === 'draft' ? 'Unpublished' : 'Missing'}
                </Badge>
                {status === 'missing' && (
                  <Button variant="ghost" onClick={() => setCreating({ slug: req.slug, title: req.title })}>Create</Button>
                )}
                {status === 'draft' && page && (
                  <Button variant="ghost" onClick={() => toggle(page)}>Publish</Button>
                )}
                {page && (
                  <Button variant="ghost" onClick={() => setEditing(page)}>Edit</Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating({})}>+ New page</Button>
      </div>
      <Card className="divide-y divide-zinc-800">
        {items.length === 0 && <p className="p-4 text-sm text-zinc-500">No CMS pages.</p>}
        {items.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-4">
            <div className="flex-1">
              <div className="font-medium">{p.title}</div>
              <div className="font-mono text-xs text-zinc-500">/{p.slug}</div>
            </div>
            <Badge color={p.active ? 'green' : 'zinc'}>{p.active ? 'Published' : 'Draft'}</Badge>
            <Button variant="ghost" onClick={() => setEditing(p)}>Edit</Button>
            <Button variant="ghost" onClick={() => toggle(p)}>{p.active ? 'Unpublish' : 'Publish'}</Button>
          </div>
        ))}
      </Card>
      {creating && <CreateCms initialSlug={creating.slug} initialTitle={creating.title} onClose={() => setCreating(null)} onDone={() => { setCreating(null); load(); }} />}
      {editing && <EditCms page={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function CreateCms({ initialSlug, initialTitle, onClose, onDone }: { initialSlug?: string; initialTitle?: string; onClose: () => void; onDone: () => void }) {
  const [slug, setSlug] = useState(initialSlug ?? '');
  const [title, setTitle] = useState(initialTitle ?? '');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ slug?: string; title?: string; content?: string }>({});
  async function submit() {
    setFieldErrors({});
    if (!slug.trim() || !title.trim() || htmlIsEmpty(content)) {
      setFieldErrors({
        slug: !slug.trim() ? 'Slug is required.' : undefined,
        title: !title.trim() ? 'Title is required.' : undefined,
        content: htmlIsEmpty(content) ? 'Content is required.' : undefined,
      });
      setErr('Slug, title and content required.');
      return;
    }
    setBusy(true); setErr(null);
    try {
      await api('/admin/cms', { method: 'POST', body: { slug: slug.trim(), title: title.trim(), content, active: true } });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); setBusy(false); }
  }
  return (
    <Modal title="New CMS page" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Slug" error={fieldErrors.slug}><input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="terms" className={inputClass} /></Field>
        <Field label="Title" error={fieldErrors.title}><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></Field>
        <Field label="Content" error={fieldErrors.content}><RichTextEditor value={content} onChange={setContent} /></Field>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Create'}</Button></div>
      </div>
    </Modal>
  );
}

function EditCms({ page, onClose, onDone }: { page: CmsPage; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; content?: string }>({});
  async function submit() {
    setFieldErrors({});
    if (!title.trim() || htmlIsEmpty(content)) {
      setFieldErrors({
        title: !title.trim() ? 'Title is required.' : undefined,
        content: htmlIsEmpty(content) ? 'Content is required.' : undefined,
      });
      setErr('Title and content required.');
      return;
    }
    setBusy(true); setErr(null);
    try {
      await api(`/admin/cms/${page.id}`, { method: 'PATCH', body: { title: title.trim(), content } });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); setBusy(false); }
  }
  return (
    <Modal title={`Edit: ${page.title}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="font-mono text-xs text-zinc-500">/{page.slug}</div>
        <Field label="Title" error={fieldErrors.title}><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></Field>
        <Field label="Content" error={fieldErrors.content}><RichTextEditor value={content} onChange={setContent} /></Field>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></div>
      </div>
    </Modal>
  );
}
