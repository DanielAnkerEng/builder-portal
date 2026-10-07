-- Synthetic SQL/role tests only. Existing onboarding tests stay unchanged.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select ok(has_table_privilege('service_role','public.company_memberships','SELECT'),'service SELECT retained');
select ok(not has_table_privilege('service_role','public.company_memberships',p), 'service lacks direct '||p)
from unnest(array['INSERT','UPDATE','DELETE','TRUNCATE']) p;
select ok(not has_any_column_privilege('service_role','public.company_memberships',p),'no column bypass for '||p)
from unnest(array['INSERT','UPDATE']) p;
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.company_memberships'::regclass),'forced RLS retained');
select ok(has_function_privilege('service_role','public.security_v2_finalize_customer_invite(uuid)','EXECUTE'),'trusted finalizer grant retained');
select ok(has_function_privilege('service_role','public.security_v2_change_member_role(uuid,uuid,uuid,text,text,text,uuid)','EXECUTE'),'trusted role-change grant retained');
select ok(not has_function_privilege('service_role','public.security_v2_accept_customer_invitation(uuid)','EXECUTE'),'activation remains user JWT only');
select ok(not has_function_privilege('authenticated','public.security_v2_change_member_role(uuid,uuid,uuid,text,text,text,uuid)','EXECUTE'),'browser cannot directly invoke privileged role change');

insert into auth.users(id,email) values
 ('d7100000-0000-4000-8000-000000000001','owner@fixture.invalid'),
 ('d7100000-0000-4000-8000-000000000002','editor@fixture.invalid'),
 ('d7100000-0000-4000-8000-000000000003','other@fixture.invalid');
insert into public.profiles(id,display_name,status)
 select id,'Synthetic permissions fixture','active' from auth.users where id::text like 'd7100000-%';
insert into public.companies(id,name) values ('d7100000-0000-4000-8000-000000000010','Synthetic ACL company');
insert into public.company_memberships(company_id,user_id,role,status) values
 ('d7100000-0000-4000-8000-000000000010','d7100000-0000-4000-8000-000000000001','owner','active'),
 ('d7100000-0000-4000-8000-000000000010','d7100000-0000-4000-8000-000000000002','editor','active');
insert into public.user_security_credentials(user_id,key_hash) values
 ('d7100000-0000-4000-8000-000000000001',extensions.crypt('synthetic-personal-key',extensions.gen_salt('bf',4)));
insert into public.company_security(company_id,code_hash,is_active) values
 ('d7100000-0000-4000-8000-000000000010',extensions.crypt('synthetic-company-key',extensions.gen_salt('bf',4)),true);

create temp table acl_before as select
 (select jsonb_agg(to_jsonb(m) order by id) from public.company_memberships m) memberships,
 (select count(*) from public.audit_events) audits;
set local role service_role;
select throws_ok($$insert into public.company_memberships(company_id,user_id,role,status) values
 ('d7100000-0000-4000-8000-000000000010','d7100000-0000-4000-8000-000000000003','editor','active')$$,'42501',null,'direct INSERT refused');
select throws_ok($$update public.company_memberships set role='owner' where user_id='d7100000-0000-4000-8000-000000000002'$$,'42501',null,'direct UPDATE refused');
select throws_ok($$insert into public.company_memberships(company_id,user_id,role,status) values
 ('d7100000-0000-4000-8000-000000000010','d7100000-0000-4000-8000-000000000002','owner','active')
 on conflict(company_id,user_id) do update set role=excluded.role$$,'42501',null,'direct UPSERT refused');
select throws_ok($$delete from public.company_memberships where user_id='d7100000-0000-4000-8000-000000000002'$$,'42501',null,'direct DELETE refused');
select throws_ok($$truncate public.company_memberships$$,'42501',null,'direct TRUNCATE refused');
reset role;
select is((select jsonb_agg(to_jsonb(m) order by id) from public.company_memberships m),(select memberships from acl_before),'all direct denials preserve exact membership rows');
select is((select count(*) from public.audit_events),(select audits from acl_before),'direct privilege denials write no audit');

-- These are SQL service-role boundary tests, not proof of Edge JWT/AAL2 checks.
set local role service_role;
select is(public.security_v2_change_member_role('d7100000-0000-4000-8000-000000000001','d7100000-0000-4000-8000-000000000010',
 'd7100000-0000-4000-8000-000000000002','viewer','wrong','synthetic-company-key',gen_random_uuid())->>'error',
 'KEY_VERIFICATION_FAILED','wrong personal key still denied');
select is(public.security_v2_change_member_role('d7100000-0000-4000-8000-000000000001','d7100000-0000-4000-8000-000000000010',
 'd7100000-0000-4000-8000-000000000002','viewer','synthetic-personal-key','wrong',gen_random_uuid())->>'error',
 'KEY_VERIFICATION_FAILED','wrong company key still denied');
select is((select role from public.company_memberships where user_id='d7100000-0000-4000-8000-000000000002'),'editor','failed key checks preserve role');
select is(public.security_v2_change_member_role('d7100000-0000-4000-8000-000000000003','d7100000-0000-4000-8000-000000000010',
 'd7100000-0000-4000-8000-000000000002','viewer','synthetic-personal-key','synthetic-company-key',gen_random_uuid())->>'error',
 'NOT_AUTHORIZED','unrelated actor denied despite supplied keys');
select is(public.security_v2_change_member_role('d7100000-0000-4000-8000-000000000001','d7100000-0000-4000-8000-000000000010',
 'd7100000-0000-4000-8000-000000000002','viewer','synthetic-personal-key','synthetic-company-key',gen_random_uuid())->>'ok',
 'true','trusted definer changes role without direct service UPDATE');
select is((select role from public.company_memberships where user_id='d7100000-0000-4000-8000-000000000002'),'viewer','authorized role change persists inside test transaction');
reset role;
select is((select count(*) from public.audit_events where event_type='membership.role_change' and result='success'
 and company_id='d7100000-0000-4000-8000-000000000010'),1::bigint,'authorized role change audited once');
select * from finish();
rollback;
