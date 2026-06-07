/**
 * USD/ILS historical exchange rate lookup.
 *
 * Rates are sourced from the bundled CSV (src/data/usd-ils.csv).
 * The CSV uses MM/DD/YYYY dates and "Price" = ILS per 1 USD.
 *
 * To convert ILS → USD:  usd = ils / rate
 */

import ratesCsv from '../data/usd-ils.csv?raw';

// ── Parse the CSV once at module load ─────────────────────────────────────

// Map: timestamp (ms) → rate  (built for fast nearest-date search)
const rateByTs = new Map();

for (const line of ratesCsv.split('\n')) {
  const parts = line.split(',');
  if (parts.length < 2) continue;
  const dateStr = parts[0].trim();
  const price   = parseFloat(parts[1]);
  if (!dateStr || dateStr === 'Date' || isNaN(price) || price <= 0) continue;
  const ts = Date.parse(dateStr); // MM/DD/YYYY — valid for Date.parse in browsers/Node
  if (!isNaN(ts)) rateByTs.set(ts, price);
}

// Sorted array of timestamps for binary-search nearest-date fallback
const sortedTs = [...rateByTs.keys()].sort((a, b) => a - b);

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Look up the ILS-per-USD rate for `dateStr` (MM/DD/YYYY).
 * If the exact date has no entry (weekend / holiday), returns the rate for the
 * nearest available trading day.
 * Returns null if the date cannot be parsed or the rate table is empty.
 */
export function getRate(dateStr) {
  if (!dateStr || sortedTs.length === 0) return null;

  const target = Date.parse(dateStr);
  if (isNaN(target)) return null;

  // Exact hit
  if (rateByTs.has(target)) return rateByTs.get(target);

  // Binary search for nearest timestamp
  let lo = 0, hi = sortedTs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedTs[mid] < target) lo = mid + 1;
    else hi = mid;
  }

  // Compare the neighbour on each side and pick the closer one
  const candidates = [sortedTs[lo]];
  if (lo > 0) candidates.push(sortedTs[lo - 1]);
  candidates.sort((a, b) => Math.abs(a - target) - Math.abs(b - target));

  return rateByTs.get(candidates[0]) ?? null;
}

/**
 * Convert an ILS amount to USD using the historical rate for `dateStr`.
 * Falls back to the nearest available rate.
 * If no rate is found at all, returns `amountIls` unchanged with a console warning.
 *
 * @param {number} amountIls  Amount in New Israeli Shekels
 * @param {string} dateStr    Transaction date in MM/DD/YYYY format
 * @returns {number}          Equivalent amount in USD (rounded to 2 decimal places)
 */
export function ilsToUsd(amountIls, dateStr) {
  const rate = getRate(dateStr);
  if (!rate) {
    console.warn(`[exchangeRates] No USD/ILS rate found for "${dateStr}" — keeping ILS amount`);
    return amountIls;
  }
  return Math.round((amountIls / rate) * 100) / 100;
}
