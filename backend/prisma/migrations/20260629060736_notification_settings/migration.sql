-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyLeaderboard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyLucky" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyPush" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyResults" BOOLEAN NOT NULL DEFAULT true;
