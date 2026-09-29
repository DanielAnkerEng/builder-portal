import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
const source = readFileSync(new URL('../../supabase/functions/admin-provision-company/index.ts',import.meta.url),'utf8')
let handler
globalThis.Deno = { serve(fn) { handler = fn } }
await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64'))
const origin = 'https://wreach.no'
const request = (method, headers = {}) => new Request('http://fixture.invalid/', {method, headers:{Origin:origin,...headers}})
function policy(r) {
  assert.equal(r.headers.get('cache-control'),'no-store')
  assert.equal(r.headers.get('vary'),'Origin')
  assert.notEqual(r.headers.get('access-control-allow-origin'),'*')
}
test('retired handler has no IO/client/body/secret/provisioning capability',()=>{
  assert.doesNotMatch(source,/\bimport\b|\bfetch\s*\(|createClient|adminClient|userClient|inviteUserByEmail|\.insert\(|\.upsert\(|\.delete\(|\.rpc\(|Deno\.(env|read|write)|req\.(json|text|arrayBuffer)\(|console\./)
  const config=readFileSync(new URL('../../supabase/config.toml',import.meta.url),'utf8')
  assert.match(config,/\[functions.admin-provision-company\]\s+enabled = true\s+verify_jwt = true/)
})
test('gateway-admitted request always receives 410 without reading body or making IO',async()=>{
  // Deliberately not a valid JWT: this test models handler behavior AFTER the gateway.
  // Token signature/AAL validation is not simulated as proof of real authentication.
  const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('Unexpected IO')}
  try {
    for(const method of ['POST','GET','PUT','DELETE']) {
      const req=request(method,{Authorization:'Bearer synthetic-gateway-admitted'})
      req.json=()=>{throw Error('Body must not be read')}
      const r=await handler(req);assert.equal(r.status,410);policy(r)
      assert.deepEqual(await r.json(),{ok:false,error:{code:'LEGACY_PROVISIONING_RETIRED'}})
    }
  } finally {globalThis.fetch=originalFetch}
})
test('missing bearer header rejected; invalid JWT rejection remains a gateway responsibility',async()=>{
  for(const headers of [{},{Authorization:'Basic synthetic'}])assert.equal((await handler(request('POST',headers))).status,401)
})
test('explicit preflight allowlist and narrow policy',async()=>{
  for(const Origin of [origin,'http://127.0.0.1:4175','http://localhost:4175']) {
    const r=await handler(request('OPTIONS',{Origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,apikey,content-type,x-client-info'}))
    assert.equal(r.status,204);policy(r)
    assert.equal(r.headers.get('access-control-allow-origin'),Origin)
    assert.equal(r.headers.get('access-control-allow-methods'),'POST, OPTIONS')
  }
  for(const headers of [{'Access-Control-Request-Method':'DELETE'},{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'x-unapproved'}])assert.equal((await handler(request('OPTIONS',headers))).status,400)
  const denied=await handler(request('OPTIONS',{Origin:'https://unapproved.invalid','Access-Control-Request-Method':'POST'}))
  assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);policy(denied)
})
test('no normal frontend legacy route/modal; New Customer remains wired',()=>{
  for(const file of readdirSync(new URL('../../js/',import.meta.url)).filter(f=>/\.(js|mjs)$/.test(f)))
    assert.doesNotMatch(readFileSync(new URL('../../js/'+file,import.meta.url),'utf8'),/admin-provision-company/)
  const html=readFileSync(new URL('../../admin.html',import.meta.url),'utf8')
  assert.doesNotMatch(html,/newAccount|na-email|Opprett prosjekt/)
  const admin=readFileSync(new URL('../../js/admin.js',import.meta.url),'utf8')
  assert.match(admin,/createNewCustomerApi\(supabase\)/)
  assert.match(admin,/requireAal2\(\{platformAdmin:true\}\)/)
})
