import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {Script,createContext} from 'node:vm'

const source=readFileSync(new URL('../../js/onboarding.js',import.meta.url),'utf8')
// Execute the actual page controller with import/DOM boundaries substituted only
// in this test. No product test hook, Auth identity, callback or secret is used.
const executable=source.replace(/^import .* from '\.\/customer-onboarding\.mjs'$/m,
  'const {readOnboardingState,establishPassword,acceptInvitation}=helpers')
  .replaceAll("import('./supabase.js')","load('sdk')").replaceAll("import('./auth.js')","load('auth')")
const flush=()=>new Promise(resolve=>setImmediate(resolve))
function page(mode='success',sessionReady) {
  const calls=[],nodes=new Map()
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{hidden:true,disabled:false,value:'',textContent:'',listeners:{},
      classList:{add(){},remove(){}},addEventListener(type,fn){this.listeners[type]=fn}})
    return nodes.get(id)
  }
  const location={pathname:'/onboarding.html',search:'?harmless_query_marker=1',hash:'#harmless_fragment_marker=1',replace:target=>calls.push('navigate:'+target)}
  const document={getElementById:node,querySelectorAll:()=>[node('onboardingAccept'),node('onboardingRefresh'),node('onboardingLogout')]}
  const context=createContext({document,location,URLSearchParams,
    history:{replaceState(a,b,path){assert.equal(path,'/onboarding.html');calls.push('clean');location.search='';location.hash=''}},
    window:{addEventListener(){}},
    load:async type=>{
      calls.push('import:'+type)
      if(mode===type+'-import-failure')throw new Error('synthetic internal detail must not be displayed')
      if(type==='auth')return {signOut:async()=>calls.push('signOut')}
      return {supabase:{auth:{getSession:async()=>{
        calls.push('initialize')
        assert.notEqual(location.search,'');assert.notEqual(location.hash,'')
        if(sessionReady)await sessionReady
        if(mode==='initialization-throw')throw new Error('synthetic internal detail')
        return {data:{session:mode==='no-session'?null:{}},error:mode==='initialization-error'?{}:null}
      }}}}
    },
    helpers:{readOnboardingState:async()=>{
      calls.push('read-state');assert.equal(location.search,'');assert.equal(location.hash,'')
      if(mode==='no-session')throw new Error('LOGIN_REQUIRED')
      return {stage:'ready'}
    },establishPassword:async()=>calls.push('password-write'),acceptInvitation:async()=>calls.push('activate')}
  })
  return {calls,node,location,start:()=>new Script('(async()=>{'+executable+'})()').runInContext(context)}
}
for(const mode of ['sdk-import-failure','auth-import-failure','initialization-throw','initialization-error']) {
  test('onboarding '+mode+': URL cleaned, useful error, no actions or raw details',async()=>{
    const p=page(mode);await p.start()
    assert.equal(p.location.search,'');assert.equal(p.location.hash,'')
    assert.equal(p.calls.filter(c=>c==='clean').length,1)
    assert.match(p.node('onboardingError').textContent,/Innloggingstjenesten kunne ikke/)
    assert.doesNotMatch(p.node('onboardingError').textContent,/synthetic internal detail/)
    for(const id of ['onboardingPasswordForm','onboardingMfa','onboardingAccept','onboardingWorkspace'])assert.equal(p.node(id).hidden,true)
    assert.equal(p.node('onboardingRefresh').disabled,true)
    // Even synthetic events on hidden/disabled elements cannot continue.
    p.node('onboardingRefresh').listeners.click()
    p.node('onboardingAccept').listeners.click()
    p.node('onboardingPasswordForm').listeners.submit({preventDefault(){}})
    await flush()
    assert.ok(!p.calls.some(c=>['read-state','password-write','activate'].includes(c)))
  })
}
test('normal callback completes before cleanup and state/actions remain usable',async()=>{
  let complete;const waiting=new Promise(resolve=>complete=resolve),p=page('success',waiting)
  const loaded=p.start();await flush()
  assert.ok(p.calls.includes('initialize'));assert.ok(!p.calls.includes('clean'))
  assert.notEqual(p.location.search,'');assert.notEqual(p.location.hash,'')
  complete();await loaded
  assert.deepEqual(p.calls,['import:sdk','initialize','import:auth','clean','read-state'])
  assert.equal(p.node('onboardingAccept').hidden,false)
  p.node('onboardingAccept').listeners.click();await flush()
  assert.equal(p.calls.filter(c=>c==='activate').length,1)
  p.node('onboardingLogout').listeners.click();await flush()
  assert.equal(p.calls.at(-1),'signOut')
})
test('no session shows login requirement and never exposes activation',async()=>{
  const p=page('no-session');await p.start()
  assert.equal(p.node('onboardingAccept').hidden,true)
  assert.match(p.node('onboardingError').textContent,/logg inn på nytt/)
  assert.ok(!p.calls.includes('activate'));assert.equal(p.location.search,'');assert.equal(p.location.hash,'')
})
test('SDK load failure back link does not pretend to sign out an unavailable client',async()=>{
  const p=page('sdk-import-failure');await p.start()
  assert.equal(p.node('onboardingLogout').textContent,'Tilbake til innlogging')
  p.node('onboardingLogout').listeners.click()
  assert.equal(p.calls.at(-1),'navigate:login.html');assert.ok(!p.calls.includes('signOut'))
})
test('controller has no credential persistence, logging or executable HTML sinks',()=>{
  assert.doesNotMatch(source,/localStorage|sessionStorage|console\.|innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function|srcdoc/)
})
