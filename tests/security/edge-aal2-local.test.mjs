import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID, createHmac } from 'node:crypto'
import { homedir } from 'node:os'
import { LOCAL_SUPABASE_CONFIG } from '../../js/supabase.local.js'

const enabled = process.env.WREACH_LOCAL_AUTH_TESTS === '1'
const base = 'http://127.0.0.1:54321'
const socket = 'unix://' + homedir() + '/.docker/run/docker.sock'
const quote = value => "'" + String(value).replaceAll("'", "''") + "'"
const sql = statement => execFileSync('docker', ['--host',socket,'exec','-i','supabase_db_webbyra-demo-github',
  'psql','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'], { input:statement, encoding:'utf8', stdio:['pipe','pipe','pipe'] }).trim()

// Local real Auth only. Password, access tokens and TOTP seed stay in process memory.
function totp(seed) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits=''
  for (const char of seed.toUpperCase().replace(/=+$/,'')) {
    const value=alphabet.indexOf(char)
    if(value<0) throw new Error('Invalid local TOTP seed')
    bits+=value.toString(2).padStart(5,'0')
  }
  const key=Buffer.from(Array.from({length:Math.floor(bits.length/8)},(_,i)=>parseInt(bits.slice(i*8,i*8+8),2)))
  const counter=Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)))
  const digest=createHmac('sha1',key).update(counter).digest()
  const offset=digest[digest.length-1]&15
  return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0')
}
test('REAL LOCAL password → TOTP → stateless Edge helper', { skip:!enabled }, async t=>{
  assert.equal(LOCAL_SUPABASE_CONFIG.url,base,'Only fixed local Supabase is permitted')
  const publicKey=LOCAL_SUPABASE_CONFIG.key
  assert.ok(typeof publicKey==='string','Local public config required')
  const request=async (path,token,body)=>{
    const response=await fetch(base+path,{ method:'POST',headers:{
      apikey:publicKey,Authorization:'Bearer '+(token||publicKey),'Content-Type':'application/json'
    },body:JSON.stringify(body)})
    const text=await response.text()
    let data
    try { data=JSON.parse(text) } catch { data=null }
    return {status:response.status,data}
  }
  let user,company,website
  const email='c0-'+randomUUID()+'@test.invalid',password='Local!A9-'+randomUUID()
  try {
    const signup=await request('/auth/v1/signup',null,{email,password})
    assert.equal(signup.status,200,'Local fixture signup must succeed')
    user=signup.data?.user?.id
    assert.ok(user,'Auth-created fixture identity required')
    company=randomUUID(); website=randomUUID()
    sql('begin; insert into public.profiles(id,display_name,status) values('+quote(user)+",'Local C0 fixture','active');"+
      'insert into public.platform_admins(user_id,admin_role) values('+quote(user)+",'admin');"+
      'insert into public.companies(id,name) values('+quote(company)+",'Local C0 fixture');"+
      'insert into public.websites(id,company_id,name,public_slug,created_by) values('+
      [website,company,'Local C0 fixture','c0-'+website,user].map(quote).join(',')+'); commit;')
    const login=await request('/auth/v1/token?grant_type=password',null,{email,password})
    assert.equal(login.status,200,'Real password login')
    const aal1=login.data?.access_token
    assert.ok(aal1,'Local password session required')
    const draft={websiteId:website,expectedRevision:0,content:{businessName:'Local C0 fixture',accent:'#112233',accent2:'#445566',bg:'#ffffff',activePageId:'home',pages:[{id:'home',slug:'',name:'Forside',offerings:[],gallery:[],sections:[]}]}}
    await t.test('Real password AAL1 denied by Edge',async()=>{
      assert.equal((await request('/functions/v1/save-draft',aal1,draft)).status,403)
    })
    const enrollment=await request('/auth/v1/factors',aal1,{factor_type:'totp',friendly_name:'Local C0 fixture'})
    assert.equal(enrollment.status,200,'Real local enrollment')
    const factor=enrollment.data?.id
    assert.ok(factor&&enrollment.data?.totp?.secret,'Local factor created')
    const challenge=await request('/auth/v1/factors/'+factor+'/challenge',aal1,{})
    assert.equal(challenge.status,200,'Real local challenge')
    const verification=await request('/auth/v1/factors/'+factor+'/verify',aal1,{challenge_id:challenge.data.id,code:totp(enrollment.data.totp.secret)})
    assert.equal(verification.status,200,'Real TOTP verification')
    const aal2=verification.data?.access_token
    assert.ok(aal2,'Real MFA-upgraded session required')
    await t.test('Real AAL2 accepted by stateless Edge and user-JWT draft RPC',async()=>{
      const result=await request('/functions/v1/save-draft',aal2,draft)
      assert.equal(result.status,200,'Authorized real Edge draft save')
      assert.equal(result.data?.ok,true)
      assert.equal(sql('select count(*) from public.website_drafts where website_id='+quote(website)+' and updated_by='+quote(user)),'1')
    })
    await t.test('Original AAL1 still denied after factor enrollment',async()=>{
      assert.equal((await request('/functions/v1/save-draft',aal1,{...draft,expectedRevision:1})).status,403)
    })
    await t.test('Invalid token denied',async()=>{
      assert.equal((await request('/functions/v1/save-draft','invalid.token.signature',draft)).status,401)
    })
    await t.test('Inactive real profile denied',async()=>{
      sql("update public.profiles set status='suspended' where id="+quote(user))
      assert.equal((await request('/functions/v1/save-draft',aal2,{...draft,expectedRevision:1})).status,403)
    })
  } finally {
    if(user) {
      // Only this run's Auth-created local fixture; no production or unrelated rows.
      sql('begin; delete from public.audit_events where actor_user_id='+quote(user)+';'+
        (website?'delete from public.website_drafts where website_id='+quote(website)+';delete from public.websites where id='+quote(website)+';':'')+
        (company?'delete from public.companies where id='+quote(company)+';':'')+
        'delete from public.platform_admins where user_id='+quote(user)+';delete from public.profiles where id='+quote(user)+';'+
        'delete from auth.users where id='+quote(user)+';commit;')
    }
  }
})
