import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID, createHmac } from 'node:crypto'
import { homedir } from 'node:os'
import { LOCAL_SUPABASE_CONFIG } from '../../js/supabase.local.js'

// Fixed local endpoints/container, explicit opt-in, no production URL override.
// Auth material and mail links stay in memory; never used in assertion output.
const base='http://127.0.0.1:54321', mail='http://127.0.0.1:54324'
const quote=value=>"'"+String(value).replaceAll("'","''")+"'"
function sql(statement) {
  try { return execFileSync('docker',['--host','unix://'+homedir()+'/.docker/run/docker.sock','exec','-i','supabase_db_webbyra-demo-github','psql','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],{input:statement,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim() }
  catch { throw new Error('Local onboarding database fixture/check failed; diagnostics suppressed') }
}
function totp(seed) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=''
  for(const char of seed.toUpperCase().replace(/=+$/,'')) {const n=alphabet.indexOf(char);if(n<0)throw new Error('Invalid local factor');bits+=n.toString(2).padStart(5,'0')}
  const key=Buffer.from(Array.from({length:Math.floor(bits.length/8)},(_,i)=>parseInt(bits.slice(i*8,i*8+8),2)))
  const count=Buffer.alloc(8);count.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)))
  const digest=createHmac('sha1',key).update(count).digest(),offset=digest[digest.length-1]&15
  return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0')
}
test('REAL LOCAL customer invitation → first password → TOTP → activation → tenant isolation',
  {skip:process.env.WREACH_LOCAL_ONBOARDING_TESTS!=='1'},async t=>{
  assert.equal(LOCAL_SUPABASE_CONFIG.url,base)
  const key=LOCAL_SUPABASE_CONFIG.key,company=randomUUID(),other=randomUUID(),requestId=randomUUID()
  const adminMailbox='onboarding-admin-'+randomUUID(),customerMailbox='onboarding-customer-'+randomUUID()
  const adminEmail=adminMailbox+'@test.invalid',customerEmail=customerMailbox+'@test.invalid'
  let adminId,customerId,invitationId
  const request=async(path,token,body,method='POST',extra={})=>{
    const response=await fetch(base+path,{method,redirect:'manual',signal:AbortSignal.timeout(15000),headers:{apikey:key,Authorization:'Bearer '+(token||key),'Content-Type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})})
    const raw=await response.text();let data;try{data=JSON.parse(raw)}catch{data=null}
    return {status:response.status,data,headers:response.headers}
  }
  const rpc=(name,token,body={})=>request('/rest/v1/rpc/'+name,token,body)
  const mailbox=async email=>{
    const res=await fetch(mail+'/api/v1/search?query='+encodeURIComponent('to:'+email),{signal:AbortSignal.timeout(10000)})
    assert.equal(res.status,200,'Local Mailpit search available')
    const data=await res.json()
    return (data.messages??[]).filter(message=>message.To?.some(to=>to.Address===email))
  }
  const mfa=async(token,label,negative=false)=>{
    const enrollment=await request('/auth/v1/factors',token,{factor_type:'totp',friendly_name:label})
    assert.equal(enrollment.status,200,'Local TOTP enrollment');assert.ok(enrollment.data?.totp?.secret,'Local TOTP state exists')
    if(negative){const challenge=await request('/auth/v1/factors/'+enrollment.data.id+'/challenge',token,{})
      const wrong=String((Number(totp(enrollment.data.totp.secret))+1)%1000000).padStart(6,'0')
      assert.equal((await request('/auth/v1/factors/'+enrollment.data.id+'/verify',token,{challenge_id:challenge.data.id,code:wrong})).status,422,'Wrong TOTP rejected')}
    const challenge=await request('/auth/v1/factors/'+enrollment.data.id+'/challenge',token,{})
    const verified=await request('/auth/v1/factors/'+enrollment.data.id+'/verify',token,{challenge_id:challenge.data.id,code:totp(enrollment.data.totp.secret)})
    assert.equal(verified.status,200,'Correct local TOTP');assert.ok(verified.data?.access_token,'MFA session returned')
    return verified.data.access_token
  }
  try {
    const adminPassword='Local!onboarding-'+randomUUID()
    const signup=await request('/auth/v1/signup',null,{email:adminEmail,password:adminPassword})
    assert.equal(signup.status,200,'Disposable local admin identity');adminId=signup.data?.user?.id;assert.ok(adminId)
    sql('begin;insert into public.profiles(id,display_name,status) values('+quote(adminId)+",'Local onboarding admin','active');insert into public.platform_admins(user_id,admin_role) values("+quote(adminId)+",'admin');insert into public.companies(id,name) values("+quote(company)+",'Local onboarding own'),("+quote(other)+",'Local onboarding foreign');commit;")
    const login=await request('/auth/v1/token?grant_type=password',null,{email:adminEmail,password:adminPassword})
    assert.equal(login.status,200,'Admin real password login');const adminAal1=login.data.access_token
    const body={companyId:company,email:customerEmail,displayName:'Local synthetic customer',role:'editor'}
    const invite=token=>request('/functions/v1/create-customer',token,body,'POST',{'Idempotency-Key':requestId,Origin:'http://127.0.0.1:4175'})
    await t.test('AAL1 admin cannot invite',async()=>assert.equal((await invite(adminAal1)).status,403))
    const adminAal2=await mfa(adminAal1,'Local onboarding admin')
    await t.test('actual create-customer sends local invite and creates pending binding',async()=>{
      const result=await invite(adminAal2);assert.equal(result.status,200,'Invite response');assert.equal(result.data?.status,'invited')
      invitationId=result.data.invitationId;assert.ok(invitationId)
      customerId=sql('select user_id from private.customer_invitations where id='+quote(invitationId));assert.match(customerId,/^[0-9a-f-]{36}$/)
      assert.equal(sql('select status from public.company_memberships where user_id='+quote(customerId)),'invited')
      assert.equal(sql('select count(*) from public.platform_admins where user_id='+quote(customerId)),'0')
      assert.equal(sql('select count(*) from public.profiles where id='+quote(customerId)+' and company_id is null'),'1')
    })
    assert.ok(customerId&&invitationId,'Invitation must succeed before further tests')
    await t.test('duplicate exact invitation does not duplicate membership/audit',async()=>{
      assert.equal((await invite(adminAal2)).status,200)
      assert.equal(sql('select count(*) from public.company_memberships where user_id='+quote(customerId)),'1')
      assert.equal(sql("select count(*) from public.audit_events where event_type='customer.invite' and target_id="+quote(customerId)),'1')
    })
    await t.test('lost-email recovery sends fresh Auth email, preserves identity, replay does not resend',async()=>{
      const oldId=invitationId,recoveryKey=randomUUID()
      const recover=(id,key)=>request('/functions/v1/create-customer',adminAal2,{action:'recover',companyId:company,invitationId:id},'POST',{'Idempotency-Key':key,Origin:'http://127.0.0.1:4175'})
      const result=await recover(oldId,recoveryKey)
      assert.equal(result.status,200,'Recovery response');assert.equal(result.data?.delivery,'sent','Fresh recovery email accepted by Auth')
      invitationId=result.data.invitationId;assert.notEqual(invitationId,oldId)
      assert.equal(sql('select user_id from private.customer_invitations where id='+quote(invitationId)),customerId)
      assert.equal(sql('select count(*) from public.company_memberships where user_id='+quote(customerId)),'1')
      assert.equal(sql('select status from public.company_memberships where user_id='+quote(customerId)),'invited')
      const count=(await mailbox(customerEmail)).length
      assert.equal((await recover(oldId,recoveryKey)).status,200,'Same recovery replay succeeds')
      assert.equal((await mailbox(customerEmail)).length,count,'Replay sends no email')
      assert.equal((await recover(invitationId,randomUUID())).status,429,'New-key resend throttled')
      const listed=await rpc('security_v2_list_customer_invitations',adminAal2,{p_company:company})
      assert.equal(listed.data?.invitations?.length,1,'Operator can recover current state after reload')
      assert.equal(listed.data.invitations[0].invitationId,invitationId)
      const reconciled=await request('/functions/v1/create-customer',adminAal2,{action:'reconcile',companyId:company,invitationId},'POST',{'Idempotency-Key':randomUUID(),Origin:'http://127.0.0.1:4175'})
      assert.equal(reconciled.status,200,'Explicit reconcile succeeds without email');assert.equal((await mailbox(customerEmail)).length,count)
    })
    // Read only this synthetic mailbox. Never display URL, message or session.
    let messages=[]
    for(let attempt=0;attempt<10;attempt++){messages=await mailbox(customerEmail);if(messages.length)break;await new Promise(r=>setTimeout(r,100))}
    assert.equal(messages.length,2,'One original invite and one explicit recovery email')
    // Select the recovery message by its Auth link type, without displaying it.
    let message
    for(const entry of messages){const candidate=await(await fetch(mail+'/api/v1/message/'+entry.ID)).json();if((candidate.HTML??'').includes('type=recovery'))message=candidate}
    assert.ok(message,'Real local recovery email exists')
    const html=message.HTML??'',link=html.match(/href="([^"]+)"/)?.[1]?.replaceAll('&amp;','&')
    assert.ok(link,'Local invite link present')
    const inviteUrl=new URL(link);assert.equal(inviteUrl.origin,base);assert.equal(inviteUrl.pathname,'/auth/v1/verify')
    const redeemed=await fetch(inviteUrl,{redirect:'manual'}),location=redeemed.headers.get('location')
    assert.ok(location,'Invite redirect exists')
    const redirected=new URL(location);assert.equal(redirected.origin,'http://127.0.0.1:4175');assert.equal(redirected.pathname,'/onboarding.html')
    const fragment=new URLSearchParams(redirected.hash.slice(1));let customerAal1=fragment.get('access_token');assert.ok(customerAal1,'Invite creates customer session')
    await t.test('valid link session exists; used link rejected',async()=>{
      assert.equal((await request('/auth/v1/user',customerAal1,undefined,'GET')).status,200)
      const replay=await fetch(inviteUrl,{redirect:'manual'});assert.ok(new URL(replay.headers.get('location')).hash.includes('error'),'Used link rejected')
    })
    await t.test('pending AAL1 cannot activate/read tenant',async()=>{
      assert.equal((await rpc('security_v2_customer_onboarding_status',customerAal1)).data?.passwordRequired,true)
      assert.equal((await rpc('security_v2_accept_customer_invitation',customerAal1,{p_invitation:invitationId})).data?.error,'AAL2_REQUIRED')
      const rows=await request('/rest/v1/companies?select=id&id=eq.'+company,customerAal1,undefined,'GET');assert.equal(rows.data?.length,0)
    })
    const customerPassword='Local!onboarding-'+randomUUID()
    await t.test('first password set through Auth and real password sign-in',async()=>{
      assert.equal((await request('/auth/v1/user',customerAal1,{password:customerPassword},'PUT')).status,200)
      const signin=await request('/auth/v1/token?grant_type=password',null,{email:customerEmail,password:customerPassword});assert.equal(signin.status,200);customerAal1=signin.data.access_token
    })
    const customerAal2=await mfa(customerAal1,'Local onboarding customer',true)
    await t.test('verified AAL2 still has no tenant data before activation',async()=>{
      const rows=await request('/rest/v1/companies?select=id&id=eq.'+company,customerAal2,undefined,'GET');assert.equal(rows.data?.length,0)
      assert.equal(sql('select count(*) from auth.sessions where user_id='+quote(customerId)+" and aal='aal2'"),'1')
    })
    await t.test('customer cannot use admin invite or activate foreign invitation',async()=>{
      assert.equal((await invite(customerAal2)).status,403)
      assert.equal((await rpc('security_v2_accept_customer_invitation',customerAal2,{p_invitation:randomUUID()})).data?.error,'INVITATION_UNAVAILABLE')
      const denied=await request('/functions/v1/admin-create-company',customerAal2,{},'POST',{'Idempotency-Key':randomUUID(),Origin:'http://127.0.0.1:4175'})
      assert.equal(denied.status,403,'Customer denied existing platform-admin create function')
      assert.equal(sql('select count(*) from private.provisioning_operations where actor_user_id='+quote(customerId)),'0','Admin denial creates no provisioning operation')
    })
    await t.test('AAL2 activates bound editor membership atomically',async()=>{
      const result=await rpc('security_v2_accept_customer_invitation',customerAal2,{p_invitation:invitationId});assert.equal(result.data?.status,'active');assert.equal(result.data.companyId,company)
      assert.equal(sql('select role from public.company_memberships where user_id='+quote(customerId)),'editor')
    })
    await t.test('activation replay has one membership and one acceptance audit',async()=>{
      assert.equal((await rpc('security_v2_accept_customer_invitation',customerAal2,{p_invitation:invitationId})).data?.status,'active')
      assert.equal(sql('select count(*) from public.company_memberships where user_id='+quote(customerId)),'1')
      assert.equal(sql("select count(*) from public.audit_events where event_type='customer.invite_accept' and actor_user_id="+quote(customerId)),'1')
    })
    await t.test('own company accessible; foreign company/audit/admin inaccessible',async()=>{
      assert.equal((await request('/rest/v1/companies?select=id&id=eq.'+company,customerAal2,undefined,'GET')).data?.length,1)
      assert.equal((await request('/rest/v1/companies?select=id&id=eq.'+other,customerAal2,undefined,'GET')).data?.length,0)
      assert.equal((await request('/rest/v1/audit_events?select=id',customerAal2,undefined,'GET')).data?.length,0)
      assert.equal((await request('/rest/v1/platform_admins?select=user_id',customerAal2,undefined,'GET')).data?.length,0)
      assert.equal((await rpc('security_v2_accept_customer_invitation',customerAal1,{p_invitation:invitationId})).data?.error,'AAL2_REQUIRED')
    })
    await t.test('no website, publication, company key or personal key provisioned',async()=>{
      for(const table of ['websites','company_security'])assert.equal(sql('select count(*) from public.'+table+' where company_id='+quote(company)),'0')
      assert.equal(sql('select count(*) from public.user_security_credentials where user_id='+quote(customerId)),'0')
    })
  } finally {
    if(adminId){
      // Recover owned identity if the response was lost, without unscoped cleanup.
      const ids=sql('select u.id from auth.users u join private.customer_invitations i on (u.id=i.user_id or (u.raw_user_meta_data->>\'wreach_invitation_id\'=i.id::text and lower(u.email)=i.email and u.created_at>=i.created_at)) where i.invited_by='+quote(adminId)+' and i.company_id='+quote(company)).split('\n').filter(Boolean)
      const owned=[...new Set([adminId,customerId,...ids].filter(Boolean))]
      for(const id of owned)assert.match(id,/^[0-9a-f-]{36}$/)
      const list=owned.map(quote).join(',')
      sql('begin;delete from public.audit_events where actor_user_id in ('+list+') or company_id in ('+[company,other].map(quote).join(',')+');'+
        'delete from private.customer_invitation_deliveries where actor='+quote(adminId)+';'+
        'delete from private.customer_invitations where invited_by='+quote(adminId)+' and company_id='+quote(company)+';'+
        'delete from public.company_memberships where user_id in ('+list+');delete from public.platform_admins where user_id in ('+list+');delete from public.profiles where id in ('+list+');'+
        'delete from public.companies where id in ('+[company,other].map(quote).join(',')+');delete from auth.users where id in ('+list+');commit;')
      assert.equal(sql('select count(*) from auth.users where id in ('+list+')'),'0','Local fixture removed')
    }
    const mailIds=[...new Set((await Promise.all([adminEmail,customerEmail].map(mailbox))).flat().map(message=>message.ID))]
    // Mailpit interprets an empty list as delete-all: never send that request.
    if(mailIds.length){
      const removed=await fetch(mail+'/api/v1/messages',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({IDs:mailIds})})
      assert.equal(removed.status,200,'Only owned synthetic email removed')
    }
    assert.equal((await mailbox(customerEmail)).length,0,'Invitation mail removed')
  }
})
