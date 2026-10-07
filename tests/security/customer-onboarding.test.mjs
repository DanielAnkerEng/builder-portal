import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getOnboardingStatus, readOnboardingState, establishPassword, acceptInvitation } from '../../js/customer-onboarding.mjs'
import { createCustomerInviteApi, mountCustomerInvite } from '../../js/admin-customer-invite.mjs'
const id='11111111-1111-4111-8111-111111111111'
function client(options={}) {
  const calls=[]; let passwordRequired=options.passwordRequired??false
  return {calls,auth:{ getUser:async()=>({data:{user:options.loggedOut?null:{id:'synthetic',email:'synthetic@test.invalid'}},error:options.authError?{}:null}),
    mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:options.aal??'aal2'},error:options.aalError?{}:null})},
    updateUser:async()=>{calls.push('password');return {error:options.passwordError?{}:null}},
    signInWithPassword:async()=>{calls.push('password-login');if(!options.loginError)passwordRequired=false;return {data:{user:{id:'synthetic'}},error:options.loginError?{}:null}}},
    rpc:async(name,args)=>{calls.push([name,args]);return name==='security_v2_customer_onboarding_status'
      ? {data:{ok:true,status:options.status??'invited',invitationId:id,role:'editor',passwordRequired},error:options.statusError?{}:null}
      : {data:options.activationError?{ok:false}:{ok:true,status:'active',companyId:id}}} }
}
test('onboarding explicitly distinguishes first password, MFA, ready and accepted',async()=>{
  for(const [options,stage] of [[{passwordRequired:true,aal:'aal1'},'password'],[{aal:'aal1'},'mfa'],[{},'ready'],[{status:'accepted'},'active']])
    assert.equal((await readOnboardingState(client(options))).stage,stage)
})
for(const options of [{loggedOut:true},{authError:true},{statusError:true},{aalError:true},{status:'revoked'},{status:'none'}])
  test('unavailable identity/invitation fails closed '+JSON.stringify(options),async()=>await assert.rejects(readOnboardingState(client(options))))
