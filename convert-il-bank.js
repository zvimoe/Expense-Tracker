/**
 * CLI converter: Israeli bank Excel → il-bank.csv
 *
 * Usage:
 *   node convert-il-bank.js <input.xlsx> [output.csv]
 *
 * If output path is omitted, saves as il-bank.csv next to the input file.
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const [,, inputArg, outputArg] = process.argv;

if (!inputArg) {
  console.error('Usage: node convert-il-bank.js <input.xlsx> [output.csv]');
  process.exit(1);
}

const inputPath  = path.resolve(inputArg);
const outputPath = outputArg
  ? path.resolve(outputArg)
  : path.join(path.dirname(inputPath), 'il-bank.csv');

if (!fs.existsSync(inputPath)) {
  console.error('File not found:', inputPath);
  process.exit(1);
}

// ── converter (mirrors electron/main.js) ─────────────────────────────────
function xlsxILBankToCSV(filePath) {
  const wb   = XLSX.readFile(filePath);
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  const MARKERS = ['תיאור', 'חובה', 'זכות'];
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const flat = rows[i].map(String).join('');
    if (MARKERS.filter(m => flat.includes(m)).length >= 2) { headerIdx = i; break; }
  }
  if (headerIdx === -1) throw new Error('Could not find header row — is this a Bank Hapoalim Excel export?');

  const headers = rows[headerIdx].map(String);

  const findCol = (...aliases) => {
    for (const a of aliases) {
      const i = headers.findIndex(h => h.trim().includes(a));
      if (i !== -1) return i;
    }
    return -1;
  };

  const dateCol   = findCol('תאריך ערך', 'תאריך פעולה', 'תאריך');
  const vendorCol = findCol('תיאור', 'פירוט', 'שם');
  const debitCol  = findCol('חובה', 'חיוב');
  const creditCol = findCol('זכות', 'הפקדה');

  if (dateCol === -1 || vendorCol === -1)
    throw new Error(`Required columns not found. Headers: ${headers.filter(Boolean).join(', ')}`);

  console.log(`  Date col   : [${dateCol}] "${headers[dateCol]}"`);
  console.log(`  Vendor col : [${vendorCol}] "${headers[vendorCol].trim()}"`);
  console.log(`  Debit col  : [${debitCol}] "${debitCol !== -1 ? headers[debitCol] : '—'}"`);
  console.log(`  Credit col : [${creditCol}] "${creditCol !== -1 ? headers[creditCol] : '—'}"`);

  const serialToDate = (n) => {
    const ms = (n - 25569) * 86400 * 1000;
    const dt = new Date(ms);
    const d  = String(dt.getUTCDate()).padStart(2, '0');
    const m  = String(dt.getUTCMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${dt.getUTCFullYear()}`;
  };

  const toDate = (val) => {
    if (val === '' || val == null) return '';
    if (typeof val === 'number' && val > 40000) return serialToDate(val);
    const s = String(val).trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) return s;
    return '';
  };

  const csvEscape = (v) => {
    const s = String(v ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };

  const out = [['תאריך', 'תיאור פעולה', 'חובה', 'זכות']];
  let skipped = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(c => c === '' || c == null)) continue;
    const date   = toDate(row[dateCol]);
    const vendor = String(row[vendorCol] ?? '').trim();
    const debit  = debitCol  !== -1 ? (row[debitCol]  ?? '') : '';
    const credit = creditCol !== -1 ? (row[creditCol] ?? '') : '';
    if (!date || !vendor) { skipped++; continue; }
    out.push([date, vendor, debit, credit]);
  }

  if (out.length < 2) throw new Error('No transaction rows found in the file');
  console.log(`  Rows converted : ${out.length - 1}`);
  if (skipped) console.log(`  Rows skipped   : ${skipped}`);

  return out.map(r => r.map(csvEscape).join(',')).join('\r\n');
}

// ── run ───────────────────────────────────────────────────────────────────
console.log('\nConverting:', inputPath);
try {
  const csv = xlsxILBankToCSV(inputPath);
  // Write UTF-8 with BOM so Excel/Windows apps open Hebrew CSVs correctly.
  fs.writeFileSync(outputPath, '\uFEFF' + csv, 'utf-8');
  console.log('Saved to   :', outputPath);
  console.log('\nFirst 5 data lines:');
  csv.split('\r\n').slice(0, 6).forEach(l => console.log(' ', l));
  console.log('\nDone.');
} catch (err) {
  console.error('\nERROR:', err.message);
  process.exit(1);
}
