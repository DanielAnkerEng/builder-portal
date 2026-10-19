import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const source=readFileSync(new URL('../../js/login.js',import.meta.url),'utf8')
function harness(response=async()=>({error:null}), options={}) {
  const ids=['loginForm','authError','email','password','remember','forgotLink','submitButton']
  const els=Object.fromEntries(ids.map(id=>{
    const classes=new Set(), attrs={}, events={}
    return [id,{value:'',textContent:'',checked:false,disabled:false,classes,attrs,events,
      classList:{add:(...xs)=>xs.forEach(x=>classes.add(x)),remove:(...xs)=>xs.forEach(x=>classes.delete(x)),toggle:(x,on)=>on?classes.add(x):classes.delete(x)},
      setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k],
      addEventListener:(k,v)=>events[k]=v,
      checkValidity:()=>els.email.valid!==false}]
  }))
  els.email.value='synthetic@example.invalid'
  els.loginForm.querySelector=()=>els.submitButton
  const calls=[],authCalls=[],destinations=[]
  vm.runInNewContext(source.replace(/^import .*$/gm,''),{
    document:{getElementById:id=>els[id]},prepareAuthSignIn:async remember=>{authCalls.push(['prepare',remember]);return options.prepare?.()},
    classifyAssurance:data=>data?.currentLevel==='aal2'?'authenticated':'challenge',
    resolvePostAuthDestination:async()=>{authCalls.push(['destination']);return options.destination?.()??'builder.html'},
    location:{replace:target=>destinations.push(target)},
    supabase:{auth:{resetPasswordForEmail:async(...args)=>{calls.push(args);return response()},
      signInWithPassword:async args=>{authCalls.push(['signIn',args]);return options.signIn?.()??{error:{message:'not shown'}}},
      mfa:{getAuthenticatorAssuranceLevel:async()=>{authCalls.push(['assurance']);return options.assurance?.()??{data:{currentLevel:'aal2'},error:null}}}}}
  })
  return {els,calls,authCalls,destinations,click:()=>els.forgotLink.events.click({preventDefault(){}}),
    login:()=>els.loginForm.events.submit({preventDefault(){}})}
}
const visibleSuccess=h=>h.els.authError.classes.has('show')&&h.els.authError.classes.has('is-success')
test('empty email is visible error and makes no recovery call',async()=>{
 const h=harness();h.els.email.value=' ';await h.click()
 assert.equal(h.calls.length,0);assert.match(h.els.authError.textContent,/først/)
 assert.equal(h.els.authError.attrs.role,'alert');assert(h.els.authError.classes.has('show'))
})
test('invalid email makes no recovery call',async()=>{
 const h=harness();h.els.email.valid=false;await h.click()
 assert.equal(h.calls.length,0);assert.match(h.els.authError.textContent,/gyldig/)
})
test('successful response displays neutral, accessible confirmation; Auth call has unchanged arguments',async()=>{
 const h=harness();await h.click()
 assert(visibleSuccess(h));assert.equal(h.els.authError.attrs.role,'status')
 assert.equal(h.els.authError.attrs['aria-live'],'polite')
 assert.match(h.els.authError.textContent,/Hvis kontoen finnes/)
 assert.deepEqual(h.calls,[['synthetic@example.invalid']])
})
for(const [label,response] of [
 ['API error',async()=>({error:{message:'INTERNAL_SENTINEL'}})],
 ['network rejection',async()=>{throw Error('INTERNAL_SENTINEL')}],
 ['missing response',async()=>undefined]
]) test(label+' is a safe visible error, not success',async()=>{
 const h=harness(response);await h.click()
 assert(!visibleSuccess(h));assert(h.els.authError.classes.has('show'))
 assert.equal(h.els.authError.attrs.role,'alert')
 assert.match(h.els.authError.textContent,/kunne ikke behandles/)
 assert.doesNotMatch(h.els.authError.textContent,/INTERNAL_SENTINEL/)
 assert.equal(h.els.forgotLink.attrs['aria-disabled'],undefined)
})
test('new request clears old confirmation while pending and blocks duplicate requests',async()=>{
 let resolve, n=0
 const h=harness(()=>++n===1?{error:null}:new Promise(r=>resolve=r))
 await h.click();assert(visibleSuccess(h))
 const pending=h.click()
 assert.equal(h.els.authError.textContent,'Behandler forespørselen …');assert.equal(h.els.authError.classes.has('show'),true)
 assert.equal(h.els.authError.classes.has('is-success'),false)
 await h.click();assert.equal(h.calls.length,2)
 resolve({error:{message:'not shown'}});await pending
 assert(!visibleSuccess(h))
})
test('new invalid action removes previous success styling',async()=>{
 const h=harness();await h.click();h.els.email.value='';await h.click()
 assert(!visibleSuccess(h));assert.equal(h.els.authError.attrs.role,'alert')
})
test('pending recovery blocks sign-in and duplicates without clearing its live progress',async()=>{
 let resolve
 const h=harness(()=>new Promise(r=>resolve=r));const pending=h.click()
 await h.login();await h.click()
 assert.equal(h.authCalls.length,0);assert.equal(h.calls.length,1)
 assert.equal(h.els.authError.textContent,'Behandler forespørselen …')
 assert.equal(h.els.loginForm.attrs['aria-busy'],'true');assert(h.els.submitButton.disabled)
 resolve({error:null});await pending
 assert(visibleSuccess(h));assert.equal(h.els.loginForm.attrs['aria-busy'],'false');assert(!h.els.submitButton.disabled)
})
test('pending sign-in blocks recovery and double submit; successful session still reaches destination',async()=>{
 let resolve
 const h=harness(undefined,{signIn:()=>new Promise(r=>resolve=r)})
 const pending=h.login();await Promise.resolve();await Promise.resolve()
 await h.click();await h.login()
 assert.equal(h.calls.length,0);assert.equal(h.authCalls.filter(c=>c[0]==='signIn').length,1)
 assert.equal(h.els.authError.textContent,'Logger inn …');assert.equal(h.els.authError.attrs.role,'status')
 assert.equal(h.els.forgotLink.attrs['aria-disabled'],'true')
 resolve({error:null});await pending
 assert.deepEqual(h.destinations,['builder.html'])
 assert.deepEqual(h.authCalls.map(c=>c[0]),['prepare','signIn','assurance','destination'])
 assert(h.els.submitButton.disabled,'no second request during navigation')
})
for(const destination of ['admin.html','builder.html']) test('AAL2 uses existing destination resolver: '+destination,async()=>{
 const h=harness(undefined,{signIn:async()=>({error:null}),destination:()=>destination});h.els.remember.checked=true
 await h.login()
 assert.deepEqual(h.destinations,[destination]);assert.deepEqual(h.authCalls.map(c=>c[0]),['prepare','signIn','assurance','destination'])
 assert.deepEqual(h.authCalls[0],['prepare',true])
 assert.equal(h.authCalls[1][1].email,'synthetic@example.invalid');assert.equal(h.authCalls[1][1].password,'')
})
test('AAL1 retains MFA redirect and does not resolve privileged destination',async()=>{
 const h=harness(undefined,{signIn:async()=>({error:null}),assurance:()=>({data:{currentLevel:'aal1'},error:null})})
 await h.login();assert.deepEqual(h.destinations,['mfa.html'])
 assert.deepEqual(h.authCalls.map(c=>c[0]),['prepare','signIn','assurance'])
})
for(const [name,options,message] of [
 ['prepare failure',{prepare:()=>{throw Error('INTERNAL_SENTINEL')}},/lagring/],
 ['sign-in API error',{},/Feil e-post/],
 ['sign-in network error',{signIn:()=>{throw Error('INTERNAL_SENTINEL')}},/forbindelsen/],
 ['assurance API error',{signIn:()=>({error:null}),assurance:()=>({error:{message:'INTERNAL_SENTINEL'}})},/Sikkerhetsnivået/],
 ['assurance network error',{signIn:()=>({error:null}),assurance:()=>{throw Error('INTERNAL_SENTINEL')}},/Sikkerhetsnivået/],
 ['destination error',{signIn:()=>({error:null}),destination:()=>{throw Error('INTERNAL_SENTINEL')}},/Tilgangen/]
]) test(name+' unlocks controls, shows safe feedback and permits another action',async()=>{
 const h=harness(undefined,options);await h.login()
 assert.match(h.els.authError.textContent,message);assert.doesNotMatch(h.els.authError.textContent,/INTERNAL_SENTINEL/)
 assert.equal(h.els.authError.attrs.role,'alert');assert(!visibleSuccess(h));assert(!h.els.submitButton.disabled)
 assert.equal(h.els.loginForm.attrs['aria-busy'],'false');assert.equal(h.els.forgotLink.attrs['aria-disabled'],undefined)
 assert.equal(h.destinations.length,0)
 await h.login();assert.equal(h.authCalls.filter(c=>c[0]==='prepare').length,2)
 await h.click();assert.equal(h.calls.length,1);assert(visibleSuccess(h))
})
for(const response of [()=>({error:{}}),()=>{throw Error('INTERNAL_SENTINEL')}]) test('recovery failure unlocks sign-in and permits retry',async()=>{
 const h=harness(response);await h.click();assert(!h.els.submitButton.disabled)
 await h.click();assert.equal(h.calls.length,2)
 await h.login();assert.equal(h.authCalls.filter(c=>c[0]==='signIn').length,1)
})
test('browser fixture runs actual login module but maps Auth to controlled local responses',()=>{
 const html=readFileSync(new URL('../fixtures/login-feedback.html',import.meta.url),'utf8')
 const mock=readFileSync(new URL('../fixtures/login-responses-fixture.mjs',import.meta.url),'utf8')
 assert.match(html,/DEMO DATA/)
 assert.match(html,/"\/js\/supabase.js": "\.\/login-responses-fixture.mjs"/)
 assert.match(html,/src="..\/..\/js\/login.js\?v=security2"/)
 assert.doesNotMatch(mock,/fetch\(|https?:|localStorage|sessionStorage|createClient/)
 assert.doesNotMatch(source,/console\.|innerHTML|outerHTML|insertAdjacentHTML/)
})
