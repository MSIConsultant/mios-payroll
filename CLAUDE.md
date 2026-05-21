# MIOS Payroll — Claude Code Context

## Project Identity
- **Product**: MIOS Payroll — Internal Indonesian payroll SaaS for MSI Consultant International
- **Live URL**: https://mios-payroll.vercel.app
- **GitHub**: https://github.com/MSIConsultant/mios-payroll-v5
- **Stack**: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase, Vercel

## Developer
- **Dev email**: msiconsultant.international@gmail.com
- **Role**: `dev` in user_profiles — bypasses all auth checks
- **Admin panel**: `/dev/admin`

## Companion docs (read on demand)
- `ARCHITECTURE.md` — system diagrams, request lifecycle, RLS patterns, design decisions. Read before non-trivial architecture changes or when reasoning about caching/realtime/RLS.
- `PRD.md` — product scope, regulatory compliance, feature checklist with `[x]/[ ]` status. Read when scoping a new feature or checking whether something is in/out of scope.
- These are **not** auto-loaded — open them explicitly when relevant. Routine code changes only need this file.

## Deploy workflow

- `main` is **production**. Pushing to `main` auto-deploys to https://mios-payroll.vercel.app — used live by the MSI accountant.
- Never commit directly to `main`. Work on a feature branch (`feat/...`, `fix/...`, `chore/...`) and open a PR.
- Every non-`main` branch gets a Vercel preview URL automatically — share that with the user to verify before merging.
- CI (`.github/workflows/ci.yml`) runs `npm run lint` and `npm run build` on every PR. Required to pass before merge.
- For schema/RLS/middleware/engine changes: extra caution — these can break production for the accountant. Test on the preview URL first.

---

## Stack Details

### Frontend
- Next.js 15 App Router (not Pages Router)
- TypeScript strict mode
- Tailwind CSS v4 — `@import "tailwindcss"` in globals.css (no tailwind.config.ts)
- Plus Jakarta Sans via `next/font/google` in `app/layout.tsx`
- Sonner for toasts
- Lucide React for icons

### Backend
- Supabase (PostgreSQL + Auth + RLS)
- Supabase SSR client — `@supabase/ssr`
- Server actions (`'use server'`) for mutations
- `unstable_cache` from `next/cache` for query caching

### Deployment
- Vercel (auto-deploy on GitHub push)
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` **or** `NEXT_PUBLIC_SUPABASE_ANON_KEY` (either works — `middleware.ts` and `lib/env.ts` accept both), `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`

---

## Critical Rules

### Next.js 15
- `params` in dynamic routes is a Promise: `{ params: Promise<{ id: string }> }` — always `await params`
- Server components are async by default
- Client components need `'use client'` at top
- Never import server actions into client components that use Node.js APIs

### Tailwind v4
- No `tailwind.config.ts` — configuration is in CSS
- First line of `globals.css` must be `@import "tailwindcss"`
- Custom CSS variables defined in `:root {}`

### React Rules
- `useState`, `useMemo`, `useEffect` and all functions that access props MUST be inside the component function body
- Pure helper functions (no hooks, no props) are safe outside component
- Never use `useState` at module level

### Supabase RLS
- All tables have RLS enabled
- Never use recursive subqueries in RLS policies (causes silent failures)
- Dev reads all profiles via `get_all_profiles()` security definer function
- `workspace_members` has `user_email` column (avoids RLS join to auth.users)

---

## Database Schema

### How schema changes happen
- `supabase/schema.sql` is the **base snapshot** (incomplete per AUDIT.md — to be regenerated from production as a separate audit-cleanup task).
- Schema changes after the snapshot live in `supabase/migrations/YYYY-MM-DD-name.sql` — one file per change set. Each file is self-contained, wraps work in `BEGIN/COMMIT`, and includes a commented-out rollback block.
- Apply by pasting the file into the Supabase SQL editor and clicking Run. There is no auto-apply / no migration library; tracking lives in git.

### Core Tables
```
workspaces              — Multi-tenant root
workspace_members       — user_id, workspace_id, role, user_email
workspace_invitations   — token-based invites
workspace_activity      — activity log

