// Shared API types for the GOGETA admin panel (mirror the NestJS backend).

export type Role = 'USER' | 'VIEWER' | 'ADMIN';

export interface LedgerRow {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  createdAt: string;
}

export interface UserEntryRow {
  id: string;
  prediction: string;
  predictionStatus: string;
  pick: string;
  status: string;
  rewardEarned: number;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  name: string;
  role: Role;
  coins: number;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  name: string;
  role: Role;
  coins: number;
  level: string;
  totalPredictions: number;
  correctPredictions: number;
  currentStreak: number;
  isVerified: boolean;
  isSuspended: boolean;
  createdAt: string;
  lastActiveAt: string | null;
}

export interface UsersPage {
  users: AdminUser[];
  total: number;
  skip: number;
  take: number;
}

export interface Analytics {
  totalUsers: number;
  activeUsers: number;
  dailyPredictions: number;
  predictionsResolved: number;
  coinsDistributed: number;
  avgAccuracy: number;
}

export type PredictionStatus = 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'LOCKED' | 'AUTO_RESOLVED' | 'RESOLVED' | 'CANCELLED';

export interface PredictionOption {
  id: string;
  label: string;
  odds: number;
  order: number;
  votes: number;
  marketKey?: string | null;
  question?: string | null;
}

export interface AdminPrediction {
  id: string;
  referenceCode?: string | null;
  categoryId: string;
  title: string;
  subtitle: string;
  source?: PredictionSource;
  info?: string;
  bannerImageUrl?: string | null;
  entryFee: number;
  reward: number;
  /** True = Points/Reward track Settings -> Points economy live; false = the
   *  entryFee/reward above are a fixed per-prediction override. */
  useDefaultEconomy: boolean;
  status: PredictionStatus;
  featured: boolean;
  participants: number;
  opensAt: string;
  closesAt: string;
  resolvedAt: string | null;
  correctOptionId: string | null;
  options: PredictionOption[];
}

export type PredictionSource = 'MANUAL' | 'CSV' | 'AUTO_ENTRY';

export interface PredictionEntryRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  username: string;
  pick: string;
  entryFee: number;
  status: string;
  rewardEarned: number;
  createdAt: string;
  resolvedAt: string | null;
}

export interface PredictionEntriesPage {
  total: number;
  skip: number;
  take: number;
  items: PredictionEntryRow[];
}

export interface AuditEntry {
  id: string;
  action: string;
  target: string | null;
  meta: unknown;
  createdAt: string;
  actor: string | null;
}

export interface AdminCategory {
  id: string;
  key: string;
  label: string;
  icon: string;
  imageUrl?: string | null;
  iconImageUrl?: string | null;
  accent: string;
  sortOrder: number;
  active: boolean;
}

export interface ClosedPredictionRow {
  id: string;
  title: string;
  category: string;
  participants: number;
  entries: number;
  won: number;
  lost: number;
  accuracy: number;
  winningOption: string | null;
  rewardPaid: number;
  // Lucky-draw payout is a once-daily platform-wide pool, not attributable
  // to a single prediction — see ClosedPredictionAnalytics.totalLuckyPaid.
  payout: number;
  resolvedAt: string | null;
}

export interface ClosedPredictionAnalytics {
  totalResolved: number;
  totalEntries: number;
  totalWon: number;
  avgAccuracy: number;
  totalRewardPaid: number;
  totalLuckyPaid: number;
  totalPayout: number;
  predictions: ClosedPredictionRow[];
}

export interface Setting {
  key: string;
  value: string;
  updatedAt?: string;
}

export interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  link?: string | null;
  active: boolean;
  sortOrder: number;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  active: boolean;
  updatedAt?: string;
}

/* ── Quiz ──────────────────────────────────────────────────────────────── */

export type QuizCategory = 'POLITICS' | 'SPORTS' | 'ENTERTAINMENT' | 'GENERAL_KNOWLEDGE';
export type QuizStatus = 'SCHEDULED' | 'RUNNING' | 'FINISHED' | 'CANCELLED';
/** Live phase derived from the server clock — not the same thing as `status`,
 *  which only records SCHEDULED/CANCELLED intent. See quiz.service.ts. */
export type QuizPhase = 'scheduled' | 'running' | 'finished' | 'cancelled';

