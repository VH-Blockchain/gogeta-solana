-- Lucky Draw moves from "one draw per resolved prediction" to "one pooled
-- draw per calendar day" (SOW §5.3: "Daily Reward Pool... randomly selects
-- 10 winners"). The old per-prediction rows are historical/legacy data —
-- they're kept for audit (the money itself already moved via CoinTransaction,
-- unaffected by this migration), just detached from the Prediction relation
-- since a draw is no longer scoped to a single prediction.

-- 1. Drop the old FK + unique constraint tying LuckyDraw 1:1 to a Prediction.
ALTER TABLE "LuckyDraw" DROP CONSTRAINT "LuckyDraw_predictionId_fkey";
DROP INDEX "LuckyDraw_predictionId_key";
ALTER TABLE "LuckyDraw" DROP COLUMN "predictionId";

-- 2. New idempotency key: one draw per day. Nullable so existing (legacy,
-- per-prediction) rows can keep it NULL — Postgres allows any number of
-- NULLs under a plain UNIQUE constraint, so this doesn't collide with the
-- new invariant that every day going forward gets exactly one draw.
ALTER TABLE "LuckyDraw" ADD COLUMN "dayKey" TEXT;
CREATE UNIQUE INDEX "LuckyDraw_dayKey_key" ON "LuckyDraw"("dayKey");