user_profiles           — id, email, role (dev/accountant/staff), status, workspace_id
company_staff_access    — staff_user_id, company_id, workspace_id

companies               — workspace_id, name, npwp_perusahaan, aktif
employees               — company_id, nik, nama, gaji_pokok, bpjs flags, etc.
employee_events         — tipe (thr/bonus/kasbon/pot_lain/benefit_extra), nilai

payroll_runs            — company_id, tahun, bulan, status (draft/calculated/locked)
payroll_results         — run_id, employee_id, bruto, pph, thp, result_json
payroll_share_links     — token, run_id, expires_at

audit_logs              — workspace_id, actor_id, action, entity_type, old_values, new_values
notifications           — recipient_id, type, title, read
import_sessions         — file_name, bulan, tahun, summary
import_records          — session_id, original_data, recalculated_data, differences
```

### Key SQL Functions
```sql
-- Workspace creation (SECURITY DEFINER)
create_workspace_for_user(p_name, p_owner_id, p_owner_email) returns uuid

-- Dev reads all profiles (SECURITY DEFINER — avoids recursive RLS)
get_all_profiles() returns setof user_profiles

-- Membership helpers
is_workspace_member(ws_id) → boolean
is_company_member(co_id) → boolean
```

### Fix Dev Profile (run if locked out)
```sql
update user_profiles
set role = 'dev', status = 'approved', approved_at = now()
where email = 'msiconsultant.international@gmail.com';
```

---

## File Structure

> Verified against the repo. If a path here doesn't match reality, fix the file or this doc — don't fork.

```
app/
├── layout.tsx                  — Root layout, Plus Jakarta Sans via next/font
├── loading.tsx
├── not-found.tsx
├── globals.css                 — @import "tailwindcss" FIRST
├── (dashboard)/
│   ├── layout.tsx              — Client, sidebar (mobile+desktop), role-aware nav
│   ├── loading.tsx
│   ├── page.tsx
│   ├── dashboard/page.tsx      — Server, stats, mission board, payroll log, realtime
│   ├── batch/page.tsx          — Multi-company status board
│   ├── companies/
│   │   ├── page.tsx            — Company list (staff-filtered)
│   │   ├── loading.tsx
│   │   ├── new/page.tsx
│   │   └── [companyId]/
│   │       ├── page.tsx        — Company detail + employee table
│   │       ├── employees/
│   │       │   ├── new/page.tsx
│   │       │   └── [empId]/page.tsx — Profile, events, payroll history
│   │       └── payroll/
│   │           ├── page.tsx
│   │           └── [tahun]/[bulan]/page.tsx — Auto-calc, quick-edit, YTD, breakdown
│   ├── dev/                    — Dashboard-shell dev tools (separate from app/dev/)
│   ├── import/
│   │   ├── page.tsx            — Import history
│   │   ├── new/page.tsx        — Import wizard (Excel only; xlsx package)
│   │   └── [sessionId]/page.tsx — Reconciliation detail
│   ├── staff/page.tsx          — Staff management + company access control
│   ├── logs/
│   │   ├── page.tsx            — Server gate (accountant+ only)
│   │   └── LogsClient.tsx      — Filterable audit log + CSV export
│   ├── notifications/page.tsx
│   └── settings/page.tsx
├── dev/
│   └── admin/
│       ├── page.tsx            — Server gate (dev email only)
│       └── AdminPanel.tsx      — Approve/reject users, system stats
├── share/[token]/page.tsx      — Public payroll summary (no auth)
├── pending-approval/page.tsx   — Auto-refresh every 10s
├── onboarding/page.tsx         — 4-step guided setup
├── login/page.tsx
├── register/page.tsx
├── forgot-password/page.tsx
├── reset-password/page.tsx
├── auth/                       — Supabase auth callback handlers
├── oauth/                      — OAuth callback handlers
├── invite/                     — Workspace invite acceptance flow
└── api/
    └── notify-registration/route.ts — Resend email on new signup

