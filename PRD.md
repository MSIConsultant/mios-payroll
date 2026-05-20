# MIOS Payroll — Product Requirements Document

## Product Vision
MIOS Payroll is an internal-first Indonesian payroll operating system built for accounting professionals at MSI Consultant International. It handles the full payroll lifecycle for multiple client companies — from employee onboarding to PPh 21 calculation, slip generation, SPT export, and legal audit trails. Long-term it evolves into a multi-tenant SaaS platform for Indonesian accounting firms.

## Target Users

### Primary
- **Dev (Ral)** — System owner. Full access. User approval authority.
- **Accountant (MSI Staff)** — Workspace owner. Manages companies, runs payroll, reviews logs.

### Secondary
- **Staff** — Data entry. Assigned companies only. No logs, no settings, no deletes.

## Core Problems Solved
1. Indonesian payroll calculation is complex (TER method, BPJS, grossup, December equalization) — the engine handles this automatically
2. Accountants currently manage multiple companies in Excel — MIOS provides a structured, auditable alternative
3. Historical payroll data is scattered — MIOS imports and preserves it permanently with reconciliation trails
4. No proper access control for multi-user accounting teams — MIOS provides role-based company-level permissions

---

## Regulatory Compliance
| Regulation | Implementation |
|---|---|
| PP 58/2023 | TER tables A/B/C (44 brackets each) |
| PMK 168/2023 | TER method Jan–Nov, Pasal 17 December |
| PPh 21 Pasal 17 | December equalization, THR/Bonus selisih |
| BPJS Ketenagakerjaan | JHT 3.7%/2%, JP 2%/1% (cap 10,547,400), JKK/JKM |
| BPJS Kesehatan | 4%/1% (cap 12,000,000) |
| PTKP 2024 | TK0–TK3, K0–K3 |

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
- [ ] Session timeout handling
- [ ] 2FA for accountant role (future)

### Workspace & Companies
- [x] Multi-tenant workspace per accountant
- [x] Max 2 workspaces per user
- [x] Company CRUD with NPWP, kota, industri, alamat
- [x] Archive/restore companies
- [x] Staff company access control (per company, per staff)
- [ ] Company-level settings (BPJS registration numbers)

### Employee Management
- [x] Employee profiles: NIK, NPWP, PTKP, compensation, BPJS flags
- [x] Karyawan tetap + tidak tetap (harian/bulanan)
- [x] Grossup (PPh ditanggung perusahaan) flag
- [x] Monthly events: THR, bonus, kasbon, potongan, benefit_extra
- [x] Toggle active/inactive
- [x] Payroll history per employee
- [x] Contextual back button (from payroll → employee → back to payroll)
- [ ] Employee photo
- [ ] Contract end date for tidak tetap

### Payroll Engine
- [x] Auto-calculate on page open (no button click needed)
- [x] TER method (Jan–Nov)
- [x] Pasal 17 equalization (December)
- [x] Grossup iterative convergence (200 iterations, <0.01 threshold)
- [x] Non-NPWP ×1.2 multiplier
- [x] BPJS full breakdown (in bruto vs offslip)
- [x] THR/Bonus via selisih Pasal 17
- [x] Quick-edit employee compensation inline (no page navigation)
- [x] Per-employee recalculation after quick-edit
- [x] Save (calculated) → Lock workflow
- [x] YTD ledger (collapsible, shows akum_bruto + akum_pph)
- [x] Full CLI-style breakdown per employee
- [ ] Bulk recalculate all companies for a month
- [ ] Payroll comparison month-over-month
- [ ] Anomaly alerts (>15% bruto change)

### Export
- [x] Slip gaji PDF (print window, A5, WhatsApp-ready)
- [x] SPT Masa PPh 21 CSV (1721-I format, BOM-encoded)
- [x] Client share link (public, 30-day expiry)
- [ ] Bulk slip gaji (all employees in one PDF)
- [ ] e-SPT compatible format
- [ ] Excel export of payroll results

### Import
- [x] Excel import (Grossup_PPh_21_XX-YYYY.xlsx format)
- [x] Auto-detect month from sheet name and filename
- [x] Tetap + Harian sheet parsing
- [x] Engine reconciliation with diff % per employee
- [x] Permanent import session + records in DB
- [x] Employee creation from import (match by NIK)
- [x] Payroll run creation from import (locked immediately)
- [ ] CSV import (employee master data)
- [ ] CSV import (payroll results)
- [ ] Multi-month historical import
- [ ] Import validation template download

### Audit & Logs
- [x] Audit log table with workspace + company scope
- [x] Logged events: employee CRUD, payroll calculate/save/lock, import, export, permission changes, user approval
- [x] Logs viewer (accountant only) with filter by action/company
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
- [x] Recent payroll log (last 10 runs)
- [x] Stats: active companies, employees, runs this month
- [x] Empty state with onboarding guide
- [x] Realtime updates (Supabase channel on payroll_runs)
- [ ] Monthly total PPh 21 across all companies
- [ ] Anomaly detection alerts on dashboard

### Performance
- [x] `unstable_cache` on companies/employees/payroll queries
- [x] Skeleton loaders on all routes
- [x] Auto-calculate payroll on page open (no manual trigger)
- [x] Optimistic UI on quick-edit
- [ ] Prefetch company data on hover
- [ ] React Query / SWR for client-side caching (future)

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

---

## Success Metrics
- Accountant can complete full monthly payroll for 1 company in < 5 minutes
- Zero calculation errors vs accountant's Excel (after reconciliation)
- All historical data importable from Excel
- Audit log covers every payroll-critical action
