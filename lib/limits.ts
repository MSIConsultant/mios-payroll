/**
 * Tenant capacity limits. Enforced in two layers:
 *  1. server actions (these constants) — for clean, localized error messages;
 *  2. DB triggers (supabase/migrations/2026-06-02-workspace-limits.sql) — the
 *     hard backstop that no code path (RPC, onboarding, direct insert) bypasses.
 * Keep the two layers in sync if these numbers change.
 */

/** Max non-owner members (staff) per workspace. The owner is not counted. */
export const MAX_STAFF_PER_WORKSPACE = 10;

/** Max workspaces an accountant may own. dev is unlimited. */
export const MAX_WORKSPACES_PER_ACCOUNTANT = 2;

/** Max workspaces a single user may belong to (as member or owner). */
export const MAX_WORKSPACES_PER_USER = 2;