lib/
├── engine/
│   ├── payroll.ts              — calculateMonthlySalary, calculateDecember, calculateFreelance
│   └── constants.ts            — TER A/B/C tables, PTKP, BPJS rates
├── export/
│   ├── slip-gaji.ts            — Print window PDF
│   └── spt-masa.ts             — SPT Masa PPh 21 CSV (BOM-encoded)
├── actions/
│   ├── companies.ts            — CRUD + revalidateTag
│   ├── employees.ts            — parseFields, createEmployee (aktif=true), updateEmployee (delete aktif)
│   ├── payroll.ts              — savePayrollRun, lockPayrollRun, deletePayrollRun
│   ├── workspace.ts            — createWorkspace, sendInvite, acceptInvite
│   ├── staff.ts                — grantCompanyAccess, revokeCompanyAccess
│   ├── admin.ts                — approveUser, rejectUser, suspendUser
│   ├── import.ts               — saveImport, getImportHistory, getImportSession
│   ├── notify.ts               — Resend email (approval, rejection, payroll lock)
│   └── share.ts                — createShareLink
├── hooks/
│   └── useWorkspace.ts         — workspace from user_profiles  (NOTE: also a copy in /hooks/ at repo root)
├── supabase/
│   ├── client.ts               — createClient (browser)
│   ├── server.ts               — createClient (server)
│   └── types.ts                — DB type helpers
├── types/
│   └── roles.ts                — UserRole, UserStatus, UserProfile, CAN helper
├── audit.ts                    — audit() helper, AuditAction type
├── cache.ts                    — unstable_cache wrappers
├── env.ts                      — hasSupabaseEnv() guard (accepts PUBLISHABLE_KEY or ANON_KEY)
├── format.ts                   — formatRupiah
├── formatters.ts               — NPWP, NIK, nominal, date formatting
├── types.ts                    — Company, Employee, EmployeeEvent types
└── utils.ts                    — General helpers (cn, etc.)

hooks/                          — Root-level hooks (separate from lib/hooks/)
├── use-mobile.ts
├── useUserProfile.ts           — profile + role + canDo
└── useWorkspace.ts             — duplicate of lib/hooks/useWorkspace.ts (consolidate when touching)

components/
├── SetupRequired.tsx           — Renders when Supabase env vars missing
├── ui/
│   ├── MiosLogo.tsx            — SVG 2×2 quadrant mark (M=red, I=blue, O=green, S=dark); exports MiosLogoAuth
│   ├── FormattedInput.tsx      — NpwpInput, NpwpCompanyInput, NikInput, NominalInput, DateInput
│   └── Skeleton.tsx            — SkeletonCard, SkeletonTable, SkeletonStats, SkeletonPage
└── layout/
    ├── NavLinks.tsx            — Role-aware nav, collapsible, tooltips on collapsed
    ├── Sidebar.tsx
    └── Topbar.tsx

supabase/
└── schema.sql                  — Source of truth for tables/RLS/functions (managed via Supabase SQL editor; no migrations library)

