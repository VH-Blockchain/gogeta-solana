/** Route paths for the web portal. Port of WebRoutes. */
export const Routes = {
  landing: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  // Clean app-style routes — these are app pages, not static .html files, so
  // they don't carry the old static site's URL extension.
  privacy: '/privacy',
  terms: '/terms',
  contact: '/contact',

  dashboard: '/dashboard',
  predictions: '/predictions',
  quiz: '/quiz',
  /** Live play and the graded result are their own routes so a refresh or a
   *  shared link lands back on exactly the right step. */
  quizPlay: '/quiz/play',
  quizResult: '/quiz/result',
  /** Points balance, buying points with USDC, and purchase history. */
  points: '/points',
  leaderboard: '/leaderboard',
  luckyWinners: '/leaderboard/lucky',
  rewards: '/rewards',
  profile: '/profile',
  notifications: '/notifications',
} as const;

/** Routes that live inside the authenticated portal shell. */
export const PORTAL_ROUTES: string[] = [
  Routes.dashboard,
  Routes.predictions,
  Routes.quiz,
  Routes.points,
  Routes.leaderboard,
  Routes.rewards,
  Routes.profile,
  Routes.notifications,
];

export function isPortalPath(pathname: string): boolean {
  return PORTAL_ROUTES.some((r) => pathname.startsWith(r));
}
