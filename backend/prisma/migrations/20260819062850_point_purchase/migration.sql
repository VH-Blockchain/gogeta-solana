-- CreateEnum
CREATE TYPE "PointPurchaseStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "CoinTxnType" ADD VALUE 'POINT_PURCHASE';

-- CreateTable
CREATE TABLE "PointPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "amountUsdcRaw" TEXT NOT NULL,
    "amountUsdc" DECIMAL(38,6) NOT NULL,
    "points" INTEGER NOT NULL,
    "exchangeRate" INTEGER NOT NULL,
    "chainId" INTEGER NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "receiverAddress" TEXT NOT NULL,
    "transactionHash" TEXT,
    "status" "PointPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "blockNumber" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PointPurchase_transactionHash_key" ON "PointPurchase"("transactionHash");

-- CreateIndex
CREATE INDEX "PointPurchase_userId_createdAt_idx" ON "PointPurchase"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PointPurchase_status_idx" ON "PointPurchase"("status");

-- CreateIndex
CREATE INDEX "PointPurchase_walletAddress_idx" ON "PointPurchase"("walletAddress");

-- AddForeignKey
ALTER TABLE "PointPurchase" ADD CONSTRAINT "PointPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