middleware.ts                   — Auth gate; dev email bypasses status checks; staff blocked from /settings /dev /logs /staff
```

---

## Role System

| Role | Access |
|------|--------|
| `dev` | Everything + `/dev/admin` + approve/reject users |
| `accountant` | Full workspace + logs + staff + settings + import |
| `staff` | Assigned companies only, no logs/settings/delete |

**Registration flow:**
1. Register → Supabase email verify
2. `handle_new_user` trigger creates `user_profiles` with `status = pending_approval`
3. Dev gets Resend email notification
4. Dev approves from `/dev/admin` → user gets email
5. User logs in → onboarding (create workspace) → dashboard

**Dev bypasses middleware** — hardcoded email check, no DB lookup needed.

---

## Payroll Engine

> Tests: `lib/engine/payroll.test.ts` (Vitest). Run with `npm test`. Add a case here before changing any calc.

### Karyawan Tetap — TER Method (PP 58/2023 + PMK 168/2023)
- **Jan–Nov**: `pph = TER_rate × bruto`
- **December**: Pasal 17 equalization using `akum_bruto` from saved results. Without prior data: silently falls back to `base × 12` — known hazard (AUDIT.md MEDIUM #4, to add warning).
- **Grossup**: iterative `pph = (ter × base) / (1 − ter)` until convergence < 0.01, max 200 iterations.
- **Non-NPWP**: ×1.2 multiplier on PPh.

### Karyawan Tidak Tetap
- **Harian** (PMK 168/2023): `pph = TER_rate × monthly_bruto`, looked up by PTKP grup. Replaced the pre-2024 Pasal 17 + Rp 450k daily threshold method on 2026-05-20.
- **Bulanan**: still uses the annualized Pasal 17 / 12 method (`calculateFreelance` mode `bulanan`) — open question whether this should also move to TER; verify against accountant's TIDAK FINAL sheet before changing.

### BPJS — `bpjs_basis` overrides `gaji_pokok`
- Optional `bpjs_basis` field on `KaryawanTetap` (and propagated through `calculateTHRBonus`). When set, JKK/JKM/JHT/JP/Kes calculations use it instead of `gaji_pokok`. Null/undefined preserves the prior behavior.
- Use this when the company has declared a separate (usually lower) salary with BPJS than the actual `gaji_pokok`. Very common in Indonesian payroll. The reconciliation script (`scripts/reconcile-payroll.ts --bpjs-sheet`) showed >5% PPh divergence drops from 53/381 → 10/381 once `bpjs_basis` is threaded through.

### BPJS rates (in `lib/engine/constants.ts`)
- JKK: per-employee rate (0.24%–1.74%) — IN bruto
- JKM: 0.3% employer — IN bruto
- JHT: 3.7% employer (offslip), 2% employee — if `tanggung_jht_k`: IN bruto
- JP: 2% employer (offslip, capped at `JP_MAX_BASIS = 10,547,400`), 1% employee — if `tanggung_jp_k`: IN bruto
- Kes: 4% employer (capped at `KES_MAX_BASIS = 12,000,000`), 1% employee — if `tanggung_kes_k`: IN bruto

### Annual projection (`result.proyeksi.*`)
Every `calculateMonthlySalary` result includes a `proyeksi` block:
- `bruto_setahun`, `biaya_jabatan_setahun`, `netto_setahun`, `pkp_setahun`, `pph_setahun`, `pph_jan_nov_proyeksi`, `pph_desember_proyeksi`

For Jan–Nov these are forecasts (current bruto × 12); for December they are actual values. UI surfaces can read `result.proyeksi.*` uniformly regardless of period.

### THR/Bonus
- Selisih Pasal 17 method (`calculateTHRBonus`).
- Stored separately in `employee_events` (tipe = 'thr' or 'bonus').

### Kompensasi / Severance (PP 68/2009)
- One-off severance payments via `calculateSeverance(KompensasiInput)`.
- PPh 21 final with progressive brackets (cumulative widths): 0% first Rp 50M; 5% next 50M; 15% next 400M; 25% above 500M.
- Non-NPWP applies ×1.2 to the total, not per-bracket.
- Returns the full bracket-by-bracket `breakdown[]` for transparency — stored in `kompensasi_payments.result_json` once slice 3 schema lands.
- Categories: `pesangon | penghargaan | manfaat_pensiun | penggantian_hak | other`. All use the same brackets when paid sekaligus.

---

## Design System

> Source of truth: `app/globals.css`. If this section drifts, the CSS wins.

### Colors
- App background: `#0A0A0C` (`--bg-app`)
- Sidebar: `#0C0C0F` (`--bg-sidebar`)
- Page base: `#0E0E11` (`--bg-base`)
- Cards: `#141417` (`--bg-card`), hover `#1A1A1E` (`--bg-card-hover`)
- Inputs: `#111114` (`--bg-input`)
- Terminal/deep: `#080809` (`--bg-deep`)
- Primary accent: `#3B82F6` (`--accent`), dim `#2563EB` (`--accent-dim`), glow `rgba(59,130,246,0.15)` (`--accent-glow`)
- Semantic: green `#4ADE80`, amber `#FBB040`, red `#F87171`, sky `#38BDF8` (each has a `*-dim` companion)
- MSI brand: red `#E02020`, blue `#1B4FA8`, green `#2DB44A`

