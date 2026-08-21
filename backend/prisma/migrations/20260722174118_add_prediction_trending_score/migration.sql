-- AlterTable
ALTER TABLE "Prediction" ADD COLUMN     "polymarketVolume24hr" DOUBLE PRECISION,
ADD COLUMN     "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Prediction_status_trendingScore_idx" ON "Prediction"("status", "trendingScore");
