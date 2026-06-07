import React, { useState, useEffect } from 'react';
import { parseMappingCSV } from '../utils/vendorMapping.js';

const FILE_SLOTS = [
  {
    type:   'bank',
    label:  'US Bank Transactions',
    icon:   '🏦',
    desc:   'US bank account CSV export',
    hasKey: 'hasBank',
  },
  {
    type:   'credit',
    label:  'US Credit Card Transactions',
    icon:   '💳',
    desc:   'US credit card CSV export',
    hasKey: 'hasCredit',
  },
  {
    type:   'il-bank',
    label:  'Israeli Bank Transactions',
    icon:   '🇮🇱',
    desc:   'Israeli bank CSV export (Hebrew columns, ₪)',
    hasKey: 'hasILBank',
  },
  {
    type:   'il-credit',
    label:  'Israeli Credit Card Transactions',
    icon:   '💳',
    desc:   'Israeli credit card CSV export (Hebrew columns, ₪)',
    hasKey: 'hasILCredit',
  },
  {
    type:     'mapping',
    label:    'Vendor Mapping Override',
    icon:     '🔀',
    desc:     'Optional — vendor-mapping-override.csv',
    hasKey:   'hasMappings',
    optional: true,
  },
];

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

export default function YearFilesEditor({ year, yearInfo, onClose, onUpdated }) {
  const [info,    setInfo]    = useState(yearInfo);
  const [loading, setLoading] = useState(null); // type string or null
  const [errors,  setErrors]  = useState({});
  const [success, setSuccess] = useState({});

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleUpload = async (type) => {
    setLoading(type);
    setErrors((p) => ({ ...p, [type]: null }));
    setSuccess((p) => ({ ...p, [type]: false }));

    try {
      const result = await window.electronAPI.pickFile(year, type);
      if (!result) { setLoading(null); return; }

      // If it's a mapping CSV, parse it and save as mappings.json immediately
      if (type === 'mapping' && result.content) {
        const mappings = parseMappingCSV(result.content);
        await window.electronAPI.saveMappings(year, mappings);
      }

      // Refresh year info flags
      const list = await window.electronAPI.listYears();
      const updated = list.find((y) => y.year === String(year));
      if (updated) setInfo(updated);

      setSuccess((p) => ({ ...p, [type]: result.fileName }));
      onUpdated();
    } catch (err) {
      setErrors((p) => ({ ...p, [type]: err.message }));
    } finally {
      setLoading(null);
    }
  };

  const hasFile = (slot) => !!info[slot.hasKey];

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-bold text-gray-900">Edit {year} Files</h2>
            <p className="text-xs text-gray-400 mt-0.5">Upload or replace CSV files for this year</p>
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

        {/* File slots */}
        <div className="p-6 space-y-3">
          {FILE_SLOTS.map((slot) => {
            const present  = hasFile(slot);
            const isLoading = loading === slot.type;
            const errMsg   = errors[slot.type];
            const okName   = success[slot.type];

            return (
              <div key={slot.type}>
                <div className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all ${
                  present ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50'
                }`}>
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-lg ${
                    present ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}>
                    {present
                      ? <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                      : slot.icon
                    }
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold ${present ? 'text-emerald-700' : 'text-gray-700'}`}>
                        {slot.label}
                      </span>
                      {slot.optional && (
                        <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full uppercase tracking-wide font-medium">
                          optional
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {okName
                        ? <span className="text-emerald-600">✓ {okName}</span>
                        : present
                        ? <span className="text-emerald-600">File loaded</span>
                        : slot.desc
                      }
                    </div>
                  </div>

                  {/* Upload button */}
                  <button
                    onClick={() => handleUpload(slot.type)}
                    disabled={isLoading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
                      present
                        ? 'border border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } disabled:opacity-50`}
                  >
                    {isLoading ? <Spinner /> : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                      </svg>
                    )}
                    {present ? 'Replace' : 'Upload'}
                  </button>
                </div>

                {errMsg && (
                  <p className="text-xs text-red-500 mt-1 px-1">{errMsg}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
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
