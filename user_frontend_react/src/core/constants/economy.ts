/**
 * Fallback coin values.
 *
 * These are last-resort defaults only — every one of them is admin-editable and
 * served live by `GET /config` (see EconomyConfig), so UI that shows an amount to
 * a user must read it from `useConfigStore`, not from here. They exist for
 * placeholder factories that run before any fetch.
 *
 * Reward amounts mirror the backend's reduced defaults (10% of the platform's
 * original values); entryFee is a cost, so it is unchanged.
 */
export const Economy = {
  registrationBonus: 100,
  predictionEntryFee: 50,
  correctPredictionReward: 10,
  luckyWinnerBonus: 50,
  dailyLuckyWinners: 10,
} as const;

/** Achievement levels (SOW §5.5), in promotion order. */
export const USER_LEVELS = [
  'beginner',
  'predictor',
  'analyst',
  'expert',
  'champion',
  'legend',
] as const;

export type UserLevel = (typeof USER_LEVELS)[number];

export const levelLabel: Record<UserLevel, string> = {
  beginner: 'Beginner',
  predictor: 'Predictor',
  analyst: 'Analyst',
  expert: 'Expert',
  champion: 'Champion',
  legend: 'Legend',
};

export const levelCriteria: Record<UserLevel, string> = {
  beginner: 'Registration',
  predictor: '10 Predictions',
  analyst: '50 Correct Predictions',
  expert: '100 Correct Predictions',
  champion: 'Top 10 Monthly',
  legend: 'Top 3 Monthly (3 Times)',
};

/**
 * Unit for a LevelProgress target when this level is being progressed
 * toward — kept separate from `levelCriteria` so the numeric readout doesn't
 * have to string-parse the descriptive caption.
 */
export const levelProgressUnit: Record<UserLevel, string> = {
  beginner: '',
  predictor: 'Predictions',
  analyst: 'Correct Predictions',
  expert: 'Correct Predictions',
  champion: '',
  legend: '',
};

export function levelOrder(level: UserLevel): number {
  return USER_LEVELS.indexOf(level);
}

export function nextLevel(level: UserLevel): UserLevel | null {
  const i = levelOrder(level) + 1;
  return i < USER_LEVELS.length ? USER_LEVELS[i] : null;
}

export interface LevelProgress {
  current: number;
  target: number;
  /** 0..1 */
  ratio: number;
}

/**
 * Real progress toward reaching `level`, using the exact counts the backend
 * promotes on (gamification.service.ts's levelFromStats()). Null for
 * champion/legend — those promote on monthly leaderboard rank, not a count,
 * so there's no ratio to show.
 */
export function levelProgressTo(
  level: UserLevel,
  stats: { totalPredictions: number; correctPredictions: number },
): LevelProgress | null {
  const make = (current: number, target: number): LevelProgress => ({
    current,
    target,
    ratio: target === 0 ? 0 : Math.min(Math.max(current / target, 0), 1),
  });
  switch (level) {
    case 'predictor':
      return make(Math.min(stats.totalPredictions, 10), 10);
    case 'analyst':
      return make(Math.min(stats.correctPredictions, 50), 50);
    case 'expert':
      return make(Math.min(stats.correctPredictions, 100), 100);
    default:
      return null;
  }
}

export interface LevelProgressDisplay {
  ratio: number;
  /** e.g. "12 / 50 Correct Predictions" */
  progressLabel: string;
  /** e.g. "50 Correct Predictions to Analyst" */
  goalLabel: string;
}

/**
 * What every level-progress card needs to render — one shared computation
 * so no two screens (or platforms) can drift into showing different numbers
 * for the same underlying promotion.
 */
export function nextLevelProgressDisplay(args: {
  level: UserLevel;
  totalPredictions: number;
  correctPredictions: number;
  maxReachedLabel: string;
}): LevelProgressDisplay {
  const next = nextLevel(args.level);
  if (next == null) {
    return { ratio: 1, progressLabel: args.maxReachedLabel, goalLabel: args.maxReachedLabel };
  }
  const lp = levelProgressTo(next, args);
  const progressLabel =
    lp == null ? levelCriteria[next] : `${lp.current} / ${lp.target} ${levelProgressUnit[next]}`;
  return {
    ratio: lp?.ratio ?? 0,
    progressLabel,
    goalLabel: `${levelCriteria[next]} to ${levelLabel[next]}`,
  };
}

/** Achievement badges (SOW §5.5). */
export const BADGE_TYPES = [
  'welcome',
  'firstPrediction',
  'accuracyMaster',
  'winningStreak',
  'dailyHero',
  'weeklyStar',
  'monthlyChampion',
] as const;

export type BadgeType = (typeof BADGE_TYPES)[number];

export const badgeLabel: Record<BadgeType, string> = {
  welcome: 'Welcome',
  firstPrediction: 'First Prediction',
  accuracyMaster: 'Accuracy Master',
  winningStreak: 'Winning Streak',
  dailyHero: 'Daily Hero',
  weeklyStar: 'Weekly Star',
  monthlyChampion: 'Monthly Champion',
};

export const badgeRequirement: Record<BadgeType, string> = {
  welcome: 'Join GOGETA',
  firstPrediction: 'Submit first prediction',
  accuracyMaster: '80% accuracy (min. 5 predictions)',
  winningStreak: '10 correct in a row',
  dailyHero: 'Daily Rank #1',
  weeklyStar: 'Weekly Rank #1',
  monthlyChampion: 'Monthly Rank #1',
};
