-- AlterTable
ALTER TABLE "Prediction" ADD COLUMN     "referenceCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_referenceCode_key" ON "Prediction"("referenceCode");
