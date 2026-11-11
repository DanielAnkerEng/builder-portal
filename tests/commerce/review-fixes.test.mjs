import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import Stripe from 'stripe';
import {createPilot} from '../../commerce/server.mjs';
import {requireOfflinePayments} from '../../commerce/config.mjs';
import {config, fixtures, service, check, signIn} from './local-support.mjs';
import {fakeStripe} from './fake-stripe.mjs';

test('standard test server rejects a connected configuration before constructing clients or sending requests',async t=>{
  let outgoing=0;
  const deny=()=>{outgoing++;throw Error('Unexpected request');};
  for(const transport of [http,https]) t.mock.method(transport,'request',deny);
  t.mock.method(globalThis,'fetch',deny);
  const connected={...config,stripe:{mode:'test'},get serviceKey(){throw Error('Client initialized too early');}};
  assert.throws(()=>requireOfflinePayments(connected),/SIMULATION_DISABLED/);
  await assert.rejects(createPilot(connected),/SIMULATION_DISABLED/);
  for(const mode of [undefined,'', 'live']) assert.throws(()=>requireOfflinePayments({stripe:{mode}}),/SIMULATION_DISABLED/);
  assert.equal(outgoing,0);
});

test('concurrent overlapping carts: resume, lost response, expiration, validated payment and replay',async()=>{
  const f=fixtures(),digital=f.products.find(p=>p.kind==='digital'),physical=f.products.find(p=>p.kind==='physical');
  const single=[{product_id:digital.id,quantity:1}],mixed=[...single,{product_id:physical.id,quantity:1}];
  const fake=fakeStripe(config), secret='whsec_'+randomUUID();
  const app=await createPilot({...config,stripe:{...config.stripe,accountId:'acct_simulated_fixture',webhookSecret:secret}},{portal:4321,shop:4322},{stripeClient:fake});
  const base='http://127.0.0.1:4322';
  const person={email:randomUUID()+'@test.invalid',password:'Pilot!'+randomUUID()};
  try {
    check(await service.auth.admin.createUser({...person,email_confirm:true}));
    const buyer=await signIn(person);
    const post=async(path,data,headers={})=>{
      const response=await fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Authorization:'Bearer '+buyer.token,...headers},body:JSON.stringify(data)});
      return {status:response.status,data:await response.json()};
    };
    const cart=items=>({request_key:randomUUID(),items});
    const notify=async(session,type,id='evt_'+randomUUID())=>{
      const event={id,type,livemode:false,data:{object:{id:session.id}}};
      const signature=Stripe.webhooks.generateTestHeaderString({payload:JSON.stringify(event),secret});
      return post('/api/stripe/webhook',event,{'stripe-signature':signature});
    };
    const a=cart(single),b=cart(mixed);
    fake.loseNextCreateResponse=true;
    const responses=await Promise.all([post('/api/checkout',a),post('/api/checkout',b)]);
    assert.deepEqual(responses.map(r=>r.status).sort(),[409,503]);
    const overlap=responses.find(r=>r.status===409).data;
    assert.equal(overlap.error,'OPEN_DIGITAL_ORDER');
    const accepted=responses[0].status===503?a:b, other=accepted===a?b:a;
    const resume=await post('/api/checkout',cart(accepted.items));
    assert.equal(resume.status,200);assert.equal(resume.data.order_id,overlap.order_id);
    assert.equal(fake.created.length,1);
    const session=fake.sessions.get('checkout:'+overlap.order_id);
    // Both the cancel return and a failure notification about a still-open session leave it reserved.
    const returnResponse=await fetch(base+'/api/orders/'+overlap.order_id+'?cancelled=1',{headers:{Authorization:'Bearer '+buyer.token}});
    assert.equal((await returnResponse.json()).status,'pending');
    assert.equal((await notify(session,'checkout.session.async_payment_failed')).status,200);
    assert.equal((await post('/api/checkout',other)).status,409);
    session.status='expired';
    assert.equal((await notify(session,'checkout.session.expired')).status,200);
    const fresh=await post('/api/checkout',other);
    assert.equal(fresh.status,200);assert.notEqual(fresh.data.order_id,overlap.order_id);
    const paid=fake.sessions.get('checkout:'+fresh.data.order_id);
    paid.status='complete';paid.payment_status='paid';
    const id='evt_'+randomUUID();
    for(const result of await Promise.all([notify(paid,'checkout.session.completed',id),notify(paid,'checkout.session.completed',id)])) assert.equal(result.status,200);
    assert.equal((await post('/api/checkout',cart(single))).data.error,'ALREADY_OWNED');
    const get=path=>fetch(base+path,{headers:{Authorization:'Bearer '+buyer.token}}).then(r=>r.json());
    assert.equal((await get('/api/library')).length,1);
    assert.deepEqual((await get('/api/orders/'+fresh.data.order_id)).active_game_products,[digital.name]);
    assert.deepEqual((await get('/api/orders/'+overlap.order_id)).active_game_products,[]);
    assert.equal(check(await service.from('commerce_payment_events').select('event_id').eq('event_id',id)).length,1);
    const orders=check(await buyer.client.from('commerce_orders').select('status'));
    assert.deepEqual(orders.map(o=>o.status).sort(),['expired','paid']);
    const admin=await signIn(f.admin,true);
    const adminStore=website=>fetch('http://127.0.0.1:4321/api/admin/store?website='+website,
      {headers:{Authorization:'Bearer '+admin.token}}).then(r=>r.json());
    assert.equal((await adminStore(f.otherStore.website_id)).shopUrl,null);
    const adminView=await adminStore(f.store.website_id);
    assert.equal(adminView.shopUrl,base);
    assert.deepEqual(adminView.orders.find(o=>o.id===fresh.data.order_id).active_game_products,[digital.name]);
    const [owned]=await get('/api/library');
    check(await service.from('commerce_entitlements').update({active:false}).eq('id',owned.id));
    assert.deepEqual((await get('/api/orders/'+fresh.data.order_id)).active_game_products,[]);
    const after=await adminStore(f.store.website_id);
    assert.deepEqual(after.orders.find(o=>o.id===fresh.data.order_id).active_game_products,[]);
  }finally{await app.close();}
});
