# MIOS Payroll — Product Requirements Document

> **Positioning:** Internal-first tool for MSI Consultant International today; a
> multi-tenant SaaS for Indonesian accounting firms is **Phase 2** (see end).
> The multi-tenant primitives (workspaces, capacity caps, RLS isolation) are
> already built as groundwork, but the product is operated internally for now.
>
> Status flags reflect the codebase as of 2026-06 and are verified against the
> repo — not aspirational. Don't rank work off this checklist alone; confirm
> priorities against real accountant friction.

## Product Vision
MIOS Payroll is an Indonesian payroll operating system for accounting
professionals. It runs the full payroll lifecycle for many client companies —
employee onboarding, PPh 21 calculation (TER + December Pasal 17 equalization),
BPJS, slip generation, SPT export, severance, and a legal audit trail — and lets
an accountant migrate years of Excel history into a structured, reconciled store.

**Phase 1 (now):** the internal payroll system for MSI's own accountants.
**Phase 2 (later):** the same system sold to Indonesian KAP / tax consultants.

## Target Users

### Primary
- **Dev (Ral)** — System owner/operator. Full access, user-approval authority, `/dev/admin`.
- **Accountant (MSI staff)** — Workspace owner. Manages companies, runs/locks payroll, imports Excel history, reviews logs.

### Secondary
- **Staff** — Data entry, scoped to assigned companies only. No logs, settings, deletes, imports, or locks.

## Core Problems Solved
1. **Indonesian payroll math is hard** (TER, BPJS, grossup, December equalization, severance) — the engine does it automatically and is locked by a ~700-line test suite.
2. **Accountants live in Excel across many companies** — MIOS is a structured, auditable alternative that preserves the exact monthly math.
3. **Years of historical payroll are scattered across spreadsheets** — MIOS bulk-imports them (multi-file, multi-month) with per-employee reconciliation against the engine, and preserves them permanently.
4. **Multi-user accounting teams have no access control** — MIOS enforces role-based, per-company permissions at the database (RLS), not just the UI.

---

## Regulatory Compliance
| Regulation | Implementation |
|---|---|
| PP 58/2023 | TER tables A/B/C |
| PMK 168/2023 | TER method Jan–Nov; Pasal 17 equalization in the last month; **harian via TER** (replaced the pre-2024 Pasal 17 + Rp 450k daily threshold, 2026-05-20) |
| PPh 21 Pasal 17 | December (and mid-year exit) equalization; THR/Bonus selisih method |
| PENG-6/PJ.09/2024 + PMK 112/2022 | **Non-NPWP ×1.2 surcharge removed** (NIK = NPWP integration); `punya_npwp` retained for slip/SPT display only |
| PP 68/2009 | Severance / kompensasi — progressive PPh 21 final brackets |
| BPJS Ketenagakerjaan | JHT 3.7%/2%, JP 2%/1% (cap 10,547,400), JKK/JKM |
| BPJS Kesehatan | 4%/1% (cap 12,000,000) |
| PTKP 2024 | TK0–TK3, K0–K3 |

---

## Product Priorities

> "Done" means shipped and in production use. The foundational priorities are delivered.

1. **Excel-migration wedge — DONE.** Multi-file / multi-month bulk historical import with engine reconciliation is the core reason an accountant switches off Excel. Live at `/import/bulk`.
2. **Calculation correctness — DONE & guarded.** Engine math is the product's credibility; locked by tests, with transparent December breakdowns.
3. **Tenant isolation — DONE (hardened 2026-06).** Staff are scoped to assigned companies at the RLS layer; capacity caps enforced by DB triggers.

---

## Feature Requirements

### Auth & Access Control
- [x] Registration with email verification
- [x] Approval-gated access (pending → approved/rejected)
- [x] Dev receives Resend email on new registration
- [x] Role system: dev / accountant / staff
- [x] Middleware enforces role-based path access
- [x] Dev hardcoded bypass (no DB lookup)
- [x] Staff blocked from: /logs /settings /staff /dev /import
- [x] **Per-company staff scoping enforced in RLS** (`is_company_member` role-aware; 2026-06 hardening)
- [x] Server-action role guards via `appRole` (defense-in-depth on top of RLS)
- [ ] Session timeout handling
- [ ] 2FA for accountant role (future)

### Workspace & Companies
- [x] Multi-tenant workspace per accountant
- [x] Capacity caps (app + DB triggers): max 2 workspaces/user, max 2 owned/accountant, max 10 staff/workspace
- [x] Login returns user to their previous active workspace
- [x] Company CRUD with NPWP, kota, industri, alamat (staff cannot create)
- [x] Archive/restore companies
- [x] Staff company access control (per company, per staff)
- [ ] Company-level settings (BPJS registration numbers)

### Employee Management
- [x] Employee profiles: NIK (KTP/passport), NPWP, PTKP, compensation, BPJS flags
- [x] Karyawan tetap + tidak tetap (harian / bulanan)
- [x] Grossup (PPh ditanggung perusahaan) flag
- [x] `bpjs_basis` override (declared BPJS salary distinct from gaji_pokok)
- [x] Monthly events: THR, bonus, kasbon, potongan, benefit_extra, per-month upah override
- [x] Toggle active/inactive
- [x] Payroll history per employee
- [ ] Employee photo
- [ ] Contract end date for tidak tetap

