import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mountNewCustomer } from '../../js/admin-new-customer.mjs'
import { mountCustomers } from '../../js/admin-customers.mjs'
import { customerRoute } from '../../js/admin-customers-data.mjs'
import { resolveAdminPage } from '../../js/admin-shell.mjs'
const id = '11111111-1111-4111-8111-111111111111'
const all = node => [node, ...node.children.flatMap(all)]
const text = node => all(node).map(n => n.textContent).join(' ')
const settle = () => new Promise(resolve => setImmediate(resolve))
function setup(overrides = {}) {
  const nodes = [], events = new Map(), calls = [], navigation = []
  const document = { getElementById: id => nodes.findLast(n => n.id === id), createElement(tag) {
    const node = { tag, children:[], attrs:{}, events:{}, dataset:{}, textContent:'', value:'',
      append(...children) { this.children.push(...children) }, replaceChildren(...children) { this.children = children },
      setAttribute(k,v) { this.attrs[k] = v }, addEventListener(k,v) { this.events[k] = v }, focus() { document.activeElement = this } }
    nodes.push(node); return node
  } }
  const window = { location:{ hash:'#customers/new' }, confirm: () => false,
    addEventListener(k,fn) { events.set(k,fn) }, removeEventListener(k) { events.delete(k) } }
  const api = {
    listAssignees: async () => ({ ok:true, assignees:[] }),
    createCompany: async attempt => { calls.push(attempt); return { attempt,idempotencyKey:attempt.idempotencyKey,ok:true,status:'completed',operationId:id,companyId:id } },
    getCreationStatus: async attempt => ({ attempt,idempotencyKey:attempt.idempotencyKey,ok:true,status:'not_found' }), ...overrides.api,
  }
  const ui = mountNewCustomer({ document,window,api,refreshCustomer:overrides.refreshCustomer || (async () => true),navigate:href => navigation.push(href) })
  const click = label => { const node = all(ui.element).find(n => n.tag === 'button' && n.textContent === label); assert.ok(node, label); if (!node.disabled) node.events.click() }
  const input = (id,value) => { const node = all(ui.element).find(n => n.id === id); assert.ok(node,id); node.value = value; node.events.input() }
  const ready = async () => { input('nc-company.name','<img onerror=bad()>'); click('Neste'); click('Neste'); click('Neste'); await settle(); click('Neste') }
  return { ui,window,document,events,calls,navigation,click,input,ready }
}
test('exact wizard route, list/workspace retained, unknown safe', () => {
  assert.deepEqual(customerRoute('#customers/new'),{kind:'new'})
  assert.equal(resolveAdminPage('#customers/new').id,'customers')
  assert.equal(customerRoute('#customers').kind,'list')
  assert.equal(customerRoute(`#customer/${id}/overview`).kind,'workspace')
  assert.equal(resolveAdminPage('#customers/new/extra').id,'dashboard')
})
test('required fields, error association and focus; five steps/back/edit preserve text',async () => {
  const s = setup(); s.click('Neste')
  assert.equal(s.document.activeElement.id,'nc-company.name')
  assert.equal(s.document.activeElement.attrs['aria-describedby'],'nc-company.name-error')
  s.input('nc-company.name','Example'); s.input('nc-company.organizationNumber','123'); s.click('Neste')
  assert.equal(s.document.activeElement.id,'nc-company.organizationNumber')
  s.input('nc-company.organizationNumber','123 456 789'); s.click('Neste')
  assert.match(text(s.ui.element),/sender ingen invitasjon/)
  s.input('nc-contact.email','test@example.invalid'); s.click('Neste')
  assert.equal(s.document.activeElement.id,'nc-contact.name')
  s.input('nc-contact.name','Contact'); s.click('Neste'); s.click('Tilbake')
  assert.equal(all(s.ui.element).find(n => n.id === 'nc-contact.email').value,'test@example.invalid')
  s.click('Neste'); s.click('Neste'); await settle(); s.click('Neste')
  for (const name of ['Bedrift','Kontaktperson','Tjenester','Wreach-oppsett']) assert.ok(text(s.ui.element).includes(`Rediger ${name}`))
  s.click('Rediger Bedrift'); assert.equal(all(s.ui.element).find(n => n.id === 'nc-company.name').value,'Example')
  assert.equal(s.calls.length,0)
})
test('real checkbox services, zero/multiple selections, conditional assignments and stale removal',async () => {
  const s = setup({api:{listAssignees:async()=>({ok:true,assignees:[{userId:id,displayName:'Synthetic admin'}]})}})
  s.input('nc-company.name','Example');s.click('Neste');s.click('Neste')
  const boxes = all(s.ui.element).filter(n=>n.type==='checkbox');assert.equal(boxes.length,11)
  for(const value of ['seo','meta_ads','content']) {const box=boxes.find(n=>n.value===value);box.checked=true;box.events.change()}
  s.click('Neste');await settle()
  assert.equal(all(s.ui.element).filter(n=>n.tag==='select').length,5)
  const assignee=all(s.ui.element).find(n=>n.id==='nc-assignment-seo');assignee.value=id;assignee.events.change()
  s.click('Tilbake');const seo=all(s.ui.element).find(n=>n.type==='checkbox'&&n.value==='seo');seo.checked=false;seo.events.change()
  s.click('Neste');s.click('Neste');s.click('Opprett kunde');await settle()
  assert.deepEqual(s.calls[0].payload.internal.assignments,[])
})
test('assignees only load at step four, loading/error/retry/empty handled',async()=>{
  let count=0,resolve
  const s=setup({api:{listAssignees:()=>{count++;return new Promise(r=>{resolve=r})}}})
  s.input('nc-company.name','Example');s.click('Neste');s.click('Neste');assert.equal(count,0);s.click('Neste')
  assert.match(text(s.ui.element),/Laster ansvarlige/);resolve({ok:false});await settle()
  assert.match(text(s.ui.element),/Kunne ikke hente ansvarlige/);s.click('Hent ansvarlige på nytt');resolve({ok:true,assignees:[]});await settle()
  assert.match(text(s.ui.element),/Ingen tilgjengelige ansvarlige/)
  assert.ok(all(s.ui.element).some(n=>n.textContent==='Ikke tildelt'))
})
test('no write before confirmation, double submit blocked, snapshot frozen and success navigates',async()=>{
  let resolve, captured
  const s=setup({api:{createCompany:a=>{captured=a;return new Promise(r=>{resolve=r})}}})
  await s.ready();assert.equal(captured,undefined)
  const submit=all(s.ui.element).find(n=>n.textContent==='Opprett kunde')
  submit.events.click();submit.events.click();assert.ok(Object.isFrozen(captured.payload.company))
  assert.equal(s.ui.element.dataset.status,'submitting');assert.equal(s.ui.canLeave(),false)
  resolve({attempt:captured,idempotencyKey:captured.idempotencyKey,status:'completed',operationId:id,companyId:id});await settle()
  assert.deepEqual(s.navigation,[`#customer/${id}/overview`]);assert.equal(s.events.has('beforeunload'),false)
})
test('uncertainty and NOT_FOUND retain same request; controlled retry only',async()=>{
  const attempts=[]
  const s=setup({api:{createCompany:async a=>{attempts.push(a);return {attempt:a,idempotencyKey:a.idempotencyKey,status:'uncertain',errorCode:'OPERATION_FAILED'}}}})
  await s.ready();s.click('Opprett kunde');await settle();assert.match(text(s.ui.element),/Resultatet kunne ikke bekreftes/)
  assert.equal(s.ui.canLeave(),false);s.click('Kontroller status');await settle();assert.equal(attempts.length,1)
  assert.match(text(s.ui.element),/fortsatt uavklart/);s.click('Prøv samme forespørsel igjen');await settle()
  assert.equal(attempts.length,2);assert.equal(attempts[0].payload,attempts[1].payload);assert.equal(attempts[0].idempotencyKey,attempts[1].idempotencyKey)
})
test('conflict has no retry/new key; trusted completed status refreshes only',async()=>{
  const s=setup({api:{createCompany:async a=>({attempt:a,idempotencyKey:a.idempotencyKey,status:'uncertain',errorCode:'IDEMPOTENCY_CONFLICT'}),getCreationStatus:async a=>({attempt:a,idempotencyKey:a.idempotencyKey,status:'completed',companyId:id,operationId:id})}})
  await s.ready();s.click('Opprett kunde');await settle()
  assert.ok(!text(s.ui.element).includes('Prøv samme forespørsel igjen'))
  s.click('Kontroller status');await settle();assert.equal(s.navigation.length,1)
})
test('post-success refresh failure cannot repeat creation',async()=>{
  let refresh=0
  const s=setup({refreshCustomer:async()=>++refresh>1})
  await s.ready();s.click('Opprett kunde');await settle();assert.match(text(s.ui.element),/Kunden er opprettet, men/)
  s.click('Hent kundedata på nytt');await settle();assert.equal(s.calls.length,1);assert.equal(refresh,2);assert.equal(s.navigation.length,1)
})
test('stale/unmounted async result never navigates or refreshes',async()=>{
  let resolve,captured,refresh=0
  const s=setup({api:{createCompany:a=>{captured=a;return new Promise(r=>{resolve=r})}},refreshCustomer:async()=>{refresh++;return true}})
  await s.ready();s.click('Opprett kunde');s.ui.destroy()
  resolve({attempt:captured,idempotencyKey:captured.idempotencyKey,status:'completed',operationId:id,companyId:id});await settle()
  assert.equal(refresh,0);assert.equal(s.navigation.length,0);assert.equal(s.events.size,0)
})
test('pristine/dirty navigation confirmation, unload scoped and cleaned',()=>{
  const s=setup();assert.equal(s.ui.canLeave(),true)
  s.input('nc-company.name','dirty');assert.equal(s.ui.canLeave(),false)
  s.window.confirm=()=>true;assert.equal(s.ui.canLeave(),true)
  let prevented=false;s.events.get('beforeunload')({preventDefault(){prevented=true}});assert.equal(prevented,true)
  s.ui.destroy();assert.equal(s.events.size,0)
})
test('customer integration refreshes real loader, no fake injected company',async()=>{
  const s=setup();s.ui.destroy();let loads=0
  const customers=mountCustomers({document:s.document,window:s.window,load:async()=>{loads++;return {customers:[],orphans:[]}},newCustomerApi:{}})
  customers.route('#customers/new');assert.equal(loads,0);assert.equal(customers.canCreate,true)
  customers.leave('#customers');customers.route('#customers');await settle();assert.equal(loads,1)
  assert.ok(all(customers.element).some(n=>n.textContent==='+ Ny kunde'&&!n.disabled))
})
test('UI is presentation only; guard, correlation and approved modules remain',()=>{
  const source=readFileSync(new URL('../../js/admin-new-customer.mjs',import.meta.url),'utf8')
  assert.doesNotMatch(source,/innerHTML|outerHTML|insertAdjacentHTML|srcdoc|document\.write|new Function|\beval\(|localStorage|sessionStorage|\.from\(|\.rpc\(|\.auth\.|randomUUID|console\./)
  assert.match(source,/model.prepareSubmission/);assert.match(source,/resultMatchesAttempt/)
  const admin=readFileSync(new URL('../../js/admin.js',import.meta.url),'utf8')
  assert.ok(admin.indexOf('await requireAal2({platformAdmin:true})')<admin.indexOf('const customers = mountCustomers'))
})
for (const status of ['not_found','pending','malformed','request_failed']) test(`status ${status} remains unresolved without another create`,async()=>{
  let creates=0
  const s=setup({api:{createCompany:async a=>{creates++;return {attempt:a,idempotencyKey:a.idempotencyKey,status:'uncertain',errorCode:'OPERATION_FAILED'}},getCreationStatus:async a=>({attempt:a,idempotencyKey:a.idempotencyKey,status})}})
  await s.ready();s.click('Opprett kunde');await settle();s.click('Kontroller status');await settle()
  assert.equal(s.ui.element.dataset.status,'uncertain');assert.equal(creates,1);assert.equal(s.ui.canLeave(),false)
})
for (const errorCode of ['UNAUTHENTICATED','MFA_REQUIRED','NOT_AUTHORIZED','PROFILE_INACTIVE']) test(`uncertain retry ${errorCode} never unlocks editing or loses snapshot`,async()=>{
  const attempts=[]
  const s=setup({api:{createCompany:async a=>{
    attempts.push(a)
    return {attempt:a,idempotencyKey:a.idempotencyKey,status:attempts.length===1?'uncertain':'failed',
      errorCode:attempts.length===1?'OPERATION_FAILED':errorCode,debug:'RAW_AUTH_SECRET'}
  }}})
  await s.ready();s.click('Opprett kunde');await settle()
  s.click('Prøv samme forespørsel igjen');await settle()
  assert.equal(attempts.length,2)
  assert.equal(attempts[0].payload,attempts[1].payload)
  assert.equal(attempts[0].idempotencyKey,attempts[1].idempotencyKey)
  assert.equal(s.ui.element.dataset.status,'uncertain')
  assert.match(text(s.ui.element),/fortsatt uavklart/)
  assert.match(text(s.ui.element),/bare ligger i minnet/)
  assert.match(text(s.ui.element),/administrativ hjelp/)
  assert.doesNotMatch(text(s.ui.element),/RAW_AUTH_SECRET|Opprettelsen ble avvist/)
  for(const label of ['Rediger opplysninger','Avbryt','Opprett kunde','Prøv samme forespørsel igjen'])
    assert.ok(!all(s.ui.element).some(n=>n.tag==='button'&&n.textContent===label))
  assert.equal(s.ui.canLeave(),false)
  let prevented=false;s.events.get('beforeunload')({preventDefault(){prevented=true}});assert.ok(prevented)
  s.click('Kontroller status');await settle()
  assert.equal(s.ui.element.dataset.status,'uncertain');assert.equal(attempts.length,2)
  assert.match(text(s.ui.element),/må bekreftes på nytt/)
})
test('confirmed failed status permits editing; safe error text only',async()=>{
  const s=setup({api:{createCompany:async a=>({attempt:a,idempotencyKey:a.idempotencyKey,status:'uncertain',errorCode:'OPERATION_FAILED'}),getCreationStatus:async a=>({attempt:a,idempotencyKey:a.idempotencyKey,status:'failed',errorCode:'ORGANIZATION_NUMBER_EXISTS',operationId:id,debug:'DO_NOT_LEAK'})}})
  await s.ready();s.click('Opprett kunde');await settle();s.click('Kontroller status');await settle()
  assert.match(text(s.ui.element),/Organisasjonsnummeret er allerede registrert/);assert.doesNotMatch(text(s.ui.element),/DO_NOT_LEAK/)
  s.click('Rediger opplysninger');assert.equal(s.ui.element.dataset.status,'editing')
})
test('wrong live attempt reference is ignored, not applied to active create',async()=>{
  const s=setup({api:{createCompany:async a=>({attempt:{...a},idempotencyKey:a.idempotencyKey,status:'completed',operationId:id,companyId:id})}})
  await s.ready();s.click('Opprett kunde');await settle();assert.equal(s.ui.element.dataset.status,'submitting');assert.equal(s.navigation.length,0)
})
