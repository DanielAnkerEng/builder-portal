begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','a@test.local',extensions.crypt('Password-A','bf'),'2026-01-01','{}','{}',now(),now()),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','b@test.local',extensions.crypt('Password-B','bf'),'2026-01-01','{}','{}',now(),now()),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','authenticated','authenticated','viewer@test.local',extensions.crypt('Password-C','bf'),'2026-01-01','{}','{}',now(),now());
insert into public.companies(id,name) values ('10000000-0000-4000-8000-000000000001','Company A'),('20000000-0000-4000-8000-000000000002','Company B');
insert into public.profiles(id,display_name,status) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','User A','active'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','User B','active'),('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Viewer','active');
insert into public.company_memberships(company_id,user_id,role,status) values
 ('10000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner','active'),
 ('20000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owner','active'),
 ('10000000-0000-4000-8000-000000000001','cccccccc-cccc-4ccc-8ccc-cccccccccccc','viewer','active');
insert into public.websites(id,company_id,name,public_slug,created_by) values
 ('11000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001','Site A','site-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('22000000-0000-4000-8000-000000000022','20000000-0000-4000-8000-000000000002','Site B','site-b','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.website_drafts(website_id,content,revision,updated_by) values
 ('11000000-0000-4000-8000-000000000011','{"businessName":"A","accent":"#112233","accent2":"#445566","bg":"#ffffff","activePageId":"home","pages":[{"id":"home","slug":"","name":"Forside","offerings":[],"gallery":[],"sections":[]}]}'::jsonb,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('22000000-0000-4000-8000-000000000022','{"businessName":"B","accent":"#112233","accent2":"#445566","bg":"#ffffff","activePageId":"home","pages":[{"id":"home","slug":"","name":"Forside","offerings":[],"gallery":[],"sections":[]}]}'::jsonb,1,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.user_security_credentials(user_id,key_hash) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',extensions.crypt('Personal-Key-A-123',extensions.gen_salt('bf',4))),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',extensions.crypt('Personal-Key-B-123',extensions.gen_salt('bf',4)));

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","aal":"aal2"}',true);
select is((select count(*) from public.website_drafts),1::bigint,'Customer A sees only own draft');
select is((select count(*) from public.website_drafts where website_id='22000000-0000-4000-8000-000000000022'),0::bigint,'Customer A cannot read Company B draft');
select throws_ok($$select * from public.security_v2_save_draft('22000000-0000-4000-8000-000000000022','{}',1,gen_random_uuid())$$,'42501','NOT_AUTHORIZED','Customer A cannot modify Company B draft');
select ok(not has_table_privilege('authenticated','public.user_security_credentials','SELECT'),'Customer cannot read personal hashes');
select ok(not has_table_privilege('authenticated','public.company_security','SELECT'),'Customer cannot read company hashes');
select ok(not has_table_privilege('authenticated','public.websites','UPDATE'),'Client cannot switch active publication');
select ok(not has_function_privilege('authenticated','public.security_v2_publish_site(uuid,uuid,bigint,text,uuid)','EXECUTE'),'Browser cannot call trusted publish RPC');
select ok(not has_function_privilege('authenticated','public.security_v2_change_member_role(uuid,uuid,uuid,text,text,text,uuid)','EXECUTE'),'Browser cannot call critical RPC');
select ok(not has_function_privilege('authenticated','public.security_v2_stage_legacy_import(uuid,text,text,text,text,uuid,jsonb,jsonb,uuid)','EXECUTE'),'Browser cannot call trusted import RPC');

select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","aal":"aal1"}',true);
select is((select count(*) from public.websites),0::bigint,'AAL1 cannot read protected websites');
select throws_ok($$select * from public.security_v2_save_draft('11000000-0000-4000-8000-000000000011','{}',1,gen_random_uuid())$$,'42501','AAL2_REQUIRED','AAL1 cannot save draft');

select set_config('request.jwt.claims','{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select * from public.security_v2_save_draft('11000000-0000-4000-8000-000000000011','{}',1,gen_random_uuid())$$,'42501','NOT_AUTHORIZED','Viewer cannot save draft');
select is((select count(*) from public.audit_events),0::bigint,'Customer cannot read full audit');
select is((select count(*) from public.get_customer_activity('10000000-0000-4000-8000-000000000001',50)),0::bigint,'Customer receives only allowlisted successful activity');
select throws_ok($$select * from public.get_customer_activity('20000000-0000-4000-8000-000000000002',50)$$,'42501','NOT_AUTHORIZED','Customer cannot read another company activity');
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select * from public.get_customer_activity('10000000-0000-4000-8000-000000000001',50)$$,'42501','AAL2_REQUIRED','AAL1 cannot read customer activity');

reset role;
set local role service_role;
select is((public.security_v2_publish_site('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11000000-0000-4000-8000-000000000011',1,'wrong',gen_random_uuid())->>'ok')::boolean,false,'Wrong personal key cannot publish');
select is((select current_publication_id from public.websites where id='11000000-0000-4000-8000-000000000011'),null,'Failed publish leaves current version unchanged');
select is((public.security_v2_publish_site('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11000000-0000-4000-8000-000000000011',99,'Personal-Key-A-123',gen_random_uuid())->>'error'),'STALE_REVISION','Stale revision cannot publish');
select is((public.security_v2_publish_site('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11000000-0000-4000-8000-000000000011',1,'Personal-Key-B-123',gen_random_uuid())->>'ok')::boolean,false,'User B key cannot publish as User A');
select is((public.security_v2_publish_site('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11000000-0000-4000-8000-000000000011',1,'Personal-Key-A-123',gen_random_uuid())->>'ok')::boolean,true,'Correct actor key publishes atomically');
select isnt((select current_publication_id from public.websites where id='11000000-0000-4000-8000-000000000011'),null,'Successful publish activates immutable version');

reset role;
insert into public.platform_admins(user_id,admin_role,is_active) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin',true);
set local role service_role;
create temporary table staged_import as select public.security_v2_stage_legacy_import(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64),'legacy-a','Legacy A','legacy-a@test.local',
  '10000000-0000-4000-8000-000000000001',(select content from public.website_drafts where website_id='11000000-0000-4000-8000-000000000011'),
  '{"source":"test"}'::jsonb,gen_random_uuid()) result;
select is((select result->>'ok' from staged_import),'true','Platform admin can stage a valid legacy export');
select is((select status from public.legacy_site_imports where source_fingerprint=repeat('a',64)),'needs_mapping','Staging never creates or publishes a website');
select is((public.security_v2_confirm_legacy_mapping('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select id from public.legacy_site_imports where source_fingerprint=repeat('a',64)),'10000000-0000-4000-8000-000000000001','Imported A','imported-a',false,gen_random_uuid())->>'ok'),'false','Mapping requires explicit human confirmation');
select is((public.security_v2_confirm_legacy_mapping('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select id from public.legacy_site_imports where source_fingerprint=repeat('a',64)),'20000000-0000-4000-8000-000000000002','Imported A','imported-a',true,gen_random_uuid())->>'error'),'COMPANY_MISMATCH','Legacy company evidence prevents cross-company mapping');
select is((public.security_v2_confirm_legacy_mapping('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select id from public.legacy_site_imports where source_fingerprint=repeat('a',64)),'10000000-0000-4000-8000-000000000001','Imported A','imported-a',true,gen_random_uuid())->>'published'),'false','Confirmed import creates private draft only');

reset role;
set local role anon;
select ok(not has_table_privilege('anon','public.website_drafts','SELECT'),'Anonymous cannot read drafts');
select is((select count(*) from public.get_public_site('site-a')),1::bigint,'Anonymous reads active public snapshot only');
select ok(not has_table_privilege('anon','public.website_publications','SELECT'),'Anonymous cannot read publication history table');

select * from finish();
rollback;
