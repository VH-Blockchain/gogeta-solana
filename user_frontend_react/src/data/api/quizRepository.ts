import { ApiClient } from '@/core/network/apiClient';
import type {
  QuizCategoryInfo,
  QuizCategoryKey,
  QuizHistoryItem,
  QuizLiveQuestion,
  QuizPhase,
  QuizResultView,
  QuizRules,
  QuizSession,
  QuizSummary,
} from '../models';

/**
 * Quiz API. Mirrors the shape of predictionsRepository: envelope types declared
 * here, entities in models.ts, and the JSON->model mapping done locally (the
 * same approach leaderboardRepository takes).
 *
 * Every response carries `serverNow`. The backend owns quiz timing entirely, so
 * callers use that value to correct for a skewed browser clock rather than
 * trusting Date.now() — see useServerClock.
 */

const int = (v: unknown, fallback = 0): number =>
  typeof v === 'number' ? Math.trunc(v) : fallback;

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const str = (v: unknown, fallback = ''): string => (v != null ? String(v) : fallback);

/** ISO timestamp -> epoch ms, 0 when absent/unparseable. */
const ms = (v: unknown): number => {
  if (v == null) return 0;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? 0 : t;
};

const msOrNull = (v: unknown): number | null => {
  if (v == null) return null;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
};

const phase = (v: unknown): QuizPhase => {
  const s = String(v);
  return s === 'running' || s === 'finished' || s === 'cancelled' ? s : 'scheduled';
};

const category = (v: unknown): QuizCategoryKey => {
  const s = String(v);
  return s === 'SPORTS' || s === 'ENTERTAINMENT' || s === 'GENERAL_KNOWLEDGE'
    ? s
    : 'POLITICS';
};

const resultOf = (v: unknown): 'WON' | 'LOST' | null =>
  v === 'WON' ? 'WON' : v === 'LOST' ? 'LOST' : null;

/** Exactly four options; pads defensively so an option row can never be blank. */
const options = (v: unknown): string[] => {
  const list = Array.isArray(v) ? v.map((o) => str(o)) : [];
  while (list.length < 4) list.push('');
  return list.slice(0, 4);
};

function sessionFromApi(j: Record<string, any>): QuizSession {
  return {
    id: str(j.id),
    category: category(j.category),
    categoryLabel: str(j.categoryLabel),
    slotIndex: int(j.slotIndex),
    phase: phase(j.phase),
    startsAtMs: ms(j.startsAt),
    endsAtMs: ms(j.endsAt),
    startsInMs: int(j.startsInMs),
    entryPoints: int(j.entryPoints),
    rewardPoints: int(j.rewardPoints),
    winPercent: int(j.winPercent),
    secondsPerQuestion: int(j.secondsPerQuestion, 10),
    totalQuestions: int(j.totalQuestions),
  };
}

function rulesFromApi(j: Record<string, any>): QuizRules {
  return {
    entryPoints: int(j.entryPoints),
    rewardPoints: int(j.rewardPoints),
    winPercent: int(j.winPercent, 50),
    questionsPerQuiz: int(j.questionsPerQuiz, 5),
    secondsPerQuestion: int(j.secondsPerQuestion, 10),
    durationSeconds: int(j.durationSeconds),
    cycleSeconds: int(j.cycleSeconds),
    enabled: j.enabled !== false,
  };
}

function summaryFromApi(j: Record<string, any>): QuizSummary {
  return {
    totalQuestions: int(j.totalQuestions),
    correctAnswers: int(j.correctAnswers),
    wrongAnswers: int(j.wrongAnswers),
    unanswered: int(j.unanswered),
    score: int(j.score),
    percentage: num(j.percentage),
    pointsSpent: int(j.pointsSpent),
    pointsEarned: int(j.pointsEarned),
    netPoints: int(j.netPoints),
    result: resultOf(j.result),
    won: j.won === true,
    joinedAtMs: ms(j.joinedAt),
    completedAtMs: msOrNull(j.completedAt),
  };
}

