# MIOS Payroll — Architecture Document

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                    Vercel (Edge)                     │
│  ┌──────────────┐    ┌──────────────────────────┐   │
│  │  Middleware  │───▶│   Next.js 15 App Router  │   │
│  │  (auth gate) │    │   Server + Client comps  │   │
│  └──────────────┘    └────────────┬─────────────┘   │
└───────────────────────────────────┼─────────────────┘
                                    │
              ┌─────────────────────┼──────────────────┐
              │                     │                   │
    ┌─────────▼──────┐   ┌─────────▼──────┐   ┌───────▼──────┐
    │   Supabase DB  │   │  Supabase Auth │   │    Resend    │
    │  (PostgreSQL)  │   │  (email verify)│   │   (email)    │
    │  RLS on all    │   │                │   │              │
    └────────────────┘   └────────────────┘   └──────────────┘
```

## Request Lifecycle

```
Browser Request
     │
     ▼
middleware.ts ──── dev email? ──── return response (bypass)
     │                    No
     ▼
auth.getUser() ──── no user? ──── redirect /login
     │
     ▼
user_profiles lookup ──── pending/rejected? ──── redirect /pending-approval
     │
     ▼
role check ──── staff on blocked path? ──── redirect /dashboard
     │
     ▼
Next.js renders page (server component)
     │
     ├── Server Component: fetches data with unstable_cache
     │        └── Supabase server client (reads cookies)
     │
     └── Client Component: hydrates, subscribes to realtime
              └── Supabase browser client
```

## Data Flow

### Write (Mutation)
```
User Action (form/button)
     │
     ▼
Server Action ('use server')
     ├── createClient() — server supabase
     ├── auth.getUser() — verify session
     ├── DB mutation
     ├── audit() — write to audit_logs
     ├── revalidateTag() — bust cache
     └── revalidatePath() — trigger re-render
```

### Read (Query)
```
Server Component render
     │
     ▼
unstable_cache wrapper
     ├── HIT: return cached data (TTL: 20–300s)
     └── MISS: Supabase query → cache → return
```

### Realtime
```
DashboardRealtime (client component)
     │
     ▼
supabase.channel('dashboard-{workspaceId}')
     ├── postgres_changes on payroll_runs
     └── on change: router.refresh() — debounced 800ms
```

## Multi-Tenancy

Every table is scoped to `workspace_id`. RLS enforces this at the database level:

```
user → workspace_members → workspace_id
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
          companies         audit_logs      notifications
              │
     ┌────────┼────────┐
     │        │        │
employees  payroll  import_sessions
     │      runs
  events   results
```

Staff additionally scoped via `company_staff_access`:
```
staff user → company_staff_access → company_id
                                         │
                              (can only see these companies)
```

## Caching Strategy

| Data | TTL | Invalidation |
|---|---|---|
| workspace | 300s | on workspace update |
| companies | 60s | on company CRUD |
| employees | 60s | on employee CRUD |
| payroll runs | 30s | on calculate/save/lock |
| dashboard | 20s | on any payroll change |

Cache keys use workspace/company IDs to prevent cross-tenant data leaks.

## Payroll Engine Architecture

```
calculateMonthlySalary(input: KaryawanTetap)
     │
     ├── calculateBPJS(input)
     │        ├── employer: JKK, JKM, Kes_e (→ in bruto)
     │        ├── employee tunj: JHT_k, JP_k, Kes_k (→ in bruto if tanggung)
     │        └── employee pot: JHT_k, JP_k, Kes_k (→ potong from gaji)
     │
     ├── build base (gaji + allowances + bpjs_in_bruto)
     │
     ├── if grossup:
     │        iterate: pph = (ter × base) / (1 − ter)
     │        until |pph_new − pph_old| < 0.01 (max 200 iterations)
     │        bruto = base + tunj_pph
     │
     ├── if December:
     │        fetch akum_bruto + pph_jan_nov from payroll_results
     │        annualize, apply Pasal 17 brackets, subtract pph_jan_nov
     │
     └── return { bruto, pph, thp, bpjs, ter, ... }
```

## Security Model

### Authentication
- Supabase Auth handles tokens, refresh, email verification
- Middleware reads session cookie on every request
- Dev email hardcoded in middleware — no DB dependency for auth

### Authorization (RLS)
```sql
-- Pattern: workspace-scoped
create policy "workspace_member_only" on table_name
  for select using (is_workspace_member(workspace_id));

-- Pattern: self-only (user_profiles)
create policy "own_row" on user_profiles
  for select using (auth.uid() = id);

-- Pattern: public read (share links)
create policy "public_read" on payroll_share_links
  for select using (true);

-- Pattern: security definer (bypass RLS for admin)
create function get_all_profiles()
  security definer ...
```

### Audit Trail
Every payroll-critical action writes to `audit_logs`:
- actor_id, actor_email, actor_role
- action (enum)
- entity_type, entity_id, entity_name
- old_values, new_values (JSONB)
- workspace_id, company_id

Logs are immutable — no delete policy on audit_logs.

## Email Architecture

```
Event occurs (register/approve/reject/lock)
     │
     ▼
lib/actions/notify.ts
     │
     ▼
fetch('https://api.resend.com/emails', { POST })
     │
     ├── from: onboarding@resend.dev (or verified domain)
     ├── to: recipient email
     └── html: styled template
```

Registration notification uses `/api/notify-registration` route
(client component → API route → Resend) because server actions
with `fetch` can't be called directly from client components in all contexts.

## Import/Reconciliation Architecture

```
Excel file (.xlsx)
     │
     ▼
Client-side parser (XLSX only — PapaParse / CSV not installed; PRD lists CSV as future work)
     ├── parseTetap(sheet) → ParsedEmp[]
     └── parseHarian(sheet) → ParsedEmp[]
          │
          ▼
reconcileEmployee(emp, bulan, tahun)
     ├── runs engine (calculateMonthlySalary)
     ├── compares engine result vs Excel values
     └── diff_pct = |engine_bruto - excel_bruto| / excel_bruto × 100
          │
          ▼
saveImport(payload) — server action
     ├── upsert employees (match by NIK)
     ├── create payroll_run (status: locked)
     ├── insert payroll_results (from Excel values)
     ├── create import_session
     ├── create import_records (original + recalculated + diff)
     └── audit('IMPORT_COMPLETED')
```

## Key Design Decisions

### Server vs Client Components
- **Server**: data fetching, auth checks, initial render
- **Client**: interactivity, realtime subscriptions, modals, form state
- **Pattern**: server fetches → passes as props → client handles interaction

### Why Not tRPC/React Query
Current scale (1–5 users) doesn't need the complexity. Server actions + `unstable_cache` covers the use case. Add React Query if concurrent users exceed 20.

### Why Not Edge Runtime
Supabase SSR client requires Node.js runtime. Middleware uses Edge but dashboard pages use Node.js runtime.

### Monorepo vs Single Repo
Single repo for now. Split into `packages/engine` when engine is reused by other products (e.g., mobile app, API).

## Future Architecture (SaaS Scale)

```
Current:  1 workspace → 1 accountant → N companies
Future:   N workspaces → N accountants → N companies each
                │
                ├── Billing per workspace (Stripe)
                ├── Custom SMTP per workspace
                ├── White-label branding per workspace
                └── API access per workspace
```

Database already supports this — all queries are workspace-scoped.
