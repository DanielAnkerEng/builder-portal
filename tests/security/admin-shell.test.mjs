import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ADMIN_NAVIGATION, resolveAdminPage, createAdminState, containAdminFocus } from '../../js/admin-shell.mjs'

test('locked navigation groups and 12 unique safe routes', () => {
  assert.deepEqual(ADMIN_NAVIGATION.map(g => g.label), ['OVERSIKT','KUNDER','ARBEID','TJENESTER','RESULTATER','SYSTEM'])
  const pages = ADMIN_NAVIGATION.flatMap(g => g.items)
  assert.equal(pages.length, 12)
  assert.equal(new Set(pages.map(p => p.id)).size, 12)
  for (const page of pages) {
    assert.match(page.id, /^[a-z]+$/)
    assert.match(page.futurePath, /^\/admin(?:\/[a-z]+)?$/)
    assert.equal(resolveAdminPage(`#${page.id}`), page)
    assert(Object.isFrozen(page))
  }
})
test('unknown navigation cannot select arbitrary content or URLs', () => {
  for (const hash of ['', '#constructor', '#__proto__', '#javascript:alert(1)', '#customers/company', '#adminMain']) {
    assert.equal(resolveAdminPage(hash).id, 'dashboard')
  }
})
test('state primitive uses text nodes for untrusted labels', () => {
  const document = { createElement: tag => ({ tag, children: [], attrs: {}, setAttribute(k,v) { this.attrs[k]=v }, append(...nodes) { this.children.push(...nodes) } }) }
  const state = createAdminState(document, {kind:'error',title:'<img onerror=alert(1)>',description:'Try again'})
  assert.equal(state.attrs.role, 'alert')
  assert.equal(state.children[1].textContent, '<img onerror=alert(1)>')
})
test('drawer traps Tab at both boundaries', () => {
  let focused, prevented = 0
  const nodes = [0,1].map(id => ({getClientRects:()=>[{}], focus:()=>{focused=id}}))
  const container = {querySelectorAll:()=>nodes,ownerDocument:{activeElement:nodes[1]},contains:()=>true}
  containAdminFocus({key:'Tab',shiftKey:false,preventDefault(){prevented++}},container)
  assert.equal(focused,0)
  container.ownerDocument.activeElement=nodes[0]
  containAdminFocus({key:'Tab',shiftKey:true,preventDefault(){prevented++}},container)
  assert.equal(focused,1);assert.equal(prevented,2)
})
test('shell has no data/auth/storage or executable sinks', () => {
  const source = readFileSync(new URL('../../js/admin-shell.mjs',import.meta.url),'utf8')
  assert.doesNotMatch(source,/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function|srcdoc|localStorage|sessionStorage|supabase|fetch\s*\(/)
  assert.match(source,/aria-current/);assert.match(source,/aria-expanded/)
  assert.match(source,/button.disabled = true/)
})
test('admin guard precedes shell and existing trusted paths remain', () => {
  const source = readFileSync(new URL('../../js/admin.js',import.meta.url),'utf8')
  assert(source.indexOf('await requireAal2({platformAdmin:true})') < source.indexOf('const shell = mountAdminShell'))
  assert.match(source,/shell.logout.addEventListener\('click',signOut\)/)
  assert.match(source,/from\('websites'\)/)
  assert.match(source,/functions.invoke\('admin-provision-company'/)
  assert.match(source,/builder.html\?website=/)
  assert.doesNotMatch(source,/innerHTML|outerHTML|insertAdjacentHTML|srcdoc|new Function/)
})
