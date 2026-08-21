import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  CoinTxnType,
  Prisma,
  QuizCategory,
  QuizResult,
  QuizStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EconomyService } from '../economy/economy.service';
import { isReviewAccount } from '../common/review-account';
import { QuizConfig, QuizConfigService } from './quiz-config.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

/** A resolved slot on the global quiz clock. */
export interface QuizSlot {
  slotIndex: number;
  startsAt: Date;
  endsAt: Date;
}

export const QUIZ_CATEGORIES: QuizCategory[] = [
  QuizCategory.POLITICS,
  QuizCategory.SPORTS,
  QuizCategory.ENTERTAINMENT,
  QuizCategory.GENERAL_KNOWLEDGE,
];

const CATEGORY_LABELS: Record<QuizCategory, string> = {
  POLITICS: 'Politics',
  SPORTS: 'Sports',
  ENTERTAINMENT: 'Entertainment',
  GENERAL_KNOWLEDGE: 'General Knowledge',
};

@Injectable()
export class QuizService {
  private readonly logger = new Logger('Quiz');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: QuizConfigService,
    private readonly economy: EconomyService,
  ) {}

  // ── The slot clock ──────────────────────────────────────────────────────
  //
  // Quiz timing is DERIVED from the wall clock, not driven by a ticking job.
  // The finest cron in this codebase is one minute, but the game needs
  // 10-second precision — so instead of scheduling state transitions, every
  // session's start/end is pure arithmetic on `slotIndex`.
  //
  // Consequences, all of them desirable:
  //   - nothing to recover after a restart (there is no in-memory state),
  //   - two instances cannot disagree about when a quiz runs,
  //   - the unique (category, slotIndex) constraint makes creation idempotent,
  //     so duplicate sessions are impossible rather than merely unlikely.

  /** The slot containing `now`. Its quiz started at `startsAt`. */
  slotFor(now: Date, cfg: QuizConfig): QuizSlot {
    const cycleMs = cfg.cycleSeconds * 1000;
    const slotIndex = Math.floor(now.getTime() / cycleMs);
    const startsAt = new Date(slotIndex * cycleMs);
    return {
      slotIndex,
      startsAt,
      endsAt: new Date(startsAt.getTime() + cfg.durationSeconds * 1000),
    };
  }

  /**
   * The next slot — the one users can still join. The current slot's quiz has
   * by definition already started (its start is <= now), so the joinable
   * session is always the following one.
   */
  nextSlot(now: Date, cfg: QuizConfig): QuizSlot {
    const cycleMs = cfg.cycleSeconds * 1000;
    const slotIndex = Math.floor(now.getTime() / cycleMs) + 1;
    const startsAt = new Date(slotIndex * cycleMs);
    return {
      slotIndex,
      startsAt,
      endsAt: new Date(startsAt.getTime() + cfg.durationSeconds * 1000),
    };
  }

  /**
   * Picks this session's questions deterministically and cycles through the
   * whole pool: slot N takes the window starting at (N x questionsPerQuiz),
   * wrapping around when it runs off the end. Satisfies "when all questions
   * have been used, start again from the beginning".
   */
  private async pickQuestionIds(
    category: QuizCategory,
    slotIndex: number,
    cfg: QuizConfig,
  ): Promise<string[]> {
    const pool = await this.prisma.quizQuestion.findMany({
      where: { category, active: true },
      // Stable ordering so the same slot always yields the same window.
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    if (pool.length === 0) return [];

    const take = Math.min(cfg.questionsPerQuiz, pool.length);
    const offset = (slotIndex * take) % pool.length;
    const ids: string[] = [];
    for (let i = 0; i < take; i += 1) {
      ids.push(pool[(offset + i) % pool.length].id);
    }
    return ids;
  }

  /**
   * Returns the Quiz row for (category, slot), creating it if absent.
   *
   * Two concurrent callers both racing to create the same session is expected,
   * not exceptional — the unique constraint decides the winner and the loser
   * re-reads. That is the whole duplicate-session defence.
   */
  private async ensureQuiz(
    category: QuizCategory,
    slot: QuizSlot,
    cfg: QuizConfig,
  ) {
    const existing = await this.prisma.quiz.findUnique({
      where: { category_slotIndex: { category, slotIndex: slot.slotIndex } },
    });
    if (existing) return existing;

    const questionIds = await this.pickQuestionIds(
      category,
      slot.slotIndex,
      cfg,
    );
    if (questionIds.length === 0) {
      throw new BadRequestException({
        error: 'NO_QUESTIONS',
        message: `No active questions are available for ${CATEGORY_LABELS[category]} yet.`,
      });
    }

    try {
      return await this.prisma.quiz.create({
        data: {
          category,
          slotIndex: slot.slotIndex,
          status: QuizStatus.SCHEDULED,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          // Snapshot: an admin changing the rules mid-flight must not alter a
          // session that is already scheduled or running.
          cycleSeconds: cfg.cycleSeconds,
          secondsPerQuestion: cfg.secondsPerQuestion,
          questionsPerQuiz: questionIds.length,
          entryPoints: cfg.entryPoints,
          rewardPoints: cfg.rewardPoints,
          winPercent: cfg.winPercent,
          questionIds,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Lost the race — the other caller's row is the canonical one.
        const won = await this.prisma.quiz.findUnique({
          where: {
            category_slotIndex: { category, slotIndex: slot.slotIndex },
          },
        });
        if (won) return won;
      }
      throw err;
    }
  }

  /** Phase of a session relative to `now`, derived from its own snapshot. */
  private phaseOf(
    quiz: { startsAt: Date; endsAt: Date; status: QuizStatus },
    now: Date,
  ) {
    if (quiz.status === QuizStatus.CANCELLED) return 'cancelled' as const;
    if (now < quiz.startsAt) return 'scheduled' as const;
    if (now < quiz.endsAt) return 'running' as const;
    return 'finished' as const;
  }

  /** Per-question window inside a session, from the frozen snapshot. */
  private questionWindow(
    quiz: { startsAt: Date; secondsPerQuestion: number },
    index: number,
  ) {
    const perMs = quiz.secondsPerQuestion * 1000;
    const startsAt = new Date(quiz.startsAt.getTime() + index * perMs);
    return { startsAt, endsAt: new Date(startsAt.getTime() + perMs) };
  }

  /** Index of the question that is open right now, or null outside the session. */
  private currentQuestionIndex(
    quiz: {
      startsAt: Date;
      endsAt: Date;
      secondsPerQuestion: number;
      questionIds: string[];
    },
    now: Date,
  ): number | null {
    if (now < quiz.startsAt || now >= quiz.endsAt) return null;
    const elapsed = now.getTime() - quiz.startsAt.getTime();
    const index = Math.floor(elapsed / (quiz.secondsPerQuestion * 1000));
    return index >= 0 && index < quiz.questionIds.length ? index : null;
  }

  // ── User: browse ────────────────────────────────────────────────────────

  /** GET /quiz/categories — the landing page payload. */
  async categories(userId: string) {
    const cfg = await this.config.get();
    const now = new Date();

    const counts = await this.prisma.quizQuestion.groupBy({
      by: ['category'],
      where: { active: true },
      _count: { _all: true },
    });
    const countByCategory = new Map(
      counts.map((c) => [c.category, c._count._all]),
    );

    const next = this.nextSlot(now, cfg);
    const joined = await this.prisma.quizParticipation.findMany({
      where: { userId, quiz: { slotIndex: next.slotIndex } },
      select: { quiz: { select: { category: true } } },
    });
    const joinedCategories = new Set(joined.map((j) => j.quiz.category));

    return {
      serverNow: now.toISOString(),
      config: {
        entryPoints: cfg.entryPoints,
        rewardPoints: cfg.rewardPoints,
        winPercent: cfg.winPercent,
        questionsPerQuiz: cfg.questionsPerQuiz,
        secondsPerQuestion: cfg.secondsPerQuestion,
        durationSeconds: cfg.durationSeconds,
        cycleSeconds: cfg.cycleSeconds,
        enabled: cfg.enabled,
      },
      nextQuiz: {
        slotIndex: next.slotIndex,
        startsAt: next.startsAt.toISOString(),
        endsAt: next.endsAt.toISOString(),
        opensInMs: Math.max(0, next.startsAt.getTime() - now.getTime()),
      },
      categories: QUIZ_CATEGORIES.map((category) => ({
        key: category,
        label: CATEGORY_LABELS[category],
        questionCount: countByCategory.get(category) ?? 0,
        joinedNext: joinedCategories.has(category),
      })),
    };
  }

  /** GET /quiz/next — the joinable session for one category. */
  async next(userId: string, category: QuizCategory) {
    const cfg = await this.config.get();
    const now = new Date();
    const slot = this.nextSlot(now, cfg);
    const quiz = await this.ensureQuiz(category, slot, cfg);

    const participation = await this.prisma.quizParticipation.findUnique({
      where: { userId_quizId: { userId, quizId: quiz.id } },
      select: { id: true, entryPoints: true, joinedAt: true },
    });

    return {
      serverNow: now.toISOString(),
      quiz: this.publicQuiz(quiz, now),
      joined: participation != null,
      participation,
    };
  }

  /**
   * GET /quiz/current — the session the user is actually playing, if any.
   * Also covers a page refresh mid-quiz: state is rebuilt from the server, so
   * nothing depends on the client having stayed open.
   */
  async current(userId: string) {
    const cfg = await this.config.get();
    const now = new Date();
    const slot = this.slotFor(now, cfg);

    const participation = await this.prisma.quizParticipation.findFirst({
      where: { userId, quiz: { slotIndex: slot.slotIndex } },
      include: {
        quiz: true,
        answers: { select: { questionId: true, questionIndex: true } },
      },
    });
    if (!participation) return { serverNow: now.toISOString(), active: null };

    const { quiz } = participation;
    const phase = this.phaseOf(quiz, now);
    const index = this.currentQuestionIndex(quiz, now);

    return {
      serverNow: now.toISOString(),
      active: {
        quiz: this.publicQuiz(quiz, now),
        phase,
        questionIndex: index,
        answeredIndexes: participation.answers.map((a) => a.questionIndex),
        // Ready to grade the moment the window closes.
        resultReady: phase === 'finished',
      },
    };
  }

  private publicQuiz(
    quiz: {
      id: string;
      category: QuizCategory;
      slotIndex: number;
      status: QuizStatus;
      startsAt: Date;
      endsAt: Date;
      entryPoints: number;
      rewardPoints: number;
      winPercent: number;
      secondsPerQuestion: number;
      questionIds: string[];
    },
    now: Date,
  ) {
    return {
      id: quiz.id,
      category: quiz.category,
      categoryLabel: CATEGORY_LABELS[quiz.category],
      slotIndex: quiz.slotIndex,
      phase: this.phaseOf(quiz, now),
      startsAt: quiz.startsAt.toISOString(),
      endsAt: quiz.endsAt.toISOString(),
      startsInMs: Math.max(0, quiz.startsAt.getTime() - now.getTime()),
      entryPoints: quiz.entryPoints,
      rewardPoints: quiz.rewardPoints,
      winPercent: quiz.winPercent,
      secondsPerQuestion: quiz.secondsPerQuestion,
      totalQuestions: quiz.questionIds.length,
    };
  }

  // ── User: join ──────────────────────────────────────────────────────────

  /**
   * POST /quiz/:quizId/join — charge entry and register the user.
   *
   * Everything that matters happens inside one transaction, and the
   * (userId, quizId) unique constraint is what actually prevents a
   * double-clicked Join from charging twice — a read-then-write check alone
   * would still race.
   */
  async join(userId: string, email: string | null | undefined, quizId: string) {
    const cfg = await this.config.get();
    const now = new Date();

    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.status === QuizStatus.CANCELLED) {
      throw new BadRequestException({
        error: 'QUIZ_CANCELLED',
        message: 'This quiz was cancelled.',
      });
    }
    if (!cfg.enabled) {
      throw new ForbiddenException({
        error: 'QUIZ_DISABLED',
        message: 'Quizzes are currently disabled.',
      });
    }
    // The join gate, enforced server-side — the frontend hiding the button is
    // not a control.
    if (now >= quiz.startsAt) {
      throw new BadRequestException({
        error: 'QUIZ_ALREADY_STARTED',
        message: 'This quiz has already started. Join the next one.',
      });
    }

    // Free entry when the economy is switched off globally, and for the
    // store-review account — consistent with predictions, so the UI never
    // shows "free" while actually charging.
    const pointsEnabled = await this.economy.pointsEnabled();
    const entryPoints =
      !pointsEnabled || isReviewAccount(email) ? 0 : quiz.entryPoints;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.coins < entryPoints) {
      throw new BadRequestException({
        error: 'INSUFFICIENT_POINTS',
        message: `You need ${entryPoints} points to join this quiz.`,
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const participation = await tx.quizParticipation.create({
          data: { userId, quizId: quiz.id, entryPoints },
        });

        // A zero-cost entry writes no ledger row — a "+0"/"-0" transaction is
        // noise in the user's points history (same rule as free predictions).
        const balance =
          entryPoints > 0
            ? await this.economy.applyTxn(
                tx,
                userId,
                CoinTxnType.QUIZ_ENTRY,
                -entryPoints,
                {
                  referenceId: quiz.id,
                  description: `Quiz entry: ${CATEGORY_LABELS[quiz.category]}`,
                },
              )
            : user.coins;

        return {
          ok: true,
          balance,
          participation: {
            id: participation.id,
            quizId: quiz.id,
            entryPoints,
            joinedAt: participation.joinedAt.toISOString(),
          },
          quiz: this.publicQuiz(quiz, now),
        };
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          error: 'ALREADY_JOINED',
          message: 'You have already joined this quiz.',
        });
      }
      throw err;
    }
  }

  // ── User: play ──────────────────────────────────────────────────────────

  /**
   * GET /quiz/:quizId/question — the question whose window is open right now.
   *
   * Served one at a time and gated by the server's clock, rather than shipping
   * all five upfront: that keeps "display one question at a time" honest and
   * stops a player reading ahead. `correctIndex` is never included.
   */
  async currentQuestion(userId: string, quizId: string) {
    const now = new Date();
    const { quiz, participation } = await this.requireParticipation(
      userId,
      quizId,
    );

    const phase = this.phaseOf(quiz, now);
    if (phase === 'scheduled') {
      return {
        serverNow: now.toISOString(),
        phase,
        startsInMs: quiz.startsAt.getTime() - now.getTime(),
        question: null,
      };
    }
    if (phase !== 'running') {
      return { serverNow: now.toISOString(), phase, question: null };
    }

    const index = this.currentQuestionIndex(quiz, now);
    if (index === null) {
      return {
        serverNow: now.toISOString(),
        phase: 'finished' as const,
        question: null,
      };
    }

    const questionId = quiz.questionIds[index];
    const question = await this.prisma.quizQuestion.findUnique({
      where: { id: questionId },
      // correctIndex and explanation are deliberately NOT selected — they must
      // not reach the client before the result phase.
      select: {
        id: true,
        question: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
      },
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const window = this.questionWindow(quiz, index);
    const answered = await this.prisma.quizAnswer.findUnique({
      where: {
        participationId_questionId: {
          participationId: participation.id,
          questionId,
        },
      },
      select: { selectedIndex: true },
    });

    return {
      serverNow: now.toISOString(),
      phase,
      question: {
        id: question.id,
        index,
        number: index + 1,
        totalQuestions: quiz.questionIds.length,
        question: question.question,
        options: [
          question.optionA,
          question.optionB,
          question.optionC,
          question.optionD,
        ],
        questionStartTime: window.startsAt.toISOString(),
        questionEndTime: window.endsAt.toISOString(),
        quizEndTime: quiz.endsAt.toISOString(),
        remainingMs: Math.max(0, window.endsAt.getTime() - now.getTime()),
        // Lets a refreshed client re-render its own choice without revealing
        // whether it was right.
        mySelectedIndex: answered?.selectedIndex ?? null,
      },
    };
  }

  /**
   * POST /quiz/:quizId/answer — record one answer.
   *
   * The response never says whether the answer was correct; that would leak the
   * answer key mid-quiz. Grading happens here but is only revealed at result.
   */
  async answer(userId: string, quizId: string, dto: SubmitAnswerDto) {
    const cfg = await this.config.get();
    const now = new Date();
    const { quiz, participation } = await this.requireParticipation(
      userId,
      quizId,
    );

    if (this.phaseOf(quiz, now) !== 'running') {
      throw new BadRequestException({
        error: 'QUIZ_NOT_RUNNING',
        message: 'This quiz is not currently accepting answers.',
      });
    }

    const index = quiz.questionIds.indexOf(dto.questionId);
    if (index === -1) {
      // Also blocks answering a question that belongs to a different session.
      throw new BadRequestException({
        error: 'QUESTION_NOT_IN_QUIZ',
        message: 'That question is not part of this quiz.',
      });
    }

    const window = this.questionWindow(quiz, index);
    if (now < window.startsAt) {
      throw new BadRequestException({
        error: 'QUESTION_NOT_OPEN',
        message: 'That question has not started yet.',
      });
    }
    // Server-side timeout check with a small latency allowance. The client's
    // own countdown is never trusted for this.
    if (now.getTime() > window.endsAt.getTime() + cfg.answerGraceMs) {
      throw new BadRequestException({
        error: 'QUESTION_EXPIRED',
        message: 'Time is up for that question.',
      });
    }

    const question = await this.prisma.quizQuestion.findUnique({
      where: { id: dto.questionId },
      select: { correctIndex: true },
    });
    if (!question) throw new NotFoundException('Question not found');

    try {
      await this.prisma.quizAnswer.create({
        data: {
          participationId: participation.id,
          questionId: dto.questionId,
          selectedIndex: dto.selectedIndex,
          isCorrect: dto.selectedIndex === question.correctIndex,
          questionIndex: index,
          responseMs: Math.max(0, now.getTime() - window.startsAt.getTime()),
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // A replayed request is a no-op, not an overwrite — the first answer
        // stands.
        throw new ConflictException({
          error: 'ALREADY_ANSWERED',
          message: 'You have already answered that question.',
        });
      }
      throw err;
    }

    const nextIndex = index + 1;
    return {
      ok: true,
      // Deliberately no `isCorrect` here.
      accepted: true,
      questionIndex: index,
      nextQuestionIndex: nextIndex < quiz.questionIds.length ? nextIndex : null,
      quizEndTime: quiz.endsAt.toISOString(),
      serverNow: now.toISOString(),
    };
  }

  private async requireParticipation(userId: string, quizId: string) {
    const participation = await this.prisma.quizParticipation.findFirst({
      where: { userId, quizId },
      include: { quiz: true },
    });
    if (!participation) {
      throw new ForbiddenException({
        error: 'NOT_JOINED',
        message: 'You have not joined this quiz.',
      });
    }
    return { participation, quiz: participation.quiz };
  }

  // ── Settlement + result ─────────────────────────────────────────────────

  /**
   * Grades one participation and pays any reward. Idempotent by
   * `completedAt`: the row is claimed with a conditional updateMany, so the
   * result endpoint and the sweep cron racing each other can only ever produce
   * one payout.
   */
  private async settleParticipation(participationId: string): Promise<void> {
    const participation = await this.prisma.quizParticipation.findUnique({
      where: { id: participationId },
      include: { quiz: true, answers: true },
    });
    if (!participation || participation.completedAt) return;

    const { quiz } = participation;
    if (new Date() < quiz.endsAt) return; // not finished yet

    const total = quiz.questionIds.length;
    const correctCount = participation.answers.filter(
      (a) => a.isCorrect,
    ).length;
    const answered = participation.answers.length;
    const wrongCount = answered - correctCount;
    const unansweredCount = Math.max(0, total - answered);
    const percentage = total > 0 ? (correctCount / total) * 100 : 0;
    // Strictly greater than the threshold — "more than 50%" per the rules.
    const won = percentage > quiz.winPercent;
    const rewardPoints = won ? quiz.rewardPoints : 0;

    await this.prisma.$transaction(async (tx) => {
      // Claim the row. Zero rows updated means someone else already settled it,
      // so we must not pay out again.
      const claimed = await tx.quizParticipation.updateMany({
        where: { id: participation.id, completedAt: null },
        data: {
          completedAt: new Date(),
          correctCount,
          wrongCount,
          unansweredCount,
          score: correctCount,
          percentage,
          rewardPoints,
          result: won ? QuizResult.WON : QuizResult.LOST,
        },
      });
      if (claimed.count === 0) return;

      if (rewardPoints > 0) {
        await this.economy.applyTxn(
          tx,
          participation.userId,
          CoinTxnType.QUIZ_REWARD,
          rewardPoints,
          {
            referenceId: quiz.id,
            description: `Quiz win: ${CATEGORY_LABELS[quiz.category]}`,
          },
        );
      }
    });
  }

  /** Settles every participation in a finished quiz, then marks the quiz done. */
  async settleQuiz(quizId: string): Promise<void> {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: { id: true, endsAt: true, status: true, settledAt: true },
    });
    if (!quiz || quiz.settledAt) return;
    if (new Date() < quiz.endsAt) return;

    const participations = await this.prisma.quizParticipation.findMany({
      where: { quizId, completedAt: null },
      select: { id: true },
    });
    for (const p of participations) {
      await this.settleParticipation(p.id);
    }

    await this.prisma.quiz.updateMany({
      where: { id: quizId, settledAt: null },
      data: { settledAt: new Date(), status: QuizStatus.FINISHED },
    });
  }

  /**
   * GET /quiz/:quizId/result — grade on demand, then return the full breakdown.
   *
   * Settling here as well as in the cron means a player who stays on the page
   * sees their result immediately rather than waiting up to a minute. Repeated
   * calls are safe: settlement is idempotent, so this cannot pay twice.
   */
  async result(userId: string, quizId: string) {
    const { quiz, participation } = await this.requireParticipation(
      userId,
      quizId,
    );
    const now = new Date();

    if (now < quiz.endsAt) {
      throw new BadRequestException({
        error: 'QUIZ_NOT_FINISHED',
        message: 'This quiz is still in progress.',
      });
    }

    await this.settleParticipation(participation.id);
    return this.resultPayload(userId, quizId);
  }

  private async resultPayload(userId: string, quizId: string) {
    const participation = await this.prisma.quizParticipation.findFirst({
      where: { userId, quizId },
      include: {
        quiz: true,
        answers: true,
      },
    });
    if (!participation) throw new NotFoundException('Participation not found');

    const { quiz } = participation;
    // Correct answers and explanations are only ever loaded here — the result
    // phase — never during play.
    const questions = await this.prisma.quizQuestion.findMany({
      where: { id: { in: quiz.questionIds } },
      select: {
        id: true,
        question: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        correctIndex: true,
        explanation: true,
      },
    });
    const byId = new Map(questions.map((q) => [q.id, q]));
    const answerByQuestion = new Map(
      participation.answers.map((a) => [a.questionId, a]),
    );

    return {
      quiz: {
        id: quiz.id,
        category: quiz.category,
        categoryLabel: CATEGORY_LABELS[quiz.category],
        slotIndex: quiz.slotIndex,
        startsAt: quiz.startsAt.toISOString(),
        endsAt: quiz.endsAt.toISOString(),
        winPercent: quiz.winPercent,
      },
      summary: {
        totalQuestions: quiz.questionIds.length,
        correctAnswers: participation.correctCount,
        wrongAnswers: participation.wrongCount,
        unanswered: participation.unansweredCount,
        score: participation.score,
        percentage: Math.round(participation.percentage * 10) / 10,
        pointsSpent: participation.entryPoints,
        pointsEarned: participation.rewardPoints,
        netPoints: participation.rewardPoints - participation.entryPoints,
        result: participation.result,
        won: participation.result === QuizResult.WON,
        joinedAt: participation.joinedAt.toISOString(),
        completedAt: participation.completedAt?.toISOString() ?? null,
      },
      questions: quiz.questionIds.map((id, index) => {
        const q = byId.get(id);
        const a = answerByQuestion.get(id);
        return {
          index,
          number: index + 1,
          question: q?.question ?? '',
          options: q ? [q.optionA, q.optionB, q.optionC, q.optionD] : [],
          correctIndex: q?.correctIndex ?? null,
          selectedIndex: a?.selectedIndex ?? null,
          answered: a != null,
          isCorrect: a?.isCorrect ?? false,
          explanation: q?.explanation ?? '',
        };
      }),
    };
  }

  // ── User: history ───────────────────────────────────────────────────────

  /** GET /quiz/history */
  async history(userId: string, opts: { skip?: string; take?: string } = {}) {
    const take = Math.min(Math.max(Number(opts.take) || 20, 1), 50);
    const skip = Math.max(Number(opts.skip) || 0, 0);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.quizParticipation.count({ where: { userId } }),
      this.prisma.quizParticipation.findMany({
        where: { userId },
        include: { quiz: true },
        orderBy: { joinedAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      total,
      skip,
      take,
      items: rows.map((p) => ({
        id: p.id,
        quizId: p.quizId,
        slotIndex: p.quiz.slotIndex,
        category: p.quiz.category,
        categoryLabel: CATEGORY_LABELS[p.quiz.category],
        playedAt: p.quiz.startsAt.toISOString(),
        totalQuestions: p.quiz.questionIds.length,
        correctAnswers: p.correctCount,
        wrongAnswers: p.wrongCount,
        unanswered: p.unansweredCount,
        score: p.score,
        percentage: Math.round(p.percentage * 10) / 10,
        pointsSpent: p.entryPoints,
        pointsEarned: p.rewardPoints,
        netPoints: p.rewardPoints - p.entryPoints,
        result: p.result,
        won: p.result === QuizResult.WON,
        settled: p.completedAt != null,
      })),
    };
  }

  /** GET /quiz/history/:id — full breakdown of one past attempt. */
  async historyDetail(userId: string, participationId: string) {
    const participation = await this.prisma.quizParticipation.findFirst({
      where: { id: participationId, userId },
      select: { quizId: true },
    });
    if (!participation) throw new NotFoundException('Quiz attempt not found');
    return this.resultPayload(userId, participation.quizId);
  }

  // ── The loop ────────────────────────────────────────────────────────────

  /**
   * Every minute: grade any session whose window has closed.
   *
   * This is the safety net for players who closed the tab — the result endpoint
   * settles interactively for anyone still watching. Both paths share the same
   * idempotent settlement, so whichever runs first wins and the other no-ops.
   */
  @Cron('* * * * *')
  async settleFinishedQuizzes() {
    const due = await this.prisma.quiz.findMany({
      where: {
        settledAt: null,
        endsAt: { lte: new Date() },
        status: { not: QuizStatus.CANCELLED },
      },
      select: { id: true },
      take: 50,
    });
    if (due.length === 0) return;

    for (const q of due) {
      try {
        await this.settleQuiz(q.id);
      } catch (err) {
        this.logger.error(`Failed to settle quiz ${q.id}: ${String(err)}`);
      }
    }
    this.logger.log(`Settled ${due.length} finished quiz session(s)`);
  }

  /**
   * Every minute: make sure the upcoming session exists for each category so
   * players see a real, joinable quiz rather than one conjured on first click.
   *
   * This is a convenience, not the mechanism — `ensureQuiz` is idempotent and
   * runs on demand too, so a missed tick (or a restart) costs nothing.
   */
  @Cron('* * * * *')
  async prepareUpcomingQuizzes() {
    const cfg = await this.config.get();
    if (!cfg.enabled) return;

    const slot = this.nextSlot(new Date(), cfg);
    for (const category of QUIZ_CATEGORIES) {
      try {
        await this.ensureQuiz(category, slot, cfg);
      } catch (err) {
        // A category with no active questions is an expected, recoverable
        // state — log it once per tick rather than failing the whole sweep.
        if (err instanceof BadRequestException) continue;
        this.logger.error(`Failed to prepare ${category} quiz: ${String(err)}`);
      }
    }

    // Flip any session whose start time has passed to RUNNING so the persisted
    // status matches the derived phase for anyone reading the table directly.
    await this.prisma.quiz.updateMany({
      where: { status: QuizStatus.SCHEDULED, startsAt: { lte: new Date() } },
      data: { status: QuizStatus.RUNNING },
    });
  }
}
