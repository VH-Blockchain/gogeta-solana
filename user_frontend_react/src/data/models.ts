import { Economy, type BadgeType, type UserLevel } from '@/core/constants/economy';
import type { AccentFamily } from '@/theme/palette';

/**
 * Domain models for GOGETA. Pure data — populated by the API repositories.
 * Port of lib/data/models/models.dart.
 */

export const PREDICTION_CATEGORIES = [
  'sports',
  'crypto',
  'finance',
  'entertainment',
  'politics',
  'esports',
  'weather',
  'science',
] as const;

export type PredictionCategory = (typeof PREDICTION_CATEGORIES)[number];

export const categoryLabel: Record<PredictionCategory, string> = {
  sports: 'Sports',
  crypto: 'Crypto',
  finance: 'Finance',
  entertainment: 'Entertainment',
  politics: 'Politics',
  esports: 'Esports',
  weather: 'Weather',
  science: 'Science',
};

/** Material icon name per built-in category — resolved by `iconByName`. */
export const categoryIconName: Record<PredictionCategory, string> = {
  sports: 'sports_basketball',
  crypto: 'currency_bitcoin',
  finance: 'show_chart',
  entertainment: 'movie',
  politics: 'how_to_vote',
  esports: 'sports_esports',
  weather: 'cloud',
  science: 'science',
};

export type PredictionStatus = 'open' | 'locked' | 'won' | 'lost' | 'awaitingResult';

export interface PredictionOption {
  id: string;
  label: string;
  /** e.g. 1.85 — NOT a payout multiplier in this app; see ArenaCard. */
  odds: number;
  /** crowd share 0..100 */
  sharePercent: number;
}

export interface Prediction {
  id: string;
  category: PredictionCategory;
  title: string;
  subtitle: string;
  options: PredictionOption[];
  entryFee: number;
  reward: number;
  /** Milliseconds until close (0 once closed) — Flutter's `closesIn` Duration. */
  closesInMs: number;
  participants: number;
  status: PredictionStatus;
  selectedOptionId?: string | null;
  correctOptionId?: string | null;
  featured: boolean;
  info: string;
  bannerImageUrl?: string | null;
  /**
   * Backend category key (e.g. "music"). Falls back to the built-in category
   * name so mock/built-in predictions keep working. Resolve display through
   * CategoryCatalog for admin-managed categories.
   */
  categoryKey: string;
}

export function isResolved(p: Prediction): boolean {
  return p.status === 'won' || p.status === 'lost';
}

/**
 * Optimistic local copy marking this prediction as answered, so a screen's
 * own "already answered" filter (selectedOptionId == null) can hide it the
 * instant a submit succeeds, without waiting for the next full list refresh.
 */
export function withSelectedOption(p: Prediction, optionId: string): Prediction {
  return { ...p, selectedOptionId: optionId };
}

export function emptyPrediction(overrides: Partial<Prediction> = {}): Prediction {
  return {
    id: '',
    category: 'sports',
    title: '',
    subtitle: '',
    options: [],
    entryFee: Economy.predictionEntryFee,
    reward: Economy.correctPredictionReward,
    closesInMs: 0,
    participants: 0,
    status: 'open',
    selectedOptionId: null,
    correctOptionId: null,
    featured: false,
    info: '',
    bannerImageUrl: null,
    categoryKey: 'sports',
    ...overrides,
  };
}

export interface BadgeInfo {
  type: BadgeType;
  earned: boolean;
  /** 0..1 toward earning */
  progress: number;
}

export interface AppUser {
  id: string;
  name: string;
  username: string;
  coins: number;
  level: UserLevel;
  xp: number;
  xpToNext: number;
  totalPredictions: number;
  correctPredictions: number;
  currentStreak: number;
  bestStreak: number;
  globalRank: number;
  badges: BadgeInfo[];
  joinedLabel: string;
  email: string;
  bio: string;
  avatarSeed: number;
}

export function accuracyOf(u: Pick<AppUser, 'totalPredictions' | 'correctPredictions'>): number {
  return u.totalPredictions === 0 ? 0 : u.correctPredictions / u.totalPredictions;
}

export function earnedBadges(u: Pick<AppUser, 'badges'>): number {
  return u.badges.filter((b) => b.earned).length;
}

/** "Ada Lovelace" -> "AL"; "Ada" -> "A". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}

/** A blank user so the UI can render before the profile fetch resolves. */
export const emptyUser: AppUser = {
  id: '',
  name: '',
  username: '',
  coins: 0,
  level: 'beginner',
  xp: 0,
  xpToNext: 500,
  totalPredictions: 0,
  correctPredictions: 0,
  currentStreak: 0,
  bestStreak: 0,
  globalRank: 0,
  badges: [],
  joinedLabel: 'Member',
  email: '',
  bio: '',
  avatarSeed: 0,
};

export interface LeaderboardEntry {
  rank: number;
  name: string;
  username: string;
  score: number;
  accuracy: number;
  coins: number;
  topBadge: BadgeType;
  isCurrentUser: boolean;
  /** color seed for the avatar tint */
  seed: number;
}

