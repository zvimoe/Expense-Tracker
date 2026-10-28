/**
 * The transaction sources the app knows about.
 *
 * This is the single place a source is defined: its storage key, how it is
 * labelled in filters and badges, which currency its exports are in, and what
 * the file picker says. Adding another card issuer means adding one entry here
 * (plus a parser in parseCSV.js if its columns differ from the ones we know).
 */
export const SOURCES = [
  {
    type:     'bank',
    label:    'US Bank',
    icon:     '🏦',
    desc:     'US bank account export (CSV)',
    currency: 'USD',
    badge:    'bg-blue-100 text-blue-700',
  },
  {
    type:     'credit',
    label:    'US Credit',
    icon:     '💳',
    desc:     'US credit card export (CSV)',
    currency: 'USD',
    badge:    'bg-violet-100 text-violet-700',
  },
  {
    type:     'il-bank',
    label:    'IL Bank',
    icon:     '🏦',
    desc:     'Israeli bank export — CSV, XLS or XLSX',
    currency: 'ILS',
    badge:    'bg-amber-100 text-amber-700',
  },
  {
    type:     'il-credit',
    label:    'Visa Cal',
    icon:     '💳',
    desc:     'Visa Cal export — CSV, XLS or XLSX',
    currency: 'ILS',
    badge:    'bg-rose-100 text-rose-700',
  },
  {
    type:     'isracard',
    label:    'Isracard',
    icon:     '💳',
    desc:     'Isracard export — one file per month is fine',
    currency: 'ILS',
    badge:    'bg-teal-100 text-teal-700',
  },
];

export const SOURCE_TYPES = SOURCES.map((s) => s.type);

const BY_TYPE = Object.fromEntries(SOURCES.map((s) => [s.type, s]));

/** Registry entry for a source, with a safe fallback for unknown keys. */
export const sourceInfo = (type) =>
  BY_TYPE[type] ?? { type, label: type, icon: '📄', desc: '', currency: 'USD', badge: 'bg-gray-100 text-gray-600' };

export const sourceLabel = (type) => sourceInfo(type).label;

/** [{value, label}] for the filter controls. */
export const SOURCE_OPTS = SOURCES.map((s) => ({ value: s.type, label: s.label }));
