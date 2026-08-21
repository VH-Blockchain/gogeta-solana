import { ApiClient } from '@/core/network/apiClient';
import { appCategoryFromApi, type AppCategory } from '../categoryCatalog';
import { httpsImageUrl } from '../mappers';

/** Dynamic, admin-configurable values served by `GET /config`. */
export interface EconomyConfig {
  signupBonus: number;
  entryFee: number;
  correctReward: number;
  luckyBonus: number;
  dailyLuckyWinners: number;
}

export interface PremiumConfig {
  monthlyPrice: string;
  yearlyPrice: string;
  trialDays: number;
  perks: string[];
}

/**
 * One admin-configurable sort/show chip — `key` must be one of the app's
 * already-supported filter keys (see PredictSort/PredictShow in the
 * predictions filters module) — admin Settings can reorder/relabel/hide/
 * default among these, not invent new ones. `label` overrides the default
 * chip text when non-empty.
 */
export interface PredictionListOption {
  key: string;
  label: string;
}

/**
 * Admin-configurable defaults + chip order for the Predict page's sort/show
 * filters (Settings -> Prediction List) — lets the admin change what the
 * portal opens to and shows in the filter sheet without a release, since it
 * re-reads this on every `/config` fetch.
 */
export interface PredictionListConfig {
  sortOptions: PredictionListOption[];
  defaultSort: string;
  showOptions: PredictionListOption[];
  defaultShow: string;
}

/**
 * Social links from admin Settings -> Site & branding. Each is empty when
 * not configured — callers should only render an icon for non-empty ones.
 */
export interface SiteSocialLinks {
  facebook: string;
  twitter: string;
  instagram: string;
  website: string;
}

export interface AppConfig {
  economy: EconomyConfig;
  premium: PremiumConfig;
  appVersion: string;
  supportEmail: string;
  siteName: string;
  siteTagline: string;
  siteLogoUrl: string;
  siteFaviconUrl: string;
  siteContactEmail: string;
  siteContactPhone: string;
  siteMetaTitle: string;
  siteMetaDescription: string;
  siteSocial: SiteSocialLinks;
  categoryKeys: string[];
  luckyDrawEnabled: boolean;
  /**
   * Admin-editable feature name/tagline (Settings -> Lucky Draw) — lets a
   * copy fix ship without a redeploy. Defaults match the backend's own
   * fallback, so they're correct even before the first fetch.
   */
  luckyDrawLabel: string;
  luckyDrawTagline: string;
  predictionList: PredictionListConfig;
}

const SORT_DEFAULTS: PredictionListOption[] = [
  { key: 'trending', label: '' },
  { key: 'newest', label: '' },
  { key: 'closingSoon', label: '' },
  { key: 'mostPredicted', label: '' },
  { key: 'topReward', label: '' },
];

const SHOW_DEFAULTS: PredictionListOption[] = [
  { key: 'all', label: '' },
  { key: 'closingSoon', label: '' },
  { key: 'featured', label: '' },
];

export const defaultPredictionListConfig: PredictionListConfig = {
  sortOptions: SORT_DEFAULTS,
  defaultSort: 'trending',
  showOptions: SHOW_DEFAULTS,
  defaultShow: 'all',
};

/** Sensible defaults so the UI renders before the `/config` fetch resolves. */
export const defaultAppConfig: AppConfig = {
  economy: {
    signupBonus: 1000,
    entryFee: 50,
    correctReward: 100,
    luckyBonus: 500,
    dailyLuckyWinners: 10,
  },
  premium: { monthlyPrice: '$4.99', yearlyPrice: '$39.99', trialDays: 7, perks: [] },
  appVersion: '1.0.0',
  supportEmail: 'support@gogeta.app',
  siteName: 'GOGETA',
  siteTagline: '',
  siteLogoUrl: '',
  siteFaviconUrl: '',
  siteContactEmail: '',
  siteContactPhone: '',
  siteMetaTitle: '',
  siteMetaDescription: '',
  siteSocial: { facebook: '', twitter: '', instagram: '', website: '' },
  categoryKeys: [],
  luckyDrawEnabled: true,
  luckyDrawLabel: 'Lucky Draw',
  luckyDrawTagline: 'See if you won today.',
  predictionList: defaultPredictionListConfig,
};

export interface BannerItem {
  id: string;
  title: string;
  imageUrl: string;
  link?: string | null;
}

export interface CmsContent {
  slug: string;
  title: string;
  content: string;
}

