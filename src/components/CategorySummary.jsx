import React, { useState, useMemo, useRef } from 'react';
import { Doughnut } from 'react-chartjs-2';
import * as XLSX from 'xlsx';
import { COLORS } from '../utils/colors.js';
import VendorDrilldown from './VendorDrilldown.jsx';

const fmt = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

function exportPnL(expenseCategories, expenseGrandTotal, incomeVendors, incomeGrandTotal, year) {
  const rows = [];

  // ── Expenses section ──
  rows.push(['EXPENSES']);
  rows.push(['Category', 'Paid', 'Received', 'Net']);
  for (const c of expenseCategories) {
    rows.push([c.category, +c.paid.toFixed(2), +c.received.toFixed(2), +c.total.toFixed(2)]);
  }
  rows.push(['Total', null, null, +expenseGrandTotal.toFixed(2)]);

  // blank separator
  rows.push([]);

  // ── Income section ──
  rows.push(['INCOME']);
  rows.push(['Vendor', 'Received', 'Paid', 'Net']);
  for (const v of incomeVendors) {
    rows.push([v.vendor, +v.received.toFixed(2), +v.paid.toFixed(2), +v.net.toFixed(2)]);
  }
  rows.push(['Total', null, null, +incomeGrandTotal.toFixed(2)]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws['!cols'] = [{ wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'P&L');
  XLSX.writeFile(wb, `PnL-Report${year ? `-${year}` : ''}.xlsx`);
}

const SOURCE_OPTS = [
  { value: 'bank',      label: 'Bank' },
  { value: 'credit',    label: 'Credit' },
  { value: 'il-bank',   label: 'IL Bank' },
  { value: 'il-credit', label: 'IL Credit' },
];

/* ── Expenses panel ─────────────────────────────────────────────────────── */
function ExpensesPanel({ categories, grandTotal, filteredTxns, mappings, onMappingsChange, allCategories }) {
  const [selected, setSelected] = useState(null);

  const drilldownTxns = useMemo(
    () => selected ? filteredTxns.filter((t) => t.category === selected) : [],
    [selected, filteredTxns]
  );

  if (categories.length === 0) {
    return <EmptyState message="No expense transactions found." />;
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      {/* Scrollable table fills all available height */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Category</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Net</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">%</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">#</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.map((c, i) => {
              const pct = grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : '0.0';
              return (
                <tr
                  key={c.category}
                  onClick={() => setSelected(c.category)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="font-medium text-gray-900 group-hover:text-blue-700 text-xs">
                        {c.category}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-800 text-xs">
                    <span className="font-medium">{fmt(c.total)}</span>
                    {c.received > 0 && (
                      <span className="block text-[10px] text-gray-400 font-normal">
                        {fmt(c.paid)} − <span className="text-emerald-600">{fmt(c.received)}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{pct}%</td>
                  <td className="px-4 py-2.5 text-right text-gray-600 text-xs">{c.count.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50 sticky bottom-0">
            <tr>
              <td className="px-4 py-2.5 font-semibold text-gray-700 text-xs">Total</td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900 text-xs">
                {fmt(grandTotal)}
              </td>
              <td className="px-4 py-2.5 text-right text-gray-500 text-xs">100%</td>
              <td className="px-4 py-2.5 text-right font-semibold text-gray-700 text-xs">
                {categories.reduce((s, c) => s + c.count, 0).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="flex-shrink-0 text-xs text-gray-400">Click any row to drill down.</p>

      {selected && (
        <VendorDrilldown
          category={selected}
          transactions={drilldownTxns}
          onClose={() => setSelected(null)}
          mappings={mappings}
          onMappingsChange={onMappingsChange}
          allCategories={allCategories}
        />
      )}
    </div>
  );
}

/* ── Income panel ───────────────────────────────────────────────────────── */
function IncomePanel({ filteredTxns, expenseCategories, expenseGrandTotal }) {
  const chartRef = useRef(null);

  const chartData = useMemo(() => ({
    labels: expenseCategories.map((c) => c.category),
    datasets: [{
      data: expenseCategories.map((c) => c.total),
      backgroundColor: expenseCategories.map((_, i) => COLORS[i % COLORS.length]),
      borderColor: '#fff',
      borderWidth: 3,
      hoverBorderWidth: 3,
      hoverOffset: 6,
    }],
  }), [expenseCategories]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: { font: { size: 10 }, padding: 10, usePointStyle: true, pointStyleWidth: 8 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed;
            const pct = expenseGrandTotal > 0 ? ((val / expenseGrandTotal) * 100).toFixed(1) : '0.0';
            return `  ${fmt(val)}  (${pct}%)`;
          },
        },
      },
    },
  }), [expenseGrandTotal]);

  const vendors = useMemo(() => {
    const map = new Map();
    for (const t of filteredTxns) {
      if (t.category?.trim().toLowerCase() !== 'income') continue;
      const key = (t.vendor || 'Unknown').toLowerCase();
      if (!map.has(key)) map.set(key, { vendor: t.vendor || 'Unknown', received: 0, paid: 0, count: 0 });
      const e = map.get(key);
      if (t.amount < 0) e.received += Math.abs(t.amount);
      else              e.paid     += t.amount;
      e.count++;
    }
    return Array.from(map.values())
      .map((v) => ({ ...v, net: v.received - v.paid }))
      .sort((a, b) => b.net - a.net);
  }, [filteredTxns]);

  const grandTotal = vendors.reduce((s, v) => s + v.net, 0);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4">
      {/* Income vendors table — scrollable, max ~40% of column height */}
      {vendors.length === 0 ? (
        <EmptyState message="No income transactions found." />
      ) : (
        <div className="flex-shrink-0 max-h-[40%] overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Vendor</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Received</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">%</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">#</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vendors.map((v) => {
                const pct = grandTotal > 0 ? ((v.net / grandTotal) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={v.vendor} className="hover:bg-emerald-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-900 text-xs">{v.vendor}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                      <span className="font-medium text-emerald-700">{fmt(v.net)}</span>
                      {v.paid > 0 && (
                        <span className="block text-[10px] text-gray-400 font-normal">
                          <span className="text-emerald-600">{fmt(v.received)}</span> − {fmt(v.paid)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{pct}%</td>
                    <td className="px-4 py-2.5 text-right text-gray-600 text-xs">{v.count.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50 sticky bottom-0">
              <tr>
                <td className="px-4 py-2.5 font-semibold text-gray-700 text-xs">Total</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-700 text-xs">
                  {fmt(grandTotal)}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-500 text-xs">100%</td>
                <td className="px-4 py-2.5 text-right font-semibold text-gray-700 text-xs">
                  {vendors.reduce((s, v) => s + v.count, 0).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Expenses donut — grows to fill remaining height */}
      {expenseCategories.length > 0 && (
        <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col">
          <p className="flex-shrink-0 text-xs font-semibold text-gray-500 mb-3">Expenses breakdown</p>
          <div className="flex-1 min-h-0">
            <Doughnut ref={chartRef} data={chartData} options={chartOptions} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────────────────── */
function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <svg className="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}

/* ── Root component ─────────────────────────────────────────────────────── */
export default function CategorySummary({ transactions, mappings = [], onMappingsChange, year }) {
  const [activeSources, setActiveSources] = useState([]);

  const availableSources = useMemo(() => {
    const present = new Set(transactions.map((t) => t.source));
    return SOURCE_OPTS.filter((o) => present.has(o.value));
  }, [transactions]);

  const toggleSource = (value) =>
    setActiveSources((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );

  const clearSources = () => setActiveSources([]);

  const filteredTxns = useMemo(
    () => activeSources.length === 0
      ? transactions
      : transactions.filter((t) => activeSources.includes(t.source)),
    [transactions, activeSources]
  );

  const allCategories = useMemo(() => {
    const s = new Set(filteredTxns.map((t) => t.category).filter(Boolean));
    for (const m of mappings) { if (m.categoryOverride) s.add(m.categoryOverride); }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [filteredTxns, mappings]);

  const expenseCategories = useMemo(() => {
    const map = new Map();
    for (const t of filteredTxns) {
      const cat = t.category || 'Uncategorized';
      if (cat.trim().toLowerCase() === 'income') continue;
      if (!map.has(cat)) map.set(cat, { category: cat, paid: 0, received: 0, count: 0 });
      const e = map.get(cat);
      if (t.amount >= 0) e.paid     += t.amount;
      else               e.received += Math.abs(t.amount);
      e.count++;
    }
    return Array.from(map.values())
      .map((e) => ({ ...e, total: e.paid - e.received }))
      .filter((e) => e.paid > 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredTxns]);

  const expenseGrandTotal = useMemo(
    () => expenseCategories.reduce((s, c) => s + c.total, 0),
    [expenseCategories]
  );

  const incomeVendors = useMemo(() => {
    const map = new Map();
    for (const t of filteredTxns) {
      if (t.category?.trim().toLowerCase() !== 'income') continue;
      const key = (t.vendor || 'Unknown').toLowerCase();
      if (!map.has(key)) map.set(key, { vendor: t.vendor || 'Unknown', received: 0, paid: 0, count: 0 });
      const e = map.get(key);
      if (t.amount < 0) e.received += Math.abs(t.amount);
      else              e.paid     += t.amount;
      e.count++;
    }
    return Array.from(map.values())
      .map((v) => ({ ...v, net: v.received - v.paid }))
      .sort((a, b) => b.net - a.net);
  }, [filteredTxns]);

  const incomeGrandTotal = useMemo(
    () => incomeVendors.reduce((s, v) => s + v.net, 0),
    [incomeVendors]
  );

  return (
    <div className="h-full flex flex-col gap-4">

      {/* Top bar: source filter (left) + export button (right) */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {availableSources.length > 1 && (
            <>
              <span className="text-xs font-medium text-gray-500 mr-1">Source:</span>
              <button
                onClick={clearSources}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                  activeSources.length === 0
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                All
              </button>
              {availableSources.map((opt) => {
                const on = activeSources.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleSource(opt.value)}
                    className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                      on
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Export button */}
        <button
          onClick={() => exportPnL(expenseCategories, expenseGrandTotal, incomeVendors, incomeGrandTotal, year)}
          disabled={expenseCategories.length === 0 && incomeVendors.length === 0}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          Export to P&amp;L Report
        </button>
      </div>

      {/* Split layout — grows to fill remaining height */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-6">

        {/* Left: Expenses */}
        <div className="flex flex-col min-h-0 gap-3">
          <div className="flex-shrink-0 flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-800">Expenses</h2>
            <span className="text-xs text-gray-400">by category</span>
          </div>
          <ExpensesPanel
            categories={expenseCategories}
            grandTotal={expenseGrandTotal}
            filteredTxns={filteredTxns}
            mappings={mappings}
            onMappingsChange={onMappingsChange}
            allCategories={allCategories}
          />
        </div>

        {/* Right: Income */}
        <div className="flex flex-col min-h-0 gap-3">
          <div className="flex-shrink-0 flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-800">Income</h2>
            <span className="text-xs text-gray-400">by vendor</span>
          </div>
          <IncomePanel
            filteredTxns={filteredTxns}
            expenseCategories={expenseCategories}
            expenseGrandTotal={expenseGrandTotal}
          />
        </div>

      </div>
    </div>
  );
}
