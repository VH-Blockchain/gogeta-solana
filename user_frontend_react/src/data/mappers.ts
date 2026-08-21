import { ApiConfig } from '@/core/network/apiConfig';
import type { BadgeType, UserLevel } from '@/core/constants/economy';
import {
  PREDICTION_CATEGORIES,
  type AppUser,
  type BadgeInfo,
  type Prediction,
  type PredictionCategory,
  type PredictionOption,
  type PredictionStatus,
} from './models';

/** Maps backend JSON -> app models. Port of lib/data/api/mappers.dart. */

/**
 * Some upload URLs were stored as `http://` before the server's
 * PUBLIC_BASE_URL fix. When the app talks to an https backend, upgrade them
 * so browsers don't block them as mixed content.
 */
export function httpsImageUrl(url?: string | null): string | null {
  if (!url) return url ?? null;
  if (ApiConfig.baseUrl.startsWith('https://') && url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  return url;
}

export function levelFromApi(s?: string | null): UserLevel {
  switch (s) {
    case 'PREDICTOR':
      return 'predictor';
    case 'ANALYST':
      return 'analyst';
    case 'EXPERT':
      return 'expert';
    case 'CHAMPION':
      return 'champion';
    case 'LEGEND':
      return 'legend';
    default:
      return 'beginner';
  }
}

const NEXT_XP: Record<UserLevel, number> = {
  beginner: 500,
  predictor: 2000,
  analyst: 5000,
  expert: 10000,
  champion: 25000,
  legend: 25000,
};

const int = (v: unknown, fallback = 0): number =>
  typeof v === 'number' ? Math.trunc(v) : fallback;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function joinedLabel(iso?: string | null): string {
  if (!iso) return 'Member';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Member';
  return `Member since ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function userFromApi(
  j: Record<string, any>,
  opts: { globalRank?: number; badges?: BadgeInfo[] } = {},
): AppUser {
  const level = levelFromApi(j.level);
  return {
    id: j.id as string,
    name: (j.name as string) ?? '',
    username: (j.username as string) ?? '',
    coins: int(j.coins),
    level,
    xp: int(j.xp),
    xpToNext: NEXT_XP[level] ?? 3000,
    totalPredictions: int(j.totalPredictions),
    correctPredictions: int(j.correctPredictions),
    currentStreak: int(j.currentStreak),
    bestStreak: int(j.bestStreak),
    globalRank: opts.globalRank ?? int(j.globalRank),
    badges: opts.badges ?? [],
    joinedLabel: joinedLabel(j.createdAt),
    email: (j.email as string) ?? '',
    bio: (j.bio as string) ?? '',
    avatarSeed: int(j.avatarSeed),
  };
}

// -- Predictions ------------------------------------------------------------

function categoryFromKey(key?: string | null): PredictionCategory {
  if (key && (PREDICTION_CATEGORIES as readonly string[]).includes(key)) {
    return key as PredictionCategory;
  }
  return 'sports';
}

/** Milliseconds until `iso`, clamped at 0 for anything already past. */
function closesInMs(iso?: string | null): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, d.getTime() - Date.now());
}

function statusFromApi(j: Record<string, any>): PredictionStatus {
  switch (j.entryStatus) {
    case 'WON':
      return 'won';
    case 'LOST':
      return 'lost';
    case 'LOCKED':
      return 'locked';
  }
  switch (j.status) {
    case 'LOCKED':
      return 'locked';
    case 'RESOLVED':
      return 'awaitingResult';
    default:
      return 'open';
  }
}

// -- Badges -----------------------------------------------------------------

function badgeTypeFromKey(key?: string | null): BadgeType {
  switch (key) {
    case 'FIRST_PREDICTION':
      return 'firstPrediction';
    case 'ACCURACY_MASTER':
      return 'accuracyMaster';
    case 'WINNING_STREAK':
      return 'winningStreak';
    case 'DAILY_HERO':
      return 'dailyHero';
    case 'WEEKLY_STAR':
      return 'weeklyStar';
    case 'MONTHLY_CHAMPION':
      return 'monthlyChampion';
    default:
      return 'welcome';
  }
}

export function badgeFromApi(j: Record<string, any>): BadgeInfo {
  return {
    type: badgeTypeFromKey(j.key),
    earned: j.earned === true,
    progress: typeof j.progress === 'number' ? j.progress : 0,
  };
}

export function predictionFromApi(j: Record<string, any>): Prediction {
  const categoryMap = j.category as Record<string, any> | undefined;
  const categoryKey = categoryMap?.key as string | undefined;
  const cat = categoryFromKey(categoryKey);
  const ownBanner = httpsImageUrl(j.bannerImageUrl);
  // Detail banner: the prediction's own image, else its category image.
  const banner = ownBanner ? ownBanner : httpsImageUrl(categoryMap?.imageUrl);

  const options: PredictionOption[] = ((j.options as any[]) ?? []).map((o) => ({
    id: o.id as string,
    label: (o.label as string) ?? '',
    odds: typeof o.odds === 'number' ? o.odds : 1.9,
    sharePercent: typeof o.sharePercent === 'number' ? o.sharePercent : 0,
  }));

  return {
    id: j.id as string,
    category: cat,
    title: (j.title as string) ?? '',
    subtitle: (j.subtitle as string) ?? '',
    options,
    entryFee: int(j.entryFee, 50),
    reward: int(j.reward, 100),
    closesInMs: closesInMs(j.closesAt),
    participants: int(j.participants),
    status: statusFromApi(j),
    selectedOptionId: (j.mySelectedOptionId as string | undefined) ?? null,
    correctOptionId: (j.correctOptionId as string | undefined) ?? null,
    featured: j.featured === true,
    info: (j.info as string) ?? '',
    bannerImageUrl: banner,
    categoryKey: categoryKey ?? cat,
  };
}

/** Humanises an ISO timestamp into a short relative label. */
export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const diffMs = Date.now() - then.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${MONTHS[then.getMonth()]} ${then.getDate()}`;
}
