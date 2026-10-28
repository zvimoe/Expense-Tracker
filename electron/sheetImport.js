// Turns a downloaded bank or credit-card file into CSV text the renderer's
// parsers can read. Handles three input kinds:
//
//   .xls   - the old binary Excel format (FIBI, Discount)
//   .xlsx  - modern Excel (Bank Hapoalim, Visa Cal)
//   .csv   - passed through, with encoding detection
//
// A spreadsheet keeps its OWN columns: the parsers already know the Hebrew and
// English header names each bank uses, so the importer only fixes what Excel
// mangles — it finds the real header row under the title banner, flattens
// headers wrapped across two lines ("תאריך\nעסקה" -> "תאריך עסקה"), turns Excel
// serial numbers back into dd/mm/yyyy dates, and drops the summary lines banks
// append at the end of a sheet.
const fs    = require('fs');
const XLSX  = require('xlsx');
const iconv = require('iconv-lite');

const SPREADSHEET_RE = /\.(xls|xlsx|xlsm)$/i;

// Words that mark the header row, in either language. Two hits = header row.
const HEADER_MARKERS = [
  'תאריך', 'תיאור', 'חובה', 'זכות', 'סכום', 'בית עסק', 'פירוט', 'סוג',
  'date', 'debit', 'credit', 'transaction', 'balance', 'description', 'amount', 'vendor',
];

// Headers whose cells hold dates and may arrive as Excel serial numbers.
const DATE_HEADERS = ['תאריך', 'מועד', 'date', 'מועד חיוב'];

// Cell text that marks a summary/footer line rather than a transaction.
const SUMMARY_MARKERS = [
  'סה"כ', 'סהכ', 'סך הכל', 'יתרת פתיחה', 'יתרת סגירה',
  'opening balance', 'closing balance', 'total', 'balance b/f', 'balance c/f',
];

const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Collapse newlines inside a header cell so "תאריך\r\nעסקה" matches "תאריך עסקה". */
const flattenHeader = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/**
 * Read a CSV file, falling back to Windows-1255 when the bytes aren't valid
 * UTF-8 — Excel on Windows saves Hebrew CSVs in that codepage.
 */
function readCSVSmart(filePath) {
  const buf  = fs.readFileSync(filePath);
  const utf8 = buf.toString('utf-8');
  if (!utf8.includes('�')) return utf8;
  return iconv.decode(buf, 'windows-1255');
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const cells = rows[i].map(norm).filter(Boolean);
    if (cells.length < 3) continue;
    const hits = HEADER_MARKERS.filter((m) => cells.some((c) => c.includes(m)));
    if (hits.length >= 2) return i;
  }
  return -1;
}

const isDateHeader = (h) => {
  const n = norm(h);
  return !!n && DATE_HEADERS.some((d) => n.includes(d));
};

