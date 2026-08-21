import { PrismaClient, QuizCategory } from '@prisma/client';
import 'dotenv/config';
import { QUIZ_QUESTIONS } from './quiz-questions';

const prisma = new PrismaClient();

/**
 * Seeds the quiz question pool (50 per category, 200 total) and the default
 * `quiz.*` settings.
 *
 * Safely re-runnable: questions upsert on the unique (category, question) pair,
 * and settings only fill in keys that are missing — so an admin's tuned values
 * are never overwritten by a re-seed.
 */
export async function seedQuiz(client: PrismaClient = prisma) {
  let created = 0;
  let updated = 0;

  for (const q of QUIZ_QUESTIONS) {
    const category = q.category as QuizCategory;
    const existing = await client.quizQuestion.findUnique({
      where: { category_question: { category, question: q.question } },
      select: { id: true },
    });

    await client.quizQuestion.upsert({
      where: { category_question: { category, question: q.question } },
      // Refresh the answer/options/explanation so corrections to the seed file
      // propagate, but never silently re-activate a question an admin disabled.
      update: {
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      },
      create: {
        category,
        question: q.question,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        active: true,
      },
    });

    if (existing) updated += 1;
    else created += 1;
  }

  // Defaults for the quiz engine. Written as individual Setting rows so the
  // admin panel's existing GET/PUT /admin/settings flow can edit them, exactly
  // like `economy.*` and `dailyBonus.*`.
  const defaults: Record<string, unknown> = {
    'quiz.enabled': true,
    'quiz.cycleSeconds': 900,
    'quiz.secondsPerQuestion': 10,
    'quiz.questionsPerQuiz': 5,
    'quiz.entryPoints': 50,
    'quiz.rewardPoints': 10,
    'quiz.winPercent': 50,
    'quiz.answerGraceMs': 1500,
  };

  let settingsCreated = 0;
  for (const [key, value] of Object.entries(defaults)) {
    const existing = await client.setting.findUnique({ where: { key } });
    if (existing) continue;
    await client.setting.create({ data: { key, value: value as never } });
    settingsCreated += 1;
  }

  const counts = await client.quizQuestion.groupBy({
    by: ['category'],
    _count: { _all: true },
    where: { active: true },
  });

  return { created, updated, settingsCreated, counts };
}

// Allow running this file directly: `npx ts-node prisma/seed-quiz.ts`
if (require.main === module) {
  seedQuiz()
    .then((r) => {
      // eslint-disable-next-line no-console
      console.log(
        `✅ Quiz seed complete — ${r.created} created, ${r.updated} refreshed, ` +
          `${r.settingsCreated} setting(s) initialised`,
      );
      for (const c of r.counts) {
        // eslint-disable-next-line no-console
        console.log(`   ${c.category.padEnd(20)} ${c._count._all} active`);
      }
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
