import { create } from 'zustand';

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
}

/**
 * Light/dark toggle for the web portal. Session-only (not persisted) —
 * matches WebThemeProvider exactly.
 */
export const useThemeStore = create<ThemeState>((set) => ({
  isDark: true,
  toggle: () => set((s) => ({ isDark: !s.isDark })),
}));
