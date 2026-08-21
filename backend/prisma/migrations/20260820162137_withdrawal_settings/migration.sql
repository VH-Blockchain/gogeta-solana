-- Settings for cashing points out. Inserted only when absent so an
-- admin-tuned value survives a re-run.
--
-- The points→token rate is deliberately NOT duplicated here: withdrawals reuse
-- economy.usdcToPoints so there is only ever one rate in the system.
INSERT INTO "Setting" (key, value, "updatedAt") VALUES
  ('economy.withdrawalsEnabled',      'true'::jsonb,  NOW()),
  ('economy.minWithdrawalPoints',     '1000'::jsonb,  NOW()),
  -- Lucky-draw wins are a promotional grant rather than money the user put in
  -- or winnings from playing, so they are non-withdrawable by default.
  ('economy.withdrawableLuckyBonus',  'false'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;
