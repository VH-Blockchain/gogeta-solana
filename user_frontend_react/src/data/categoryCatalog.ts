import type { AccentFamily } from '@/theme/palette';
import { httpsImageUrl } from './mappers';
import {
  PREDICTION_CATEGORIES,
  accentForCategory,
  categoryIconName,
  categoryLabel,
  type PredictionCategory,
} from './models';

/** A category as configured in the admin panel (`GET /categories`). */
export interface AppCategory {
  key: string;
  label: string;
  iconName: string;
  accent: string;
  imageUrl?: string | null;
  iconImageUrl?: string | null;
}

export function appCategoryFromApi(j: Record<string, any>): AppCategory {
  return {
    key: j.key as string,
    label: (j.label as string) ?? (j.key as string),
    iconName: (j.icon as string) ?? 'category',
    accent: (j.accent as string) ?? 'predictions',
    imageUrl: httpsImageUrl(j.imageUrl as string | undefined),
    iconImageUrl: httpsImageUrl(j.iconImageUrl as string | undefined),
  };
}

/** Maps an admin accent string to a feature accent family. */
export function accentByName(name: string): AccentFamily {
  switch (name) {
    case 'rewards':
      return 'rewards';
    case 'leaderboard':
      return 'leaderboard';
    case 'profile':
      return 'profile';
    case 'predictions':
    default:
      return 'predictions';
  }
}

/**
 * App-wide registry of categories loaded from the backend. Cards and chips
 * resolve a category's label / icon / accent by key through here, so
 * admin-managed categories render everywhere. Falls back to the built-in
 * category set for any key not yet loaded (or before the fetch).
 *
 * Port of `CategoryCatalog` — kept as a module-level singleton for the same
 * reason the Dart original was static: every card resolves through it, and
 * it's written exactly once per session by ConfigStore.loadCategories().
 */
class CategoryCatalogImpl {
  private byKey: Map<string, AppCategory> = new Map();

  set(categories: AppCategory[]): void {
    this.byKey = new Map(categories.map((c) => [c.key, c]));
  }

  get isLoaded(): boolean {
    return this.byKey.size > 0;
  }

  get all(): AppCategory[] {
    return [...this.byKey.values()];
  }

  private fallback(key: string): PredictionCategory {
    return (PREDICTION_CATEGORIES as readonly string[]).includes(key)
      ? (key as PredictionCategory)
      : 'sports';
  }

  labelFor(key: string): string {
    return this.byKey.get(key)?.label ?? categoryLabel[this.fallback(key)];
  }

  iconNameFor(key: string): string {
    const c = this.byKey.get(key);
    return c ? c.iconName : categoryIconName[this.fallback(key)];
  }

  accentFor(key: string): AccentFamily {
    const c = this.byKey.get(key);
    return c ? accentByName(c.accent) : accentForCategory(this.fallback(key));
  }

  /** Admin-uploaded category image, if any (the built-in fallback set has none). */
  imageFor(key: string): string | null {
    const url = this.byKey.get(key)?.imageUrl;
    return url ? url : null;
  }

  /**
   * Admin-uploaded icon image — a custom small mark that replaces the
   * built-in Material icon wherever the category icon is shown.
   */
  iconImageFor(key: string): string | null {
    const url = this.byKey.get(key)?.iconImageUrl;
    return url ? url : null;
  }
}

export const CategoryCatalog = new CategoryCatalogImpl();
