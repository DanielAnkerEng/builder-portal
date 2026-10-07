-- P4D9B-R: preserve terminal generations; never broaden legacy table grants.
begin;
alter table private.customer_invitations add column origin_id uuid references private.customer_invitations(id) on delete restrict;
alter table private.customer_invitations add column replaces_id uuid unique references private.customer_invitations(id) on delete restrict;
alter table private.customer_invitations add column generation integer not null default 1 check(generation>0);
alter table private.customer_invitations drop constraint customer_invitations_email_key;
alter table private.customer_invitations drop constraint customer_invitations_user_id_key;
alter table private.customer_invitations drop constraint customer_invitations_membership_id_key;
alter table private.customer_invitations drop constraint customer_invitations_status_check;
alter table private.customer_invitations drop constraint customer_invitation_binding;
alter table private.customer_invitations add constraint customer_invitations_status_check
  check(status in ('reserved','invited','accepted','revoked','expired','superseded'));
alter table private.customer_invitations add constraint customer_invitation_binding
  check(status not in ('invited','accepted') or (user_id is not null and membership_id is not null));
create unique index customer_invitation_open_email on private.customer_invitations(email) where status in ('reserved','invited','accepted');
create unique index customer_invitation_open_user on private.customer_invitations(user_id) where status in ('reserved','invited','accepted');
create unique index customer_invitation_open_membership on private.customer_invitations(membership_id) where status in ('reserved','invited','accepted');

