import React, { useState, useMemo, useEffect, useRef } from 'react';
import YearSelector from './components/YearSelector.jsx';
import VendorTable from './components/VendorTable.jsx';
import CategorySummary from './components/CategorySummary.jsx';
import MonthlyBoard from './components/MonthlyBoard.jsx';
import TransactionTable from './components/TransactionTable.jsx';
import VendorMappingEditor from './components/VendorMappingEditor.jsx';
import YearFilesEditor from './components/YearFilesEditor.jsx';
import TransactionOverrideEditor from './components/TransactionOverrideEditor.jsx';
import { parseCSV, mergeSourceFiles } from './utils/parseCSV.js';
import { SOURCE_TYPES } from './utils/sources.js';
import { applyMappings, applyTransactionOverrides } from './utils/vendorMapping.js';

const TABS = [
  { id: 0, label: 'Overview' },
  { id: 1, label: 'Monthly' },
  { id: 2, label: 'Vendors' },
  { id: 3, label: 'All Transactions' },
];

const TAB_TRANSACTIONS = 3;

/**
 * Load one year from disk and return it fully resolved: parsed, merged, with
 * that year's own mapping rules and transaction overrides applied. Used for
 * the comparison year, which is read-only and so needs no state of its own.
 */
async function loadResolvedYear(year) {
  const { sourceFiles, mappings, transactionOverrides } = await window.electronAPI.loadYear(year);
  const { transactions } = await parseYearFiles(sourceFiles);

  return applyTransactionOverrides(
    applyMappings(transactions, mappings || []),
    transactionOverrides || []
  );
}

/**
 * Parse every imported file of every source and merge them into one list.
 * A source can hold many files — one per account, or one per month — so each
 * is parsed on its own and duplicates between overlapping exports are dropped.
 */
async function parseYearFiles(sourceFiles) {
  const files = [];

  for (const type of SOURCE_TYPES) {
    for (const file of sourceFiles?.[type] ?? []) {
      if (!file.content) continue;
      files.push({
        name:         `${type}/${file.name}`,
        transactions: await parseCSV(file.content, type),
      });
    }
  }

  return mergeSourceFiles(files);
}

