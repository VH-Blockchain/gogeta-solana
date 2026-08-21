/** The Apple/Google store-review test account. Its experience is
 *  deliberately zeroed out server-side (no bonuses, no cost/reward
 *  numbers, no ads, no lucky draw) so reviewers see a plain, review-safe
 *  app with nothing that reads as paid/gambling-adjacent — every other
 *  account is completely unaffected. Revertible by simply removing the
 *  checks that call this, no data migration either way. */
const REVIEW_ACCOUNT_EMAIL = 'reviewer@yesiki.com';

export function isReviewAccount(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === REVIEW_ACCOUNT_EMAIL;
}
