import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface QuizConfig {
  /** Master switch for the automatic loop (admin Settings -> Quiz). */
  enabled: boolean;
  /** How often a new quiz starts, per category. */
  cycleSeconds: number;
  secondsPerQuestion: number;
  questionsPerQuiz: number;
  /**
   * DERIVED, never stored: questionsPerQuiz x secondsPerQuestion.
   *
   * The spec listed duration, time-per-question AND question count as three
   * independently editable settings, but that is over-determined — an admin
   * could set 50s / 10s / 8 questions, which cannot all hold. Deriving duration
   * from the other two makes the contradiction impossible instead of letting an
   * inconsistent trio corrupt a live session.
   */
  durationSeconds: number;
  entryPoints: number;
  rewardPoints: number;
  /** Strictly-greater-than threshold, as a percentage, for a win. */
  winPercent: number;
  /**
   * Allowance for network latency when validating an answer against its
   * question window. Without it, an answer sent at 9.9s legitimately arrives
   * after the 10s boundary and would be wrongly rejected.
   */
  answerGraceMs: number;
}

export const QUIZ_DEFAULTS: Omit<QuizConfig, 'durationSeconds'> = {
  enabled: true,
  cycleSeconds: 900,
  secondsPerQuestion: 10,
  questionsPerQuiz: 5,
  entryPoints: 50,
  // 10% of the original 100, matching the platform-wide reward reduction.
  rewardPoints: 10,
  winPercent: 50,
  answerGraceMs: 1500,
};

/**
 * Resolves the admin-configurable `quiz.*` settings, exactly mirroring
 * `EconomyService.getRules()` and `DailyBonusService.getSettings()` — values
 * live in the shared `Setting` table so the admin panel's existing
 * GET/PUT /admin/settings flow can edit them with no new plumbing.
 */
@Injectable()
export class QuizConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<QuizConfig> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { startsWith: 'quiz.' } },
    });
    const byKey = new Map(
      rows.map((r) => [r.key.replace('quiz.', ''), r.value]),
    );

    const num = (
      key: keyof typeof QUIZ_DEFAULTS,
      min: number,
      max: number,
    ): number => {
      const fallback = QUIZ_DEFAULTS[key] as number;
      const raw = Number(byKey.get(key));
      if (!Number.isFinite(raw)) return fallback;
      return Math.min(Math.max(Math.trunc(raw), min), max);
    };

    const enabledRaw = byKey.get('enabled');
    const secondsPerQuestion = num('secondsPerQuestion', 3, 120);
    const questionsPerQuiz = num('questionsPerQuiz', 1, 50);
    const durationSeconds = secondsPerQuestion * questionsPerQuiz;

    // The waiting period is what makes joining possible at all, so the cycle
    // must be strictly longer than one session. Clamped rather than rejected so
    // a bad admin value degrades instead of breaking the loop.
    const cycleSeconds = Math.max(
      num('cycleSeconds', 30, 86_400),
      durationSeconds + 15,
    );

    return {
      enabled:
        enabledRaw === undefined ? QUIZ_DEFAULTS.enabled : enabledRaw !== false,
      cycleSeconds,
      secondsPerQuestion,
      questionsPerQuiz,
      durationSeconds,
      entryPoints: num('entryPoints', 0, 1_000_000),
      rewardPoints: num('rewardPoints', 0, 1_000_000),
      winPercent: num('winPercent', 0, 100),
      answerGraceMs: num('answerGraceMs', 0, 10_000),
    };
  }
}
