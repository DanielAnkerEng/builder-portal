-- Staged one-time legacy import. Staging never changes a website or publication.
create table public.legacy_site_imports (
  id uuid primary key default gen_random_uuid(), source_fingerprint text not null unique check (source_fingerprint ~ '^[a-f0-9]{64}$'),
  legacy_account_id text not null, legacy_project_name text, legacy_email text, legacy_company_id uuid,
  content jsonb not null, status text not null default 'needs_mapping' check(status in ('needs_mapping','draft_created','rejected')),
  mapped_company_id uuid references public.companies(id) on delete restrict, website_id uuid references public.websites(id) on delete restrict,
  staged_by uuid not null references auth.users(id) on delete restrict, staged_at timestamptz not null default now(),
  mapped_by uuid references auth.users(id) on delete restrict, mapped_at timestamptz,
  source_metadata jsonb not null default '{}'::jsonb
);
alter table public.legacy_site_imports enable row level security;
alter table public.legacy_site_imports force row level security;
revoke all on public.legacy_site_imports from anon,authenticated;
grant select on public.legacy_site_imports to authenticated;
grant all on public.legacy_site_imports to service_role;
create policy "Security V2 platform admins review legacy imports" on public.legacy_site_imports for select to authenticated using(public.is_platform_admin());

create or replace function public.security_v2_stage_legacy_import(p_actor uuid,p_fingerprint text,p_account_id text,p_project_name text,p_email text,p_legacy_company uuid,p_content jsonb,p_metadata jsonb,p_correlation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.platform_admins where user_id=p_actor and is_active) then return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED'); end if;
  perform private.require_valid_site_content(p_content);
  if p_fingerprint !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok',false,'error','INVALID_FINGERPRINT'); end if;
  insert into public.legacy_site_imports(source_fingerprint,legacy_account_id,legacy_project_name,legacy_email,legacy_company_id,content,staged_by,source_metadata)
  values(p_fingerprint,left(p_account_id,120),left(p_project_name,160),left(p_email,254),p_legacy_company,p_content,p_actor,coalesce(p_metadata,'{}'))
  on conflict(source_fingerprint) do nothing returning id into v_id;
  if v_id is null then return jsonb_build_object('ok',false,'error','ALREADY_STAGED'); end if;
  perform private.write_audit(p_actor,null,'legacy_import.stage','success','legacy_import',v_id,array['aal2','platform_admin'],p_correlation,jsonb_build_object('resource_name',left(p_project_name,160)));
  return jsonb_build_object('ok',true,'import_id',v_id,'status','needs_mapping');
end $$;

create or replace function public.security_v2_confirm_legacy_mapping(p_actor uuid,p_import uuid,p_company uuid,p_site_name text,p_public_slug text,p_confirmed boolean,p_correlation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_import public.legacy_site_imports; v_site uuid;
begin
  if not p_confirmed or not exists(select 1 from public.platform_admins where user_id=p_actor and is_active) then return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED'); end if;
  select * into v_import from public.legacy_site_imports where id=p_import for update;
  if v_import.id is null or v_import.status<>'needs_mapping' then return jsonb_build_object('ok',false,'error','IMPORT_NOT_MAPPABLE'); end if;
  if not exists(select 1 from public.companies where id=p_company and is_active) then return jsonb_build_object('ok',false,'error','COMPANY_NOT_FOUND'); end if;
  if v_import.legacy_company_id is not null and v_import.legacy_company_id<>p_company then return jsonb_build_object('ok',false,'error','COMPANY_MISMATCH'); end if;
  if p_public_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_public_slug)>80 then return jsonb_build_object('ok',false,'error','INVALID_SLUG'); end if;
  perform private.require_valid_site_content(v_import.content);
  insert into public.websites(company_id,name,public_slug,created_by) values(p_company,left(p_site_name,160),p_public_slug,p_actor) returning id into v_site;
  insert into public.website_drafts(website_id,content,revision,updated_by) values(v_site,v_import.content,1,p_actor);
  update public.legacy_site_imports set status='draft_created',mapped_company_id=p_company,website_id=v_site,mapped_by=p_actor,mapped_at=now() where id=p_import;
  perform private.write_audit(p_actor,p_company,'legacy_import.map','success','website',v_site,array['aal2','platform_admin','explicit_mapping'],p_correlation,jsonb_build_object('resource_name',left(p_site_name,160),'source_fingerprint',v_import.source_fingerprint));
  return jsonb_build_object('ok',true,'website_id',v_site,'draft_revision',1,'published',false);
end $$;

revoke all on function public.security_v2_stage_legacy_import(uuid,text,text,text,text,uuid,jsonb,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.security_v2_confirm_legacy_mapping(uuid,uuid,uuid,text,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.security_v2_stage_legacy_import(uuid,text,text,text,text,uuid,jsonb,jsonb,uuid) to service_role;
grant execute on function public.security_v2_confirm_legacy_mapping(uuid,uuid,uuid,text,text,boolean,uuid) to service_role;
