-- New Customer V1 Phase B: user-JWT trusted operations. No external side effects.
begin;

create function private.nc_v1_text(v jsonb, required boolean, max_length integer, multiline boolean default false)
returns text language plpgsql immutable set search_path = '' as $$
declare t text;
begin
  if v is null or v = 'null'::jsonb then
    if required then raise exception using errcode='22023', message='INVALID_PAYLOAD'; end if;
    return null;
  end if;
  if jsonb_typeof(v) <> 'string' then raise exception using errcode='22023', message='INVALID_PAYLOAD'; end if;
  t := v #>> '{}';
  if multiline then t := replace(t, E'\r\n', E'\n'); end if;
  if (case when multiline then replace(t, E'\n', '') else t end) ~ '[[:cntrl:]]' then
    raise exception using errcode='22023', message='INVALID_PAYLOAD';
  end if;
  t := nullif(btrim(t), '');
  if (required and t is null) or char_length(t) > max_length or (t is not null and t !~ '[^[:space:]]') then
    raise exception using errcode='22023', message='INVALID_PAYLOAD';
  end if;
  return t;
end $$;

create function private.nc_v1_payload(p jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  c jsonb; contact jsonb := 'null'::jsonb; cfg jsonb; item jsonb;
  n text; org text; url text; email text; phone text; address text;
  cn text; ce text; cp text; ct text; lifecycle text;
  services jsonb; assignments jsonb := '[]'::jsonb; user_id uuid; responsibility text;
begin
  if p is null or jsonb_typeof(p) <> 'object' or octet_length(p::text) > 16384 then
    raise exception using errcode='22023', message='INVALID_PAYLOAD';
  end if;
  if not p ?& array['schemaVersion','company','contact','services','internal']
     or p - array['schemaVersion','company','contact','services','internal'] <> '{}'
     or p->'schemaVersion' <> '1'::jsonb
     or jsonb_typeof(p->'company') <> 'object'
     or jsonb_typeof(p->'internal') <> 'object'
     or jsonb_typeof(p->'services') <> 'array' then
    raise exception using errcode='22023', message='INVALID_PAYLOAD';
  end if;
  c := p->'company'; cfg := p->'internal';
  if c - array['name','organizationNumber','externalWebsiteUrl','contactEmail','contactPhone','address'] <> '{}'
     or not c ? 'name'
     or cfg - array['lifecycleStatus','assignments'] <> '{}'
     or not cfg ?& array['lifecycleStatus','assignments']
     or jsonb_typeof(cfg->'assignments') <> 'array' then
    raise exception using errcode='22023', message='INVALID_PAYLOAD';
  end if;
  n := private.nc_v1_text(c->'name',true,200);
  org := replace(private.nc_v1_text(c->'organizationNumber',false,32),' ','');
  if org is not null and not public.new_customer_org_number_valid(org) then
    raise exception using errcode='22023', message='INVALID_ORGANIZATION_NUMBER';
  end if;
  url := private.nc_v1_text(c->'externalWebsiteUrl',false,2048);
  if url is not null then
    if not public.new_customer_url_valid(url) then raise exception using errcode='22023', message='INVALID_URL'; end if;
    -- Normalize scheme/authority only; paths and query values remain case-sensitive.
    url := lower(substring(url from '^https?://[^/?#]+')) || regexp_replace(url,'^https?://[^/?#]+','');
  end if;
  email := private.nc_v1_text(c->'contactEmail',false,254);
  if email is not null then
    if not public.new_customer_email_valid(email) then raise exception using errcode='22023', message='INVALID_EMAIL'; end if;
    email := split_part(email,'@',1)||'@'||lower(split_part(email,'@',2));
  end if;
  phone := regexp_replace(private.nc_v1_text(c->'contactPhone',false,64),'[ ()-]','','g');
  if phone is not null and phone !~ '^[+][1-9][0-9]{7,14}$' then raise exception using errcode='22023', message='INVALID_PHONE'; end if;
  address := private.nc_v1_text(c->'address',false,500,true);
  if address is not null and char_length(address)-char_length(replace(address,E'\n','')) > 3 then
    raise exception using errcode='22023', message='INVALID_ADDRESS';
  end if;

  if p->'contact' <> 'null'::jsonb then
    if jsonb_typeof(p->'contact') <> 'object' then raise exception using errcode='22023', message='INVALID_CONTACT'; end if;
    contact := p->'contact';
    if contact - array['name','email','phone','title'] <> '{}' or not contact ? 'name' then
      raise exception using errcode='22023', message='INVALID_CONTACT';
    end if;
    cn := private.nc_v1_text(contact->'name',true,200);
    ce := private.nc_v1_text(contact->'email',false,254);
    cp := regexp_replace(private.nc_v1_text(contact->'phone',false,64),'[ ()-]','','g');
    ct := private.nc_v1_text(contact->'title',false,120);
    if ce is not null then
      if not public.new_customer_email_valid(ce) then raise exception using errcode='22023', message='INVALID_EMAIL'; end if;
      ce := split_part(ce,'@',1)||'@'||lower(split_part(ce,'@',2));
    end if;
    if cp is not null and cp !~ '^[+][1-9][0-9]{7,14}$' then raise exception using errcode='22023', message='INVALID_PHONE'; end if;
    contact := jsonb_build_object('name',cn,'email',ce,'phone',cp,'title',ct);
  end if;

  if jsonb_array_length(p->'services') > 11 or jsonb_array_length(cfg->'assignments') > 4 then
    raise exception using errcode='22023', message='INVALID_PAYLOAD';
  end if;
  for item in select value from jsonb_array_elements(p->'services') loop
    if jsonb_typeof(item) <> 'string' or not (item #>> '{}') = any(array[
      'website','website_management','seo','local_seo','google_ads','meta_ads','linkedin_ads','tiktok_ads','social_media','content','analytics']) then
      raise exception using errcode='22023', message='INVALID_SERVICE';
    end if;
  end loop;
  if (select count(*) <> count(distinct value) from jsonb_array_elements(p->'services')) then
    raise exception using errcode='22023', message='DUPLICATE_SERVICE';
  end if;
  select coalesce(jsonb_agg(value order by value::text collate "C"),'[]'::jsonb) into services from jsonb_array_elements(p->'services');

  lifecycle := private.nc_v1_text(cfg->'lifecycleStatus',true,32);
  if lifecycle <> all(array['onboarding','active','paused','ended']) then raise exception using errcode='22023', message='INVALID_LIFECYCLE'; end if;
  for item in select value from jsonb_array_elements(cfg->'assignments') loop
    if jsonb_typeof(item) <> 'object' then raise exception using errcode='22023', message='INVALID_ASSIGNMENT'; end if;
    if item - array['responsibilityType','assigneeUserId'] <> '{}' or not item ?& array['responsibilityType','assigneeUserId']
       or jsonb_typeof(item->'responsibilityType') <> 'string' or jsonb_typeof(item->'assigneeUserId') <> 'string' then
      raise exception using errcode='22023', message='INVALID_ASSIGNMENT';
    end if;
    responsibility := item->>'responsibilityType';
    if responsibility <> all(array['account','seo','marketing','content'])
       or item->>'assigneeUserId' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      raise exception using errcode='22023', message='INVALID_ASSIGNMENT';
    end if;
    user_id := (item->>'assigneeUserId')::uuid;
    assignments := assignments || jsonb_build_array(jsonb_build_object('responsibilityType',responsibility,'assigneeUserId',user_id));
  end loop;
  if (select count(*) <> count(distinct value->>'responsibilityType') from jsonb_array_elements(assignments)) then
    raise exception using errcode='22023', message='DUPLICATE_ASSIGNMENT';
  end if;
  select coalesce(jsonb_agg(value order by value->>'responsibilityType' collate "C"),'[]'::jsonb) into assignments from jsonb_array_elements(assignments);
  return jsonb_build_object('schemaVersion',1,'company',jsonb_build_object('name',n,'organizationNumber',org,
    'externalWebsiteUrl',url,'contactEmail',email,'contactPhone',phone,'address',address),
    'contact',contact,'services',services,'internal',jsonb_build_object('lifecycleStatus',lifecycle,'assignments',assignments));
