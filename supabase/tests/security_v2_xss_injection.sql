begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

create temporary table payloads(name text,payload jsonb,valid boolean);
insert into payloads values
('valid', '{"businessName":"Safe","accent":"#112233","accent2":"#445566","bg":"#ffffff","activePageId":"home","pages":[{"id":"home","slug":"","name":"Forside","heroTitle":"Trygg <script>alert(1)</script>","offerings":[],"gallery":[{"emoji":"x","img":"https://images.example.test/a.png"}],"sections":[{"id":"hero","name":"Hero","enabled":true}],"customCode":"<script>stored but never executed</script>"}]}'::jsonb,true),
('attribute breakout', '{"businessName":"X","accent":"#112233","accent2":"#445566","bg":"#ffffff","activePageId":"home","pages":[{"id":"home","slug":"","name":"X","offerings":[],"gallery":[{"img":"https://x.test/a.png\u0027 onerror=\u0027alert(1)"}],"sections":[]}]}'::jsonb,false),
('style breakout', '{"businessName":"X","accent":"#112233\" onload=\"alert(1)","accent2":"#445566","bg":"#ffffff","activePageId":"home","pages":[{"id":"home","slug":"","name":"X","offerings":[],"gallery":[],"sections":[]}]}'::jsonb,false),
('javascript url', '{"businessName":"X","accent":"#112233","accent2":"#445566","bg":"#ffffff","activePageId":"home","pages":[{"id":"home","slug":"","name":"X","offerings":[],"gallery":[{"img":"javascript:alert(1)"}],"sections":[]}]}'::jsonb,false),
('svg data', '{"businessName":"X","accent":"#112233","accent2":"#445566","bg":"#ffffff","activePageId":"home","pages":[{"id":"home","slug":"","name":"X","offerings":[],"gallery":[{"img":"data:image/svg+xml;base64,PHN2Zy8+"}],"sections":[]}]}'::jsonb,false),
('html data', '{"businessName":"X","accent":"#112233","accent2":"#445566","bg":"#ffffff","activePageId":"home","pages":[{"id":"home","slug":"","name":"X","offerings":[],"gallery":[{"img":"data:text/html;base64,PHNjcmlwdD4="}],"sections":[]}]}'::jsonb,false),
('css injection', '{"businessName":"X","accent":"red; background:url(javascript:alert(1))","accent2":"#445566","bg":"#ffffff","activePageId":"home","pages":[{"id":"home","slug":"","name":"X","offerings":[],"gallery":[],"sections":[]}]}'::jsonb,false),
('event key', '{"businessName":"X","accent":"#112233","accent2":"#445566","bg":"#ffffff","onload":"alert(1)","activePageId":"home","pages":[{"id":"home","slug":"","name":"X","offerings":[],"gallery":[],"sections":[]}]}'::jsonb,false),
('gallery event key', '{"businessName":"X","accent":"#112233","accent2":"#445566","bg":"#ffffff","activePageId":"home","pages":[{"id":"home","slug":"","name":"X","offerings":[],"gallery":[{"img":"https://x.test/a.png","onerror":"alert(1)"}],"sections":[]}]}'::jsonb,false),
('malformed url', '{"businessName":"X","accent":"#112233","accent2":"#445566","bg":"#ffffff","activePageId":"home","pages":[{"id":"home","slug":"","name":"X","offerings":[],"gallery":[{"img":"https://x.test/<script>"}],"sections":[]}]}'::jsonb,false),
('file url', '{"businessName":"X","accent":"#112233","accent2":"#445566","bg":"#ffffff","activePageId":"home","pages":[{"id":"home","slug":"","name":"X","offerings":[],"gallery":[{"img":"file:///etc/passwd"}],"sections":[]}]}'::jsonb,false),
('bad email link', '{"businessName":"X","accent":"#112233","accent2":"#445566","bg":"#ffffff","contactEmail":"x@test.no\" onload=\"alert(1)","activePageId":"home","pages":[{"id":"home","slug":"","name":"X","offerings":[],"gallery":[],"sections":[]}]}'::jsonb,false),
('bad section', '{"businessName":"X","accent":"#112233","accent2":"#445566","bg":"#ffffff","activePageId":"home","pages":[{"id":"home","slug":"","name":"X","offerings":[],"gallery":[],"sections":[{"id":"script","enabled":true}]}]}'::jsonb,false),
('bad slug quote', '{"businessName":"X","accent":"#112233","accent2":"#445566","bg":"#ffffff","activePageId":"home","pages":[{"id":"home","slug":"x\" onclick=\"alert(1)","name":"X","offerings":[],"gallery":[],"sections":[]}]}'::jsonb,false);

select is(private.site_content_is_valid(payload),valid,name) from payloads order by name;

insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','authenticated','authenticated','xss@test.local','x',now(),now());
insert into public.companies(id,name) values('30000000-0000-4000-8000-000000000003','XSS Co');
insert into public.profiles(id,display_name,status) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','XSS Tester','active');
insert into public.company_memberships(company_id,user_id,role,status) values('30000000-0000-4000-8000-000000000003','dddddddd-dddd-4ddd-8ddd-dddddddddddd','owner','active');
insert into public.websites(id,company_id,name,public_slug,created_by) values('33000000-0000-4000-8000-000000000033','30000000-0000-4000-8000-000000000003','XSS Site','xss-site','dddddddd-dddd-4ddd-8ddd-dddddddddddd');
select throws_ok($$insert into public.website_drafts(website_id,content,revision,updated_by) select '33000000-0000-4000-8000-000000000033',payload,1,'dddddddd-dddd-4ddd-8ddd-dddddddddddd' from payloads where name='javascript url'$$,'22023','INVALID_CONTENT_SCHEMA','Stored XSS cannot survive direct draft insert');
select throws_ok($$insert into public.website_publications(website_id,version,content,source_draft_revision,published_by) select '33000000-0000-4000-8000-000000000033',1,payload,1,'dddddddd-dddd-4ddd-8ddd-dddddddddddd' from payloads where name='attribute breakout'$$,'22023','INVALID_CONTENT_SCHEMA','Stored XSS cannot survive direct publication insert');
select ok((select private.site_content_is_valid(payload) from payloads where name='valid'),'Custom code may remain stored as inert data');
select ok(not has_function_privilege('authenticated','public.security_v2_validate_site_content(jsonb)','EXECUTE'),'Browser cannot bypass trusted validator API');
select * from finish(); rollback;
