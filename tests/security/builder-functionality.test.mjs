import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {emptyDraft,addPage,addSection,moveSection,normalizeSections,templateDraft,renderDraftPage} from '../../js/builder-editor.mjs'
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8')
const context=vm.createContext({});vm.runInContext(read('js/builder-data.js'),context)
const templates=JSON.parse(vm.runInContext('JSON.stringify(BUILDER_TEMPLATES)',context))

test('rename button remains readable on the dark toolbar, including hover',()=>{
  const css=read('css/portal-theme.css')
  assert.match(css,/\.builder-body \.topbar #renameProjectBtn,[^{]+\{ color: #e4e8dd;/)
  assert.match(css,/\.builder-body \.topbar #renameProjectBtn:hover \{ color: #171b1b; background: #d3e59f;/)
})

test('page names/IDs/slugs are validated and collisions produce unique slugs within server limits',()=>{
  let data=emptyDraft('Synthetic');data=addPage(data,'Ærlig Økonomi År',randomUUID());data=addPage(data,'Ærlig Økonomi År',randomUUID())
  assert.equal(data.pages[1].slug,'aerlig-okonomi-ar');assert.equal(data.pages[2].slug,'aerlig-okonomi-ar-2');assert.notEqual(data.pages[1].id,data.pages[2].id)
  assert.throws(()=>addPage(data,'Valid',data.pages[0].id));assert.throws(()=>addPage(data,'x'.repeat(121),randomUUID()))
  for(let i=data.pages.length;i<50;i++)data=addPage(data,'Same',randomUUID())
  assert.equal(new Set(data.pages.map(p=>p.id)).size,50);assert.equal(new Set(data.pages.map(p=>p.slug)).size,50)
  assert.throws(()=>addPage(data,'51',randomUUID()),/50/)
})
test('locked becomes removable only for sections, preserves page lock and custom content, never mutates input',()=>{
  const before=emptyDraft('Synthetic');before.pages[0].locked=true;before.pages[0].sections=[{id:'hero',name:'Hero',enabled:true,locked:true},{id:'about',locked:false,enabled:false}]
  const result=normalizeSections(before);assert.equal(result.pages[0].locked,true);assert.equal(result.pages[0].sections[0].removable,false);assert.equal(result.pages[0].sections[1].removable,true)
  for(const s of result.pages[0].sections)assert(!Object.hasOwn(s,'locked'))
  assert(before.pages[0].sections[0].locked)
})
test('section additions expose only editable types, no fake reviews/team/FAQ, no duplicates',()=>{
  let sections=[];for(const id of ['hero','about','offerings','gallery','contact'])sections=addSection(sections,id)
  for(const id of ['hero','testimonials','team','faq','ctabanner','constructor','__proto__'])assert.throws(()=>addSection(sections,id))
  assert.deepEqual(moveSection(sections,0,4).map(s=>s.id),['about','offerings','gallery','contact','hero'])
  assert.deepEqual(moveSection(sections,-1,1),sections)
})
test('all offered templates have real supported draft layout and valid section/color format, no demo injection',()=>{
  const original=emptyDraft('My synthetic business');original.pages[0].heroTitle='Customer title';original.pages[0].sections=addSection([], 'hero')
  for(const t of templates) {
    for(const replace of [false,true]) {
      const result=templateDraft(original,t,replace)
      for(const key of ['accent','accent2','bg'])assert.match(result[key],/^#[0-9a-f]{6}$/i)
      for(const section of result.pages[0].sections)assert.deepEqual(Object.keys(section).sort(),['enabled','id','name','removable'])
      assert.equal(result.businessName,'My synthetic business');assert.equal(result.pages[0].id,'home')
      assert.equal(result.pages[0].heroTitle,replace?'Forside':'Customer title')
      assert.match(renderDraftPage(result.pages[0],result),new RegExp('draft-layout-'+t.id))
      assert(!JSON.stringify(result).includes(t.aboutText))
    }
  }
  assert.equal(original.pages[0].heroTitle,'Customer title')
})
test('render follows order/visibility, escapes untrusted content, blocks unsafe image URLs and never runs custom code',()=>{
  const data=emptyDraft('Synthetic'),p=data.pages[0];p.heroTitle='<script>bad()</script>';p.aboutTitle='Before hero';p.customCode='<script>hidden()</script>'
  p.gallery=[{img:'javascript:alert(1)',emoji:'<img onerror=bad>'}]
  p.sections=[{id:'about',enabled:true},{id:'hero',enabled:true},{id:'gallery',enabled:true},{id:'contact',enabled:false}]
  const html=renderDraftPage(p,data)
  assert(html.indexOf('intro')<html.indexOf('class="hero"'));assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script|javascript:|hidden\(\)|section contact|<img/)
  assert.match(html,/color:#000000/);assert.match(renderDraftPage(p,{...data,bg:'#000000'}),/color:#ffffff/)
})
test('rename adapter calls only the narrowly-scoped RPC, validates input and fails closed',async()=>{
  const source=read('js/builder-project-api.mjs').replace(/^import .*$/gm,'').replace('export async function','async function')
  const calls=[];let failure=false
  const ctx=vm.createContext({crypto:{randomUUID},supabase:{rpc(name,args){calls.push({name,args});return {single:async()=>failure?{data:null,error:Error('internal')}:{data:{website_id:args.p_website_id,name:args.p_name},error:null}}}}})
  vm.runInContext(source,ctx)
  for(const invalid of ['', 'x'.repeat(161),'bad\nname'])await assert.rejects(vm.runInContext(`renameWebsite("synthetic",${JSON.stringify(invalid)})`,ctx),/INVALID_NAME/)
  assert.equal(calls.length,0)
  assert.equal((await vm.runInContext('renameWebsite("synthetic", " New project ")',ctx)).name,'New project')
  assert.equal(calls[0].name,'security_v2_rename_website');assert.deepEqual(Object.keys(calls[0].args).sort(),['p_correlation_id','p_name','p_website_id']);assert.equal(calls[0].args.p_name,'New project')
  failure=true;await assert.rejects(vm.runInContext('renameWebsite("synthetic", "Next")',ctx),/RENAME_FAILED/)
  assert.doesNotMatch(source,/\.from\(|service_role|localStorage|sessionStorage/)
})
test('rename migration derives actor, matches draft editor roles and can update only name',()=>{
  const sql=read('supabase/migrations/20261019120000_rename_website.sql')
  assert.match(sql,/v_actor uuid := auth.uid\(\)/);assert.match(sql,/not public.is_aal2\(\)/)
  assert.match(sql,/array\['owner','company_admin','publisher','editor'\]/);assert.match(sql,/p.status = 'active'/)
  assert.match(sql,/security definer set search_path = ''/);assert.match(sql,/for update/)
  assert.deepEqual(sql.match(/update public\.[^;]+;/g),['update public.websites w set name = v_name where w.id = p_website_id;'])
  assert.match(sql,/private.write_audit\(v_actor, v_company, 'website.rename', 'success'/)
  assert.match(sql,/from public, anon, service_role/);assert.match(sql,/to authenticated/)
  assert.doesNotMatch(sql,/alter table|create policy|grant .*on table|p_actor/)
})