export type RewardKind = 'signup' | 'entry' | 'correct' | 'lucky' | 'bonus';

export interface RewardTxn {
  id: string;
  kind: RewardKind;
  title: string;
  /** signed */
  amount: number;
  timeAgo: string;
}

/** Material icon name per reward kind — resolved by `iconByName`. */
export const rewardKindIconName: Record<RewardKind, string> = {
  signup: 'card_giftcard',
  entry: 'how_to_vote',
  correct: 'check_circle',
  lucky: 'auto_awesome',
  bonus: 'bolt',
};

export type NotificationKind =
  | 'lucky'
  | 'result'
  | 'badge'
  | 'leaderboard'
  | 'system'
  | 'reminder';

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  timeAgo: string;
  unread: boolean;
}

export const notificationKindIconName: Record<NotificationKind, string> = {
  lucky: 'auto_awesome',
  result: 'flag',
  badge: 'workspace_premium',
  leaderboard: 'leaderboard',
  system: 'info',
  reminder: 'alarm',
};

/** Maps a built-in category to one of the four feature accents. */
export function accentForCategory(category: PredictionCategory): AccentFamily {
  switch (category) {
    case 'crypto':
    case 'finance':
      return 'rewards';
    case 'entertainment':
    case 'esports':
      return 'leaderboard';
    case 'politics':
    case 'science':
    case 'weather':
      return 'profile';
    case 'sports':
    default:
      return 'predictions';
  }
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

/** The four fixed quiz categories (the backend's QuizCategory enum). */
export const QUIZ_CATEGORY_KEYS = [
  'POLITICS',
  'SPORTS',
  'ENTERTAINMENT',
  'GENERAL_KNOWLEDGE',
] as const;

export type QuizCategoryKey = (typeof QUIZ_CATEGORY_KEYS)[number];

/**
 * A session's live phase, as the backend reports it. Derived there from the
 * server clock, so it is authoritative — the UI recomputes it locally only to
 * keep countdowns smooth between polls, never to decide what is allowed.
 */
export type QuizPhase = 'scheduled' | 'running' | 'finished' | 'cancelled';

/** Admin-configured rules, echoed to the client so the UI can explain costs. */
export interface QuizRules {
  entryPoints: number;
  rewardPoints: number;
  winPercent: number;
  questionsPerQuiz: number;
  secondsPerQuestion: number;
  durationSeconds: number;
  cycleSeconds: number;
  enabled: boolean;
}

export interface QuizCategoryInfo {
  key: QuizCategoryKey;
  label: string;
  /** Active questions in the pool — never assumed to be a fixed number. */
  questionCount: number;
  /** True when this user has already joined the upcoming session. */
  joinedNext: boolean;
}

/**
 * One quiz session. Timestamps are epoch milliseconds rather than ISO strings:
 * every screen here does clock arithmetic against the server-synced now, and
 * parsing the same string on every animation frame would be wasteful.
 */
export interface QuizSession {
  id: string;
  category: QuizCategoryKey;
  categoryLabel: string;
  slotIndex: number;
  phase: QuizPhase;
  startsAtMs: number;
  endsAtMs: number;
  startsInMs: number;
  entryPoints: number;
  rewardPoints: number;
  winPercent: number;
  secondsPerQuestion: number;
  totalQuestions: number;
}

/**
 * A question as served during play. There is deliberately no correct answer
 * here — the backend does not send one until the result phase, so the client
 * has nothing to leak even if inspected.
 */
export interface QuizLiveQuestion {
  id: string;
  index: number;
  number: number;
  totalQuestions: number;
  question: string;
  options: string[];
  questionStartMs: number;
  questionEndMs: number;
  quizEndMs: number;
  remainingMs: number;
  /** This user's own pick, so a refresh mid-question re-renders it. */
  mySelectedIndex: number | null;
}

export interface QuizSummary {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  score: number;
  percentage: number;
  pointsSpent: number;
  pointsEarned: number;
  netPoints: number;
  result: 'WON' | 'LOST' | null;
  won: boolean;
  joinedAtMs: number;
  completedAtMs: number | null;
}

/** A graded question on the result screen — correct answer now included. */
export interface QuizReviewQuestion {
  index: number;
  number: number;
  question: string;
  options: string[];
  correctIndex: number | null;
  selectedIndex: number | null;
  answered: boolean;
  isCorrect: boolean;
  explanation: string;
}

export interface QuizResultView {
  quizId: string;
  category: QuizCategoryKey;
  categoryLabel: string;
  slotIndex: number;
  startsAtMs: number;
  endsAtMs: number;
  winPercent: number;
  summary: QuizSummary;
  questions: QuizReviewQuestion[];
}

export interface QuizHistoryItem {
  id: string;
  quizId: string;
  slotIndex: number;
  category: QuizCategoryKey;
  categoryLabel: string;
  playedAtMs: number;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  score: number;
  percentage: number;
  pointsSpent: number;
  pointsEarned: number;
  netPoints: number;
  result: 'WON' | 'LOST' | null;
  won: boolean;
  /** False while a finished session is still awaiting settlement. */
  settled: boolean;
}
