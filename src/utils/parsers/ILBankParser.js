import { BaseParser } from './BaseParser.js';
import { ilsToUsd } from '../exchangeRates.js';

// ── Hebrew column aliases for Israeli bank exports ─────────────────────────
//
// Covers common formats from Bank Hapoalim, Bank Leumi, Discount, Mizrahi:
//
//   תאריך / תאריך ערך          = Date (dd/mm/yy or dd/mm/yyyy)
//   תיאור פעולה / פירוט / תיאור = Transaction description / vendor
//   חובה / חיוב                 = Debit  – money OUT (spending, positive)
//   זכות / הפקדה               = Credit – money IN  (income, negative)
//   יתרה / יתרה לאחר פעולה      = Balance (ignored)
//   אסמכתא                      = Reference number (ignored)
//
// If the bank uses a single "סכום" column instead of separate debit/credit,
// that is handled via the single-amount strategy.

const DATE_ALIASES   = ['תאריך', 'תאריך ערך', 'תאריך פעולה', 'תאריך עסקה'];
const VENDOR_ALIASES = ['תיאור פעולה', 'פירוט', 'תיאור', 'תאור פעולה', 'שם', 'בנק'];
const DEBIT_ALIASES  = ['חובה', 'חיוב', 'משיכה'];
const CREDIT_ALIASES = ['זכות', 'הפקדה', 'הכנסה'];
const AMOUNT_ALIASES = ['סכום', 'סכום הפעולה'];

/**
 * Parser for Israeli bank-account CSV exports (Hebrew column names).
 *
 * Supports both:
 *   - Separate חובה (debit) / זכות (credit) columns
 *   - A single סכום (amount) column
 *
 * Date conversion: dd/mm/yy → MM/DD/YYYY.
 * Currency: ILS (₪).
 */
export class ILBankParser extends BaseParser {

  detectColumns(headers) {
    return {
      date:   this.findCol(headers, DATE_ALIASES),
      vendor: this.findCol(headers, VENDOR_ALIASES),
      debit:  this.findCol(headers, DEBIT_ALIASES),
      credit: this.findCol(headers, CREDIT_ALIASES),
      amount: this.findCol(headers, AMOUNT_ALIASES),
    };
  }

  normalizeRow(row, cols, source, currency) {
    // Date: Israeli dd/mm/yy → MM/DD/YYYY
    const rawDate = cols.date ? String(row[cols.date] ?? '').trim() : '';
    const date    = this.convertDdMmToMmDd(rawDate);

    const vendor = this.cleanText(cols.vendor ? row[cols.vendor] : 'Unknown') || 'Unknown';

    // Amount resolution (same strategies as USParser but for ILS)
    let amount = 0;

    if (cols.debit && cols.credit && !cols.amount) {
      // Separate debit / credit columns
      const debit  = this.parseAmount(row[cols.debit]);
      const credit = this.parseAmount(row[cols.credit]);
      amount = (debit || 0) - (credit || 0); // debit = spent (+), credit = received (-)

    } else if (cols.amount) {
      // Single amount — trust the sign as-is
      amount = this.parseAmount(row[cols.amount]);

    } else if (cols.debit) {
      amount = this.parseAmount(row[cols.debit]);
    } else if (cols.credit) {
      amount = -this.parseAmount(row[cols.credit]);
    }

    // Convert ILS → USD using the historical rate for this transaction's date.
    const amountIls = amount;
    const amountUsd = ilsToUsd(amount, date);

    return {
      date,
      vendor,
      amount: amountUsd,
      amountLocal: amountIls,
      category: 'IL Bank',
      source,
      currency: 'USD',
    };
  }
}
