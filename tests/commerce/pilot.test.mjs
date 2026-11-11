import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { config,service,client,check,fixtures,signIn } from './local-support.mjs';
import { simulatedPayment } from './simulation.mjs';
import { createPilot } from '../../commerce/server.mjs';
import { checkoutParams,validateSession,fulfillStripeEvent } from '../../commerce/stripe.mjs';
import { validatePlayers } from '../../commerce/game.mjs';
const f=fixtures(),digital=f.products.find(p=>p.kind==='digital'),physical=f.products.find(p=>p.kind==='physical');
let runtime,admin,other,buyer,another,order;
const shop='http://127.0.0.1:4310',portal='http://127.0.0.1:4309';
async function http(path,{token,body,origin=shop,base=shop}={}){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json',Origin:origin}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
async function freshBuyer(){const person={email:'test-'+randomUUID()+'@test.invalid',password:'Pilot!a9-'+randomUUID()};person.id=check(await service.auth.admin.createUser({...person,email_confirm:true})).user.id;return signIn(person);}
function reserve(c,items,key=randomUUID(),store=f.store.id){return c.rpc('commerce_reserve_order',{p_store:store,p_key:key,p_cart:items});}
const cart=[{product_id:digital.id,quantity:1}];
test.before(async()=>{runtime=await createPilot(config,{portal:4309,shop:4310});admin=await signIn(f.admin,true);other=await signIn(f.otherEditor,true);buyer=await freshBuyer();another=await freshBuyer();});
test.after(async()=>{await runtime?.close();});

test('REAL LOCAL DB/Auth: customer -> website -> private draft -> products persists',async()=>{
 const s=check(await admin.client.from('commerce_stores').select('*').eq('id',f.store.id).single());assert.equal(s.company_id,f.company);
 const website=check(await admin.client.from('websites').select('*').eq('id',s.website_id).single());assert.equal(website.company_id,f.company);assert.equal(website.current_publication_id,null);
 const draft=check(await admin.client.from('website_drafts').select('content').eq('website_id',website.id).single());assert.equal(draft.content.businessName,'Bli Støgg');
 const companies=check(await admin.client.from('companies').select('name').eq('id',f.company));assert.equal(companies[0].name,'Bli Støgg');
 const products=check(await admin.client.from('commerce_products').select('*').eq('store_id',s.id));assert.equal(products.length,2);
});
test('REAL LOCAL RPC: company creation replays without website or membership side effects',async()=>{
 const key=randomUUID(),payload={schemaVersion:1,company:{name:'Syntetisk opprettelsestest '+key.slice(0,8)},contact:null,services:['website'],internal:{lifecycleStatus:'onboarding',assignments:[]}};
 const a=check(await admin.client.rpc('security_v2_create_company',{p_idempotency_key:key,p_payload:payload})),b=check(await admin.client.rpc('security_v2_create_company',{p_idempotency_key:key,p_payload:payload}));assert.equal(a.ok,true);assert.deepEqual(a,b);
 assert.equal(check(await service.from('websites').select('id').eq('company_id',a.companyId)).length,0);
 assert.equal(check(await admin.client.from('company_memberships').select('id').eq('company_id',a.companyId)).length,0);
});
test('REAL LOCAL Auth/AAL2/RLS: buyer and other company denied administration and writes',async()=>{
 assert.equal(check(await buyer.client.from('companies').select('id')).length,0);
 assert.equal(check(await buyer.client.from('commerce_products').select('id')).length,0);
 assert.equal(check(await other.client.from('commerce_stores').select('id').eq('id',f.store.id)).length,0);
 for(const identity of [buyer,other]){
  const r=await identity.client.rpc('commerce_save_product',{p_store:f.store.id,p_product:digital.id,p_revision:1,p_data:{}});assert.ok(r.error);
  assert.equal((await http('/api/admin/store?website='+f.store.website_id,{base:portal,token:identity.token})).status,403);
 }
 const aal1=await signIn(f.admin);assert.equal((await http('/api/admin/store?website='+f.store.website_id,{base:portal,token:aal1.token})).status,403);
 assert.ok((await buyer.client.from('commerce_entitlements').insert({buyer_id:buyer.user.id,product_id:digital.id,order_id:randomUUID()})).error);
});
test('REAL LOCAL DB: product updates persist; concurrent stale edit rejected',async()=>{
 const p=check(await admin.client.from('commerce_products').select('*').eq('id',digital.id).single());
 const data={name:p.name,description:p.description+' Testet lagring.',kind:p.kind,game_key:p.game_key,unit_amount:p.unit_amount,active:p.active};
 const updated=check(await admin.client.rpc('commerce_save_product',{p_store:p.store_id,p_product:p.id,p_revision:p.revision,p_data:data}));
 assert.equal(check(await admin.client.from('commerce_products').select('*').eq('id',p.id).single()).description,data.description);
 assert.ok((await admin.client.rpc('commerce_save_product',{p_store:p.store_id,p_product:p.id,p_revision:p.revision,p_data:data})).error);
 check(await admin.client.rpc('commerce_save_product',{p_store:p.store_id,p_product:p.id,p_revision:updated.revision,p_data:{...data,description:p.description}}));
});
test('REAL LOCAL RPC: manipulated price, quantity, product and company rejected',async()=>{
 for(const items of [[{...cart[0],unit_amount:1}],[{...cart[0],company_id:f.otherCompany}],[{...cart[0],quantity:-1}],[{...cart[0],quantity:1.5}],[{...cart[0],quantity:'1'}],[{...cart[0],quantity:2}],[{product_id:randomUUID(),quantity:1}],[{product_id:f.otherProduct.id,quantity:1}],[cart[0],cart[0]],[]])assert.ok((await reserve(buyer.client,items)).error,JSON.stringify(items));
 assert.equal((await http('/api/checkout',{token:buyer.token,body:{request_key:randomUUID(),items:cart,company_id:f.otherCompany}})).status,400);
});
test('REAL LOCAL DB: prices use integer øre and order snapshots survive later product edits',async()=>{
 const p=check(await admin.client.from('commerce_products').select('*').eq('id',physical.id).single());const data={name:p.name,description:p.description,kind:p.kind,game_key:p.game_key,unit_amount:p.unit_amount+123,active:p.active};
 const updated=check(await admin.client.rpc('commerce_save_product',{p_store:p.store_id,p_product:p.id,p_revision:p.revision,p_data:data}));
 const purchaser=await freshBuyer(),snapshot=check(await reserve(purchaser.client,[{product_id:p.id,quantity:2}]));assert.equal(snapshot.total,(p.unit_amount+123)*2);
 check(await admin.client.rpc('commerce_save_product',{p_store:p.store_id,p_product:p.id,p_revision:updated.revision,p_data:{...data,unit_amount:p.unit_amount}}));
 const line=check(await purchaser.client.from('commerce_order_items').select('*').eq('order_id',snapshot.id).single());assert.equal(line.unit_amount,p.unit_amount+123);
});
test('REAL LOCAL concurrency: duplicate click / replay creates one durable order',async()=>{
 const key=randomUUID(),results=await Promise.all(Array.from({length:5},()=>reserve(buyer.client,cart,key)));const orders=results.map(check);assert.equal(new Set(orders.map(o=>o.id)).size,1);order=orders[0];assert.equal(order.total,digital.unit_amount);
 const again=check(await reserve(buyer.client,cart));assert.equal(again.id,order.id);
 assert.ok((await reserve(buyer.client,[{product_id:physical.id,quantity:1}],key)).error);
 assert.equal(check(await service.from('commerce_orders').select('id').eq('buyer_id',buyer.user.id)).length,1);
});
test('REAL LOCAL HTTP: return URL/cancellation cannot prove payment; buyer isolation',async()=>{
 const mine=await http('/api/orders/'+order.id+'?paid=true&cancelled=1',{token:buyer.token});assert.equal(mine.data.status,'pending');
 assert.equal((await http('/api/orders/'+order.id,{token:another.token})).status,404);
 assert.equal((await http('/api/orders/'+order.id)).status,401);
 assert.equal(check(await another.client.from('commerce_orders').select('id').eq('id',order.id)).length,0);
 assert.equal((await http('/api/library',{token:buyer.token})).data.length,0);
 assert.equal((await http('/api/checkout',{token:buyer.token,body:{request_key:randomUUID(),items:cart}})).status,503);
});
test('STRIPE SDK LOCAL: signed raw event accepted; tampered, missing and stale signatures rejected',()=>{
 const payload=JSON.stringify({id:'evt_fixture',livemode:false}),secret='whsec_'+randomUUID(),header=Stripe.webhooks.generateTestHeaderString({payload,secret});
 assert.equal(Stripe.webhooks.constructEvent(payload,header,secret).id,'evt_fixture');
 assert.throws(()=>Stripe.webhooks.constructEvent(payload+' ',header,secret));assert.throws(()=>Stripe.webhooks.constructEvent(payload,'',secret));
 const old=Stripe.webhooks.generateTestHeaderString({payload,secret,timestamp:Math.floor(Date.now()/1000)-600});assert.throws(()=>Stripe.webhooks.constructEvent(payload,old,secret));
});
test('SIMULATED Stripe response + REAL DB: unpaid completion stays pending; delayed payment grants without return visit',async()=>{
 await simulatedPayment(order,{status:'pending'});assert.equal(check(await service.from('commerce_entitlements').select('id').eq('buyer_id',buyer.user.id)).length,0);
 const {eventId,session,items}=await simulatedPayment(order,{eventType:'checkout.session.async_payment_succeeded'});
 assert.equal(check(await service.from('commerce_orders').select('status').eq('id',order.id).single()).status,'paid');
 assert.equal(check(await service.from('commerce_entitlements').select('id').eq('buyer_id',buyer.user.id)).length,1);
 await Promise.all([simulatedPayment(order,{eventId}),simulatedPayment(order,{eventId}),simulatedPayment(order,{status:'failed'})]);
 assert.equal(check(await service.from('commerce_entitlements').select('id').eq('buyer_id',buyer.user.id)).length,1);
 assert.equal(check(await service.from('commerce_orders').select('status').eq('id',order.id).single()).status,'paid');
 for(const bad of [{...session,livemode:true},{...session,amount_total:1},{...session,currency:'usd'},{...session,metadata:{...session.metadata,company_id:f.otherCompany}},{...session,line_items:{...session.line_items,has_more:true}}])assert.throws(()=>validateSession(bad,order,items));
 await assert.rejects(()=>fulfillStripeEvent({stripe:{},service,event:{livemode:true}}));
 const params=checkoutParams(order,items,shop,[{price:'price_fixture',quantity:1}]);assert.equal(params.line_items[0].price,'price_fixture');assert.equal(params.mode,'payment');
});
test('SIMULATED failure/expiry + REAL DB: no entitlement; physical payment never grants digital access',async()=>{
 const o=check(await reserve(another.client,cart));await simulatedPayment(o,{status:'failed'});assert.equal((await http('/api/library',{token:another.token})).data.length,0);
 const expired=check(await reserve(another.client,[{product_id:physical.id,quantity:1}]));await simulatedPayment(expired,{status:'expired'});assert.equal(check(await service.from('commerce_orders').select('status').eq('id',expired.id).single()).status,'expired');
 const physicalOrder=check(await reserve(another.client,[{product_id:physical.id,quantity:2}]));await simulatedPayment(physicalOrder);
 assert.equal(check(await service.from('commerce_orders').select('fulfillment').eq('id',physicalOrder.id).single()).fulfillment,'test_only_not_shipped');
 assert.equal((await http('/api/library',{token:another.token})).data.length,0);
});
test('REAL LOCAL HTTP/DB: full game, skip, reload, concurrent next, finish and new round; content protected',async()=>{
 const library=(await http('/api/library',{token:buyer.token})).data;assert.equal(library.length,1);
 const start=await http('/api/game',{token:buyer.token,body:{entitlement_id:library[0].id,players:['Alex','Sam']}});assert.equal(start.status,200);let g=start.data;
 assert.equal((await http('/api/game/'+g.id,{token:another.token})).status,404);
 assert.equal((await http('/api/game/'+g.id)).status,401);
 assert.equal((await http('/api/game',{token:another.token,body:{entitlement_id:library[0].id,players:['Alex','Sam']}})).status,403);
 assert.ok((await buyer.client.from('commerce_game_sessions').select('*')).error);
 const double=await Promise.all([http('/api/game/'+g.id,{token:buyer.token,body:{version:g.version,action:'skip'}}),http('/api/game/'+g.id,{token:buyer.token,body:{version:g.version,action:'next'}})]);assert.deepEqual(double.map(r=>r.status).sort(),[200,409]);
 g=(await http('/api/game/'+g.id,{token:buyer.token})).data;assert.equal(g.position,1);
 while(!g.complete){const r=await http('/api/game/'+g.id,{token:buyer.token,body:{version:g.version,action:'next'}});assert.equal(r.status,200);g=r.data;}
 assert.equal(g.position,12);assert.equal(g.card,null);
 const next=await http('/api/game',{token:buyer.token,body:{entitlement_id:library[0].id,players:['Alex','Sam']}});assert.notEqual(next.data.id,g.id);
 const ended=await http('/api/game/'+next.data.id,{token:buyer.token,body:{version:next.data.version,action:'end'}});assert.equal(ended.data.endedEarly,true);assert.equal(ended.data.complete,true);
 assert.equal((await http('/api/game/'+next.data.id,{token:buyer.token,body:{version:ended.data.version,action:'next'}})).status,409);
 assert.throws(()=>validatePlayers(['Alex','Alex']));assert.throws(()=>validatePlayers(['<script>','Sam']));
});
test('REAL LOCAL HTTP: no source/secrets exposed; cross-origin mutation and forged identity denied',async()=>{
 for(const path of ['/commerce/game.mjs','/../private/runtime.json','/game.mjs','/.git/config','/api/admin/store?website='+f.store.website_id])assert.equal((await fetch(shop+path,{headers:{Authorization:'Bearer '+buyer.token}})).status,404);
 assert.equal((await http('/api/game',{token:buyer.token,origin:'https://evil.invalid',body:{}})).status,403);
 const parts=buyer.token.split('.'),claims=JSON.parse(Buffer.from(parts[1],'base64url'));claims.aal='aal2';claims.sub=f.admin.id;parts[1]=Buffer.from(JSON.stringify(claims)).toString('base64url');
 assert.equal((await http('/api/orders',{token:parts.join('.')})).status,401);
 assert.equal(check(await admin.client.from('company_memberships').select('id').eq('user_id',buyer.user.id)).length,0);
 assert.equal(check(await admin.client.from('profiles').select('id').eq('id',buyer.user.id)).length,0);
});
