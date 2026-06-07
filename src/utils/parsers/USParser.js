import { BaseParser } from './BaseParser.js';

// ── Column alias tables (English) ──────────────────────────────────────────

const DATE_ALIASES     = ['date', 'transaction date', 'posted date', 'trans. date', 'trans date', 'value date'];
const VENDOR_ALIASES   = ['description', 'transaction description', 'merchant', 'payee', 'vendor', 'name', 'memo', 'narrative'];
const CATEGORY_ALIASES = ['category', 'mcc category', 'merchant category', 'spending category'];
const AMOUNT_ALIASES   = ['amount', 'transaction amount', 'net amount', 'sum'];
const DEBIT_ALIASES    = ['debit', 'debit amount', 'withdrawal', 'withdrawal amount'];
const CREDIT_ALIASES   = ['credit', 'credit amount', 'deposit', 'deposit amount'];

// Used to flip sign on bank exports that mark rows as "Credit" (IN) / "Debit" (OUT)
const TX_TYPE_ALIASES  = ['transaction type', 'type', 'transaction kind', 'dr/cr'];

/**
 * Parser for US bank and US credit-card CSVs.
 * Handles both a single amount column (with optional Transaction Type sign)
 * and separate Debit / Credit columns.
 */
export class USParser extends BaseParser {

  detectColumns(headers) {
    return {
      date:     this.findCol(headers, DATE_ALIASES),
      vendor:   this.findCol(headers, VENDOR_ALIASES),
      category: this.findCol(headers, CATEGORY_ALIASES),
      amount:   this.findCol(headers, AMOUNT_ALIASES),
      debit:    this.findCol(headers, DEBIT_ALIASES),
      credit:   this.findCol(headers, CREDIT_ALIASES),
      txType:   this.findCol(headers, TX_TYPE_ALIASES),
    };
  }

  normalizeRow(row, cols, source, currency) {
    const date    = cols.date   ? String(row[cols.date]   ?? '').trim() : '';
    const vendor  = this.cleanText(cols.vendor ? row[cols.vendor] : 'Unknown') || 'Unknown';
    const category = cols.category && row[cols.category]
      ? String(row[cols.category]).trim() || 'Uncategorized'
      : 'Uncategorized';

    // ── Amount resolution ─────────────────────────────────────────────────
    // Strategy 1: separate Debit / Credit columns (credit-card style)
    //   Debit  = money OUT → positive
    //   Credit = money IN  → negative
    // Strategy 2: single amount + Transaction Type (bank style)
    //   "Credit" type = money IN  → negate if positive
    //   "Debit"  type = money OUT → keep positive
    // Strategy 3: single amount, trust the sign as-is

    let amount = 0;

    if (cols.debit && cols.credit && !cols.amount) {
      // Strategy 1
      amount = (this.parseAmount(row[cols.debit]) || 0)
             - (this.parseAmount(row[cols.credit]) || 0);

    } else if (cols.amount) {
      // Strategy 2 / 3
      amount = this.parseAmount(row[cols.amount]);
      if (cols.txType) {
        const txType = String(row[cols.txType] ?? '').trim().toLowerCase();
        if (txType === 'credit' && amount > 0) amount = -amount;
        else if (txType === 'debit' && amount < 0) amount = Math.abs(amount);
      }

    } else if (cols.debit) {
      amount = this.parseAmount(row[cols.debit]);
    } else if (cols.credit) {
      amount = -this.parseAmount(row[cols.credit]);
    }

    return { date, vendor, amount, category, source, currency };
  }
}
