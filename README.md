# Budget Tracking

A responsive personal budget tracker with monthly income and expenses, spending categories, budget limits, transaction search, deletion, and CSV export.

## Development

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

Run `npm test` for calculation and validation tests, and `npm run build` for a production build. `npm run preview` serves the built application.

Data is stored in this browser's local storage. No login, server database, or synchronization is included. CSV export downloads the selected month's transactions. Changing currency changes formatting only; it does not convert amounts. Web fonts are optional; the interface falls back to system fonts offline.

## Importing an application database

Use **Upload Excel / JSON** to select a Durgamatha `.xlsx` workbook with `Expenses` and `Member Funds` sheets, or a `budget-tracking-database-v1` JSON file. Imports are processed privately in the current browser; the file is not sent to a server. Reimporting replaces the source snapshot and its generated transactions, preserving manually entered transactions. Only paid expense amounts enter transaction totals; unpaid balances, payer, funding source, remarks, reimbursement amounts, due dates, and member records remain available in the source snapshot panel. Opening funds and undated member cash contributions use the reporting month's first day, explicitly labeled as an assumption. The snapshot panel does not change when you edit the separate transaction ledger. Database backup exports the source snapshot.

Excel imports preserve the workbook's advance formula: all payments attributed to each member, less reimbursements. This includes collected-fund payments and can double-count liabilities. PDF-derived JSON uses the Personal Advance-only rule instead. The source panel labels the active rule. Recalculate and save formula results in Excel before importing. The Excel reader loads only when an Excel file is selected.

## Deployment

The current GitHub Pages site serves the `gh-pages` branch at its root. The built files have been published to that branch. The optional Actions deployment workflow requires selecting **GitHub Actions** in repository Pages settings; it cannot deploy while Pages uses branch publishing. The production build uses `/Budget-Tracking/` as its asset base.
