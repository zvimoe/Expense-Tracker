import React, { useState, useEffect, useCallback } from 'react';
import YearFilesEditor from './YearFilesEditor.jsx';

function FileStatus({ label, icon, present }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${present ? 'text-emerald-600' : 'text-gray-300'}`}>
      <span>{icon}</span>
      <span>{label}</span>
      {present
        ? <svg className="w-3 h-3 ml-auto" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
        : <span className="ml-auto text-gray-200">—</span>
      }
    </div>
  );
}

function YearCard({ info, selected, onSelect, onEdit }) {
  const canOpen = info.hasBank || info.hasCredit;

  return (
    <div
      onClick={() => canOpen && onSelect(info.year)}
      className={`relative rounded-2xl border-2 p-5 transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : canOpen
          ? 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm cursor-pointer'
          : 'border-dashed border-gray-200 bg-gray-50 cursor-default'
      }`}
    >
      {/* Edit button */}
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(info.year); }}
        title="Edit files for this year"
        className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>

      {/* Year number */}
      <div className={`text-4xl font-bold mb-4 ${selected ? 'text-blue-600' : canOpen ? 'text-gray-800' : 'text-gray-300'}`}>
        {info.year}
      </div>

      {/* File presence */}
      <div className="space-y-1.5">
        <FileStatus label="Bank"          icon="🏦" present={info.hasBank} />
        <FileStatus label="Credit Card"   icon="💳" present={info.hasCredit} />
        <FileStatus label="Mappings"      icon="🔀" present={info.hasMappings} />
      </div>

      {/* No-files hint */}
      {!canOpen && (
        <p className="mt-3 text-[10px] text-gray-400 text-center">
          Click ✏ to add files
        </p>
      )}

      {/* Selected indicator */}
      {selected && (
        <div className="mt-3 flex items-center justify-center gap-1 text-xs font-semibold text-blue-600">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          Selected
        </div>
      )}
    </div>
  );
}

function AddYearCard({ onAdd, adding, setAdding }) {
  const [input, setInput] = useState(String(new Date().getFullYear()));

  const submit = () => {
    const y = parseInt(input);
    if (y >= 2000 && y <= 2100) { onAdd(y); setAdding(false); setInput(String(new Date().getFullYear())); }
  };

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="rounded-2xl border-2 border-dashed border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50 transition-all p-5 flex flex-col items-center justify-center gap-3 min-h-[172px] w-full"
      >
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <span className="text-sm font-medium text-gray-400">Add Year</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-blue-400 bg-blue-50 p-5 flex flex-col items-center justify-center gap-3 min-h-[172px]">
      <p className="text-xs font-semibold text-gray-600">Enter year</p>
      <input
        type="number"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false); }}
        autoFocus
        className="w-24 text-center text-2xl font-bold border-b-2 border-blue-400 bg-transparent focus:outline-none text-blue-700"
      />
      <div className="flex gap-2">
        <button onClick={submit} className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Add
        </button>
        <button onClick={() => setAdding(false)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function YearSelector({ onSelectYear }) {
  const [years,       setYears]       = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [editingYear, setEditingYear] = useState(null);
  const [adding,      setAdding]      = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [dataDir,     setDataDir]     = useState('');

  const refresh = useCallback(async () => {
    const [list, dir] = await Promise.all([
      window.electronAPI.listYears(),
      window.electronAPI.getDataDir(),
    ]);
    setYears(list);
    setDataDir(dir);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAdd = async (year) => {
    const info = await window.electronAPI.addYear(year);
    await refresh();
    setEditingYear(String(year)); // immediately open the editor for the new year
  };

  const handleFilesUpdated = () => {
    refresh();
  };

  const selectedInfo = years.find((y) => y.year === selected);
  const canOpen = selectedInfo && (selectedInfo.hasBank || selectedInfo.hasCredit);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center p-8">
      {/* Title */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl shadow-lg mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Finance Dashboard 2025</h1>
        <p className="text-gray-500 text-sm mt-1">Select a year to view your transactions</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <>
          {/* Year grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-3xl">
            {years.map((info) => (
              <YearCard
                key={info.year}
                info={info}
                selected={selected === info.year}
                onSelect={setSelected}
                onEdit={setEditingYear}
              />
            ))}
            <AddYearCard onAdd={handleAdd} adding={adding} setAdding={setAdding} />
          </div>

          {/* Open button */}
          <div className="mt-8">
            <button
              onClick={() => canOpen && onSelectYear(selected)}
              disabled={!canOpen}
              className={`px-10 py-3 rounded-xl text-sm font-semibold transition-all ${
                canOpen
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-[0.98]'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {selected ? `Open ${selected} →` : 'Select a year to continue'}
            </button>
          </div>

          {/* Data folder path */}
          {dataDir && (
            <p className="mt-6 text-[11px] text-gray-400 text-center">
              Data folder: <span className="font-mono">{dataDir}</span>
            </p>
          )}
        </>
      )}

      {/* Year files editor modal */}
      {editingYear && (
        <YearFilesEditor
          year={editingYear}
          yearInfo={years.find((y) => y.year === editingYear) || { year: editingYear, hasBank: false, hasCredit: false, hasMappings: false }}
          onClose={() => setEditingYear(null)}
          onUpdated={handleFilesUpdated}
        />
      )}
    </div>
  );
}
