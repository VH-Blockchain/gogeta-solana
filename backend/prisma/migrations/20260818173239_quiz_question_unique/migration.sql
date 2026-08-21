-- Prevents the same question existing twice in a category. Also what makes
-- prisma/seed-quiz.ts safely re-runnable (it upserts on this pair).
CREATE UNIQUE INDEX "QuizQuestion_category_question_key" ON "QuizQuestion"("category", "question");
