const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');

// File reading / spreadsheet conversion lives in sheetImport.js
const { fileToCSV, readCSVSmart, splitCSVByYear, serializeCSVRows } = require('./sheetImport.js');

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// ── Data directory ────────────────────────────────────────────────────────
// All year folders live here: userData/data/2025/, userData/data/2024/, …
const DATA_DIR = () => path.join(app.getPath('userData'), 'data');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function yearDir(year) {
  return path.join(DATA_DIR(), String(year));
}

// ── Transaction sources ───────────────────────────────────────────────────
// The four source kinds a year can hold. Each may now hold MANY files — one
// per account or per export — which are merged when the year is loaded.
// Keep in step with src/utils/sources.js
const SOURCE_TYPES = ['bank', 'credit', 'il-bank', 'il-credit', 'isracard'];

function sourceFileName(type) {
  return `${type}.csv`;
}

/** Folder holding the imported files for one source: <year>/sources/<type>/ */
function sourceDir(year, type) {
  return path.join(yearDir(year), 'sources', type);
}

/** Strip characters that are illegal in Windows filenames. */
function safeName(name) {
  return String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120);
}

/**
 * Every imported file for one source, newest last.
 *
 * Years created before multi-file import keep a single <type>.csv at the year
 * root; it is listed alongside the rest so nothing needs migrating on disk.
 */
function listSourceFiles(year, type) {
  const files = [];

  const legacy = path.join(yearDir(year), sourceFileName(type));
  if (fs.existsSync(legacy)) {
    files.push({ id: `legacy:${sourceFileName(type)}`, name: sourceFileName(type), legacy: true });
  }

  const dir = sourceDir(year, type);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.csv')).sort()) {
      // Stored as "<timestamp>__<original name>.csv" — show the original name.
      const shown = f.includes('__') ? f.slice(f.indexOf('__') + 2) : f;
      files.push({ id: f, name: shown, legacy: false });
    }
  }

  return files;
}

/** Resolve a file id from listSourceFiles() back to a path on disk. */
function sourceFilePath(year, type, id) {
  if (String(id).startsWith('legacy:')) {
    return path.join(yearDir(year), String(id).slice('legacy:'.length));
  }
  return path.join(sourceDir(year, type), String(id));
}

function readSourceFiles(year, type) {
  return listSourceFiles(year, type).map((f) => {
    try {
      return { ...f, content: readCSVSmart(sourceFilePath(year, type, f.id)) };
    } catch {
      return { ...f, content: null };
    }
  });
}

// ── Vendor mappings ───────────────────────────────────────────────────────
// Mappings used to live per year, which meant categorising a vendor in 2026
// did nothing for 2025. They are now one shared list at data/mappings.json.
// The per-year files are left on disk untouched as a safety net.

const sharedMappingsPath = () => path.join(DATA_DIR(), 'mappings.json');

const mappingKey = (m) => String(m?.vendor ?? '').trim().toLowerCase();

/**
 * Merge mapping lists into one, later lists winning on conflict but never
 * blanking a field the earlier one had filled in.
 */
function mergeMappingLists(lists) {
  const byVendor = new Map();

  for (const list of lists) {
    for (const m of Array.isArray(list) ? list : []) {
      const key = mappingKey(m);
      if (!key) continue;
      const prev = byVendor.get(key);
      byVendor.set(key, {
        vendor:           m.vendor ?? prev?.vendor ?? '',
        mappedVendor:     m.mappedVendor     || prev?.mappedVendor     || '',
        categoryOverride: m.categoryOverride || prev?.categoryOverride || '',
      });
    }
  }

  return [...byVendor.values()];
}

/** Every year folder's own mappings.json, oldest year first. */
function readPerYearMappings() {
  const lists = [];
  try {
    const years = fs.readdirSync(DATA_DIR())
      .filter((n) => /^\d{4}$/.test(n))
      .sort((a, b) => parseInt(a) - parseInt(b));   // newest last, so it wins
    for (const y of years) {
      const p = path.join(yearDir(y), 'mappings.json');
      if (fs.existsSync(p)) {
        try { lists.push(JSON.parse(fs.readFileSync(p, 'utf-8'))); } catch {}
      }
    }
  } catch {}
  return lists;
}

/**
 * The shared mapping list. On first run this is built by merging whatever the
 * year folders already hold, so existing work carries over automatically.
 */
