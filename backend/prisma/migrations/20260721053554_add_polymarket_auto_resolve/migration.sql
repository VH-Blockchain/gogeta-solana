-- AlterEnum
ALTER TYPE "PredictionStatus" ADD VALUE 'AUTO_RESOLVED';

-- CreateTable
CREATE TABLE "PolymarketResolutionLog" (
    "id" TEXT NOT NULL,
    "checked" INTEGER NOT NULL DEFAULT 0,
    "resolved" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolymarketResolutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolymarketResolutionLog_createdAt_idx" ON "PolymarketResolutionLog"("createdAt");