export default function App() {
  const [selectedYear,     setSelectedYear]     = useState(null);
  const [rawTransactions,  setRawTransactions]  = useState(null);
  const [mappings,         setMappings]         = useState([]);
  const [transactionOverrides, setTransactionOverrides] = useState([]);
  const [activeTab,        setActiveTab]        = useState(0);
  const [showMappings,     setShowMappings]     = useState(false);
  const [showFilesEditor,  setShowFilesEditor]  = useState(false);
  const [showTransactionOverrides, setShowTransactionOverrides] = useState(false);
  const [transactionOverrideTarget, setTransactionOverrideTarget] = useState(null);
  const [yearInfo,         setYearInfo]         = useState(null);
  const [loadError,        setLoadError]        = useState(null);
  const [loadingYear,      setLoadingYear]      = useState(false);
  const [priorTransactions, setPriorTransactions] = useState(null);
  const [drilldownFilters,  setDrilldownFilters]  = useState(null);
  // How the year's files came together: file count, rows kept, duplicates dropped
  const [mergeInfo,         setMergeInfo]         = useState(null);
  // Set when a background save fails, so it is never lost silently
  const [saveError,         setSaveError]         = useState(null);

  const mappingsInitialized = useRef(false);
  const overridesInitialized = useRef(false);

  // Derived: raw transactions with mapping rules and transaction-only overrides applied
  const transactions = useMemo(
    () => rawTransactions
      ? applyTransactionOverrides(applyMappings(rawTransactions, mappings), transactionOverrides)
      : null,
    [rawTransactions, mappings, transactionOverrides]
  );

  // Auto-save mappings whenever they change (but not on first render)
  useEffect(() => {
    if (!selectedYear) return;
    if (!mappingsInitialized.current) { mappingsInitialized.current = true; return; }
    window.electronAPI.saveMappings(selectedYear, mappings)
      .then(() => setSaveError(null))
      .catch((err) => setSaveError(`Could not save your category rules: ${err.message}`));
  }, [mappings, selectedYear]);

  useEffect(() => {
    if (!selectedYear) return;
    if (!overridesInitialized.current) { overridesInitialized.current = true; return; }
    window.electronAPI.saveTransactionOverrides(selectedYear, transactionOverrides)
      .then(() => setSaveError(null))
      .catch((err) => setSaveError(`Could not save your transaction changes: ${err.message}`));
  }, [transactionOverrides, selectedYear]);

  // Load a year's data from disk
  const handleSelectYear = async (year) => {
    setLoadError(null);
    setLoadingYear(true);
    mappingsInitialized.current = false;
    overridesInitialized.current = false;

    try {
      const {
        sourceFiles,
        mappings: savedMappings,
        transactionOverrides: savedTransactionOverrides,
      } = await window.electronAPI.loadYear(year);

      const { transactions: merged, duplicates } = await parseYearFiles(sourceFiles);
      setMergeInfo({
        files: SOURCE_TYPES.reduce((n, t) => n + (sourceFiles?.[t]?.length ?? 0), 0),
        transactions: merged.length,
        duplicates,
      });

      // Refresh year info for the files editor
      const list = await window.electronAPI.listYears();
      setYearInfo(list.find((y) => y.year === String(year)) || { year: String(year) });

      setSelectedYear(String(year));
      setRawTransactions(merged);
      setMappings(savedMappings || []);
      setTransactionOverrides(savedTransactionOverrides || []);
      setActiveTab(0);
      setDrilldownFilters(null);

      // Best-effort: load the previous year for the Monthly comparison.
      // Its absence is normal, so a failure here must not fail the whole load.
      const prior = String(Number(year) - 1);
      if (list.some((y) => y.year === prior)) {
        try {
          setPriorTransactions(await loadResolvedYear(prior));
        } catch {
          setPriorTransactions(null);
        }
      } else {
        setPriorTransactions(null);
      }
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoadingYear(false);
    }
  };

  const handleReset = () => {
    setSelectedYear(null);
    setRawTransactions(null);
    setMappings([]);
    setTransactionOverrides([]);
    setPriorTransactions(null);
    setDrilldownFilters(null);
    setShowTransactionOverrides(false);
    setTransactionOverrideTarget(null);
    setLoadError(null);
    mappingsInitialized.current = false;
    overridesInitialized.current = false;
  };

  // Jump from the Monthly board to the filtered transaction list.
  // A new object identity each time is what signals the table to re-apply.
  const handleDrilldown = (filters) => {
    setDrilldownFilters({ ...filters });
    setActiveTab(TAB_TRANSACTIONS);
  };

  const handleOpenTransactionOverrides = () => {
    setTransactionOverrideTarget(transactions?.[0] || null);
    setShowTransactionOverrides(true);
  };

  // After editing files in the year editor, reload the year data
  const handleFilesUpdated = async () => {
    if (selectedYear) await handleSelectYear(selectedYear);
  };

  // ── Loading screen ───────────────────────────────────────────────────────
  if (loadingYear) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="w-6 h-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span className="text-sm font-medium">Loading {selectedYear || ''}…</span>
        </div>
      </div>
    );
  }

  // ── Year selector ────────────────────────────────────────────────────────
  if (!rawTransactions) {
    return (
      <>
        <YearSelector onSelectYear={handleSelectYear} />
        {loadError && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
            {loadError}
          </div>
        )}
      </>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">

      {/* A failed save must never pass unnoticed — this work is typed by hand */}
      {saveError && (
        <div className="bg-red-600 text-white text-sm px-6 py-2 flex items-center justify-between flex-shrink-0">
          <span>⚠ {saveError}</span>
          <button onClick={() => setSaveError(null)} className="underline text-xs">Dismiss</button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-base font-semibold text-gray-900">Expense Tracker</h1>
          {/* Year badge */}
          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-lg">
            {selectedYear}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-md">
            {transactions.length.toLocaleString()} transactions
          </span>

          {/* Edit year files */}
          <button
            onClick={() => setShowFilesEditor(true)}
            title="Edit files for this year"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            Edit Files
          </button>

          {/* Transaction overrides */}
          <button
            onClick={handleOpenTransactionOverrides}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600 relative"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Transaction Overrides
            {transactionOverrides.length > 0 && (
              <span className="ml-0.5 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {transactionOverrides.length}
              </span>
            )}
          </button>

          {/* Vendor mappings */}
          <button
            onClick={() => setShowMappings(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600 relative"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
            </svg>
            Vendor Mappings
            {mappings.length > 0 && (
              <span className="ml-0.5 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {mappings.length}
              </span>
            )}
          </button>

          {/* Back to year selector */}
          <button
            onClick={handleReset}
            className="text-xs text-gray-500 hover:text-blue-600 transition-colors"
          >
            ← Years
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6 flex-shrink-0">
        <nav className="flex space-x-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        {activeTab === 0 && (
          <CategorySummary
            transactions={transactions}
            mappings={mappings}
            onMappingsChange={setMappings}
            year={selectedYear}
          />
        )}
        {activeTab === 1 && (
          <MonthlyBoard
            transactions={transactions}
            priorTransactions={priorTransactions}
            year={selectedYear}
            priorYear={String(Number(selectedYear) - 1)}
            onDrilldown={handleDrilldown}
          />
        )}
        {activeTab === 2 && (
          <VendorTable
            transactions={transactions}
            mappings={mappings}
            onMappingsChange={setMappings}
          />
        )}
        {activeTab === TAB_TRANSACTIONS && (
          <TransactionTable
            transactions={transactions}
            mappings={mappings}
            onMappingsChange={setMappings}
            transactionOverrides={transactionOverrides}
            onTransactionOverridesChange={setTransactionOverrides}
            incomingFilters={drilldownFilters}
          />
        )}
      </main>

      {/* Modals */}
      {showMappings && (
        <VendorMappingEditor
          mappings={mappings}
          onMappingsChange={setMappings}
          rawTransactions={rawTransactions}
          onClose={() => setShowMappings(false)}
        />
      )}

      {showTransactionOverrides && (
        <TransactionOverrideEditor
          transactions={transactions || []}
          overrides={transactionOverrides}
          onOverridesChange={setTransactionOverrides}
          onClose={() => {
            setShowTransactionOverrides(false);
            setTransactionOverrideTarget(null);
          }}
          initialTransaction={transactionOverrideTarget}
        />
      )}

      {showFilesEditor && yearInfo && (
        <YearFilesEditor
          year={selectedYear}
          yearInfo={yearInfo}
          onClose={() => setShowFilesEditor(false)}
          onUpdated={handleFilesUpdated}
          mergeInfo={mergeInfo}
        />
      )}
    </div>
  );
}
