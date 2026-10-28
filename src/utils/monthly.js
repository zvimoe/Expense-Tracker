/**
 * Month-level expense aggregation for the Monthly board.
 *
 * Conventions are deliberately identical to the Overview tab (CategorySummary):
 *   - Income and credit-card payments are excluded (see utils/categories.js)
 *   - a bucket's net total is  paid − received  (refunds offset spending)
 *   - amounts are already USD; the IL parsers convert at the transaction date
 */

import { monthIndexOf, yearOf } from './dates.js';
import { isExpense, isTransfer } from './categories.js';

export { isIncome, isTransfer, isExpense } from './categories.js';

function newBucket(extra) {
  return { paid: 0, received: 0, count: 0, ...extra };
}

function addToBucket(bucket, transaction) {
  if (transaction.amount >= 0) bucket.paid     += transaction.amount;
  else                         bucket.received += Math.abs(transaction.amount);
  bucket.count++;
}

/**
 * Bucket a year's expenses into 12 months.
 *
 * Only transactions whose own date falls in `year` are counted, so a stray row
 * carried over from a neighbouring year cannot inflate a month. The count of
 * rows skipped for that reason is returned so the UI can disclose it.
 *
 * @returns {{months: Array, outsideYear: number, undated: number, total: number,
 *            transferTotal: number, transferCount: number}}
 */
export function monthlyExpenseTotals(transactions, year) {
  const target = Number(year);
  const months = Array.from({ length: 12 }, (_, monthIndex) =>
    newBucket({ monthIndex, total: 0 })
  );

  let outsideYear   = 0;
  let undated       = 0;
  let transferTotal = 0;
  let transferCount = 0;

  for (const transaction of transactions || []) {
    const y  = yearOf(transaction.date);
    const mi = monthIndexOf(transaction.date);

    // Card payments are tracked separately so the board can disclose how much
    // was left out rather than silently dropping it.
    if (isTransfer(transaction)) {
      if (y != null && (Number.isNaN(target) || y === target)) {
        transferTotal += transaction.amount || 0;
        transferCount++;
      }
      continue;
    }
    if (!isExpense(transaction)) continue;

    if (y == null || mi == null || mi < 0 || mi > 11) { undated++; continue; }
    if (!Number.isNaN(target) && y !== target)        { outsideYear++; continue; }

    addToBucket(months[mi], transaction);
  }

  let total = 0;
  for (const bucket of months) {
    bucket.total = bucket.paid - bucket.received;
    total += bucket.total;
  }

  return { months, outsideYear, undated, total, transferTotal, transferCount };
}

/**
 * Expense categories within a single month, sorted by net spend descending.
 *
 * Unlike CategorySummary — which hides pure-refund categories to keep the
 * year donut tidy — every category is kept here. The month rows must reconcile
 * exactly with the month total and with the transactions the drill-down opens;
 * a hidden category would be spend the user can see but not click through to.
 */
export function expenseCategoriesForMonth(transactions, year, monthIndex) {
  const target = Number(year);
  const byCategory = new Map();

  for (const transaction of transactions || []) {
    if (!isExpense(transaction)) continue;
    if (yearOf(transaction.date) !== target)           continue;
    if (monthIndexOf(transaction.date) !== monthIndex) continue;

    const category = transaction.category || 'Uncategorized';
    if (!byCategory.has(category)) byCategory.set(category, newBucket({ category }));
    addToBucket(byCategory.get(category), transaction);
  }

  return Array.from(byCategory.values())
    .map((entry) => ({ ...entry, total: entry.paid - entry.received }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Merge this year's and last year's category rows for one month into a single
 * comparable list, keyed by category name. Categories present in only one of
 * the two years still appear, with 0 on the missing side.
 */
export function mergeCategoryComparison(currentRows, priorRows) {
  const priorByCategory = new Map((priorRows || []).map((r) => [r.category, r]));
  const merged = (currentRows || []).map((row) => ({
    ...row,
    priorTotal: priorByCategory.get(row.category)?.total ?? 0,
  }));

  // Categories that existed last year but have no spend at all this month
  const currentNames = new Set(merged.map((r) => r.category));
  for (const priorRow of priorRows || []) {
    if (currentNames.has(priorRow.category)) continue;
    merged.push({
      category:   priorRow.category,
      paid:       0,
      received:   0,
      count:      0,
      total:      0,
      priorTotal: priorRow.total,
    });
  }

  return merged.sort((a, b) => b.total - a.total || b.priorTotal - a.priorTotal);
}

/** Percent change from prior to current; null when there is no prior baseline. */
export function percentChange(current, prior) {
  if (!prior) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}
