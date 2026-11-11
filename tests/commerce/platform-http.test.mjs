// Read-only requests and deliberately unauthorized POSTs; no sign-in/session or RPC writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {localPlatformResponse} from '../../commerce/local-platform.mjs';
import {loadConfig,requireOfflinePayments} from '../../commerce/config.mjs';
import http from 'node:http';
const enabled=process.env.BLI_STOGG_PLATFORM_HTTP_TESTS==='1',portal='http://127.0.0.1:4307',shop='http://127.0.0.1:4308';

if (enabled) requireOfflinePayments(loadConfig());

test('live local portal serves exact SDK/port overlays and preserves HTTP security headers',{skip:!enabled},async()=>{
 for(const file of ['js/supabase.js','js/supabase.local.js']){
  const r=await fetch(portal+'/'+file);assert.equal(r.status,200);
  assert.equal(await r.text(),localPlatformResponse('/'+file,await readFile(new URL('../../'+file,import.meta.url))).toString());
  assert.equal(r.headers.get('x-frame-options'),'DENY');assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  assert.match(r.headers.get('content-security-policy'),/script-src 'self'/);
 }
 const sdk=await fetch(portal+'/commerce-vendor/supabase.js');assert.equal(sdk.status,200);
 assert.deepEqual(Buffer.from(await sdk.arrayBuffer()),await readFile(new URL('../../commerce/public/vendor/supabase.js',import.meta.url)));
 for(const path of ['/js/supabase.js','/commerce-vendor/supabase.js','/commerce-admin.html'])assert.equal((await fetch(shop+path)).status,404);
 const wrongHost=await new Promise((resolve,reject)=>{const r=http.get(portal+'/js/supabase.js',{headers:{Host:'unapproved.invalid'}},res=>{res.resume();resolve(res.statusCode)});r.on('error',reject)});
 assert.equal(wrongHost,403);
});
test('live admin API denies missing and forged identity independently of website link',{skip:!enabled},async()=>{
 const path='/api/admin/store?website=00000000-0000-4000-8000-000000000000';
 assert.equal((await fetch(portal+path)).status,401);
 assert.equal((await fetch(portal+path,{headers:{Authorization:'Bearer e30.eyJzdWIiOiJmYWtlIiwiYWFsIjoiYWFsMiJ9.invalid'}})).status,401);
 const r=await fetch(portal+'/api/admin/product',{method:'POST',headers:{Origin:'https://unapproved.invalid','Content-Type':'application/json'},body:'{}'});
 assert.equal(r.status,403);assert.equal((await r.json()).error,'ORIGIN_REJECTED');
});
test('live pilot Edge: allowed local origin still denies anonymous token; wrong origin denied before authorization',{skip:!enabled},async()=>{
 const config=loadConfig();assert.equal(config.stripe.mode,'disabled');
 for(const [origin,status,code] of [[portal,401,'UNAUTHENTICATED'],[shop,403,'NOT_AUTHORIZED'],['http://localhost:4307',403,'NOT_AUTHORIZED'],['https://unapproved.invalid',403,'NOT_AUTHORIZED']]){
  const r=await fetch(config.supabaseUrl+'/functions/v1/admin-create-company',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+config.anonKey,apikey:config.anonKey,'Content-Type':'application/json'},body:'{}'});
  const data=await r.json();assert.equal(r.status,status,JSON.stringify({origin,data}));assert.equal(data.error?.code,code);
 }
});