### Payroll Engine
- [x] Auto-calculate on page open (no button click needed)
- [x] TER method (Jan–Nov)
- [x] Pasal 17 equalization — December **and** mid-year exit (`calculateLastMonth`, M-scaled)
- [x] Harian via TER (PMK 168/2023)
- [x] Grossup iterative convergence (<0.01 threshold)
- [x] BPJS full breakdown (in-bruto vs offslip), with per-employee JKK rate
- [x] THR/Bonus via selisih Pasal 17
- [x] Over-withholding refund detection (`is_refund` / `refund_amount`)
- [x] Quick-edit employee compensation inline + per-employee recalc
- [x] Save (calculated) → Lock workflow (locked runs immutable)
- [x] YTD ledger (akum_bruto + akum_pph)
- [x] Full per-employee breakdown panel
- [ ] Bulk recalculate all companies for a month
- [ ] Payroll comparison month-over-month
- [ ] Anomaly alerts (e.g. >15% bruto change)
- [ ] `is_estimate` / convergence warnings surfaced to UI (engine sets flags; UI not yet showing them)

### Calculator / Simulasi
- [x] Standalone 12-month payroll calculator (`/simulasi`, "Kalkulator") — editable per-month ledger, computed from real per-month inputs, **no DB writes**
- [x] Per-month overrides (raise, THR, bonus, potongan, not-working months) + "apply forward"
- [x] Presets, grossup, BPJS/PTKP toggles
- [x] Transparent December Pasal 17 reconciliation (Bruto Setahun shown as accumulated months + current month)
- [ ] Save / share a scenario

### Severance / Kompensasi
- [x] Engine: `calculateSeverance` (PP 68/2009; progressive final brackets; full bracket-by-bracket breakdown)
- [ ] UI surface to enter and produce a severance/kompensasi payment
- [ ] `kompensasi_payments` persistence (schema slice pending)

### Export
- [x] Slip gaji PDF (print window, WhatsApp-ready)
- [x] SPT Masa PPh 21 CSV (1721 format, BOM-encoded)
- [x] BPJS export
- [x] Client share link (public, no-auth, 30-day expiry)
- [ ] Bulk slip gaji (all employees in one PDF)
- [ ] e-SPT compatible format
- [ ] Excel export of payroll results

### Import
- [x] Excel import (single file, `Grossup_PPh_21_MM-YYYY.xlsx`)
- [x] Auto-detect month/year from sheet name + filename
- [x] Tetap + Harian sheet parsing
- [x] Engine reconciliation with diff % per employee
- [x] Permanent import session + records in DB
- [x] Employee creation from import (match by NIK)
- [x] Payroll run creation from import (locked immediately)
- [x] **Multi-month / archival bulk import** (`/import/bulk`) — queue many files, per-file period detect, reconcile + save each *(the Excel-migration wedge)*
- [ ] CSV import (employee master data)
- [ ] CSV import (payroll results)
- [ ] Import validation template download

### Audit & Logs
- [x] Audit log table with workspace + company scope
- [x] Logged events: employee CRUD, payroll calculate/save/lock, import, export, permission changes, user approval
- [x] Logs viewer (accountant+) with filter by action/company
- [x] CSV export of audit logs
- [x] Expandable diff view (old vs new values)
- [ ] Log retention policy
- [ ] Log search by date range

### Notifications
- [x] In-app notifications (bell icon, unread count)
- [x] Mark read / mark all read
- [x] Resend email: new registration → dev
- [x] Resend email: approval/rejection → user
- [ ] Resend email: payroll locked → accountant (when staff locks)
- [ ] Push notifications (mobile, future)

### Dashboard
- [x] Period hero (current month/year)
- [x] Company status board (pending/calculated/locked)
- [x] Recent payroll log
- [x] Stats: active companies, employees, runs this month
- [x] Empty state with onboarding guide
- [x] Realtime updates (Supabase channel on payroll_runs)
- [ ] Monthly total PPh 21 across all companies
- [ ] Anomaly detection alerts on dashboard

### Performance
- [x] `unstable_cache` wrappers wired into dashboard, batch, payroll, and layout routes
- [x] Skeleton loaders on all routes
- [x] Auto-calculate payroll on page open
- [x] Optimistic UI on quick-edit
- [ ] Prefetch company data on hover
- [ ] Client-side caching (React Query / SWR) (future)

### Mobile
- [x] Mobile sidebar drawer (hamburger menu)
- [x] Responsive grid layouts
- [ ] Touch-optimized payroll tables
- [ ] PWA manifest

---

## Non-Goals (Explicit Out of Scope)
- Attendance tracking
- Leave management
- Employee self-service portal
- Org chart
- HR document management
- Payroll disbursement (bank transfer integration)
- Accounting journal entries
- Foreign-worker (TKA) / PPh 26 handling — a separate product, out of scope here

---

## Phase 2 — SaaS for Accounting Firms (future, not in scope yet)
When MIOS moves from internal tool to sold product, these become in-scope:
- Subscription/plan tiers (the capacity caps already model this — replace hard-coded limits with a plan column)
- External self-serve onboarding (today onboarding assumes a trusted, dev-approved accountant)
- Public marketing surface + a public version of the `/simulasi` calculator as a lead magnet
- Positioning per the README: built for **KAP and tax consultants** managing multiple client companies (not single-company HR)
- Billing, support, and data-isolation guarantees suitable for external tenants

*Until then, "Dev (Ral)" remains a primary internal user and the external-SaaS language stays in this section only.*

---

## Success Metrics
- Accountant completes a full monthly payroll for one company in < 5 minutes
- Zero calculation divergence vs the accountant's Excel after reconciliation
- A company's multi-year, multi-month Excel history is fully importable and reconciled
- Audit log covers every payroll-critical action
- A staff user can access **only** their assigned companies (enforced and verifiable at the RLS layer)
