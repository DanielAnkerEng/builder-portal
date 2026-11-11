import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import pg from 'pg';
import {config,fixtures} from './local-support.mjs';
test('REAL DB ROLLBACK: simulation fence, immutable history, separate Stripe proof, inactive replay and RPC ACLs',async()=>{
 const db=new pg.Client({connectionString:config.databaseUrl}),f=fixtures();await db.connect();await db.query('begin');
 const query=async(sql,args=[])=> (await db.query(sql,args)).rows;
 const rejected=async(sql,args,pattern)=>{await db.query('savepoint rejected');try{await assert.rejects(()=>db.query(sql,args),pattern);}finally{await db.query('rollback to savepoint rejected');}};
 try{
  const website=(await query("insert into public.websites(company_id,name,public_slug,created_by) values($1,'Rollback review',$2,$3) returning id",[f.company,'rollback-'+randomUUID(),f.admin.id]))[0].id;
  const store=(await query("insert into public.commerce_stores(company_id,website_id,slug,name) values($1,$2,$3,'Rollback review') returning *",[f.company,website,'rollback-'+randomUUID()]))[0];
  const product=(await query("insert into public.commerce_products(store_id,company_id,name,description,kind,game_key,unit_amount) values($1,$2,'Rollback product','','digital','bli-stogg-classic',4900) returning *",[store.id,f.company]))[0];
  await query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:f.buyer.id,aal:'aal1',role:'authenticated'})]);
  const cart=JSON.stringify([{product_id:product.id,quantity:1}]),key=randomUUID();
  const reserve=async k=>(await query('select (public.commerce_reserve_order($1,$2,$3)).*',[store.id,k,cart]))[0];
  const old=await reserve(key);assert.equal(old.payment_provider,'simulation');
  await query('update public.commerce_products set active=false where id=$1',[product.id]);
  await rejected('select public.commerce_reserve_order($1,$2,$3)',[store.id,key,cart],/PRODUCT_UNAVAILABLE/);
  await query('update public.commerce_products set active=true where id=$1',[product.id]);
  const record=(o,provider,event='evt_rollback_'+randomUUID())=>['select public.commerce_record_payment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[event,o.id,'cs_test_'+o.id,provider,'paid',o.total,'nok',o.company_id,o.buyer_id,'pi_rollback_'+o.id]];
  await query(...record(old,'simulation'));
  const original=(await query('select * from public.commerce_orders where id=$1',[old.id]))[0];
  const entitlement=(await query('select * from public.commerce_entitlements where order_id=$1',[old.id]))[0];
  await query("select public.commerce_activate_stripe_test($1,'acct_rollbackfixture')",[store.id]);
  await rejected(...record(old,'simulation'),/INVALID_PAYMENT/);
  await rejected('select public.commerce_reserve_order($1,$2,$3)',[store.id,key,cart],/PAYMENT_MODE_CONFLICT/);
  await rejected("select public.commerce_activate_stripe_test($1,'acct_different')",[store.id],/STRIPE_ACCOUNT_LOCKED/);
  const fresh=await reserve(randomUUID());assert.equal(fresh.payment_provider,'stripe_test');assert.notEqual(fresh.id,old.id);
  const args=record(fresh,'stripe_test');const invalid=[...args[1]];invalid[5]=null;
  await rejected(args[0],invalid,/PAYMENT_MISMATCH/);
  assert.equal((await query('select * from public.commerce_payments where order_id=$1',[fresh.id])).length,0,'Invalid payment rolls back its initial binding');
  // SQL contract only. No Stripe request; every row in this test is rolled back.
  await query(...args);
  const proof=await query('select provider from public.commerce_entitlement_proofs where entitlement_id=$1 order by provider',[entitlement.id]);assert.deepEqual(proof.map(p=>p.provider),['simulation','stripe_test']);
  assert.deepEqual((await query('select * from public.commerce_orders where id=$1',[old.id]))[0],original);
  assert.deepEqual((await query('select * from public.commerce_entitlements where id=$1',[entitlement.id]))[0],entitlement);
  await query('set local role authenticated');
  await rejected("select public.commerce_activate_stripe_test($1,'acct_forbidden')",[store.id],/permission denied/);
  await rejected(...args,/permission denied/);
  await rejected('select * from public.commerce_entitlement_proofs',[],/permission denied/);
  await query('reset role');await query('set local role service_role');
  await rejected('select public.commerce_apply_payment($1,$2,$3,$4,$5,$6,$7,$8,$9)',args[1].slice(0,9),/permission denied/);
 }finally{await db.query('rollback');await db.end();}
});
