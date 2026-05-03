# MIOS Payroll

**Indonesian payroll management platform for accounting professionals.**  
Built for KAP and tax consultants managing multiple client companies — not HR managers.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square)](https://vercel.com)
[![License](https://img.shields.io/badge/License-Private-red?style=flat-square)](#)

---

## What It Does

Most Indonesian payroll software is built for HR departments. MIOS Payroll is built for the **accountant** — the person who manages payroll for 5–20 client companies every month, needs the tax math to be exactly right, and needs to produce compliant documents fast.

**Core capabilities:**
- PPh 21 calculation using TER method (Jan–Nov) and Pasal 17 equalization (December), per PP 58/2023 and PMK 168/2023
- Grossup (PPh ditanggung perusahaan) with iterative convergence formula
- BPJS Ketenagakerjaan and Kesehatan with full employer/employee split
- THR and Bonus via selisih Pasal 17 method
- Non-NPWP employees (×1.2 multiplier)
- Karyawan tetap and tidak tetap (harian/bulanan)
- Slip gaji PDF — print or WhatsApp directly from browser
- SPT Masa PPh 21 CSV export in 1721-I format
- December equalization warning with total PPh projection
- Multi-company batch dashboard — all client statuses on one screen
- Month-over-month anomaly detection (>15% bruto change flagged)
- Import employees directly from existing Excel payroll sheets

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router, TypeScript, Tailwind CSS |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Deployment | Vercel |
| Email | Resend (via Supabase SMTP) |

---

## Regulatory Compliance

| Regulation | Coverage |
|---|---|
| PP 58/2023 | TER tables A/B/C, all brackets |
| PMK 168/2023 | Method implementation, grossup formula |
| PPh 21 Pasal 17 | December equalization, THR/Bonus selisih |
| BPJS Ketenagakerjaan | JHT 3.7%/2%, JP 2%/1% (cap Rp 10,547,400), JKK/JKM |
| BPJS Kesehatan | 4%/1% (cap Rp 12,000,000) |
| PTKP 2024 | TK0–TK3, K0–K3 (Rp 54jt–72jt/year) |

TER tables are complete for all three groups (A/B/C) with 44 brackets each. All rates and caps are sourced from official DJP publications.

---

## Architecture

```
app/
├── (dashboard)/          # Authenticated app shell
│   ├── dashboard/        # Period overview + payroll log
│   ├── batch/            # Multi-company status board
│   ├── companies/        # Company + employee management
│   │   └── [companyId]/
│   │       ├── employees/
│   │       │   ├── [empId]/    # Profile, events, payroll history
│   │       │   ├── new/        # Create employee
│   │       │   └── import/     # Bulk import from Excel
│   │       └── payroll/
│   │           └── [tahun]/[bulan]/  # Payroll run page
│   ├── settings/         # Workspace members, invitations, danger zone
│   ├── dev/              # Dev console (restricted)
│   ├── terms/            # Terms of service
│   └── privacy/          # Privacy policy
├── login/                # Auth
├── register/
├── forgot-password/
├── reset-password/
├── onboarding/           # Workspace creation
└── invite/               # Workspace invitation acceptance

lib/
├── engine/
│   ├── payroll.ts        # Core calculation engine
│   └── constants.ts      # TER tables, PTKP, BPJS rates
├── export/
│   ├── slip-gaji.ts      # PDF generation (print window)
│   └── spt-masa.ts       # SPT Masa CSV export
├── actions/              # Server actions (companies, employees, payroll, workspace)
└── formatters.ts         # NPWP, NIK, nominal, date formatting

components/
├── ui/
│   ├── MiosLogo.tsx      # Brand logo component
│   └── FormattedInput.tsx # NPWP/NIK/nominal/date inputs
└── layout/
    └── NavLinks.tsx      # Collapsible sidebar navigation
```

---

## Database Schema

```sql
workspaces              -- Multi-tenant root
workspace_members       -- User ↔ workspace membership + roles
workspace_invitations   -- Email-based invite tokens (7 day TTL)
workspace_activity      -- Audit log for all workspace actions

companies               -- Client companies per workspace
employees               -- Employee master data + compensation + BPJS flags
employee_events         -- Monthly variables: THR, bonus, potongan, kasbon

payroll_runs            -- Payroll run per company per month (draft/calculated/locked)
payroll_results         -- Per-employee calculation results + result_json snapshot
```

Row Level Security is enabled on all 9 tables. Access is scoped to workspace membership — users cannot read or write data outside their workspace.

---

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Vercel account (for deployment)

### Local Development

```bash
git clone https://github.com/MSIConsultant/mios-payroll-v5
cd mios-payroll-v5
npm install
```

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

```bash
npm run dev
```

### Supabase Setup

1. Create a new Supabase project
2. Run the schema migrations in order from `/supabase/migrations/`
3. Run the RLS policies from `/supabase/rls.sql`
4. Run the helper functions:

```sql
-- Workspace creation trigger (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.create_workspace_for_user(
  p_name text, p_owner_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_workspace_id uuid;
BEGIN
  INSERT INTO workspaces (name, owner_id) VALUES (p_name, p_owner_id) RETURNING id INTO v_workspace_id;
  INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (v_workspace_id, p_owner_id, 'owner') ON CONFLICT DO NOTHING;
  RETURN v_workspace_id;
END; $$;
```

5. Configure Auth → URL Configuration:
   - Site URL: `https://your-domain.vercel.app`
   - Redirect URLs: `https://your-domain.vercel.app/**`

6. (Optional) Configure SMTP via Resend for production emails

### Deploy to Vercel

```bash
vercel --prod
```

Add the same environment variables in Vercel project settings.

---

## Key Design Decisions

**CLI terminal aesthetic** — the entire UI uses monospace fonts, dark backgrounds, and terminal-style data display. This is intentional: accountants are data operators, not casual consumers. Dense, fast, precise.

**Engine correctness over UX polish** — the payroll calculation engine was verified against real accountant Excel sheets before any UI work. The grossup convergence loop runs up to 200 iterations. December equalization fetches actual Jan–Nov saved results from the database.

**Multi-tenant from day one** — every query is scoped to `workspace_id`. RLS enforces this at the database level, not just the application level.

**No HR features** — no attendance tracking, org charts, employee self-service, or leave management. Intentionally out of scope. This is a tool for accountants, not employees.

---

## Payroll Engine

The engine in `lib/engine/payroll.ts` implements three calculation paths:

**`calculateMonthlySalary`** (karyawan tetap, bulan 1–11)
Uses TER rate on monthly bruto. Grossup employees iterate: `pph = (ter × base) / (1 − ter)` until convergence < 0.01.

**`calculateDecember`** (karyawan tetap, bulan 12)
Annualizes: `bs = akum_bruto + base_des`. Applies biaya jabatan (5%, max Rp 500k/month), deducts PTKP, applies Pasal 17 progressive brackets, subtracts pph_jan_nov.

**`calculateFreelance`** (karyawan tidak tetap)
Harian: Rp 450,000/day threshold, PPh = 5% × (upah − PTKP/360) per day.
Bulanan: Annualized Pasal 17 ÷ 12 if monthly income > Rp 4,500,000.

---

## Status

| Feature | Status |
|---|---|
| Auth (register, login, forgot password) | ✅ |
| Workspace + invite system | ✅ |
| Activity log / audit trail | ✅ |
| Company management | ✅ |
| Employee management (all BPJS flags) | ✅ |
| Payroll engine (TER + Pasal 17) | ✅ |
| Grossup iterative convergence | ✅ |
| December equalization | ✅ |
| THR/Bonus selisih method | ✅ |
| Slip gaji PDF | ✅ |
| SPT Masa PPh 21 CSV | ✅ |
| Bulk employee import (Excel) | ✅ |
| Multi-company batch dashboard | ✅ |
| Anomaly detection | ✅ |
| Row Level Security (all tables) | ✅ |
| Mobile responsive | ⚠️ Desktop-first |
| Import from e-SPT | ❌ Planned |
| Client read-only share link | ❌ Planned |

---

## License

Private — MSI Consultant International. Not open source.  
Contact: msiconsultant.international@gmail.com

---

*Built with [Next.js](https://nextjs.org), [Supabase](https://supabase.com), and [Vercel](https://vercel.com).*  
*PP 58/2023 · PMK 168/2023 · PPh 21 TER Method*
