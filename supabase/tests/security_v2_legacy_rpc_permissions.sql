begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select ok(not has_function_privilege('anon','public.set_company_security_code(uuid,text)','EXECUTE'),'Anon cannot set a legacy company security code');
select ok(not has_function_privilege('authenticated','public.set_company_security_code(uuid,text)','EXECUTE'),'Authenticated cannot set a legacy company security code');
select ok(not has_function_privilege('anon','public.verify_company_security_code(uuid,text)','EXECUTE'),'Anon cannot call the legacy company-key oracle');
select ok(not has_function_privilege('authenticated','public.verify_company_security_code(uuid,text)','EXECUTE'),'Authenticated cannot call the legacy company-key oracle');
select ok(not has_function_privilege('service_role','public.set_company_security_code(uuid,text)','EXECUTE'),'Service role has no undocumented legacy setter dependency');
select ok(not has_function_privilege('service_role','public.verify_company_security_code(uuid,text)','EXECUTE'),'Service role has no undocumented legacy verifier dependency');
select ok(not has_function_privilege('anon','public.rls_auto_enable()','EXECUTE'),'Anon cannot execute the RLS event-trigger function');
select ok(not has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE'),'Authenticated cannot execute the RLS event-trigger function');
select ok(has_function_privilege('service_role','public.security_v2_set_company_key(uuid,uuid,text,text,text,uuid)','EXECUTE'),'Service role retains the trusted company-key RPC');
select ok(has_function_privilege('service_role','public.security_v2_change_member_role(uuid,uuid,uuid,text,text,text,uuid)','EXECUTE'),'Service role retains the trusted critical-action RPC');

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','authenticated','authenticated','patch-owner@test.local',extensions.crypt('Password-D','bf'),'2026-01-01','{}','{}',now(),now()),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','authenticated','authenticated','patch-editor@test.local',extensions.crypt('Password-E','bf'),'2026-01-01','{}','{}',now(),now());
insert into public.companies(id,name) values ('30000000-0000-4000-8000-000000000003','Patch Test Company');
insert into public.profiles(id,display_name,status,company_id) values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Patch Owner','active','30000000-0000-4000-8000-000000000003'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Patch Editor','active','30000000-0000-4000-8000-000000000003');
insert into public.company_memberships(company_id,user_id,role,status) values
 ('30000000-0000-4000-8000-000000000003','dddddddd-dddd-4ddd-8ddd-dddddddddddd','owner','active'),
 ('30000000-0000-4000-8000-000000000003','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','editor','active');
insert into public.user_security_credentials(user_id,key_hash)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',extensions.crypt('Personal-Key-Patch-123',extensions.gen_salt('bf',4)));
insert into public.company_security(company_id,code_hash,is_active)
values ('30000000-0000-4000-8000-000000000003',extensions.crypt('Company-Key-Old-123',extensions.gen_salt('bf',4)),true);

set local role service_role;
create temporary table trusted_key_result as select public.security_v2_set_company_key(
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd','30000000-0000-4000-8000-000000000003',
  'Personal-Key-Patch-123','Company-Key-Old-123','Company-Key-New-123',gen_random_uuid()) result;
select is((select result->>'ok' from trusted_key_result),'true','Trusted company-key rotation still works with the full key chain');

create temporary table denied_role_result as select public.security_v2_change_member_role(
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd','30000000-0000-4000-8000-000000000003',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','publisher','Wrong-Personal-Key','Company-Key-New-123',gen_random_uuid()) result;
select is((select result->>'ok' from denied_role_result),'false','Critical action rejects an invalid personal key');
reset role;
select is((select role from public.company_memberships where user_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),'editor','Denied critical action leaves the role unchanged');

set local role service_role;
create temporary table allowed_role_result as select public.security_v2_change_member_role(
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd','30000000-0000-4000-8000-000000000003',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','publisher','Personal-Key-Patch-123','Company-Key-New-123',gen_random_uuid()) result;
select is((select result->>'ok' from allowed_role_result),'true','Critical action accepts AAL2-backend actor with personal and company keys');
reset role;
select is((select role from public.company_memberships where user_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),'publisher','Successful trusted critical action changes the target role');

select * from finish();
rollback;
