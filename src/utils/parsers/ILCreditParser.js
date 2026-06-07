import { BaseParser } from './BaseParser.js';
import { ilsToUsd } from '../exchangeRates.js';

// ── Column aliases for Israeli credit-card exports ─────────────────────────
//
// English header format (user-renamed):
//   date             = Transaction date  (dd/mm/yyyy or d/m/yyyy)
//   vendor           = Vendor / merchant name
//   amount in ils    = Amount in NIS (may be prefixed with ₪)
//   transaction type = Transaction type:
//                        רגילה  = regular charge  (positive = spent)
//                        זיכוי  = credit / refund (should be negative)
//   method           = Card / payment method (ignored)
//   digital card     = Digital card ID (ignored)
//
// Original Hebrew aliases kept as fallback in case the file is not renamed.

const DATE_ALIASES   = ['date', 'transaction date', 'תאריך עסקה', 'תאריך רכישה', 'תאריך'];
const VENDOR_ALIASES = ['vendor', 'merchant', 'vendor name', 'שם בית עסק', 'בית עסק', 'תיאור', 'שם עסק'];
const AMOUNT_ALIASES = ['amount in ils', 'amount', 'סכום בש"ח', 'סכום בשקלים', 'סכום', 'סכום עסקה'];
const TYPE_ALIASES   = ['transaction type', 'type', 'סוג עסקה', 'סוג', 'אופן עסקה'];

const REFUND_TYPES = ['זיכוי', 'החזר', 'ביטול', 'credit', 'refund', 'cancel'];

/**
 * Parser for Israeli credit-card CSV exports (Hebrew column names).
 *
 * Date conversion: dd/mm/yy → MM/DD/YYYY (matches US date convention in the app).
 * Currency: ILS (₪).
 */
export class ILCreditParser extends BaseParser {

  detectColumns(headers) {
    return {
      date:    this.findCol(headers, DATE_ALIASES),
      vendor:  this.findCol(headers, VENDOR_ALIASES),
      amount:  this.findCol(headers, AMOUNT_ALIASES),
      txType:  this.findCol(headers, TYPE_ALIASES),
    };
  }

  normalizeRow(row, cols, source, currency) {
    // Date: convert from Israeli dd/mm/yy to MM/DD/YYYY
    const rawDate = cols.date ? String(row[cols.date] ?? '').trim() : '';
    const date    = this.convertDdMmToMmDd(rawDate);

    // Vendor: clean up formula-injection characters
    const vendor = this.cleanText(cols.vendor ? row[cols.vendor] : 'Unknown') || 'Unknown';

    // Amount: strip ₪ symbol, parse float
    let amount = this.parseAmount(cols.amount ? row[cols.amount] : 0);

    // Flip sign for refund / credit transaction types
    if (cols.txType && amount > 0) {
      const txType = String(row[cols.txType] ?? '').trim();
      if (REFUND_TYPES.some((r) => txType.includes(r))) {
        amount = -amount;
      }
    }

    // Convert ILS → USD using the historical rate for this transaction's date.
    // Keep the original ILS amount for reference.
    const amountIls = amount;
    const amountUsd = ilsToUsd(amount, date);

    return {
      date,
      vendor,
      amount: amountUsd,       // USD – used for all aggregations and charts
      amountLocal: amountIls,  // original ILS amount
      category: 'IL Credit',
      source,
      currency: 'USD',         // converted; original was ILS
    };
  }
}