const int = (v: unknown, fallback: number): number =>
  typeof v === 'number' ? Math.trunc(v) : fallback;
const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);

function options(v: unknown, fallback: PredictionListOption[]): PredictionListOption[] {
  if (!Array.isArray(v) || v.length === 0) return fallback;
  const parsed = v
    .map((e) => e as Record<string, any>)
    .map((m) => ({
      key: m.key != null ? String(m.key) : '',
      label: m.label != null ? String(m.label) : '',
    }))
    .filter((o) => o.key.length > 0);
  return parsed.length === 0 ? fallback : parsed;
}

export const ConfigRepository = {
  async fetch(): Promise<AppConfig> {
    const data: any = await ApiClient.get('/config');
    const eco = data?.economy ?? {};
    const prem = data?.premium ?? {};
    const app = data?.app ?? {};
    const site = data?.site ?? {};
    const social = site?.social ?? {};
    const luckyDraw = data?.luckyDraw ?? {};
    const predictionList = data?.predictionList ?? {};

    const categoryKeys = ((data?.categories as any[]) ?? [])
      .map((e) => (e as Record<string, any>)?.key)
      .filter((k) => k != null && String(k).length > 0)
      .map((k) => String(k));

    return {
      economy: {
        signupBonus: int(eco.signupBonus, 1000),
        entryFee: int(eco.entryFee, 50),
        correctReward: int(eco.correctReward, 100),
        luckyBonus: int(eco.luckyBonus, 500),
        dailyLuckyWinners: int(eco.dailyLuckyWinners, 10),
      },
      premium: {
        monthlyPrice: str(prem.monthlyPrice, '$4.99'),
        yearlyPrice: str(prem.yearlyPrice, '$39.99'),
        trialDays: int(prem.trialDays, 7),
        perks: ((prem.perks as any[]) ?? []).map((e) => String(e)),
      },
      appVersion: str(app.version, '1.0.0'),
      supportEmail: str(app.supportEmail, 'support@gogeta.app'),
      siteName: str(site.name, 'GOGETA'),
      siteTagline: str(site.tagline, ''),
      siteLogoUrl: httpsImageUrl(str(site.logoUrl, '')) ?? '',
      siteFaviconUrl: httpsImageUrl(str(site.faviconUrl, '')) ?? '',
      siteContactEmail: str(site.contactEmail, ''),
      siteContactPhone: str(site.contactPhone, ''),
      siteMetaTitle: str(site.metaTitle, ''),
      siteMetaDescription: str(site.metaDescription, ''),
      siteSocial: {
        facebook: str(social.facebook, ''),
        twitter: str(social.twitter, ''),
        instagram: str(social.instagram, ''),
        website: str(social.website, ''),
      },
      categoryKeys,
      luckyDrawEnabled: luckyDraw.enabled !== false,
      luckyDrawLabel: str(luckyDraw.label, 'Lucky Draw'),
      luckyDrawTagline: str(luckyDraw.tagline, 'See if you won today.'),
      predictionList: {
        sortOptions: options(predictionList.sortOptions, SORT_DEFAULTS),
        defaultSort: str(predictionList.defaultSort, defaultPredictionListConfig.defaultSort),
        showOptions: options(predictionList.showOptions, SHOW_DEFAULTS),
        defaultShow: str(predictionList.defaultShow, defaultPredictionListConfig.defaultShow),
      },
    };
  },

  /**
   * Active categories with full display data (label / icon / accent) from
   * `GET /categories` — drives the portal's dynamic, admin-managed categories.
   */
  async categories(): Promise<AppCategory[]> {
    const data = await ApiClient.get<any[]>('/categories');
    return (data ?? []).map((e) => appCategoryFromApi(e as Record<string, any>));
  },

  async banners(): Promise<BannerItem[]> {
    const data = await ApiClient.get<any[]>('/banners');
    return (data ?? [])
      .map((e) => e as Record<string, any>)
      .map((m) => ({
        id: m.id != null ? String(m.id) : '',
        title: m.title != null ? String(m.title) : '',
        imageUrl: httpsImageUrl(m.imageUrl != null ? String(m.imageUrl) : '') ?? '',
        link: m.link != null ? String(m.link) : null,
      }));
  },

  async cmsPage(slug: string): Promise<CmsContent> {
    const m: any = await ApiClient.get(`/cms/${slug}`);
    return {
      slug: m?.slug != null ? String(m.slug) : slug,
      title: m?.title != null ? String(m.title) : '',
      content: m?.content != null ? String(m.content) : '',
    };
  },
};
