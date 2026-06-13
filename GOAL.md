# GOAL — the north star

> The accountant opens the app, picks a company database, and immediately sees payroll
> clearly: this month's sheet with a transparent breakdown per employee, and the year's
> REKAP with December reconciled — faster and clearer than CoreTax or Excel.
> **Anything that doesn't serve this is out.**

Mental model: Microsoft Access — each company is a "database" (seedable from the
accountant's Excel workbook, format in `samples/`), and the app is the helpful UI over it.

## Constraints (non-negotiable)

- `lib/engine/*` is untouched. The calculation is verified correct (incl. grossup) and
  pinned by 55 Vitest tests, including a regression against the accountant's own workbook
  (`samples/Grossup PPh 21 RALO.xlsx`). Any engine change starts with a failing test.
- No DB schema changes during the revamp. Server actions, RLS, and exports stay.
- Every PR starts with a "Goal check" paragraph and passes the verification workflow
  (local triad: `npm run lint` / `npm test -- --run` / `npm run build`, then accountant
  click-through on the Vercel preview) before the next phase begins. CI is currently
  billing-locked on GitHub — the local triad is the real gate.

## Phase ledger

| Phase | Scope | Status |
|---|---|---|
| PR 1 | Month page decomposition (pure refactor) + this file | done (#70) |
| PR 2 | Company workbook shell (tabs: Bulan / REKAP / Karyawan / Data) | done (#71) |
| PR 3 | REKAP year view + breakdown drawer | done (#72) |
| PR 4 | Home = company database list; slim nav | done (#73) |
| PR 5 | Seed a company database from Excel (bulk import + create company) | done (#74) |
| PR 6 | Deletions, permanent redirects, docs rewrite | done (#75) |

The revamp is complete. The app is now company-workbook shaped: Home lists the
company "databases"; each company has Bulan / REKAP / Karyawan / Data tabs.
Future work should preserve this IA and the engine/no-schema-change constraints.

Full plan: see the approved plan in the PR descriptions; method is goal-biased,
compartmentalized specs verified per phase (CLAUDE.md → Working Style).
