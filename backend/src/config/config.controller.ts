import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { isReviewAccount } from '../common/review-account';
import { EconomyService } from '../economy/economy.service';
import { CategoriesService } from '../categories/categories.service';
import { PrismaService } from '../prisma/prisma.service';

const PREMIUM_DEFAULTS = {
  monthlyPrice: '$4.99',
  yearlyPrice: '$39.99',
  trialDays: 7,
  perks: [
    '2× coin earnings on every win',
    'Exclusive premium-only contests',
    'Priority lucky-draw entries',
    'Ad-free experience',
    'Premium profile badge',
    'Early access to new features',
  ],
};
const APP_DEFAULTS = {
  version: '1.0.0',
  supportEmail: 'hello@yesiki.com',
  // Force-update gate: minBuild* is the platform build number (Android
  // versionCode / iOS CFBundleVersion — the integer after the `+` in
  // pubspec's version, NOT the semver string) below which the app blocks
  // with an update screen. Default 0 means "no minimum" (never blocks) so
  // older backends / a blank setting are a no-op until the admin sets one.
  minBuildAndroid: 0,
  minBuildIos: 0,
  updateMessage:
    'A new version of GOGETA is available. Please update to continue.',
  storeUrlAndroid: '',
  storeUrlIos: '',
};
// Wording for the Lucky Draw feature — plain admin-editable strings (not
// l10n) so a copy fix can ship without an app-store resubmission.
const LUCKY_DRAW_DEFAULTS = {
  label: 'Lucky Draw',
  tagline: 'See if you won today.',
};
// Google's official TEST banner units — swapped for the client's real AdMob
// unit ids via admin Settings (`ads.*` keys) once their account is available.
const ADS_DEFAULTS = {
  enabled: false,
  bannerAndroid: 'ca-app-pub-3940256099942544/6300978111',
  bannerIos: 'ca-app-pub-3940256099942544/2934735716',
};

// Per-screen ad toggles, all on by default — `predictions` additionally
// carries the feed-ad placement tuning (gap pattern + "my picks" repeat).
const ADS_SCREEN_KEYS = [
  'home',
  'leaderboard',
  'luckyWinners',
  'rewards',
  'coinHistory',
  'profile',
  'levels',
  'predictionDetail',
  'result',
  'history',
] as const;
const ADS_SCREENS_DEFAULTS = {
  ...Object.fromEntries(ADS_SCREEN_KEYS.map((key) => [key, { enabled: true }])),
  predictions: {
    enabled: true,
    feedGapPattern: [2, 3, 5],
    myPicksRepeatEvery: 2,
  },
} as {
  [K in (typeof ADS_SCREEN_KEYS)[number]]: { enabled: boolean };
} & {
  predictions: {
    enabled: boolean;
    feedGapPattern: number[];
    myPicksRepeatEvery: number;
  };
};

// Fixed set the app's predictions query actually knows how to compute —
// admin Settings can reorder/relabel/hide/default among these, not invent
// new ones (a genuinely new sort dimension still needs a backend+app code
// change). Order here is the fallback order when no admin config exists yet,
// matching the app's original hardcoded chip order exactly.
const PREDICTION_SORT_KEYS = [
  'trending',
  'newest',
  'closingSoon',
  'mostPredicted',
  'topReward',
] as const;
const PREDICTION_SHOW_KEYS = ['all', 'closingSoon', 'featured'] as const;

interface PredictionListOption {
  key: string;
  label: string;
  enabled: boolean;
}

/** Parses+sanitizes an admin-edited option list: drops unknown/duplicate
 *  keys and non-object entries, falls back to the full default set (in
 *  default order, all enabled) if the stored value is missing, malformed,
 *  or empty — so a bad admin edit can never leave the app with zero chips
 *  to render. */
function sanitizeOptionList(
  raw: unknown,
  allowed: readonly string[],
): PredictionListOption[] {
  const fallback = allowed.map((key) => ({ key, label: '', enabled: true }));
  if (!Array.isArray(raw)) return fallback;
  const seen = new Set<string>();
  const out: PredictionListOption[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const key = (entry as Record<string, unknown>).key;
    if (typeof key !== 'string' || !allowed.includes(key) || seen.has(key))
      continue;
    seen.add(key);
    const labelRaw = (entry as Record<string, unknown>).label;
    out.push({
      key,
      label: typeof labelRaw === 'string' ? labelRaw.trim() : '',
      enabled: (entry as Record<string, unknown>).enabled !== false,
    });
  }
  return out.length > 0 ? out : fallback;
}

