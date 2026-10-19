import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'

const source=readFileSync(new URL('../../js/builder.js',import.meta.url),'utf8')
const bootstrap=source.slice(0,source.indexOf('\nconst loaded=')).replace(/^import .*$/gm,'')
function harness({guardError=false,search=''}={}) {
  const calls=[],nodes=[],body={children:[],replaceChildren(...children){calls.push('render');this.children=children}}
  let signOutCalls=0
  const signOut=async()=>{signOutCalls++}
  const context={
    document:{body,createElement(tag){const node={tag,children:[],events:{},append(...children){this.children.push(...children)},addEventListener(type,handler){this.events[type]=handler}};nodes.push(node);return node}},
    requireAal2:async()=>{calls.push('aal2');if(guardError)throw Error('guard denied');return {}},
    supabase:{from(table){assert.equal(table,'websites');calls.push('websites');return {select(fields){assert.equal(fields,'id');return this},limit(n){assert.equal(n,1);return this},async maybeSingle(){return {data:null,error:null}}}}},
    location:{search},URLSearchParams,signOut
  }
  return {calls,nodes,body,signOut,signOutCalls:()=>signOutCalls,run:()=>vm.runInNewContext('(async()=>{'+bootstrap+'})()',context)}
}
test('real Builder bootstrap renders accessible empty state only after AAL2 guard and website lookup',async()=>{
  const h=harness()
  await assert.rejects(h.run(),/No authorized website/)
  assert.deepEqual(h.calls,['aal2','websites','render'])
  const [main]=h.body.children
  assert.equal(main.tag,'main');assert.equal(main.className,'missing')
  assert.equal(main.children[0].tag,'h1')
  assert.equal(main.children[0].textContent,'Ingen nettside er knyttet til kontoen.')
  const button=main.children[1]
  assert.equal(button.tag,'button');assert.equal(button.type,'button')
  assert.equal(button.textContent,'Logg ut')
  assert.equal(button.events.click,h.signOut)
})
test('empty-state logout invokes the existing signOut exactly once per click, never during render',async()=>{
  const h=harness();await assert.rejects(h.run(),/No authorized website/)
  assert.equal(h.signOutCalls(),0)
  await h.body.children[0].children[1].events.click()
  assert.equal(h.signOutCalls(),1)
})
test('denied AAL2 guard cannot render empty UI or reach website lookup',async()=>{
  const h=harness({guardError:true})
  await assert.rejects(h.run(),/guard denied/)
  assert.deepEqual(h.calls,['aal2']);assert.equal(h.nodes.length,0)
  assert.equal(h.signOutCalls(),0)
})
test('existing explicit website path is unaffected by empty-state presentation',async()=>{
  const h=harness({search:'?website=synthetic-test-id'})
  await h.run()
  assert.deepEqual(h.calls,['aal2']);assert.equal(h.nodes.length,0)
})
test('new empty-state block uses safe DOM and the visual fixture cannot sign out',()=>{
  const block=source.match(/if\(!websiteId\)\{\n[\s\S]*?\n\}/)?.[0]
  assert(block)
  assert.doesNotMatch(block,/innerHTML|outerHTML|insertAdjacentHTML|eval\(|fetch\(|supabase|localStorage|sessionStorage/)
  const fixture=readFileSync(new URL('../fixtures/builder-empty.html',import.meta.url),'utf8')
  assert.match(fixture,/DEMO DATA/)
  assert.match(fixture,/<button class="btn btn-primary" type="button" disabled>Logg ut<\/button>/)
  assert.doesNotMatch(fixture,/<script|onclick=/)
})
