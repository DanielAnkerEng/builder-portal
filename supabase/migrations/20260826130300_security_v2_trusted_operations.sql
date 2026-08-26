-- Trusted Security V2 operations. Browser-callable functions derive auth.uid().
-- Publication and critical operations are service-role only and are called by JWT-validating Edge Functions.

create or replace function private.write_audit(
  p_actor uuid, p_company uuid, p_event text, p_result text, p_target_type text,
  p_target uuid, p_requirements text[], p_correlation uuid, p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events(actor_user_id, company_id, event_type, result, target_type, target_id,
    authorization_requirements, request_correlation_id, metadata)
  values (p_actor, p_company, p_event, p_result, p_target_type, p_target, p_requirements, p_correlation,
    coalesce(p_metadata, '{}'::jsonb));
end $$;

create or replace function private.verify_personal_key(p_user uuid, p_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_hash text; v_attempts integer; v_locked timestamptz;
begin
  select key_hash, failed_attempts, locked_until into v_hash, v_attempts, v_locked
  from public.user_security_credentials where user_id = p_user for update;
  if v_hash is null or (v_locked is not null and v_locked > now()) then return false; end if;
  if extensions.crypt(p_key, v_hash) = v_hash then
    update public.user_security_credentials set failed_attempts = 0, locked_until = null, updated_at = now() where user_id = p_user;
    return true;
  end if;
  update public.user_security_credentials set failed_attempts = failed_attempts + 1,
    locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else locked_until end,
    updated_at = now() where user_id = p_user;
  return false;
end $$;

create or replace function private.verify_company_key(p_company uuid, p_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_hash text; v_locked timestamptz;
begin
  select code_hash, locked_until into v_hash, v_locked from public.company_security
  where company_id = p_company and is_active for update;
  if v_hash is null or (v_locked is not null and v_locked > now()) then return false; end if;
  if extensions.crypt(p_key, v_hash) = v_hash then
    update public.company_security set failed_attempts = 0, locked_until = null, updated_at = now() where company_id = p_company;
    return true;
  end if;
  update public.company_security set failed_attempts = failed_attempts + 1,
    locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else locked_until end,
    updated_at = now() where company_id = p_company;
  return false;
end $$;

revoke all on function private.write_audit(uuid,uuid,text,text,text,uuid,text[],uuid,jsonb) from public;
revoke all on function private.verify_personal_key(uuid,text) from public;
revoke all on function private.verify_company_key(uuid,text) from public;

create or replace function public.security_v2_save_draft(
  p_website_id uuid, p_content jsonb, p_expected_revision bigint, p_correlation_id uuid
) returns table(website_id uuid, revision bigint, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_company uuid; v_current bigint;
begin
  if v_actor is null or not public.is_aal2() then raise exception 'AAL2_REQUIRED' using errcode = '42501'; end if;
  if jsonb_typeof(p_content) <> 'object' or pg_column_size(p_content) > 1048576 then raise exception 'INVALID_CONTENT'; end if;
  select company_id into v_company from public.websites where id = p_website_id and status = 'active';
  if v_company is null or not (public.has_company_role(v_company, array['owner','company_admin','publisher','editor']) or public.is_platform_admin()) then
    perform private.write_audit(v_actor, v_company, 'draft.save', 'denied', 'website', p_website_id,
      array['aal2','editor_role'], p_correlation_id); raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select d.revision into v_current from public.website_drafts d where d.website_id = p_website_id for update;
  if v_current is null then
    if p_expected_revision <> 0 then raise exception 'STALE_REVISION'; end if;
    insert into public.website_drafts values (p_website_id, p_content, 1, v_actor, now()); v_current := 1;
  else
    if v_current <> p_expected_revision then raise exception 'STALE_REVISION'; end if;
    update public.website_drafts d set content = p_content, revision = d.revision + 1, updated_by = v_actor, updated_at = now()
    where d.website_id = p_website_id returning d.revision into v_current;
  end if;
  perform private.write_audit(v_actor, v_company, 'draft.save', 'success', 'website', p_website_id,
    array['aal2','editor_role'], p_correlation_id, jsonb_build_object('revision', v_current));
  return query select p_website_id, v_current, now();
end $$;

revoke all on function public.security_v2_save_draft(uuid,jsonb,bigint,uuid) from public, anon;
grant execute on function public.security_v2_save_draft(uuid,jsonb,bigint,uuid) to authenticated;

create or replace function public.security_v2_set_personal_key(
  p_actor uuid, p_new_key text, p_current_key text, p_correlation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_exists boolean;
begin
  if length(p_new_key) < 16 or length(p_new_key) > 256 then return jsonb_build_object('ok',false,'error','INVALID_KEY_LENGTH'); end if;
  select exists(select 1 from public.user_security_credentials where user_id = p_actor) into v_exists;
  if v_exists and (p_current_key is null or not private.verify_personal_key(p_actor, p_current_key)) then
    perform private.write_audit(p_actor,null,'personal_key.rotate','failure','user',p_actor,array['aal2','current_personal_key'],p_correlation_id);
    return jsonb_build_object('ok',false,'error','INVALID_CURRENT_KEY');
  end if;
  insert into public.user_security_credentials(user_id,key_hash,hash_algorithm,hash_version,rotated_at)
  values(p_actor,extensions.crypt(p_new_key,extensions.gen_salt('bf',12)),'bcrypt',1,case when v_exists then now() end)
  on conflict(user_id) do update set key_hash=excluded.key_hash, hash_algorithm='bcrypt', hash_version=1,
    failed_attempts=0,locked_until=null,must_rotate=false,rotated_at=now(),updated_at=now();
  perform private.write_audit(p_actor,null,case when v_exists then 'personal_key.rotate' else 'personal_key.enroll' end,
    'success','user',p_actor,array['aal2'],p_correlation_id);
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.security_v2_publish_site(
  p_actor uuid, p_website_id uuid, p_expected_revision bigint, p_personal_key text, p_correlation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_content jsonb; v_revision bigint; v_version bigint; v_publication uuid; v_allowed boolean;
begin
  select company_id into v_company from public.websites where id=p_website_id and status='active' for update;
  select exists(select 1 from public.platform_admins where user_id=p_actor and is_active) or exists(
    select 1 from public.company_memberships where user_id=p_actor and company_id=v_company and status='active'
      and role in ('owner','company_admin','publisher')) into v_allowed;
  if v_company is null or not v_allowed then
    perform private.write_audit(p_actor,v_company,'website.publish','denied','website',p_website_id,array['aal2','publisher_role','personal_key'],p_correlation_id);
    return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED');
  end if;
  if not private.verify_personal_key(p_actor,p_personal_key) then
    perform private.write_audit(p_actor,v_company,'website.publish','failure','website',p_website_id,array['aal2','publisher_role','personal_key'],p_correlation_id);
    return jsonb_build_object('ok',false,'error','INVALID_PERSONAL_KEY');
  end if;
  select content,revision into v_content,v_revision from public.website_drafts where website_id=p_website_id for update;
  if v_revision is null or v_revision <> p_expected_revision then
    perform private.write_audit(p_actor,v_company,'website.publish','failure','website',p_website_id,array['aal2','publisher_role','personal_key','expected_revision'],p_correlation_id);
    return jsonb_build_object('ok',false,'error','STALE_REVISION');
  end if;
  select coalesce(max(version),0)+1 into v_version from public.website_publications where website_id=p_website_id;
  insert into public.website_publications(website_id,version,content,source_draft_revision,published_by)
  values(p_website_id,v_version,v_content,v_revision,p_actor) returning id into v_publication;
  update public.websites set current_publication_id=v_publication,updated_at=now() where id=p_website_id;
  perform private.write_audit(p_actor,v_company,'website.publish','success','website',p_website_id,array['aal2','publisher_role','personal_key','expected_revision'],p_correlation_id,
    jsonb_build_object('publication_version',v_version,'resource_name',(select name from public.websites where id=p_website_id)));
  return jsonb_build_object('ok',true,'publication_id',v_publication,'version',v_version);
end $$;

create or replace function public.security_v2_set_company_key(
  p_actor uuid,p_company uuid,p_personal_key text,p_current_company_key text,p_new_company_key text,p_correlation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_allowed boolean; v_exists boolean;
begin
  if length(p_new_company_key)<16 or length(p_new_company_key)>256 then return jsonb_build_object('ok',false,'error','INVALID_KEY_LENGTH'); end if;
  select exists(select 1 from public.platform_admins where user_id=p_actor and is_active) or exists(
    select 1 from public.company_memberships where user_id=p_actor and company_id=p_company and status='active' and role='owner') into v_allowed;
  if not v_allowed or not private.verify_personal_key(p_actor,p_personal_key) then return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED'); end if;
  select exists(select 1 from public.company_security where company_id=p_company and is_active) into v_exists;
  if v_exists and (p_current_company_key is null or not private.verify_company_key(p_company,p_current_company_key)) then
    perform private.write_audit(p_actor,p_company,'company_key.rotate','failure','company',p_company,array['aal2','owner_role','personal_key','company_key'],p_correlation_id);
    return jsonb_build_object('ok',false,'error','INVALID_COMPANY_KEY');
  end if;
  insert into public.company_security(company_id,code_hash,is_active,hash_algorithm,hash_version,rotated_at)
  values(p_company,extensions.crypt(p_new_company_key,extensions.gen_salt('bf',12)),true,'bcrypt',1,case when v_exists then now() end)
  on conflict(company_id) do update set code_hash=excluded.code_hash,is_active=true,hash_algorithm='bcrypt',hash_version=1,
    failed_attempts=0,locked_until=null,must_rotate=false,rotated_at=now(),updated_at=now();
  perform private.write_audit(p_actor,p_company,case when v_exists then 'company_key.rotate' else 'company_key.enroll' end,'success','company',p_company,
    array['aal2','owner_role','personal_key'],p_correlation_id);
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.security_v2_change_member_role(
  p_actor uuid,p_company uuid,p_target_user uuid,p_new_role text,p_personal_key text,p_company_key text,p_correlation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_new_role not in ('company_admin','publisher','editor','viewer') then return jsonb_build_object('ok',false,'error','INVALID_ROLE'); end if;
  if not exists(select 1 from public.company_memberships where company_id=p_company and user_id=p_actor and status='active' and role in ('owner','company_admin')) then
    return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED');
  end if;
  if not private.verify_personal_key(p_actor,p_personal_key) or not private.verify_company_key(p_company,p_company_key) then
    perform private.write_audit(p_actor,p_company,'membership.role_change','failure','user',p_target_user,array['aal2','privileged_company_role','personal_key','company_key'],p_correlation_id);
    return jsonb_build_object('ok',false,'error','KEY_VERIFICATION_FAILED');
  end if;
  update public.company_memberships set role=p_new_role,updated_at=now() where company_id=p_company and user_id=p_target_user and status='active' and role<>'owner';
  if not found then return jsonb_build_object('ok',false,'error','TARGET_NOT_MUTABLE'); end if;
  perform private.write_audit(p_actor,p_company,'membership.role_change','success','user',p_target_user,array['aal2','privileged_company_role','personal_key','company_key'],p_correlation_id,
    jsonb_build_object('new_role',p_new_role));
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.get_public_site(p_slug text)
returns table(website_name text,domain text,publication_version bigint,published_at timestamptz,content jsonb)
language sql stable security definer set search_path='' as $$
  select w.name,w.domain::text,p.version,p.published_at,p.content from public.websites w
  join public.website_publications p on p.id=w.current_publication_id
  join public.companies c on c.id=w.company_id
  where w.public_slug=p_slug and w.status='active' and c.is_active;
$$;

revoke all on function public.security_v2_set_personal_key(uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.security_v2_publish_site(uuid,uuid,bigint,text,uuid) from public,anon,authenticated;
revoke all on function public.security_v2_set_company_key(uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.security_v2_change_member_role(uuid,uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.security_v2_set_personal_key(uuid,text,text,uuid) to service_role;
grant execute on function public.security_v2_publish_site(uuid,uuid,bigint,text,uuid) to service_role;
grant execute on function public.security_v2_set_company_key(uuid,uuid,text,text,text,uuid) to service_role;
grant execute on function public.security_v2_change_member_role(uuid,uuid,uuid,text,text,text,uuid) to service_role;
revoke all on function public.get_public_site(text) from public;
grant execute on function public.get_public_site(text) to anon,authenticated,service_role;

