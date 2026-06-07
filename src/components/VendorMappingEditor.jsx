import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { parseMappingCSV, exportMappingCSV, uniqueVendors, uniqueCategories } from '../utils/vendorMapping.js';

/* ═══════════════════════════════════════════════════════════════════════════
   SMALL SHARED HELPERS
═══════════════════════════════════════════════════════════════════════════ */

function IconBtn({ onClick, title, children, danger, disabled }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        danger
          ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
          : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
      }`}
    >
      {children}
    </button>
  );
}

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);
const XIcon = ({ size = 4 }) => (
  <svg className={`w-${size} h-${size}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

/* ═══════════════════════════════════════════════════════════════════════════
   MULTI-VENDOR PICKER
   A searchable checkbox-dropdown with selected-tag chips above it.
═══════════════════════════════════════════════════════════════════════════ */

function MultiVendorPicker({ allVendors, vendorCategoryMap = new Map(), vendorDisplayMap = new Map(), allCategories = [], selected, onChange }) {
  const [search,          setSearch]          = useState('');
  const [open,            setOpen]            = useState(false);
  const [catFilterOpen,   setCatFilterOpen]   = useState(false);
  const [selectedCats,    setSelectedCats]    = useState([]);
  const containerRef    = useRef(null);
  const catFilterRef    = useRef(null);

  // Close vendor dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close category filter when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (catFilterRef.current && !catFilterRef.current.contains(e.target)) setCatFilterOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (vendor) => {
    if (selected.includes(vendor)) onChange(selected.filter((v) => v !== vendor));
    else onChange([...selected, vendor]);
  };

  const toggleCat = (cat) => {
    setSelectedCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const filtered = useMemo(() => {
    return allVendors.filter((v) => {
      if (!v.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedCats.length === 0) return true;
      const cat = vendorCategoryMap.get(v.toLowerCase()) || '';
      return selectedCats.some((sc) => sc.toLowerCase() === cat.toLowerCase());
    });
  }, [allVendors, search, selectedCats, vendorCategoryMap]);

  return (
    <div ref={containerRef} className="relative">
      {/* Selected vendor tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 max-h-20 overflow-y-auto">
          {selected.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
              <span className="max-w-[160px] truncate" title={v}>{v}</span>
              <button onClick={() => toggle(v)} className="hover:text-blue-900 flex-shrink-0 leading-none">×</button>
            </span>
          ))}
        </div>
      )}

      {/* Search row + category filter button */}
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={selected.length > 0 ? 'Add more vendors…' : 'Search and select vendors…'}
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />

        {/* Category filter multi-select */}
        <div ref={catFilterRef} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => { setCatFilterOpen((o) => !o); setOpen(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              selectedCats.length > 0
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            {selectedCats.length > 0 ? `${selectedCats.length} cat${selectedCats.length > 1 ? 's' : ''}` : 'Filter'}
            {selectedCats.length > 0 && (
              <span
                onClick={(e) => { e.stopPropagation(); setSelectedCats([]); }}
                className="ml-0.5 hover:opacity-70 leading-none"
                title="Clear filter"
              >×</span>
            )}
          </button>

          {catFilterOpen && (
            <div className="absolute z-40 right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500">
                Filter by category (OR)
              </div>
              <div className="max-h-52 overflow-y-auto">
                {allCategories.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-gray-400">No categories yet.</div>
                ) : allCategories.map((cat) => (
                  <label key={cat}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                      selectedCats.includes(cat) ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCats.includes(cat)}
                      onChange={() => toggleCat(cat)}
                      className="w-3.5 h-3.5 rounded accent-blue-600 flex-shrink-0"
                    />
                    <span className={`text-xs truncate ${selectedCats.includes(cat) ? 'font-medium text-blue-700' : 'text-gray-700'}`}>
                      {cat}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Vendor dropdown */}
      {open && (
        <div className="absolute z-30 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-400">No vendors match.</div>
          ) : (
            filtered.map((v) => {
              const checked     = selected.includes(v);
              const cat         = vendorCategoryMap.get(v.toLowerCase());
              const displayName = vendorDisplayMap.get(v.toLowerCase()) || v;
              const isRenamed   = displayName !== v;
              return (
                <label key={v}
                  className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${checked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(v)}
                    className="w-3.5 h-3.5 rounded accent-blue-600 flex-shrink-0"
                  />
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm truncate ${checked ? 'font-medium text-blue-700' : 'text-gray-700'}`} title={displayName}>
                      {displayName}
                    </span>
                    {isRenamed && (
                      <span className="block text-[10px] text-gray-400 truncate" title={v}>
                        {v}
                      </span>
                    )}
                  </span>
                  {cat && (
                    <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1 truncate max-w-[80px]" title={cat}>
                      {cat}
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GROUP FORM  (used for both "Add new group" and "Edit existing group")
═══════════════════════════════════════════════════════════════════════════ */

const EMPTY_GROUP = { groupName: '', vendors: [], categoryOverride: '' };

function GroupForm({ initial, allVendors, vendorCategoryMap, vendorDisplayMap, allCategories, onSave, onCancel }) {
  const [form, setForm] = useState(initial ?? EMPTY_GROUP);
  const groupNameRef = useRef(null);

  useEffect(() => {
    groupNameRef.current?.focus();
  }, []);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const valid = form.vendors.length > 0;

  const catListId = 'cat-datalist-groupform';

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Group / canonical name */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Group Name <span className="text-gray-400 font-normal">(the canonical display name)</span>
          </label>
          <input
            ref={groupNameRef}
            type="text"
            value={form.groupName}
            onChange={(e) => set('groupName', e.target.value)}
            placeholder="e.g. Amazon, Super Gavriel…"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <p className="text-[10px] text-gray-400 mt-0.5">
            Leave blank to only override the category without renaming.
          </p>
        </div>

        {/* Category override */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Category Override <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            list={catListId}
            value={form.categoryOverride}
            onChange={(e) => set('categoryOverride', e.target.value)}
            placeholder="e.g. Groceries, Online Shopping…"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <datalist id={catListId}>
            {allCategories.map((c) => <option key={c} value={c} />)}
          </datalist>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Type a new name to create a new category.
          </p>
        </div>
      </div>

      {/* Vendor multi-picker */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          Vendors to include{' '}
          {form.vendors.length > 0 && (
            <span className="text-blue-600">({form.vendors.length} selected)</span>
          )}
        </label>
        <MultiVendorPicker
          allVendors={allVendors}
          vendorCategoryMap={vendorCategoryMap}
          vendorDisplayMap={vendorDisplayMap}
          allCategories={allCategories}
          selected={form.vendors}
          onChange={(v) => set('vendors', v)}
        />
        {!valid && (
          <p className="text-[10px] text-red-400 mt-1">Select at least one vendor.</p>
        )}
      </div>

      {/* Action row */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => valid && onSave(form)}
          disabled={!valid}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CheckIcon />
          Save Group
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GROUP ROW  (display mode)
═══════════════════════════════════════════════════════════════════════════ */

function GroupRow({ group, onEdit, onDelete }) {
  const MAX_VISIBLE = 4;
  const visible  = group.vendors.slice(0, MAX_VISIBLE);
  const overflow = group.vendors.length - MAX_VISIBLE;

  return (
    <div className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors group">
      {/* Group name */}
      <div className="w-40 flex-shrink-0">
        {group.groupName ? (
          <span className="text-sm font-semibold text-gray-900">{group.groupName}</span>
        ) : (
          <span className="text-xs text-gray-400 italic">no rename</span>
        )}
      </div>

      {/* Vendor chips */}
      <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
        {visible.map((v) => (
          <span
            key={v}
            title={v}
            className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full max-w-[180px] truncate"
          >
            {v}
          </span>
        ))}
        {overflow > 0 && (
          <span className="text-xs text-gray-400 self-center">+{overflow} more</span>
        )}
      </div>

      {/* Category badge */}
      <div className="w-36 flex-shrink-0">
        {group.categoryOverride ? (
          <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
            {group.categoryOverride}
          </span>
        ) : (
          <span className="text-xs text-gray-300 italic">keep original</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <IconBtn onClick={onEdit} title="Edit group"><EditIcon /></IconBtn>
        <IconBtn onClick={onDelete} title="Delete group" danger><TrashIcon /></IconBtn>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN EDITOR MODAL
═══════════════════════════════════════════════════════════════════════════ */

export default function VendorMappingEditor({ mappings, onMappingsChange, rawTransactions, onClose }) {
  // 'idle' | 'adding' | number (editing group's ORIGINAL index in `groups`)
  const [mode,        setMode]        = useState('idle');
  const [saveError,   setSaveError]   = useState(null);
  const [saveOk,      setSaveOk]      = useState(false);
  const [groupSearch, setGroupSearch] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const allVendors    = useMemo(() => uniqueVendors(rawTransactions), [rawTransactions]);
  const allCategories = useMemo(() => uniqueCategories(rawTransactions, mappings), [rawTransactions, mappings]);

  // Map: lowercase vendor name → current category (from transaction data + mapping overrides)
  const vendorCategoryMap = useMemo(() => {
    const map = new Map();
    for (const t of rawTransactions) {
      if (t.vendor) map.set(t.vendor.toLowerCase(), t.category || '');
    }
    for (const m of mappings) {
      if (m.vendor && m.categoryOverride) map.set(m.vendor.toLowerCase(), m.categoryOverride);
    }
    return map;
  }, [rawTransactions, mappings]);

  // Map: lowercase raw vendor name → canonical display name (mappedVendor if set, else raw name)
  // This makes the picker show the same names as the Vendors tab.
  const vendorDisplayMap = useMemo(() => {
    const map = new Map();
    for (const m of mappings) {
      if (m.vendor && m.mappedVendor?.trim()) {
        map.set(m.vendor.toLowerCase(), m.mappedVendor.trim());
      }
    }
    return map;
  }, [mappings]);

  /* ── Group the flat mappings array for display ── */
  const groups = useMemo(() => {
    const map = new Map();
    for (const m of mappings) {
      // Rows with the same mappedVendor belong to the same group.
      // Rows with no mappedVendor each form their own solo group keyed by vendor name.
      const key = m.mappedVendor?.trim() || `\x00solo\x00${m.vendor}`;
      if (!map.has(key)) {
        map.set(key, {
          groupName: m.mappedVendor?.trim() || '',
          vendors: [],
          categoryOverride: m.categoryOverride,
        });
      }
      map.get(key).vendors.push(m.vendor);
    }
    return Array.from(map.values());
  }, [mappings]);

  // Sorted + searched version of groups, each entry carries its original index
  const displayGroups = useMemo(() => {
    const withIdx = groups.map((g, i) => ({ ...g, originalIndex: i }));
    withIdx.sort((a, b) => {
      const nameA = (a.groupName || a.vendors[0] || '').toLowerCase();
      const nameB = (b.groupName || b.vendors[0] || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    if (!groupSearch.trim()) return withIdx;
    const q = groupSearch.toLowerCase();
    return withIdx.filter((g) =>
      (g.groupName || '').toLowerCase().includes(q) ||
      g.vendors.some((v) => v.toLowerCase().includes(q)) ||
      (g.categoryOverride || '').toLowerCase().includes(q)
    );
  }, [groups, groupSearch]);

  /* ── Convert a GroupForm result back to flat mapping rows ── */
  const groupToMappings = ({ groupName, vendors, categoryOverride }) =>
    vendors.map((vendor) => ({
      vendor,
      mappedVendor:     groupName.trim(),
      categoryOverride: categoryOverride.trim(),
    }));

  /* ── Build initial form state from a group (for editing) ── */
  const groupToForm = (group) => ({
    groupName:        group.groupName,
    vendors:          [...group.vendors],
    categoryOverride: group.categoryOverride,
  });

  /* ── Save group (add or replace) ── */
  const handleSaveGroup = useCallback(
    (form, editingGroupIdx = null) => {
      const newEntries = groupToMappings(form);

      let next;
      if (editingGroupIdx === null) {
        // Adding new — just append, dedup by vendor key
        const existingKeys = new Set(mappings.map((m) => m.vendor.toLowerCase()));
        const toAdd = newEntries.filter((e) => !existingKeys.has(e.vendor.toLowerCase()));
        // Also update existing vendors if they happen to already be in mappings
        const updated = mappings.map((m) => {
          const match = newEntries.find((e) => e.vendor.toLowerCase() === m.vendor.toLowerCase());
          return match ?? m;
        });
        next = [...updated, ...toAdd];
      } else {
        // Editing — remove all vendors that belonged to the old group, then add the new entries
        const oldVendorKeys = new Set(groups[editingGroupIdx].vendors.map((v) => v.toLowerCase()));
        const kept   = mappings.filter((m) => !oldVendorKeys.has(m.vendor.toLowerCase()));
        next = [...kept, ...newEntries];
      }

      onMappingsChange(next);
      setMode('idle');
    },
    [mappings, groups, onMappingsChange]
  );

  /* ── Delete entire group ── */
  const handleDeleteGroup = (groupIdx) => {
    const keys = new Set(groups[groupIdx].vendors.map((v) => v.toLowerCase()));
    onMappingsChange(mappings.filter((m) => !keys.has(m.vendor.toLowerCase())));
    if (mode === groupIdx) setMode('idle');
  };

  /* ── Load CSV ── */
  const handleLoadCSV = async () => {
    setSaveError(null);
    try {
      const result = await window.electronAPI.openFile();
      if (!result) return;
      const loaded = parseMappingCSV(result.content);
      const existingMap = new Map(mappings.map((m) => [m.vendor.toLowerCase(), m]));
      for (const m of loaded) existingMap.set(m.vendor.toLowerCase(), m);
      onMappingsChange(Array.from(existingMap.values()));
    } catch (err) {
      setSaveError(`Load failed: ${err.message}`);
    }
  };

  /* ── Save CSV ── */
  const handleSaveCSV = async () => {
    setSaveError(null);
    setSaveOk(false);
    try {
      const csv = exportMappingCSV(mappings);
      const ok  = await window.electronAPI.saveFile(csv, 'vendor-mapping-override.csv');
      if (ok) { setSaveOk(true); setTimeout(() => setSaveOk(false), 2500); }
    } catch (err) {
      setSaveError(`Save failed: ${err.message}`);
    }
  };

  const totalVendors = mappings.length;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Vendor Mapping Override</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Group multiple vendor names, rename them, and override their categories across all tabs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Load CSV
            </button>
            <button
              onClick={handleSaveCSV}
              disabled={mappings.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                saveOk ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {saveOk ? 'Saved!' : 'Save CSV'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition-colors ml-1"
            >
              <XIcon size={5} />
            </button>
          </div>
        </div>

        {saveError && (
          <div className="mx-6 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex-shrink-0">
            {saveError}
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Add form */}
          {mode === 'adding' && (
            <GroupForm
              initial={EMPTY_GROUP}
              allVendors={allVendors}
              vendorCategoryMap={vendorCategoryMap}
              vendorDisplayMap={vendorDisplayMap}
              allCategories={allCategories}
              onSave={(form) => handleSaveGroup(form, null)}
              onCancel={() => setMode('idle')}
            />
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                placeholder="Search groups…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
              {displayGroups.length}{groupSearch ? ` / ${groups.length}` : ''} group{groups.length !== 1 ? 's' : ''}
              {totalVendors > 0 && ` · ${totalVendors} mapped`}
            </span>

            {mode !== 'adding' && (
              <button
                onClick={() => setMode('adding')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Group
              </button>
            )}
          </div>

          {/* Groups list */}
          {groups.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">
              No mappings yet.{' '}
              <button onClick={() => setMode('adding')} className="text-blue-500 hover:underline">
                Create the first group.
              </button>
            </div>
          ) : displayGroups.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No groups match <span className="font-medium">"{groupSearch}"</span>.
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden bg-white divide-y divide-gray-100">

              {/* Column headers */}
              <div className="flex items-center gap-4 px-4 py-2 bg-gray-50">
                <div className="w-40 flex-shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Group Name
                </div>
                <div className="flex-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Vendors Included
                </div>
                <div className="w-36 flex-shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Category Override
                </div>
                <div className="w-16 flex-shrink-0" />
              </div>

              {displayGroups.map((group) => {
                const oi = group.originalIndex;
                return mode === oi ? (
                  <div key={oi} className="p-4">
                    <GroupForm
                      initial={groupToForm(group)}
                      allVendors={allVendors}
                      vendorCategoryMap={vendorCategoryMap}
                      vendorDisplayMap={vendorDisplayMap}
                      allCategories={allCategories}
                      onSave={(form) => handleSaveGroup(form, oi)}
                      onCancel={() => setMode('idle')}
                    />
                  </div>
                ) : (
                  <GroupRow
                    key={oi}
                    group={group}
                    onEdit={() => setMode(oi)}
                    onDelete={() => handleDeleteGroup(oi)}
                  />
                )
              )}
            </div>
          )}

          {/* Hint box */}
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 text-xs text-gray-500 space-y-1">
            <p>
              <strong className="text-gray-700">Group Name</strong> — all selected vendors are renamed to this in every tab. Leave blank to only override the category.
            </p>
            <p>
              <strong className="text-gray-700">Category Override</strong> — applied to every vendor in the group. Type a new name to create a new category.
            </p>
            <p>
              <strong className="text-gray-700">Save CSV</strong> writes <code>vendor-mapping-override.csv</code> so you can reload the rules next session.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