export interface QuizSettings {
  enabled: boolean;
  cycleSeconds: number;
  secondsPerQuestion: number;
  questionsPerQuiz: number;
  /** Read-only: questionsPerQuiz × secondsPerQuestion. */
  durationSeconds: number;
  entryPoints: number;
  rewardPoints: number;
  winPercent: number;
  answerGraceMs: number;
  derived?: { durationSeconds: string };
}

export interface QuizSessionRow {
  id: string;
  category: QuizCategory;
  categoryLabel: string;
  slotIndex: number;
  status: QuizStatus;
  phase: QuizPhase;
  startsAt: string;
  endsAt: string;
  settledAt: string | null;
  participants: number;
  totalQuestions: number;
  entryPoints: number;
  rewardPoints: number;
  winPercent: number;
  secondsPerQuestion: number;
}

export interface QuizSessionsPage {
  total: number;
  skip: number;
  take: number;
  items: QuizSessionRow[];
}

export interface QuizParticipantRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  username: string | null;
  entryPoints: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  score: number;
  percentage: number;
  rewardPoints: number;
  result: 'WON' | 'LOST' | null;
  joinedAt: string;
  completedAt: string | null;
}

export interface QuizSessionDetail {
  id: string;
  category: QuizCategory;
  categoryLabel: string;
  slotIndex: number;
  status: QuizStatus;
  startsAt: string;
  endsAt: string;
  settledAt: string | null;
  config: {
    cycleSeconds: number;
    secondsPerQuestion: number;
    questionsPerQuiz: number;
    entryPoints: number;
    rewardPoints: number;
    winPercent: number;
  };
  totals: {
    participants: number;
    won: number;
    lost: number;
    entryCollected: number;
    rewardPaid: number;
    net: number;
  };
  questions: { index: number; id: string; question: string; correctIndex: number | null }[];
  participants: QuizParticipantRow[];
}

export interface QuizUpcoming {
  serverNow: string;
  loopEnabled: boolean;
  nextSlot: { slotIndex: number; startsAt: string; endsAt: string; startsInMs: number };
  categories: {
    category: QuizCategory;
    categoryLabel: string;
    quizId: string | null;
    status: QuizStatus | null;
    participants: number;
  }[];
}