/** Builds the app-facing {options, default} pair for one filter dimension:
 *  only enabled options are exposed, and the default always falls back to
 *  the first enabled option (never a hidden one) if the admin-set default
 *  key is missing or was itself disabled. */
function buildPredictionListDimension(
  rawOptions: unknown,
  rawDefault: unknown,
  allowed: readonly string[],
  hardFallback: string,
): { options: { key: string; label: string }[]; default: string } {
  const all = sanitizeOptionList(rawOptions, allowed);
  const enabled = all.filter((o) => o.enabled);
  const enabledKeys = enabled.map((o) => o.key);
  const requested = typeof rawDefault === 'string' ? rawDefault : null;
  const defaultKey =
    requested && enabledKeys.includes(requested)
      ? requested
      : (enabledKeys[0] ?? hardFallback);
  return {
    options: enabled.map((o) => ({ key: o.key, label: o.label })),
    default: defaultKey,
  };
}

/** Parses+sanitizes the admin-edited `ads.screens` blob: a fixed map of
 *  per-screen ad toggles plus `predictions`' feed-placement tuning. Never
 *  throws on garbage input (missing key, wrong type, partial object, unknown
 *  extra fields) — always returns a fully-populated object matching
 *  ADS_SCREENS_DEFAULTS, falling back field-by-field rather than as a whole
 *  so a single bad field can't blank out the rest of an otherwise-good edit. */
function sanitizeAdsScreens(raw: unknown): typeof ADS_SCREENS_DEFAULTS {
  const src =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const enabledOf = (key: string, fallback: boolean): boolean => {
    const entry = src[key];
    if (!entry || typeof entry !== 'object') return fallback;
    const v = (entry as Record<string, unknown>).enabled;
    return typeof v === 'boolean' ? v : fallback;
  };

  const simple = Object.fromEntries(
    ADS_SCREEN_KEYS.map((key) => [key, { enabled: enabledOf(key, true) }]),
  ) as { [K in (typeof ADS_SCREEN_KEYS)[number]]: { enabled: boolean } };

  const predictionsDefaults = ADS_SCREENS_DEFAULTS.predictions;
  const predictionsRaw =
    src.predictions && typeof src.predictions === 'object'
      ? (src.predictions as Record<string, unknown>)
      : {};

  const isPositiveInt = (v: unknown): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v > 0;

  const gapRaw = predictionsRaw.feedGapPattern;
  const gapFiltered = Array.isArray(gapRaw) ? gapRaw.filter(isPositiveInt) : [];
  const feedGapPattern =
    gapFiltered.length > 0
      ? gapFiltered.slice(0, 10)
      : predictionsDefaults.feedGapPattern;

  const repeatRaw = predictionsRaw.myPicksRepeatEvery;
  const myPicksRepeatEvery = isPositiveInt(repeatRaw)
    ? repeatRaw
    : predictionsDefaults.myPicksRepeatEvery;

  return {
    ...simple,
    predictions: {
      enabled: enabledOf('predictions', true),
      feedGapPattern,
      myPicksRepeatEvery,
    },
  };
}

