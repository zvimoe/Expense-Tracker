# Finance Dashboard 2025

An offline-first Electron + React desktop app for visualising personal finances from CSV exports.

## Features

- Load bank and/or credit-card CSV files from disk — no cloud, no storage, fully offline
- Vendor tab — searchable/sortable aggregate table with CSV export
- Categories tab — spending summary table + interactive donut chart; click any slice or row to drill into a per-vendor bar chart
- All Transactions tab — paginated (50 rows/page) table with date range, category, source and amount filters

## Tech stack

| Layer | Library |
|---|---|
| Desktop shell | Electron 32 |
| UI | React 18 + Tailwind CSS 3 |
| CSV parsing | PapaParse 5 |
| Charts | Chart.js 4 + react-chartjs-2 5 |
| Bundler | Vite 5 |

## Quick start

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Install

```bash
cd finance-dashboard
npm install
```

### Development (hot reload)

```bash
npm run dev
```

Vite starts on `http://localhost:5173` and Electron opens pointing at it.
Any change to a React file reloads the window instantly.

### Production build

```bash
npm run dist
```

Runs `vite build` then `electron-builder`. The packaged installer is written to `release/`.

## CSV column mapping

The parser auto-detects column names using an alias table, so you don't need to rename anything.

### Credit card (your format)

| CSV column | Maps to |
|---|---|
| `Transaction Date` | date |
| `Description` | vendor |
| `Category` | category |
| `Debit` | amount (positive = spent) |
| `Credit` | amount (negative = received) |

`Posted Date`, `Card No.` are ignored.

### Bank (your format)

| CSV column | Maps to |
|---|---|
| `Transaction Date` | date |
| `Transaction Description` | vendor |
| `Transaction Amount` | amount magnitude |
| `Transaction Type` | sign — `Credit` → received (negative), `Debit` → spent (positive) |

`Account Number`, `Balance` are ignored.
`Transaction Type` is **not** used as a category; bank rows show as "Uncategorized".

## Amount sign convention

| Value | Meaning | Displayed as |
|---|---|---|
| positive | money spent (debit) | plain number |
| negative | money received (credit) | green with `+` prefix |

## Folder structure

```
finance-dashboard/
├── electron/
│   ├── main.js       # BrowserWindow, IPC file-picker handler
│   └── preload.js    # contextBridge — exposes window.electronAPI.openFile()
├── src/
│   ├── index.html
│   ├── index.jsx     # React root + Chart.js registration
│   ├── App.jsx       # Top-level shell: file-load phase → dashboard phase
│   ├── components/
│   │   ├── FileLoader.jsx        # Landing screen with two CSV pickers
│   │   ├── VendorTable.jsx       # Tab 1 — sortable vendor aggregate + CSV export
│   │   ├── CategorySummary.jsx   # Tab 2 — category table + donut chart
│   │   ├── VendorDrilldown.jsx   # Modal — horizontal bar chart + transaction list
│   │   └── TransactionTable.jsx  # Tab 3 — paginated, filterable transaction list
│   ├── utils/
│   │   ├── parseCSV.js   # PapaParse wrapper + normalisation + mergeAndSort
│   │   └── colors.js     # 10-colour shared palette
│   └── styles/
│       └── index.css     # Tailwind directives
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```
