import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { config,fixtures,signIn,check } from './local-support.mjs';
test('REAL LOCAL Edge/Auth/RPC: admin-create-company accepts pilot origin and rejects buyer/AAL1',async()=>{
 const f=fixtures(),admin=await signIn(f.admin,true),buyer=await signIn(f.buyer),aal1=await signIn(f.admin);
 const key=randomUUID(),payload={schemaVersion:1,company:{name:'Syntetisk Edge-test '+key.slice(0,8)},contact:null,services:['website'],internal:{lifecycleStatus:'onboarding',assignments:[]}};
 const call=async(token,origin='http://127.0.0.1:4307')=>{const r=await fetch(config.supabaseUrl+'/functions/v1/admin-create-company',{method:'POST',headers:{Authorization:'Bearer '+token,apikey:config.anonKey,Origin:origin,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(payload)});return {status:r.status,body:await r.json(),origin:r.headers.get('access-control-allow-origin')};};
 assert.equal((await call(buyer.token)).status,403);assert.equal((await call(aal1.token)).status,403);
 const r=await call(admin.token);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.ok,true);
 // The local Supabase Kong gateway overwrites ACAO with '*'. The function's
 // exact Origin allowlist is exercised by the rejection below; no cookie auth is used.
 assert.equal((await call(admin.token)).body.companyId,r.body.companyId);
 assert.equal((await call(admin.token,'https://unapproved.invalid')).status,403);
 assert.equal(check(await admin.client.from('websites').select('id').eq('company_id',r.body.companyId)).length,0);
});
