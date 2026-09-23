-- New Customer V1 Phase A only: schema/read boundaries; no backfill or write RPC.
begin;

-- Pure validators: no table access, normalization or external requests.
-- Public schema permits CHECK evaluation without granting private schema access.
create function public.new_customer_org_number_valid(v text)
returns boolean language plpgsql immutable strict set search_path = '' as $$
declare total integer := 0; digit integer; weights integer[] := array[3,2,7,6,5,4,3,2];
begin
  if v !~ '^[0-9]{9}$' or v = '000000000' then return false; end if;
  for i in 1..8 loop total := total + substring(v from i for 1)::integer * weights[i]; end loop;
  digit := (11 - total % 11) % 11;
  return digit <> 10 and digit = substring(v from 9 for 1)::integer;
end $$;

create function public.new_customer_url_valid(v text)
returns boolean language sql immutable strict set search_path = '' as $$
  select char_length(v) between 1 and 2048
    and v !~ '[[:space:][:cntrl:]]' and position(chr(92) in v) = 0
    -- Conservative DNS hostname grammar, optional valid port, path/query/fragment.
    -- No userinfo, IP literals, relative URLs or non-http schemes.
    and v ~ '^https?://([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:][:cntrl:]]*)?$'
    and coalesce((substring(v from '^https?://[^/?#:]+:([0-9]{1,5})'))::integer between 1 and 65535, true);
$$;

create function public.new_customer_email_valid(v text)
returns boolean language sql immutable strict set search_path = '' as $$
  select char_length(v) between 3 and 254
    and v !~ '[[:space:][:cntrl:]]'
    and v ~ '^[A-Za-z0-9!#$%&''*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&''*+/=?^_`{|}~-]+)*@([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$'
    and char_length(split_part(v, '@', 1)) <= 64;
$$;

revoke all on function public.new_customer_org_number_valid(text), public.new_customer_url_valid(text), public.new_customer_email_valid(text) from public, anon, authenticated, service_role;
-- Existing company write paths still evaluate these CHECKs during Phase A.
grant execute on function public.new_customer_org_number_valid(text), public.new_customer_url_valid(text), public.new_customer_email_valid(text) to authenticated, service_role;

alter table public.companies
  add column organization_number text,
  add column external_website_url text,
  add column contact_email text,
  add column contact_phone text,
  add column address text,
  add constraint companies_org_number_check check (organization_number is null or public.new_customer_org_number_valid(organization_number)),
  add constraint companies_external_url_check check (external_website_url is null or public.new_customer_url_valid(external_website_url)),
  add constraint companies_contact_email_check check (contact_email is null or public.new_customer_email_valid(contact_email)),
  add constraint companies_contact_phone_check check (contact_phone is null or contact_phone ~ '^[+][1-9][0-9]{7,14}$'),
  add constraint companies_address_check check (address is null or (
    char_length(address) between 1 and 500
    and replace(address, chr(10), '') !~ '[[:cntrl:]]'
    and char_length(address) - char_length(replace(address, chr(10), '')) <= 3
    and address ~ '[^[:space:]]'
  ));
create unique index companies_org_number_unique on public.companies(organization_number) where organization_number is not null;

create table public.company_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  name text not null,
  email text,
  phone text,
  title text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_contacts_name_check check (name = btrim(name) and char_length(name) between 1 and 200 and name !~ '[[:cntrl:]]' and name ~ '[^[:space:]]'),
  constraint company_contacts_email_check check (email is null or public.new_customer_email_valid(email)),
  constraint company_contacts_phone_check check (phone is null or phone ~ '^[+][1-9][0-9]{7,14}$'),
  constraint company_contacts_title_check check (title is null or (title = btrim(title) and char_length(title) between 1 and 120 and title !~ '[[:cntrl:]]' and title ~ '[^[:space:]]'))
);
create index company_contacts_company_idx on public.company_contacts(company_id);
create unique index company_contacts_primary_unique on public.company_contacts(company_id) where is_primary;

