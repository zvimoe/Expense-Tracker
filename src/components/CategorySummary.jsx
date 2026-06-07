import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { COLORS } from '../utils/colors.js';
import VendorDrilldown from './VendorDrilldown.jsx';

const fmt = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

export default function CategorySummary({ transactions, mappings = [], onMappingsChange }) {
  const [selected, setSelected] = useState(null);
  const chartRef = useRef(null);

  // All known category names across transactions + existing mapping overrides
  const allCategories = useMemo(() => {
    const s = new Set(transactions.map((t) => t.category).filter(Boolean));
    for (const m of mappings) {
      if (m.categoryOverride) s.add(m.categoryOverride);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [transactions, mappings]);

  // Net per category: paid - received (matches vendor table logic)
  const categories = useMemo(() => {
    const map = new Map();
    for (const t of transactions) {
      const cat = t.category || 'Uncategorized';
      if (!map.has(cat)) map.set(cat, { category: cat, paid: 0, received: 0, count: 0 });
      const e = map.get(cat);
      if (t.amount >= 0) e.paid     += t.amount;
      else               e.received += Math.abs(t.amount);
      e.count++;
    }
    return Array.from(map.values())
      .map((e) => ({ ...e, total: e.paid - e.received }))
      .filter((e) => e.paid > 0)
      .filter((e) => e.category.trim().toLowerCase() !== 'income')
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  const grandTotal = categories.reduce((s, c) => s + c.total, 0);

  const chartData = useMemo(() => ({
    labels: categories.map((c) => c.category),
    datasets: [
      {
        data: categories.map((c) => c.total),
        backgroundColor: categories.map((_, i) => COLORS[i % COLORS.length]),
        borderColor: '#fff',
        borderWidth: 3,
        hoverBorderWidth: 3,
        hoverOffset: 6,
      },
    ],
  }), [categories]);

  const handleChartClick = useCallback(
    (event, elements) => {
      if (elements && elements.length > 0) {
        setSelected(categories[elements[0].index].category);
      }
    },
    [categories]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      onClick: handleChartClick,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: { size: 11 },
            padding: 14,
            usePointStyle: true,
            pointStyleWidth: 10,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed;
              const pct = grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(1) : '0.0';
              return `  ${fmt(val)}  (${pct}%)`;
            },
          },
        },
      },
    }),
    [handleChartClick, grandTotal]
  );

  // Transactions for the selected category
  const drilldownTxns = useMemo(
    () => (selected ? transactions.filter((t) => t.category === selected) : []),
    [selected, transactions]
  );

  return (
    <div className="space-y-6">
      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <svg className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm">No spending transactions found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-6 items-start">
          {/* Left: summary table (3/5 width) */}
          <div className="col-span-3">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Category</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Net (Paid − Received)</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">% of Total</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600"># Txns</th>
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
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: COLORS[i % COLORS.length] }}
                            />
                            <span className="font-medium text-gray-900 group-hover:text-blue-700">
                              {c.category}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-800">
                          <span className="font-medium">{fmt(c.total)}</span>
                          {c.received > 0 && (
                            <span className="block text-xs text-gray-400 font-normal">
                              {fmt(c.paid)} − <span className="text-emerald-600">{fmt(c.received)}</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">{pct}%</td>
                        <td className="px-4 py-3 text-right text-gray-600">{c.count.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals row */}
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-gray-700">Net Total</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">
                      {fmt(grandTotal)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">100%</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">
                      {categories.reduce((s, c) => s + c.count, 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2">Click any row or chart slice to drill down.</p>
          </div>

          {/* Right: donut chart (2/5 width) */}
          <div className="col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="h-72">
                <Doughnut ref={chartRef} data={chartData} options={chartOptions} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drilldown modal */}
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
