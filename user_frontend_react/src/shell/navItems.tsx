import type { ReactNode } from 'react';
import CottageRounded from '@mui/icons-material/CottageRounded';
import BoltRounded from '@mui/icons-material/BoltRounded';
import QuizRounded from '@mui/icons-material/QuizRounded';
import AccountBalanceWalletRounded from '@mui/icons-material/AccountBalanceWalletRounded';
import EmojiEventsRounded from '@mui/icons-material/EmojiEventsRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import DiamondRounded from '@mui/icons-material/DiamondRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import { Routes } from '@/router/routes';
import { WebTokens } from '@/theme/webTokens';

export interface NavItem {
  route: string;
  icon: ReactNode;
  label: string;
}

/**
 * Primary navigation — a single source of truth for the sidebar list, the
 * collapsed rail, and the mobile drawer. All primary nav lives in the sidebar
 * as a vertical icon+label list; the topbar carries zero nav links, only
 * search + account.
 */
export const PRIMARY_NAV: NavItem[] = [
  { route: Routes.dashboard, icon: <CottageRounded />, label: 'Home' },
  { route: Routes.predictions, icon: <BoltRounded />, label: 'Predict' },
  { route: Routes.quiz, icon: <QuizRounded />, label: 'Quiz' },
  { route: Routes.points, icon: <AccountBalanceWalletRounded />, label: 'Points' },
  { route: Routes.leaderboard, icon: <EmojiEventsRounded />, label: 'Ranks' },
  { route: Routes.luckyWinners, icon: <AutoAwesomeRounded />, label: 'Lucky Draw' },
  { route: Routes.rewards, icon: <DiamondRounded />, label: 'Rewards' },
  { route: Routes.profile, icon: <PersonRounded />, label: 'Profile' },
];

/**
 * Looks a primary nav entry up by route.
 *
 * The expanded sidebar used to index into PRIMARY_NAV positionally
 * (PRIMARY_NAV[4], [5]), which silently mismatched every label and icon against
 * its onClick the moment an item was inserted above them. Keyed lookup makes
 * inserting a destination safe.
 */
export function navItemFor(route: string): NavItem {
  const found = PRIMARY_NAV.find((i) => i.route === route);
  if (!found) throw new Error(`No primary nav item for route ${route}`);
  return found;
}

/** Per-destination tint, matching the sidebar/rail's color language. */
export function navTint(route: string): string {
  if (route === Routes.luckyWinners) return WebTokens.gold;
  if (route === Routes.leaderboard) return WebTokens.violet;
  if (route === Routes.quiz) return WebTokens.violet;
  if (route === Routes.rewards) return WebTokens.gold;
  if (route === Routes.points) return WebTokens.gold;
  return WebTokens.accent;
}
