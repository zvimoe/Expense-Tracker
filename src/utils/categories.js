/**
 * Which categories count as real spending.
 *
 * Two kinds of rows are money movement rather than consumption:
 *
 *   Income          — money coming in, reported separately.
 *   Payment/Credit  — paying a credit-card bill. The bank (or Israeli bank)
 *                     records the payment leaving the account while the card
 *                     statement already itemises what was actually bought, so
 *                     counting both double-counts the same spending.
 *
 * The double-count is not symmetric across the two card setups, which is why
 * the whole category is excluded rather than just the bank side:
 *
 *   US        bank +$51,925.66  and  credit −$51,925.66  cancel over a year,
 *             but land in different months, so months are still distorted.
 *   Israeli   il-bank +$47,625.08 has no offsetting row on il-credit at all,
 *             so it inflates the totals outright.
 *
 * Dropping only the bank side would leave the US credit row behind and
 * understate spending by the full payment amount, so both sides go.
 */

/** Categories excluded from expense totals. Compared lowercase and trimmed. */
export const TRANSFER_CATEGORIES = ['payment/credit'];

const normalize = (transaction) => (transaction?.category || '').trim().toLowerCase();

/** Money in. Reported in its own panel, never as an expense. */
export function isIncome(transaction) {
  return normalize(transaction) === 'income';
}

/** A credit-card bill payment — the card statement already has the detail. */
export function isTransfer(transaction) {
  return TRANSFER_CATEGORIES.includes(normalize(transaction));
}

/** True for rows that represent actual spending. */
export function isExpense(transaction) {
  return !isIncome(transaction) && !isTransfer(transaction);
}

/**
 * Net value of the transfer rows in a list, for disclosing what was left out.
 * Returns { total, count } with total as a positive number when money left
 * the account.
 */
export function transferSummary(transactions) {
  let total = 0;
  let count = 0;
  for (const transaction of transactions || []) {
    if (!isTransfer(transaction)) continue;
    total += transaction.amount || 0;
    count++;
  }
  return { total, count };
}
