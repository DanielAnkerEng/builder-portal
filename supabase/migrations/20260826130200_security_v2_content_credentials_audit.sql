-- Durable drafts, immutable publications, bcrypt credentials, and append-only audit.

create table public.websites (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete restrict,
  name text not null, public_slug extensions.citext not null unique, domain extensions.citext unique,
  status text not null default 'active' check (status in ('active','suspended','archived')),
  current_publication_id uuid, created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.website_drafts (
  website_id uuid primary key references public.websites(id) on delete cascade,
  content jsonb not null default '{}'::jsonb, revision bigint not null default 1 check (revision > 0),
  updated_by uuid not null references auth.users(id) on delete restrict, updated_at timestamptz not null default now(),
  constraint website_drafts_content_object check (jsonb_typeof(content) = 'object')
);
create table public.website_publications (
  id uuid primary key default gen_random_uuid(), website_id uuid not null references public.websites(id) on delete restrict,
  version bigint not null check (version > 0), content jsonb not null, source_draft_revision bigint not null,
  published_by uuid not null references auth.users(id) on delete restrict, published_at timestamptz not null default now(),
  constraint website_publications_content_object check (jsonb_typeof(content) = 'object'),
  constraint website_publications_version_key unique (website_id, version)
);
alter table public.websites add constraint websites_current_publication_fkey
  foreign key (current_publication_id) references public.website_publications(id) on delete restrict;

create table public.user_security_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade, key_hash text not null,
  hash_algorithm text not null default 'bcrypt' check (hash_algorithm = 'bcrypt'), hash_version integer not null default 1,
  failed_attempts integer not null default 0 check (failed_attempts >= 0), locked_until timestamptz,
  must_rotate boolean not null default false, created_at timestamptz not null default now(),
  rotated_at timestamptz, updated_at timestamptz not null default now()
);
alter table public.company_security
  add column if not exists hash_algorithm text not null default 'bcrypt', add column if not exists hash_version integer not null default 1,
  add column if not exists failed_attempts integer not null default 0, add column if not exists locked_until timestamptz,
  add column if not exists must_rotate boolean not null default false, add column if not exists rotated_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create table public.audit_events (
  id uuid primary key default gen_random_uuid(), occurred_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null, company_id uuid references public.companies(id) on delete set null,
  event_type text not null, result text not null check (result in ('success','failure','denied')),
  target_type text not null, target_id uuid, authorization_requirements text[] not null default '{}',
  request_correlation_id uuid not null, metadata jsonb not null default '{}'::jsonb,
  constraint audit_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);
create index website_publications_website_published_idx on public.website_publications (website_id, published_at desc);
create index audit_events_company_time_idx on public.audit_events (company_id, occurred_at desc);

alter table public.websites enable row level security;
alter table public.website_drafts enable row level security;
alter table public.website_publications enable row level security;
alter table public.user_security_credentials enable row level security;
alter table public.user_security_credentials force row level security;
alter table public.company_security force row level security;
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

revoke all on public.websites, public.website_drafts, public.website_publications, public.user_security_credentials, public.company_security, public.audit_events from anon, authenticated;
grant select on public.websites, public.website_drafts, public.website_publications, public.audit_events to authenticated;
grant all on public.websites, public.website_drafts, public.website_publications, public.user_security_credentials, public.company_security, public.audit_events to service_role;

create policy "Security V2 websites require AAL2" on public.websites as restrictive for select to authenticated using (public.is_aal2());
create policy "Security V2 members read websites" on public.websites for select to authenticated
  using (public.is_active_company_member(company_id) or public.is_platform_admin());
create policy "Security V2 drafts require AAL2" on public.website_drafts as restrictive for select to authenticated using (public.is_aal2());
create policy "Security V2 members read drafts" on public.website_drafts for select to authenticated using (exists (
  select 1 from public.websites w where w.id = website_id and (public.is_active_company_member(w.company_id) or public.is_platform_admin())));
create policy "Security V2 publications require AAL2" on public.website_publications as restrictive for select to authenticated using (public.is_aal2());
create policy "Security V2 members read publication history" on public.website_publications for select to authenticated using (exists (
  select 1 from public.websites w where w.id = website_id and (public.is_active_company_member(w.company_id) or public.is_platform_admin())));
create policy "Security V2 platform admins read audit" on public.audit_events for select to authenticated using (public.is_platform_admin());
create policy "Security V2 profiles require AAL2" on public.profiles as restrictive for select to authenticated using (public.is_aal2());
create policy "Security V2 companies require AAL2" on public.companies as restrictive for select to authenticated using (public.is_aal2());
create policy "Security V2 members read companies" on public.companies for select to authenticated
  using (public.is_active_company_member(id) or public.is_platform_admin());
