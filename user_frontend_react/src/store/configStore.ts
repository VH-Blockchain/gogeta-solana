import { create } from 'zustand';
import { CategoryCatalog } from '@/data/categoryCatalog';
import { ConfigRepository, defaultAppConfig, type AppConfig } from '@/data/api/configRepository';

interface ConfigState {
  config: AppConfig;
  /** Bumped when the category catalog lands, so the shell re-renders. */
  categoriesVersion: number;
  load: () => Promise<void>;
  loadCategories: () => Promise<void>;
}

/**
 * App-wide dynamic config (economy, premium, app meta) from `GET /config`.
 * Starts with sensible defaults so the UI renders before the fetch resolves.
 * Port of ConfigProvider.
 */
export const useConfigStore = create<ConfigState>((set) => ({
  config: defaultAppConfig,
  categoriesVersion: 0,

  load: async () => {
    try {
      set({ config: await ConfigRepository.fetch() });
    } catch {
      /* keep defaults on failure */
    }
  },

  /**
   * Loads admin-managed categories into CategoryCatalog so chips and cards
   * render label/icon/accent dynamically. Best-effort (auth required, so
   * it's called after sign-in from the portal shell).
   */
  loadCategories: async () => {
    try {
      CategoryCatalog.set(await ConfigRepository.categories());
      set((s) => ({ categoriesVersion: s.categoriesVersion + 1 }));
    } catch {
      /* keep the built-in fallback on failure */
    }
  },
}));
