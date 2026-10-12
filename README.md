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
