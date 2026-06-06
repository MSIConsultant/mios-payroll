-- 2026-06-06-get-all-profiles-revoke-public.sql
-- Correction to 2026-06-03-rpc-scoping-fixes.sql.
--
-- That migration tried `REVOKE EXECUTE ON FUNCTION get_all_profiles() FROM anon`,
-- but `anon` never had a DIRECT grant — EXECUTE is held via PUBLIC (the function
-- ACL shows `=X/postgres`, i.e. PUBLIC=EXECUTE). A REVOKE ... FROM anon is a
-- no-op against a PUBLIC grant, so anon could still invoke the function.
--
-- Data was NOT leaking — the in-body guard returns 0 rows unless the caller's
-- user_profiles.role = 'dev' — but anon being able to call it at all is the
-- surface we meant to close. Revoke from PUBLIC and grant explicitly to the
-- roles that legitimately call it (authenticated → the dev; service_role).
--
-- Idempotent and safe to run on top of the prior migration.

begin;

revoke execute on function public.get_all_profiles() from public;
grant  execute on function public.get_all_profiles() to authenticated;
grant  execute on function public.get_all_profiles() to service_role;

commit;

-- Verify (expect anon = f, authenticated = t):
--   select has_function_privilege('anon','public.get_all_profiles()','EXECUTE') as anon,
--          has_function_privilege('authenticated','public.get_all_profiles()','EXECUTE') as authed;

-- ROLLBACK (restores prior, weaker state):
-- begin;
-- grant execute on function public.get_all_profiles() to public;
-- commit;
