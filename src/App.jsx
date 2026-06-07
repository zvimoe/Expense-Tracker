import React, { useState, useMemo, useEffect, useRef } from 'react';
import YearSelector from './components/YearSelector.jsx';
import VendorTable from './components/VendorTable.jsx';
import CategorySummary from './components/CategorySummary.jsx';
import TransactionTable from './components/TransactionTable.jsx';
import VendorMappingEditor from './components/VendorMappingEditor.jsx';
import YearFilesEditor from './components/YearFilesEditor.jsx';
import { parseCSV, mergeAndSort } from './utils/parseCSV.js';
import { applyMappings } from './utils/vendorMapping.js';

const TABS = [
  { id: 0, label: 'Vendors' },
  { id: 1, label: 'Categories' },
  { id: 2, label: 'All Transactions' },
];

export default function App() {
  const [selectedYear,     setSelectedYear]     = useState(null);
  const [rawTransactions,  setRawTransactions]  = useState(null);
  const [mappings,         setMappings]         = useState([]);
  const [activeTab,        setActiveTab]        = useState(0);
  const [showMappings,     setShowMappings]     = useState(false);
  const [showFilesEditor,  setShowFilesEditor]  = useState(false);
  const [yearInfo,         setYearInfo]         = useState(null);
  const [loadError,        setLoadError]        = useState(null);
  const [loadingYear,      setLoadingYear]      = useState(false);

  const mappingsInitialized = useRef(false);

  // Derived: raw transactions with all mapping rules applied
  const transactions = useMemo(
    () => rawTransactions ? applyMappings(rawTransactions, mappings) : null,
    [rawTransactions, mappings]
  );

  // Auto-save mappings whenever they change (but not on first render)
  useEffect(() => {
    if (!selectedYear) return;
    if (!mappingsInitialized.current) { mappingsInitialized.current = true; return; }
    window.electronAPI.saveMappings(selectedYear, mappings).catch(() => {});
  }, [mappings, selectedYear]);

  // Load a year's data from disk
  const handleSelectYear = async (year) => {
    setLoadError(null);
    setLoadingYear(true);
    mappingsInitialized.current = false;

    try {
      const {
        bankContent, creditContent,
        ilBankContent, ilCreditContent,
        mappings: savedMappings,
      } = await window.electronAPI.loadYear(year);

      const [bankTxns, creditTxns, ilBankTxns, ilCreditTxns] = await Promise.all([
        bankContent     ? parseCSV(bankContent,     'bank')      : [],
        creditContent   ? parseCSV(creditContent,   'credit')    : [],
        ilBankContent   ? parseCSV(ilBankContent,   'il-bank')   : [],
        ilCreditContent ? parseCSV(ilCreditContent, 'il-credit') : [],
      ]);
      const merged = mergeAndSort(bankTxns, creditTxns, ilBankTxns, ilCreditTxns);

      // Refresh year info for the files editor
      const list = await window.electronAPI.listYears();
      setYearInfo(list.find((y) => y.year === String(year)) || { year: String(year) });

      setSelectedYear(String(year));
      setRawTransactions(merged);
      setMappings(savedMappings || []);
      setActiveTab(0);
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
    setLoadError(null);
    mappingsInitialized.current = false;
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
          <VendorTable
            transactions={transactions}
            mappings={mappings}
            onMappingsChange={setMappings}
          />
        )}
        {activeTab === 1 && (
          <CategorySummary
            transactions={transactions}
            mappings={mappings}
            onMappingsChange={setMappings}
          />
        )}
        {activeTab === 2 && <TransactionTable transactions={transactions} />}
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

      {showFilesEditor && yearInfo && (
        <YearFilesEditor
          year={selectedYear}
          yearInfo={yearInfo}
          onClose={() => setShowFilesEditor(false)}
          onUpdated={handleFilesUpdated}
        />
      )}
    </div>
  );
}