function resultFromApi(m: Record<string, any>): QuizResultView {
  const q = (m.quiz ?? {}) as Record<string, any>;
  return {
    quizId: str(q.id),
    category: category(q.category),
    categoryLabel: str(q.categoryLabel),
    slotIndex: int(q.slotIndex),
    startsAtMs: ms(q.startsAt),
    endsAtMs: ms(q.endsAt),
    winPercent: int(q.winPercent, 50),
    summary: summaryFromApi((m.summary ?? {}) as Record<string, any>),
    questions: (Array.isArray(m.questions) ? m.questions : []).map(
      (r: Record<string, any>) => ({
        index: int(r.index),
        number: int(r.number),
        question: str(r.question),
        options: options(r.options),
        correctIndex: typeof r.correctIndex === 'number' ? int(r.correctIndex) : null,
        selectedIndex: typeof r.selectedIndex === 'number' ? int(r.selectedIndex) : null,
        answered: r.answered === true,
        isCorrect: r.isCorrect === true,
        explanation: str(r.explanation),
      }),
    ),
  };
}

export interface QuizCategoriesResult {
  serverNowMs: number;
  rules: QuizRules;
  nextQuiz: {
    slotIndex: number;
    startsAtMs: number;
    endsAtMs: number;
    opensInMs: number;
  };
  categories: QuizCategoryInfo[];
}

export interface QuizNextResult {
  serverNowMs: number;
  quiz: QuizSession;
  joined: boolean;
}

/** The session this user is playing right now, if any. */
export interface QuizCurrentResult {
  serverNowMs: number;
  active: {
    quiz: QuizSession;
    phase: QuizPhase;
    /** Null outside the running window. */
    questionIndex: number | null;
    answeredIndexes: number[];
    resultReady: boolean;
  } | null;
}

export interface QuizJoinResult {
  ok: boolean;
  balance: number;
  entryPoints: number;
  quiz: QuizSession;
}

export interface QuizQuestionResult {
  serverNowMs: number;
  phase: QuizPhase;
  /** Null before the session starts, after it ends, or between questions. */
  question: QuizLiveQuestion | null;
  /** Only sent while the session is still scheduled; 0 otherwise. */
  startsInMs: number;
}

export interface QuizAnswerResult {
  ok: boolean;
  questionIndex: number;
  nextQuestionIndex: number | null;
  serverNowMs: number;
}

export interface QuizHistoryPage {
  total: number;
  skip: number;
  take: number;
  items: QuizHistoryItem[];
}

