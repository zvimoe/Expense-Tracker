import React, { useState, useMemo, useRef, useEffect } from 'react';

const fmt = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

function SortIcon({ active, dir }) {
  if (!active) return <span className="ml-1 text-gray-300 text-xs">↕</span>;
  return <span className="ml-1 text-blue-500 text-xs">{dir === 'asc' ? '↑' : '↓'}</span>;
}

function exportVendorsCSV(rows) {
  const header = ['Vendor', 'Net', 'Total Paid', 'Total Received', 'Transactions', 'Source'];
  const lines  = rows.map((r) => [
    `"${r.vendor.replace(/"/g, '""')}"`,
    r.net.toFixed(2),
    r.totalPaid.toFixed(2),
    r.totalReceived.toFixed(2),
    r.count,
    r.source,
  ]);
  const csv = [header, ...lines].map((l) => l.join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'vendor-summary.csv' });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ── Inline category editor ─────────────────────────────────────────────── */
function CategoryEditor({ vendor, allCategories, onSave, onClose }) {
  // Start empty so the user can type immediately without clearing existing text
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const save = () => {
    const cat = value.trim();
    if (cat) onSave(cat);
    onClose();
  };

  const listId = `cat-${vendor.replace(/\W/g, '_')}`;

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <datalist id={listId}>
        {allCategories.map((c) => <option key={c} value={c} />)}
      </datalist>
      <input
        ref={inputRef}
        list={listId}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
        placeholder="Type or pick a category…"
        className="text-xs border border-blue-400 rounded px-2 py-1 w-44 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <button onClick={save} title="Save"
        className="text-emerald-600 hover:text-emerald-700 p-1 rounded hover:bg-emerald-50">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </button>
      <button onClick={onClose} title="Cancel"
        className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export default function VendorTable({ transactions, mappings = [], onMappingsChange }) {
  const [search,     setSearch]     = useState('');
  const [sortCol,    setSortCol]    = useState('net');
  const [sortDir,    setSortDir]    = useState('desc');
  const [editingKey, setEditingKey] = useState(null);

  // All known categories for datalist suggestions
  const allCategories = useMemo(() => {
    const s = new Set(transactions.map((t) => t.category).filter(Boolean));
    for (const m of mappings) { if (m.categoryOverride) s.add(m.categoryOverride); }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [transactions, mappings]);

  // Save a category override for a vendor
  const saveCategory = (vendorName, category) => {
    if (!onMappingsChange) return;
    const lower = vendorName.toLowerCase();
    const idx   = mappings.findIndex((m) => m.vendor.toLowerCase() === lower);
    if (idx >= 0) {
      onMappingsChange(mappings.map((m, i) => i === idx ? { ...m, categoryOverride: category } : m));
    } else {
      onMappingsChange([...mappings, { vendor: vendorName, mappedVendor: '', categoryOverride: category }]);
    }
  };

  // Aggregate by vendor
  const vendors = useMemo(() => {
    const map = new Map();
    for (const t of transactions) {
      const key = t.vendor.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { vendor: t.vendor, totalPaid: 0, totalReceived: 0, count: 0, sources: new Set() });
      }
      const e = map.get(key);
      if (t.amount >= 0) e.totalPaid     += t.amount;
      else               e.totalReceived += Math.abs(t.amount);
      e.count++;
      e.sources.add(t.source);
    }
    return Array.from(map.values()).map((v) => ({
      ...v,
      net: v.totalPaid - v.totalReceived,
      source: v.sources.size > 1 ? 'Both' : v.sources.has('bank') ? 'Bank' : 'Credit',
    }));
  }, [transactions]);

  const filtered = useMemo(
    () => vendors.filter((v) => v.vendor.toLowerCase().includes(search.toLowerCase())),
    [vendors, search]
  );

  const sorted = useMemo(() => {
    const mult = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortCol === 'vendor') return mult * a.vendor.localeCompare(b.vendor);
      if (sortCol === 'source') return mult * a.source.localeCompare(b.source);
      return mult * (a[sortCol] - b[sortCol]);
    });
  }, [filtered, sortCol, sortDir]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('desc'); }
  };

  const colDefs = [
    { key: 'vendor',        label: 'Vendor',         align: 'left'  },
    { key: 'category',      label: 'Category',       align: 'left',  noSort: true },
    { key: 'net',           label: 'Net',            align: 'right' },
    { key: 'totalPaid',     label: 'Paid',           align: 'right' },
    { key: 'totalReceived', label: 'Received',       align: 'right' },
    { key: 'count',         label: '# Transactions', align: 'right' },
    { key: 'source',        label: 'Source',         align: 'left'  },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search vendors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-72 bg-white"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {sorted.length.toLocaleString()} vendor{sorted.length !== 1 ? 's' : ''}
          </span>
          <button onClick={() => exportVendorsCSV(sorted)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {colDefs.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => !col.noSort && toggleSort(col.key)}
                    className={`px-4 py-3 font-semibold text-gray-600 text-${col.align} select-none transition-colors ${
                      col.noSort ? '' : 'cursor-pointer hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {col.label}
                    {!col.noSort && <SortIcon active={sortCol === col.key} dir={sortDir} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                    No vendors match your search.
                  </td>
                </tr>
              ) : (
                sorted.map((v, i) => {
                  const key      = v.vendor.toLowerCase();
                  const mapping  = mappings.find((m) => m.vendor.toLowerCase() === key);
                  const catLabel = mapping?.categoryOverride
                    || transactions.find((t) => t.vendor.toLowerCase() === key)?.category
                    || '';
                  const isEditing = editingKey === key;

                  return (
                    <tr key={i} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                        {v.vendor}
                      </td>

                      {/* Category cell */}
                      <td className="px-4 py-2 min-w-[180px]">
                        {isEditing ? (
                          <CategoryEditor
                            vendor={v.vendor}
                            allCategories={allCategories}
                            onSave={(cat) => saveCategory(v.vendor, cat)}
                            onClose={() => setEditingKey(null)}
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 truncate max-w-[130px]" title={catLabel}>
                              {catLabel || '—'}
                            </span>
                            {onMappingsChange && (
                              <button
                                onClick={() => setEditingKey(key)}
                                title="Set category"
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 flex-shrink-0"
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

                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${v.net <= 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                        {v.net <= 0 ? '+' : ''}{fmt(Math.abs(v.net))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500 text-xs">
                        {fmt(v.totalPaid)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600 text-xs">
                        {v.totalReceived > 0 ? fmt(v.totalReceived) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {v.count.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <SourceBadge source={v.source} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SourceBadge({ source }) {
  const styles = {
    Bank:   'bg-blue-100 text-blue-700',
    Credit: 'bg-violet-100 text-violet-700',
    Both:   'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[source] ?? styles.Both}`}>
      {source}
    </span>
  );
}
