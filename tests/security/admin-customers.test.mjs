import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { aggregateCustomers, selectCustomers, customerRoute, readCustomers, CUSTOMER_TABS } from '../../js/admin-customers-data.mjs'
import { mountCustomers } from '../../js/admin-customers.mjs'
import { resolveAdminPage } from '../../js/admin-shell.mjs'
const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222', c='33333333-3333-4333-8333-333333333333'
const companies=[{id:a,name:'Alfa Bedrift'},{id:b,name:'Åsen'},{id:c,name:'Øya'}]
const sites=[{id:'one',company_id:a,name:'Hovedside',public_slug:'hoved',current_publication_id:'pub'},{id:'two',company_id:a,name:'Ekstra side',public_slug:'ekstra',current_publication_id:null},{id:'three',company_id:b,name:'Åsen side',current_publication_id:null}]
const data=()=>aggregateCustomers(companies,sites)
function doc() { return {createElement:tag=>({tag,children:[],dataset:{},attrs:{},events:{},textContent:'',value:'',
  append(...nodes){this.children.push(...nodes)},replaceChildren(...nodes){this.children=nodes},
  setAttribute(k,v){this.attrs[k]=v},addEventListener(k,fn){this.events[k]=fn},
})} }
const flatten=n=>[n,...n.children.flatMap(flatten)]
const text=n=>flatten(n).map(x=>x.textContent).join(' ')
const settle=()=>new Promise(resolve=>setImmediate(resolve))
async function mounted(result=data()) { const ui=mountCustomers({document:doc(),load:async()=>result}); ui.route('#customers'); await settle(); return ui }

