-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "Prediction" ADD COLUMN     "bannerImageUrl" TEXT,
ADD COLUMN     "info" TEXT NOT NULL DEFAULT '';
