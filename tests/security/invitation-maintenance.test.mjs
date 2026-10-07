import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const root=new URL('../../',import.meta.url)
const source=readFileSync(new URL('deploy/supabase/create-customer-maintenance/index.ts',root),'utf8')
let handler
globalThis.Deno={serve(fn){handler=fn}}
await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'))
const req=(headers={},method='POST')=>new Request('http://synthetic.invalid/create-customer',{method,headers:{origin:'https://wreach.no',...headers}})
test('maintenance artifact requires JWT gateway and has zero DB/Auth/email/network/body capabilities',()=>{
  assert.match(readFileSync(new URL('deploy/supabase/create-customer-maintenance/config.toml',root),'utf8'),/verify_jwt = true/)
  assert.doesNotMatch(source,/\bimport\b|\bfetch\s*\(|createClient|\.rpc\(|\.from\(|\.insert\(|\.update\(|\.delete\(|Deno\.env|req\.(text|json|arrayBuffer)\(|console\./)
})
// Stronger than relying on specific schema fixtures: ANY DB/network/body access
// throws. Therefore behavior does not depend on presence of onboarding schema.
// Gateway JWT verification is a separate deployment checkpoint, not simulated.
for(const schema of ['old DB without onboarding','new DB with onboarding'])test('maintenance + '+schema+' denies without writes',async()=>{
  const original=globalThis.fetch;let calls=0
  globalThis.fetch=()=>{calls++;throw new Error('No IO permitted')}
  try{
    const r=req({authorization:'Bearer synthetic-gateway-admitted'})
    r.json=()=>{throw new Error('Body not permitted')}
    const response=await handler(r)
    assert.equal(response.status,503);assert.deepEqual(await response.json(),{ok:false,error:{code:'INVITATIONS_MAINTENANCE'}})
    assert.equal(calls,0);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('vary'),'Origin')
    assert.equal(response.headers.get('access-control-allow-origin'),'https://wreach.no')
  }finally{globalThis.fetch=original}
})
test('missing bearer denied; no handler claims to verify a JWT signature',async()=>{
  assert.equal((await handler(req())).status,401)
  assert.match(source,/gateway authenticates/)
})
test('maintenance preflight is strict; foreign origin never receives wildcard',async()=>{
  assert.equal((await handler(req({'access-control-request-method':'POST'},'OPTIONS'))).status,204)
  assert.equal((await handler(req({'access-control-request-method':'DELETE'},'OPTIONS'))).status,400)
  assert.equal((await handler(req({'access-control-request-method':'POST','access-control-request-headers':'x-unknown'},'OPTIONS'))).status,400)
  const r=await handler(req({origin:'https://evil.invalid'},'OPTIONS'));assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null)
})
test('old writer is documented unsupported; no service membership grant added to make compatibility green',()=>{
  const migration=readFileSync(new URL('supabase/migrations/20261006140000_customer_invitation_recovery.sql',root),'utf8')
  assert.doesNotMatch(migration,/grant\s+(?:all|insert|update)[^;]*company_memberships/i)
  const sql=readFileSync(new URL('supabase/tests/customer_onboarding.sql',root),'utf8');assert.match(sql,/old Edge plus new DB remains unsupported/)
})
