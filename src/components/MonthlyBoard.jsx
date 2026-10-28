import React, { useState, useMemo, useRef, useEffect } from 'react';
import { COLORS } from '../utils/colors.js';
import { MONTH_NAMES, MONTH_ABBR, monthRange } from '../utils/dates.js';
import {
  monthlyExpenseTotals,
  expenseCategoriesForMonth,
  percentChange,
} from '../utils/monthly.js';
import { isExpense } from '../utils/categories.js';
import { SOURCE_OPTS } from '../utils/sources.js';

const fmt = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtCents = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });


/* ── Category picker ────────────────────────────────────────────────────── */
/**
 * Excluded categories are tracked rather than included ones, so a category
 * that only appears once new data is imported shows up automatically instead
 * of being silently left out of a stale selection.
 */
function CategoryFilter({ categories, excluded, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const excludedSet = new Set(excluded);
  const shown = categories.length - excludedSet.size;

  const toggle = (name) => {
    const next = new Set(excludedSet);
    if (next.has(name)) next.delete(name); else next.add(name);
    onChange(Array.from(next));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
          excludedSet.size > 0
            ? 'border-blue-400 text-blue-700 bg-blue-50'
            : 'border-gray-300 text-gray-600 bg-white hover:border-blue-400'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        {excludedSet.size === 0 ? 'All categories' : `${shown} of ${categories.length} categories`}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-80 max-h-96 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
          <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-500">Include in totals</span>
            <span className="flex gap-2">
              <button onClick={() => onChange([])}
                className="text-[11px] font-medium text-blue-600 hover:underline">All</button>
              <button onClick={() => onChange(categories.map((c) => c.name))}
                className="text-[11px] font-medium text-gray-500 hover:underline">None</button>
            </span>
          </div>
          {categories.map((c) => {
            const on = !excludedSet.has(c.name);
            return (
              <label key={c.name}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 cursor-pointer">
                <input type="checkbox" checked={on} onChange={() => toggle(c.name)}
                  className="w-3.5 h-3.5 accent-blue-600 flex-shrink-0" />
                <span className={`text-xs flex-1 truncate ${on ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                  {c.name}
                </span>
                <span className="text-[11px] tabular-nums text-gray-400 flex-shrink-0">{fmt(c.total)}</span>
              </label>
            );
          })}
          {categories.length === 0 && (
            <p className="px-3 py-4 text-xs text-gray-400 text-center">No categories in this year.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Summary stat card ──────────────────────────────────────────────────── */
function StatCard({ label, value, sub, accent }) {
  return (
    <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-2.5">
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <p className={`text-lg font-bold tabular-nums leading-tight ${accent || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

/* ── Year-over-year line inside a month card ────────────────────────────── */
function ComparisonLine({ current, prior, hasPrior, priorYear, monthIndex }) {
  if (!hasPrior) {
    return (
      <p className="text-[11px] text-gray-300">
        No {priorYear} data yet
      </p>
    );
  }
  if (!prior) {
    return (
      <p className="text-[11px] text-gray-400">
        Nothing in {MONTH_ABBR[monthIndex]} {priorYear}
      </p>
    );
  }

  const diff = current - prior;
  const pct  = percentChange(current, prior);
  const up   = diff > 0;

  if (Math.abs(pct) < 0.5) {
    return (
      <p className="text-[11px] text-gray-500">
        About the same as {MONTH_ABBR[monthIndex]} {priorYear}
      </p>
    );
  }

  return (
    <p className={`text-[11px] font-medium flex items-center gap-1 ${up ? 'text-red-600' : 'text-emerald-600'}`}
      title={`${MONTH_ABBR[monthIndex]} ${priorYear}: ${fmtCents(prior)}`}>
      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
          d={up ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
      </svg>
      {fmt(Math.abs(diff))} {up ? 'more' : 'less'} than {MONTH_ABBR[monthIndex]} {priorYear}
      <span className="text-gray-400 font-normal">({up ? '+' : ''}{pct.toFixed(0)}%)</span>
    </p>
  );
}

/* ── One month card ─────────────────────────────────────────────────────── */
const TOP_N = 4;

function MonthCard({ month, categories, prior, hasPrior, priorYear, year, colorOf, onDrill }) {
  const empty = month.count === 0;
  const top   = categories.slice(0, TOP_N);
  const rest  = categories.length - top.length;

  return (
    <div className={`flex flex-col bg-white rounded-xl border shadow-sm transition-colors ${
      empty ? 'border-gray-100' : 'border-gray-200 hover:border-blue-300'
    }`}>
      {/* Header — whole strip opens the month */}
      <button
        onClick={() => !empty && onDrill(month.monthIndex, null)}
        disabled={empty}
        className={`text-left px-3.5 pt-3 pb-2 rounded-t-xl ${empty ? 'cursor-default' : 'hover:bg-blue-50/60'}`}
      >
        <div className="flex items-baseline justify-between">
          <span className={`text-xs font-semibold ${empty ? 'text-gray-300' : 'text-gray-700'}`}>
            {MONTH_NAMES[month.monthIndex]}
          </span>
          <span className="text-[10px] text-gray-400">
            {month.count > 0 ? `${month.count} txns` : ''}
          </span>
        </div>

        <p className={`text-xl font-bold tabular-nums leading-tight mt-0.5 ${
          empty ? 'text-gray-300' : 'text-gray-900'
        }`}>
          {empty ? '—' : fmtCents(month.total)}
        </p>

        <div className="mt-0.5 min-h-[16px]">
          {!empty && (
            <ComparisonLine
              current={month.total}
              prior={prior}
              hasPrior={hasPrior}
              priorYear={priorYear}
              monthIndex={month.monthIndex}
            />
          )}
        </div>
      </button>

      {/* Top categories */}
      <div className="border-t border-gray-100 px-3.5 py-2 flex-1">
        {empty ? (
          <p className="text-[11px] text-gray-300 py-1">No transactions</p>
        ) : (
          <>
            {top.map((c) => (
              <button
                key={c.category}
                onClick={() => onDrill(month.monthIndex, c.category)}
                title={`${c.count} transaction${c.count !== 1 ? 's' : ''} — open in All Transactions`}
                className="w-full flex items-center gap-1.5 py-0.5 group text-left"
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: colorOf(c.category) }} />
                <span className="text-[11px] text-gray-600 group-hover:text-blue-700 truncate flex-1">
                  {c.category}
                </span>
                <span className="text-[11px] tabular-nums text-gray-500 group-hover:text-blue-700 flex-shrink-0">
                  {fmt(c.total)}
                </span>
              </button>
            ))}
            {rest > 0 && (
              <button
                onClick={() => onDrill(month.monthIndex, null)}
                className="text-[10px] text-gray-400 hover:text-blue-600 hover:underline mt-0.5"
              >
                +{rest} more {rest === 1 ? 'category' : 'categories'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Root ───────────────────────────────────────────────────────────────── */
export default function MonthlyBoard({ transactions, priorTransactions, year, priorYear, onDrilldown }) {
  const [activeSources,      setActiveSources]      = useState([]);
  const [excludedCategories, setExcludedCategories] = useState([]);

  const hasPriorData = Array.isArray(priorTransactions) && priorTransactions.length > 0;

  const availableSources = useMemo(() => {
    const present = new Set((transactions || []).map((t) => t.source));
    return SOURCE_OPTS.filter((o) => present.has(o.value));
  }, [transactions]);

  // Every spendable category across both years, with this year's total, so the
  // picker shows what each one is actually worth before you switch it off.
  const categoryOptions = useMemo(() => {
    const totals = new Map();
    for (const t of transactions || []) {
      if (!isExpense(t)) continue;
      const name = t.category || 'Uncategorized';
      totals.set(name, (totals.get(name) || 0) + (t.amount || 0));
    }
    for (const t of priorTransactions || []) {
      if (!isExpense(t)) continue;
      const name = t.category || 'Uncategorized';
      if (!totals.has(name)) totals.set(name, 0);
    }
    return Array.from(totals.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [transactions, priorTransactions]);

  // Stable colour per category across all twelve cards
  const colorOf = useMemo(() => {
    const index = new Map(categoryOptions.map((c, i) => [c.name, i]));
    return (name) => COLORS[(index.get(name) ?? 0) % COLORS.length];
  }, [categoryOptions]);

  // The same filter is applied to both years, so the comparison stays like-for-like
  const applyFilter = useMemo(() => {
    const excluded = new Set(excludedCategories);
    return (list) => (list || []).filter((t) => {
      if (activeSources.length > 0 && !activeSources.includes(t.source)) return false;
      if (excluded.has(t.category || 'Uncategorized')) return false;
      return true;
    });
  }, [activeSources, excludedCategories]);

  const curTxns   = useMemo(() => applyFilter(transactions),      [applyFilter, transactions]);
  const priorTxns = useMemo(() => applyFilter(priorTransactions), [applyFilter, priorTransactions]);

  const current = useMemo(() => monthlyExpenseTotals(curTxns, year), [curTxns, year]);
  const prior   = useMemo(
    () => (hasPriorData ? monthlyExpenseTotals(priorTxns, priorYear) : null),
    [priorTxns, priorYear, hasPriorData]
  );

  const monthCategories = useMemo(
    () => Array.from({ length: 12 }, (_, mi) => expenseCategoriesForMonth(curTxns, year, mi)),
    [curTxns, year]
  );

  const activeMonths = current.months.filter((m) => m.count > 0).length;
  const avgMonth     = activeMonths > 0 ? current.total / activeMonths : 0;

  // Only months that have data this year, so a part-way year is not measured
  // against last year's full twelve.
  const priorSameMonths = useMemo(() => {
    if (!prior) return 0;
    return current.months.reduce(
      (sum, m) => (m.count > 0 ? sum + prior.months[m.monthIndex].total : sum),
      0
    );
  }, [current, prior]);

  const changeVsPrior = hasPriorData && priorSameMonths ? current.total - priorSameMonths : null;
  const changePct     = changeVsPrior !== null ? percentChange(current.total, priorSameMonths) : null;

  const toggleSource = (value) =>
    setActiveSources((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );

  const isFiltered = activeSources.length > 0 || excludedCategories.length > 0;
  const resetFilters = () => { setActiveSources([]); setExcludedCategories([]); };

  const drill = (monthIndex, category) => {
    const { from, to } = monthRange(year, monthIndex);
    onDrilldown({ dateFrom: from, dateTo: to, category: category || '' });
  };

  return (
    <div className="h-full flex flex-col gap-3">

      {/* ── Filter bar ── */}
      <div className="flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <span className="block text-[11px] font-medium text-gray-500 mb-1">Categories</span>
            <CategoryFilter
              categories={categoryOptions}
              excluded={excludedCategories}
              onChange={setExcludedCategories}
            />
          </div>

          {availableSources.length > 1 && (
            <div>
              <span className="block text-[11px] font-medium text-gray-500 mb-1">Source</span>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                <button
                  onClick={() => setActiveSources([])}
                  className={`px-3 py-2 transition-colors whitespace-nowrap ${
                    activeSources.length === 0 ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  All
                </button>
                {availableSources.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => toggleSource(opt.value)}
                    className={`px-3 py-2 transition-colors whitespace-nowrap border-l border-gray-300 ${
                      activeSources.includes(opt.value) ? 'bg-blue-600 text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isFiltered && (
            <button
              onClick={resetFilters}
              className="self-end mb-0.5 py-2 px-3 text-sm text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Reset
            </button>
          )}

          <div className="ml-auto self-end mb-1 text-[11px] text-gray-400">
            {excludedCategories.length > 0 && (
              <span className="text-blue-600 font-medium">
                {excludedCategories.length} categor{excludedCategories.length === 1 ? 'y' : 'ies'} hidden
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="flex-shrink-0 flex gap-3">
        <StatCard
          label={`${year} spending`}
          value={fmt(current.total)}
          sub={`${activeMonths} month${activeMonths !== 1 ? 's' : ''} with activity`}
        />
        <StatCard
          label={hasPriorData ? `${priorYear} — same months` : `${priorYear}`}
          value={hasPriorData ? fmt(priorSameMonths) : '—'}
          sub={hasPriorData ? `${priorYear} full year: ${fmt(prior.total)}` : 'No prior year data yet'}
          accent="text-gray-500"
        />
        <StatCard
          label="Change vs last year"
          value={changeVsPrior !== null ? `${changeVsPrior > 0 ? '+' : ''}${fmt(changeVsPrior)}` : '—'}
          sub={changePct !== null
            ? `${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}% on comparable months`
            : `Accurate once ${priorYear} is imported`}
          accent={
            changeVsPrior === null ? 'text-gray-400'
              : changeVsPrior > 0 ? 'text-red-600' : 'text-emerald-600'
          }
        />
        <StatCard
          label="Average month"
          value={fmt(avgMonth)}
          sub="Across months with activity"
          accent="text-gray-700"
        />
      </div>

      {/* ── Notices ── */}
      {current.transferCount > 0 && (
        <div className="flex-shrink-0 flex items-center gap-2 text-[11px] text-gray-500 bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5">
          <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span>
            Excludes {current.transferCount} credit-card payment{current.transferCount !== 1 ? 's' : ''}
            {' '}({fmtCents(current.transferTotal)}) — the purchases are already itemised on the card statement.
          </span>
        </div>
      )}

      {(current.outsideYear > 0 || current.undated > 0) && (
        <div className="flex-shrink-0 flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {current.outsideYear > 0 && `${current.outsideYear} transaction${current.outsideYear !== 1 ? 's' : ''} dated outside ${year}`}
            {current.outsideYear > 0 && current.undated > 0 && ' · '}
            {current.undated > 0 && `${current.undated} with an unreadable date`}
            {' — not counted below.'}
          </span>
        </div>
      )}

      {/* ── 4 × 3 month grid ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-4 gap-3 pb-1">
          {current.months.map((month) => (
            <MonthCard
              key={month.monthIndex}
              month={month}
              categories={monthCategories[month.monthIndex]}
              prior={prior ? prior.months[month.monthIndex].total : 0}
              hasPrior={hasPriorData}
              priorYear={priorYear}
              year={year}
              colorOf={colorOf}
              onDrill={drill}
            />
          ))}
        </div>
      </div>

      <p className="flex-shrink-0 text-[11px] text-gray-400">
        Click a category to open its transactions for that month · click the month to see them all
      </p>
    </div>
  );
}