create table public.company_services (
  company_id uuid not null references public.companies(id) on delete restrict,
  service_code text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  primary key(company_id, service_code),
  constraint company_services_code_check check (service_code in ('website','website_management','seo','local_seo','google_ads','meta_ads','linkedin_ads','tiktok_ads','social_media','content','analytics'))
);

create table public.company_internal_settings (
  company_id uuid primary key references public.companies(id) on delete restrict,
  lifecycle_status text not null default 'onboarding',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id) on delete restrict,
  constraint company_internal_settings_lifecycle_check check (lifecycle_status in ('onboarding','active','paused','ended'))
);

create table public.company_assignments (
  company_id uuid not null references public.companies(id) on delete restrict,
  responsibility_type text not null,
  assignee_user_id uuid not null references public.platform_admins(user_id) on delete restrict,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(company_id, responsibility_type),
  constraint company_assignments_type_check check (responsibility_type in ('account','seo','marketing','content'))
);

create table private.provisioning_operations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null,
  operation_type text not null default 'company.create.v1',
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  payload_fingerprint bytea not null,
  status text not null default 'pending',
  company_id uuid references public.companies(id) on delete restrict,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(actor_user_id, operation_type, idempotency_key),
  constraint provisioning_operations_type_check check (operation_type = 'company.create.v1'),
  constraint provisioning_operations_fingerprint_check check (octet_length(payload_fingerprint) = 32),
  constraint provisioning_operations_status_check check (status in ('pending','completed','failed')),
  -- Safe code shape only. Phase B will define the operation's error allowlist.
  constraint provisioning_operations_error_check check (error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{0,63}$'),
  constraint provisioning_operations_state_check check (
    (status = 'pending' and company_id is null and error_code is null and completed_at is null)
    or (status = 'completed' and company_id is not null and error_code is null and completed_at is not null)
    or (status = 'failed' and company_id is null and error_code is not null and completed_at is not null)
  )
);

alter table public.company_contacts enable row level security;
alter table public.company_contacts force row level security;
revoke all on public.company_contacts from public, anon, authenticated, service_role;
grant select on public.company_contacts to authenticated;
create policy "company_contacts_active_admin_read" on public.company_contacts
  for select to authenticated using (
    auth.uid() is not null and public.is_aal2() and public.is_platform_admin()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
  );

alter table public.company_services enable row level security;
alter table public.company_services force row level security;
revoke all on public.company_services from public, anon, authenticated, service_role;
grant select on public.company_services to authenticated;
create policy "company_services_active_admin_read" on public.company_services
  for select to authenticated using (
    auth.uid() is not null and public.is_aal2() and public.is_platform_admin()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
  );

alter table public.company_internal_settings enable row level security;
alter table public.company_internal_settings force row level security;
revoke all on public.company_internal_settings from public, anon, authenticated, service_role;
grant select on public.company_internal_settings to authenticated;
create policy "company_internal_settings_active_admin_read" on public.company_internal_settings
  for select to authenticated using (
    auth.uid() is not null and public.is_aal2() and public.is_platform_admin()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
  );

alter table public.company_assignments enable row level security;
alter table public.company_assignments force row level security;
revoke all on public.company_assignments from public, anon, authenticated, service_role;
grant select on public.company_assignments to authenticated;
create policy "company_assignments_active_admin_read" on public.company_assignments
  for select to authenticated using (
    auth.uid() is not null and public.is_aal2() and public.is_platform_admin()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
  );

alter table private.provisioning_operations enable row level security;
alter table private.provisioning_operations force row level security;
revoke all on private.provisioning_operations from public, anon, authenticated, service_role;
-- No policies, browser grants, status RPC, fingerprint generator or write RPC.
-- Legacy companies INSERT and profiles.company_id SELECT policies remain unchanged.
commit;
