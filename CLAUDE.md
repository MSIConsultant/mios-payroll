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

## Working Style

> Process rules for *how* features are built (not what to build).

### Agent-team pattern for full-stack features
For complex features spanning Supabase (backend) and the Next/Vercel frontend, use a lead + teammates split:
- **Teammate A** — scoped strictly to Supabase migrations + RLS policies.
- **Teammate B** — frontend UI logic.
- **Lead (Claude)** — defines the integration contract (RPC/table shape, response JSON, RLS expectations) **before** delegating, then synthesizes both halves and verifies the seams.

Only spin up the team for a concrete, named feature — not speculatively. Subagents are stateless cold starts that report back to the lead; the lead owns the contract between them so the two halves don't drift. Supabase DDL via MCP is read-only — a teammate writes the migration file, the dev applies it in the SQL editor.

### BMAD — spec before code for higher-risk work
For higher-risk changes (RLS/policies, auth, payroll engine, schema, middleware), follow **BMAD** instead of going straight to code:
1. **Brainstorm** — enumerate approaches and edge cases.
2. **Model** — write the spec: data/contract shape, RLS expectations, states.
3. **Adversarial** — attack the spec: who can read/write what they shouldn't? what contradicts existing policies or the Vercel deployment? what breaks at the boundaries?
4. **Design** — finalize the contract, then implement.

The point is to catch security holes in Supabase policies and design contradictions **before** any code is written.

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
- `supabase/schema.sql` is the **base snapshot** (incomplete — to be regenerated from production as a separate cleanup task).
- Schema changes after the snapshot live in `supabase/migrations/YYYY-MM-DD-name.sql` — one file per change set. Each file is self-contained, wraps work in `BEGIN/COMMIT`, and includes a commented-out rollback block.
- Apply by pasting the file into the Supabase SQL editor and clicking Run. There is no auto-apply / no migration library; tracking lives in git.

### Core Tables
```
workspaces              — Multi-tenant root
workspace_members       — user_id, workspace_id, role, user_email
workspace_invitations   — token-based invites
workspace_activity      — activity log

user_profiles           — id, email, role (dev/accountant/staff), status,
                          workspace_id (= ACTIVE workspace; N:N membership
                          lives in workspace_members. Update only via the
                          `setActiveWorkspace` server action so SSR pages
                          stay in sync.)
company_staff_access    — staff_user_id, company_id, workspace_id

companies               — workspace_id, name, npwp_perusahaan, aktif
employees               — company_id, nik (KTP or passport), nama, jabatan, alamat,
                          gaji_pokok, bpjs flags, etc.
employee_events         — tipe (thr/bonus/kasbon/pot_lain/benefit_extra/
                          upah_bulanan_override), nilai. The override tipe
                          is unique per (employee, tahun, bulan) via partial
                          index — used for per-month tidak_tetap_bulanan upah.

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
│   ├── batch/                  — Multi-company status board (server page + BatchClient island)
│   ├── companies/
│   │   ├── page.tsx            — Server fetch (parallel, lib/cache) → CompaniesClient
│   │   ├── CompaniesClient.tsx — Search/filter island
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
│   ├── logs/
│   │   ├── page.tsx            — Server gate (accountant+ only)
│   │   └── LogsClient.tsx      — Filterable audit log + CSV export
│   └── settings/page.tsx       — Company danger zone + workspace activity log
├── dev/
│   └── admin/
│       ├── page.tsx            — Server gate (dev email only)
│       └── AdminPanel.tsx      — User admin, system stats
├── share/[token]/page.tsx      — Public payroll summary (no auth)
├── login/page.tsx
├── forgot-password/page.tsx
├── reset-password/page.tsx
├── auth/                       — Supabase auth callback handlers
└── oauth/                      — OAuth callback handlers

lib/
├── engine/
│   ├── payroll.ts              — calculateMonthlySalary, calculateLastMonth (full-year + mid-year exit), calculateDecember (alias), calculateFreelance, calculateTHRBonus
│   ├── projection.ts           — proyeksi.* helpers (annual forecast block on every result)
│   ├── payroll.test.ts         — Vitest, ~700 lines, locks current math
│   └── constants.ts            — TER A/B/C tables, PTKP, BPJS rates
├── export/
│   ├── slip-gaji.ts            — Print window PDF
│   └── spt-masa.ts             — SPT Masa PPh 21 CSV (BOM-encoded)
├── actions/
│   ├── companies.ts            — CRUD + revalidateTag
│   ├── employees.ts            — parseFields, createEmployee (aktif=true), updateEmployee (delete aktif)
│   ├── payroll.ts              — savePayrollRun, lockPayrollRun, deletePayrollRun
│   ├── workspace.ts            — setActiveWorkspace, getWorkspaceActivity
│   ├── admin.ts                — approveUser, rejectUser, suspendUser
│   ├── import.ts               — saveImport, getImportHistory, getImportSession
│   ├── notify.ts               — Resend email (approval, rejection, payroll lock)
│   └── share.ts                — createShareLink
├── auth/
│   └── assertAccess.ts         — assertAuth, assertWorkspaceAccess, assertCompanyAccess, assertRunAccess (defense-in-depth gates for server actions)
├── supabase/
│   ├── client.ts               — createClient (browser)
│   ├── server.ts               — createClient (server)
│   └── types.ts                — DB type helpers
├── types/
│   └── roles.ts                — UserRole, UserStatus, UserProfile, CAN helper
├── audit.ts                    — audit() helper, AuditAction type
├── cache.ts                    — unstable_cache wrappers
├── env.ts                      — hasSupabaseEnv() guard, getAppUrl() canonical app URL
├── format.ts                   — formatRupiah
├── formatters.ts               — NPWP, NIK, nominal, date formatting
├── types.ts                    — Company, Employee, EmployeeEvent types
└── utils.ts                    — General helpers (cn, etc.)

hooks/                          — Root-level hooks (sole location post audit-hardening)
├── use-mobile.ts
├── useUserProfile.ts           — profile + role + canDo
└── useWorkspace.ts             — workspace + workspaces[] + switchWorkspace (from workspace_members)

components/
├── SetupRequired.tsx           — Renders when Supabase env vars missing
├── ui/
│   ├── MiosLogo.tsx            — SVG 2×2 quadrant mark (M=red, I=blue, O=green, S=dark); exports MiosLogoAuth
│   ├── FormattedInput.tsx      — NpwpInput, NpwpCompanyInput, NikInput, NominalInput, DateInput
│   └── Skeleton.tsx            — SkeletonCard, SkeletonTable, SkeletonStats, SkeletonPage
└── layout/
    └── NavLinks.tsx            — Role-aware nav, collapsible, tooltips on collapsed

supabase/
└── schema.sql                  — Source of truth for tables/RLS/functions (managed via Supabase SQL editor; no migrations library)

middleware.ts                   — Auth gate; dev email bypasses checks; non-approved profiles signed out; staff blocked from /settings /dev /logs /import
```