end $$;

-- Narrow new predicate, not a change to existing Security V2 helper semantics.
create function private.nc_v1_authorized()
returns boolean language sql stable set search_path = '' as $$
  select auth.uid() is not null and public.is_aal2()
    and exists(select 1 from public.platform_admins a where a.user_id=auth.uid() and a.is_active)
    and exists(select 1 from public.profiles p where p.id=auth.uid() and p.status='active');
$$;

create function public.security_v2_create_company(p_idempotency_key uuid, p_payload jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); normalized jsonb; fingerprint bytea;
  op private.provisioning_operations%rowtype; company uuid; item jsonb; assignee uuid;
  code text; violated_constraint text;
begin
  if not private.nc_v1_authorized() then return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED'); end if;
  if p_idempotency_key is null then return jsonb_build_object('ok',false,'error','INVALID_IDEMPOTENCY_KEY'); end if;
  -- Prevent status revocation racing this operation; no changes to Auth/profile state.
  perform 1 from public.platform_admins where user_id=actor and is_active for share;
  if not found then return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED'); end if;
  perform 1 from public.profiles where id=actor and status='active' for share;
  if not found then return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED'); end if;
  begin
    normalized := private.nc_v1_payload(p_payload);
  exception when sqlstate '22023' then
    get stacked diagnostics code = message_text;
    -- Only allowlisted messages, never SQL details.
    if code <> all(array['INVALID_PAYLOAD','INVALID_ORGANIZATION_NUMBER','INVALID_URL','INVALID_EMAIL','INVALID_PHONE',
      'INVALID_ADDRESS','INVALID_CONTACT','INVALID_SERVICE','DUPLICATE_SERVICE','INVALID_LIFECYCLE','INVALID_ASSIGNMENT','DUPLICATE_ASSIGNMENT']) then
      code := 'INVALID_PAYLOAD';
    end if;
    return jsonb_build_object('ok',false,'error',code);
  end;
  fingerprint := extensions.digest(convert_to(jsonb_build_object(
    'version',1,'actor',actor,'key',p_idempotency_key,'payload',normalized)::text,'UTF8'),'sha256');
  insert into private.provisioning_operations(idempotency_key,actor_user_id,payload_fingerprint)
    values(p_idempotency_key,actor,fingerprint) on conflict(actor_user_id,operation_type,idempotency_key) do nothing;
  select * into strict op from private.provisioning_operations
    where actor_user_id=actor and operation_type='company.create.v1' and idempotency_key=p_idempotency_key for update;
  if op.payload_fingerprint <> fingerprint then return jsonb_build_object('ok',false,'error','IDEMPOTENCY_CONFLICT'); end if;
  if op.status <> 'pending' then
    return jsonb_build_object('ok',op.status='completed','operationId',op.id,'companyId',op.company_id,'status',op.status,'error',op.error_code);
  end if;

  begin
    -- Shared row locks in deterministic UUID order serialize assignment with deactivation.
    for assignee in select distinct (value->>'assigneeUserId')::uuid from jsonb_array_elements(normalized#>'{internal,assignments}') order by 1 loop
      perform 1 from public.platform_admins where user_id=assignee and is_active for share;
      if not found then raise exception using errcode='P2001',message='INVALID_ASSIGNEE'; end if;
      perform 1 from public.profiles where id=assignee and status='active' for share;
      if not found then raise exception using errcode='P2001',message='INVALID_ASSIGNEE'; end if;
    end loop;
    insert into public.companies(name,organization_number,external_website_url,contact_email,contact_phone,address)
      values(normalized#>>'{company,name}',normalized#>>'{company,organizationNumber}',normalized#>>'{company,externalWebsiteUrl}',
        normalized#>>'{company,contactEmail}',normalized#>>'{company,contactPhone}',normalized#>>'{company,address}') returning id into company;
    if normalized->'contact' <> 'null'::jsonb then
      insert into public.company_contacts(company_id,name,email,phone,title,is_primary)
        values(company,normalized#>>'{contact,name}',normalized#>>'{contact,email}',normalized#>>'{contact,phone}',normalized#>>'{contact,title}',true);
    end if;
    insert into public.company_services(company_id,service_code,created_by)
      select company,value #>> '{}',actor from jsonb_array_elements(normalized->'services');
    insert into public.company_internal_settings(company_id,lifecycle_status,updated_by)
      values(company,normalized#>>'{internal,lifecycleStatus}',actor);
    for item in select value from jsonb_array_elements(normalized#>'{internal,assignments}') loop
      insert into public.company_assignments(company_id,responsibility_type,assignee_user_id,assigned_by)
        values(company,item->>'responsibilityType',(item->>'assigneeUserId')::uuid,actor);
    end loop;
    perform private.write_audit(actor,company,'company.create','success','company',company,
      array['aal2','platform_admin','active_profile'],op.id,jsonb_build_object(
        'schema_version',1,'operation_type','company.create.v1','contact_created',normalized->'contact' <> 'null'::jsonb,
        'service_count',jsonb_array_length(normalized->'services'),'assignment_count',jsonb_array_length(normalized#>'{internal,assignments}')));
    update private.provisioning_operations set status='completed',company_id=company,completed_at=now(),updated_at=now() where id=op.id;
  exception
    when unique_violation then
      get stacked diagnostics violated_constraint = constraint_name;
      if violated_constraint <> 'companies_org_number_unique' then raise; end if;
      code := 'ORGANIZATION_NUMBER_EXISTS';
    when sqlstate 'P2001' then code := 'INVALID_ASSIGNEE';
  end;
  if code is not null then
    update private.provisioning_operations set status='failed',error_code=code,completed_at=now(),updated_at=now() where id=op.id;
    perform private.write_audit(actor,null,'company.create','failure','provisioning_operation',op.id,
      array['aal2','platform_admin','active_profile'],op.id,jsonb_build_object('error_code',code,'stage','package'));
    return jsonb_build_object('ok',false,'operationId',op.id,'companyId',null,'status','failed','error',code);
  end if;
  return jsonb_build_object('ok',true,'operationId',op.id,'companyId',company,'status','completed','error',null);
exception when others then
  -- Raising (not returning) rolls back operation storage and all package/audit writes.
  raise exception using errcode='P0001',message='OPERATION_FAILED';
end $$;

create function public.security_v2_get_company_creation_status(p_idempotency_key uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare op private.provisioning_operations%rowtype;
begin
  if not private.nc_v1_authorized() then return jsonb_build_object('error','NOT_AUTHORIZED'); end if;
  select * into op from private.provisioning_operations where actor_user_id=auth.uid()
    and operation_type='company.create.v1' and idempotency_key=p_idempotency_key;
  if not found then return jsonb_build_object('error','NOT_FOUND'); end if;
  return jsonb_build_object('operationId',op.id,'status',op.status,'companyId',op.company_id,'errorCode',op.error_code);
end $$;

create function public.security_v2_list_company_assignees()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.nc_v1_authorized() then return jsonb_build_object('error','NOT_AUTHORIZED'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('userId',a.user_id,'displayName',p.display_name) order by a.user_id),'[]'::jsonb)
    from public.platform_admins a join public.profiles p on p.id=a.user_id where a.is_active and p.status='active');
end $$;

revoke all on function private.nc_v1_text(jsonb,boolean,integer,boolean), private.nc_v1_payload(jsonb), private.nc_v1_authorized()
  from public,anon,authenticated,service_role;
revoke all on function public.security_v2_create_company(uuid,jsonb), public.security_v2_get_company_creation_status(uuid),
  public.security_v2_list_company_assignees() from public,anon,authenticated,service_role;
grant execute on function public.security_v2_create_company(uuid,jsonb), public.security_v2_get_company_creation_status(uuid),
  public.security_v2_list_company_assignees() to authenticated;

drop policy "Admins can create companies" on public.companies;
revoke all on public.companies from public,anon,authenticated;
grant select on public.companies to authenticated;
-- service_role and ALL existing SELECT policies deliberately unchanged.
commit;
