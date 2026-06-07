import React, { useState, useMemo } from 'react';

const SOURCE_LABELS = {
  'bank':      { label: 'US Bank',   cls: 'bg-blue-100 text-blue-700' },
  'credit':    { label: 'US Credit', cls: 'bg-violet-100 text-violet-700' },
  'il-bank':   { label: 'IL Bank',   cls: 'bg-amber-100 text-amber-700' },
  'il-credit': { label: 'IL Credit', cls: 'bg-rose-100 text-rose-700' },
};

function SourceBadge({ source }) {
  const s = SOURCE_LABELS[source] ?? { label: source, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  );
}

const PAGE_SIZE = 50;

const CURRENCY_SYMBOL = { USD: '$', ILS: '₪' };

const fmt = (n, currency = 'USD') => {
  const sym = CURRENCY_SYMBOL[currency] ?? '$';
  return sym + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const EMPTY_FILTERS = {
  vendor:    '',
  dateFrom:  '',
  dateTo:    '',
  category:  '',
  source:    'all',
  minAmount: '',
  maxAmount: '',
};

export default function TransactionTable({ transactions }) {
  const [page,    setPage]    = useState(1);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const setFilter = (key, val) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  // Collect unique categories for dropdown
  const categories = useMemo(() => {
    const s = new Set(transactions.map((t) => t.category));
    return Array.from(s).sort();
  }, [transactions]);

  // Apply filters
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filters.vendor && !t.vendor.toLowerCase().includes(filters.vendor.toLowerCase())) return false;
      // Date range — compare ISO strings when both dates are valid
      if (filters.dateFrom) {
        const txDate   = new Date(t.date);
        const fromDate = new Date(filters.dateFrom);
        if (!isNaN(txDate) && !isNaN(fromDate) && txDate < fromDate) return false;
      }
      if (filters.dateTo) {
        const txDate = new Date(t.date);
        const toDate = new Date(filters.dateTo);
        if (!isNaN(txDate) && !isNaN(toDate) && txDate > toDate) return false;
      }
      if (filters.category && t.category !== filters.category) return false;
      if (filters.source !== 'all' && t.source !== filters.source)  return false;
      if (filters.minAmount !== '') {
        const min = parseFloat(filters.minAmount);
        if (!isNaN(min) && t.amount < min) return false;
      }
      if (filters.maxAmount !== '') {
        const max = parseFloat(filters.maxAmount);
        if (!isNaN(max) && t.amount > max) return false;
      }
      return true;
    });
  }, [transactions, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageData   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const isFiltered = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  // Net sum of all filtered transactions (already in USD after conversion)
  const filteredSum = useMemo(
    () => filtered.reduce((s, t) => s + (t.amount || 0), 0),
    [filtered]
  );

  return (
    <div className="space-y-4">
      {/* ── Filter Bar ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Vendor search */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Vendor</label>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
              </svg>
              <input
                type="text"
                placeholder="Search vendor…"
                value={filters.vendor}
                onChange={(e) => setFilter('vendor', e.target.value)}
                className="pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-48"
              />
            </div>
          </div>

          {/* Date range */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilter('dateFrom', e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilter('dateTo', e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilter('category', e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white pr-8"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Source toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Source</label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
              {[
                { value: 'all',       label: 'All' },
                { value: 'bank',      label: 'US Bank' },
                { value: 'credit',    label: 'US Credit' },
                { value: 'il-bank',   label: 'IL Bank' },
                { value: 'il-credit', label: 'IL Credit' },
              ].map((s) => (
                <button
                  key={s.value}
                  onClick={() => setFilter('source', s.value)}
                  className={`px-3 py-2 transition-colors whitespace-nowrap ${
                    filters.source === s.value
                      ? 'bg-blue-600 text-white font-medium'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount range */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Min $</label>
            <input
              type="number"
              placeholder="—"
              value={filters.minAmount}
              onChange={(e) => setFilter('minAmount', e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg w-24 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Max $</label>
            <input
              type="number"
              placeholder="—"
              value={filters.maxAmount}
              onChange={(e) => setFilter('maxAmount', e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg w-24 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {isFiltered && (
            <button
              onClick={resetFilters}
              className="py-2 px-3 text-sm text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Row count + sum */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-3">
          <span>
            {filtered.length.toLocaleString()} transaction{filtered.length !== 1 ? 's' : ''}
            {isFiltered && (
              <span className="ml-1 text-blue-500">
                (filtered from {transactions.length.toLocaleString()})
              </span>
            )}
          </span>
          <span className="text-gray-300">|</span>
          <span>
            Net:{' '}
            <span className={`font-semibold ${filteredSum < 0 ? 'text-emerald-600' : 'text-gray-700'}`}>
              {filteredSum < 0 ? '+' : ''}{fmt(Math.abs(filteredSum))}
            </span>
          </span>
        </span>
        {totalPages > 1 && (
          <span>Page {safePage} / {totalPages}</span>
        )}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Vendor</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Category</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Amount</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">
                    No transactions match your filters.
                  </td>
                </tr>
              ) : (
                pageData.map((t, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{t.date || '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate" title={t.vendor}>
                      {t.vendor}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="inline-block max-w-[140px] truncate" title={t.category}>
                        {t.category}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-medium whitespace-nowrap ${
                          t.amount < 0 ? 'text-emerald-600' : 'text-gray-900'
                        }`}
                      title={
                        t.amountLocal != null
                          ? `Original: ₪${Math.abs(t.amountLocal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : undefined
                      }
                      >
                        {t.amount < 0 ? '+' : ''}{fmt(Math.abs(t.amount), 'USD')}
                        {t.amountLocal != null && (
                          <span className="ml-1 text-xs text-gray-400 font-normal">
                            (₪{Math.abs(t.amountLocal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                          </span>
                        )}
                    </td>
                    <td className="px-4 py-3">
                      <SourceBadge source={t.source} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>

          {/* Page number pills */}
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p;
              if (totalPages <= 7) {
                p = i + 1;
              } else if (safePage <= 4) {
                p = i < 6 ? i + 1 : totalPages;
              } else if (safePage >= totalPages - 3) {
                p = i === 0 ? 1 : totalPages - 5 + i;
              } else {
                const offset = [-3, -2, -1, 0, 1, 2, 3][i];
                p = i === 0 ? 1 : i === 6 ? totalPages : safePage + offset;
              }
              return (
                <button
                  key={i}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                    safePage === p
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