export const QuizRepository = {
  async categories(): Promise<QuizCategoriesResult> {
    const m: any = await ApiClient.get('/quiz/categories');
    const n = m?.nextQuiz ?? {};
    return {
      serverNowMs: ms(m?.serverNow),
      rules: rulesFromApi(m?.config ?? {}),
      nextQuiz: {
        slotIndex: int(n.slotIndex),
        startsAtMs: ms(n.startsAt),
        endsAtMs: ms(n.endsAt),
        opensInMs: int(n.opensInMs),
      },
      categories: (Array.isArray(m?.categories) ? m.categories : []).map(
        (c: Record<string, any>) => ({
          key: category(c.key),
          label: str(c.label),
          questionCount: int(c.questionCount),
          joinedNext: c.joinedNext === true,
        }),
      ),
    };
  },

  async next(categoryKey: QuizCategoryKey): Promise<QuizNextResult> {
    const m: any = await ApiClient.get('/quiz/next', { category: categoryKey });
    return {
      serverNowMs: ms(m?.serverNow),
      quiz: sessionFromApi(m?.quiz ?? {}),
      joined: m?.joined === true,
    };
  },

  async current(): Promise<QuizCurrentResult> {
    const m: any = await ApiClient.get('/quiz/current');
    const a = m?.active;
    return {
      serverNowMs: ms(m?.serverNow),
      active: a
        ? {
            quiz: sessionFromApi(a.quiz ?? {}),
            phase: phase(a.phase),
            questionIndex: typeof a.questionIndex === 'number' ? int(a.questionIndex) : null,
            answeredIndexes: (Array.isArray(a.answeredIndexes) ? a.answeredIndexes : []).map(
              (i: unknown) => int(i),
            ),
            resultReady: a.resultReady === true,
          }
        : null,
    };
  },

  async join(quizId: string): Promise<QuizJoinResult> {
    const m: any = await ApiClient.post(`/quiz/${quizId}/join`);
    return {
      ok: m?.ok === true,
      balance: int(m?.balance),
      entryPoints: int(m?.participation?.entryPoints),
      quiz: sessionFromApi(m?.quiz ?? {}),
    };
  },

  async question(quizId: string): Promise<QuizQuestionResult> {
    const m: any = await ApiClient.get(`/quiz/${quizId}/question`);
    const q = m?.question;
    return {
      serverNowMs: ms(m?.serverNow),
      phase: phase(m?.phase),
      startsInMs: int(m?.startsInMs),
      question: q
        ? {
            id: str(q.id),
            index: int(q.index),
            number: int(q.number),
            totalQuestions: int(q.totalQuestions),
            question: str(q.question),
            options: options(q.options),
            questionStartMs: ms(q.questionStartTime),
            questionEndMs: ms(q.questionEndTime),
            quizEndMs: ms(q.quizEndTime),
            remainingMs: int(q.remainingMs),
            mySelectedIndex:
              typeof q.mySelectedIndex === 'number' ? int(q.mySelectedIndex) : null,
          }
        : null,
    };
  },

  async answer(
    quizId: string,
    questionId: string,
    selectedIndex: number,
  ): Promise<QuizAnswerResult> {
    const m: any = await ApiClient.post(`/quiz/${quizId}/answer`, {
      questionId,
      selectedIndex,
    });
    return {
      ok: m?.ok === true,
      questionIndex: int(m?.questionIndex),
      nextQuestionIndex:
        typeof m?.nextQuestionIndex === 'number' ? int(m.nextQuestionIndex) : null,
      serverNowMs: ms(m?.serverNow),
    };
  },

  async result(quizId: string): Promise<QuizResultView> {
    return resultFromApi((await ApiClient.get(`/quiz/${quizId}/result`)) as Record<string, any>);
  },

  async history(opts: { skip?: number; take?: number } = {}): Promise<QuizHistoryPage> {
    const params: Record<string, string> = {};
    if (opts.skip != null) params.skip = String(opts.skip);
    if (opts.take != null) params.take = String(opts.take);

    const m: any = await ApiClient.get('/quiz/history', params);
    return {
      total: int(m?.total),
      skip: int(m?.skip),
      take: int(m?.take, 20),
      items: (Array.isArray(m?.items) ? m.items : []).map((j: Record<string, any>) => ({
        id: str(j.id),
        quizId: str(j.quizId),
        slotIndex: int(j.slotIndex),
        category: category(j.category),
        categoryLabel: str(j.categoryLabel),
        playedAtMs: ms(j.playedAt),
        totalQuestions: int(j.totalQuestions),
        correctAnswers: int(j.correctAnswers),
        wrongAnswers: int(j.wrongAnswers),
        unanswered: int(j.unanswered),
        score: int(j.score),
        percentage: num(j.percentage),
        pointsSpent: int(j.pointsSpent),
        pointsEarned: int(j.pointsEarned),
        netPoints: int(j.netPoints),
        result: resultOf(j.result),
        won: j.won === true,
        settled: j.settled === true,
      })),
    };
  },

  /** A past attempt, by participation id — same payload shape as `result`. */
  async historyDetail(participationId: string): Promise<QuizResultView> {
    return resultFromApi(
      (await ApiClient.get(`/quiz/history/${participationId}`)) as Record<string, any>,
    );
  },
};
