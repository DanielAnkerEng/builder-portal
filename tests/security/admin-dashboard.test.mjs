import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { websiteState, createKpi, createProjectRow, mountDashboard, loadDashboardWebsites, DASHBOARD_STATES } from '../../js/admin-dashboard.mjs'

function documentStub() {
  return { createElement: tag => ({ tag, children: [], dataset: {}, attrs: {}, textContent: '',
    append(...nodes) { this.children.push(...nodes) }, replaceChildren(...nodes) { this.children = nodes },
    setAttribute(key, value) { this.attrs[key] = value } }) }
}
const flatten = node => [node, ...node.children.flatMap(flatten)]
const text = node => flatten(node).map(n => n.textContent).join(' ')
const site = { id: 'site/1', name: '<img src=x onerror=alert(1)>', companies: { name: '<script>bad()</script>' }, public_slug: 'test&slug', current_publication_id: null }

test('six explicit dashboard states; unavailable is not an empty dataset', () => {
  assert.deepEqual(DASHBOARD_STATES, ['loading','real','empty','unavailable','error','demo'])
  assert.deepEqual(websiteState('unavailable'), { state:'unavailable', rows:[], value:null })
  assert.equal(websiteState('real', []).state,'empty')
  assert.equal(websiteState('real', []).value,0)
  assert.equal(websiteState('real', [site, {...site,id:'2'}]).value,2)
})
test('malformed or missing rows and unknown state fail to error, never real zero', () => {
  for (const [state, rows] of [['real',undefined],['real',[null]],['real',[{}]],['constructor',[]]]) {
    assert.equal(websiteState(state,rows).state,'error')
    assert.equal(websiteState(state,rows).value,null)
  }
})
test('KPI distinguishes zero, loading, unavailable and error without invented trends', () => {
  const doc = documentStub()
  assert.match(text(createKpi(doc,{label:'Nettsider',state:'empty',value:0})),/0/)
  for (const state of ['unavailable','error','constructor']) {
    const card = createKpi(doc,{label:'Nye leads',state,value:0})
    assert.match(text(card),/—/); assert.doesNotMatch(text(card),/\b0\b/)
  }
  assert.match(text(createKpi(doc,{label:'Nettsider',state:'loading'})),/Laster/)
})
test('all unconnected business KPIs remain unavailable even with website data', () => {
  const doc = documentStub(), host = doc.createElement('div')
  const dashboard = mountDashboard({document:doc,host})
  dashboard.update('real',[site])
  const cards = host.children[0].children
  assert.deepEqual(cards.map(c => c.dataset.state),['unavailable','real','unavailable','unavailable'])
  assert.match(text(cards[1]),/Nettsider 1 I hentet prosjektoversikt/)
  assert.doesNotMatch(text(host),/DEMO DATA/)
})
test('project/company names are text and Builder ID is encoded', () => {
  const row = createProjectRow(documentStub(),site)
  assert.equal(row.children[0].children[0].textContent,site.name)
  assert.equal(row.children[0].children[1].textContent,site.companies.name)
  assert.equal(flatten(row).find(n => n.tag === 'a').href,'builder.html?website=site%2F1')
  assert.equal(flatten(row).some(n => n.tag === 'script' || n.tag === 'img'),false)
})
test('live action requires publication and slug; published URL is encoded and isolated', () => {
  const doc = documentStub()
  assert.equal(flatten(createProjectRow(doc,site)).filter(n => n.tag === 'a').length,1)
  assert.equal(flatten(createProjectRow(doc,{...site,current_publication_id:'pub',public_slug:null})).filter(n => n.tag === 'a').length,1)
  const live = flatten(createProjectRow(doc,{...site,current_publication_id:'pub'})).find(n => n.target === '_blank')
  assert.equal(live.href,'site.html?slug=test%26slug'); assert.equal(live.rel,'noopener noreferrer')
})
test('real empty projects and demo projects are explicitly labelled', () => {
  const doc = documentStub(), host = doc.createElement('div'), dashboard = mountDashboard({document:doc,host})
  dashboard.update('real',[]); assert.match(text(host),/Ingen nettsideprosjekter ennå/)
  dashboard.update('demo',[site]); assert.match(text(host),/DEMO DATA/)
})
test('query success, returned errors, null data and thrown network errors are handled safely', async () => {
  for (const [query, expected] of [
    [async()=>({data:[],error:null}),'real'],
    [async()=>({data:null,error:null}),'error'],
    [async()=>({error:{message:'PRIVATE'}}),'error'],
    [async()=>{throw new Error('PRIVATE')},'error'],
  ]) {
    const calls=[]; await loadDashboardWebsites({update:(...args)=>calls.push(args)},query)
    assert.equal(calls[0][0],'loading'); assert.equal(calls[1][0],expected)
    assert.doesNotMatch(JSON.stringify(calls),/PRIVATE/)
  }
})
test('error stays visible without removing the other dashboard sections', () => {
  const doc = documentStub(), host = doc.createElement('div'), dashboard = mountDashboard({document:doc,host})
  dashboard.update('error')
  assert.match(text(host),/Kunne ikke hente kontooversikten/)
  assert.match(text(host),/Mine oppgaver/); assert.match(text(host),/Siste aktivitet/)
  assert(flatten(host).some(n=>n.attrs.role==='alert'))
})
test('guard precedes dashboard; unchanged safe query; no new auth or executable sinks', () => {
  const admin = readFileSync(new URL('../../js/admin.js',import.meta.url),'utf8')
  const source = readFileSync(new URL('../../js/admin-dashboard.mjs',import.meta.url),'utf8')
  assert(admin.indexOf('await requireAal2({platformAdmin:true})') < admin.indexOf('const dashboard = mountDashboard'))
  assert.match(admin,/select\('id,name,public_slug,status,current_publication_id,companies\(name\)'\)/)
  assert.doesNotMatch(source,/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function|srcdoc|localStorage|sessionStorage|console\.|supabase|fetch\s*\(/)
})
