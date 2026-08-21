-- CreateTable
CREATE TABLE "PolymarketResolutionCheck" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "marketKey" TEXT,
    "trigger" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "detectedOptionId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolymarketResolutionCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolymarketResolutionCheck_predictionId_createdAt_idx" ON "PolymarketResolutionCheck"("predictionId", "createdAt");
