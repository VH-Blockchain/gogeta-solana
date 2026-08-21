import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuizCategory, QuizResult, QuizStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QuizConfigService } from './quiz-config.service';
import { QUIZ_CATEGORIES, QuizService } from './quiz.service';
import {
  CreateQuizQuestionDto,
  UpdateQuizQuestionDto,
} from './dto/quiz-question.dto';
import { UpdateQuizSettingsDto } from './dto/quiz-settings.dto';

const CATEGORY_LABELS: Record<QuizCategory, string> = {
  POLITICS: 'Politics',
  SPORTS: 'Sports',
  ENTERTAINMENT: 'Entertainment',
  GENERAL_KNOWLEDGE: 'General Knowledge',
};

@Injectable()
export class QuizAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: QuizConfigService,
    private readonly quiz: QuizService,
  ) {}

  // ── Config ──────────────────────────────────────────────────────────────

  /** Resolved config, including the derived duration, for the admin UI. */
  async getSettings() {
    const cfg = await this.config.get();
    return {
      ...cfg,
      // Surfaced so the UI can explain why duration is not directly editable.
      derived: { durationSeconds: 'questionsPerQuiz x secondsPerQuestion' },
    };
  }

  /**
   * Writes `quiz.*` Setting rows. Uses the same key/value Setting table the
   * economy and daily-bonus settings use, so nothing new is introduced.
   *
   * Changes never affect a session that already exists — every Quiz row carries
   * its own frozen config snapshot.
   */
  async updateSettings(dto: UpdateQuizSettingsDto) {
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (entries.length === 0) {
      throw new BadRequestException('No settings provided');
    }

    for (const [key, value] of entries) {
      await this.prisma.setting.upsert({
        where: { key: `quiz.${key}` },
        update: { value: value as Prisma.InputJsonValue },
        create: { key: `quiz.${key}`, value: value as Prisma.InputJsonValue },
      });
    }
    return this.getSettings();
  }

  /** Enable/disable the automatic loop (admin "start"/"stop" control). */
  async setLoopEnabled(enabled: boolean) {
    await this.prisma.setting.upsert({
      where: { key: 'quiz.enabled' },
      update: { value: enabled },
      create: { key: 'quiz.enabled', value: enabled },
    });
    return { enabled };
  }

  // ── Sessions ────────────────────────────────────────────────────────────

  async listQuizzes(opts: {
    category?: QuizCategory;
    status?: QuizStatus;
    skip?: string;
    take?: string;
  }) {
    const take = Math.min(Math.max(Number(opts.take) || 25, 1), 100);
    const skip = Math.max(Number(opts.skip) || 0, 0);
    const where: Prisma.QuizWhereInput = {};
    if (opts.category) where.category = opts.category;
    if (opts.status) where.status = opts.status;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.quiz.count({ where }),
      this.prisma.quiz.findMany({
        where,
        orderBy: [{ slotIndex: 'desc' }, { category: 'asc' }],
        skip,
        take,
        include: { _count: { select: { participations: true } } },
      }),
    ]);

    const now = new Date();
    return {
      total,
      skip,
      take,
      items: rows.map((q) => ({
        id: q.id,
        category: q.category,
        categoryLabel: CATEGORY_LABELS[q.category],
        slotIndex: q.slotIndex,
        status: q.status,
        phase:
          q.status === QuizStatus.CANCELLED
            ? 'cancelled'
            : now < q.startsAt
              ? 'scheduled'
              : now < q.endsAt
                ? 'running'
                : 'finished',
        startsAt: q.startsAt.toISOString(),
        endsAt: q.endsAt.toISOString(),
        settledAt: q.settledAt?.toISOString() ?? null,
        participants: q._count.participations,
        totalQuestions: q.questionIds.length,
        entryPoints: q.entryPoints,
        rewardPoints: q.rewardPoints,
        winPercent: q.winPercent,
        secondsPerQuestion: q.secondsPerQuestion,
      })),
    };
  }

  /** One session with its participants — the admin's results view. */
  async getQuiz(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        participations: {
          orderBy: [{ score: 'desc' }, { joinedAt: 'asc' }],
          include: {
            user: {
              select: { id: true, name: true, email: true, username: true },
            },
          },
        },
      },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');

    const questions = await this.prisma.quizQuestion.findMany({
      where: { id: { in: quiz.questionIds } },
      select: { id: true, question: true, correctIndex: true },
    });
    const byId = new Map(questions.map((q) => [q.id, q]));

    const won = quiz.participations.filter((p) => p.result === 'WON').length;
    const rewardPaid = quiz.participations.reduce(
      (s, p) => s + p.rewardPoints,
      0,
    );
    const entryCollected = quiz.participations.reduce(
      (s, p) => s + p.entryPoints,
      0,
    );

    return {
      id: quiz.id,
      category: quiz.category,
      categoryLabel: CATEGORY_LABELS[quiz.category],
      slotIndex: quiz.slotIndex,
      status: quiz.status,
      startsAt: quiz.startsAt.toISOString(),
      endsAt: quiz.endsAt.toISOString(),
      settledAt: quiz.settledAt?.toISOString() ?? null,
      config: {
        cycleSeconds: quiz.cycleSeconds,
        secondsPerQuestion: quiz.secondsPerQuestion,
        questionsPerQuiz: quiz.questionsPerQuiz,
        entryPoints: quiz.entryPoints,
        rewardPoints: quiz.rewardPoints,
        winPercent: quiz.winPercent,
      },
      totals: {
        participants: quiz.participations.length,
        won,
        lost: quiz.participations.length - won,
        entryCollected,
        rewardPaid,
        net: entryCollected - rewardPaid,
      },
      questions: quiz.questionIds.map((qid, index) => ({
        index,
        id: qid,
        question: byId.get(qid)?.question ?? '(question deleted)',
        correctIndex: byId.get(qid)?.correctIndex ?? null,
      })),
      participants: quiz.participations.map((p) => ({
        id: p.id,
        userId: p.user.id,
        name: p.user.name,
        email: p.user.email,
        username: p.user.username,
        entryPoints: p.entryPoints,
        correctCount: p.correctCount,
        wrongCount: p.wrongCount,
        unansweredCount: p.unansweredCount,
        score: p.score,
        percentage: Math.round(p.percentage * 10) / 10,
        rewardPoints: p.rewardPoints,
        result: p.result,
        joinedAt: p.joinedAt.toISOString(),
        completedAt: p.completedAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Cancels a session. Only allowed before it starts: cancelling a running or
   * finished quiz would strand entry fees that have already been charged.
   */
  async cancelQuiz(id: string) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (new Date() >= quiz.startsAt) {
      throw new BadRequestException({
        error: 'QUIZ_ALREADY_STARTED',
        message: 'A quiz can only be cancelled before it starts.',
      });
    }
    await this.prisma.quiz.update({
      where: { id },
      data: { status: QuizStatus.CANCELLED },
    });
    return { ok: true, id, status: QuizStatus.CANCELLED };
  }

  /** Forces settlement of a finished session (normally the cron's job). */
  async settleQuiz(id: string) {
    await this.quiz.settleQuiz(id);
    return this.getQuiz(id);
  }

  /** Upcoming session per category — the admin's "what happens next" panel. */
  async upcoming() {
    const cfg = await this.config.get();
    const now = new Date();
    const slot = this.quiz.nextSlot(now, cfg);
    const rows = await this.prisma.quiz.findMany({
      where: { slotIndex: slot.slotIndex },
      include: { _count: { select: { participations: true } } },
    });
    const byCategory = new Map(rows.map((r) => [r.category, r]));

    return {
      serverNow: now.toISOString(),
      loopEnabled: cfg.enabled,
      nextSlot: {
        slotIndex: slot.slotIndex,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        startsInMs: Math.max(0, slot.startsAt.getTime() - now.getTime()),
      },
      categories: QUIZ_CATEGORIES.map((category) => {
        const row = byCategory.get(category);
        return {
          category,
          categoryLabel: CATEGORY_LABELS[category],
          quizId: row?.id ?? null,
          status: row?.status ?? null,
          participants: row?._count.participations ?? 0,
        };
      }),
    };
  }

  // ── Analytics ───────────────────────────────────────────────────────────

  /**
   * Quiz analytics for the admin panel.
   *
   * Everything here is derived from what the engine already records — no new
   * counters or tracking tables — so the numbers cannot drift from the sessions
   * and ledger rows they describe.
   *
   * @param days window for the participation/points trend and the rate figures.
   *   Sessions and questions are counted over the same window so a "win rate"
   *   is never mixed from different periods.
   */
  async analytics(daysRaw?: string) {
    const days = Math.min(Math.max(Number(daysRaw) || 30, 1), 365);
    const since = new Date(Date.now() - days * 86_400_000);

    const [
      sessionTotals,
      sessionsByCategory,
      partAgg,
      settledAgg,
      wonCount,
      uniquePlayers,
      answerAgg,
      correctAnswers,
      byCategory,
      optionSpread,
      dailyRows,
      questionStats,
    ] = await Promise.all([
      this.prisma.quiz.aggregate({
        where: { startsAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.quiz.groupBy({
        by: ['category'],
        where: { startsAt: { gte: since } },
        _count: { _all: true },
      }),
      // Every entry in the window, settled or not.
      this.prisma.quizParticipation.aggregate({
        where: { joinedAt: { gte: since } },
        _count: { _all: true },
        _sum: { entryPoints: true, rewardPoints: true },
      }),
      // Only settled entries carry a meaningful score/percentage.
      this.prisma.quizParticipation.aggregate({
        where: { joinedAt: { gte: since }, completedAt: { not: null } },
        _count: { _all: true },
        _avg: { score: true, percentage: true },
        _sum: { correctCount: true, wrongCount: true, unansweredCount: true },
      }),
      this.prisma.quizParticipation.count({
        where: { joinedAt: { gte: since }, result: QuizResult.WON },
      }),
      this.prisma.quizParticipation.findMany({
        where: { joinedAt: { gte: since } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.prisma.quizAnswer.aggregate({
        where: { answeredAt: { gte: since } },
        _count: { _all: true },
        _avg: { responseMs: true },
      }),
      this.prisma.quizAnswer.count({
        where: { answeredAt: { gte: since }, isCorrect: true },
      }),
      this.prisma.quizParticipation.groupBy({
        by: ['quizId'],
        where: { joinedAt: { gte: since } },
        _count: { _all: true },
        _sum: { entryPoints: true, rewardPoints: true },
      }),
      // Which of the four positions players actually pick — a lopsided spread
      // means the question bank's answers are predictable.
      this.prisma.quizAnswer.groupBy({
        by: ['selectedIndex'],
        where: { answeredAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.quizParticipation.findMany({
        where: { joinedAt: { gte: since } },
        select: {
          joinedAt: true,
          entryPoints: true,
          rewardPoints: true,
          result: true,
        },
        orderBy: { joinedAt: 'asc' },
      }),
      // Per-question difficulty, from the answers themselves.
      this.prisma.quizAnswer.groupBy({
        by: ['questionId'],
        where: { answeredAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);

    const entries = partAgg._count._all;
    const settled = settledAgg._count._all;
    const entryCollected = partAgg._sum.entryPoints ?? 0;
    const rewardPaid = partAgg._sum.rewardPoints ?? 0;

    const totalAnswers = answerAgg._count._all;
    const correct = correctAnswers;
    const wrong = totalAnswers - correct;
    const unanswered = settledAgg._sum.unansweredCount ?? 0;

    // Category rollup needs each participation's quiz category, which groupBy
    // cannot reach across the relation — resolve the ids in one extra read.
    const quizIds = byCategory.map((r) => r.quizId);
    const quizCats = quizIds.length
      ? await this.prisma.quiz.findMany({
          where: { id: { in: quizIds } },
          select: { id: true, category: true },
        })
      : [];
    const catOf = new Map(quizCats.map((q) => [q.id, q.category]));
    const sessionCountByCat = new Map(
      sessionsByCategory.map((r) => [r.category, r._count._all]),
    );

    const catRollup = new Map<
      QuizCategory,
      { entries: number; entryCollected: number; rewardPaid: number }
    >();
    for (const row of byCategory) {
      const cat = catOf.get(row.quizId);
      if (!cat) continue;
      const acc = catRollup.get(cat) ?? {
        entries: 0,
        entryCollected: 0,
        rewardPaid: 0,
      };
      acc.entries += row._count._all;
      acc.entryCollected += row._sum.entryPoints ?? 0;
      acc.rewardPaid += row._sum.rewardPoints ?? 0;
      catRollup.set(cat, acc);
    }

    // Correct-rate per question, for the hardest/easiest lists.
    const correctByQuestion = await this.prisma.quizAnswer.groupBy({
      by: ['questionId'],
      where: { answeredAt: { gte: since }, isCorrect: true },
      _count: { _all: true },
    });
    const correctMap = new Map(
      correctByQuestion.map((r) => [r.questionId, r._count._all]),
    );

    // Only questions with enough answers to mean anything.
    const MIN_ANSWERS = 3;
    const ranked = questionStats
      .filter((r) => r._count._all >= MIN_ANSWERS)
      .map((r) => ({
        questionId: r.questionId,
        answers: r._count._all,
        correct: correctMap.get(r.questionId) ?? 0,
        correctRate:
          Math.round(
            ((correctMap.get(r.questionId) ?? 0) / r._count._all) * 1000,
          ) / 10,
      }))
      .sort((a, b) => a.correctRate - b.correctRate);

    const spotlightIds = [...ranked.slice(0, 5), ...ranked.slice(-5)].map(
      (r) => r.questionId,
    );
    const spotlightQuestions = spotlightIds.length
      ? await this.prisma.quizQuestion.findMany({
          where: { id: { in: spotlightIds } },
          select: { id: true, question: true, category: true },
        })
      : [];
    const qById = new Map(spotlightQuestions.map((q) => [q.id, q]));
    const decorate = (r: (typeof ranked)[number]) => ({
      ...r,
      question: qById.get(r.questionId)?.question ?? '(deleted question)',
      category: qById.get(r.questionId)?.category ?? null,
      categoryLabel: (() => {
        const c = qById.get(r.questionId)?.category;
        return c ? CATEGORY_LABELS[c] : null;
      })(),
    });

    // Day buckets for the trend. Built from the rows rather than one query per
    // day, and keyed on the ISO date so gaps show as zero instead of vanishing.
    const dayKeys: string[] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      dayKeys.push(
        new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
      );
    }
    const buckets = new Map(
      dayKeys.map((d) => [
        d,
        { entries: 0, entryCollected: 0, rewardPaid: 0, won: 0 },
      ]),
    );
    for (const row of dailyRows) {
      const key = row.joinedAt.toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (!b) continue;
      b.entries += 1;
      b.entryCollected += row.entryPoints;
      b.rewardPaid += row.rewardPoints;
      if (row.result === QuizResult.WON) b.won += 1;
    }

    const pct = (num: number, den: number) =>
      den > 0 ? Math.round((num / den) * 1000) / 10 : 0;

    return {
      windowDays: days,
      since: since.toISOString(),
      totals: {
        sessions: sessionTotals._count._all,
        entries,
        settled,
        uniquePlayers: uniquePlayers.length,
        won: wonCount,
        lost: Math.max(0, settled - wonCount),
        winRate: pct(wonCount, settled),
        entryCollected,
        rewardPaid,
        netPoints: entryCollected - rewardPaid,
        /** Average entries per session — how busy a session actually is. */
        avgEntriesPerSession:
          sessionTotals._count._all > 0
            ? Math.round((entries / sessionTotals._count._all) * 10) / 10
            : 0,
        avgScore: Math.round((settledAgg._avg.score ?? 0) * 100) / 100,
        avgPercentage: Math.round((settledAgg._avg.percentage ?? 0) * 10) / 10,
      },
      answers: {
        total: totalAnswers,
        correct,
        wrong,
        unanswered,
        accuracy: pct(correct, totalAnswers),
        /** How quickly players answer, against the per-question window. */
        avgResponseMs: Math.round(answerAgg._avg.responseMs ?? 0),
        /** Share of served questions left untouched. */
        skipRate: pct(unanswered, totalAnswers + unanswered),
      },
      /** Pick counts per option position — a flat spread is healthy. */
      optionSpread: [0, 1, 2, 3].map((index) => {
        const row = optionSpread.find((r) => r.selectedIndex === index);
        const count = row?._count._all ?? 0;
        return {
          index,
          label: ['A', 'B', 'C', 'D'][index],
          count,
          share: pct(count, totalAnswers),
        };
      }),
      byCategory: QUIZ_CATEGORIES.map((category) => {
        const roll = catRollup.get(category) ?? {
          entries: 0,
          entryCollected: 0,
          rewardPaid: 0,
        };
        return {
          category,
          categoryLabel: CATEGORY_LABELS[category],
          sessions: sessionCountByCat.get(category) ?? 0,
          entries: roll.entries,
          entryCollected: roll.entryCollected,
          rewardPaid: roll.rewardPaid,
          netPoints: roll.entryCollected - roll.rewardPaid,
        };
      }),
      trend: dayKeys.map((date) => {
        const b = buckets.get(date)!;
        return {
          date,
          entries: b.entries,
          entryCollected: b.entryCollected,
          rewardPaid: b.rewardPaid,
          netPoints: b.entryCollected - b.rewardPaid,
          won: b.won,
        };
      }),
      /** Lowest correct-rate first — the questions players get wrong most. */
      hardestQuestions: ranked.slice(0, 5).map(decorate),
      /** Highest correct-rate — candidates for retiring as too easy. */
      easiestQuestions: ranked.slice(-5).reverse().map(decorate),
      minAnswersForRanking: MIN_ANSWERS,
    };
  }

  // ── Questions ───────────────────────────────────────────────────────────

  async questionCounts() {
    const [active, all] = await Promise.all([
      this.prisma.quizQuestion.groupBy({
        by: ['category'],
        where: { active: true },
        _count: { _all: true },
      }),
      this.prisma.quizQuestion.groupBy({
        by: ['category'],
        _count: { _all: true },
      }),
    ]);
    const activeBy = new Map(active.map((c) => [c.category, c._count._all]));
    const allBy = new Map(all.map((c) => [c.category, c._count._all]));

    return QUIZ_CATEGORIES.map((category) => ({
      category,
      categoryLabel: CATEGORY_LABELS[category],
      active: activeBy.get(category) ?? 0,
      total: allBy.get(category) ?? 0,
    }));
  }

  async listQuestions(opts: {
    category?: QuizCategory;
    active?: string;
    search?: string;
    skip?: string;
    take?: string;
  }) {
    const take = Math.min(Math.max(Number(opts.take) || 25, 1), 200);
    const skip = Math.max(Number(opts.skip) || 0, 0);

    const where: Prisma.QuizQuestionWhereInput = {};
    if (opts.category) where.category = opts.category;
    if (opts.active === 'true') where.active = true;
    else if (opts.active === 'false') where.active = false;
    const q = opts.search?.trim();
    if (q) where.question = { contains: q, mode: 'insensitive' };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.quizQuestion.count({ where }),
      this.prisma.quizQuestion.findMany({
        where,
        orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
        skip,
        take,
      }),
    ]);

    return { total, skip, take, counts: await this.questionCounts(), items };
  }

  async createQuestion(dto: CreateQuizQuestionDto) {
    try {
      return await this.prisma.quizQuestion.create({
        data: {
          category: dto.category,
          question: dto.question.trim(),
          optionA: dto.optionA.trim(),
          optionB: dto.optionB.trim(),
          optionC: dto.optionC.trim(),
          optionD: dto.optionD.trim(),
          correctIndex: dto.correctIndex,
          explanation: dto.explanation?.trim() ?? '',
          active: dto.active ?? true,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          error: 'DUPLICATE_QUESTION',
          message: 'That question already exists in this category.',
        });
      }
      throw err;
    }
  }

  async updateQuestion(id: string, dto: UpdateQuizQuestionDto) {
    await this.requireQuestion(id);
    try {
      return await this.prisma.quizQuestion.update({
        where: { id },
        data: {
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.question !== undefined && { question: dto.question.trim() }),
          ...(dto.optionA !== undefined && { optionA: dto.optionA.trim() }),
          ...(dto.optionB !== undefined && { optionB: dto.optionB.trim() }),
          ...(dto.optionC !== undefined && { optionC: dto.optionC.trim() }),
          ...(dto.optionD !== undefined && { optionD: dto.optionD.trim() }),
          ...(dto.correctIndex !== undefined && {
            correctIndex: dto.correctIndex,
          }),
          ...(dto.explanation !== undefined && {
            explanation: dto.explanation.trim(),
          }),
          ...(dto.active !== undefined && { active: dto.active }),
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          error: 'DUPLICATE_QUESTION',
          message: 'Another question in this category already has that text.',
        });
      }
      throw err;
    }
  }

  async setQuestionStatus(id: string, active: boolean) {
    await this.requireQuestion(id);
    return this.prisma.quizQuestion.update({ where: { id }, data: { active } });
  }

  /**
   * Deletes a question, or deactivates it instead if it has already been
   * answered — those QuizAnswer rows are a permanent record of what a user was
   * asked, so removing the question would destroy their history.
   */
  async deleteQuestion(id: string) {
    await this.requireQuestion(id);
    const used = await this.prisma.quizAnswer.count({
      where: { questionId: id },
    });
    if (used > 0) {
      const deactivated = await this.prisma.quizQuestion.update({
        where: { id },
        data: { active: false },
      });
      return {
        ok: true,
        deleted: false,
        deactivated: true,
        reason: `This question has ${used} recorded answer(s), so it was deactivated instead of deleted to preserve those results.`,
        question: deactivated,
      };
    }
    await this.prisma.quizQuestion.delete({ where: { id } });
    return { ok: true, deleted: true, deactivated: false };
  }

  private async requireQuestion(id: string) {
    const found = await this.prisma.quizQuestion.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Question not found');
    return found;
  }
}
