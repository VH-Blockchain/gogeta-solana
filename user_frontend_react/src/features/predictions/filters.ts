import LocalFireDepartmentRounded from '@mui/icons-material/LocalFireDepartmentRounded';
import FiberNewRounded from '@mui/icons-material/FiberNewRounded';
import ScheduleRounded from '@mui/icons-material/ScheduleRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded';
import AllInclusiveRounded from '@mui/icons-material/AllInclusiveRounded';
import TimelapseRounded from '@mui/icons-material/TimelapseRounded';
import type { IconComponent } from '@/components/Icon';
import type { PredictionListConfig } from '@/data/api/configRepository';

/**
 * How the open-predictions list is ordered / which predictions are shown.
 * The enums are fixed (the backend query only knows how to sort/filter these
 * ways), but admin can reorder, relabel, hide or default among them without a
 * redeploy — see `PredictionListConfig`.
 */
export type PredictSort = 'trending' | 'newest' | 'closingSoon' | 'mostPredicted' | 'topReward';
export type PredictShow = 'all' | 'closingSoon' | 'featured';

export interface PredictionFilters {
  sort: PredictSort;
  show: PredictShow;
}

const SORTS: PredictSort[] = ['trending', 'newest', 'closingSoon', 'mostPredicted', 'topReward'];
const SHOWS: PredictShow[] = ['all', 'closingSoon', 'featured'];

/** Config-key <-> enum mapping (the keys admin Settings uses). */
export function sortFromConfigKey(key: string): PredictSort | null {
  return (SORTS as string[]).includes(key) ? (key as PredictSort) : null;
}

export function showFromConfigKey(key: string): PredictShow | null {
  return (SHOWS as string[]).includes(key) ? (key as PredictShow) : null;
}

/**
 * Reads the admin-configured default sort/show (Settings -> Prediction List)
 * into concrete values — falls back to trending/all if the config hasn't
 * loaded yet or names an unknown key.
 */
export function defaultPredictionFilters(cfg: PredictionListConfig): PredictionFilters {
  return {
    sort: sortFromConfigKey(cfg.defaultSort) ?? 'trending',
    show: showFromConfigKey(cfg.defaultShow) ?? 'all',
  };
}

export function filtersEqual(a: PredictionFilters, b: PredictionFilters): boolean {
  return a.sort === b.sort && a.show === b.show;
}

export const sortLabel: Record<PredictSort, string> = {
  trending: 'Trending',
  newest: 'Newest',
  closingSoon: 'Closing Soon',
  mostPredicted: 'Most Predicted',
  topReward: 'Biggest Reward',
};

export const sortIcon: Record<PredictSort, IconComponent> = {
  trending: LocalFireDepartmentRounded,
  newest: FiberNewRounded,
  closingSoon: ScheduleRounded,
  mostPredicted: GroupsRounded,
  topReward: WorkspacePremiumRounded,
};

/**
 * Query-param value sent to `GET /predictions?sort=` — matches the backend's
 * actual accepted sort values (predictions.service.ts), which differ from the
 * admin config-key names for a couple of entries.
 */
export const sortQueryKey: Record<PredictSort, string> = {
  trending: 'trending',
  newest: 'newest',
  closingSoon: 'soon',
  mostPredicted: 'predicted',
  topReward: 'reward',
};

export const showLabel: Record<PredictShow, string> = {
  all: 'All Open',
  closingSoon: 'Closing Today',
  featured: 'Featured',
};

export const showIcon: Record<PredictShow, IconComponent> = {
  all: AllInclusiveRounded,
  closingSoon: TimelapseRounded,
  featured: LocalFireDepartmentRounded,
};

/**
 * `?show=` query-param parsing for deep links (e.g. the dashboard's Featured
 * section "See all") — mirrors the config-key strings 1:1.
 */
export function showFromQueryParam(v: string | null | undefined): PredictShow | null {
  return v ? showFromConfigKey(v) : null;
}

/**
 * Admin-ordered, admin-labeled chip list for one filter dimension — falls
 * back to the declaration order + this module's own labels if the config is
 * empty or every entry names an unrecognized key.
 */
export function orderedSortChips(
  cfg: PredictionListConfig,
): { sort: PredictSort; label: string }[] {
  const entries = cfg.sortOptions
    .map((o) => {
      const s = sortFromConfigKey(o.key);
      return s ? { sort: s, label: o.label || sortLabel[s] } : null;
    })
    .filter((e): e is { sort: PredictSort; label: string } => e != null);
  return entries.length > 0 ? entries : SORTS.map((s) => ({ sort: s, label: sortLabel[s] }));
}

export function orderedShowChips(
  cfg: PredictionListConfig,
): { show: PredictShow; label: string }[] {
  const entries = cfg.showOptions
    .map((o) => {
      const s = showFromConfigKey(o.key);
      return s ? { show: s, label: o.label || showLabel[s] } : null;
    })
    .filter((e): e is { show: PredictShow; label: string } => e != null);
  return entries.length > 0 ? entries : SHOWS.map((s) => ({ show: s, label: showLabel[s] }));
}
