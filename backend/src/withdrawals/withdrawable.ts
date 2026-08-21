import { CoinTxnType } from '@prisma/client';

/**
 * Which point sources can be cashed out.
 *
 * The rule is "money the user put in, plus what they won by playing" — never
 * points the platform handed out to get them started or to promote something.
 *
 *   WITHDRAWABLE      POINT_PURCHASE  (they paid USDC for these)
 *                     CORRECT_REWARD  (won on a prediction)
 *                     QUIZ_REWARD     (won in a quiz)
 *
 *   NOT WITHDRAWABLE  SIGNUP_BONUS    (a joining grant)
 *                     BONUS           (daily login promo)
 *                     ADMIN_ADJUST    (a manual grant, see below)
 *                     LUCKY_BONUS     (a draw, not earned — configurable)
 *
 * ADMIN_ADJUST is excluded when positive: it is how support hands out goodwill
 * points, and letting those be cashed out turns a support gesture into a payout.
 * Negative adjustments still bite, because they reduce the balance the pool is
 * capped against.
 */
export const WITHDRAWABLE_TYPES: readonly CoinTxnType[] = [
  CoinTxnType.POINT_PURCHASE,
  CoinTxnType.CORRECT_REWARD,
  CoinTxnType.QUIZ_REWARD,
];

/** Added to the withdrawable set when `economy.withdrawableLuckyBonus` is on. */
export const OPTIONAL_WITHDRAWABLE_TYPES: readonly CoinTxnType[] = [
  CoinTxnType.LUCKY_BONUS,
];

export interface LedgerTotals {
  /** Credits from withdrawable sources. */
  withdrawableCredits: number;
  /** Credits from grants/promos. */
  giftedCredits: number;
  /** Absolute value of every debit except completed withdrawals. */
  spend: number;
  /** Absolute value of points already cashed out. */
  withdrawn: number;
}

export interface WithdrawableBreakdown {
  totalPoints: number;
  withdrawablePoints: number;
  reservedPoints: number;
  availableToWithdraw: number;
}

/**
 * Withdrawable points, derived from the ledger rather than the balance.
 *
 * The naive version — sum the withdrawable credits — is wrong: a user who buys
 * 2,000 points and spends 1,500 on entry fees holds 500, but their purchase
 * credits still total 2,000. They would be able to withdraw money they no longer
 * have. So spending has to come out of the pool somewhere.
 *
 * Spending is charged against *gifted* points first. That is deliberately the
 * user-favourable reading — their own money survives play the longest — and it
 * is still safe because the result is finally clamped to the real balance. The
 * two together mean a user can never withdraw more than they hold, and never
 * more than they put in or won:
 *
 *   pool  = withdrawableCredits − withdrawn − max(0, spend − giftedCredits)
 *   final = clamp(pool, 0, balance)
 *
 * Worked through §33's example (signup 100, purchase 2,000, prediction 500,
 * quiz 300, lucky 500 non-withdrawable, nothing spent):
 *   withdrawableCredits = 2,800 · gifted = 600 · spend = 0 · withdrawn = 0
 *   pool = 2,800 − 0 − max(0, 0 − 600) = 2,800  ✓
 *
 * And with 1,000 spent on entry fees:
 *   pool = 2,800 − 0 − max(0, 1,000 − 600) = 2,400
 *   balance = 3,400 − 1,000 = 2,400 → final 2,400  ✓ (the fees ate the gifts,
 *   then 400 of their own)
 */
export function computeWithdrawable(
  totals: LedgerTotals,
  balance: number,
  reservedPoints: number,
): WithdrawableBreakdown {
  const spendBeyondGifts = Math.max(0, totals.spend - totals.giftedCredits);
  const pool = totals.withdrawableCredits - totals.withdrawn - spendBeyondGifts;

  // Clamped to the real balance: the ledger is the source of eligibility, but it
  // can never authorise more than the account actually holds.
  const withdrawablePoints = Math.max(0, Math.min(pool, balance));

  return {
    totalPoints: balance,
    withdrawablePoints,
    reservedPoints,
    availableToWithdraw: Math.max(0, withdrawablePoints - reservedPoints),
  };
}

/**
 * Token units for a point amount, in integer arithmetic.
 *
 * `rate` is points-per-whole-token, the same `economy.usdcToPoints` the purchase
 * flow uses — so 100 points at rate 100 is exactly 1.000000 token units. Floors,
 * so a payout is never rounded up into money the platform did not owe.
 */
export function pointsToTokenRaw(
  points: number,
  rate: number,
  decimals: number,
): bigint {
  if (rate <= 0) return 0n;
  const scale = 10n ** BigInt(decimals);
  return (BigInt(Math.trunc(points)) * scale) / BigInt(Math.trunc(rate));
}