### Typography
- UI text: Plus Jakarta Sans via `next/font/google` (variable `--font-jakarta`, weights 400–800)
- Data/terminal: `font-mono` → Courier New only
- Never use monospace for UI labels, nav, or body text

### CSS Variables (in globals.css)
```css
--bg-app, --bg-sidebar, --bg-base, --bg-card, --bg-card-hover, --bg-input, --bg-deep
--border-strong, --border-default, --border-subtle
--text-primary, --text-secondary, --text-muted, --text-ghost
--accent, --accent-dim, --accent-glow
--green, --green-dim, --amber, --amber-dim, --red, --red-dim, --sky, --sky-dim
--mios-red, --mios-blue, --mios-green
```

Global Tailwind overrides in `globals.css` remap `text-zinc-*` to the semantic text vars so contrast stays AA — don't undo these.

---

## Known Issues / Gotchas

1. **`aktif` field**: `createEmployee` forces `aktif = true`. `updateEmployee` deletes `aktif` from fields to never change it during edit.

2. **Boolean parsing**: `parseFields` in `employees.ts` defaults all booleans to `false`. Unchecked checkboxes don't appear in FormData.

3. **December equalization**: fetches Jan–Nov saved `payroll_results` from DB. Must have saved those months first.

4. **Share link RLS**: `payroll_share_links` has `for select using (true)` — fully public. Uses `result_json` for employee names (avoids RLS on employees table).

5. **Workspace creation**: uses `create_workspace_for_user` RPC (SECURITY DEFINER) to bypass RLS on `workspaces` INSERT.

6. **Cache invalidation**: after mutations, call `revalidateTag('companies-{workspaceId}')` and `revalidateTag('employees-{workspaceId}')`.

7. **Resend from domain**: use `onboarding@resend.dev` unless a custom domain is verified in Resend.

8. **`NEXT_PUBLIC_APP_URL`**: must be set in Vercel env vars for share links to work.

---

## Common SQL Fixes

```sql
-- Fix dev profile
update user_profiles set role='dev', status='approved', approved_at=now()
where email='msiconsultant.international@gmail.com';

-- Activate all employees (if import created them with aktif=false)
update employees set aktif=true where aktif=false;

-- Check workspace linkage
select id, email, role, status, workspace_id from user_profiles;
```

---

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=    # or NEXT_PUBLIC_SUPABASE_ANON_KEY — either is accepted
NEXT_PUBLIC_APP_URL=https://mios-payroll.vercel.app
RESEND_API_KEY=re_xxxxxxxx
```

---

## Pre-Flight Checks (before editing)

1. **Read the file first** — never write code for a file you haven't seen
2. **Check imports** — verify imported functions/types exist before using them
3. **Check the boundary** — is this a Server Component, Client Component, or Server Action?
4. **Next.js 15** — `params` is a Promise, always `await params`
5. **Run a mental TS check** — will this actually compile?

## DO NOT

- Don't add `console.log` to committed code
- Don't use `any` (exception: spreading into engine functions where the input is a wide union)
- Don't write a full page without reading the existing version first
- Don't push schema changes directly to main without testing locally
- Don't store secrets in code
- Don't use `@google/genai` — removed from project
- Don't add npm packages without checking current deps first
- Don't use `localStorage` in server components
- Don't call server actions that use Node.js APIs from client components — use an API route instead
- Don't introduce recursive subqueries in RLS policies (silent failures); use SECURITY DEFINER functions when admin needs to bypass RLS

## PR Checklist

- [ ] Read all affected files before writing
- [ ] `npm run build` passes (TypeScript clean)
- [ ] No `console.log` left in
- [ ] Server actions verify auth before mutating
- [ ] Cache invalidated after mutations (`revalidateTag` + `revalidatePath`)
- [ ] Audit logged for payroll-critical actions
- [ ] `loading.tsx` exists for new routes
- [ ] Mobile layout tested (resize to 375px)
- [ ] Error/empty states handled

## When Stuck

1. Read the file with the error
2. Walk the import chain
3. Check the server/client boundary
4. `npm run build` to surface TS errors
5. Check Supabase logs for RLS failures
6. Check Vercel function logs for runtime errors