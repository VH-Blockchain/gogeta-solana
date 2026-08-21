-- CreateTable
CREATE TABLE "PolymarketImportLog" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolymarketImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolymarketImportLog_createdAt_idx" ON "PolymarketImportLog"("createdAt");