---

## Role System

| Role | Access |
|------|--------|
| `dev` | Everything + `/dev/admin` |
| `accountant` | Full workspace + logs + settings + import |
| `staff` | Legacy role; may exist in DB but no longer assignable from the UI. Middleware still blocks it from /settings /dev /logs /import |

**Account creation (registration flow removed 2026-06):**
- Self-registration, approval queue, invites, onboarding wizard, staff management, and in-app notifications were all removed — the app serves exactly two users (dev + accountant).
- New accounts are created manually in the Supabase dashboard (Auth → Add user), then given an approved profile + workspace membership via the SQL editor (`create_workspace_for_user` RPC still exists for this).
- Middleware signs out any session whose profile is missing or not `approved`.

**Dev bypasses middleware** — hardcoded email check, no DB lookup needed.

---

## Payroll Engine

> Tests: `lib/engine/payroll.test.ts` (Vitest). Run with `npm test`. Add a case here before changing any calc.

### Karyawan Tetap — TER Method (PP 58/2023 + PMK 168/2023)
- **Jan–Nov**: `pph = TER_rate × bruto`
- **Last month (`calculateLastMonth`)**: Pasal 17 equalization using `akum_bruto` from saved results.
  - Full-year December: caller passes `monthsInYear = 12` (default; legacy `calculateDecember` is a thin alias).
  - Mid-year exit (e.g. starts Jun, ends Aug → 3 months): caller passes `isLastMonth: true` and `months_in_year: 3`. Engine scales `biaya_jabatan` cap and per-month iuran by `M`, annualizes the partial-year base correctly.
  - **Fallback**: if `akum_bruto === 0`, falls back to `base × M` and sets `proyeksi.is_estimate: true` (UI shows a warning card). Separately, the December page queries `payroll_runs` for which prior months are saved and shows a red banner naming the missing months — partial accumulation (e.g. 8 of 11 months saved) is the dangerous silent case.
  - **THP**: includes `thr + bonus` paid in the last month (bugfix 2026-06, matches the monthly formula).
