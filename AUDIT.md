# MIOS Payroll — Audit & Recommendations

> **⚠ Partially superseded by the 2026-05-21 audit plan and `feat/audit-hardening` (PR #14).**
>
> Items already addressed since this doc was written:
> - **UI section** — the dark CLI/terminal aesthetic critique no longer applies; `globals.css` is now Design System v3 (light, WCAG-anchored). Most "WCAG contrast failures" listed below are resolved by the v3 palette.
> - **`text-zinc-700..900` mapped to `--text-ghost`** — the variable was renamed `--text-faint` and contrast was raised from ~1.7:1 to ~3:1 (still fails AA for body text; see updated CLAUDE.md Design System).
> - **Engine test suite missing** — `lib/engine/payroll.test.ts` now exists (~700 lines).
> - **Engine features** — `calculateLastMonth` (mid-year exit), `calculateSeverance` (PP 68/2009), `is_refund`, and the annual `proyeksi.*` block have all landed since this audit.
> - **PR #14 (`feat/audit-hardening`)** added `assertCompanyAccess`/`assertWorkspaceAccess` helpers across companies/employees/payroll actions, HTML-escaped `/api/notify-registration`, raised the password floor to 12 chars with complexity, and wired `lib/cache.ts` into the dashboard route (only).
>
> Still open (treat the 2026-05-21 audit plan as the live tracker):
> - Server-side payroll calc + Zod (§4.1)
> - Audit log coverage in payroll/companies/share actions (§4.6)
> - Case-insensitive email in `acceptInvite`/`sendInvite` (§4.7)
> - `audit()` errors silently swallowed (§4.10)
> - Share-link RLS expiry (§4.11)
> - Rate limiting (§4.12)
> - Schema/types regeneration (§5.2, §5.4)
> - Duplicate `useWorkspace` hooks (§5.3)
> - Column drift `run_by` vs `calculated_by`/`locked_by` (§5.5)
> - Engine warnings: `_converged`, `is_estimate` (§5.9, §5.10)
> - `lib/cache.ts` wiring on companies/batch pages (§5.1)
> - Payroll page server-component shift, Tabel view, ConfirmDialog (§7.3–7.5)

**Date:** 2026-05-20
**Scope:** Code quality, architecture, UI/UX. No code changes; this document is recommendations only.
**Methodology:** Three parallel subagent audits against the live `main` branch, plus a separate verification pass. Convergent findings (spotted independently by 2+ audits) are flagged with **⇢ convergent**.

---

## TL;DR

The payroll engine math is solid. The architecture around it is **less defended than the docs claim** in three specific ways that you should know about before scaling past your current client count:

1. **The tax numbers are calculated in the user's browser and saved server-side verbatim.** A user with DevTools can edit them. This is the single highest-impact bug in the app.
2. **Server actions don't verify workspace ownership in code** — they trust Supabase RLS entirely. RLS is good defense, but it's the *only* defense, and `supabase/schema.sql` (the supposed source of truth) is missing ~8 tables and **all RLS policies**, so the actual security posture is not auditable from the repo.
3. **The advertised caching layer (`lib/cache.ts`) is dead code** — nothing imports it. Every page hits the DB fresh on every render. At 50 companies × 100 employees, the dashboard will get slow.

UI/UX-wise: the engine works for the accountant but the **CLI/terminal aesthetic gets in his way**. The payroll page renders 50 employees as 50 stacked 190px-tall "terminal blocks" with no sortable table view — the opposite of how an Excel veteran reviews data. Multiple text colors fail WCAG AA on dark backgrounds.

None of this is on fire today. Most of it gets dangerous in the next 10x of usage.

---

## Convergent findings (high confidence)

These were each spotted by two independent audits — treat them as the most reliable signals.

| Finding | Why it matters |
|---|---|
| **Server actions skip workspace_id ownership checks** ⇢ convergent | Action layer trusts RLS exclusively. If RLS regresses (or `schema.sql` and live policies drift further), every mutation becomes a cross-tenant primitive. |
| **`lib/cache.ts` is dead code** ⇢ convergent | All four cached wrappers (`getCachedCompanies`, etc.) are exported but referenced nowhere in `app/`. Meanwhile `revalidateTag('companies-...')` is fired into a void. The "caching strategy" in the docs is fiction. |
| **`supabase/schema.sql` is severely out of date** ⇢ convergent | 178 lines covering 7 tables, **zero RLS policies**. Tables `user_profiles`, `audit_logs`, `payroll_share_links`, `company_staff_access`, `notifications`, `workspace_activity`, `import_sessions`, `import_records` are not in there. `workspace_members.user_email` (which code reads and writes) is also missing. |
| **Two `useWorkspace` hooks with different shapes** ⇢ convergent | `hooks/useWorkspace.ts` reads from `workspace_members`, returns `{workspace, workspaces[], switchWorkspace}`. `lib/hooks/useWorkspace.ts` reads from `user_profiles`, returns `{workspace}`. Staff page uses the second, everything else uses the first → they can see different workspaces for the same user. |
| **Stale `lib/supabase/types.ts`** | Types describe an old single-user world (`companies.user_id`, `payroll_runs.month/year/gross_bruto`). Doesn't match reality. Every Supabase query is implicitly `any`. |

---

## Top recommendations (ranked)

| # | Recommendation | Effort | Why first |
|---|---|---|---|
| 1 | **Move payroll calculation to the server, validate `savePayrollRun` input with Zod** | 2–3 days | Right now the most important numbers in the product are computed in the user's browser and written verbatim. Until this flips, every other quality fix is downstream of a contract you don't control. The client can still compute for live preview — just don't trust it on save. |
| 2 | **Regenerate `schema.sql` from production and commit RLS policies** | half-day | Without this, "RLS protects multi-tenancy" is unverifiable. Use `supabase db dump --schema-only` or the CLI's `supabase gen types typescript` for the types side. Add a one-line CI check that fails if the committed schema is stale. |
| 3 | **Add `assertWorkspaceAccess` helper, call it at the top of every mutating action** | 1 day | Defense-in-depth at the action layer. Cheap, kills #1 from the convergent findings entirely. Pairs naturally with #2 because it makes RLS testable: failures here = RLS gap. |
| 4 | **Delete `lib/cache.ts` or actually wire it up** | half-day to delete, 1–2 days to wire | If you delete it, the docs become honest. If you wire it up, dashboard / batch / companies queries get cached and you reduce Supabase egress meaningfully at scale. |
| 5 | **Add the engine test suite (Vitest)** | 1 day | The engine is pure functions — easy to test. Lock in current correctness with regulation-anchored test cases (TER bracket transitions, December equalization, grossup convergence) before any of the above changes can subtly break it. |

After these five, work returns to feature delivery with much less risk.

---

## Full findings — Code quality

### HIGH

1. **Engine runs in browser, saved server-side without validation** — `app/(dashboard)/companies/[companyId]/payroll/[tahun]/[bulan]/page.tsx:246-303` → `lib/actions/payroll.ts:9` (`results: any[]`). Tax tampering vector. Fix: move calc into the server action; client computes for preview only.
2. **Server actions never verify workspace_id ownership** ⇢ convergent — `lib/actions/payroll.ts`, `companies.ts`, `employees.ts`, `share.ts`. Adds the `assertWorkspaceAccess` helper recommended above.
3. **Grossup non-convergence silently swallowed** — `lib/engine/payroll.ts:142-168`. After 200 iterations, falls through using the last `pph` value with no warning. Also the `mt >= 1.0` break path returns the prior (stale) `pph`. Fix: return `{warning}` field and surface to UI.
4. **December equalization silently fabricates annual base when Jan–Nov is missing** — `lib/engine/payroll.ts:204`. `akum_bruto > 0 ? (akum_bruto + base) : (base * 12)` — fallback to `base*12` runs with no warning, against CLAUDE.md's documented hazard. Fix: require explicit `prior_months_count`; warn unless == 11.
5. **`parseFields` boolean defaulting is fragile** — `lib/actions/employees.ts:35-57`. All 11 BPJS/PPh booleans default to `false`. The QuickEdit modal patches around it manually for the known set; any future partial-update caller will silently wipe BPJS flags. Fix: only set booleans explicitly present in the form, or split into "full vs partial update" actions.
6. **`payroll_runs` column naming drift** — `lib/actions/payroll.ts:19` writes `run_by`, `lib/actions/import.ts:127-129` writes `calculated_by`/`locked_by`. Errors from the import update are not checked. Fix: unify the column name in schema + both actions; capture errors.

### MEDIUM

7. **Duplicate `useWorkspace` hooks** ⇢ convergent (see top of doc).
8. **`hooks/useUserProfile.ts:39-41`** uses `require('@/lib/types/roles')` inside a returned closure. Breaks tree-shaking, CJS-interop hazard. Fix: static import at top.
9. **Stale `lib/supabase/types.ts`** ⇢ convergent — types disabled in practice.
10. **Client over-fetches `payroll_results` on payroll page** — `select('*, payroll_results(*)')` pulls full `result_json` for every employee per page load. ~hundreds of KB for 200-emp company.
11. **`processFile` reads stale `bulan` closure** — `app/(dashboard)/import/new/page.tsx:281`. Period-mismatch hazard on import.
12. **`parseTetap` uses magic column indexes** — `app/(dashboard)/import/new/page.tsx:44-87`. Column-shifted Excel will silently corrupt data; `diff_pct` check only catches gross deviations. Fix: detect header row, map by header text.
13. **Daily-rate inference invents data** — `app/(dashboard)/import/new/page.tsx:109` computes `Math.round(bruto / 22)`. Wrong daily rate persists into `employees.upah_harian` forever after.
14. **`useEffect` exhaustive-deps missing** — payroll page `:239-244`. Auto-calc works "by luck" of `autoCalcRef`.
15. **`createCompany` doesn't verify caller can write to `workspace_id`** — `lib/actions/companies.ts:5-28`. Authenticated user can pass any UUID.
16. **`acceptInvite` case-sensitive email match** — `lib/actions/workspace.ts:88`. Mixed-case email locks legitimate users out.
17. **The 780-line payroll page** — state soup (14 `useState` calls, no reducer); `results.map((res: any) => ...)` with hand-rolled `res.bruto ?? res.total_upah ?? 0`; QuickEditModal carries 17 employee fields manually (duplicates the form schema, source of bug #5).

### LOW

- `audit()` swallows all errors silently (`lib/audit.ts:66`). At minimum add `console.error`.
- `useUserProfile.canDo` defaults to `'staff'` during load — UI flickers permissions.
- Per-month TER calc base doesn't include THR/bonus, but December does. Asymmetry is undocumented — exactly where regression bugs hide.
- `Number(formData.get('nilai'))` in `addEvent` — no validation, NaN silently inserted.
- `useEffect` deps; `crypto.randomBytes` no uniqueness retry; etc.

---

## Full findings — Architecture & structure

### HIGH

1. **`schema.sql` source of truth is severely incomplete** ⇢ convergent — see top of doc.
2. **Server actions skip workspace_id authorization in code** ⇢ convergent — see top of doc.
3. **`lib/cache.ts` is dead code** ⇢ convergent — see top of doc.

### MEDIUM

4. **Audit log coverage is patchy** — only `employees.ts`, `import.ts`, `staff.ts` call `audit()`. Missing in `payroll.ts` (PAYROLL_CALCULATED / SAVED / LOCKED / DELETED never logged despite enum), `companies.ts`, `share.ts` (share-link creation is a data-exposure event — should be logged). `workspace.ts` uses a separate `workspace_activity` table via `logActivity()` instead of unifying.
5. **`getCachedPayrollRuns` cache key not workspace-scoped** — `lib/cache.ts`. If ever wired up, invalidation will cross tenants.
6. **`app/(dashboard)/layout.tsx` is a 187-line client component re-doing middleware's work** — calls `getUser()` + `user_profiles` fetch + notifications count on every navigation, blocks on a spinner. Middleware already proved auth. Fix: convert to server component, pass to small client island for collapse/mobile drawer state.

### LOW

7. **`lib/types.ts` (flat) vs `lib/types/roles.ts` (folder)** — same concern, two patterns. Consolidate.
8. **`lib/format.ts` vs `lib/formatters.ts`** — same. Merge to `lib/format/`.
9. **`parseFields()` silently coerces unknown form fields** — whitelist explicitly.

### Scale bottlenecks (at 50 companies × 100 employees)

- **Dashboard N+1 over `payroll_results`** — `dashboard/page.tsx` fetches every result row for the last 10 runs to compute totals client-side. At 5000 active employees × 2 months, that's 10k rows pulled per render with no cache. Fix: denormalize totals onto `payroll_runs` or add a `payroll_run_totals` view.
- **December equalization fan-out** — payroll detail page fetches `prevRuns` then `payroll_results` for Jan–Nov for every employee on every render. ~1100 result rows for a 100-emp December run pulled to the client before calculation begins. Fix: pre-aggregate YTD into a column or an RPC.

---

## Full findings — UI/UX

### Aesthetic verdict

The terminal/CLI vibe is the **wrong skin on a right idea**. The right idea is "dense monospaced numerics, minimal chrome, keyboard-fast" — an Excel accountant wants exactly that. The wrong skin is the *cosplay* layer: animated scanlines, traffic-light dots on production cards, `$ masuk →` buttons, blinking `_` cursors, `payroll.log` chrome on data blocks, Courier New for navigation and modal headers. To an Indonesian accountant who lives in Excel, Courier reads as "developer toy," not "professional ledger." It's also one of the worst monospace fonts shipped with Windows.

**Recommended shift:** Minimal Swiss + Financial Dashboard palette (from `ui-ux-pro-max` skill). Keep dark mode. Keep monospace **for numbers only**. Replace Courier New with **JetBrains Mono** (or IBM Plex Mono) for numerics, **Inter or Plus Jakarta Sans** for UI.

### WCAG contrast failures (verified)

| Location | Color | Background | Ratio | Status |
|---|---|---|---|---|
| `text-zinc-700` (#3F3F46) on `#080809` — login page "Lupa password?", footer | — | — | **~2.4:1** | Fails AA |
| `--text-ghost: #3A3A42` on `--bg-app: #0A0A0C` — log row chrome | — | — | **~1.7:1** | Fails everything |
| `text-zinc-800` (#27272A) on `#080809` — login footer text | — | — | **~1.6:1** | Fails everything |
| `--text-muted: #6B6B78` on `--bg-card: #141417` — used pervasively | — | — | **~4.4:1** | Borderline (fails AA for 14px) |

The CSS overrides in `globals.css` remap `text-zinc-500/600/700` to `--text-muted` — but those overrides apply only when those literal classes are used; many places use inline color values. Verify with grep.

### Friction by surface

- **Login** — three contrast failures above; `auth.login` chrome adds no value, costs confidence on first impression; `$ masuk` → just say `Masuk`.
- **Dashboard** — `52px font-mono "JANUARI"` header reads as a 1996 invoice; mission board is `grid-cols-2` at all sizes → wall of cards at 30+ companies, want a filterable table; empty-log state doesn't tell user what to do next.
- **Layout shell** — `maxWidth: 1400` then `padding: 32px` on a 1920px monitor wastes ~600px of work area; MIOS-letter pulse loading animation runs on every navigation (should be a skeleton matching destination).
- **Company detail** — **6 buttons** crammed in header, two of them literally say "Import"; full-`font-mono` table including employee names in Courier looks like 1970s tax forms.
- **Payroll page** — each employee is a ~190px tall CLI block; 50 employees = ~9,500px of scrolling, no compare, no sort, no totals row. Excel-veteran instinct is a pivot table. Add `View: [Tabel | Detail]` toggle.
- **Settings** — native `confirm()` / `alert()` in an otherwise themed app; tab label "Kelola Data" is vague (rename to "Perusahaan").

### Design direction options

| Option | Aesthetic | Cost | Notes |
|---|---|---|---|
| **A — Strip the cosplay** | Dark mode + terminal *idea*, drop the costume. Courier → JetBrains Mono (numbers only). Inter for UI. Kill scanlines, traffic dots, `$` prompts, RGB sidebar line. | 1–2 days | Pure find-replace pass. Highest ROI for least risk. |
| **B — Financial console** (recommended) | All of A + sortable table view on payroll page, quick-filter chips on dashboard, custom `<Dialog>` (replaces native `confirm`), sticky action bar. | 1–2 weeks | Highest workflow ROI. The sortable-table-view alone changes how the accountant works. |
| **C — Bento productivity** | Configurable bento dashboard, split-view payroll, light/dark toggle. | 3–4 weeks | Only worth it if MIOS becomes a long-term external product. |

### Quick wins (<1 day each)

1. Replace `text-zinc-700` / `text-zinc-800` on dark backgrounds with `--text-muted` (fixes WCAG failures across ~40 sites).
2. Remove `font-mono` from display headers and the `Nama` column.
3. Add `View: Tabel | Detail` toggle on the payroll page (read-only table is fine for v1).
4. De-duplicate "Import" buttons in company-detail header.
5. Replace native `confirm()` / `alert()` with Sonner-toast confirmations (Sonner is already a dependency).

### If you could change one UI thing

**Give the payroll page a sortable table view.** The per-employee CLI block is beautiful for demoing one employee, actively hostile for reviewing 50. The Excel accountant's reflex is `Ctrl+Shift+L → sort by PPh desc`; the UI should mirror that instinct, not fight it.

---

## Recommended next 3 things to ship

If you do nothing else from this audit, do these in order:

### 1. Lock the engine (1 day)
- Add Vitest, write tests for: TER bracket boundaries (each of A/B/C), PTKP transitions, BPJS basis caps, grossup convergence on a known case, December equalization with and without Jan–Nov history, freelance harian threshold (Rp 450k), non-NPWP ×1.2.
- Add the engine to CI (the new `.github/workflows/ci.yml`).
- This is the **foundation** before any other change — it locks in correctness so future edits can't silently break tax math.

### 2. Server-side calculation + input validation (2–3 days)
- Move `calculateMonthlySalary` / `calculateFreelance` invocation into `savePayrollRun` server-side.
- Validate input with Zod. Re-derive `employee_id`s server-side from `companyId`.
- Client continues to render calculated preview but doesn't post numbers.
- Behind this change, also fix:
  - `assertWorkspaceAccess` helper added and called at top of every mutating action
  - Audit logging added to `payroll.ts`, `companies.ts`, `share.ts` (the gaps the architecture audit found)

### 3. Schema source of truth (half-day) + delete-or-wire-cache decision (half-day)
- `supabase db dump --schema-only > supabase/schema.sql`, commit it.
- `supabase gen types typescript > lib/supabase/types.ts`.
- Add a CI step that diffs current dump vs committed `schema.sql` and fails on drift.
- Decide on `lib/cache.ts`: delete it, or wire up dashboard/batch/companies pages to use it. Update CLAUDE.md / ARCHITECTURE.md to match reality.

After this sequence, the app is **defensibly correct, defensibly multi-tenant, and defensibly documented.** All three claims become true. Then return to features.

---

## Explicitly out of scope (don't do now)

- **Bulk slip gaji PDF** — user has deprioritized.
- **Full UI rewrite (Option C / Bento)** — wait until the product direction is fixed and the accountant has used the existing flow for a quarter.
- **Replacing Supabase / Next.js / Vercel** — stack is fine. The issues are at the app layer, not the platform layer.
- **Adding feature flags / billing / white-labeling** — premature; PRD's future SaaS section can wait.
- **React Query / SWR** — `unstable_cache` covers current scale once it's actually used.
- **Refactoring the 780-line payroll page** — gets resolved naturally when you split it into table-view + detail-drawer (Option B). Don't refactor for its own sake.

---

## Open questions for Ral

1. Where does the accountant *actually* hesitate in his monthly run? The PRD's `[ ]` items are unreliable priority signal — bulk slip gaji proved that. A 20-minute sit-with would refine #2's roadmap above.
2. Is the accountant comfortable with the current dark/terminal aesthetic, or has he said anything? UI/UX Option B assumes he wants a less "developer-toy" feel.
3. Is the `supabase/schema.sql` drift accidental (you never re-dumped after iterating), or intentional (you keep it minimal)? The fix is the same either way, but the answer changes whether to expect more drift in the future.
