-- Reduce automatically-granted reward amounts to 10% of their previous values,
-- and seed the new USDC points-purchase settings.
--
-- Costs/fees are deliberately NOT touched: economy.entryFee and
-- quiz.entryPoints are what a user pays, not what the platform grants, and
-- economy.dailyLuckyWinners is a count of winners rather than an amount of
-- points.
--
-- Each UPDATE is guarded on the old value, which makes this migration
-- idempotent (re-running cannot compound 10% into 1%) and leaves any value an
-- admin has already customised alone.

-- Signup bonus: 1000 -> 100
UPDATE "Setting" SET value = '100'::jsonb
 WHERE key = 'economy.signupBonus' AND value = '1000'::jsonb;

-- Correct-prediction reward: 100 -> 10
UPDATE "Setting" SET value = '10'::jsonb
 WHERE key = 'economy.correctReward' AND value = '100'::jsonb;

-- Lucky-draw bonus: 500 -> 50
UPDATE "Setting" SET value = '50'::jsonb
 WHERE key = 'economy.luckyBonus' AND value = '500'::jsonb;

-- Quiz win reward: 100 -> 10
UPDATE "Setting" SET value = '10'::jsonb
 WHERE key = 'quiz.rewardPoints' AND value = '100'::jsonb;

-- Daily login bonus, if an admin has set one: reduce to 10%, floored at 1 so a
-- previously-enabled bonus does not silently become a no-op.
UPDATE "Setting"
   SET value = to_jsonb(GREATEST(1, FLOOR((value #>> '{}')::numeric / 10))::int)
 WHERE key = 'dailyBonus.amount'
   AND (value #>> '{}') ~ '^[0-9]+$'
   AND (value #>> '{}')::numeric > 0;

-- New settings for buying points with USDC. Inserted only when absent so an
-- admin-tuned rate survives a re-run.
INSERT INTO "Setting" (key, value, "updatedAt") VALUES
  ('economy.usdcToPoints',          '100'::jsonb,  NOW()),
  ('economy.pointsPurchaseEnabled', 'true'::jsonb, NOW()),
  ('economy.pointsMinPurchaseUsdc', '1'::jsonb,    NOW()),
  ('economy.pointsMaxPurchaseUsdc', '1000'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;