@ApiTags('config')
@Controller('config')
export class ConfigController {
  constructor(
    private readonly economy: EconomyService,
    private readonly categories: CategoriesService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** True only when a valid Bearer token for the store-review account is
   *  present. This route is @Public() (called before login too, at app
   *  bootstrap) so it can't use @CurrentUser()/the auth guard — decodes the
   *  token by hand, tolerating "missing" and "invalid" identically (both
   *  just mean "not personalized", never an error). */
  private isReviewerRequest(req: Request): boolean {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return false;
    try {
      const payload = this.jwt.verify<{ email?: string }>(auth.slice(7));
      return isReviewAccount(payload.email);
    } catch {
      return false;
    }
  }

  /** App bootstrap payload — no auth required. */
  @Public()
  @Get()
  async getConfig(@Req() req: Request) {
    const isReviewer = this.isReviewerRequest(req);
    const [economy, categories, settings] = await Promise.all([
      this.economy.getRules(),
      this.categories.findActive(),
      this.prisma.setting.findMany({
        where: {
          OR: [
            { key: { startsWith: 'site.' } },
            { key: { startsWith: 'premium.' } },
            { key: { startsWith: 'app.' } },
            { key: { startsWith: 'ads.' } },
            { key: { startsWith: 'luckyDraw.' } },
            { key: { startsWith: 'predictionList.' } },
          ],
        },
      }),
    ]);

    const byKey = new Map(settings.map((s) => [s.key, s.value]));
    const str = (key: string, fallback = ''): string => {
      const v = byKey.get(key);
      return typeof v === 'string' ? v : v == null ? fallback : String(v);
    };
    const num = (key: string, fallback: number): number => {
      const v = Number(byKey.get(key) as unknown);
      return Number.isFinite(v) && byKey.has(key) ? v : fallback;
    };
    const list = (key: string, fallback: string[]): string[] => {
      const v = byKey.get(key);
      return Array.isArray(v) ? (v as string[]) : fallback;
    };

    return {
      economy,
      categories,
      site: {
        name: str('site.name', 'Predora'),
        tagline: str('site.tagline'),
        logoUrl: str('site.logoUrl'),
        faviconUrl: str('site.faviconUrl'),
        contactEmail: str('site.contactEmail', APP_DEFAULTS.supportEmail),
        contactPhone: str('site.contactPhone'),
        metaTitle: str('site.metaTitle'),
        metaDescription: str('site.metaDescription'),
        social: {
          facebook: str('site.social.facebook'),
          twitter: str('site.social.twitter'),
          instagram: str('site.social.instagram'),
          website: str('site.social.website'),
        },
      },
      premium: {
        monthlyPrice: str(
          'premium.monthlyPrice',
          PREMIUM_DEFAULTS.monthlyPrice,
        ),
        yearlyPrice: str('premium.yearlyPrice', PREMIUM_DEFAULTS.yearlyPrice),
        trialDays: num('premium.trialDays', PREMIUM_DEFAULTS.trialDays),
        perks: list('premium.perks', PREMIUM_DEFAULTS.perks),
      },
      app: {
        version: str('app.version', APP_DEFAULTS.version),
        supportEmail: str('app.supportEmail', APP_DEFAULTS.supportEmail),
        minBuildAndroid: num(
          'app.minBuildAndroid',
          APP_DEFAULTS.minBuildAndroid,
        ),
        minBuildIos: num('app.minBuildIos', APP_DEFAULTS.minBuildIos),
        updateMessage: str('app.updateMessage', APP_DEFAULTS.updateMessage),
        storeUrlAndroid: str(
          'app.storeUrlAndroid',
          APP_DEFAULTS.storeUrlAndroid,
        ),
        storeUrlIos: str('app.storeUrlIos', APP_DEFAULTS.storeUrlIos),
      },
      ads: {
        enabled: isReviewer ? false : byKey.get('ads.enabled') === true,
        bannerAndroid: str('ads.bannerAndroid', ADS_DEFAULTS.bannerAndroid),
        bannerIos: str('ads.bannerIos', ADS_DEFAULTS.bannerIos),
        screens: sanitizeAdsScreens(byKey.get('ads.screens')),
      },
      luckyDraw: {
        // Defaults ON (unlike ads) — admin has to explicitly turn it off.
        enabled: isReviewer ? false : byKey.get('luckyDraw.enabled') !== false,
        label: str('luckyDraw.label', LUCKY_DRAW_DEFAULTS.label),
        tagline: str('luckyDraw.tagline', LUCKY_DRAW_DEFAULTS.tagline),
      },
      predictionList: (() => {
        const sort = buildPredictionListDimension(
          byKey.get('predictionList.sortOptions'),
          byKey.get('predictionList.defaultSort'),
          PREDICTION_SORT_KEYS,
          'trending',
        );
        const show = buildPredictionListDimension(
          byKey.get('predictionList.showOptions'),
          byKey.get('predictionList.defaultShow'),
          PREDICTION_SHOW_KEYS,
          'all',
        );
        return {
          sortOptions: sort.options,
          defaultSort: sort.default,
          showOptions: show.options,
          defaultShow: show.default,
        };
      })(),
    };
  }
}
