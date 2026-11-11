// Test-only in-memory Stripe. Never imported by application code.
import Stripe from 'stripe';
import {requireSimulation} from '../../commerce/config.mjs';
export function fakeStripe(config,accountId='acct_simulated_fixture') {
 requireSimulation(config);
 const products=new Map(),prices=new Map(),sessions=new Map(),created=[];
 const missing=()=>Object.assign(Error('Missing fixture'),{code:'resource_missing'});
 const fake={productsById:products,pricesById:prices,sessions,created,loseNextCreateResponse:false,accounts:{retrieve:async()=>({id:accountId})},balance:{retrieve:async()=>({livemode:false})},webhooks:Stripe.webhooks,
 products:{retrieve:async id=>{if(!products.has(id))throw missing();return products.get(id);},create:async p=>{
  if(products.has(p.id))throw Error('Duplicate fixture product');
  const price={id:'price_'+p.id,product:p.id,livemode:false,active:true,type:'one_time',...p.default_price_data};
  const product={...p,active:true,livemode:false,default_price:price};products.set(p.id,product);prices.set(price.id,price);return product;
 }},checkout:{sessions:{create:async(params,{idempotencyKey})=>{
  if(sessions.has(idempotencyKey))return sessions.get(idempotencyKey);
  const lines=params.line_items.map(i=>({quantity:i.quantity,price:{...prices.get(i.price),product:products.get(prices.get(i.price).product)}}));
  const s={id:'cs_test_http_'+params.client_reference_id,url:'https://checkout.stripe.com/c/pay/test-fixture',livemode:false,mode:'payment',status:'open',payment_status:'unpaid',client_reference_id:params.client_reference_id,metadata:params.metadata,currency:'nok',amount_total:lines.reduce((n,i)=>n+i.quantity*i.price.unit_amount,0),line_items:{has_more:false,data:lines}};
  created.push(params);sessions.set(idempotencyKey,s);sessions.set(s.id,s);
  if(fake.loseNextCreateResponse){fake.loseNextCreateResponse=false;throw Error('Simulated lost response');}return s;
 },retrieve:async id=>{
  const s=sessions.get(id);if(!s)throw missing();
  if(s.payment_status==='paid')s.payment_intent={id:'pi_sim_'+s.client_reference_id,livemode:false,status:'succeeded',amount:s.amount_total,amount_received:s.amount_total,currency:s.currency,metadata:s.metadata};
  return s;
 },listLineItems:async id=>sessions.get(id).line_items}}};return fake;
}
