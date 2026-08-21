-- CreateEnum
CREATE TYPE "QuizCategory" AS ENUM ('POLITICS', 'SPORTS', 'ENTERTAINMENT', 'GENERAL_KNOWLEDGE');

-- CreateEnum
CREATE TYPE "QuizStatus" AS ENUM ('SCHEDULED', 'RUNNING', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuizResult" AS ENUM ('WON', 'LOST');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CoinTxnType" ADD VALUE 'QUIZ_ENTRY';
ALTER TYPE "CoinTxnType" ADD VALUE 'QUIZ_REWARD';

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "category" "QuizCategory" NOT NULL,
    "question" TEXT NOT NULL,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "category" "QuizCategory" NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "status" "QuizStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "cycleSeconds" INTEGER NOT NULL,
    "secondsPerQuestion" INTEGER NOT NULL,
    "questionsPerQuiz" INTEGER NOT NULL,
    "entryPoints" INTEGER NOT NULL,
    "rewardPoints" INTEGER NOT NULL,
    "winPercent" INTEGER NOT NULL,
    "questionIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizParticipation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "entryPoints" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "unansweredCount" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rewardPoints" INTEGER NOT NULL DEFAULT 0,
    "result" "QuizResult",
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "QuizParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL,
    "participationId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedIndex" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "responseMs" INTEGER NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuizQuestion_category_active_idx" ON "QuizQuestion"("category", "active");

-- CreateIndex
CREATE INDEX "Quiz_status_endsAt_idx" ON "Quiz"("status", "endsAt");

-- CreateIndex
CREATE INDEX "Quiz_startsAt_idx" ON "Quiz"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_category_slotIndex_key" ON "Quiz"("category", "slotIndex");

-- CreateIndex
CREATE INDEX "QuizParticipation_userId_joinedAt_idx" ON "QuizParticipation"("userId", "joinedAt");

-- CreateIndex
CREATE INDEX "QuizParticipation_quizId_idx" ON "QuizParticipation"("quizId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizParticipation_userId_quizId_key" ON "QuizParticipation"("userId", "quizId");

-- CreateIndex
CREATE INDEX "QuizAnswer_participationId_idx" ON "QuizAnswer"("participationId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAnswer_participationId_questionId_key" ON "QuizAnswer"("participationId", "questionId");

-- AddForeignKey
ALTER TABLE "QuizParticipation" ADD CONSTRAINT "QuizParticipation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizParticipation" ADD CONSTRAINT "QuizParticipation_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "QuizParticipation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