/** Excel serial number -> dd/mm/yyyy, in UTC so the day never shifts. */
function serialToDate(n) {
  const dt = new Date((n - 25569) * 86400 * 1000);
  const d  = String(dt.getUTCDate()).padStart(2, '0');
  const m  = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${dt.getUTCFullYear()}`;
}

/** Two-digit years are this century: Isracard writes 11.01.26 for 2026. */
const expandYear = (y) => (String(y).length <= 2 ? 2000 + Number(y) : Number(y));

/** Normalise any date representation to dd/mm/yyyy; '' when it isn't a date. */
function toDate(val) {
  if (val === '' || val == null) return '';
  if (val instanceof Date) {
    const d = String(val.getUTCDate()).padStart(2, '0');
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${val.getUTCFullYear()}`;
  }
  // Excel serials: 20000 = 1954, 80000 = 2119 — anything outside isn't a date.
  if (typeof val === 'number') return val > 20000 && val < 80000 ? serialToDate(val) : '';
  const s = String(val).trim();
  if (!s) return '';
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(s)) {
    const [a, b, y] = s.split(/[/.-]/);
    return `${a.padStart(2, '0')}/${b.padStart(2, '0')}/${expandYear(y)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 20000 && n < 80000 ? serialToDate(n) : '';
}

const csvEscape = (v) => {
  const s = String(v ?? '').replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

const isSummaryRow = (row) => row.some((c) => {
  const n = norm(c);
  return n && SUMMARY_MARKERS.some((m) => n.includes(m));
});

/**
 * Convert a spreadsheet to CSV text, preserving its own column names.
 * Throws with a human-readable message when the layout isn't recognised.
 *
 * @returns {{csv: string, rows: number, skipped: number, headers: string[]}}
 */
function spreadsheetToCSV(filePath) {
  const wb = XLSX.readFile(filePath);
  if (!wb.SheetNames.length) throw new Error('The file contains no sheets');

  // Some exports put a cover sheet first — use the sheet with the most rows.
  let rows = [];
  for (const name of wb.SheetNames) {
    const r = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true });
    if (r.length > rows.length) rows = r;
  }

  const headerIdx = findHeaderRow(rows);
  if (headerIdx === -1) {
    throw new Error('Could not find a header row — this does not look like a bank or credit-card export');
  }

  const headers = rows[headerIdx].map(flattenHeader);

  // Drop columns that are empty from header to last row (banks pad sheets out).
  const keep = headers
    .map((h, i) => (h || rows.slice(headerIdx + 1).some((r) => String(r[i] ?? '').trim()) ? i : -1))
    .filter((i) => i !== -1);
  if (!keep.length) throw new Error('The sheet has no usable columns');

  const dateCols  = keep.filter((i) => isDateHeader(headers[i]));
  const primaryDate = dateCols.length ? dateCols[0] : -1;

  const out = [keep.map((i) => headers[i])];
  let skipped = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || keep.every((c) => String(row[c] ?? '').trim() === '')) continue;

    // A transaction always carries a real date. This is what removes the
    // "OPENING BALANCE" line, the totals row, and the footnote paragraph.
    if (primaryDate !== -1 && !toDate(row[primaryDate])) { skipped++; continue; }
    if (isSummaryRow(row)) { skipped++; continue; }

    out.push(keep.map((c) => (dateCols.includes(c) ? toDate(row[c]) || '' : row[c])));
  }

  if (out.length < 2) throw new Error('No transaction rows found in the file');

  return {
    csv: out.map((r) => r.map(csvEscape).join(',')).join('\r\n'),
    rows: out.length - 1,
    skipped,
    headers: out[0],
  };
}

/**
 * Read any supported import file and return CSV text plus a row count.
 * CSVs pass through untouched — the parsers already handle their columns.
 */
function fileToCSV(filePath) {
  if (SPREADSHEET_RE.test(filePath)) return spreadsheetToCSV(filePath);
  const csv   = readCSVSmart(filePath);
  const lines = csv.split(/\r?\n/).filter((l) => l.trim()).length;
  return { csv, rows: Math.max(0, lines - 1), skipped: 0, headers: [] };
}

// ── Filing an import across years ─────────────────────────────────────────
// A card statement covers a charge period, not a calendar year: the January
// file lists purchases made the previous December. Rows are split by the year
// of their own date so each lands in the right year folder.

/** Minimal RFC 4180 reader — handles quoted fields containing commas. */
function parseCSVRows(text) {
  const rows = [];
  let row = [], field = '', quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  return rows;
}

const serializeCSVRows = (rows) => rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');

/** The calendar year of a date cell, or null when it isn't a date. */
function yearOf(value) {
  const s = String(value ?? '').trim();
  const dmy = s.match(/^(\d{1,4})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) return expandYear(dmy[3]);
  const iso = s.match(/^(\d{4})-\d{2}-\d{2}/);
  return iso ? Number(iso[1]) : null;
}

/**
 * Group a CSV's rows by the year of their date column.
 * Returns null when no date column can be identified — the caller then keeps
 * the file whole rather than guessing.
 */
function splitCSVByYear(csvText) {
  const rows = parseCSVRows(csvText);
  if (rows.length < 2) return null;

  const headers = rows[0];
  const body    = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ''));
  if (!body.length) return null;

  // Prefer a column that is named like a date; the first one wins, which is
  // the purchase date rather than the later charge date.
  let idx = headers.findIndex((h) => isDateHeader(h));

  if (idx === -1) {
    let best = 0;
    headers.forEach((_, i) => {
      const hits = body.filter((r) => yearOf(r[i]) !== null).length;
      if (hits > best) { best = hits; idx = i; }
    });
    if (best < body.length * 0.5) return null;   // no column reads as dates
  }

  const byYear  = new Map();
  const undated = [];

  for (const r of body) {
    const y = yearOf(r[idx]);
    if (y === null) { undated.push(r); continue; }
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(r);
  }

  return { headers, byYear, undated, total: body.length, dateColumn: headers[idx] };
}

module.exports = {
  fileToCSV, spreadsheetToCSV, readCSVSmart, SPREADSHEET_RE,
  splitCSVByYear, serializeCSVRows, parseCSVRows,
};