create table private.customer_invitation_deliveries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  source_id uuid not null references private.customer_invitations(id) on delete restrict,
  invitation_id uuid not null unique references private.customer_invitations(id) on delete restrict,
  actor uuid not null references auth.users(id) on delete restrict,
  state text not null default 'prepared' check(state in ('prepared','dispatching','sent','uncertain')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table private.customer_invitation_deliveries enable row level security;
alter table private.customer_invitation_deliveries force row level security;
revoke all on private.customer_invitation_deliveries from public,anon,authenticated,service_role;

-- Private validation shared by planning, dispatch and reconciliation. Metadata
-- only corroborates the original Auth-created identity; it is not authorization.
create function private.customer_invitation_identity(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i private.customer_invitations; root private.customer_invitations; target auth.users;
begin
  select * into i from private.customer_invitations where id=p_id;
  if not found then return jsonb_build_object('ok',false,'error','INVITATION_NOT_FOUND'); end if;
  select * into root from private.customer_invitations where id=coalesce(i.origin_id,i.id);
  if root.company_id<>i.company_id or root.email<>i.email or root.customer_role<>i.customer_role
    or i.customer_role not in ('viewer','editor') then return jsonb_build_object('ok',false,'error','BINDING_MISMATCH'); end if;
  if not exists(select 1 from public.companies where id=i.company_id and is_active) then
    return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED'); end if;
  if (select count(*) from auth.users where lower(email)=i.email)>1 then
    return jsonb_build_object('ok',false,'error','IDENTITY_CONFLICT'); end if;
  select * into target from auth.users where lower(email)=i.email;
  if not found then
    if i.user_id is not null or i.membership_id is not null then return jsonb_build_object('ok',false,'error','IDENTITY_CONFLICT'); end if;
    return jsonb_build_object('ok',true,'mode','invite','originId',root.id);
  end if;
  if target.raw_user_meta_data->>'wreach_invitation_id' is distinct from root.id::text
    or target.created_at<root.created_at or target.invited_at is null
    or (i.user_id is not null and i.user_id<>target.id)
    or exists(select 1 from public.platform_admins where user_id=target.id) then
    return jsonb_build_object('ok',false,'error','IDENTITY_CONFLICT'); end if;
  if exists(select 1 from public.company_memberships where user_id=target.id and status='active') then
    return jsonb_build_object('ok',false,'error','ACTIVE_MEMBERSHIP_EXISTS'); end if;
  if i.user_id is null then
    if exists(select 1 from public.profiles where id=target.id) or exists(select 1 from public.company_memberships where user_id=target.id) then
      return jsonb_build_object('ok',false,'error','IDENTITY_CONFLICT'); end if;
  elsif not exists(select 1 from public.profiles where id=target.id and status='active' and company_id is null)
    or not exists(select 1 from public.company_memberships where id=i.membership_id and user_id=target.id
      and company_id=i.company_id and role=i.customer_role and status in ('invited','removed'))
    or exists(select 1 from public.company_memberships where user_id=target.id and id<>i.membership_id) then
    return jsonb_build_object('ok',false,'error','BINDING_MISMATCH');
  end if;
  return jsonb_build_object('ok',true,'mode','recovery','userId',target.id,'originId',root.id);
end $$;
revoke all on function private.customer_invitation_identity(uuid) from public,anon,authenticated,service_role;

create function public.security_v2_prepare_invitation_recovery(p_request uuid,p_invitation uuid,p_company uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); i private.customer_invitations; job private.customer_invitation_deliveries;
  identity jsonb; next_id uuid; address text;
begin
  if not public.is_platform_admin() or not exists(select 1 from public.profiles where id=actor and status='active') then
    return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED'); end if;
  if p_request is null or p_invitation is null or p_company is null then return jsonb_build_object('ok',false,'error','INVALID_REQUEST'); end if;
  select email into address from private.customer_invitations where id=p_invitation and company_id=p_company;
  if not found then return jsonb_build_object('ok',false,'error','INVITATION_NOT_FOUND'); end if;
  perform pg_advisory_xact_lock(hashtextextended(address,61006));
  select * into i from private.customer_invitations where id=p_invitation and company_id=p_company for update;
  select * into job from private.customer_invitation_deliveries where request_id=p_request;
  if found then
    if job.actor<>actor or job.source_id<>i.id then return jsonb_build_object('ok',false,'error','INVITATION_CONFLICT'); end if;
    return jsonb_build_object('ok',true,'invitationId',job.invitation_id,'attemptId',job.id,'delivery',job.state);
  end if;
  if i.status='accepted' or exists(select 1 from public.company_memberships where id=i.membership_id and status='active') then
    return jsonb_build_object('ok',false,'error','ACTIVE_MEMBERSHIP_EXISTS'); end if;
  if i.status='superseded' or exists(select 1 from private.customer_invitations where replaces_id=i.id)
    or exists(select 1 from private.customer_invitations where email=i.email and id<>i.id and status in ('reserved','invited','accepted')) then
    return jsonb_build_object('ok',false,'error','INVITATION_STATE_INCOMPATIBLE'); end if;
  identity:=private.customer_invitation_identity(i.id);
  if identity->>'ok'<>'true' then return identity; end if;
  if exists(select 1 from private.customer_invitation_deliveries d join private.customer_invitations x on x.id=d.invitation_id
      where x.email=i.email and d.created_at>now()-interval '60 seconds')
    or (select count(*) from private.customer_invitation_deliveries d join private.customer_invitations x on x.id=d.invitation_id
      where x.email=i.email and d.created_at>now()-interval '1 hour')>=3 then
    return jsonb_build_object('ok',false,'error','RESEND_THROTTLED'); end if;
  -- Revoked stays revoked. Every recovery gets a new generation; old IDs cannot
  -- activate access. No token is copied, returned, stored or revived here.
  if i.status not in ('revoked','expired') then
    update private.customer_invitations set status=case when expires_at<=now() then 'expired' else 'superseded' end where id=i.id;
  end if;
  insert into private.customer_invitations(request_id,company_id,email,display_name,customer_role,invited_by,
    origin_id,replaces_id,user_id,membership_id,generation)
  values(p_request,i.company_id,i.email,i.display_name,i.customer_role,actor,coalesce(i.origin_id,i.id),i.id,i.user_id,i.membership_id,i.generation+1)
  returning id into next_id;
  insert into private.customer_invitation_deliveries(request_id,source_id,invitation_id,actor)
    values(p_request,i.id,next_id,actor) returning * into job;
  perform private.write_audit(actor,i.company_id,'customer.invite_recovery_requested','success','invitation',next_id,
    array['aal2','platform_admin','bound_recovery'],job.id,jsonb_build_object('previous_invitation',i.id,'role',i.customer_role));
  return jsonb_build_object('ok',true,'invitationId',next_id,'attemptId',job.id,'delivery',job.state);
end $$;

-- One dispatch per durable attempt, including response-loss/replay. Only Edge
-- receives the bound email. Browser input can never supply a dispatch recipient.
create function public.security_v2_claim_invitation_delivery(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.customer_invitation_deliveries; i private.customer_invitations; identity jsonb;
begin
  select * into j from private.customer_invitation_deliveries where id=p_attempt for update;
  if not found then return jsonb_build_object('ok',false,'error','INVITATION_NOT_FOUND'); end if;
  select * into i from private.customer_invitations where id=j.invitation_id for update;
  if i.status not in ('reserved','invited') or i.expires_at<=now() then return jsonb_build_object('ok',false,'error','INVITATION_STATE_INCOMPATIBLE'); end if;
  if not exists(select 1 from public.platform_admins a join public.profiles p on p.id=a.user_id
    where a.user_id=j.actor and a.is_active and p.status='active') then return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED'); end if;
  identity:=private.customer_invitation_identity(i.id);
  if identity->>'ok'<>'true' then return identity; end if;
  if j.state<>'prepared' then return jsonb_build_object('ok',true,'send',false,'delivery',j.state); end if;
  update private.customer_invitation_deliveries set state='dispatching' where id=j.id;
  return jsonb_build_object('ok',true,'send',true,'email',i.email,'mode',identity->>'mode','originId',identity->>'originId');
end $$;

create function public.security_v2_finish_invitation_delivery(p_attempt uuid,p_sent boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.customer_invitation_deliveries; i private.customer_invitations;
begin
  select * into j from private.customer_invitation_deliveries where id=p_attempt for update;
  if not found or p_sent is null then return jsonb_build_object('ok',false,'error','INVALID_REQUEST'); end if;
  select * into i from private.customer_invitations where id=j.invitation_id;
  if j.state='dispatching' then
    update private.customer_invitation_deliveries set state=case when p_sent then 'sent' else 'uncertain' end,finished_at=now() where id=j.id;
    perform private.write_audit(j.actor,i.company_id,'customer.invite_recovery_delivery',case when p_sent then 'success' else 'failure' end,
      'invitation',i.id,array['service_delivery_receipt'],j.id,jsonb_build_object('delivery',case when p_sent then 'sent' else 'uncertain' end));
  end if;
  return jsonb_build_object('ok',true);
end $$;

create function public.security_v2_list_customer_invitations(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_platform_admin() or not exists(select 1 from public.profiles where id=auth.uid() and status='active') then
    return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED'); end if;
  return jsonb_build_object('ok',true,'invitations',coalesce((select jsonb_agg(jsonb_build_object(
    'invitationId',i.id,'email',i.email,'displayName',i.display_name,'role',i.customer_role,
    'status',case when i.status in ('reserved','invited') and i.expires_at<=now() then 'expired' else i.status end,
    'delivery',coalesce(d.state,'original_attempt'),'expiresAt',i.expires_at,
    'recoverable',i.status<>'accepted','historicalCount',(select count(*) from private.customer_invitations h where h.email=i.email)-1
  ) order by i.created_at desc) from private.customer_invitations i
    left join private.customer_invitation_deliveries d on d.invitation_id=i.id
    where i.company_id=p_company and not exists(select 1 from private.customer_invitations child where child.replaces_id=i.id)), '[]'::jsonb));
end $$;

-- Authorized reconciliation is read/repair of binding only, never another email.
create function public.security_v2_authorize_invitation_reconcile(p_invitation uuid,p_company uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_platform_admin() or not exists(select 1 from public.profiles where id=auth.uid() and status='active') then
    return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED'); end if;
  if not exists(select 1 from private.customer_invitations where id=p_invitation and company_id=p_company) then
    return jsonb_build_object('ok',false,'error','INVITATION_NOT_FOUND'); end if;
  return jsonb_build_object('ok',true,'invitationId',p_invitation);
end $$;

create or replace function public.security_v2_finalize_customer_invite(p_invitation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare i private.customer_invitations; identity jsonb; target uuid; membership uuid;
begin
  select * into i from private.customer_invitations where id=p_invitation for update;
  if not found or i.status not in ('reserved','invited','accepted') or (i.status<>'accepted' and i.expires_at<=now()) then
    return jsonb_build_object('ok',false,'error','INVITATION_UNAVAILABLE'); end if;
  if i.status in ('invited','accepted') then return jsonb_build_object('ok',true,'invitationId',i.id,'status',i.status); end if;
  if not exists(select 1 from public.platform_admins a join public.profiles p on p.id=a.user_id
    where a.user_id=i.invited_by and a.is_active and p.status='active') then return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED'); end if;
  identity:=private.customer_invitation_identity(i.id);
  if identity->>'ok'<>'true' then return identity; end if;
  target:=(identity->>'userId')::uuid;
  if target is null then return jsonb_build_object('ok',false,'error','DELIVERY_UNCONFIRMED'); end if;
  -- Lock the actual binding rows before revalidating to prevent a concurrent
  -- suspension/role/company change being overwritten during reconciliation.
  perform 1 from auth.users where id=target for share;
  if i.user_id is not null then
    perform 1 from public.profiles where id=target for share;
    perform 1 from public.company_memberships where id=i.membership_id for update;
    identity:=private.customer_invitation_identity(i.id);
    if identity->>'ok'<>'true' then return identity; end if;
    membership:=i.membership_id;
    update public.company_memberships set status='invited',updated_at=now() where id=membership and status='removed';
  else
    insert into public.profiles(id,display_name,email,status) values(target,i.display_name,i.email,'active');
    insert into public.company_memberships(company_id,user_id,role,status,invited_by)
      values(i.company_id,target,i.customer_role,'invited',i.invited_by) returning id into membership;
  end if;
  update private.customer_invitations set user_id=target,membership_id=membership,status='invited' where id=i.id;
  perform private.write_audit(i.invited_by,i.company_id,'customer.invite','success','user',target,
    array['aal2','platform_admin','explicit_customer_role'],i.id,jsonb_build_object('membership_id',membership,'role',i.customer_role));
  return jsonb_build_object('ok',true,'invitationId',i.id,'status','invited');
end $$;

revoke all on function public.security_v2_prepare_invitation_recovery(uuid,uuid,uuid),
  public.security_v2_claim_invitation_delivery(uuid),public.security_v2_finish_invitation_delivery(uuid,boolean),
  public.security_v2_list_customer_invitations(uuid),public.security_v2_authorize_invitation_reconcile(uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.security_v2_prepare_invitation_recovery(uuid,uuid,uuid),
  public.security_v2_list_customer_invitations(uuid),public.security_v2_authorize_invitation_reconcile(uuid,uuid) to authenticated;
grant execute on function public.security_v2_claim_invitation_delivery(uuid),public.security_v2_finish_invitation_delivery(uuid,boolean) to service_role;
create or replace function public.security_v2_prepare_customer_invite(
  p_request_id uuid, p_company uuid, p_email text, p_display_name text, p_role text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); invitation private.customer_invitations; email_value text := lower(btrim(p_email));
begin
  if not public.is_platform_admin() or not exists(select 1 from public.profiles where id=actor and status='active') then
    return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED');
  end if;
  if p_request_id is null or p_company is null or p_role is null or p_role not in ('viewer','editor')
    or email_value is null or length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_display_name is null or length(btrim(p_display_name)) not between 1 and 120 or p_display_name ~ '[[:cntrl:]]' then
    return jsonb_build_object('ok',false,'error','INVALID_REQUEST');
  end if;
  perform 1 from public.companies where id=p_company and is_active for share;
  if not found then return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED'); end if;
  -- Serialize duplicate email attempts, including different request IDs/companies.
  perform pg_advisory_xact_lock(hashtextextended(email_value,61006));
  select * into invitation from private.customer_invitations where email=email_value or request_id=p_request_id order by (request_id=p_request_id) desc,generation desc limit 1 for update;
  if found then
    if invitation.request_id<>p_request_id or invitation.invited_by<>actor or invitation.company_id<>p_company
      or invitation.email<>email_value or invitation.customer_role<>p_role or invitation.display_name<>btrim(p_display_name) then
      return jsonb_build_object('ok',false,'error','INVITATION_CONFLICT');
    end if;
    if invitation.status in ('revoked','expired','superseded') or invitation.expires_at<=now() then
      return jsonb_build_object('ok',false,'error','INVITATION_UNAVAILABLE');
    end if;
    return jsonb_build_object('ok',true,'invitationId',invitation.id,'send',false,'status',invitation.status);
  end if;
  -- V1 is new identities only. Never take over, upsert, delete or silently add
  -- an existing user (particularly an administrator) to another company.
  if exists(select 1 from auth.users where lower(email)=email_value) then
    return jsonb_build_object('ok',false,'error','EXISTING_IDENTITY_REQUIRES_REVIEW');
  end if;
  insert into private.customer_invitations(request_id,company_id,email,display_name,customer_role,invited_by)
    values(p_request_id,p_company,email_value,btrim(p_display_name),p_role,actor) returning * into invitation;
  perform private.write_audit(actor,p_company,'customer.invite_requested','success','invitation',invitation.id,
    array['aal2','platform_admin','explicit_customer_role'],invitation.id,jsonb_build_object('role',p_role));
  return jsonb_build_object('ok',true,'invitationId',invitation.id,'send',true,'status','reserved');
end $$;

create or replace function public.security_v2_customer_onboarding_status()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); invitation private.customer_invitations; has_password boolean;
begin
  if actor is null then return jsonb_build_object('ok',false,'error','UNAUTHENTICATED'); end if;
  select * into invitation from private.customer_invitations where user_id=actor order by generation desc,created_at desc limit 1;
  if not found then return jsonb_build_object('ok',true,'status','none'); end if;
  if invitation.status not in ('invited','accepted') or (invitation.status<>'accepted' and invitation.expires_at<=now())
    or not exists(select 1 from public.profiles where id=actor and status='active' and company_id is null)
    or exists(select 1 from public.platform_admins where user_id=actor)
    or not exists(select 1 from public.companies where id=invitation.company_id and is_active)
    or not exists(select 1 from public.company_memberships where id=invitation.membership_id and user_id=actor
      and company_id=invitation.company_id and (invitation.status='accepted' or role=invitation.customer_role)
      and status=case when invitation.status='accepted' then 'active' else 'invited' end) then
    return jsonb_build_object('ok',false,'error','INVITATION_UNAVAILABLE');
  end if;
  -- Completed onboarding must not become an alternative role/email authority.
  -- Later authorized role/email changes remain governed by normal Security V2.
  if invitation.status='accepted' then
    return jsonb_build_object('ok',true,'status','accepted','invitationId',invitation.id,
      'role',invitation.customer_role,'passwordRequired',false);
  end if;
  select coalesce(encrypted_password,'')<>'' into has_password from auth.users
    where id=actor and email_confirmed_at is not null and lower(email)=invitation.email;
  if not found then return jsonb_build_object('ok',false,'error','INVITATION_UNAVAILABLE'); end if;
  return jsonb_build_object('ok',true,'status',invitation.status,'invitationId',invitation.id,
    -- Invite identities can already have a random encrypted_password. Only a
    -- signed Auth password AMR proves this session used a known password.
    'role',invitation.customer_role,'passwordRequired',not has_password or not coalesce(auth.jwt()->'amr' @> '[{"method":"password"}]'::jsonb,false));
end $$;

create or replace function public.security_v2_revoke_customer_invitation(p_invitation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation private.customer_invitations;
begin
  if not public.is_platform_admin() or not exists(select 1 from public.profiles where id=auth.uid() and status='active') then
    return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED');
  end if;
  select * into invitation from private.customer_invitations where id=p_invitation for update;
  if not found or invitation.status not in ('reserved','invited','revoked') then return jsonb_build_object('ok',false,'error','INVITATION_UNAVAILABLE'); end if;
  if invitation.status<>'revoked' then
    update private.customer_invitations set status='revoked' where id=invitation.id;
    update public.company_memberships set status='removed',updated_at=now() where id=invitation.membership_id and status='invited';
    perform private.write_audit(auth.uid(),invitation.company_id,'customer.invite_revoke','success','invitation',invitation.id,
      array['aal2','platform_admin'],invitation.id);
  end if;
  return jsonb_build_object('ok',true,'status','revoked');
end $$;

create or replace function public.security_v2_accept_customer_invitation(p_invitation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); invitation private.customer_invitations; membership public.company_memberships;
begin
  if actor is null or not public.is_aal2() then return jsonb_build_object('ok',false,'error','AAL2_REQUIRED'); end if;
  select * into invitation from private.customer_invitations where id=p_invitation and user_id=actor for update;
  if not found then return jsonb_build_object('ok',false,'error','INVITATION_UNAVAILABLE'); end if;
  if invitation.status not in ('invited','accepted') or (invitation.status<>'accepted' and invitation.expires_at<=now()) then
    return jsonb_build_object('ok',false,'error','INVITATION_UNAVAILABLE');
  end if;
  perform 1 from auth.users where id=actor and email_confirmed_at is not null and lower(email)=invitation.email
    and coalesce(encrypted_password,'')<>'' for share;
  if not found or not coalesce(auth.jwt()->'amr' @> '[{"method":"password"}]'::jsonb,false) then
    return jsonb_build_object('ok',false,'error','PASSWORD_REQUIRED');
  end if;
  perform 1 from public.profiles where id=actor and status='active' and company_id is null for share;
  if not found or exists(select 1 from public.platform_admins where user_id=actor) then
    return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED');
  end if;
  perform 1 from public.companies where id=invitation.company_id and is_active for share;
  if not found or not exists(select 1 from auth.mfa_factors where user_id=actor and factor_type='totp' and status='verified') then
    return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED');
  end if;
  select * into membership from public.company_memberships where id=invitation.membership_id and user_id=actor
    and company_id=invitation.company_id and role=invitation.customer_role for update;
  if not found or membership.status not in ('invited','active') then
    return jsonb_build_object('ok',false,'error','INVITATION_UNAVAILABLE');
  end if;
  if invitation.status='accepted' and membership.status='active' then
    return jsonb_build_object('ok',true,'status','active','companyId',invitation.company_id);
  end if;
  if invitation.status<>'invited' or membership.status<>'invited' then
    return jsonb_build_object('ok',false,'error','INVITATION_UNAVAILABLE');
  end if;
  update public.company_memberships set status='active',updated_at=now() where id=membership.id;
  update private.customer_invitations set status='accepted',accepted_at=now() where id=invitation.id;
  perform private.write_audit(actor,invitation.company_id,'customer.invite_accept','success','membership',membership.id,
    array['aal2','verified_totp','confirmed_identity','password_set','bound_pending_invitation'],invitation.id,
    jsonb_build_object('user_id',actor,'role',invitation.customer_role));
  return jsonb_build_object('ok',true,'status','active','companyId',invitation.company_id);
end $$;
commit;
