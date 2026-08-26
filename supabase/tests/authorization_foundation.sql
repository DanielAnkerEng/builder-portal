begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

select has_table('public', 'platform_admins', 'platform_admins exists');
select has_table('public', 'company_memberships', 'company_memberships exists');
select has_column('public', 'profiles', 'display_name', 'profiles has display_name');
select has_column('public', 'profiles', 'username', 'profiles has username');
select has_column('public', 'profiles', 'status', 'profiles has status');
select has_column('public', 'profiles', 'updated_at', 'profiles has updated_at');
select has_function('public', 'is_aal2', array[]::text[], 'is_aal2 exists');
select has_function('public', 'is_platform_admin', array[]::text[], 'is_platform_admin exists');
select has_function('public', 'is_active_company_member', array['uuid'], 'membership helper exists');
select has_function('public', 'has_company_role', array['uuid', 'text[]'], 'role helper exists');
select row_eq(
  $$select relrowsecurity, relforcerowsecurity from pg_class where oid = 'public.platform_admins'::regclass$$,
  row(true, true),
  'platform_admins has forced RLS'
);
select row_eq(
  $$select relrowsecurity, relforcerowsecurity from pg_class where oid = 'public.company_memberships'::regclass$$,
  row(true, true),
  'company_memberships has forced RLS'
);
select ok(not has_table_privilege('anon', 'public.platform_admins', 'SELECT'), 'anon cannot read platform_admins');
select ok(not has_table_privilege('anon', 'public.company_memberships', 'SELECT'), 'anon cannot read memberships');
select ok(not has_table_privilege('authenticated', 'public.platform_admins', 'INSERT'), 'authenticated cannot insert platform admins');
select ok(not has_table_privilege('authenticated', 'public.company_memberships', 'INSERT'), 'authenticated cannot insert memberships');
select ok(not has_function_privilege('anon', 'public.is_platform_admin()', 'EXECUTE'), 'anon cannot execute admin helper');
select is((select count(*) from public.platform_admins), 0::bigint, 'migration guesses no platform admins');

select * from finish();
rollback;

