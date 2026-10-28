import React, { useState, useEffect } from 'react';
import { parseMappingCSV } from '../utils/vendorMapping.js';
import { SOURCES } from '../utils/sources.js';

/**
 * Manages the files behind one year.
 *
 * Each source holds a LIST of files rather than a single one: an Israeli card
 * statement arrives one file per month, and a household can have several bank
 * accounts. Files are kept separately so any one of them can be removed later
 * without re-importing the rest; they are merged when the year loads, and rows
 * that two overlapping exports both contain are counted once.
 */

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
    </svg>
  );
}

export default function YearFilesEditor({ year, yearInfo, onClose, onUpdated, mergeInfo }) {
  const [files,       setFiles]       = useState(yearInfo?.files ?? {});
  const [loading,     setLoading]     = useState(null); // source type currently importing
  const [errors,      setErrors]      = useState({});
  const [results,     setResults]     = useState({});   // type -> summary line
  const [mappingName, setMappingName] = useState(null);

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Always show what is actually on disk
  useEffect(() => {
    window.electronAPI.listSourceFiles(year).then(setFiles).catch(() => {});
  }, [year]);

  const handleAdd = async (type) => {
    setLoading(type);
    setErrors((p)  => ({ ...p, [type]: null }));
    setResults((p) => ({ ...p, [type]: null }));

    try {
      const result = await window.electronAPI.addSourceFiles(year, type);
      if (!result) { setLoading(null); return; }   // picker cancelled

      const { imported, errors: failed, filedElsewhere } = result;

      if (imported.length) {
        const rows  = imported.reduce((n, f) => n + (f.rows || 0), 0);
        // Rows dated to another year are filed there instead — a January card
        // statement carries December's purchases.
        const other = Object.entries(filedElsewhere ?? {})
          .map(([y, n]) => `${n} row${n === 1 ? '' : 's'} filed under ${y}`)
          .join(', ');

        setResults((p) => ({
          ...p,
          [type]: `Added ${imported.length} file${imported.length === 1 ? '' : 's'} · ${rows.toLocaleString()} rows`
            + (other ? ` · ${other}` : ''),
        }));
      }
      if (failed.length) {
        setErrors((p) => ({
          ...p,
          [type]: failed.map((f) => `${f.name}: ${f.message}`).join('\n'),
        }));
      }

      setFiles(await window.electronAPI.listSourceFiles(year));
      if (imported.length) onUpdated();
    } catch (err) {
      setErrors((p) => ({ ...p, [type]: err.message }));
    } finally {
      setLoading(null);
    }
  };

  const handleRemove = async (type, file) => {
    try {
      await window.electronAPI.removeSourceFile(year, type, file.id);
      setFiles(await window.electronAPI.listSourceFiles(year));
      setResults((p) => ({ ...p, [type]: `Removed ${file.name}` }));
      onUpdated();
    } catch (err) {
      setErrors((p) => ({ ...p, [type]: err.message }));
    }
  };

  const handleMapping = async () => {
    setLoading('mapping');
    setErrors((p) => ({ ...p, mapping: null }));
    try {
      const result = await window.electronAPI.pickFile(year, 'mapping');
      if (!result) { setLoading(null); return; }
      await window.electronAPI.saveMappings(year, parseMappingCSV(result.content));
      setMappingName(result.fileName);
      onUpdated();
    } catch (err) {
      setErrors((p) => ({ ...p, mapping: err.message }));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-bold text-gray-900">{year} Files</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Add as many files per source as you like — CSV, XLS or XLSX
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Sources */}
        <div className="p-6 space-y-3 overflow-y-auto">
          {SOURCES.map((slot) => {
            const list      = files[slot.type] ?? [];
            const present   = list.length > 0;
            const isLoading = loading === slot.type;

            return (
              <div
                key={slot.type}
                className={`rounded-xl border transition-all ${
                  present ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4 px-4 py-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-lg ${
                    present ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}>
                    {present
                      ? <span className="text-white text-sm font-bold">{list.length}</span>
                      : slot.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-semibold ${present ? 'text-emerald-700' : 'text-gray-700'}`}>
                      {slot.label}
                    </span>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {results[slot.type]
                        ? <span className="text-emerald-600">{results[slot.type]}</span>
                        : slot.desc}
                    </div>
                  </div>

                  <button
                    onClick={() => handleAdd(slot.type)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isLoading ? <Spinner /> : <PlusIcon />}
                    Add files
                  </button>
                </div>

                {/* One row per imported file */}
                {present && (
                  <ul className="px-4 pb-3 space-y-1">
                    {list.map((f) => (
                      <li
                        key={f.id}
                        className="flex items-center gap-2 text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5"
                      >
                        <span className="text-gray-400">📄</span>
                        <span className="flex-1 truncate text-gray-700" title={f.name}>{f.name}</span>
                        <button
                          onClick={() => handleRemove(slot.type, f)}
                          title="Remove this file"
                          className="text-gray-300 hover:text-red-500 transition-colors px-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {errors[slot.type] && (
                  <p className="text-xs text-red-600 whitespace-pre-line px-4 pb-3">{errors[slot.type]}</p>
                )}
              </div>
            );
          })}

          {/* Vendor mapping — still a single file */}
          <div className="rounded-xl border border-gray-200 bg-gray-50">
            <div className="flex items-center gap-4 px-4 py-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-lg ${
                yearInfo?.hasMappings ? 'bg-emerald-500 text-white' : 'bg-gray-200'
              }`}>
                🔀
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-gray-700">Vendor Mapping Override</span>
                  <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full uppercase tracking-wide font-medium">
                    optional
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5 truncate">
                  {mappingName
                    ? <span className="text-emerald-600">✓ {mappingName}</span>
                    : 'Replaces the saved mapping rules for this year'}
                </div>
              </div>
              <button
                onClick={handleMapping}
                disabled={loading === 'mapping'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                {loading === 'mapping' ? <Spinner /> : null}
                Upload
              </button>
            </div>
            {errors.mapping && <p className="text-xs text-red-600 px-4 pb-3">{errors.mapping}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2 border-t border-gray-100">
          {mergeInfo && (
            <p className="text-xs text-gray-500 mb-3 text-center">
              {mergeInfo.transactions.toLocaleString()} transactions from {mergeInfo.files}{' '}
              file{mergeInfo.files === 1 ? '' : 's'}
              {mergeInfo.duplicates > 0 && (
                <span className="text-amber-600">
                  {' '}· {mergeInfo.duplicates.toLocaleString()} duplicate
                  {mergeInfo.duplicates === 1 ? '' : 's'} skipped
                </span>
              )}
            </p>
          )}
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-900 hover:bg-gray-700 text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