- **Over-withholding (PPh Des negatif)**: if `pph_jan_nov > pph_setahun`, the on-slip `pph` is clamped to `0`. The engine sets `lebih_potong: <positive>` for BOTH grossup (kelebihan setor perusahaan) and non-grossup (refund karyawan; also `is_refund: true`, `refund_amount`); `raw_pph` carries the honest negative. The UI shows the negative amount like the accountant's REKAP sheet. The RALO workbook regression test in `payroll.test.ts` pins this case to the accountant's exact numbers.
- **Grossup**: iterative `pph = (ter × base) / (1 − ter)` until convergence < 0.01, max 200 iterations. If `ter ≥ 1`, the loop breaks with a stale value — no warning surfaced yet.
- **Non-NPWP**: ×1.2 surcharge **removed 2026-05-29** per PENG-6/PJ.09/2024 + NIK=NPWP integration (PMK 112/2022). `punya_npwp` is preserved on the engine input for slip-gaji / SPT Masa display but no longer multiplies PPh. For TKA without Indonesian NPWP, PPh 26 routing is the correct path (deferred — `pph_26` column added by `2026-05-29-tka-pph26-fields.sql`).

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

---

## Design System

> Source of truth: `app/globals.css`. If this section drifts, the CSS wins.
> Current iteration: **v3 — Light, modern SaaS aesthetic, WCAG AA throughout.**
> The earlier dark/terminal aesthetic (`#0A0A0C` surfaces, Courier New) was retired.

### Colors
- App background: `#F6F7F9` (`--bg-app`)
- Surfaces: `#FFFFFF` (`--bg-base`, `--bg-sidebar`, `--bg-card`, `--bg-input`)
- Subtle/hover blocks: `#F3F4F6` (`--bg-subtle`)
- Borders: `#D1D5DB` strong, `#E5E7EB` default, `#EEF0F3` subtle
- Brand: `#2563EB` (`--brand`), hover `#1D4ED8` (`--brand-hover`), tinted bg `#EFF4FF` (`--brand-soft`), focus ring `rgba(37,99,235,0.18)` (`--brand-ring`)
- Text (all WCAG AA verified on white): `#0F172A` primary (17:1), `#334155` secondary (11:1), `#64748B` muted (4.8:1), `#94A3B8` faint (3:1 — decorative only, never body)
- Semantic, each with paired `*-soft` + `*-border`: green `#16A34A`, amber `#B45309`, red `#DC2626`, sky `#0369A1`
- MSI brand (logo only): red `#E02020`, blue `#1B4FA8`, green `#2DB44A`

### Typography
- UI text: Plus Jakarta Sans via `next/font/google` (variable `--font-jakarta`, weights 400–800)
- Tabular data: `font-mono` → `ui-monospace, JetBrains Mono, SF Mono, Consolas` with `tabular-nums`
- Use `font-mono` **only** for amounts (rupiah), NPWP/NIK, period codes. Not for UI labels, nav, or body.

### CSS Variables (in globals.css)
```css
--bg-app, --bg-base, --bg-sidebar, --bg-card, --bg-subtle, --bg-input, --bg-overlay
--border-strong, --border-default, --border-subtle
--text-primary, --text-secondary, --text-muted, --text-faint
--brand, --brand-hover, --brand-soft, --brand-ring
--green, --green-soft, --green-border
--amber, --amber-soft, --amber-border
--red,   --red-soft,   --red-border
--sky,   --sky-soft,   --sky-border
--shadow-sm, --shadow-md, --shadow-lg, --shadow-xl, --shadow-focus
--mios-red, --mios-blue, --mios-green
```

### Compatibility shims (in globals.css)
Legacy dark-themed classes used by unconverted pages are remapped to v3 vars so they remain legible:
- `text-zinc-100..900` → various `--text-*` vars (note: `zinc-700..900` map to `--text-faint`, which is **3:1** — fine for large/decorative text, fails AA for body. Audit per page before treating as final.)
- Dark backgrounds (`#0A0A0B`, `#141417`, etc.) → `--bg-card` (white)
- Dark borders (`#1A1A1C`, etc.) → `--border-default`

Don't undo these shims; rewrite the legacy classes instead when touching a page.

---

## Known Issues / Gotchas

1. **`aktif` field**: `createEmployee` forces `aktif = true`. `updateEmployee` deletes `aktif` from fields to never change it during edit.

2. **Boolean parsing**: `parseFields` in `employees.ts` defaults all booleans to `false`. Unchecked checkboxes don't appear in FormData.

3. **Last-month equalization** (`calculateLastMonth`): fetches Jan–(M-1) saved `payroll_results` from DB. Must have saved those months first. December absorbs every rupiah of divergence from prior months — the page warns when specific months are missing and when `akum_bruto === 0` (estimate fallback), but saved months with *different inputs* than reality still produce a wrong December with no warning.

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