import { WebTokens } from '@/theme/webTokens';
import type { AccentFamily } from '@/theme/palette';

/**
 * Maps a category's accent family (already admin-configured, real data) to a
 * web token color — gives each prediction card, sidebar category and pick row
 * a distinct tint without inventing per-category colors.
 *
 * Shared by ArenaCard, the shell sidebar/rail, and the submit-bar pick rows,
 * which each declared their own identical `_tintFor` in the Flutter source.
 */
export function accentColor(family: AccentFamily): string {
  switch (family) {
    case 'rewards':
      return WebTokens.gold;
    case 'leaderboard':
      return WebTokens.violet;
    case 'profile':
      return WebTokens.blue;
    case 'predictions':
    default:
      return WebTokens.accent;
  }
}