function readMappings() {
  ensureDir(DATA_DIR());
  const shared = sharedMappingsPath();

  if (fs.existsSync(shared)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(shared, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  const merged = mergeMappingLists(readPerYearMappings());
  try {
    fs.writeFileSync(shared, JSON.stringify(merged, null, 2), 'utf-8');
  } catch {}
  return merged;
}

function writeMappings(mappings) {
  ensureDir(DATA_DIR());
  fs.writeFileSync(sharedMappingsPath(), JSON.stringify(mappings ?? [], null, 2), 'utf-8');
}

/**
 * Read which sources are enabled for a year.
 * Returns [] when unset — callers treat that as "every available source".
 */
function readEnabledSources(year) {
  const p = path.join(yearDir(year), 'enabled-sources.json');
  try {
    if (!fs.existsSync(p)) return [];
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return Array.isArray(parsed) ? parsed.filter(t => SOURCE_TYPES.includes(t)) : [];
  } catch { return []; }
}

function writeEnabledSources(year, enabledSources) {
  const d = yearDir(year);
  ensureDir(d);
  const clean = Array.isArray(enabledSources)
    ? enabledSources.filter(t => SOURCE_TYPES.includes(t))
    : [];
  fs.writeFileSync(path.join(d, 'enabled-sources.json'), JSON.stringify(clean, null, 2), 'utf-8');
}

// ── Window ────────────────────────────────────────────────────────────────

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1200,
    minHeight: 800,
    title: 'Expense Tracker',
    backgroundColor: '#f9fafb',
    icon: path.join(__dirname, '..', 'resources', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Build the shared mapping list on startup if it isn't there yet, so the
  // one-time merge of the old per-year lists happens once and predictably
  // rather than on whichever year happens to be opened first.
  try { readMappings(); } catch {}

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Year / data IPC ───────────────────────────────────────────────────────

// Return the data directory path (shown in UI)
ipcMain.handle('data:getDir', () => {
  ensureDir(DATA_DIR());
  return DATA_DIR();
});

// Return sorted list of years with file-presence flags
ipcMain.handle('data:listYears', () => {
  ensureDir(DATA_DIR());
  try {
    return fs.readdirSync(DATA_DIR())
      .filter(name => /^\d{4}$/.test(name) && fs.statSync(path.join(DATA_DIR(), name)).isDirectory())
      .sort((a, b) => parseInt(b) - parseInt(a))
      .map(year => {
        const d = yearDir(year);
        const files = Object.fromEntries(SOURCE_TYPES.map((t) => [t, listSourceFiles(year, t)]));
        return {
          year,
          // Kept for compatibility: "has this source got anything at all?"
          hasBank:     files['bank'].length      > 0,
          hasCredit:   files['credit'].length    > 0,
          hasILBank:   files['il-bank'].length   > 0,
          hasILCredit: files['il-credit'].length > 0,
          hasMappings: fs.existsSync(sharedMappingsPath()) || fs.existsSync(path.join(d, 'mappings.json')),
          files,
          enabledSources: readEnabledSources(year),
        };
      });
  } catch { return []; }
});

// Create a new year folder
ipcMain.handle('data:addYear', (_, year) => {
  const y = parseInt(year);
  if (isNaN(y) || y < 2000 || y > 2100) throw new Error('Invalid year');
  ensureDir(yearDir(y));
  return {
    year: String(y),
    hasBank: false,
    hasCredit: false,
    hasMappings: false,
    files: Object.fromEntries(SOURCE_TYPES.map((t) => [t, []])),
  };
});

// Load every source file + mappings for a year
ipcMain.handle('data:loadYear', (_, year) => {
  const d = yearDir(year);

  const sourceFiles = Object.fromEntries(
    SOURCE_TYPES.map((type) => [type, readSourceFiles(year, type).filter((f) => f.content)])
  );

  const mappings = readMappings();   // shared across every year

  let enabledSources = readEnabledSources(year);
  const availableSources = SOURCE_TYPES.filter((type) => sourceFiles[type].length > 0);
  if (!enabledSources.length) enabledSources = availableSources;

  let transactionOverrides = [];
  const to = path.join(d, 'transaction-overrides.json');
  try {
    if (fs.existsSync(to)) transactionOverrides = JSON.parse(fs.readFileSync(to, 'utf-8'));
  } catch {}

  return {
    sourceFiles,
    mappings,
    enabledSources,
    transactionOverrides,
  };
});

// ── Importing source files ────────────────────────────────────────────────

const SOURCE_LABELS = {
  bank:        'Bank Transactions (US)',
  credit:      'Credit Card Transactions (US)',
  'il-bank':   'Israeli Bank Transactions',
  'il-credit': 'Visa Cal Transactions',
  isracard:    'Isracard Transactions',
  mapping:     'Vendor Mapping Override',
};

/**
 * Import one or more files into a source. Spreadsheets are converted to CSV
 * on the way in; CSVs are copied as-is. Each file is kept separately so it can
 * be removed later without disturbing the others.
 */
ipcMain.handle('data:addSourceFiles', async (_, { year, type }) => {
  if (!SOURCE_TYPES.includes(type)) throw new Error(`Unknown source type: ${type}`);

  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: `Select ${SOURCE_LABELS[type] || 'transaction'} files`,
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Bank exports', extensions: ['csv', 'CSV', 'xls', 'XLS', 'xlsx', 'XLSX'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (canceled || !filePaths.length) return null;

  const dir = sourceDir(year, type);
  ensureDir(dir);

  const imported = [];
  const errors   = [];
  const filedElsewhere = {};   // year -> rows filed under a different year

  for (const src of filePaths) {
    const original = path.basename(src);
    const base     = safeName(original.replace(/\.(xls|xlsx|xlsm|csv)$/i, ''));
    const stem     = `${Date.now()}_${imported.length}__${base}`;

    try {
      const { csv, rows, skipped } = fileToCSV(src);
      const split = splitCSVByYear(csv);

      // A statement that covers one calendar year only — store it as-is.
      if (!split || split.byYear.size <= 1) {
        const stored = `${stem}.csv`;
        fs.writeFileSync(path.join(dir, stored), csv, 'utf-8');
        imported.push({ id: stored, name: original, rows, skipped, content: csv });
        continue;
      }

      // Rows spread across years: each year's rows go to that year's folder.
      // Undated rows stay with the year the user was importing into.
      let ownRows = 0;
      for (const [rowYear, yearRows] of split.byYear) {
        const isTarget = String(rowYear) === String(year);
        const body     = isTarget ? [...yearRows, ...split.undated] : yearRows;
        const target   = sourceDir(rowYear, type);
        ensureDir(target);

        const stored  = `${stem} (${rowYear}).csv`;
        const content = serializeCSVRows([split.headers, ...body]);
        fs.writeFileSync(path.join(target, stored), content, 'utf-8');

        if (isTarget) {
          ownRows = body.length;
          imported.push({ id: stored, name: original, rows: body.length, skipped, content });
        } else {
          filedElsewhere[rowYear] = (filedElsewhere[rowYear] || 0) + body.length;
        }
      }

      // Every row belonged to another year — still report the file as imported.
      if (!ownRows) {
        imported.push({ id: null, name: original, rows: 0, skipped, content: null });
      }
    } catch (err) {
      errors.push({ name: original, message: err.message });
    }
  }

  return { imported, errors, filedElsewhere };
});

/** Delete one imported file from a source. */
ipcMain.handle('data:removeSourceFile', (_, { year, type, id }) => {
  if (!SOURCE_TYPES.includes(type)) throw new Error(`Unknown source type: ${type}`);
  const p = sourceFilePath(year, type, id);

  // Keep deletions inside the year folder, whatever the id claims to be.
  const root = path.resolve(yearDir(year));
  if (!path.resolve(p).startsWith(root)) throw new Error('Refusing to delete outside the year folder');

  if (fs.existsSync(p)) fs.unlinkSync(p);
  return listSourceFiles(year, type);
});

/** List the imported files for every source of a year. */
ipcMain.handle('data:listSourceFiles', (_, year) =>
  Object.fromEntries(SOURCE_TYPES.map((t) => [t, listSourceFiles(year, t)]))
);

// Open a file-picker for the vendor-mapping override CSV
ipcMain.handle('data:pickFile', async (_, { year, type }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: `Select ${SOURCE_LABELS[type] || 'CSV'} file`,
    properties: ['openFile'],
    filters: [
      { name: 'CSV Files', extensions: ['csv', 'CSV'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (canceled || !filePaths.length) return null;

  const src  = filePaths[0];
  const dest = path.join(yearDir(year), 'vendor-mapping-override.csv');
  ensureDir(yearDir(year));
  fs.copyFileSync(src, dest);

  return { fileName: path.basename(src), content: readCSVSmart(dest) };
});

// Persist the shared mapping list. The year is accepted but unused — mappings
// apply to every year, so there is only one list to write.
ipcMain.handle('data:saveMappings', (_, { mappings }) => {
  writeMappings(mappings);
  return true;
});

ipcMain.handle('data:saveEnabledSources', (_, { year, enabledSources }) => {
  writeEnabledSources(year, enabledSources);
  return true;
});

ipcMain.handle('data:saveTransactionOverrides', (_, { year, transactionOverrides }) => {
  const d = yearDir(year);
  ensureDir(d);
  fs.writeFileSync(path.join(d, 'transaction-overrides.json'), JSON.stringify(transactionOverrides, null, 2), 'utf-8');
  return true;
});

// ── File dialog helpers (kept for CSV export) ─────────────────────────────

ipcMain.handle('dialog:saveFile', async (_, { content, defaultName }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save File',
    defaultPath: defaultName || 'export.csv',
    filters: [
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select CSV File',
    properties: ['openFile'],
    filters: [
      { name: 'CSV Files', extensions: ['csv', 'CSV'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (canceled || !filePaths.length) return null;
  const content = readCSVSmart(filePaths[0]);
  return { fileName: path.basename(filePaths[0]), content };
});
