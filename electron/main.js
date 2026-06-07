const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path  = require('path');
const fs    = require('fs');
const iconv = require('iconv-lite');

/**
 * Read a CSV file with automatic encoding detection.
 * Excel on Windows often saves Hebrew CSVs in Windows-1255 rather than UTF-8.
 * We read the raw buffer, attempt UTF-8, and fall back to Windows-1255 if the
 * UTF-8 result contains replacement characters (U+FFFD = invalid byte sequences).
 */
function readCSVSmart(filePath) {
  const buf = fs.readFileSync(filePath);
  const utf8 = buf.toString('utf-8');
  if (!utf8.includes('\uFFFD')) return utf8;          // valid UTF-8, use as-is
  return iconv.decode(buf, 'windows-1255');           // fall back to Windows-1255
}

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

// ── Window ────────────────────────────────────────────────────────────────

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1200,
    minHeight: 800,
    title: 'Finance Dashboard 2025',
    backgroundColor: '#f9fafb',
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
        return {
          year,
          hasBank:     fs.existsSync(path.join(d, 'bank.csv')),
          hasCredit:   fs.existsSync(path.join(d, 'credit.csv')),
          hasILBank:   fs.existsSync(path.join(d, 'il-bank.csv')),
          hasILCredit: fs.existsSync(path.join(d, 'il-credit.csv')),
          hasMappings: fs.existsSync(path.join(d, 'mappings.json')),
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
  };
});

// Load all CSV content + mappings for a year
ipcMain.handle('data:loadYear', (_, year) => {
  const d = yearDir(year);

  const readCSV = (name) => {
    const p = path.join(d, name);
    return fs.existsSync(p) ? readCSVSmart(p) : null;
  };

  let mappings = [];
  const mp = path.join(d, 'mappings.json');
  try {
    if (fs.existsSync(mp)) mappings = JSON.parse(fs.readFileSync(mp, 'utf-8'));
  } catch {}

  return {
    bankContent:     readCSV('bank.csv'),
    creditContent:   readCSV('credit.csv'),
    ilBankContent:   readCSV('il-bank.csv'),
    ilCreditContent: readCSV('il-credit.csv'),
    mappings,
  };
});

// Open a file-picker, copy the chosen CSV into the year folder, return its content
ipcMain.handle('data:pickFile', async (_, { year, type }) => {
  const labels = {
    bank:      'Bank Transactions (US)',
    credit:    'Credit Card Transactions (US)',
    'il-bank':   'Israeli Bank Transactions',
    'il-credit': 'Israeli Credit Card Transactions',
    mapping:   'Vendor Mapping Override',
  };
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: `Select ${labels[type] || 'CSV'} file`,
    properties: ['openFile'],
    filters: [
      { name: 'CSV Files', extensions: ['csv', 'CSV'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (canceled || !filePaths.length) return null;

  const src      = filePaths[0];
  const fileName = path.basename(src);
  const destName =
    type === 'bank'      ? 'bank.csv' :
    type === 'credit'    ? 'credit.csv' :
    type === 'il-bank'   ? 'il-bank.csv' :
    type === 'il-credit' ? 'il-credit.csv' :
    'vendor-mapping-override.csv';
  const dest     = path.join(yearDir(year), destName);

  ensureDir(yearDir(year));
  fs.copyFileSync(src, dest);

  // Return content so the renderer can parse it without a second read
  const content = readCSVSmart(dest);
  return { fileName, content };
});

// Persist in-app mappings for a year
ipcMain.handle('data:saveMappings', (_, { year, mappings }) => {
  const d = yearDir(year);
  ensureDir(d);
  fs.writeFileSync(path.join(d, 'mappings.json'), JSON.stringify(mappings, null, 2), 'utf-8');
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
