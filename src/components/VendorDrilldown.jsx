import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import { COLORS } from '../utils/colors.js';

const fmt = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const MAX_BARS = 20; // cap for readability

/* Inline category picker shown when the user clicks the edit icon on a vendor row */
function CategoryEditor({ vendor, currentCategory, allCategories, mappings, onMappingsChange, onClose }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const save = () => {
    const cat = value.trim();
    if (!cat) return;
    const lower = vendor.toLowerCase();
    const idx   = mappings.findIndex((m) => m.vendor.toLowerCase() === lower);
    let next;
    if (idx >= 0) {
      next = mappings.map((m, i) =>
        i === idx ? { ...m, categoryOverride: cat } : m
      );
    } else {
      next = [...mappings, { vendor, mappedVendor: '', categoryOverride: cat }];
    }
    onMappingsChange(next);
    onClose();
  };

  const onKey = (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); save(); }
    if (e.key === 'Escape') onClose();
  };

  const listId = `cat-suggestions-${vendor.replace(/\s+/g, '_')}`;

  return (
    <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
      <datalist id={listId}>
        {allCategories.map((c) => <option key={c} value={c} />)}
      </datalist>
      <input
        ref={inputRef}
        list={listId}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        placeholder="Category…"
        className="text-xs border border-blue-400 rounded px-2 py-1 w-36 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <button
        onClick={save}
        className="text-emerald-600 hover:text-emerald-700 p-1 rounded hover:bg-emerald-50"
        title="Save"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </button>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
        title="Cancel"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function VendorDrilldown({
  category, transactions, onClose,
  mappings = [], onMappingsChange, allCategories = [],
}) {
  const [editingVendor, setEditingVendor] = useState(null);

  // Close on Escape (only when no inline editor is open)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !editingVendor) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editingVendor]);

  // Aggregate net (paid − received) per vendor within this category
  const vendors = useMemo(() => {
    const map = new Map();
    for (const t of transactions) {
      if (!map.has(t.vendor)) map.set(t.vendor, { paid: 0, received: 0 });
      const e = map.get(t.vendor);
      if (t.amount >= 0) e.paid     += t.amount;
      else               e.received += Math.abs(t.amount);
    }
    return Array.from(map.entries())
      .map(([vendor, e]) => ({ vendor, total: e.paid - e.received, paid: e.paid, received: e.received }))
      .filter((v) => v.paid > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, MAX_BARS);
  }, [transactions]);

  const chartHeight = Math.max(180, vendors.length * 36 + 40);

  const chartData = useMemo(
    () => ({
      // reversed so the largest bar is at the top (Chart.js renders y-axis bottom-up)
      labels: [...vendors].reverse().map((v) => v.vendor),
      datasets: [
        {
          data: [...vendors].reverse().map((v) => v.total),
          backgroundColor: [...vendors]
            .reverse()
            .map((_, i) => COLORS[i % COLORS.length]),
          borderWidth: 0,
          borderRadius: 4,
        },
      ],
    }),
    [vendors]
  );

  const chartOptions = useMemo(
    () => ({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `  ${fmt(ctx.parsed.x)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#f1f5f9' },
          border: { display: false },
          ticks: {
            font: { size: 11 },
            callback: (v) =>
              v.toLocaleString('en-US', {
                notation: 'compact',
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 1,
              }),
          },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { font: { size: 11 } },
        },
      },
    }),
    []
  );

  const totalSpent = vendors.reduce((s, v) => s + v.total, 0); // net total
  const txnCount   = transactions.length;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{category}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Net {fmt(totalSpent)} across {txnCount.toLocaleString()} transaction{txnCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Vendor table with category edit */}
          {vendors.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Vendors
                {vendors.length === MAX_BARS && (
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    (top {MAX_BARS} shown)
                  </span>
                )}
              </h3>

              {/* Scrollable bar chart */}
              <div style={{ height: chartHeight }} className="mb-4">
                <Bar data={chartData} options={chartOptions} />
              </div>

              {/* Vendor rows with inline category editor */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Vendor</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Net</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {vendors.map((v) => {
                      const mapping   = mappings.find((m) => m.vendor.toLowerCase() === v.vendor.toLowerCase());
                      const catLabel  = mapping?.categoryOverride || category;
                      const isEditing = editingVendor === v.vendor;
                      return (
                        <tr key={v.vendor} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[200px] truncate">
                            {v.vendor}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-800 whitespace-nowrap">
                            {fmt(v.total)}
                          </td>
                          <td className="px-4 py-2.5">
                            {isEditing ? (
                              <CategoryEditor
                                vendor={v.vendor}
                                currentCategory={catLabel}
                                allCategories={allCategories}
                                mappings={mappings}
                                onMappingsChange={onMappingsChange}
                                onClose={() => setEditingVendor(null)}
                              />
                            ) : (
                              <div className="flex items-center gap-1.5 group">
                                <span className="text-gray-500 text-xs">{catLabel}</span>
                                {onMappingsChange && (
                                  <button
                                    onClick={() => setEditingVendor(v.vendor)}
                                    title="Change category"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Individual transactions */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              All transactions ({txnCount.toLocaleString()})
            </h3>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Date</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Vendor</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Amount</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((t, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{t.date || '—'}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900 max-w-xs truncate">
                        {t.vendor}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                          t.amount < 0 ? 'text-emerald-600' : 'text-gray-900'
                        }`}
                      >
                        {t.amount < 0 ? '+' : ''}
                        {fmt(Math.abs(t.amount))}
                      </td>
                      <td className="px-4 py-2.5 capitalize text-gray-500">{t.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
