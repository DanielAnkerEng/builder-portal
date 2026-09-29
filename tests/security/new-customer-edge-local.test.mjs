import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID, createHmac } from 'node:crypto'
import { homedir } from 'node:os'
import { LOCAL_SUPABASE_CONFIG } from '../../js/supabase.local.js'
import { localEdgeHttp } from './helpers/local-edge-http.mjs'

const base='http://127.0.0.1:54321'
const quote=v=>"'"+String(v).replaceAll("'","''")+"'"
const sql=s=>execFileSync('docker',['--host','unix://'+homedir()+'/.docker/run/docker.sock','exec','-i',
  'supabase_db_webbyra-demo-github','psql','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],
  {input:s,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
function totp(seed) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits=''
  for(const c of seed.toUpperCase().replace(/=+$/,'')) {
    const n=alphabet.indexOf(c);if(n<0)throw new Error('Invalid local seed')
    bits+=n.toString(2).padStart(5,'0')
  }
  const secret=Buffer.from(Array.from({length:Math.floor(bits.length/8)},(_,i)=>parseInt(bits.slice(i*8,i*8+8),2)))
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)))
  const digest=createHmac('sha1',secret).update(counter).digest(),offset=digest[digest.length-1]&15
  return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0')
}
function organizationNumber() {
  for(;;) {
    const digits=Array.from({length:8},()=>Math.floor(Math.random()*10));digits[0]=9
    const check=(11-digits.reduce((sum,n,i)=>sum+n*[3,2,7,6,5,4,3,2][i],0)%11)%11
    if(check!==10)return digits.join('')+check
  }
}
for (const direct of [false, true]) test('REAL LOCAL New Customer '+(direct?'DIRECT RUNTIME':'KONG')+' HTTP/Auth/TOTP/Edge/RPC',
  {skip:process.env[direct?'WREACH_LOCAL_DIRECT_EDGE_TESTS':'WREACH_LOCAL_AUTH_TESTS']!=='1'},async t=>{
  assert.equal(LOCAL_SUPABASE_CONFIG.url,base)
  const apiKey=LOCAL_SUPABASE_CONFIG.key
  const request=async(path,token,body,extra={})=>{
    const response=await fetch(base+path,{method:'POST',headers:{apikey:apiKey,Authorization:'Bearer '+(token||apiKey),
      'Content-Type':'application/json',...extra},body:typeof body==='string'?body:JSON.stringify(body)})
    const raw=await response.text();let data;try{data=JSON.parse(raw)}catch{data=null}
    return {status:response.status,data,headers:response.headers}
  }
  let user
  const email='phase-c-'+randomUUID()+'@test.invalid',password='Local!A9-'+randomUUID()
  const key=randomUUID()
  try {
    const signup=await request('/auth/v1/signup',null,{email,password})
    assert.equal(signup.status,200,'Local fixture signup');user=signup.data?.user?.id;assert.ok(user)
    sql('begin;insert into public.profiles(id,display_name,status) values('+quote(user)+",'Local Phase C fixture','active');"+
      'insert into public.platform_admins(user_id,admin_role) values('+quote(user)+",'admin');commit;")
    const login=await request('/auth/v1/token?grant_type=password',null,{email,password})
    assert.equal(login.status,200,'Real password login');const aal1=login.data?.access_token;assert.ok(aal1)
    let org
    do {org=organizationNumber()}while(sql('select count(*) from public.companies where organization_number='+quote(org))!=='0')
    const payload={schemaVersion:1,company:{name:'Local Phase C fixture',organizationNumber:org},contact:{name:'Local fixture contact'},
      services:['website'],internal:{lifecycleStatus:'onboarding',assignments:[{responsibilityType:'account',assigneeUserId:user}]}}
    const edge=async(token,body=payload,id=key)=>{
      if(!direct)return request('/functions/v1/admin-create-company',token,body,{'Idempotency-Key':id,Origin:'http://127.0.0.1:4175'})
      const r=await localEdgeHttp({headers:{apikey:apiKey,Authorization:'Bearer '+token,'Content-Type':'application/json',
        'Idempotency-Key':id,Origin:'http://127.0.0.1:4175'},body:typeof body==='string'?body:JSON.stringify(body)})
      let data;try{data=JSON.parse(r.body)}catch{data=null}
      return {...r,data}
    }
    const operations=()=>sql('select count(*) from private.provisioning_operations where actor_user_id='+quote(user))
    await t.test('AAL1 denied without creating operation',async()=>{
      const r=await edge(aal1);assert.equal(r.status,403);assert.equal(r.data?.error?.code,'MFA_REQUIRED');assert.equal(operations(),'0')
    })
    const enroll=await request('/auth/v1/factors',aal1,{factor_type:'totp',friendly_name:'Local Phase C fixture'})
    assert.equal(enroll.status,200)
    const challenge=await request('/auth/v1/factors/'+enroll.data.id+'/challenge',aal1,{})
    assert.equal(challenge.status,200)
    const verified=await request('/auth/v1/factors/'+enroll.data.id+'/verify',aal1,{challenge_id:challenge.data.id,code:totp(enroll.data.totp.secret)})
    assert.equal(verified.status,200);const aal2=verified.data?.access_token;assert.ok(aal2)
    let created
    await t.test('AAL2 creates real package and exactly one success audit',async()=>{
      const r=await edge(aal2);assert.equal(r.status,200);assert.equal(r.data?.ok,true);created=r.data
      assert.match(created.companyId,/^[0-9a-f-]{36}$/);assert.match(created.operationId,/^[0-9a-f-]{36}$/)
      assert.equal(r.headers.get('cache-control'),'no-store')
      for(const table of ['companies','company_contacts','company_services','company_internal_settings','company_assignments'])
        assert.equal(sql('select count(*) from public.'+table+' where '+(table==='companies'?'id':'company_id')+'='+quote(created.companyId)),'1',table)
      assert.equal(sql("select count(*) from public.audit_events where actor_user_id="+quote(user)+" and event_type='company.create' and result='success' and request_correlation_id="+quote(created.operationId)),'1')
      assert.equal(sql('select count(*) from public.company_memberships where company_id='+quote(created.companyId)),'0')
      assert.equal(sql('select count(*) from public.websites where company_id='+quote(created.companyId)),'0')
    })
    await t.test('same-key replay returns same IDs with no duplicate package/audit',async()=>{
      assert.ok(created,'Creation must have succeeded')
      const r=await edge(aal2);assert.equal(r.status,200);assert.deepEqual(r.data,created);assert.equal(operations(),'1')
      assert.equal(sql('select count(*) from public.companies where organization_number='+quote(org)),'1')
      assert.equal(sql("select count(*) from public.audit_events where actor_user_id="+quote(user)+" and event_type='company.create' and result='success'"),'1')
    })
    await t.test('same key changed payload conflicts',async()=>{
      const r=await edge(aal2,{...payload,company:{...payload.company,name:'Changed local fixture'}})
      assert.equal(r.status,409);assert.equal(r.data?.error?.code,'IDEMPOTENCY_CONFLICT')
    })
    await t.test('new key duplicate organization conflicts without duplicate company',async()=>{
      const r=await edge(aal2,payload,randomUUID());assert.equal(r.status,409);assert.equal(r.data?.error?.code,'ORGANIZATION_NUMBER_EXISTS')
      assert.equal(sql('select count(*) from public.companies where organization_number='+quote(org)),'1')
    })
    for(const [label,raw]of [['duplicate','{"schemaVersion":1,"schemaVersion":1}'],['Unicode duplicate','{"company":{"name":"A","\\u006eame":"B"}}'],['malformed','{"schemaVersion":']])
      await t.test(label+' rejected before operation',async()=>{
        const before=operations(),r=await edge(aal2,raw,randomUUID());assert.equal(r.status,400);assert.equal(r.data?.error?.code,'INVALID_REQUEST');assert.equal(operations(),before)
      })
    await t.test('invalid JWT denied',async()=>{assert.equal((await edge('invalid.token.signature')).status,401)})
    await t.test('gateway preserves exact allowlisted CORS response (no wildcard)',async()=>{
      const r=await edge(aal2)
      assert.equal(r.headers.get('access-control-allow-origin'),'http://127.0.0.1:4175')
    })
    if(direct) {
      const tokens=(r,name)=>(r.headers.get(name)||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean)
      const policy=r=>{
        assert.ok(tokens(r,'cache-control').includes('no-store'))
        assert.ok(tokens(r,'vary').includes('origin'))
        assert.notEqual(r.headers.get('access-control-allow-origin'),'*')
      }
      for(const origin of ['https://wreach.no','http://127.0.0.1:4175','http://localhost:4175'])
        await t.test('direct preflight exact allowlist '+origin,async()=>{
          const r=await localEdgeHttp({method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST',
            'Access-Control-Request-Headers':'authorization, apikey, content-type, idempotency-key, x-client-info'}})
          assert.equal(r.status,204);policy(r)
          assert.equal(r.headers.get('access-control-allow-origin'),origin)
          assert.deepEqual(tokens(r,'access-control-allow-methods').sort(),['options','post'])
          assert.deepEqual(tokens(r,'access-control-allow-headers').sort(),['apikey','authorization','content-type','idempotency-key','x-client-info'])
        })
      await t.test('direct disallowed-origin preflight is denied without ACAO',async()=>{
        const r=await localEdgeHttp({method:'OPTIONS',headers:{Origin:'https://unapproved.invalid','Access-Control-Request-Method':'POST'}})
        assert.equal(r.status,403);policy(r);assert.equal(r.headers.get('access-control-allow-origin'),null)
      })
      await t.test('direct invalid preflight method/header is denied by function',async()=>{
        for(const headers of [{'Access-Control-Request-Method':'DELETE'},{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'x-unapproved'}]) {
          const r=await localEdgeHttp({method:'OPTIONS',headers:{Origin:'http://127.0.0.1:4175',...headers}})
          assert.equal(r.status,400);policy(r)
        }
      })
      await t.test('direct POST errors preserve policy and never write an operation',async()=>{
        const before=operations()
        for(const origin of ['http://127.0.0.1:4175','https://unapproved.invalid']) {
          const r=await localEdgeHttp({headers:{Authorization:'Bearer '+aal2,Origin:origin,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:'{'})
          assert.equal(r.status,origin.includes('unapproved')?403:400);policy(r)
          assert.equal(r.headers.get('access-control-allow-origin'),origin.includes('unapproved')?null:origin)
        }
        assert.equal(operations(),before)
      })
    }
  } finally {
    if(user) {
      const owned='select company_id from private.provisioning_operations where actor_user_id='+quote(user)+' and company_id is not null'
      // Only this run's Auth-created identity and packages. Never a remote connection.
      sql('begin;create temporary table phase_c_owned on commit drop as '+owned+';'+
        'delete from public.audit_events where actor_user_id='+quote(user)+';'+
        ['company_assignments','company_contacts','company_services','company_internal_settings'].map(table=>'delete from public.'+table+' where company_id in(select company_id from phase_c_owned);').join('')+
        'delete from private.provisioning_operations where actor_user_id='+quote(user)+';'+
        'delete from public.companies where id in(select company_id from phase_c_owned);'+
        'delete from public.platform_admins where user_id='+quote(user)+';delete from public.profiles where id='+quote(user)+';'+
        'delete from auth.users where id='+quote(user)+';commit;')
      assert.equal(sql('select count(*) from auth.users where id='+quote(user)),'0','Local identity cleanup')
      assert.equal(sql('select count(*) from private.provisioning_operations where actor_user_id='+quote(user)),'0','Local operation cleanup')
    }
  }
})
