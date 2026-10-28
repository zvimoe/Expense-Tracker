const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Year / data management ──────────────────────────────────────────────
  /** Returns the path to the data folder (for display purposes). */
  getDataDir:   ()              => ipcRenderer.invoke('data:getDir'),

  /** Returns [{year, hasBank, hasCredit, hasMappings}] sorted newest first. */
  listYears:    ()              => ipcRenderer.invoke('data:listYears'),

  /** Creates a year folder; returns the new year-info object. */
  addYear:      (year)          => ipcRenderer.invoke('data:addYear', year),

  /** Loads all CSV content + mappings for a year. */
  loadYear:     (year)          => ipcRenderer.invoke('data:loadYear', year),

  /**
   * Opens a file-picker for the vendor-mapping CSV, copies it into the year
   * folder, and returns { fileName, content }.
   */
  pickFile:     (year, type)    => ipcRenderer.invoke('data:pickFile', { year, type }),

  // ── Source files (many per source: one per account or export) ───────────
  /**
   * Opens a multi-select picker for a source ('bank'|'credit'|'il-bank'|'il-credit'),
   * converting .xls/.xlsx to CSV on the way in.
   * Returns { imported: [{id, name, rows, skipped, content}], errors: [{name, message}] }.
   */
  addSourceFiles:   (year, type)     => ipcRenderer.invoke('data:addSourceFiles', { year, type }),

  /** Deletes one imported file; returns the source's remaining files. */
  removeSourceFile: (year, type, id) => ipcRenderer.invoke('data:removeSourceFile', { year, type, id }),

  /** Returns { [type]: [{id, name, legacy}] } for a year. */
  listSourceFiles:  (year)           => ipcRenderer.invoke('data:listSourceFiles', year),

  /** Persists the mappings array for a year to disk. */
  saveMappings: (year, mappings) => ipcRenderer.invoke('data:saveMappings', { year, mappings }),

  /** Persists which transaction sources are enabled for a year. */
  saveEnabledSources: (year, enabledSources) => ipcRenderer.invoke('data:saveEnabledSources', { year, enabledSources }),

  /** Persists transaction-only overrides for a year to disk. */
  saveTransactionOverrides: (year, transactionOverrides) => ipcRenderer.invoke('data:saveTransactionOverrides', { year, transactionOverrides }),

  // ── Generic file dialogs (used by mapping editor CSV export) ───────────
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content, defaultName) => ipcRenderer.invoke('dialog:saveFile', { content, defaultName }),
});
