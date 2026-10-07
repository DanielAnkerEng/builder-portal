import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
const id='11111111-1111-4111-8111-111111111111'
const root=new URL('../../',import.meta.url)
const source=readFileSync(new URL('supabase/functions/create-customer/index.ts',root),'utf8')
const transport='data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(readFileSync(new URL('supabase/functions/_shared/new-customer.ts',root),'utf8'))).toString('base64')
const valid=()=>({companyId:id,email:'synthetic@test.invalid',displayName:'Synthetic',role:'editor'})
let sequence=0
async function run(options={},request={}) {
  const calls=[];let handler
  globalThis.__onboardingAuth=async(req,policy)=>{
    calls.push(['auth',policy]);if(options.denied)throw new Response('',{status:options.denied})
    return {userClient:{rpc:async(name,args)=>{calls.push([name,args]);return options.prepareError?{error:{}}:{data:options.plan??{ok:true,send:true,invitationId:id,status:'reserved'}}}},
      adminClient:{auth:{resetPasswordForEmail:async(email,data)=>{calls.push(['recovery-email',email,data]);if(options.throwInvite)throw new Error('sensitive internal data');return {error:options.inviteError?{}:null}},admin:{inviteUserByEmail:async(email,data)=>{calls.push(['invite',email,data]);if(options.throwInvite)throw new Error('sensitive internal data');return {error:options.inviteError?{}:null}}}},rpc:async(name,args)=>{calls.push([name,args]);
        if(name==='security_v2_claim_invitation_delivery')return {data:options.claim??{ok:true,send:true,email:'synthetic@test.invalid',mode:'recovery',originId:id}}
        if(name==='security_v2_finish_invitation_delivery')return {data:{ok:true}}
        return options.finalizeError?{error:{}}:{data:options.finalized??{ok:true,status:'invited'}}}}}
  }
  globalThis.Deno={env:{get:()=>options.serverUrl??'http://kong:8000'},serve:fn=>handler=fn}
  const js=stripTypeScriptTypes(source.replace(/^import \{ requireAal2 \}.*$/m,'const requireAal2 = globalThis.__onboardingAuth').replace("'../_shared/new-customer.ts'",JSON.stringify(transport)))
  await import('data:text/javascript;base64,'+Buffer.from(js+'\n//'+sequence++).toString('base64'));delete globalThis.__onboardingAuth
  const req=new Request('http://127.0.0.1/create-customer',{method:request.method??'POST',headers:{'content-type':'application/json','idempotency-key':id,origin:'http://127.0.0.1:4175',...request.headers},...(request.method==='OPTIONS'?{}:{body:request.raw??JSON.stringify(request.body??valid())})})
  const response=await handler(req);const body=await response.text();return {calls,response,body,data:body?JSON.parse(body):null}
}
test('AAL2 admin reserves, sends once, finalizes without exposing Auth response',async()=>{
  const r=await run();assert.equal(r.response.status,200);assert.equal(r.data.status,'invited')
  assert.deepEqual(r.calls[0],['auth',{platformAdmin:true}]);assert.deepEqual(r.calls.map(c=>c[0]),['auth','security_v2_prepare_customer_invite','invite','security_v2_finalize_customer_invite'])
  assert.equal(r.calls[2][2].redirectTo,'http://127.0.0.1:4175/onboarding.html');assert.equal(r.response.headers.get('cache-control'),'no-store')
})
for(const denied of [401,403])test('unauthenticated/non-AAL2/non-admin denied before reservation '+denied,async()=>{const r=await run({denied});assert.equal(r.response.status,denied);assert.equal(r.calls.length,1)})
test('duplicate/same request reconciles without another email',async()=>{const r=await run({plan:{ok:true,send:false,invitationId:id,status:'reserved'}});assert.equal(r.response.status,200);assert.ok(!r.calls.some(c=>c[0]==='invite'))})
for(const options of [{prepareError:true},{inviteError:true},{throwInvite:true},{finalizeError:true}])test('partial failure safe, no deletion or auth resend '+JSON.stringify(options),async()=>{const r=await run(options);assert.equal(r.response.status,503);assert.ok(r.calls.filter(c=>c[0]==='invite').length<=1);assert.doesNotMatch(r.body,/sensitive internal|test.invalid/);assert.ok(!r.calls.some(c=>/delete|upsert/i.test(c[0])))})
for(const body of [{...valid(),role:'owner'},{...valid(),role:'publisher'},{...valid(),role:null},{...valid(),userId:id},{...valid(),status:'active'},{...valid(),redirectTo:'https://evil.invalid'},{...valid(),email:'invalid'}])test('strict body rejects privilege/redirect injection '+Object.keys(body).join(','),async()=>{const r=await run({}, {body});assert.equal(r.response.status,400);assert.equal(r.calls.length,1)})
test('duplicate JSON keys rejected before reservation',async()=>{const r=await run({}, {raw:'{"role":"editor","role":"owner"}'});assert.equal(r.response.status,400);assert.equal(r.calls.length,1)})
test('browser production origin cannot target local invitation setup',async()=>{const r=await run({}, {headers:{origin:'https://wreach.no'}});assert.equal(r.response.status,403);assert.equal(r.calls.length,1)})
test('local origin cannot invoke production onboarding',async()=>{const r=await run({serverUrl:'https://oqwpfnmqeriupujpssxz.supabase.co'});assert.equal(r.response.status,403);assert.equal(r.calls.length,1)})
test('hosted redirect fixed to Wreach, never browser supplied',async()=>{const r=await run({serverUrl:'https://oqwpfnmqeriupujpssxz.supabase.co'},{headers:{origin:'https://wreach.no'}});assert.equal(r.response.status,200);assert.equal(r.calls.find(c=>c[0]==='invite')[2].redirectTo,'https://wreach.no/onboarding.html')})
test('CORS preflight is narrow/no-store and rejects foreign origins',async()=>{
  const r=await run({}, {method:'OPTIONS',headers:{'access-control-request-method':'POST','access-control-request-headers':'authorization, idempotency-key, content-type'}})
  assert.equal(r.response.status,204);assert.equal(r.calls.length,0);assert.equal(r.response.headers.get('access-control-allow-origin'),'http://127.0.0.1:4175');assert.equal(r.response.headers.get('vary'),'Origin')
  assert.equal((await run({}, {method:'OPTIONS',headers:{origin:'https://evil.invalid','access-control-request-method':'POST'}})).response.status,403)
})
test('no raw error logging, automatic deletion or default owner',()=>{assert.doesNotMatch(source,/console\.|deleteUser|\.upsert|role\s*\?\?\s*'owner'/)})
const recovery=()=>({action:'recover',companyId:id,invitationId:id})
const recoveryPlan={ok:true,invitationId:id,attemptId:id,delivery:'prepared'}
test('recovery email comes ONLY from service binding; no browser recipient/user/role',async()=>{
  const r=await run({plan:recoveryPlan},{body:recovery()});assert.equal(r.response.status,200);assert.equal(r.data.delivery,'sent')
  assert.deepEqual(r.calls.map(c=>c[0]),['auth','security_v2_prepare_invitation_recovery','security_v2_claim_invitation_delivery','recovery-email','security_v2_finish_invitation_delivery','security_v2_finalize_customer_invite'])
  assert.doesNotMatch(r.body,/@test.invalid|originId|userId/)
})
test('durable recovery replay never sends again',async()=>{
  const r=await run({plan:recoveryPlan,claim:{ok:true,send:false,delivery:'sent'}},{body:recovery()})
  assert.equal(r.response.status,200);assert.ok(!r.calls.some(c=>c[0]==='recovery-email'||c[0]==='invite'))
})
test('uncertain email result recorded safely, no blind retry',async()=>{
  const r=await run({plan:recoveryPlan,throwInvite:true},{body:recovery()});assert.equal(r.data.delivery,'uncertain')
  assert.equal(r.calls.filter(c=>c[0]==='recovery-email').length,1)
  assert.equal(r.calls.find(c=>c[0]==='security_v2_finish_invitation_delivery')[1].p_sent,false)
  assert.doesNotMatch(r.body,/sensitive internal/)
})
test('explicit reconciliation never calls email API',async()=>{
  const r=await run({plan:{ok:true,invitationId:id}},{body:{...recovery(),action:'reconcile'}})
  assert.equal(r.response.status,200);assert.equal(r.data.delivery,'reconciled_without_email')
  assert.deepEqual(r.calls.map(c=>c[0]),['auth','security_v2_authorize_invitation_reconcile','security_v2_finalize_customer_invite'])
})
test('reservation with no Auth identity can deliver a new invite using server-owned lineage only',async()=>{
  const r=await run({plan:recoveryPlan,claim:{ok:true,send:true,email:'synthetic@test.invalid',mode:'invite',originId:id}},{body:recovery()})
  assert.equal(r.response.status,200);assert.equal(r.calls.filter(c=>c[0]==='invite').length,1)
  assert.equal(r.calls.find(c=>c[0]==='invite')[2].data.wreach_invitation_id,id)
})
for(const field of ['userId','role','email','membershipId','redirectTo','state'])test('recovery rejects extra '+field,async()=>{
  const r=await run({plan:recoveryPlan},{body:{...recovery(),[field]:'synthetic'}});assert.equal(r.response.status,400);assert.equal(r.calls.length,1)
})
for(const denied of [401,403])test('recovery auth denies before planning '+denied,async()=>{
  const r=await run({denied},{body:recovery()});assert.equal(r.response.status,denied);assert.equal(r.calls.length,1)
})
for(const code of ['RESEND_THROTTLED','ACTIVE_MEMBERSHIP_EXISTS','BINDING_MISMATCH','IDENTITY_CONFLICT','INVITATION_NOT_FOUND','INVITATION_STATE_INCOMPATIBLE'])test('controlled recovery rejection '+code,async()=>{
  const r=await run({plan:{ok:false,error:code}},{body:recovery()});assert.equal(r.response.status,code==='RESEND_THROTTLED'?429:409);assert.equal(r.data.error.code,code);assert.equal(r.calls.length,2)
})
