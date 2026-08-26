-- Human-confirmed Wreach platform administrators and conservative membership backfill.
-- Local empty databases intentionally skip identity inserts until matching Auth fixtures exist.

do $$
declare
  v_profile_count bigint;
  v_admin_auth_count bigint;
  v_ambiguous text;
  v_unassigned text;
begin
  select count(*) into v_profile_count from public.profiles;
  if v_profile_count > 0 then
    select count(*) into v_admin_auth_count from auth.users
    where id in ('220d30ce-2286-4ec7-b17b-5d871f9fa038'::uuid, '9e62a891-3805-422d-8f41-e65ce69d5a4b'::uuid);
    if v_admin_auth_count <> 2 then
      raise exception 'Security V2 backfill stopped: confirmed platform-admin Auth UUIDs are absent';
    end if;
    select string_agg(format('company=%s users=%s', company_id, user_ids), '; ') into v_ambiguous
    from (select company_id, string_agg(id::text, ',' order by id) user_ids from public.profiles
      where company_id is not null group by company_id having count(*) > 1) candidates;
    if v_ambiguous is not null then
      raise exception 'Security V2 backfill stopped for ambiguous companies: %', v_ambiguous;
    end if;
    select string_agg(id::text, ',' order by id) into v_unassigned from public.profiles
    where company_id is null and id not in ('220d30ce-2286-4ec7-b17b-5d871f9fa038'::uuid, '9e62a891-3805-422d-8f41-e65ce69d5a4b'::uuid);
    if v_unassigned is not null then
      raise exception 'Security V2 backfill stopped for profiles without company: %', v_unassigned;
    end if;
  end if;
end $$;

insert into public.platform_admins (user_id, admin_role, is_active, created_by)
select id, 'owner', true, id from auth.users where id = '220d30ce-2286-4ec7-b17b-5d871f9fa038'::uuid
on conflict (user_id) do update set admin_role = excluded.admin_role, is_active = true, updated_at = now();

insert into public.platform_admins (user_id, admin_role, is_active, created_by)
select id, 'admin', true, '220d30ce-2286-4ec7-b17b-5d871f9fa038'::uuid from auth.users
where id = '9e62a891-3805-422d-8f41-e65ce69d5a4b'::uuid
on conflict (user_id) do update set admin_role = excluded.admin_role, is_active = true, updated_at = now();

insert into public.company_memberships (company_id, user_id, role, status)
select p.company_id, p.id, 'owner', 'active' from public.profiles p
where p.company_id is not null and 1 = (select count(*) from public.profiles peers where peers.company_id = p.company_id)
on conflict (company_id, user_id) do nothing;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_platform_admin(); $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

