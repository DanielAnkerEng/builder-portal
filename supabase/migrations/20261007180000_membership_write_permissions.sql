-- Deploy only after the old direct create-customer writer is in maintenance
-- and its in-flight operations are reconciled. The new invitation RPCs write
-- as their SECURITY DEFINER owner, not through service_role table privileges.
begin;

do $guard$
begin
  if not exists(select 1 from pg_class where oid='public.company_memberships'::regclass
    and relowner='postgres'::regrole and relrowsecurity and relforcerowsecurity)
    or exists(select 1 from pg_roles where rolname='service_role' and rolsuper)
    or not has_table_privilege('service_role','public.company_memberships','SELECT') then
    raise exception using errcode='42501', message='MEMBERSHIP_ACL_UNEXPECTED_BASELINE';
  end if;

  -- Do not silently repair PUBLIC, inherited or SET ROLE paths. This migration
  -- is deliberately limited to the four direct table grants below.
  if exists(
    select 1 from pg_class c,
      lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    where c.oid='public.company_memberships'::regclass
      and a.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
      and a.grantee<>'service_role'::regrole
      and case when a.grantee=0 then true else
        pg_has_role('service_role',a.grantee,'USAGE') or pg_has_role('service_role',a.grantee,'SET') end
  ) or exists(
    -- Built-in roles such as pg_write_all_data can confer writes without an
    -- explicit per-table ACL. Also inspect roles reachable only by SET ROLE.
    select 1 from pg_roles r where r.oid<>'service_role'::regrole
      and (pg_has_role('service_role',r.oid,'USAGE') or pg_has_role('service_role',r.oid,'SET'))
      and (r.rolsuper
        or has_table_privilege(r.oid,'public.company_memberships','INSERT')
        or has_table_privilege(r.oid,'public.company_memberships','UPDATE')
        or has_table_privilege(r.oid,'public.company_memberships','DELETE')
        or has_table_privilege(r.oid,'public.company_memberships','TRUNCATE'))
  ) then
    raise exception using errcode='42501', message='MEMBERSHIP_ACL_ALTERNATIVE_TABLE_GRANT';
  end if;
  if exists(
    select 1 from pg_attribute c, lateral aclexplode(c.attacl) a
    where c.attrelid='public.company_memberships'::regclass and c.attnum>0 and not c.attisdropped
      and a.privilege_type in ('INSERT','UPDATE')
      and case when a.grantee=0 then true else
        pg_has_role('service_role',a.grantee,'USAGE') or pg_has_role('service_role',a.grantee,'SET') end
  ) then
    raise exception using errcode='42501', message='MEMBERSHIP_ACL_ALTERNATIVE_COLUMN_GRANT';
  end if;
end $guard$;

revoke insert, update, delete, truncate on table public.company_memberships from service_role;

do $verify$
begin
  if has_table_privilege('service_role','public.company_memberships','INSERT')
    or has_table_privilege('service_role','public.company_memberships','UPDATE')
    or has_table_privilege('service_role','public.company_memberships','DELETE')
    or has_table_privilege('service_role','public.company_memberships','TRUNCATE')
    or has_any_column_privilege('service_role','public.company_memberships','INSERT')
    or has_any_column_privilege('service_role','public.company_memberships','UPDATE') then
    raise exception using errcode='42501', message='MEMBERSHIP_ACL_EFFECTIVE_WRITE_REMAINS';
  end if;
  if not has_table_privilege('service_role','public.company_memberships','SELECT') then
    raise exception using errcode='42501', message='MEMBERSHIP_ACL_SELECT_MISSING';
  end if;
end $verify$;

-- Deliberately unchanged: SELECT and any existing REFERENCES (FK definition),
-- TRIGGER (trigger installation), MAINTAIN (maintenance operations) privileges.
-- These are NOT ordinary row DML, but remain privileged capabilities; this is
-- not revocation of every privilege or a barrier against owners/superusers.
-- No function grants, default privileges, RLS, role memberships or other tables
-- change. A previously entered SECURITY DEFINER call is not cancelled by ACLs.
commit;