test('password mismatch rejected before Auth mutation',async()=>{const c=client({passwordRequired:true});await assert.rejects(establishPassword(c,'synthetic-password-A','synthetic-password-B'));assert.deepEqual(c.calls,[])})
test('first password uses existing Supabase updateUser; Auth error not leaked',async()=>{
  const c=client({passwordRequired:true,aal:'aal1'});assert.equal((await establishPassword(c,'synthetic-password-only','synthetic-password-only')).stage,'mfa')
  assert.equal(c.calls.filter(x=>x==='password').length,1)
  assert.equal(c.calls.filter(x=>x==='password-login').length,1)
  await assert.rejects(establishPassword(client({passwordRequired:true,passwordError:true}),'synthetic-password-only','synthetic-password-only'),/PASSWORD_REJECTED/)
})
test('Auth password update alone does not prove password login',async()=>{
  await assert.rejects(establishPassword(client({passwordRequired:true,loginError:true}),'synthetic-password-only','synthetic-password-only'),/PASSWORD_LOGIN_REQUIRED/)
})
for(const options of [{aal:'aal1'},{passwordRequired:true}]) test('AAL1 or missing password never calls activation',async()=>{
  const c=client(options);await assert.rejects(acceptInvitation(c));assert.ok(!c.calls.some(x=>x[0]==='security_v2_accept_customer_invitation'))
})
test('activation uses only server-returned invitation ID and no role/company/user input',async()=>{
  const c=client();assert.deepEqual(await acceptInvitation(c),{companyId:id,destination:'builder.html'})
  assert.deepEqual(c.calls.at(-1),['security_v2_accept_customer_invitation',{p_invitation:id}])
})
test('activation errors keep customer outside normal workspace',async()=>await assert.rejects(acceptInvitation(client({activationError:true})),/ACTIVATION_UNCONFIRMED/))
test('status validation rejects malformed server shape',async()=>await assert.rejects(getOnboardingStatus({rpc:async()=>({data:{ok:true,status:'invited',invitationId:'constructor'}})})))
test('admin adapter preserves exact request after uncertain outcome; no auto retry',async()=>{
  const calls=[]
  const api=createCustomerInviteApi({functions:{invoke:async(name,request)=>{
    calls.push([name,request]);return calls.length===1?{error:{}}:{data:{ok:true,status:'invited',invitationId:id}}
  }}},()=>id)
  const input={companyId:id,email:'synthetic@test.invalid',displayName:'Synthetic',role:'editor'}
  await assert.rejects(api.invite(input));assert.equal(calls.length,1)
  await assert.rejects(api.invite({...input,role:'owner'}),/KEEP_ORIGINAL/);assert.equal(calls.length,1)
  await api.invite(input);assert.equal(calls.length,2);assert.equal(calls[0][1].body,calls[1][1].body);assert.equal(calls[0][1].headers['Idempotency-Key'],calls[1][1].headers['Idempotency-Key'])
})
test('admin UI requires explicit role, renders text only, blocks double submission',async()=>{
  const nodes=[];const document={createElement:tag=>{const n={tag,children:[],events:{},attrs:{},value:'',append(...xs){this.children.push(...xs)},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,v){this.events[k]=v}};nodes.push(n);return n}}
  let calls=0,resolve;mountCustomerInvite({document,companyId:id,createApi:()=>({invite:()=>{calls++;return new Promise(r=>resolve=r)}})})
  const form=nodes.find(n=>n.tag==='form'),inputs=nodes.filter(n=>n.tag==='input'),role=nodes.find(n=>n.tag==='select')
  inputs[0].value='synthetic@test.invalid';inputs[1].value='<script>synthetic</script>'
  await form.events.submit({preventDefault(){}});assert.equal(calls,0)
  role.value='editor';const pending=form.events.submit({preventDefault(){}});await form.events.submit({preventDefault(){}});assert.equal(calls,1)
  resolve({invitationId:id,status:'invited'});await pending;assert.ok(inputs.every(n=>n.disabled));assert.equal(nodes.filter(n=>n.tag==='script').length,0)
})
test('onboarding modules have no executable sinks, browser storage or sensitive logging',()=>{
  for(const path of ['js/customer-onboarding.mjs','js/onboarding.js','js/admin-customer-invite.mjs']) {
    const source=readFileSync(new URL('../../'+path,import.meta.url),'utf8')
    assert.doesNotMatch(source,/innerHTML|outerHTML|insertAdjacentHTML|document\.write|new Function|\beval\s*\(|localStorage|sessionStorage|console\./)
  }
  const page=readFileSync(new URL('../../js/onboarding.js',import.meta.url),'utf8')
  assert.match(page,/history\.replaceState/);assert.match(page,/pagehide/)
})
test('operator recovery sends only company/invitation/action and preserves key after response loss',async()=>{
  const calls=[];const api=createCustomerInviteApi({functions:{invoke:async(name,request)=>{
    calls.push([name,request]);return calls.length===1?{error:{}}:{data:{ok:true,invitationId:id,status:'invited',delivery:'sent'}}
  }}},()=>id)
  await assert.rejects(api.recover(id,id));await api.recover(id,id)
  assert.equal(calls[0][1].headers['Idempotency-Key'],calls[1][1].headers['Idempotency-Key'])
  assert.deepEqual(calls[1][1].body,{companyId:id,invitationId:id,action:'recover'})
})
test('operator safe throttling message never contains raw backend details',async()=>{
  const api=createCustomerInviteApi({functions:{invoke:async()=>({error:{context:new Response(JSON.stringify({error:{code:'RESEND_THROTTLED',secret:'synthetic-not-a-secret'}}))}})}})
  await assert.rejects(api.recover(id,id),/^Error: RESEND_THROTTLED$/)
})
test('operator list is company-scoped and malformed data fails closed',async()=>{
  let args;const api=createCustomerInviteApi({rpc:async(name,input)=>{args=[name,input];return {data:{ok:true,invitations:[]}}}})
  assert.deepEqual(await api.list(id),[]);assert.deepEqual(args,['security_v2_list_customer_invitations',{p_company:id}])
  await assert.rejects(createCustomerInviteApi({rpc:async()=>({data:{ok:true,invitations:[{role:'owner'}]}})}).list(id))
})
