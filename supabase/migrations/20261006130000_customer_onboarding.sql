-- Additive customer onboarding. No existing users/memberships are backfilled.
-- Auth email delivery cannot share a DB transaction: reserve once, reconcile,
-- and keep uncertain identities quarantined instead of deleting Auth users.
create table private.customer_invitations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  company_id uuid not null references public.companies(id) on delete restrict,
  email text not null unique,
  display_name text not null,
  customer_role text not null check (customer_role in ('viewer','editor')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  user_id uuid unique references auth.users(id) on delete restrict,
  membership_id uuid unique references public.company_memberships(id) on delete restrict,
  status text not null default 'reserved' check (status in ('reserved','invited','accepted','revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  constraint customer_invitation_binding check
    ((status in ('reserved','revoked')) or (user_id is not null and membership_id is not null))
);
alter table private.customer_invitations enable row level security;
alter table private.customer_invitations force row level security;
revoke all on private.customer_invitations from public, anon, authenticated, service_role;

create function public.security_v2_prepare_customer_invite(
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
  select * into invitation from private.customer_invitations where email=email_value or request_id=p_request_id for update;
  if found then
    if invitation.request_id<>p_request_id or invitation.invited_by<>actor or invitation.company_id<>p_company
      or invitation.email<>email_value or invitation.customer_role<>p_role or invitation.display_name<>btrim(p_display_name) then
      return jsonb_build_object('ok',false,'error','INVITATION_CONFLICT');
    end if;
    if invitation.status='revoked' or invitation.expires_at<=now() then
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

-- Edge-only reconciliation. It does not send email, create Auth users or trust
-- a client-selected user ID. Auth-created invitation metadata is corroborated
-- against a pre-existing reservation, creation time, email and invited_at.
create function public.security_v2_finalize_customer_invite(p_invitation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation private.customer_invitations; target auth.users; membership uuid;
begin
  select * into invitation from private.customer_invitations where id=p_invitation for update;
  if not found or invitation.status='revoked' or invitation.expires_at<=now() then
    return jsonb_build_object('ok',false,'error','INVITATION_UNAVAILABLE');
  end if;
  if invitation.status in ('invited','accepted') then
    return jsonb_build_object('ok',true,'invitationId',invitation.id,'status',invitation.status);
  end if;
  if not exists(select 1 from public.platform_admins a join public.profiles p on p.id=a.user_id
    where a.user_id=invitation.invited_by and a.is_active and p.status='active')
    or not exists(select 1 from public.companies where id=invitation.company_id and is_active) then
    return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED');
  end if;
  select * into target from auth.users where lower(email)=invitation.email
    and raw_user_meta_data->>'wreach_invitation_id'=invitation.id::text
    and created_at>=invitation.created_at and invited_at is not null for update;
  if not found then return jsonb_build_object('ok',false,'error','DELIVERY_UNCONFIRMED'); end if;
  if exists(select 1 from public.profiles where id=target.id)
    or exists(select 1 from public.platform_admins where user_id=target.id)
    or exists(select 1 from public.company_memberships where user_id=target.id) then
    return jsonb_build_object('ok',false,'error','IDENTITY_REQUIRES_REVIEW');
  end if;
  -- Legacy company_id and role deliberately remain NULL: no legacy read bypass.
  insert into public.profiles(id,display_name,email,status) values(target.id,invitation.display_name,invitation.email,'active');
  insert into public.company_memberships(company_id,user_id,role,status,invited_by)
    values(invitation.company_id,target.id,invitation.customer_role,'invited',invitation.invited_by) returning id into membership;
  update private.customer_invitations set user_id=target.id,membership_id=membership,status='invited' where id=invitation.id;
  perform private.write_audit(invitation.invited_by,invitation.company_id,'customer.invite','success','user',target.id,
    array['aal2','platform_admin','explicit_customer_role'],invitation.id,
    jsonb_build_object('membership_id',membership,'role',invitation.customer_role));
  return jsonb_build_object('ok',true,'invitationId',invitation.id,'status','invited');
end $$;

-- The only AAL1 read exception is this tiny auth.uid()-bound onboarding state.
-- It exposes no company data, email, invitation token, secrets or Auth metadata.
create function public.security_v2_customer_onboarding_status()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); invitation private.customer_invitations; has_password boolean;
begin
  if actor is null then return jsonb_build_object('ok',false,'error','UNAUTHENTICATED'); end if;
  select * into invitation from private.customer_invitations where user_id=actor;
  if not found then return jsonb_build_object('ok',true,'status','none'); end if;
  if invitation.status='revoked' or (invitation.status<>'accepted' and invitation.expires_at<=now())
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

create function public.security_v2_accept_customer_invitation(p_invitation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); invitation private.customer_invitations; membership public.company_memberships;
begin
  if actor is null or not public.is_aal2() then return jsonb_build_object('ok',false,'error','AAL2_REQUIRED'); end if;
  select * into invitation from private.customer_invitations where id=p_invitation and user_id=actor for update;
  if not found then return jsonb_build_object('ok',false,'error','INVITATION_UNAVAILABLE'); end if;
  if invitation.status='revoked' or (invitation.status<>'accepted' and invitation.expires_at<=now()) then
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

create function public.security_v2_revoke_customer_invitation(p_invitation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation private.customer_invitations;
begin
  if not public.is_platform_admin() or not exists(select 1 from public.profiles where id=auth.uid() and status='active') then
    return jsonb_build_object('ok',false,'error','NOT_AUTHORIZED');
  end if;
  select * into invitation from private.customer_invitations where id=p_invitation for update;
  if not found or invitation.status='accepted' then return jsonb_build_object('ok',false,'error','INVITATION_UNAVAILABLE'); end if;
  if invitation.status<>'revoked' then
    update private.customer_invitations set status='revoked' where id=invitation.id;
    update public.company_memberships set status='removed',updated_at=now() where id=invitation.membership_id and status='invited';
    perform private.write_audit(auth.uid(),invitation.company_id,'customer.invite_revoke','success','invitation',invitation.id,
      array['aal2','platform_admin'],invitation.id);
  end if;
  return jsonb_build_object('ok',true,'status','revoked');
end $$;

revoke all on function public.security_v2_prepare_customer_invite(uuid,uuid,text,text,text),
  public.security_v2_customer_onboarding_status(), public.security_v2_accept_customer_invitation(uuid),
  public.security_v2_revoke_customer_invitation(uuid), public.security_v2_finalize_customer_invite(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.security_v2_prepare_customer_invite(uuid,uuid,text,text,text),
  public.security_v2_customer_onboarding_status(), public.security_v2_accept_customer_invitation(uuid),
  public.security_v2_revoke_customer_invitation(uuid) to authenticated;
grant execute on function public.security_v2_finalize_customer_invite(uuid) to service_role;
