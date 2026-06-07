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

const PARSERS = {
  'bank':      new USParser(),
  'credit':    new USParser(),
  'il-bank':   new ILBankParser(),
  'il-credit': new ILCreditParser(),
};

const CURRENCIES = {
  'bank':      'USD',
  'credit':    'USD',
  'il-bank':   'ILS',
  'il-credit': 'ILS',
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
  const currency = CURRENCIES[source] ?? 'USD';

  if (!parser) return Promise.reject(new Error(`Unknown source type: ${source}`));
  return parser.parse(content, source, currency);
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
