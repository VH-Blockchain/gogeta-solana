-- Arc/EVM -> Solana: rename the chain-facing columns on the two money tables.
--
-- Written as RENAME rather than the DROP + ADD `prisma migrate diff` generates,
-- because a rename preserves the rows. The columns hold the only record of what
-- a purchase or payout actually was on-chain, so dropping them would silently
-- discard settled transaction references on any database that has rows.
--
-- `chainId` is the one genuine drop: Solana has no EVM chain id, and `network`
-- ('devnet'/'mainnet-beta') replaces it as the network discriminator.

-- ── PointPurchase ────────────────────────────────────────────────────────────

ALTER TABLE "PointPurchase" RENAME COLUMN "tokenAddress" TO "tokenMint";
ALTER TABLE "PointPurchase" RENAME COLUMN "transactionHash" TO "transactionSignature";
ALTER INDEX "PointPurchase_transactionHash_key" RENAME TO "PointPurchase_transactionSignature_key";

-- PointPurchase never carried a network *name*, only a chainId, so `network` is
-- genuinely new. Added with a temporary default so the NOT NULL holds for any
-- pre-existing row, then dropped so new inserts must state the network
-- explicitly (the application always does — see PointsPurchaseService).
ALTER TABLE "PointPurchase" ADD COLUMN "network" TEXT NOT NULL DEFAULT 'devnet';
ALTER TABLE "PointPurchase" ALTER COLUMN "network" DROP DEFAULT;

ALTER TABLE "PointPurchase" DROP COLUMN "chainId";

-- ── WithdrawalRequest ────────────────────────────────────────────────────────

-- `networkName` already held a human network label ('Arc Testnet' on old rows),
-- which is exactly what `network` is now, so this is a rename and old rows stay
-- truthful about the chain they were created against.
ALTER TABLE "WithdrawalRequest" RENAME COLUMN "networkName" TO "network";
ALTER TABLE "WithdrawalRequest" RENAME COLUMN "tokenAddress" TO "tokenMint";
ALTER TABLE "WithdrawalRequest" RENAME COLUMN "transactionHash" TO "transactionSignature";
ALTER INDEX "WithdrawalRequest_transactionHash_key" RENAME TO "WithdrawalRequest_transactionSignature_key";

ALTER TABLE "WithdrawalRequest" DROP COLUMN "chainId";