export interface QuizQuestionRow {
  id: string;
  category: QuizCategory;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctIndex: number;
  explanation: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestionCount {
  category: QuizCategory;
  categoryLabel: string;
  active: number;
  total: number;
}

export interface QuizQuestionsPage {
  total: number;
  skip: number;
  take: number;
  counts: QuizQuestionCount[];
  items: QuizQuestionRow[];
}

/* ── Points purchases (USDC SPL on Solana) ─────────────────────────────── */

export type PointPurchaseStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface PointPurchaseRow {
  id: string;
  user: { id: string; name: string; email: string; username: string | null };
  walletAddress: string;
  /** Decimal string — USDC amounts never pass through a JS number. */
  usdcAmount: string;
  points: number;
  exchangeRate: number;
  network: string;
  networkName: string;
  tokenMint: string;
  receiverAddress: string;
  transactionSignature: string | null;
  explorerUrl: string | null;
  status: PointPurchaseStatus;
  failureReason: string | null;
  blockNumber: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface PointPurchasesPage {
  total: number;
  skip: number;
  take: number;
  statusCounts: Partial<Record<PointPurchaseStatus, number>>;
  totals: {
    confirmedPurchases: number;
    pointsCredited: number;
    usdcCollected: string;
  };
  items: PointPurchaseRow[];
}

export interface PointPurchaseDetail extends Omit<PointPurchaseRow, 'user'> {
  user: { id: string; name: string; email: string; username: string | null; coins: number };
  usdcAmountRaw: string;
  updatedAt: string;
  expiresAt: string;
  /** The ledger row the credit produced — proof the points were booked. */
  coinTransaction: {
    id: string;
    amount: number;
    balanceAfter: number;
    createdAt: string;
    description: string;
  } | null;
}

/** Deployment health for the purchase feature. */
export interface PointsStatus {
  enabled: boolean;
  adminEnabled: boolean;
  /** Non-null when the operator still has configuration to fill in. */
  configError: string | null;
  network: {
    /** Cluster moniker, e.g. `devnet`. */
    network: string;
    /** Human label, e.g. `Solana Devnet`. */
    networkName: string;
    rpcUrl: string;
    explorerUrl: string;
    /** The USDC SPL mint the platform accepts. */
    usdcMint: string;
    usdcDecimals: number;
    receiverAddress: string;
  };
  rpcReachable: boolean;
  /** Cluster the RPC actually reports, or null when unreachable. */
  rpcNetwork: string | null;
  /** False when the RPC is answering for a different cluster than configured. */
  networkMatches: boolean;
  rate: { usdcToPoints: number; minUsdc: number; maxUsdc: number };
}

/* ── Quiz analytics ────────────────────────────────────────────────────── */

export interface QuizAnalytics {
  windowDays: number;
  since: string;
  totals: {
    sessions: number;
    entries: number;
    settled: number;
    uniquePlayers: number;
    won: number;
    lost: number;
    winRate: number;
    entryCollected: number;
    rewardPaid: number;
    netPoints: number;
    avgEntriesPerSession: number;
    avgScore: number;
    avgPercentage: number;
  };
  answers: {
    total: number;
    correct: number;
    wrong: number;
    unanswered: number;
    accuracy: number;
    avgResponseMs: number;
    skipRate: number;
  };
  optionSpread: { index: number; label: string; count: number; share: number }[];
  byCategory: {
    category: QuizCategory;
    categoryLabel: string;
    sessions: number;
    entries: number;
    entryCollected: number;
    rewardPaid: number;
    netPoints: number;
  }[];
  trend: {
    date: string;
    entries: number;
    entryCollected: number;
    rewardPaid: number;
    netPoints: number;
    won: number;
  }[];
  hardestQuestions: QuizQuestionDifficulty[];
  easiestQuestions: QuizQuestionDifficulty[];
  /** Questions below this answer count are excluded from the rankings. */
  minAnswersForRanking: number;
}

export interface QuizQuestionDifficulty {
  questionId: string;
  question: string;
  category: QuizCategory | null;
  categoryLabel: string | null;
  answers: number;
  correct: number;
  correctRate: number;
}

/* ── Withdrawals ───────────────────────────────────────────────────────── */

export type WithdrawalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED';

export interface WithdrawalRow {
  id: string;
  user: { id: string; name: string; email: string; username: string | null; coins: number };
  walletAddress: string;
  points: number;
  /** Decimal string — payout amounts never pass through a JS number. */
  amount: string;
  amountRaw: string;
  /** Points per whole token, snapshotted when the request was made. */
  exchangeRate: number;
  network: string;
  networkName: string;
  tokenMint: string;
  tokenSymbol: string;
  tokenDecimals: number;
  status: WithdrawalStatus;
  /** True while the points are held but not yet debited. */
  reserved: boolean;
  userNote: string | null;
  adminNote: string | null;
  transactionSignature: string | null;
  explorerUrl: string | null;
  blockNumber: string | null;
  adminId: string | null;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  completedAt: string | null;
}

export interface WithdrawalsPage {
  total: number;
  skip: number;
  take: number;
  statusCounts: Partial<Record<WithdrawalStatus, number>>;
  totals: {
    completedRequests: number;
    pointsPaid: number;
    amountPaid: string;
    openRequests: number;
    pointsReserved: number;
    amountReserved: string;
    tokenSymbol: string;
  };
  items: WithdrawalRow[];
}

export interface WithdrawalDetail extends WithdrawalRow {
  /** The debit this withdrawal produced — proof the points were taken. */
  coinTransaction: {
    id: string;
    amount: number;
    balanceAfter: number;
    createdAt: string;
    description: string;
  } | null;
  /** The user's eligibility right now, for context on the decision. */
  userAvailability: {
    totalPoints: number;
    withdrawablePoints: number;
    reservedPoints: number;
    availableToWithdraw: number;
  };
}

/** Deployment health for the withdrawal feature. */
export interface WithdrawalsStatus {
  enabled: boolean;
  adminEnabled: boolean;
  configError: string | null;
  rpcReachable: boolean;
  /** Cluster the RPC actually reports, or null when unreachable. */
  rpcNetwork: string | null;
  /** False when the RPC is answering for a different cluster than configured. */
  networkMatches: boolean;
  network: {
    /** Cluster moniker, e.g. `devnet`. */
    network: string;
    /** Human label, e.g. `Solana Devnet`. */
    networkName: string;
    tokenMint: string;
    tokenSymbol: string;
    tokenDecimals: number;
    treasuryAddress: string;
    /** Every wallet allowed to sign a payout. `WITHDRAWAL_TREASURY_ADDRESS`
     *  accepts a comma-separated list, since each admin signs from their own. */
    treasuryAddresses: string[];

  };
  rules: {
    pointsPerToken: number;
    minWithdrawalPoints: number;
    luckyBonusWithdrawable: boolean;
  };
}
