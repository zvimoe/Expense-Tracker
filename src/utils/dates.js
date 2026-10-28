/**
 * Date helpers shared by the monthly board and the transaction filters.
 *
 * Transaction dates are MM/DD/YYYY (see parseCSV.js), while <input type="date">
 * produces YYYY-MM-DD. Comparing the two with `new Date(...)` is unsafe: the
 * slash form parses as LOCAL midnight and the ISO form as UTC midnight, so in
 * any timezone east of UTC a transaction falling on the first day of a range
 * sorts *before* the range start and is silently dropped. We therefore reduce
 * both forms to a plain YYYYMMDD integer and never construct a Date for
 * comparison at all.
 */

export const MONTH_NAMES = [
  'January', 'February', 'March',     'April',   'May',      'June',
  'July',    'August',   'September', 'October', 'November', 'December',
];

export const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Reduce a date string to a comparable YYYYMMDD integer.
 * Accepts MM/DD/YYYY (transaction data) and YYYY-MM-DD (date inputs).
 * Returns null when the string is absent or in an unrecognised shape.
 */
export function toDayKey(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);

  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return Number(m[3]) * 10000 + Number(m[1]) * 100 + Number(m[2]);

  return null;
}

/** Calendar year of a date string, or null when unparseable. */
export function yearOf(dateStr) {
  const key = toDayKey(dateStr);
  return key == null ? null : Math.floor(key / 10000);
}

/** Zero-based month index (0 = January) of a date string, or null. */
export function monthIndexOf(dateStr) {
  const key = toDayKey(dateStr);
  return key == null ? null : (Math.floor(key / 100) % 100) - 1;
}

/** Number of days in a given month. UTC-based so it never shifts by timezone. */
export function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(Number(year), monthIndex + 1, 0)).getUTCDate();
}

/**
 * Inclusive ISO date range covering one month, shaped for the date filters:
 *   monthRange(2025, 2) → { from: '2025-03-01', to: '2025-03-31' }
 */
export function monthRange(year, monthIndex) {
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(daysInMonth(year, monthIndex)).padStart(2, '0');
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${dd}` };
}
