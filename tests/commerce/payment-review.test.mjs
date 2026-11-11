import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {loadConfig,validateConfig,requireSimulation} from '../../commerce/config.mjs';
import {checkoutLines,verifyStripeAccount,checkoutParams,retrieveSession,validateSession,validatePaymentIntent,fulfillStripeEvent} from '../../commerce/stripe.mjs';
import {createPilot} from '../../commerce/server.mjs';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {config,service,check,fixtures,signIn} from './local-support.mjs';import {fakeStripe} from './fake-stripe.mjs';
const f=fixtures(),testConfig={...config,stripe:{mode:'test',secretKey:'sk_test_fixture',webhookSecret:'whsec_fixture',accountId:'acct_fixture',environmentName:'Bli Støgg test fixture'}};

test('BOUNDARY: injected SDK and simulation forbidden in Stripe mode, production and remote DB configs',async()=>{
 assert.throws(()=>requireSimulation(testConfig),/SIMULATION_DISABLED/);
 await assert.rejects(()=>createPilot(testConfig,{portal:4313,shop:4314},{stripeClient:{}}),/SIMULATION_DISABLED/);
 await assert.rejects(()=>fulfillStripeEvent({provider:'simulation',config:testConfig,event:{}}),/SIMULATION_DISABLED/);
 assert.throws(()=>validateConfig({...config,databaseUrl:'postgresql://user:password@remote.invalid:56322/postgres'}),/ISOLATED_LOCAL_CONFIG_REQUIRED/);
 assert.throws(()=>validateConfig({...config,databaseUrl:config.databaseUrl+'?host=remote.invalid'}),/ISOLATED_LOCAL_CONFIG_REQUIRED/);
 assert.throws(()=>validateConfig({...testConfig,stripe:{...testConfig.stripe,secretKey:'sk_live_fixture'}}),/EXPLICIT_STRIPE_TEST_ACCOUNT_REQUIRED/);
 const previous=process.env.NODE_ENV;try{process.env.NODE_ENV='production';assert.throws(()=>requireSimulation(config),/ISOLATED_LOCAL_CONFIG_REQUIRED/);}finally{process.env.NODE_ENV=previous;}
});
test('CATALOG: stable products/prices reused across concurrent orders and lost creation responses',async()=>{
 const stripe=fakeStripe(config),order={id:randomUUID(),company_id:f.company,store_id:f.store.id,buyer_id:f.buyer.id,currency:'nok',total:4900},items=[{product_id:f.products[0].id,name:'Snapshot',kind:'digital',unit_amount:4900,quantity:1}];
 const results=await Promise.all([checkoutLines(stripe,order,items),checkoutLines(stripe,order,items)]);assert.deepEqual(results[0],results[1]);assert.equal(stripe.productsById.size,1);
 assert.deepEqual(await checkoutLines(stripe,{...order,id:randomUUID()},items),results[0]);assert.equal(stripe.productsById.size,1);
 const create=stripe.products.create;stripe.products.create=async(...args)=>{await create(...args);throw Error('Lost response after product created');};
 await checkoutLines(stripe,order,[{...items[0],unit_amount:5000}]);assert.equal(stripe.productsById.size,2);
 const p=[...stripe.productsById.values()][0];p.default_price.unit_amount=1;await assert.rejects(()=>checkoutLines(stripe,order,items),/STRIPE_CATALOG_MISMATCH/);
 assert.throws(()=>checkoutParams(order,items,'https://evil.invalid',results[0]),/INVALID_RETURN_ORIGIN/);
 const params=checkoutParams(order,items,'http://127.0.0.1:4314',results[0]);assert.equal(params.metadata.store_id,order.store_id);assert.ok(params.cancel_url.startsWith('http://127.0.0.1:4314/#order/'));
});
test('LINES: 20-line cart uses complete list, not truncated embedded expansion',async()=>{
 const stripe=fakeStripe(config),order={id:randomUUID(),company_id:f.company,store_id:f.store.id,buyer_id:f.buyer.id,currency:'nok',total:20000};
 const items=Array.from({length:20},(_,i)=>({product_id:randomUUID(),name:'Test '+i,kind:'physical',unit_amount:1000,quantity:1}));
 const params=checkoutParams(order,items,'http://127.0.0.1:4314',await checkoutLines(stripe,order,items));const created=await stripe.checkout.sessions.create(params,{idempotencyKey:order.id});
 const retrieve=stripe.checkout.sessions.retrieve;stripe.checkout.sessions.retrieve=async id=>({...await retrieve(id),line_items:{data:created.line_items.data.slice(0,10),has_more:true}});
 const result=await retrieveSession(stripe,created.id);assert.equal(result.line_items.data.length,20);assert.doesNotThrow(()=>validateSession(result,order,items));
});
test('PAYMENT: paid session needs matching successful test PaymentIntent, store, amount and currency',()=>{
 const order={id:randomUUID(),company_id:f.company,store_id:f.store.id,buyer_id:f.buyer.id,currency:'nok',total:4900};const metadata={order_id:order.id,company_id:order.company_id,store_id:order.store_id,buyer_id:order.buyer_id};
 const intent={id:'pi_fixture',livemode:false,status:'succeeded',amount:4900,amount_received:4900,currency:'nok',metadata};
 assert.equal(validatePaymentIntent({payment_intent:intent},order),'pi_fixture');
 for(const patch of [{livemode:true},{amount:1},{amount_received:1},{currency:'usd'},{status:'processing'},{metadata:{...metadata,store_id:randomUUID()}},{metadata:{...metadata,buyer_id:randomUUID()}}])assert.throws(()=>validatePaymentIntent({payment_intent:{...intent,...patch}},order),/PAYMENT_INTENT_MISMATCH/);
});
test('HTTP: ambiguous Checkout timeout persists one pending order and retry recovers same session',async()=>{
 const fake=fakeStripe(config);fake.loseNextCreateResponse=true;
 const app=await createPilot({...config,stripe:{...config.stripe,accountId:'acct_simulated_fixture',webhookSecret:'whsec_fixture'}},{portal:4313,shop:4314},{stripeClient:fake});
 try{
  const person={email:'timeout-'+randomUUID()+'@test.invalid',password:'Pilot!'+randomUUID()};check(await service.auth.admin.createUser({...person,email_confirm:true}));const buyer=await signIn(person);
  const input={request_key:randomUUID(),items:[{product_id:f.products.find(p=>p.kind==='digital').id,quantity:1}]};
  const call=()=>fetch('http://127.0.0.1:4314/api/checkout',{method:'POST',headers:{Origin:'http://127.0.0.1:4314',Authorization:'Bearer '+buyer.token,'Content-Type':'application/json'},body:JSON.stringify(input)});
  const first=await call();assert.equal(first.status,503);assert.equal((await first.json()).error,'CHECKOUT_UNCONFIRMED');
  const orders=check(await buyer.client.from('commerce_orders').select('*'));assert.equal(orders.length,1);assert.equal(orders[0].status,'pending');assert.equal(check(await buyer.client.from('commerce_entitlements').select('*')).length,0);
  const second=await call();assert.equal(second.status,200);assert.equal((await second.json()).order_id,orders[0].id);assert.equal(fake.created.length,1);
  const payment=check(await service.from('commerce_payments').select('*').eq('order_id',orders[0].id).single());assert.equal(payment.provider,'simulation');assert.equal(payment.status,'pending');
 }finally{await app.close();}
});

test('PREFLIGHT: account and test environment verified before any object creation',async()=>{
 const fake=fakeStripe(config);
 await assert.rejects(()=>verifyStripeAccount(fake,{accountId:'acct_wrong'}),/STRIPE_ACCOUNT_MISMATCH/);assert.equal(fake.productsById.size,0);
 fake.balance.retrieve=async()=>({livemode:true});await assert.rejects(()=>verifyStripeAccount(fake,{accountId:'acct_simulated_fixture'}),/TEST_MODE_ONLY/);assert.equal(fake.created.length,0);
});

test('CONFIG: malformed private configuration never echoes file contents',()=>{
 const dir=mkdtempSync(join(tmpdir(),'bli-stogg-config-'));
 try{const path=join(dir,'runtime.json');writeFileSync(path,'{ "secretKey": "DO_NOT_ECHO_FIXTURE"');assert.throws(()=>loadConfig(path),error=>error.message==='PRIVATE_CONFIG_INVALID');
 assert.throws(()=>validateConfig({...config,databaseUrl:'DO_NOT_ECHO_FIXTURE'}),error=>error.message==='ISOLATED_LOCAL_CONFIG_REQUIRED');
 }finally{rmSync(dir,{recursive:true});}
});
