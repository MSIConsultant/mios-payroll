# MIOS Payroll — Product Requirements Document

> **Positioning (revised 2026-06-12):** A two-user internal tool for MSI
> Consultant International — the dev (Ral) and the MSI accountant. The former
> multi-tenant SaaS ambition is **dropped**; it drove most of the app's
> complexity (registration/approval, invites, staff roles, notifications) with
> no second tenant to justify it. That scaffolding was removed in 2026-06.
>
> Status flags reflect the codebase as of 2026-06-12 and are verified against
> the repo — not aspirational. Don't rank work off this checklist alone;
> confirm priorities against real accountant friction.

## Product Vision
MIOS Payroll stores employee data per client company and calculates Indonesian
payroll correctly — PPh 21 (TER + last-month Pasal 17 equalization), BPJS,
THR/bonus — with a transparent breakdown the accountant can defend, plus slip
generation, SPT export, Excel-history import, and an audit trail.

**Compact, easy, fast.** Anything that doesn't serve the accountant's monthly
run across his client companies is out of scope.

## Target Users
- **Dev (Ral)** — System owner/operator. Full access, `/dev/admin`.
- **Accountant (MSI staff)** — Does the actual monthly work: manages companies
  and employees, runs/locks payroll, imports Excel history, prints slips,
  exports SPT.

There are no other users. Accounts are created manually in Supabase; there is
no self-registration.

## Core Problems Solved
1. **Indonesian payroll math is hard** (TER, BPJS, grossup, December
   equalization) — the engine does it automatically, is locked by a test suite,
   and is pinned to the accountant's own workbook (RALO regression test).
2. **The accountant lives in Excel across many companies** — MIOS is a
   structured, auditable alternative that preserves the exact monthly math and
   mirrors his REKAP-sheet December reconciliation (including negative PPh Des).
3. **Years of historical payroll are scattered across spreadsheets** — MIOS
   bulk-imports them with per-employee reconciliation against the engine.

---

## Regulatory Compliance
| Regulation | Implementation |
|---|---|
| PP 58/2023 | TER tables A/B/C |
| PMK 168/2023 | TER method Jan–Nov; Pasal 17 equalization in the last month; **harian via TER** (replaced the pre-2024 Pasal 17 + Rp 450k daily threshold, 2026-05-20) |
| PPh 21 Pasal 17 | December (and mid-year exit) equalization; THR/Bonus selisih method; over-withholding shown as negative PPh Des (lebih potong/setor) |
| PENG-6/PJ.09/2024 + PMK 112/2022 | **Non-NPWP ×1.2 surcharge removed** (NIK = NPWP integration); `punya_npwp` retained for slip/SPT display only |
| BPJS Ketenagakerjaan | JHT 3.7%/2%, JP 2%/1% (cap 10,547,400), JKK/JKM |
| BPJS Kesehatan | 4%/1% (cap 12,000,000) |
| PTKP 2024 | TK0–TK3, K0–K3 |

---

## Feature Requirements

### Auth & Access
- [x] Login for two known accounts (manual creation in Supabase; no self-registration)
- [x] Middleware signs out any session without an approved profile
- [x] Dev hardcoded bypass (no DB lookup)
- [x] Legacy `staff` role still path-blocked by middleware (no longer assignable from the UI)
- [ ] Session timeout handling (idle timeout exists: 8h)

### Companies & Employees
- [x] Company CRUD with NPWP, kota, industri, alamat; archive/restore; guarded hard-delete
- [x] Employee profiles: NIK (KTP/passport), NPWP, PTKP, compensation, BPJS flags
- [x] Karyawan tetap + tidak tetap (harian / bulanan)
- [x] Grossup (PPh ditanggung perusahaan) flag
- [x] `bpjs_basis` override (declared BPJS salary distinct from gaji_pokok)
- [x] Monthly events: THR, bonus, kasbon, potongan, benefit_extra, per-month upah override
- [x] Toggle active/inactive; payroll history per employee
- [ ] Company-level settings (BPJS registration numbers)
- [ ] Contract end date for tidak tetap

