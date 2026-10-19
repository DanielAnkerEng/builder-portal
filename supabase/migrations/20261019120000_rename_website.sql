-- Narrow project-name operation. Same actor/AAL2/editor policy as save_draft.
-- No caller-supplied actor, company, ownership or publication fields.
begin;
create function public.security_v2_rename_website(
  p_website_id uuid, p_name text, p_correlation_id uuid
) returns table(website_id uuid, name text)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_company uuid;
  v_name text := btrim(p_name);
begin
  if v_actor is null or not public.is_aal2() then
    raise exception 'AAL2_REQUIRED' using errcode = '42501';
  end if;
  select w.company_id into v_company from public.websites w
    where w.id = p_website_id and w.status = 'active' for update;
  if v_company is null or not exists (
    select 1 from public.profiles p where p.id = v_actor and p.status = 'active'
  ) or not (
    public.has_company_role(v_company, array['owner','company_admin','publisher','editor'])
    or public.is_platform_admin()
  ) then raise exception 'NOT_AUTHORIZED' using errcode = '42501'; end if;
  if v_name is null or length(v_name) not between 1 and 160
    or v_name ~ '[[:cntrl:]]' then
    raise exception 'INVALID_NAME' using errcode = '22023';
  end if;
  update public.websites w set name = v_name where w.id = p_website_id;
  perform private.write_audit(v_actor, v_company, 'website.rename', 'success',
    'website', p_website_id, array['aal2','editor_role'], p_correlation_id,
    jsonb_build_object('resource_name', v_name));
  return query select p_website_id, v_name;
end $$;
revoke all on function public.security_v2_rename_website(uuid,text,uuid) from public, anon, service_role;
grant execute on function public.security_v2_rename_website(uuid,text,uuid) to authenticated;
commit;
