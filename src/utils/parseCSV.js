/**
 * Unified CSV parsing facade.
 *
 * Transaction data model:
 * {
 *   date:     string    // MM/DD/YYYY (Israeli dates are converted from DD/MM/YY)
 *   vendor:   string    // merchant name, trimmed and stripped of = prefixes
 *   amount:   number    // positive = money spent, negative = money received
 *   category: string    // from CSV or 'Uncategorized'
 *   source:   'bank' | 'credit' | 'il-bank' | 'il-credit'
 *   currency: 'USD' | 'ILS'
 * }
 */

import { USParser }      from './parsers/USParser.js';
import { ILCreditParser } from './parsers/ILCreditParser.js';
import { ILBankParser }   from './parsers/ILBankParser.js';
import { sourceInfo }     from './sources.js';

// Which parser reads each source. Israeli card issuers (Visa Cal, Isracard)
// label their columns differently but share a shape — one date, one merchant,
// one amount — so they share a parser.
const PARSERS = {
  'bank':      new USParser(),
  'credit':    new USParser(),
  'il-bank':   new ILBankParser(),
  'il-credit': new ILCreditParser(),
  'isracard':  new ILCreditParser(),
};

/**
 * Parse a CSV string into a normalised transaction array.
 *
 * @param {string} content  Raw CSV text (already read from disk via Electron IPC)
 * @param {'bank'|'credit'|'il-bank'|'il-credit'} source
 * @returns {Promise<Array>}
 */
export function parseCSV(content, source) {
  const parser   = PARSERS[source];
  const currency = sourceInfo(source).currency;

  if (!parser) return Promise.reject(new Error(`Unknown source type: ${source}`));
  return parser.parse(content, source, currency);
}

/**
 * Identity of a transaction for duplicate detection: same source, same day,
 * same amount, same vendor. The original ILS amount is preferred over the
 * USD conversion so a rate change can never make two copies look different.
 */
function dupKey(t) {
  const amount = Number(t.amountLocal ?? t.amount ?? 0).toFixed(2);
  return [t.source, t.date, amount, String(t.originalVendor ?? t.vendor ?? '').trim().toLowerCase()].join('|');
}

/**
 * Merge the files of one or more sources into a single transaction list,
 * dropping rows that overlapping exports repeat.
 *
 * Duplicates are only ever dropped ACROSS files, never within one. If a file
 * genuinely lists the same coffee twice on the same day, both are kept; if two
 * exports each list that same pair, the pair is counted once. That is done by
 * keeping, for each identity, the largest number of copies any single file has
 * — rather than summing across files.
 *
 * @param {Array<{name: string, transactions: Array}>} files
 * @returns {{transactions: Array, duplicates: number}}
 */
export function mergeSourceFiles(files) {
  const best = new Map();

  files.forEach((file) => {
    const groups = new Map();
    for (const t of file.transactions) {
      const k = dupKey(t);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
    }
    for (const [k, rows] of groups) {
      const current = best.get(k);
      if (!current || rows.length > current.length) best.set(k, rows);
    }
  });

  const kept  = [...best.values()].flat();
  const total = files.reduce((n, f) => n + f.transactions.length, 0);

  return { transactions: mergeAndSort(kept), duplicates: total - kept.length };
}

/**
 * Merge any number of transaction arrays into one list sorted by date descending.
 * Rows with unparseable dates fall to the bottom.
 */
export function mergeAndSort(...arrays) {
  const all = arrays.flat();

  all.sort((a, b) => {
    const da = new Date(a.date);
    const db = new Date(b.date);
    const validA = !isNaN(da);
    const validB = !isNaN(db);
    if (!validA && !validB) return 0;
    if (!validA) return 1;
    if (!validB) return -1;
    return db - da;
  });

  return all;
}
