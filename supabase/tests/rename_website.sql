begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users(id,aud,role,email) values
 ('19100000-0000-4000-8000-000000000001','authenticated','authenticated','rename-editor@test.invalid'),
 ('19100000-0000-4000-8000-000000000002','authenticated','authenticated','rename-viewer@test.invalid');
insert into public.profiles(id,display_name,status) values
 ('19100000-0000-4000-8000-000000000001','Synthetic editor','active'),
 ('19100000-0000-4000-8000-000000000002','Synthetic viewer','active');
insert into public.companies(id,name) values
 ('19200000-0000-4000-8000-000000000001','Synthetic rename A'),
 ('19200000-0000-4000-8000-000000000002','Synthetic rename B');
insert into public.company_memberships(company_id,user_id,role,status) values
 ('19200000-0000-4000-8000-000000000001','19100000-0000-4000-8000-000000000001','editor','active'),
 ('19200000-0000-4000-8000-000000000001','19100000-0000-4000-8000-000000000002','viewer','active');
insert into public.websites(id,company_id,name,public_slug,created_by) values
 ('19300000-0000-4000-8000-000000000001','19200000-0000-4000-8000-000000000001','Before','rename-synthetic-a','19100000-0000-4000-8000-000000000001'),
 ('19300000-0000-4000-8000-000000000002','19200000-0000-4000-8000-000000000002','Other','rename-synthetic-b','19100000-0000-4000-8000-000000000001');
create temporary table rename_before as select to_jsonb(w)-'name'-'updated_at' as data from public.websites w where id='19300000-0000-4000-8000-000000000001';

select ok(not has_function_privilege('anon','public.security_v2_rename_website(uuid,text,uuid)','EXECUTE'),'anon has no execute');
select ok(not has_function_privilege('service_role','public.security_v2_rename_website(uuid,text,uuid)','EXECUTE'),'service role not a rename bypass');
select ok(has_function_privilege('authenticated','public.security_v2_rename_website(uuid,text,uuid)','EXECUTE'),'authenticated may reach guarded operation');
select ok(not has_table_privilege('authenticated','public.websites','UPDATE'),'no direct website update grant');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select * from public.security_v2_rename_website('19300000-0000-4000-8000-000000000001','After',gen_random_uuid())$$,'42501','AAL2_REQUIRED','missing actor denied');
select set_config('request.jwt.claims','{"sub":"19100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select * from public.security_v2_rename_website('19300000-0000-4000-8000-000000000001','After',gen_random_uuid())$$,'42501','AAL2_REQUIRED','AAL1 denied');
select set_config('request.jwt.claims','{"sub":"19100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select * from public.security_v2_rename_website('19300000-0000-4000-8000-000000000001','After',gen_random_uuid())$$,'42501','NOT_AUTHORIZED','viewer denied');
select set_config('request.jwt.claims','{"sub":"19100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select * from public.security_v2_rename_website('19300000-0000-4000-8000-000000000002','After',gen_random_uuid())$$,'42501','NOT_AUTHORIZED','other company denied');
select throws_ok($$select * from public.security_v2_rename_website('19300000-0000-4000-8000-000000000099','After',gen_random_uuid())$$,'42501','NOT_AUTHORIZED','unknown website denied');
select throws_ok($$select * from public.security_v2_rename_website('19300000-0000-4000-8000-000000000001','   ',gen_random_uuid())$$,'22023','INVALID_NAME','empty name denied');
select throws_ok($$select * from public.security_v2_rename_website('19300000-0000-4000-8000-000000000001',repeat('x',161),gen_random_uuid())$$,'22023','INVALID_NAME','long name denied');
select throws_ok($$select * from public.security_v2_rename_website('19300000-0000-4000-8000-000000000001',E'bad\nname',gen_random_uuid())$$,'22023','INVALID_NAME','control characters denied');
select throws_ok($$select * from public.security_v2_rename_website('19300000-0000-4000-8000-000000000001',null,gen_random_uuid())$$,'22023','INVALID_NAME','null name denied');
select is((select name from public.security_v2_rename_website('19300000-0000-4000-8000-000000000001','  Renamed synthetic  ','19400000-0000-4000-8000-000000000001')),'Renamed synthetic','editor renames and receives trimmed actual name');
select is((select name from public.websites where id='19300000-0000-4000-8000-000000000001'),'Renamed synthetic','reload sees persisted name');
reset role;
select is((select to_jsonb(w)-'name'-'updated_at' from public.websites w where id='19300000-0000-4000-8000-000000000001'),(select data from rename_before),'only project name and update timestamp may change');
select is((select name from public.websites where id='19300000-0000-4000-8000-000000000002'),'Other','other company unchanged');
select is((select count(*) from public.audit_events where target_id='19300000-0000-4000-8000-000000000001' and event_type='website.rename' and result='success'),1::bigint,'exactly one successful rename audit');
select is((select actor_user_id from public.audit_events where request_correlation_id='19400000-0000-4000-8000-000000000001'),'19100000-0000-4000-8000-000000000001'::uuid,'server-derived audit actor');
update public.company_memberships set status='suspended' where user_id='19100000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select * from public.security_v2_rename_website('19300000-0000-4000-8000-000000000001','Denied',gen_random_uuid())$$,'42501','NOT_AUTHORIZED','suspended membership denied');
reset role;
update public.company_memberships set status='active' where user_id='19100000-0000-4000-8000-000000000001';
update public.profiles set status='suspended' where id='19100000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select * from public.security_v2_rename_website('19300000-0000-4000-8000-000000000001','Denied',gen_random_uuid())$$,'42501','NOT_AUTHORIZED','suspended profile denied');
reset role;
select is((select count(*) from public.website_publications where website_id='19300000-0000-4000-8000-000000000001'),0::bigint,'rename never publishes');
select * from finish();
rollback;
