-- Strict server-side allowlist for all stored draft and published site content.

create or replace function private.site_content_is_valid(p_content jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare p jsonb; item jsonb; k text; image_url text;
  root_keys constant text[] := array['templateId','businessName','accent','accent2','bg','domain','language','status','seoTitle','seoDesc','pages','activePageId','contactEmail'];
  page_keys constant text[] := array['id','slug','name','locked','heroTag','heroTitle','heroSub','cta','badge','aboutTitle','aboutText','offeringsLabel','offerings','gallery','address','hours','sections','customCode'];
begin
  if jsonb_typeof(p_content) <> 'object' or pg_column_size(p_content) > 1048576 then return false; end if;
  if exists(select 1 from jsonb_object_keys(p_content) x where not (x = any(root_keys))) then return false; end if;
  if not (p_content ?& array['businessName','accent','accent2','bg','pages','activePageId']) then return false; end if;
  if coalesce(p_content->>'businessName','') = '' or length(p_content->>'businessName') > 160 then return false; end if;
  foreach k in array array['accent','accent2','bg'] loop
    if coalesce(p_content->>k,'') !~ '^#[0-9A-Fa-f]{6}$' then return false; end if;
  end loop;
  if p_content ? 'language' and coalesce(p_content->>'language','') not in ('no','nb','nn','en') then return false; end if;
  if p_content ? 'status' and coalesce(p_content->>'status','') <> 'draft' then return false; end if;
  if p_content ? 'domain' and coalesce(p_content->>'domain','') !~ '^([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$' then return false; end if;
  if p_content ? 'contactEmail' and coalesce(p_content->>'contactEmail','') !~ '^[^[:space:]@<>"'']+@[^[:space:]@<>"'']+\.[A-Za-z]{2,63}$' then return false; end if;
  if jsonb_typeof(p_content->'pages') <> 'array' or jsonb_array_length(p_content->'pages') not between 1 and 50 then return false; end if;
  for p in select value from jsonb_array_elements(p_content->'pages') loop
    if jsonb_typeof(p) <> 'object' or exists(select 1 from jsonb_object_keys(p) x where not (x = any(page_keys))) then return false; end if;
    if not (p ?& array['id','slug','name','sections','offerings','gallery']) then return false; end if;
    if length(coalesce(p->>'id','')) not between 1 and 80 or coalesce(p->>'slug','') !~ '^[a-z0-9-]{0,80}$' then return false; end if;
    if length(coalesce(p->>'name','')) not between 1 and 120 then return false; end if;
    foreach k in array array['heroTag','heroTitle','heroSub','cta','badge','aboutTitle','aboutText','offeringsLabel','address','hours'] loop
      if p ? k and (jsonb_typeof(p->k) <> 'string' or length(p->>k) > 5000) then return false; end if;
    end loop;
    if p ? 'customCode' and jsonb_typeof(p->'customCode') not in ('string','null') then return false; end if;
    if p ? 'customCode' and jsonb_typeof(p->'customCode')='string' and length(p->>'customCode') > 200000 then return false; end if;
    if jsonb_typeof(p->'offerings') <> 'array' or jsonb_array_length(p->'offerings') > 100 then return false; end if;
    for item in select value from jsonb_array_elements(p->'offerings') loop
      if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) x where x not in ('t','d'))
        or jsonb_typeof(item->'t')<>'string' or jsonb_typeof(item->'d')<>'string'
        or length(item->>'t')>300 or length(item->>'d')>2000 then return false; end if;
    end loop;
    if jsonb_typeof(p->'gallery') <> 'array' or jsonb_array_length(p->'gallery') > 100 then return false; end if;
    for item in select value from jsonb_array_elements(p->'gallery') loop
      if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) x where x not in ('emoji','img')) then return false; end if;
      if item ? 'emoji' and (jsonb_typeof(item->'emoji')<>'string' or length(item->>'emoji')>32) then return false; end if;
      if item ? 'img' and jsonb_typeof(item->'img') not in ('string','null') then return false; end if;
      image_url := case when jsonb_typeof(item->'img')='string' then item->>'img' else null end;
      if image_url is not null and not (
        (length(image_url) <= 2000 and image_url ~ '^https://[^[:space:]<>"'']+$') or
        (length(image_url) <= 800000 and image_url ~ '^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$')
      ) then return false; end if;
    end loop;
    if jsonb_typeof(p->'sections') <> 'array' or jsonb_array_length(p->'sections') > 30 then return false; end if;
    for item in select value from jsonb_array_elements(p->'sections') loop
      if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) x where x not in ('id','name','enabled','removable')) then return false; end if;
      if coalesce(item->>'id','') not in ('hero','about','offerings','gallery','contact','testimonials','team','faq','ctabanner') then return false; end if;
      if item ? 'name' and (jsonb_typeof(item->'name')<>'string' or length(item->>'name')>120) then return false; end if;
      if item ? 'enabled' and jsonb_typeof(item->'enabled')<>'boolean' then return false; end if;
      if item ? 'removable' and jsonb_typeof(item->'removable')<>'boolean' then return false; end if;
    end loop;
  end loop;
  if not exists(select 1 from jsonb_array_elements(p_content->'pages') x where x->>'id'=p_content->>'activePageId') then return false; end if;
  return true;
exception when others then return false;
end $$;

revoke all on function private.site_content_is_valid(jsonb) from public, anon, authenticated;
grant execute on function private.site_content_is_valid(jsonb) to service_role;

create or replace function private.require_valid_site_content(p_content jsonb)
returns void language plpgsql immutable set search_path='' as $$
begin
  if not private.site_content_is_valid(p_content) then raise exception 'INVALID_CONTENT_SCHEMA' using errcode='22023'; end if;
end $$;
revoke all on function private.require_valid_site_content(jsonb) from public, anon, authenticated;
grant execute on function private.require_valid_site_content(jsonb) to service_role;

create or replace function private.validate_site_content_trigger()
returns trigger language plpgsql set search_path='' as $$
begin
  perform private.require_valid_site_content(new.content);
  return new;
end $$;
revoke all on function private.validate_site_content_trigger() from public,anon,authenticated;
create trigger validate_website_draft_content before insert or update of content on public.website_drafts
for each row execute function private.validate_site_content_trigger();
create trigger validate_website_publication_content before insert or update of content on public.website_publications
for each row execute function private.validate_site_content_trigger();

-- Recreate trusted operations to enforce the schema inside the database boundary.
create or replace function public.security_v2_validate_site_content(p_content jsonb)
returns boolean language sql immutable security definer set search_path='' as $$
  select private.site_content_is_valid(p_content);
$$;
revoke all on function public.security_v2_validate_site_content(jsonb) from public, anon, authenticated;
grant execute on function public.security_v2_validate_site_content(jsonb) to service_role;
