import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'

const root = new URL('../../', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')
const helperSource = await read('supabase/functions/_shared/new-customer.ts')
const securitySource = await read('supabase/functions/_shared/security.ts')
const edgeSource = await read('supabase/functions/admin-create-company/index.ts')
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64')
const helperUrl = moduleUrl(helperSource)
const { parseUniqueJson } = await import(helperUrl)
const key = 'a1000000-0000-4000-8000-000000000001'
const companyId = 'b1000000-0000-4000-8000-000000000001'
const token = 'e30.eyJ0ZXN0Ijp0cnVlfQ.signature'
const payload = () => ({ schemaVersion:1, company:{name:'Test'},contact:null,services:[],internal:{lifecycleStatus:'onboarding',assignments:[]} })
let serial = 0
async function fixture(options = {}) {
  const calls = [], configs = []
  const userClient = {
    auth:{
      getUser:async jwt=>({data:{user:options.invalid ? null : {id:'authenticated-actor'}},error:options.invalid ? {} : null}),
      mfa:{getAuthenticatorAssuranceLevel:async jwt=>({data:{currentLevel:options.aal ?? 'aal2'},error:null})},
    },
    from(table) {
      const query = { select(){return query},eq(k,v){ calls.push([table,k,v]);return query },
        async maybeSingle(){return {data:table==='profiles' ? {status:options.profile ?? 'active'} : options.admin===false ? null : {user_id:'authenticated-actor'},error:null}} }
      return query
    },
    async rpc(name,args) {
      calls.push(['rpc',name,args])
      if(options.transport) throw new Error('PRIVATE transport')
      return options.result ?? {data:{ok:true,operationId:key,companyId,status:'completed',error:null},error:null,status:200}
    },
  }
  globalThis.__ncClient=(_url,_key,config)=>{
    configs.push(config)
    if(configs.length===1)return userClient
    return new Proxy({}, {get(){throw new Error('Privileged client must not be used')}})
  }
  let handler
  globalThis.Deno={env:{get:name=>name==='SUPABASE_URL'?'http://127.0.0.1:54321':'unit-placeholder'},serve:fn=>{handler=fn}}
  const securityUrl=moduleUrl(securitySource.replace(/^import .*from 'npm:[^']+'\n/,'const createClient = globalThis.__ncClient\n')+'\n//'+serial++)
  await import(moduleUrl(edgeSource.replace("'../_shared/security.ts'",JSON.stringify(securityUrl)).replace("'../_shared/new-customer.ts'",JSON.stringify(helperUrl))+'\n//'+serial++))
  delete globalThis.__ncClient
  return {handler,calls,configs}
}
function request({method='POST',body=JSON.stringify(payload()),headers={}}={}) {
  const h=new Headers({authorization:'Bearer '+token,'content-type':'application/json','idempotency-key':key,origin:'https://wreach.no'})
  for(const [k,v]of Object.entries(headers)) v===null?h.delete(k):h.set(k,v)
  return new Request('http://127.0.0.1:54321/functions/v1/admin-create-company',{method,headers:h,...(['GET','HEAD','OPTIONS'].includes(method)?{}:{body})})
}
async function run(options={},input={}) {
  const f=await fixture(options),response=await f.handler(request(input))
  assert.equal(response.headers.get('cache-control'),'no-store')
  assert.equal(response.headers.get('vary'),'Origin')
  return {...f,response,data:response.status===204?null:await response.json()}
}
for(const [label,options,headers,status,code]of[
  ['missing',{}, {authorization:null},401,'UNAUTHENTICATED'],
  ['malformed',{}, {authorization:'Bearer broken'},401,'UNAUTHENTICATED'],
  ['invalid',{invalid:true},{},401,'UNAUTHENTICATED'],
  ['AAL1',{aal:'aal1'},{},403,'MFA_REQUIRED'],
  ['non-admin',{admin:false},{},403,'NOT_AUTHORIZED'],
  ['inactive admin',{admin:false},{},403,'NOT_AUTHORIZED'],
  ['inactive profile',{profile:'suspended'},{},403,'PROFILE_INACTIVE'],
]) test('auth '+label,async()=>{
  const r=await run(options,{headers});assert.equal(r.response.status,status);assert.equal(r.data.error.code,code)
  assert.ok(!r.calls.some(c=>c[0]==='rpc'))
})
test('AAL2 active admin: exact user RPC, key and payload; no privileged writes',async()=>{
  const r=await run();assert.equal(r.response.status,200)
  assert.deepEqual(r.data,{ok:true,operationId:key,companyId,status:'completed'})
  assert.deepEqual(r.calls.find(c=>c[0]==='rpc'),['rpc','security_v2_create_company',{p_idempotency_key:key,p_payload:payload()}])
  assert.equal(r.configs[0].global.headers.Authorization,'Bearer '+token)
  assert.ok(r.calls.some(c=>c[0]==='platform_admins'&&c[1]==='is_active'&&c[2]===true))
})
for(const method of ['GET','PUT','PATCH','DELETE','HEAD'])test('method '+method,async()=>{
  const r=await run({}, {method});assert.equal(r.response.status,405);assert.equal(r.calls.length,0)
})
test('OPTIONS only preflight, no Auth or RPC',async()=>{
  const r=await run({}, {method:'OPTIONS',headers:{authorization:null,'access-control-request-method':'POST','access-control-request-headers':'authorization, apikey, content-type, idempotency-key, x-client-info'}})
  assert.equal(r.response.status,204);assert.equal(r.calls.length,0)
})
for(const headers of [{'access-control-request-method':'DELETE'},{'access-control-request-method':'POST','access-control-request-headers':'x-unapproved'}])test('invalid preflight',async()=>{
  assert.equal((await run({}, {method:'OPTIONS',headers})).response.status,400)
})
for(const mime of ['application/json','application/json; charset=utf-8','application/json; charset="UTF-8"'])test('MIME '+mime,async()=>{
  assert.equal((await run({}, {headers:{'content-type':mime}})).response.status,200)
})
for(const mime of ['text/plain','application/jsonp','application/json; charset=latin1',null])test('reject MIME '+mime,async()=>{
  assert.equal((await run({}, {headers:{'content-type':mime}})).response.status,415)
})
for(const body of ['', '{', '{} garbage', '{"a":1,}', '[1,]', '{"a":01}', '{"a":"\\x20"}', '['.repeat(34)+']'.repeat(34)])test('malformed/deep body '+body.slice(0,20),async()=>{
  const r=await run({}, {body});assert.equal(r.response.status,400);assert.ok(!r.calls.some(c=>c[0]==='rpc'))
})
test('actual 16384 bytes accepted; 16385 rejected even misleading Content-Length',async()=>{
  const raw=JSON.stringify(payload()),body=raw+' '.repeat(16384-Buffer.byteLength(raw))
  assert.equal((await run({}, {body})).response.status,200)
  const r=await run({}, {body:body+' ',headers:{'content-length':'1'}})
  assert.equal(r.response.status,413);assert.equal(r.data.error.code,'PAYLOAD_TOO_LARGE')
  assert.ok(!r.calls.some(c=>c[0]==='rpc'))
})
test('multibyte body byte limit',async()=>{
  const p=payload();p.company.name='ø'.repeat(8192)
  assert.equal((await run({}, {body:JSON.stringify(p)})).response.status,413)
})
for(const body of [
  '{"company":{},"company":{}}', '{"company":{"name":"A","name":"B"}}',
  '{"contact":{"name":"A","name":"B"}}','{"internal":{"assignments":[],"assignments":[]}}',
  '{"internal":{"assignments":[{"assigneeUserId":"A","assigneeUserId":"B"}]}}',
  '{"company":{"name":"A","\\u006eame":"B"}}', '{"__proto__":1,"__proto__":2}',
])test('duplicate raw key '+body,async()=>{
  assert.throws(()=>parseUniqueJson(body));const r=await run({}, {body});assert.equal(r.response.status,400);assert.ok(!r.calls.some(c=>c[0]==='rpc'))
})
test('escaped key-like text and separate objects are not duplicate keys',()=>{
  const value={text:'"name":"A","name":"B" \\ \n',items:[{name:'A'},{name:'B'}]}
  assert.deepEqual(parseUniqueJson(JSON.stringify(value)),value)
})
test('separate assignment objects passed unchanged to authoritative validation',async()=>{
  const p=payload();p.internal.assignments=[{responsibilityType:'account',assigneeUserId:key},{responsibilityType:'seo',assigneeUserId:key}]
  assert.equal((await run({}, {body:JSON.stringify(p)})).response.status,200)
})
for(const id of [null,'bad',key.replace('-4000-','-1000-'),key.toUpperCase(),'{'+key+'}'])test('invalid idempotency '+id,async()=>{
  assert.equal((await run({}, {headers:{'idempotency-key':id}})).response.status,400)
})
for(const origin of ['https://wreach.no','http://127.0.0.1:4175','http://localhost:4175'])test('allowed origin '+origin,async()=>{
  const r=await run({}, {headers:{origin}});assert.equal(r.response.headers.get('access-control-allow-origin'),origin)
  assert.equal(r.response.headers.get('access-control-allow-methods'),'POST, OPTIONS')
})
for(const origin of ['https://evil.invalid','https://wreach.no.evil.invalid','null','http://localhost:3000'])test('denied origin '+origin,async()=>{
  const r=await run({}, {headers:{origin}});assert.equal(r.response.status,403);assert.equal(r.response.headers.get('access-control-allow-origin'),null)
})
test('allowed-origin errors have CORS; no-Origin requires auth but permits server client',async()=>{
  const r=await run({aal:'aal1'});assert.equal(r.response.headers.get('access-control-allow-origin'),'https://wreach.no')
  assert.equal((await run({}, {headers:{origin:null}})).response.status,200)
})
for(const code of ['IDEMPOTENCY_CONFLICT','ORGANIZATION_NUMBER_EXISTS','INVALID_PAYLOAD','INVALID_ASSIGNEE','INVALID_SERVICE','NOT_AUTHORIZED'])test('Phase B error '+code,async()=>{
  const r=await run({result:{data:{ok:false,error:code,operationId:key},error:null}})
  assert.equal(r.response.status,code==='NOT_AUTHORIZED'?403:code.endsWith('CONFLICT')||code==='ORGANIZATION_NUMBER_EXISTS'?409:400)
  assert.deepEqual(r.data,{ok:false,operationId:key,error:{code}})
})
test('completed replay uses identical response',async()=>{
  assert.deepEqual((await run()).data,(await run()).data)
})
for(const result of [{data:null,error:{message:'PRIVATE database detail'},status:400},{data:{ok:false,error:'PRIVATE database detail'},error:null},{data:{ok:true},error:null}])test('internal error is safe',async()=>{
  const r=await run({result});assert.equal(r.response.status,500);assert.deepEqual(r.data,{ok:false,error:{code:'OPERATION_FAILED'}})
})
test('lost transport response requires same key/payload retry',async()=>{
  for(const options of [{transport:true},{result:{data:null,error:{message:'PRIVATE'},status:0}}]) {
    const r=await run(options);assert.equal(r.response.status,503);assert.equal(r.data.error.code,'RETRY_SAME_REQUEST')
  }
})
test('unknown fields and malformed structural values rejected at every level',async()=>{
  for(const mutate of [p=>p.extra=1,p=>p.company.extra=1,p=>p.contact={name:'x',extra:1},p=>p.internal.extra=1,p=>p.internal.assignments=[{responsibilityType:'account',assigneeUserId:key,extra:1}],p=>p.services={},p=>p.schemaVersion='1']) {
    const p=payload();mutate(p);const r=await run({}, {body:JSON.stringify(p)});assert.equal(r.response.status,400);assert.ok(!r.calls.some(c=>c[0]==='rpc'))
  }
})
test('static write/privacy boundary and gateway JWT config',async()=>{
  assert.doesNotMatch(edgeSource+helperSource,/console\.|\.insert\(|\.upsert\(|\.update\(|\.delete\(|auth\.admin|adminClient|localStorage|sessionStorage|eval\(|new Function/)
  assert.match(edgeSource,/requireAal2\(req, \{ platformAdmin: true \}\)/)
  assert.match(await read('supabase/config.toml'),/\[functions\.admin-create-company\]\s+enabled = true\s+verify_jwt = true/)
})
