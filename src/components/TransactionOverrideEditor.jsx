import React, { useEffect, useMemo, useState } from 'react';
import { makeTransactionKey } from '../utils/vendorMapping.js';

function formatTransactionLabel(transaction) {
  const parts = [transaction?.date || '—', transaction?.vendor || '—'];
  if (transaction?.amount != null) parts.push(`${transaction.amount >= 0 ? '+' : ''}${transaction.amount}`);
  return parts.join(' • ');
}

function OverrideForm({
  transactions,
  overrides,
  onSave,
  onCancel,
  onDelete,
  initialEntry = null,
  initialTransaction = null,
}) {
  const transactionOptions = useMemo(() =>
    transactions.map((transaction) => ({
      key: makeTransactionKey(transaction),
      transaction,
      label: formatTransactionLabel(transaction),
    })),
    [transactions]
  );

  const [selectedKey, setSelectedKey] = useState('');
  const [vendorOverride, setVendorOverride] = useState('');
  const [categoryOverride, setCategoryOverride] = useState('');

  useEffect(() => {
    if (!transactionOptions.length) {
      setSelectedKey('');
      setVendorOverride('');
      setCategoryOverride('');
      return;
    }

    const defaultKey = initialEntry?.transactionKey || (initialTransaction ? makeTransactionKey(initialTransaction) : transactionOptions[0].key);
    const existing = overrides.find((entry) => entry.transactionKey === defaultKey);
    setSelectedKey(defaultKey);
    setVendorOverride(existing?.vendorOverride || initialEntry?.vendorOverride || '');
    setCategoryOverride(existing?.categoryOverride || initialEntry?.categoryOverride || '');
  }, [initialEntry, initialTransaction, overrides, transactionOptions]);

  const selectedTransaction = useMemo(() => {
    return transactionOptions.find((option) => option.key === selectedKey)?.transaction || initialTransaction || null;
  }, [initialTransaction, selectedKey, transactionOptions]);

  const existingOverride = useMemo(() => {
    if (!selectedKey) return null;
    return overrides.find((entry) => entry.transactionKey === selectedKey) || null;
  }, [overrides, selectedKey]);

  const handleSelect = (key) => {
    const option = transactionOptions.find((item) => item.key === key);
    const existing = overrides.find((entry) => entry.transactionKey === key);
    setSelectedKey(key);
    setVendorOverride(existing?.vendorOverride || option?.transaction?.vendor || '');
    setCategoryOverride(existing?.categoryOverride || option?.transaction?.category || '');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!selectedTransaction) return;

    const nextValue = (vendorOverride || '').trim();
    const nextCategory = (categoryOverride || '').trim();
    if (!nextValue && !nextCategory) {
      onDelete(selectedKey);
      return;
    }

    onSave({
      transactionKey: selectedKey,
      vendorOverride: nextValue,
      categoryOverride: nextCategory,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Transaction</label>
        <select
          value={selectedKey}
          onChange={(event) => handleSelect(event.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {transactionOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {selectedTransaction && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 space-y-1">
          <div><span className="font-semibold text-gray-700">Date:</span> {selectedTransaction.date || '—'}</div>
          <div><span className="font-semibold text-gray-700">Source:</span> {selectedTransaction.source || '—'}</div>
          <div><span className="font-semibold text-gray-700">Current vendor:</span> {selectedTransaction.vendor || '—'}</div>
          <div><span className="font-semibold text-gray-700">Current category:</span> {selectedTransaction.category || '—'}</div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Vendor override</label>
        <input
          value={vendorOverride}
          onChange={(event) => setVendorOverride(event.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          placeholder="Optional"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Category override</label>
        <input
          value={categoryOverride}
          onChange={(event) => setCategoryOverride(event.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          placeholder="Optional"
        />
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => onDelete(selectedKey)}
          disabled={!existingOverride}
          className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Remove override
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button type="submit" className="px-3 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            Save override
          </button>
        </div>
      </div>
    </form>
  );
}

export default function TransactionOverrideEditor({
  transactions = [],
  overrides = [],
  onOverridesChange,
  onClose,
  initialTransaction = null,
}) {
  const [search, setSearch] = useState('');
  const [editingEntry, setEditingEntry] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const transactionOptions = useMemo(() =>
    transactions.map((transaction) => ({
      key: makeTransactionKey(transaction),
      transaction,
      label: formatTransactionLabel(transaction),
    })),
    [transactions]
  );

  const byKey = useMemo(() => new Map(transactionOptions.map((option) => [option.key, option.transaction])), [transactionOptions]);

  const visibleOverrides = useMemo(() => {
    const query = search.toLowerCase();
    return overrides.filter((entry) => {
      const transaction = byKey.get(entry.transactionKey);
      const haystack = [
        entry.transactionKey,
        transaction?.vendor,
        transaction?.category,
        transaction?.date,
        transaction?.source,
        entry.vendorOverride,
        entry.categoryOverride,
      ].filter(Boolean).join(' ').toLowerCase();
      return !query || haystack.includes(query);
    });
  }, [byKey, overrides, search]);

  const handleSaveEntry = (entry) => {
    if (!onOverridesChange) return;
    const nextEntries = [...overrides];
    const existingIndex = nextEntries.findIndex((item) => item.transactionKey === entry.transactionKey);
    if (existingIndex >= 0) nextEntries[existingIndex] = entry;
    else nextEntries.push(entry);
    onOverridesChange(nextEntries);
    setEditingEntry(null);
  };

  const handleDeleteEntry = (transactionKey) => {
    if (!onOverridesChange) return;
    const nextEntries = overrides.filter((entry) => entry.transactionKey !== transactionKey);
    onOverridesChange(nextEntries);
    setEditingEntry(null);
  };

  const openNewEntry = () => {
    const firstTransaction = transactionOptions[0]?.transaction || null;
    setEditingEntry({
      transactionKey: firstTransaction ? makeTransactionKey(firstTransaction) : '',
      vendorOverride: '',
      categoryOverride: '',
    });
  };

  const openExistingEntry = (entry) => {
    setEditingEntry(entry);
  };

  const handleExportJSON = async () => {
    try {
      const ok = await window.electronAPI.saveFile(JSON.stringify(overrides, null, 2), 'transaction-overrides.json');
      if (ok) setFeedback('Exported transaction overrides to JSON.');
      else setFeedback('Export cancelled.');
    } catch (error) {
      setFeedback(`Export failed: ${error.message}`);
    }
  };

  const handleImportJSON = async () => {
    try {
      const result = await window.electronAPI.openFile();
      if (!result?.content) return;
      const parsed = JSON.parse(result.content);
      if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of overrides.');
      const normalized = parsed.filter((entry) => entry && typeof entry === 'object' && entry.transactionKey);
      onOverridesChange(normalized);
      setFeedback(`Imported ${normalized.length} transaction override${normalized.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setFeedback(`Import failed: ${error.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 px-4" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Transaction overrides</h3>
            <p className="mt-1 text-xs text-gray-500">
              Search existing overrides and add one-off transaction changes without affecting other rows with the same vendor.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleImportJSON} className="px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Import JSON
            </button>
            <button type="button" onClick={handleExportJSON} className="px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Export JSON
            </button>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {feedback && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              {feedback}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search overrides…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <button
              type="button"
              onClick={openNewEntry}
              className="px-3 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Add override
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            {visibleOverrides.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400">
                No overrides yet. Add one to create a transaction-specific change.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {visibleOverrides.map((entry) => {
                  const transaction = byKey.get(entry.transactionKey);
                  return (
                    <div key={entry.transactionKey} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {transaction?.vendor || entry.transactionKey}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                          <div>{transaction?.date || '—'} • {transaction?.source || '—'}</div>
                          <div>
                            {entry.vendorOverride ? <span className="text-blue-600">Vendor: {entry.vendorOverride}</span> : <span>Vendor: keep original</span>}
                            {entry.categoryOverride ? <span className="ml-3 text-emerald-600">Category: {entry.categoryOverride}</span> : <span className="ml-3">Category: keep original</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button type="button" onClick={() => openExistingEntry(entry)} className="px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDeleteEntry(entry.transactionKey)} className="px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {editingEntry && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4" onClick={() => setEditingEntry(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl border border-gray-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{editingEntry.transactionKey ? 'Edit override' : 'Add override'}</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Choose a transaction and set a one-off vendor or category change.
                </p>
              </div>
              <button type="button" onClick={() => setEditingEntry(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="mt-4">
              <OverrideForm
                transactions={transactions}
                overrides={overrides}
                initialEntry={editingEntry.transactionKey ? editingEntry : null}
                initialTransaction={initialTransaction}
                onSave={handleSaveEntry}
                onCancel={() => setEditingEntry(null)}
                onDelete={handleDeleteEntry}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
