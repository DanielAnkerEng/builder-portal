-- Customer-visible activity is a deliberately narrow, sanitized projection.
create or replace function public.get_customer_activity(p_company_id uuid, p_limit integer default 50)
returns table(occurred_at timestamptz, actor_name text, action text, resource_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_aal2() then raise exception 'AAL2_REQUIRED' using errcode = '42501'; end if;
  if not (public.is_active_company_member(p_company_id) or public.is_platform_admin()) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  return query select e.occurred_at, coalesce(nullif(p.display_name, ''), 'Wreach-bruker')::text,
    case e.event_type when 'draft.save' then 'Lagret utkast' when 'website.publish' then 'Publiserte nettside'
      when 'membership.role_change' then 'Endret tilgang' when 'user.create' then 'Opprettet bruker'
      when 'user.deactivate' then 'Deaktiverte bruker' end::text,
    nullif(e.metadata ->> 'resource_name', '')::text
  from public.audit_events e left join public.profiles p on p.id = e.actor_user_id
  where e.company_id = p_company_id and e.result = 'success'
    and e.event_type in ('draft.save','website.publish','membership.role_change','user.create','user.deactivate')
  order by e.occurred_at desc limit least(greatest(coalesce(p_limit, 50), 1), 100);
end $$;
revoke all on function public.get_customer_activity(uuid,integer) from public, anon;
grant execute on function public.get_customer_activity(uuid,integer) to authenticated;