test('company-first aggregation: multiple companies, multiple websites, zero websites',()=>{
 const result=data(); assert.equal(result.customers.length,3)
 assert.deepEqual(result.customers.map(x=>[x.websites.length,x.published]),[[2,1],[1,0],[0,0]])
 assert.equal(result.orphans.length,0)
})
test('orphan websites never invent a customer or use names for mapping',()=>{
 const result=aggregateCustomers(companies,[...sites,{id:'orphan'},{id:'unknown',company_id:'44444444-4444-4444-8444-444444444444'},{id:'prototype',company_id:'constructor'}])
 assert.equal(result.customers.length,3);assert.equal(result.orphans.length,3)
 assert.equal(result.customers[0].websites.length,2)
})
test('invalid datasets fail rather than showing fabricated zeros',()=>{
 for(const args of [[null,[]],[[{id:'constructor'}],[]],[[companies[0],companies[0]],[]],[companies,[null]],[companies,[sites[0],sites[0]]]]) assert.throws(()=>aggregateCustomers(...args))
})
test('search ignores case and repeated whitespace and supports website names/slugs',()=>{
 assert.deepEqual(selectCustomers(data().customers,{search:' ALFA    bedrift '}).map(x=>x.id),[a])
 assert.deepEqual(selectCustomers(data().customers,{search:'ekstra'}).map(x=>x.id),[a])
 assert.equal(selectCustomers(data().customers,{search:'ikke funnet'}).length,0)
})
test('Norwegian A–Å and Å–A sorting does not mutate original',()=>{
 const rows=data().customers
 assert.deepEqual(selectCustomers(rows).map(x=>x.name),['Alfa Bedrift','Øya','Åsen'])
 assert.deepEqual(selectCustomers(rows,{sort:'desc'}).map(x=>x.name),['Åsen','Øya','Alfa Bedrift'])
 assert.equal(rows[1].name,'Åsen')
})
test('publication filters are website filters, not customer lifecycle',()=>{
 assert.deepEqual(selectCustomers(data().customers,{filter:'published'}).map(x=>x.id),[a])
 assert.equal(selectCustomers(data().customers,{filter:'unpublished'}).length,2)
 assert.deepEqual(selectCustomers(data().customers,{filter:'none'}).map(x=>x.id),[c])
})
test('customer routes use strict UUIDs and allowlisted tabs',()=>{
 assert.deepEqual(customerRoute('#customers'),{kind:'list'})
 assert.deepEqual(customerRoute(`#customer/${a}`),{kind:'workspace',id:a,tab:'overview'})
 assert.equal(resolveAdminPage(`#customer/${a}/websites`).id,'customers')
 for(const tab of CUSTOMER_TABS) assert.equal(customerRoute(`#customer/${a}/${tab.id}`).tab,tab.id)
 for(const route of ['#customer','#customer/constructor','#customer/__proto__','#customer/toString',`#customer/${a}/constructor`,`#customer/${a}/websites/extra`,`#customer/${a}?role=owner`,'#customer/%3Cscript%3E']) assert.equal(customerRoute(route).kind,'invalid')
})
test('list count and no-results are distinct from no company data',async()=>{
 const ui=await mounted();assert.match(text(ui.element),/3 av 3 selskaper/)
 const search=flatten(ui.element).find(n=>n.tag==='input');search.value='unfindable';search.events.input()
 assert.match(text(ui.element),/Ingen treff/)
 assert(flatten(ui.element).some(n=>n.dataset.state==='no-results'))
 const empty=await mounted(aggregateCustomers([],[]));assert.match(text(empty.element),/Ingen selskaper funnet/)
})
test('unknown UUID and prototype routes fail safely without selecting another customer',async()=>{
 const ui=await mounted()
 ui.route('#customer/44444444-4444-4444-8444-444444444444');assert.match(text(ui.element),/Kunden er ikke tilgjengelig/)
 for(const key of ['constructor','__proto__','toString']){ui.route(`#customer/${key}`);assert.match(text(ui.element),/Ugyldig kundeadresse/)}
})
test('workspace contains all websites, only published valid live action, encoded Builder ID',async()=>{
 const ui=await mounted();ui.route(`#customer/${a}/websites`)
 const links=flatten(ui.element).filter(n=>n.tag==='a')
 assert.equal(links.filter(n=>n.href?.startsWith('builder.html')).length,2)
 assert.equal(links.filter(n=>n.href?.startsWith('site.html')).length,1)
 assert.equal(links.find(n=>n.href?.startsWith('site.html')).rel,'noopener noreferrer')
 ui.route(`#customer/${c}/websites`);assert.match(text(ui.element),/Ingen nettsider ennå/)
 assert(!flatten(ui.element).some(n=>n.href?.startsWith('builder.html')))
})
test('publication without slug is not a live link',async()=>{
 const ui=await mounted(aggregateCustomers(companies,[{...sites[0],public_slug:null}]))
 ui.route(`#customer/${a}/websites`)
 assert(!flatten(ui.element).some(n=>n.href?.startsWith('site.html')))
})
test('malicious company/project names are rendered as text nodes',async()=>{
 const name='<img src=x onerror=alert(1)>', project='<script>bad()</script>'
 const ui=await mounted(aggregateCustomers([{id:a,name}],[{...sites[0],id:'a&b',name:project}]))
 assert.match(text(ui.element),/<img src=x onerror=alert\(1\)>/)
 ui.route(`#customer/${a}/websites`);assert.match(text(ui.element),/<script>bad\(\)<\/script>/)
 assert(!flatten(ui.element).some(n=>['img','script'].includes(n.tag)))
 assert(flatten(ui.element).some(n=>n.href==='builder.html?website=a%26b'))
})
test('future filters/action disabled; no fabricated services, responsibility or status',async()=>{
 const ui=await mounted();assert.equal(flatten(ui.element).filter(n=>n.tag==='select'&&n.disabled).length,3)
 assert(flatten(ui.element).some(n=>n.tag==='button'&&n.disabled))
 ui.route(`#customer/${a}`);assert.match(text(ui.element),/Tjenestedata vises ikke i dette arbeidsområdet ennå/)
 assert.doesNotMatch(text(ui.element),/Daniel|Christian|Google Ads|Meta Ads|50%/)
 ui.route(`#customer/${a}/seo`);assert.match(text(ui.element),/SEO kommer senere/)
})
test('loading, unavailable and failures are safe and retries possible',async()=>{
 const unavailable=mountCustomers({document:doc()});unavailable.route('#customers');assert.equal(unavailable.element.dataset.state,'unavailable')
 let reject;const ui=mountCustomers({document:doc(),load:()=>new Promise((_,r)=>{reject=r})})
 ui.route('#customers');assert.equal(ui.element.dataset.state,'loading')
 reject(new Error('PRIVATE TOKEN'));await settle()
 assert.equal(ui.element.dataset.state,'error');assert.match(text(ui.element),/Prøv igjen/);assert.doesNotMatch(text(ui.element),/PRIVATE/)
})
test('malformed loader payload is a visible error, not an uncaught rendering failure',async()=>{
 for(const payload of [null,{customers:[null],orphans:[]},{customers:[{id:a,name:'Test',websites:[null],published:0}],orphans:[]}]) {
 const ui=await mounted(payload);assert.equal(ui.element.dataset.state,'error')
 }
})
test('read-only loader paginates both sources and returns no partial dataset on error',async()=>{
 const calls=[]
 const client={from:table=>({select:fields=>({order:key=>({range:async(start,end)=>{
 calls.push({table,fields,key,start,end});return {data:table==='companies'?companies:sites,error:null}
 }})})})}
 const result=await readCustomers(client);assert.equal(result.customers.length,3)
 assert.deepEqual(calls.map(x=>x.fields),['id,name','id,company_id,name,public_slug,current_publication_id'])
 assert(calls.every(x=>x.key==='id'&&x.start===0&&x.end===499))
 const failing={from:()=>({select:()=>({order:()=>({range:async()=>({data:null,error:{message:'PRIVATE'}})})})})}
 await assert.rejects(()=>readCustomers(failing),/CUSTOMERS_LOAD_FAILED/)
 const offsets=[];const paged={from:table=>({select:()=>({order:()=>({range:async start=>{
 if(table==='websites')return {data:[]}
 offsets.push(start);return {data:start===0?Array.from({length:500},(_,i)=>({id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,name:'Test'})):[]}
 }})})})}
 assert.equal((await readCustomers(paged)).customers.length,500);assert.deepEqual(offsets,[0,500])
})
test('customer guard ordering, safe sinks, and no new writes/storage/auth paths',()=>{
 const admin=readFileSync(new URL('../../js/admin.js',import.meta.url),'utf8')
 assert(admin.indexOf('await requireAal2({platformAdmin:true})')<admin.indexOf('const customers = mountCustomers'))
 for(const file of ['admin-customers.mjs','admin-customers-data.mjs']){
 const source=readFileSync(new URL(`../../js/${file}`,import.meta.url),'utf8')
 assert.doesNotMatch(source,/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function|srcdoc|localStorage|sessionStorage|console\.|\.insert\(|\.update\(|\.delete\(|functions\.invoke|\.rpc\(/)
 }
})
