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
   * Opens a file-picker for the given type ('bank'|'credit'|'mapping'),
   * copies the chosen file into the year folder, and returns { fileName, content }.
   */
  pickFile:     (year, type)    => ipcRenderer.invoke('data:pickFile', { year, type }),

  /** Persists the mappings array for a year to disk. */
  saveMappings: (year, mappings) => ipcRenderer.invoke('data:saveMappings', { year, mappings }),

  // ── Generic file dialogs (used by mapping editor CSV export) ───────────
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content, defaultName) => ipcRenderer.invoke('dialog:saveFile', { content, defaultName }),
});