### Payroll Engine
- [x] Auto-calculate on page open
- [x] TER method (Jan–Nov)
- [x] Pasal 17 equalization — December **and** mid-year exit (`calculateLastMonth`, M-scaled)
- [x] Harian via TER (PMK 168/2023)
- [x] Grossup iterative convergence (<0.01 threshold)
- [x] BPJS full breakdown (in-bruto vs offslip), with per-employee JKK rate
- [x] THR/Bonus via selisih Pasal 17; included in last-month THP (bugfix 2026-06)
- [x] Over-withholding shown honestly (`lebih_potong` for grossup **and** non-grossup; negative PPh Des like the accountant's sheet)
- [x] December warns which prior months are missing from the saved accumulation
- [x] RALO workbook regression test (engine pinned to the accountant's December numbers)
- [x] Quick-edit employee compensation inline + per-employee recalc
- [x] Save (calculated) → Lock workflow (locked runs immutable)
- [x] YTD ledger (akum_bruto + akum_pph)
- [x] Full per-employee breakdown panel + sortable **Tabel** view with totals row
- [ ] Bulk recalculate all companies for a month
- [ ] Grossup non-convergence warning surfaced to UI (`_converged` flag exists)

### Calculator / Simulasi
- [x] Standalone 12-month payroll calculator (`/simulasi`) — editable per-month ledger, no DB writes
- [x] Per-month overrides + "apply forward"; presets, grossup, BPJS/PTKP toggles
- [x] Transparent December Pasal 17 reconciliation
- [ ] Save / share a scenario

### Export
- [x] Slip gaji PDF (print window, WhatsApp-ready)
- [x] SPT Masa PPh 21 CSV (1721 format, BOM-encoded)
- [x] BPJS export
- [x] Client share link (public, no-auth, 30-day expiry)
- [ ] Bulk slip gaji (all employees in one PDF)
- [ ] Excel export of payroll results

### Import
- [x] Excel import (single file, `Grossup_PPh_21_MM-YYYY.xlsx`)
- [x] Auto-detect month/year from sheet name + filename
- [x] Tetap + Harian sheet parsing; engine reconciliation with diff % per employee
- [x] Permanent import session + records; employee creation by NIK match
- [x] Payroll run creation from import (locked immediately)
- [x] Multi-month / archival bulk import (`/import/bulk`)
- [ ] Import validation template download

### Audit & Logs
- [x] Audit log with workspace + company scope; viewer with filters; CSV export
- [x] Expandable diff view (old vs new values)
- [ ] Log retention policy
- [ ] Log search by date range

### Dashboard & Performance
- [x] Period hero, company status board, recent runs, stats
- [x] Dashboard snapshot RPC (one round-trip, replaces the query waterfall)
- [x] Companies + Batch pages server-rendered with parallel fetches (`lib/cache`)
- [x] Skeleton loaders on all routes
- [x] Optimistic UI on quick-edit
- [ ] Monthly total PPh 21 across all companies on the dashboard

### Mobile
- [x] Mobile sidebar drawer; responsive grids
- [ ] Touch-optimized payroll tables

---

## Removed in the 2026-06 simplification (do not rebuild)
- Self-registration, email verification, approval queue, approval/rejection emails
- Workspace invitations and the onboarding wizard (workspaces are created via SQL when ever needed)
- Staff management UI and per-company staff access control (RLS scaffolding remains in the DB, harmless)
- In-app notifications (bell, unread counts) and Supabase realtime on the dashboard
- Severance/kompensasi module (removed 2026-06-04, before this simplification)

## Non-Goals (Explicit Out of Scope)
- Multi-tenant SaaS, billing, plan tiers, external onboarding — **dropped, not deferred**
- Attendance tracking, leave management, employee self-service, org chart, HR documents
- Payroll disbursement (bank transfer integration)
- Accounting journal entries
- Foreign-worker (TKA) / PPh 26 handling

---

## Success Metrics
- Accountant completes a full monthly payroll for one company in < 5 minutes
- Zero calculation divergence vs the accountant's Excel after reconciliation —
  including December (verified against his REKAP sheet)
- A company's multi-year, multi-month Excel history is fully importable and reconciled
- Audit log covers every payroll-critical action
