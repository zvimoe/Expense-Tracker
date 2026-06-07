import Papa from 'papaparse';

/**
 * Abstract base class for all CSV parsers.
 *
 * Subclasses must implement:
 *   detectColumns(headers) → { [key]: columnName | null }
 *   normalizeRow(row, cols, source, currency) → transaction object | null
 *
 * Shared utilities: findCol, parseAmount, cleanText, convertDdMmToMmDd
 */
export class BaseParser {

  // ── Utilities available to all subclasses ──────────────────────────────

  /**
   * Collapse all whitespace variants (spaces, newlines, tabs) to a single space,
   * lowercase, and trim. Used to normalise both header strings and alias strings
   * so that multi-line Excel headers ("תאריך\nעסקה") still match an alias
   * written with a plain space ("תאריך עסקה").
   */
  _norm(s) {
    return String(s).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().toLowerCase();
  }

  /**
   * Case-insensitive column finder with whitespace-normalised comparison.
   * Tries exact normalised match first, then substring match.
   */
  findCol(headers, aliases) {
    const normHeaders = headers.map((h) => this._norm(h));
    for (const alias of aliases) {
      const n = this._norm(alias);
      const idx = normHeaders.indexOf(n);
      if (idx !== -1) return headers[idx];
    }
    for (const alias of aliases) {
      const n = this._norm(alias);
      const idx = normHeaders.findIndex((h) => h.includes(n));
      if (idx !== -1) return headers[idx];
    }
    return null;
  }

  /**
   * Strip currency symbols / commas / spaces and parse as float.
   * Handles $, ₪, £, €, and comma-thousands separators.
   */
  parseAmount(raw) {
    if (raw === null || raw === undefined || raw === '') return 0;
    // Strip currency symbols, thousands separators, and ALL whitespace variants
    // (including non-breaking space \u00A0 which Excel sometimes uses before ₪).
    const cleaned = String(raw)
      .replace(/\u00A0/g, '')      // non-breaking space
      .replace(/[$,₪£€\s]/g, '')  // currency symbols + regular whitespace
      .trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }

  /**
   * Strip leading Excel formula-injection characters (=, +, -, @)
   * and trim whitespace.
   */
  cleanText(raw) {
    return String(raw ?? '').trim().replace(/^[=+\-@]+/, '').trim();
  }

  /**
   * Convert a date string in dd/mm/yy or dd/mm/yyyy format to MM/DD/YYYY.
   * This normalises Israeli date formats to match the US convention used
   * everywhere else in the app.
   *
   * Examples:
   *   "1/1/25"   → "01/01/2025"
   *   "31/12/24" → "12/31/2024"
   */
  convertDdMmToMmDd(dateStr) {
    if (!dateStr) return '';
    const s = String(dateStr).trim();
    const parts = s.split('/');
    if (parts.length !== 3) return s; // unexpected format — return as-is

    const [d, m, y] = parts;
    const fullYear =
      y.length === 2
        ? (parseInt(y, 10) < 50 ? '20' : '19') + y
        : y;

    return `${m.padStart(2, '0')}/${d.padStart(2, '0')}/${fullYear}`;
  }

  // ── Template method ────────────────────────────────────────────────────

  /**
   * Parse a raw CSV string into a normalised transaction array.
   *
   * @param {string} content   Raw CSV text (already read from disk)
   * @param {string} source    'bank' | 'credit' | 'il-bank' | 'il-credit'
   * @param {string} currency  'USD' | 'ILS'
   * @returns {Promise<Array>}
   */
  parse(content, source, currency) {
    return new Promise((resolve, reject) => {
      // Strip UTF-8 BOM (\uFEFF) that Excel commonly prepends to CSV exports.
      // Also normalise any embedded newlines / tabs inside header cells so
      // multi-line Excel column headings ("תאריך\nעסקה") become a plain
      // single-space string ("תאריך עסקה") that our alias lists can match.
      const cleanContent = content.replace(/^\uFEFF/, '');

      const result = Papa.parse(cleanContent, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (h) =>
          h.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim(),
      });

      // Surface fatal errors with row number
      if (result.errors?.length) {
        const fatal = result.errors.find(
          (e) => e.type !== 'FieldMismatch' && e.type !== 'Quotes'
        );
        if (fatal) {
          const row = fatal.row != null ? fatal.row + 2 : '?';
          return reject(new Error(`Parse error at row ${row}: ${fatal.message}`));
        }
      }

      if (!result.data?.length) {
        return reject(new Error('The CSV file appears to be empty or has no data rows.'));
      }

      const headers = result.meta.fields || [];

      // Detect columns once for the whole file, then map every row
      const cols = this.detectColumns(headers);

      const transactions = result.data
        .map((row) => this.normalizeRow(row, cols, source, currency))
        .filter((t) => t && (t.vendor || t.amount));

      resolve(transactions);
    });
  }

  // ── Abstract interface ─────────────────────────────────────────────────

  /** Subclasses return a map of logical column names → actual header strings. */
  detectColumns(headers) {
    throw new Error('detectColumns() must be implemented by subclass');
  }

  /**
   * Subclasses convert one raw CSV row into the unified transaction shape:
   * { date, vendor, amount, category, source, currency }
   */
  normalizeRow(row, cols, source, currency) {
    throw new Error('normalizeRow() must be implemented by subclass');
  }
}
