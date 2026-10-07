// Run explicitly: WREACH_ISOLATED_MEMBERSHIP_TESTS=1 node --test this-file.
// Real local Auth + PostgREST; no Edge/Kong/browser/email/hosted claim.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {randomUUID,randomBytes,createHmac} from 'node:crypto'
import {isolatedSupabase,quote,waitUntil} from './helpers/isolated-supabase.mjs'

const root=new URL('../../',import.meta.url)
const hardening='20261007180000_membership_write_permissions.sql'
const activation='public.security_v2_accept_customer_invitation(uuid)'
const claims=id=>JSON.stringify({sub:id,role:'authenticated',aal:'aal2',amr:[{method:'password'},{method:'totp'}]})
test('representative isolated Supabase: migration, full pgTAP, Auth/API and activation pause',
  {skip:process.env.WREACH_ISOLATED_MEMBERSHIP_TESTS!=='1',timeout:300000},async t=>{
  const env=isolatedSupabase(),{sql,sqlResult,request,protect}=env
  const source=readFileSync(new URL('supabase/migrations/'+hardening,root),'utf8')
  const body=source.replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'')
  const rpc=(name,token,payload={})=>request(3000,'/rpc/'+name,token,payload)
  const acl=()=>sql(`select proacl::text from pg_proc where oid=${quote(activation)}::regprocedure`)
  const status=f=>sql(`select status from public.company_memberships where user_id=${quote(f.id)}`)
  const audits=f=>Number(sql(`select count(*) from public.audit_events where event_type='customer.invite_accept' and actor_user_id=${quote(f.id)}`))
  const accept=f=>rpc('security_v2_accept_customer_invitation',f.aal2,{p_invitation:f.invitation})
  const footprint=()=>sql("select jsonb_build_object('memberships',(select jsonb_agg(to_jsonb(m) order by id) from public.company_memberships m),'invitations',(select jsonb_agg(to_jsonb(i) order by id) from private.customer_invitations i),'audit',(select jsonb_agg(to_jsonb(a) order by id) from public.audit_events a))")
  const catalog=()=>sql(`select jsonb_build_object(
    'tables',(select jsonb_agg(jsonb_build_object('oid',c.oid,'owner',relowner,'acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity) order by c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.oid<>'public.company_memberships'::regclass),
    'functions',(select jsonb_agg(jsonb_build_object('oid',p.oid,'owner',proowner,'acl',proacl,'definition',md5(prosrc)) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')),
    'roles',(select jsonb_agg(jsonb_build_object('oid',oid,'name',rolname,'super',rolsuper,'inherit',rolinherit,'bypass',rolbypassrls) order by oid) from pg_roles),
    'edges',(select jsonb_agg(to_jsonb(m) order by roleid,member) from pg_auth_members m),
    'defaults',(select jsonb_agg(to_jsonb(d) order by oid) from pg_default_acl d),
    'policies',(select jsonb_agg(to_jsonb(p) order by oid) from pg_policy p))`)
  const tableAcl=()=>sql("select relacl::text from pg_class where oid='public.company_memberships'::regclass")
  let pgPass=0
  try{
    await env.start()
    console.info('BOOTSTRAP ACL '+sql("select jsonb_agg(jsonb_build_object('creator',pg_get_userbyid(defaclrole),'type',defaclobjtype,'acl',defaclacl)) from pg_default_acl where defaclnamespace='public'::regnamespace"))
    console.info('BOOTSTRAP ROLE EDGES '+sql("select jsonb_agg(jsonb_build_object('role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'inherit',inherit_option,'set',set_option)) from pg_auth_members where member in ('service_role'::regrole,'authenticated'::regrole,'anon'::regrole,'authenticator'::regrole,'postgres'::regrole)"))
    const migrations=readdirSync(new URL('supabase/migrations/',root)).filter(f=>f.endsWith('.sql')).sort()
    assert.equal(migrations.at(-1),hardening,'Hardening must be last for this regression scenario')
    for(const file of migrations.filter(f=>f!==hardening))sql(readFileSync(new URL('supabase/migrations/'+file,root),'utf8'),'postgres')
    await t.test('stock defaults reproduce broad service writes before hardening; empty Auth/admin baseline',()=>{
      assert.equal(sql("select (select count(*) from auth.users)+(select count(*) from public.profiles)+(select count(*) from public.platform_admins)"),'0')
      assert.equal(sql("select pg_get_userbyid(relowner) from pg_class where oid='public.company_memberships'::regclass"),'postgres')
      for(const p of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'])
        assert.equal(sql(`select has_table_privilege('service_role','public.company_memberships',${quote(p)})`),'t')
      console.info('PRE-HARDENING TABLE ACL '+tableAcl())
    })
    // Mutations below are only deliberate drift fixtures inside this fresh DB.
    // Every failed migration transaction rolls back the grants/roles as well.
    const before=catalog(),beforeAcl=tableAcl()
    for(const [name,drift,diagnostic,fixtureRole='postgres'] of [
      ['PUBLIC grant','grant update on public.company_memberships to public;','ALTERNATIVE_TABLE_GRANT'],
      ['direct column grant','grant update(status) on public.company_memberships to service_role;','ALTERNATIVE_COLUMN_GRANT'],
      ['PUBLIC column grant','grant insert(user_id) on public.company_memberships to public;','ALTERNATIVE_COLUMN_GRANT'],
      ['inherited table grant','create role synthetic_acl_parent;grant update on public.company_memberships to synthetic_acl_parent;grant synthetic_acl_parent to service_role;','ALTERNATIVE_TABLE_GRANT'],
      ['SET ROLE non-inherited grant','create role synthetic_acl_parent;grant delete on public.company_memberships to synthetic_acl_parent;grant synthetic_acl_parent to service_role with inherit false, set true;','ALTERNATIVE_TABLE_GRANT'],
      ['built-in global writer','grant pg_write_all_data to service_role;','ALTERNATIVE_TABLE_GRANT','supabase_admin'],
      ['SET ROLE built-in global writer','grant pg_write_all_data to service_role with inherit false, set true;','ALTERNATIVE_TABLE_GRANT','supabase_admin'],
      ['inherited column grant','create role synthetic_acl_parent;grant update(status) on public.company_memberships to synthetic_acl_parent;grant synthetic_acl_parent to service_role;','ALTERNATIVE_COLUMN_GRANT'],
      ['missing SELECT','revoke select on public.company_memberships from service_role;','UNEXPECTED_BASELINE']
    ])await t.test('migration rejects '+name+' without repairing global roles',()=>{
      // Only the isolated superuser can install built-in-role drift fixtures.
      // The migration itself always runs as the real object creator, postgres.
      const r=sqlResult('begin;'+drift+'set local role postgres;'+body+'rollback;',fixtureRole)
      assert.notEqual(r.code,0);assert.ok(r.err.includes('42501')&&r.err.includes('MEMBERSHIP_ACL_'+diagnostic),'Expected migration diagnostic; received: '+r.err)
      assert.equal(tableAcl(),beforeAcl);assert.equal(catalog(),before)
    })
    await t.test('hardening removes only four grants and preserves functions/RLS/roles/defaults/other tables',()=>{
      sql(source,'postgres');console.info('POST-HARDENING TABLE ACL '+tableAcl())
      for(const p of ['INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal(sql(`select has_table_privilege('service_role','public.company_memberships',${quote(p)})`),'f')
      for(const p of ['INSERT','UPDATE'])assert.equal(sql(`select has_any_column_privilege('service_role','public.company_memberships',${quote(p)})`),'f')
      for(const p of ['SELECT','REFERENCES','TRIGGER','MAINTAIN'])assert.equal(sql(`select has_table_privilege('service_role','public.company_memberships',${quote(p)})`),'t')
      assert.equal(catalog(),before)
      const hardened=tableAcl();sql(source,'postgres');assert.equal(tableAcl(),hardened,'Repeat is idempotent')
    })
    for(const file of readdirSync(new URL('supabase/tests/',root)).filter(f=>f.endsWith('.sql')).sort())await t.test('unchanged/full pgTAP: '+file,()=>{
      const out=sql(readFileSync(new URL('supabase/tests/'+file,root),'utf8'),'postgres')
      const plan=out.match(/^1\.\.(\d+)\s*$/m),pass=(out.match(/^ok \d+\b/gm)||[]).length,failed=(out.match(/^not ok.*$/gm)||[])
      if(failed.length)console.info(out.split('\n').filter(line=>/^(not ok|#)/.test(line)).join('\n'))
      assert.ok(plan&&pass===Number(plan[1])&&failed.length===0&&!/^Bail out!/m.test(out),'pgTAP plan and all assertions must pass')
      pgPass+=pass;console.info('PGTAP '+file+': '+pass+' PASS / 0 FAIL')
    })
    assert.equal(sql('select (select count(*) from auth.users)+(select count(*) from public.platform_admins)'),'0')
    await env.startRest()
    function totp(seed){
      const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=''
      for(const c of seed.toUpperCase().replace(/=+$/,'')){const n=alphabet.indexOf(c);if(n<0)throw new Error('Invalid synthetic factor encoding');bits+=n.toString(2).padStart(5,'0')}
      const key=Buffer.from(Array.from({length:Math.floor(bits.length/8)},(_,i)=>parseInt(bits.slice(i*8,i*8+8),2))),counter=Buffer.alloc(8)
      counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)))
      const h=createHmac('sha1',key).update(counter).digest(),o=h[h.length-1]&15
      return protect(String((h.readUInt32BE(o)&0x7fffffff)%1000000).padStart(6,'0'))
    }
    async function identity(label,email=label+'-'+randomUUID()+'@fixture.invalid',invitation){
      const password=protect('Synthetic!'+randomBytes(24).toString('hex'))
      const created=request(9999,'/admin/users',env.serviceToken,{email,password,email_confirm:true,user_metadata:invitation?{wreach_invitation_id:invitation}:{}})
      assert.ok(created.status===200&&!!created.data?.id,'Synthetic identity creation; no email')
      const id=created.data.id
      // No invitation email: synthetic binding setup, not callback/E2E proof.
      if(invitation)sql(`update auth.users set invited_at=now() where id=${quote(id)} and raw_user_meta_data->>'wreach_invitation_id'=${quote(invitation)}`)
      const login=request(9999,'/token?grant_type=password',undefined,{email,password})
      assert.ok(login.status===200&&!!login.data?.access_token,'Real password authentication')
      const aal1=protect(login.data.access_token)
      const factor=request(9999,'/factors',aal1,{factor_type:'totp',friendly_name:'Synthetic isolated factor'})
      assert.ok(factor.status===200&&!!factor.data?.totp?.secret,'Real local TOTP enrollment')
      const seed=protect(factor.data.totp.secret)
      const challenge=request(9999,'/factors/'+factor.data.id+'/challenge',aal1,{})
      assert.ok(challenge.status===200&&!!challenge.data?.id,'Real local TOTP challenge')
      const verified=request(9999,'/factors/'+factor.data.id+'/verify',aal1,{challenge_id:challenge.data.id,code:totp(seed)})
      assert.ok(verified.status===200&&!!verified.data?.access_token,'Real local TOTP verify')
      const aal2=protect(verified.data.access_token)
      assert.equal(JSON.parse(Buffer.from(aal1.split('.')[1],'base64url')).aal,'aal1')
      assert.equal(JSON.parse(Buffer.from(aal2.split('.')[1],'base64url')).aal,'aal2')
      assert.equal(request(9999,'/user',aal2).status,200,'Auth accepts signed session')
      return {id,aal1,aal2,invitation}
    }
    const admin=await identity('admin'),company=randomUUID(),other=randomUUID()
    sql(`insert into public.profiles(id,display_name,status) values(${quote(admin.id)},'Synthetic isolated admin','active');insert into public.platform_admins(user_id,admin_role) values(${quote(admin.id)},'admin');insert into public.companies(id,name) values(${quote(company)},'Synthetic own'),(${quote(other)},'Synthetic other');`)
    async function fixture(label){
      const email=label+'-'+randomUUID()+'@fixture.invalid'
      const plan=rpc('security_v2_prepare_customer_invite',admin.aal2,{p_request_id:randomUUID(),p_company:company,p_email:email,p_display_name:'Synthetic '+label,p_role:'editor'})
      assert.ok(plan.status===200&&plan.data?.ok===true,'Real admin AAL2 reservation')
      const f=await identity(label,email,plan.data.invitationId)
      const final=rpc('security_v2_finalize_customer_invite',env.serviceToken,{p_invitation:f.invitation})
      assert.ok(final.status===200&&final.data?.status==='invited'&&status(f)==='invited','Real service RPC finalizes pending without table INSERT')
      return f
    }
    const beforeUser=await fixture('before'),under=await fixture('under'),after=await fixture('after'),recovery=await fixture('recovery'),flight=await fixture('inflight')
    await t.test('real Auth/API: AAL1, anon, invalid JWT, wrong actor and service activation denied',()=>{
      const before=footprint()
      assert.equal(rpc('security_v2_accept_customer_invitation',under.aal1,{p_invitation:under.invitation}).data?.error,'AAL2_REQUIRED')
      assert.equal(rpc('security_v2_accept_customer_invitation',beforeUser.aal2,{p_invitation:under.invitation}).data?.error,'INVITATION_UNAVAILABLE')
      for(const token of [undefined,env.serviceToken])assert.equal(rpc('security_v2_accept_customer_invitation',token,{p_invitation:under.invitation}).data?.code,'42501')
      assert.equal(request(3000,'/companies?select=id','synthetic.invalid.signature').status,401)
      assert.equal(footprint(),before)
    })
    await t.test('real API: service INSERT/UPDATE/DELETE denied without changes',()=>{
      const before=footprint(),path='/company_memberships?user_id=eq.'+under.id
      const insert={company_id:company,user_id:under.id,role:'owner',status:'active'}
      for(const [target,body,method] of [['/company_memberships',insert,'POST'],[path,{status:'active'},'PATCH'],[path,undefined,'DELETE']]){
        const r=request(3000,target,env.serviceToken,body,method)
        assert.equal(r.status,403);assert.equal(r.data?.code,'42501')
      }
      // SQL pgTAP separately exercises ON CONFLICT UPDATE and TRUNCATE.
      assert.equal(footprint(),before)
    })
    await t.test('real Auth/API: authorized activation and replay create one membership/audit',()=>{
      assert.equal(accept(beforeUser).data?.status,'active');assert.equal(accept(beforeUser).data?.status,'active')
      assert.equal(status(beforeUser),'active');assert.equal(audits(beforeUser),1)
    })
    await t.test('real API: recovery, revoked old generation, bound identity/role and reactivation',()=>{
      const revoke=rpc('security_v2_revoke_customer_invitation',admin.aal2,{p_invitation:recovery.invitation})
      assert.equal(revoke.data?.status,'revoked');assert.equal(status(recovery),'removed')
      assert.equal(accept(recovery).data?.error,'INVITATION_UNAVAILABLE')
      const key=randomUUID(),args={p_request:key,p_invitation:recovery.invitation,p_company:company}
      assert.equal(rpc('security_v2_prepare_invitation_recovery',admin.aal1,args).data?.error,'NOT_AUTHORIZED')
      assert.equal(rpc('security_v2_prepare_invitation_recovery',admin.aal2,{...args,p_company:other}).data?.error,'INVITATION_NOT_FOUND')
      const plan=rpc('security_v2_prepare_invitation_recovery',admin.aal2,args)
      assert.ok(plan.data?.ok===true,'Authorized recovery plan')
      assert.equal(rpc('security_v2_prepare_invitation_recovery',admin.aal2,args).data?.invitationId,plan.data.invitationId)
      const result=rpc('security_v2_finalize_customer_invite',env.serviceToken,{p_invitation:plan.data.invitationId})
      assert.equal(result.data?.status,'invited');assert.equal(status(recovery),'invited')
      recovery.invitation=plan.data.invitationId
      assert.equal(accept(recovery).data?.status,'active')
      assert.equal(sql(`select count(*) from public.company_memberships where user_id=${quote(recovery.id)}`),'1')
      assert.equal(sql(`select role from public.company_memberships where user_id=${quote(recovery.id)}`),'editor')
      assert.equal(audits(recovery),1)
    })
    const originalAcl=acl()
    await t.test('pause: new/direct/prepared calls denied; active tenant read preserved',async()=>{
      const warm=env.connection();warm.write(`set role authenticated;set request.jwt.claims=${quote(claims(beforeUser.id))};prepare activation(uuid) as select public.security_v2_accept_customer_invitation($1);execute activation(${quote(beforeUser.invitation)});\n\\echo WARM_READY`)
      await waitUntil(()=>warm.output().includes('WARM_READY'),'prepared statement')
      sql(`begin;revoke execute on function ${activation} from authenticated;commit;`,'postgres')
      const before=footprint()
      const r=accept(under);assert.equal(r.status,403);assert.equal(r.data?.code,'42501')
      const direct=sqlResult(`begin;set local role authenticated;set local request.jwt.claims=${quote(claims(under.id))};select public.security_v2_accept_customer_invitation(${quote(under.invitation)});rollback;`)
      assert.ok(direct.code!==0&&direct.err.includes('42501'))
      warm.write(`execute activation(${quote(beforeUser.invitation)});`);warm.end()
      const prepared=await warm.completed;assert.ok(prepared.code!==0&&prepared.err.includes('42501'))
      for(const token of [under.aal1,undefined,beforeUser.aal2])assert.equal(rpc('security_v2_accept_customer_invitation',token,{p_invitation:under.invitation}).data?.code,'42501')
      const rows=request(3000,'/companies?select=id',beforeUser.aal2)
      assert.ok(rows.status===200&&rows.data?.length===1&&rows.data[0].id===company,'Active own-company read only')
      assert.equal(request(3000,'/audit_events?select=id',beforeUser.aal2).data?.length,0)
      assert.equal(request(3000,'/companies?select=id',under.aal2).data?.length,0)
      assert.equal(footprint(),before);assert.equal(audits(under),0)
    })
    await t.test('resume: exact original ACL and separate authorized activation',()=>{
      sql(`begin;grant execute on function ${activation} to authenticated;commit;`,'postgres')
      assert.equal(acl(),originalAcl);assert.equal(accept(after).data?.status,'active');assert.equal(audits(after),1)
      assert.equal(status(under),'invited');assert.equal(audits(under),0)
    })
    await t.test('SQL concurrency: already-entered activation can complete after committed pause',async()=>{
      const holder=env.connection();holder.write(`begin;select id from private.customer_invitations where id=${quote(flight.invitation)} for update;\n\\echo HELD`)
      await waitUntil(()=>holder.output().includes('HELD'),'held row')
      const running=env.connection();running.write(`begin;set application_name='isolated_membership_inflight';set local statement_timeout='60s';set local role authenticated;set local request.jwt.claims=${quote(claims(flight.id))};select public.security_v2_accept_customer_invitation(${quote(flight.invitation)});commit;`);running.end()
      await waitUntil(()=>sql("select count(*) from pg_stat_activity where application_name='isolated_membership_inflight' and wait_event_type='Lock'")==='1','activation waiting on transactionid lock')
      const oldTx=env.connection();oldTx.write(`begin;set local role authenticated;set local request.jwt.claims=${quote(claims(under.id))};\n\\echo READY`)
      await waitUntil(()=>oldTx.output().includes('READY'),'transaction predating pause')
      const start=Date.now();sql(`begin;set local lock_timeout='1500ms';revoke execute on function ${activation} from authenticated;commit;`,'postgres')
      console.info('CONCURRENCY: REVOKE committed in '+(Date.now()-start)+'ms while prior activation waited on transactionid row lock')
      const before=footprint();assert.equal(accept(under).status,403)
      oldTx.write(`select public.security_v2_accept_customer_invitation(${quote(under.invitation)});commit;`);oldTx.end()
      const old=await oldTx.completed;assert.ok(old.code!==0&&old.err.includes('42501'))
      assert.equal(footprint(),before)
      holder.write('commit;');holder.end();assert.equal((await holder.completed).code,0)
      const result=await running.completed;assert.ok(result.code===0&&result.out.includes('"status": "active"'),'In-flight activation may commit after REVOKE')
      assert.equal(status(flight),'active');assert.equal(audits(flight),1);assert.equal(status(under),'invited');assert.equal(audits(under),0)
      sql(`begin;grant execute on function ${activation} to authenticated;commit;`,'postgres');assert.equal(acl(),originalAcl)
    })
    console.info('FULL PGTAP TOTAL '+pgPass+' PASS; real local Auth/API scenarios completed; no Edge/gateway/email/browser claim')
  }finally{await env.cleanup()}
})
