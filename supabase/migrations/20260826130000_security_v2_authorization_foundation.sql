-- Wreach Security V2: additive identity and authorization foundation.
-- This migration intentionally does not promote any platform administrator and
-- does not infer company ownership from legacy profile data.

create extension if not exists citext with schema extensions;

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists username extensions.citext,
  add column if not exists status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

update public.profiles
set display_name = coalesce(nullif(btrim(full_name), ''), nullif(btrim(email), ''), 'Wreach user')
where display_name is null or btrim(display_name) = '';

alter table public.profiles
  alter column display_name set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_status_check
      check (status in ('active', 'suspended', 'deactivated')) not valid;
    alter table public.profiles validate constraint profiles_status_check;
  end if;
end
$$;

create unique index if not exists profiles_username_unique
  on public.profiles (username)
  where username is not null;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete restrict,
  admin_role text not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_admins_role_check check (admin_role in ('owner', 'admin'))
);

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null,
  status text not null default 'active',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_memberships_role_check
    check (role in ('owner', 'company_admin', 'publisher', 'editor', 'viewer')),
  constraint company_memberships_status_check
    check (status in ('invited', 'active', 'suspended', 'removed')),
  constraint company_memberships_company_user_key unique (company_id, user_id)
);

create index if not exists company_memberships_user_active_idx
  on public.company_memberships (user_id, company_id)
  where status = 'active';

create index if not exists company_memberships_company_active_idx
  on public.company_memberships (company_id, role)
  where status = 'active';

alter table public.platform_admins enable row level security;
alter table public.platform_admins force row level security;
alter table public.company_memberships enable row level security;
alter table public.company_memberships force row level security;

create or replace function public.is_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_aal2()
    and exists (
      select 1
      from public.platform_admins pa
      where pa.user_id = auth.uid()
        and pa.is_active
    );
$$;

create or replace function public.is_active_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_aal2()
    and auth.uid() is not null
    and exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = p_company_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    );
$$;

create or replace function public.has_company_role(p_company_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_aal2()
    and auth.uid() is not null
    and p_roles <@ array['owner', 'company_admin', 'publisher', 'editor', 'viewer']::text[]
    and exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = p_company_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
        and cm.role = any(p_roles)
    );
$$;

revoke all on function public.is_aal2() from public, anon;
revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.is_active_company_member(uuid) from public, anon;
revoke all on function public.has_company_role(uuid, text[]) from public, anon;

grant execute on function public.is_aal2() to authenticated, service_role;
grant execute on function public.is_platform_admin() to authenticated, service_role;
grant execute on function public.is_active_company_member(uuid) to authenticated, service_role;
grant execute on function public.has_company_role(uuid, text[]) to authenticated, service_role;

revoke all on table public.platform_admins from anon, authenticated;
revoke all on table public.company_memberships from anon, authenticated;
grant select on table public.platform_admins to authenticated;
grant select on table public.company_memberships to authenticated;

drop policy if exists "Security V2 platform admins require AAL2" on public.platform_admins;
create policy "Security V2 platform admins require AAL2"
  on public.platform_admins
  as restrictive
  for select
  to authenticated
  using (public.is_aal2());

drop policy if exists "Security V2 users read own platform admin record" on public.platform_admins;
create policy "Security V2 users read own platform admin record"
  on public.platform_admins
  as permissive
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Security V2 memberships require AAL2" on public.company_memberships;
create policy "Security V2 memberships require AAL2"
  on public.company_memberships
  as restrictive
  for select
  to authenticated
  using (public.is_aal2());

drop policy if exists "Security V2 users read own memberships" on public.company_memberships;
create policy "Security V2 users read own memberships"
  on public.company_memberships
  as permissive
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create or replace view private.security_v2_backfill_candidates
with (security_invoker = true)
as
select
  p.id as user_id,
  p.email,
  p.full_name,
  p.role as legacy_role,
  p.company_id as legacy_company_id,
  p.status
from public.profiles p;

revoke all on private.security_v2_backfill_candidates from public, anon, authenticated;
grant select on private.security_v2_backfill_candidates to service_role;

comment on table public.platform_admins is
  'Trusted Wreach-wide privileges. Never backfill from email, username, or legacy role without human-confirmed Auth UUIDs.';
comment on table public.company_memberships is
  'Individual Auth-user membership in a company. Browser-supplied company IDs are never authoritative.';
comment on view private.security_v2_backfill_candidates is
  'Human-review-only input for Security V2 membership/admin backfill; performs no promotion.';
